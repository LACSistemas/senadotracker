import { FLAG } from './indicator-defs.ts';
import type { IndicatorRow } from './publication.ts';
import { ymDate } from './ym.ts';
import { SEG_VERSION, VDE_ALIASES, VDE_BY_NATIVE, VDE_RATE_EVENTS, VDE_UNASSIGNED_NAME, abrangenciaKey, isStructuralZero, normalizeName, vdeIndicatorId, type CidGroup } from './seguranca-defs.ts';

/** Diretório de entidades territoriais (carregado de civica_exec.exec_entity). Puro: facilita teste sem banco. */
export interface DirMunicipality { entityId: number; ufCode: number; name: string; norm: string; unproven: boolean; ibge6: string }
export interface EntityDir {
  municipalities: DirMunicipality[];
  /** UF → entidade "município ignorado" (kind 5). */
  ignoredByUf: Map<number, number>;
  /** ibge6 (inclui xx0000) → entity_id. */
  byIbge6: Map<string, number>;
  /** entity_id → UF (municípios, município ignorado e UF). */
  ufOf: Map<number, number>;
}
export interface EntityRow { entity_id: number; kind: number; ibge7: number; uf_code: number | null; name: string; unproven?: boolean }
export function buildEntityDir(rows: EntityRow[]): EntityDir {
  const municipalities: DirMunicipality[] = []; const ignoredByUf = new Map<number, number>(); const byIbge6 = new Map<string, number>(); const ufOf = new Map<number, number>();
  for (const r of rows) {
    const uf = r.uf_code == null ? null : Number(r.uf_code);
    if (uf != null) ufOf.set(Number(r.entity_id), uf);
    if (r.kind === 4 && uf != null) { municipalities.push({ entityId: Number(r.entity_id), ufCode: uf, name: r.name, norm: normalizeName(r.name), unproven: !!r.unproven, ibge6: String(Math.floor(Number(r.ibge7) / 10)) }); byIbge6.set(String(Math.floor(Number(r.ibge7) / 10)), Number(r.entity_id)); }
    if (r.kind === 5 && uf != null) { ignoredByUf.set(uf, Number(r.entity_id)); byIbge6.set(String(Math.floor(Number(r.ibge7) / 10)), Number(r.entity_id)); }
  }
  return { municipalities, ignoredByUf, byIbge6, ufOf };
}
/** Código de município do DATASUS → entidade. DF: códigos 53xxxx de regiões administrativas pertencem a Brasília (530010). Inexistente → undefined. */
export function resolveIbge6(code: string, dir: EntityDir): number | undefined {
  const e = dir.byIbge6.get(code); if (e !== undefined) return e;
  return /^53\d{4}$/.test(code) && !code.endsWith('0000') ? dir.byIbge6.get('530010') : undefined;
}
const nextYearStart = (year: number) => `${year + 1}-01-01`;
const smallN = (pop: number | undefined) => pop != null && pop < 20000 ? FLAG.smallN : 0;

// ------------------------------------------------------------------ SIM
export type SimCounts = Partial<Record<CidGroup, number>>;
export interface SimAgg { res: Record<string, SimCounts>; occ: Record<string, SimCounts>; stats: Record<string, number> }
const GROUPS: CidGroup[] = ['AGR', 'INT', 'GUE', 'IND'];
const sumG = (c: SimCounts) => (c.AGR ?? 0) + (c.INT ?? 0) + (c.GUE ?? 0) + (c.IND ?? 0);
const emptyTot = () => ({ AGR: 0, INT: 0, GUE: 0, IND: 0 });
const SIM_IDS = { res: { AGR: 3001, INT: 3002, GUE: 3003, IND: 3004, ATL: 3005 }, occ: { AGR: 3011, INT: 3012, GUE: 3013, IND: 3014, ATL: 3015 }, taxaAgr: 3006, taxaAtl: 3007, prop: 3008 } as const;
export const SIM_RES_IDS: number[] = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];
export const SIM_OCC_IDS: number[] = [3011, 3012, 3013, 3014, 3015];

interface SimRowsArgs { year: number; prelim: boolean; dir: EntityDir; pop: Map<number, number> }
function simCountRows(ids: Record<'AGR' | 'INT' | 'GUE' | 'IND' | 'ATL', number>, entity: number, c: SimCounts, a: SimRowsArgs): IndicatorRow[] {
  const ps = `${a.year}-01-01`, pe = nextYearStart(a.year), st = a.prelim ? 1 : 2, fl = a.prelim ? FLAG.preliminary : 0;
  const atl = (c.AGR ?? 0) + (c.INT ?? 0);
  const mk = (id: number, v: number): IndicatorRow => ({ indicator_id: id, entity_id: entity, period_start: ps, period_end: pe, status: st, numerator: v, denominator: null, value: v, flags: fl });
  return [mk(ids.AGR, c.AGR ?? 0), mk(ids.INT, c.INT ?? 0), mk(ids.GUE, c.GUE ?? 0), mk(ids.IND, c.IND ?? 0), mk(ids.ATL, atl)];
}
function simDerivedRows(entity: number, c: SimCounts, a: SimRowsArgs, isUf: boolean): IndicatorRow[] {
  const ps = `${a.year}-01-01`, pe = nextYearStart(a.year), st = a.prelim ? 1 : 2, base = a.prelim ? FLAG.preliminary : 0;
  const out: IndicatorRow[] = []; const pop = a.pop.get(entity); const atl = (c.AGR ?? 0) + (c.INT ?? 0);
  if (pop != null && pop > 0) {
    out.push({ indicator_id: SIM_IDS.taxaAgr, entity_id: entity, period_start: ps, period_end: pe, status: st, numerator: c.AGR ?? 0, denominator: pop, value: (c.AGR ?? 0) / pop * 100000, flags: base | (isUf ? 0 : smallN(pop)) });
    out.push({ indicator_id: SIM_IDS.taxaAtl, entity_id: entity, period_start: ps, period_end: pe, status: st, numerator: atl, denominator: pop, value: atl / pop * 100000, flags: base | (isUf ? 0 : smallN(pop)) });
  }
  const tot = sumG(c);
  if (tot >= 10) out.push({ indicator_id: SIM_IDS.prop, entity_id: entity, period_start: ps, period_end: pe, status: st, numerator: c.IND ?? 0, denominator: tot, value: (c.IND ?? 0) / tot * 100, flags: base });
  return out;
}
export interface SimSliceResult { rows: IndicatorRow[]; totals: Record<CidGroup, number>; quality: Record<string, unknown> }

/** Fatia de uma UF (perspectiva de residência): cada município do universo ganha linha (zero explícito); o que não tem município válido vai ao município ignorado da UF. */
export function buildSimResidence(agg: SimAgg, ufCode: number, a: SimRowsArgs): SimSliceResult {
  const ignored = a.dir.ignoredByUf.get(ufCode); if (ignored === undefined) throw new Error(`UF ${ufCode} sem município ignorado`);
  const byEntity = new Map<number, SimCounts>(); const tot = emptyTot(); let otherUf = 0, invalid = 0, unresolved = 0;
  const add = (e: number, c: SimCounts) => { const cur = byEntity.get(e) ?? {}; for (const g of GROUPS) if (c[g]) cur[g] = (cur[g] ?? 0) + c[g]!; byEntity.set(e, cur); };
  for (const [code, c] of Object.entries(agg.res)) {
    for (const g of GROUPS) tot[g] += c[g] ?? 0;
    if (code === '') { invalid += sumG(c); add(ignored, c); continue; }
    const e = resolveIbge6(code, a.dir);
    if (e === undefined) { unresolved += sumG(c); add(ignored, c); continue; }
    if (a.dir.ufOf.get(e) !== ufCode) { otherUf += sumG(c); add(ignored, c); continue; }
    add(e, c);
  }
  const rows: IndicatorRow[] = [];
  const universe = a.dir.municipalities.filter(m => m.ufCode === ufCode && (!m.unproven || byEntity.has(m.entityId)));
  for (const m of universe) { const c = byEntity.get(m.entityId) ?? {}; rows.push(...simCountRows(SIM_IDS.res, m.entityId, c, a), ...simDerivedRows(m.entityId, c, a, false)); }
  const ign = byEntity.get(ignored); if (ign && sumG(ign) > 0) rows.push(...simCountRows(SIM_IDS.res, ignored, ign, a));
  rows.push(...simCountRows(SIM_IDS.res, ufCode, tot, a), ...simDerivedRows(ufCode, tot, a, true));
  return { rows, totals: tot, quality: { rowsRead: agg.stats.rows_read ?? 0, nonfetal: agg.stats.nonfetal ?? 0, violent: sumG(tot), totals: tot, ignoredMunicipality: ign ? sumG(ign) : 0, invalidCode: invalid, unresolvedCode: unresolved, otherUfCode: otherUf, yearMismatch: agg.stats.year_mismatch ?? 0, municipalitiesInUniverse: universe.length, prelim: a.prelim } };
}
/** Fatia nacional (perspectiva de ocorrência): reúne os arquivos das 27 UFs; ocorrência sem município/UF válidos fica fora das entidades e é contada na qualidade. */
export function buildSimOccurrence(aggs: SimAgg[], a: SimRowsArgs): SimSliceResult & { byUf: Map<number, Record<CidGroup, number>> } {
  const byEntity = new Map<number, SimCounts>(); const tot = emptyTot(); let invalid = 0, unresolved = 0, invalidViolent = 0;
  const add = (e: number, c: SimCounts) => { const cur = byEntity.get(e) ?? {}; for (const g of GROUPS) if (c[g]) cur[g] = (cur[g] ?? 0) + c[g]!; byEntity.set(e, cur); };
  for (const agg of aggs) for (const [code, c] of Object.entries(agg.occ)) {
    for (const g of GROUPS) tot[g] += c[g] ?? 0;
    if (code === '') { invalid += sumG(c); invalidViolent += sumG(c); continue; }
    const e = resolveIbge6(code, a.dir); if (e === undefined) { unresolved += sumG(c); continue; }
    add(e, c);
  }
  const byUf = new Map<number, Record<CidGroup, number>>(); const rows: IndicatorRow[] = []; let placed = 0;
  for (const [e, c] of byEntity) { const uf = a.dir.ufOf.get(e)!; const t = byUf.get(uf) ?? emptyTot(); for (const g of GROUPS) t[g] += c[g] ?? 0; byUf.set(uf, t); placed += sumG(c); }
  const ignoredSet = new Set(a.dir.ignoredByUf.values());
  for (const m of a.dir.municipalities) { if (m.unproven && !byEntity.has(m.entityId)) continue; rows.push(...simCountRows(SIM_IDS.occ, m.entityId, byEntity.get(m.entityId) ?? {}, a)); }
  for (const e of ignoredSet) { const c = byEntity.get(e); if (c && sumG(c) > 0) rows.push(...simCountRows(SIM_IDS.occ, e, c, a)); }
  for (const [uf, t] of byUf) rows.push(...simCountRows(SIM_IDS.occ, uf, t, a));
  return { rows, totals: tot, byUf, quality: { files: aggs.length, violentAllFiles: sumG(tot), placed, unplacedInvalidCode: invalid, unplacedUnresolvedCode: unresolved, totals: tot, prelim: a.prelim, nonfetal: aggs.reduce((n, g) => n + (g.stats.nonfetal ?? 0), 0) } };
}

// ------------------------------------------------------------------ VDE
export interface VdeJson { rows_read: number; keys: number; competences: number[]; columns: string[]; bad: Record<string, number>; events: Record<string, number>; abrangencias: Record<string, number>;
  rows: Array<[string, string, string, number, string, number | null, number | null, number | null, number]>;
  cov: Array<{ uf: string; evento: string; comp: number; abr: string; mun: number; lin: number; nz: number; dup: number; vit: number; tot: number; peso: number }> }
export interface VdeCov { uf: number; indicator_id: number; competence: number; mun_pairs: number; src_lines: number; dup_lines: number; nz_rows: number; uf_total: number; unassigned: number; status: number }
export interface VdeCrosswalk { byUfName: Map<string, number>; aliasHits: Map<string, number> }
const xwKey = (uf: number, norm: string) => `${uf}|${norm}`;
export function buildVdeCrosswalk(dir: EntityDir, ufByAcronym: Map<string, number>): VdeCrosswalk {
  const byUfName = new Map<string, number>(); const seen = new Map<string, string>();
  for (const m of dir.municipalities) {
    const k = xwKey(m.ufCode, m.norm); if (byUfName.has(k)) throw new Error(`colisão de nome normalizado no IBGE: ${k} (${seen.get(k)} × ${m.name})`);
    byUfName.set(k, m.entityId); seen.set(k, m.name);
  }
  const aliasHits = new Map<string, number>();
  for (const al of VDE_ALIASES) {
    const uf = ufByAcronym.get(al.uf)!; const e = byUfName.get(xwKey(uf, normalizeName(al.canonical)));
    if (e === undefined) throw new Error(`alias ${al.source}/${al.uf}: município canônico "${al.canonical}" inexistente`);
    const m = dir.municipalities.find(x => x.entityId === e)!; if (m.ibge6 !== String(Math.floor(al.ibge7 / 10))) throw new Error(`alias ${al.source}: código ${al.ibge7} difere do IBGE (${m.ibge6})`);
    byUfName.set(xwKey(uf, normalizeName(al.source)), e); aliasHits.set(xwKey(uf, normalizeName(al.source)), 0);
  }
  return { byUfName, aliasHits };
}
export interface VdeBuildArgs { year: number; ufCode: number; ufAcronym: string; dir: EntityDir; xw: VdeCrosswalk; pop: Map<number, number>; currentYear: number; emptyMonths: Set<number>; ufByAcronym: Map<string, number> }
export interface VdeSliceResult { rows: IndicatorRow[]; cov: VdeCov[]; months: number[]; quality: Record<string, unknown>; xwStats: { pairsNonZero: number; matchedDirect: number; matchedAlias: number; unassignedName: number; unmatched: string[] } }
const valueOf = (m: 'vit' | 'tot' | 'peso', vit: number | null, tot: number | null, peso: number | null) => (m === 'vit' ? vit : m === 'tot' ? tot : peso);

export function buildVdeSlice(j: VdeJson, a: VdeBuildArgs): VdeSliceResult {
  const months = [...new Set(j.cov.filter(c => c.uf === a.ufAcronym).map(c => c.comp))].filter(m => !a.emptyMonths.has(m)).sort((x, y) => x - y);
  const monthSet = new Set(months); const prelim = a.year >= a.currentYear; const st = prelim ? 1 : 2, base = prelim ? FLAG.preliminary : 0;
  const ignored = a.dir.ignoredByUf.get(a.ufCode); if (ignored === undefined) throw new Error(`UF ${a.ufCode} sem município ignorado`);
  const rows: IndicatorRow[] = []; const cov: VdeCov[] = [];
  const muniAnnual = new Map<string, number>();        // `${ind}|${entity}` → soma anual (somente municípios e ignorado)
  const unmatched = new Set<string>(); let nz = 0, direct = 0, viaAlias = 0, unassignedName = 0;
  const unassignedByKey = new Map<string, number>();    // `${ind}|${comp}` → valor atribuído ao município ignorado
  for (const r of j.rows) {
    const [uf, mun, ev, ym, ab, vit, tot, peso] = r;
    if (uf !== a.ufAcronym || !monthSet.has(ym)) continue;
    const ind = vdeIndicatorId(ev, ab);
    if (ind == null) {
      if (isStructuralZero(ev, ab)) throw new Error(`zero estrutural com valor ≠ 0: ${ev} / ${ab} (${uf} ${ym})`);
      throw new Error(`evento/abrangência desconhecido no VDE: "${ev}" / "${ab}" — atualizar o contrato (seguranca-defs.ts)`);
    }
    const ev0 = VDE_BY_NATIVE.get(ev)!; const mval = valueOf(ev0.measure, vit, tot, peso);
    for (const [k, v] of [['vit', vit], ['tot', tot], ['peso', peso]] as const) if (k !== ev0.measure && v != null && v !== 0) throw new Error(`medida inesperada: ${ev} traz ${k} ≠ 0 (esperado ${ev0.measure})`);
    if (mval == null || mval === 0) continue;
    nz++;
    if (ev0.level === 'U') { if (mun !== VDE_UNASSIGNED_NAME) throw new Error(`evento só-UF com município "${mun}": ${ev}`); continue; }  // UF-level vem de `cov`
    let entity: number; const norm = normalizeName(mun);
    if (mun === VDE_UNASSIGNED_NAME) { entity = ignored; unassignedName++; }
    else {
      const e = a.xw.byUfName.get(xwKey(a.ufCode, norm));
      if (e === undefined) { entity = ignored; unmatched.add(mun); }
      else { entity = e; if (a.xw.aliasHits.has(xwKey(a.ufCode, norm))) { viaAlias++; a.xw.aliasHits.set(xwKey(a.ufCode, norm), (a.xw.aliasHits.get(xwKey(a.ufCode, norm)) ?? 0) + 1); } else direct++; }
    }
    if (entity === ignored) unassignedByKey.set(`${ind}|${ym}`, (unassignedByKey.get(`${ind}|${ym}`) ?? 0) + mval);
    rows.push({ indicator_id: ind, entity_id: entity, period_start: ymDate(ym), period_end: ymDate(ym % 100 === 12 ? (Math.floor(ym / 100) + 1) * 100 + 1 : ym + 1), status: st, numerator: mval, denominator: null, value: mval, flags: base });
    const ak = `${ind}|${entity}`; muniAnnual.set(ak, (muniAnnual.get(ak) ?? 0) + mval);
  }
  if (unmatched.size) { const pct = unmatched.size; if (pct > 5) throw new Error(`${pct} nomes municipais sem correspondência no IBGE em ${a.ufAcronym}: ${[...unmatched].slice(0, 6).join(', ')}`); }
  const ufAnnual = new Map<number, number>();           // indicador → soma anual da UF
  const monthsByInd = new Map<number, Set<number>>();
  for (const c of j.cov) {
    if (c.uf !== a.ufAcronym || !monthSet.has(c.comp)) continue;
    const ind = vdeIndicatorId(c.evento, c.abr);
    if (ind == null) { if (isStructuralZero(c.evento, c.abr)) continue; throw new Error(`evento/abrangência desconhecido no VDE: "${c.evento}" / "${c.abr}"`); }
    const ev0 = VDE_BY_NATIVE.get(c.evento)!; const total = ev0.measure === 'vit' ? c.vit : ev0.measure === 'tot' ? c.tot : c.peso;
    const status = total !== 0 ? 1 : 2;
    cov.push({ uf: a.ufCode, indicator_id: ind, competence: c.comp, mun_pairs: c.mun, src_lines: c.lin, dup_lines: c.dup, nz_rows: c.nz, uf_total: total, unassigned: unassignedByKey.get(`${ind}|${c.comp}`) ?? 0, status });
    rows.push({ indicator_id: ind, entity_id: a.ufCode, period_start: ymDate(c.comp), period_end: ymDate(c.comp % 100 === 12 ? (Math.floor(c.comp / 100) + 1) * 100 + 1 : c.comp + 1), status: st, numerator: total, denominator: null, value: total, flags: base | (status === 2 ? FLAG.zeroAmbiguous : 0) });
    ufAnnual.set(ind, (ufAnnual.get(ind) ?? 0) + total); const ms = monthsByInd.get(ind) ?? new Set<number>(); ms.add(c.comp); monthsByInd.set(ind, ms);
  }
  // taxas anuais (ano civil completo e fechado; denominador do mesmo ano; sem interpolação)
  const complete = !prelim && months.length === 12;
  if (complete) for (const ev of VDE_RATE_EVENTS) {
    const ind = ev.abr.E; if (!ind || !ev.rate) continue;
    const ps = `${a.year}-01-01`, pe = nextYearStart(a.year);
    const emit = (entity: number, num: number, isUf: boolean) => {
      const pop = a.pop.get(entity); if (pop == null || pop <= 0) return;
      rows.push({ indicator_id: ev.rate!, entity_id: entity, period_start: ps, period_end: pe, status: 2, numerator: num, denominator: pop, value: num / pop * 100000, flags: isUf ? 0 : smallN(pop) });
    };
    if ((monthsByInd.get(ind)?.size ?? 0) === 12) emit(a.ufCode, ufAnnual.get(ind) ?? 0, true);
    if (ev.level === 'M') for (const m of a.dir.municipalities) { if (m.ufCode !== a.ufCode) continue; const v = muniAnnual.get(`${ind}|${m.entityId}`); if (v) emit(m.entityId, v, false); }
  }
  return { rows, cov, months, quality: { parser: SEG_VERSION.vde, crosswalk: SEG_VERSION.crosswalk, months, emptyMonths: [...a.emptyMonths], nonzeroKeys: nz, rowsFile: j.rows_read, dupLines: cov.reduce((n, c) => n + c.dup_lines, 0), unassignedName, unmatchedNames: [...unmatched], prelim, rateYearComplete: complete }, xwStats: { pairsNonZero: nz, matchedDirect: direct, matchedAlias: viaAlias, unassignedName, unmatched: [...unmatched] } };
}
/** Meses em que TODAS as linhas de todos os eventos/UFs estão zeradas: o arquivo os preencheu antes de haver dado (ex.: meses futuros); não são publicados. */
export function findEmptyMonths(j: VdeJson): Set<number> {
  const tot = new Map<number, number>();
  for (const c of j.cov) tot.set(c.comp, (tot.get(c.comp) ?? 0) + Math.abs(c.vit) + Math.abs(c.tot) + Math.abs(c.peso));
  return new Set([...tot].filter(([, v]) => v === 0).map(([k]) => k));
}
export { abrangenciaKey };
