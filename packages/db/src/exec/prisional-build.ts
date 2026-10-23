import { FLAG } from './indicator-defs.ts';
import type { IndicatorRow } from './publication.ts';
import type { EntityDir } from './seguranca-build.ts';
import { compactKey } from './transito-defs.ts';
import { CAP_REGIMES, POP_GROUPS, PRI_AMBITO, PRI_MEASURES, PRI_MEASURE_BY_HEADER, PRI_TIPO, semesterOfRef, type Semester } from './prisional-defs.ts';

/** Formato produzido por scripts/exec/sisdepen_extract.py (uma linha por estabelecimento; sem endereço, telefone ou perfil de custodiados). */
export interface PriRow {
  row: number; ciclo: string; ano: string; ref: string; tipo: string; preench: string; nome: string; situacao: string; outras: string; cep: string; ambito: string; uf: string; municipio: string; ibge: string;
  sexo: string; tipo_orig: string; gestao: string; cap: Record<string, number | null>; pop: Record<string, number | null>;
}
export interface PriCycleJson { version: string; head_cols: number; cap_cols: string[]; pop_cols: string[]; rows: PriRow[] }

const tipoOf = (t: string): number | null => /^cela f/i.test(t) ? PRI_TIPO.cela : /^domiciliar sem/i.test(t) ? PRI_TIPO.domSem : /^domiciliar com/i.test(t) ? PRI_TIPO.domCom : null;
const ambitoOf = (a: string): number | null => /^estadual$/i.test(a) ? PRI_AMBITO.estadual : /^federal$/i.test(a) ? PRI_AMBITO.federal : null;
const sexOf = (s: string): number | null => /^masc/i.test(s) ? 1 : /^fem/i.test(s) ? 2 : /^misto/i.test(s) ? 3 : null;
const gestaoOf = (s: string): number | null => /^p.blica$/i.test(s) ? 1 : /^co-?gest/i.test(s) ? 2 : /^parceria/i.test(s) ? 3 : /^organiza/i.test(s) ? 4 : null;
const tg = (tipo: number) => tipo === PRI_TIPO.cela ? 'C' : 'D';

// ===================================================================== validação de layout e de linhas
export interface PriChecked { semester: Semester; rows: Array<PriRow & { tipoN: number; ambitoN: number }>; excluded: { notValidated: number; notActive: number; badTipo: number; badAmbito: number } }
/** Confere o layout (todas as 71 colunas de medida conhecidas) e a referência única do ciclo; só linhas "Validado" e "Ativo" com tipo e âmbito reconhecidos seguem. */
export function checkCycle(j: PriCycleJson, expectedRef?: string): PriChecked {
  if (!j.rows.length) throw new Error('ciclo sem linhas');
  const known = new Set(PRI_MEASURES.map(m => m.header)); const got = new Set([...j.cap_cols, ...j.pop_cols]);
  const unknown = [...got].filter(h => !known.has(h)); const missing = [...known].filter(h => !got.has(h));
  if (unknown.length || missing.length) throw new Error(`layout do SISDEPEN mudou: colunas novas ${JSON.stringify(unknown.slice(0, 3))}; ausentes ${JSON.stringify(missing.slice(0, 3))}`);
  const refs = new Set(j.rows.map(r => r.ref)); if (refs.size !== 1) throw new Error(`mais de uma referência no arquivo: ${[...refs].join(', ')}`);
  const ref = [...refs][0]!; if (expectedRef && ref !== expectedRef) throw new Error(`referência do arquivo ${ref} ≠ esperada ${expectedRef}`);
  const semester = semesterOfRef(ref); const ciclos = new Set(j.rows.map(r => Number(r.ciclo))); if (ciclos.size !== 1 || ![...ciclos][0]) throw new Error('coluna ciclo inconsistente');
  if ([...ciclos][0] !== semester.cycle) throw new Error(`ciclo ${[...ciclos][0]} não corresponde à referência ${ref} (esperado ${semester.cycle})`);
  const excluded = { notValidated: 0, notActive: 0, badTipo: 0, badAmbito: 0 }; const rows: PriChecked['rows'] = [];
  for (const r of j.rows) {
    if (!/^validado$/i.test(r.preench)) { excluded.notValidated++; continue; }
    if (!/^ativo$/i.test(r.situacao)) { excluded.notActive++; continue; }
    const t = tipoOf(r.tipo); if (t == null) { excluded.badTipo++; continue; }
    const a = ambitoOf(r.ambito); if (a == null) { excluded.badAmbito++; continue; }
    rows.push({ ...r, tipoN: t, ambitoN: a });
  }
  return { semester, rows, excluded };
}

// ===================================================================== identidade histórica (chave INTERNA do Cívica)
export interface PriAssign { competence: number; row: number; unitId: number; method: 0 | 1 | 2 | 3 | 9; confidence: number; review: 0 | 1; evidence: string }
export interface PriUnit { unitId: number; uf: string; ambito: number; firstCompetence: number; lastCompetence: number; canonicalName: string }
export interface PriResolved { units: Map<number, PriUnit>; assigns: Map<string, PriAssign>; seen: Map<number, Set<number>>; stats: Map<number, { newUnits: number; exact: number; renamed: number; moved: number; ambiguous: number }> }
const aKey = (competence: number, row: number) => `${competence}:${row}`;
const validCep = (c: string) => c.length >= 8 && !/^0+$/.test(c);
/**
 * Atribui unit_id a cada linha de cada ciclo, em ordem cronológica. Regras determinísticas, sem aproximação textual:
 *  1 (confiança 100): mesma UF + município (IBGE) + nome normalizado + grupo de tipo (cela × domiciliar), único dos dois lados;
 *  2 (70, revisar): nome diferente, mesma UF + município + CEP + grupo de tipo, candidato único e linha única (renomeação);
 *  3 (60, revisar): mesmo nome e CEP, município diferente (mudança de município);
 *  0: unidade nova; 9 (0, revisar): havia candidatos ambíguos (homônimos/complexo com o mesmo CEP) — fica SEPARADA até validação.
 * Unidade ausente de um ciclo continua existindo (ausência ≠ encerramento) e pode reaparecer pela regra 1/2/3.
 */
export function resolveIdentities(cycles: Array<{ semester: Semester; rows: PriChecked['rows'] }>): PriResolved {
  const sorted = [...cycles].sort((a, b) => a.semester.competence - b.semester.competence);
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.semester.competence === sorted[i - 1]!.semester.competence) throw new Error(`ciclo repetido ${sorted[i]!.semester.ref}`);
  const units = new Map<number, PriUnit>(); const assigns = new Map<string, PriAssign>(); const seen = new Map<number, Set<number>>(); const stats: PriResolved['stats'] = new Map();
  const idx1 = new Map<string, number[]>(), idx2 = new Map<string, number[]>(), idx3 = new Map<string, number[]>(); const lastSeen = new Map<number, number>(); let next = 1;
  const push = (m: Map<string, number[]>, k: string, u: number) => { const a = m.get(k); if (!a) m.set(k, [u]); else if (!a.includes(u)) a.push(u); };
  for (const { semester, rows } of sorted) {
    const comp = semester.competence; const order = [...rows].sort((a, b) => a.uf.localeCompare(b.uf) || compactKey(a.nome).localeCompare(compactKey(b.nome)) || a.ibge.localeCompare(b.ibge) || a.row - b.row);
    const matched = new Set<number>(); const done = new Map<number, number>(); const st = { newUnits: 0, exact: 0, renamed: 0, moved: 0, ambiguous: 0 }; stats.set(comp, st);
    const k1 = (r: PriChecked['rows'][number]) => `${r.uf}|${r.ibge}|${compactKey(r.nome)}|${tg(r.tipoN)}`;
    const k2 = (r: PriChecked['rows'][number]) => validCep(r.cep) ? `${r.uf}|${r.ibge}|${r.cep}|${tg(r.tipoN)}` : '';
    const k3 = (r: PriChecked['rows'][number]) => validCep(r.cep) ? `${r.uf}|${compactKey(r.nome)}|${r.cep}|${tg(r.tipoN)}` : '';
    const count = (f: (r: PriChecked['rows'][number]) => string, pool: PriChecked['rows']) => { const m = new Map<string, number>(); for (const r of pool) { const k = f(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); } return m; };
    const take = (r: PriChecked['rows'][number], u: number, method: 1 | 2 | 3, confidence: number, review: 0 | 1, evidence: string) => { matched.add(u); done.set(r.row, u); assigns.set(aKey(comp, r.row), { competence: comp, row: r.row, unitId: u, method, confidence, review, evidence }); };
    const ambiguous = new Set<number>();
    // regra 1
    const c1 = count(k1, order);
    for (const r of order) {
      const cand = (idx1.get(k1(r)) ?? []).filter(u => !matched.has(u));
      if (c1.get(k1(r)) === 1 && cand.length === 1) { take(r, cand[0]!, 1, 100, 0, 'mesma UF, município, nome normalizado e tipo'); st.exact++; }
      else if (cand.length > 0 && (c1.get(k1(r))! > 1 || cand.length > 1)) ambiguous.add(r.row);
    }
    // regra 2 (renomeação) e 3 (mudança de município) entre as linhas ainda sem unidade
    for (const [kf, idxM, method, conf, ev] of [[k2, idx2, 2, 70, 'mesmo município e CEP; nome diferente (renomeação provável)'], [k3, idx3, 3, 60, 'mesmo nome e CEP; município diferente (mudança de município provável)']] as const) {
      const pool = order.filter(r => !done.has(r.row)); const cc = count(kf, pool);
      for (const r of pool) {
        const k = kf(r); if (!k) continue;
        const cand = (idxM.get(k) ?? []).filter(u => !matched.has(u) && (lastSeen.get(u) ?? 0) < comp);
        if (cc.get(k) === 1 && cand.length === 1 && !ambiguous.has(r.row)) { take(r, cand[0]!, method, conf, 1, ev); if (method === 2) st.renamed++; else st.moved++; }
        else if (cand.length > 0 && (cc.get(k)! > 1 || cand.length > 1)) ambiguous.add(r.row);
      }
    }
    // unidades novas (ou separadas por ambiguidade)
    for (const r of order.filter(x => !done.has(x.row))) {
      const u = next++; const amb = ambiguous.has(r.row);
      units.set(u, { unitId: u, uf: r.uf, ambito: r.ambitoN, firstCompetence: comp, lastCompetence: comp, canonicalName: r.nome }); matched.add(u); done.set(r.row, u);
      assigns.set(aKey(comp, r.row), { competence: comp, row: r.row, unitId: u, method: amb ? 9 : 0, confidence: amb ? 0 : 100, review: amb ? 1 : 0, evidence: amb ? 'candidatos ambíguos (homônimos ou mesmo CEP): mantida separada até validação' : (sorted[0]!.semester.competence === comp ? 'primeiro ciclo da série' : 'sem correspondência em ciclo anterior') });
      if (amb) st.ambiguous++; else st.newUnits++;
    }
    for (const r of order) {
      const u = done.get(r.row)!; const un = units.get(u)!; un.lastCompetence = comp; un.canonicalName = r.nome; un.ambito = r.ambitoN; lastSeen.set(u, comp);
      push(idx1, k1(r), u); if (k2(r)) push(idx2, k2(r), u); if (k3(r)) push(idx3, k3(r), u);
      let s = seen.get(comp); if (!s) seen.set(comp, s = new Set()); s.add(u);
    }
  }
  return { units, assigns, seen, stats };
}

// ===================================================================== agregados
export interface PriAgg {
  unitsE: number; capE: number; popE: number; popEl: number; capEl: number; excGross: number; noCap: number; eligible: number; capM: number; capF: number; popM: number; popF: number; popReg: number[]; capReg: number[];
  unitsF: number; capF_: number; popF_: number; popElF: number; capElF: number; excGrossF: number; noCapF: number; eligibleF: number;
  domUnitsCom: number; domPopCom: number; domUnitsSem: number; domPopSem: number; incomplete: number; incompleteF: number;
}
export const emptyAgg = (): PriAgg => ({ unitsE: 0, capE: 0, popE: 0, popEl: 0, capEl: 0, excGross: 0, noCap: 0, eligible: 0, capM: 0, capF: 0, popM: 0, popF: 0, popReg: POP_GROUPS.map(() => 0), capReg: CAP_REGIMES.map(() => 0),
  unitsF: 0, capF_: 0, popF_: 0, popElF: 0, capElF: 0, excGrossF: 0, noCapF: 0, eligibleF: 0, domUnitsCom: 0, domPopCom: 0, domUnitsSem: 0, domPopSem: 0, incomplete: 0, incompleteF: 0 });
export function addAgg(a: PriAgg, b: PriAgg): PriAgg {
  const o = emptyAgg() as unknown as Record<string, number | number[]>; const x = a as unknown as Record<string, number | number[]>, y = b as unknown as Record<string, number | number[]>;
  for (const k of Object.keys(o)) o[k] = Array.isArray(x[k]) ? (x[k] as number[]).map((v, i) => v + (y[k] as number[])[i]!) : (x[k] as number) + (y[k] as number);
  return o as unknown as PriAgg;
}
/** Capacidade utilizável de uma cela física: masculino + feminino; célula vazia só é "não aplicável" em unidade de um único sexo. null = incompleta. */
export function unitCapacity(sexo: string, m: number | null, f: number | null): number | null {
  const sx = sexOf(sexo); const okM = m != null || sx === 2; const okF = f != null || sx === 1;
  if (!okM || !okF || (m == null && f == null)) return null;
  return (m ?? 0) + (f ?? 0);
}
/** Soma do que foi declarado (masculino + feminino), mesmo com componente esperado vazio: é a soma que o relatório oficial da SENAPPEN usa. null = nenhum componente declarado. */
export function unitCapacityDeclared(m: number | null, f: number | null): number | null { return m == null && f == null ? null : (m ?? 0) + (f ?? 0); }
const num = (v: number | null | undefined) => v ?? 0;
const HDR = new Map(PRI_MEASURES.map(m => [m.code, m.header]));
/** Contribuição de UM estabelecimento aos agregados. */
export function unitAgg(r: PriChecked['rows'][number]): PriAgg {
  const g = emptyAgg(); const pop = r.pop; const h = (code: string) => HDR.get(code)!; const total = num(pop[h('pop.total')]);
  if (r.tipoN === PRI_TIPO.domCom) { g.domUnitsCom = 1; g.domPopCom = total; return g; }
  if (r.tipoN === PRI_TIPO.domSem) { g.domUnitsSem = 1; g.domPopSem = total; return g; }
  const cm = r.cap[h('cap.total.M')] ?? null, cf = r.cap[h('cap.total.F')] ?? null; const capT = unitCapacity(r.sexo, cm, cf); const capD = unitCapacityDeclared(cm, cf); const fed = r.ambitoN === PRI_AMBITO.federal;
  const eligible = capT != null && capT > 0; const noCap = total > 0 && (capD == null || capD === 0);
  if (fed) {
    g.unitsF = 1; g.popF_ = total; if (capD != null) g.capF_ = capD; if (capT == null) g.incompleteF = 1; if (eligible) { g.eligibleF = 1; g.popElF = total; g.capElF = capT!; g.excGrossF = Math.max(0, total - capT!); } if (noCap) g.noCapF = 1; return g;
  }
  g.unitsE = 1; g.popE = total; if (capD != null) g.capE = capD; if (capT == null) g.incomplete = 1;
  if (eligible) { g.eligible = 1; g.popEl = total; g.capEl = capT!; g.excGross = Math.max(0, total - capT!); }
  if (noCap) g.noCap = 1;
  g.capM = num(r.cap[h('cap.total.M')]); g.capF = num(r.cap[h('cap.total.F')]);
  g.popM = POP_GROUPS.reduce((n, [k]) => n + num(pop[h(`pop.${k}.EM`)]) + num(pop[h(`pop.${k}.FM`)]) + num(pop[h(`pop.${k}.OM`)]), 0);
  g.popF = POP_GROUPS.reduce((n, [k]) => n + num(pop[h(`pop.${k}.EF`)]) + num(pop[h(`pop.${k}.FF`)]) + num(pop[h(`pop.${k}.OF`)]), 0);
  g.popReg = POP_GROUPS.map(([k]) => num(pop[h(`pop.${k}.T`)])); g.capReg = CAP_REGIMES.map(([k]) => num(r.cap[h(`cap.${k}.T`)]));
  return g;
}

/** Linhas de exec_ind_value de um território a partir do agregado (mesma função para município, UF e Brasil). */
export function aggRows(entityId: number, g: PriAgg, w: Semester): IndicatorRow[] {
  const out: IndicatorRow[] = []; const put = (id: number, value: number | null, flags = 0, numerator: number | null = value, denominator: number | null = null) =>
    out.push({ indicator_id: id, entity_id: entityId, period_start: w.start, period_end: w.end, status: 2, numerator, denominator, value, flags });
  const fam = (base: number, units: number, cap: number, pop: number, popEl: number, capEl: number, exGross: number, noCap: number, eligible: number, incomplete: number) => {
    if (units <= 0) return;
    put(base + 1, units); put(base + 2, cap, incomplete > 0 ? FLAG.partialCoverage : 0); put(base + 3, pop);
    const partial = noCap + incomplete > 0 ? FLAG.partialCoverage : 0;
    if (eligible > 0) { put(base + 4, popEl / capEl * 100, partial, popEl, capEl); put(base + 5, popEl - capEl, partial, popEl, capEl); put(base + 6, exGross, partial); }
    else { put(base + 4, null, FLAG.noDenominator, null, null); put(base + 5, null, FLAG.noDenominator, null, null); }
    put(base + 7, noCap); put(base + 8, eligible);
  };
  fam(6000, g.unitsE, g.capE, g.popE, g.popEl, g.capEl, g.excGross, g.noCap, g.eligible, g.incomplete);
  fam(6100, g.unitsF, g.capF_, g.popF_, g.popElF, g.capElF, g.excGrossF, g.noCapF, g.eligibleF, g.incompleteF);
  if (g.unitsE > 0) {
    put(6020, g.capM); put(6021, g.capF); put(6022, g.popM); put(6023, g.popF);
    g.popReg.forEach((v, i) => put(6024 + i, v)); g.capReg.forEach((v, i) => put(6030 + i, v));
  }
  if (g.domUnitsCom > 0) { put(6040, g.domUnitsCom); put(6041, g.domPopCom); }
  if (g.domUnitsSem > 0) { put(6042, g.domUnitsSem); put(6043, g.domPopSem); }
  return out;
}
/** Identificadores aditivos e o valor que cada um assume em um agregado (para a verificação Σ municípios + não conciliados = UF). */
export function additiveValues(g: PriAgg): Record<number, number> {
  const o: Record<number, number> = {};
  const fam = (base: number, units: number, cap: number, pop: number, exGross: number, noCap: number, eligible: number) => { if (units > 0) Object.assign(o, { [base + 1]: units, [base + 2]: cap, [base + 3]: pop, [base + 7]: noCap, [base + 8]: eligible }); if (eligible > 0) o[base + 6] = exGross; };
  fam(6000, g.unitsE, g.capE, g.popE, g.excGross, g.noCap, g.eligible); fam(6100, g.unitsF, g.capF_, g.popF_, g.excGrossF, g.noCapF, g.eligibleF);
  if (g.unitsE > 0) { o[6020] = g.capM; o[6021] = g.capF; o[6022] = g.popM; o[6023] = g.popF; g.popReg.forEach((v, i) => { o[6024 + i] = v; }); g.capReg.forEach((v, i) => { o[6030 + i] = v; }); }
  if (g.domUnitsCom > 0) { o[6040] = g.domUnitsCom; o[6041] = g.domPopCom; } if (g.domUnitsSem > 0) { o[6042] = g.domUnitsSem; o[6043] = g.domPopSem; }
  return o;
}

// ===================================================================== fatia UF × ciclo
export interface PriSliceArgs { ufAcronym: string; ufCode: number; ufEntity: number; dir: EntityDir; resolved: PriResolved; prevUnits: Set<number>; ufCodeByAcronym?: Map<string, number> }
export interface PriSlice {
  units: Array<Record<string, unknown>>; obs: Array<Record<string, unknown>>; facts: Array<Record<string, unknown>>; xwalk: Array<Record<string, unknown>>; cov: Array<Record<string, unknown>>;
  indicators: IndicatorRow[]; agg: PriAgg; muniAgg: Map<number, PriAgg>; unassigned: Record<number, number>; quality: Record<string, unknown>;
}
export function buildPriSlice(chk: PriChecked, a: PriSliceArgs): PriSlice {
  const w = chk.semester; const rows = chk.rows.filter(r => r.uf === a.ufAcronym);
  const units: PriSlice['units'] = [], obs: PriSlice['obs'] = [], facts: PriSlice['facts'] = [], xwalk: PriSlice['xwalk'] = [];
  let agg = emptyAgg(); const muniAgg = new Map<number, PriAgg>(); let unassignedAgg = emptyAgg(); const seenUnits = new Set<number>();
  let cela = 0, domSem = 0, domCom = 0, federal = 0, incomplete = 0, unassignedMun = 0, fresh = 0, cont = 0;
  for (const r of rows) {
    const as = a.resolved.assigns.get(aKey(w.competence, r.row)); if (!as) throw new Error(`linha ${r.row} sem unit_id (identidade não resolvida)`);
    const un = a.resolved.units.get(as.unitId)!; seenUnits.add(as.unitId);
    const ibge7 = /^\d{7}$/.test(r.ibge) ? Number(r.ibge) : null; const ent = ibge7 ? a.dir.byIbge6.get(String(Math.floor(ibge7 / 10))) ?? null : null;
    if (ent == null) unassignedMun++;
    if (r.tipoN === PRI_TIPO.cela) cela++; else if (r.tipoN === PRI_TIPO.domSem) domSem++; else domCom++; if (r.ambitoN === PRI_AMBITO.federal) federal++;
    if (as.method === 0 || as.method === 9) fresh++; else cont++;
    units.push({ unit_id: un.unitId, uf: a.ufCode, ambito: un.ambito, first_competence: un.firstCompetence, last_competence: un.lastCompetence, canonical_name: un.canonicalName, key_kind: 1 });
    obs.push({ unit_id: un.unitId, competence: w.competence, uf: a.ufCode, cycle: w.cycle, source_name: r.nome, other_names: r.outras || null, entity_id: ent, ibge7, tipo: r.tipoN, ambito: r.ambitoN, sex_dest: sexOf(r.sexo), gestao: gestaoOf(r.gestao), row_no: r.row });
    for (const [h, v] of [...Object.entries(r.cap), ...Object.entries(r.pop)]) { if (v == null) continue; const m = PRI_MEASURE_BY_HEADER.get(h)!; facts.push({ unit_id: un.unitId, competence: w.competence, measure_id: m.id, value: v }); }
    xwalk.push({ competence: w.competence, row_no: r.row, uf: a.ufCode, unit_id: un.unitId, source_name: r.nome, source_city: r.municipio, ibge7, method: as.method, confidence: as.confidence, review: as.review, evidence: as.evidence });
    const g = unitAgg(r); agg = addAgg(agg, g); if (g.incomplete || g.incompleteF) incomplete++;
    if (ent != null) muniAgg.set(ent, addAgg(muniAgg.get(ent) ?? emptyAgg(), g)); else unassignedAgg = addAgg(unassignedAgg, g);
  }
  const absent = [...a.prevUnits].filter(u => a.resolved.units.get(u)?.uf === a.ufAcronym && !seenUnits.has(u)).length;
  const cov = [{ competence: w.competence, uf: a.ufCode, rows_in_file: rows.length, cela, dom_sem: domSem, dom_com: domCom, federal, new_units: fresh, continuing: cont, absent_vs_prev: absent, cap_incomplete: incomplete, unassigned_mun: unassignedMun }];
  const indicators: IndicatorRow[] = [...aggRows(a.ufEntity, agg, w)]; for (const [e, g] of muniAgg) indicators.push(...aggRows(e, g, w));
  const unassigned = additiveValues(unassignedAgg);
  return { units, obs, facts, xwalk, cov, indicators, agg, muniAgg, unassigned, quality: { competence: w.competence, ref: w.ref, uf: a.ufAcronym, rows: rows.length, cela, domSem, domCom, federal, municipalities: muniAgg.size, unassignedMun, factRows: facts.length, indicatorRows: indicators.length, excluded: chk.excluded } };
}
/** Brasil = soma dos agregados das 27 UFs (nenhum valor é recalculado de outra fonte). */
export function buildPriNational(aggs: PriAgg[], brEntity: number, w: Semester): IndicatorRow[] { return aggRows(brEntity, aggs.reduce(addAgg, emptyAgg()), w); }
