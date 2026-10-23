import { FLAG } from './indicator-defs.ts';
import type { IndicatorRow } from './publication.ts';
import { ymDate, ymNext } from './ym.ts';
import { resolveIbge6, type EntityDir } from './seguranca-build.ts';
import {
  COV_SCOPE, COV_SOURCE, FROTA_COLUMNS, FROTA_IDS, INFR_IDS, PRF_ANNUAL_IDS, PRF_METRICS, PRF_MONTHLY_IDS, REN_CORE, REN_IDS, SIM_TRA_IDS, TRA_ALIASES, TRA_UNASSIGNED_KEYS, TRA_VERSION,
  classifyTra, compactKey,
} from './transito-defs.ts';

const nextYear = (y: number) => `${y + 1}-01-01`;
const smallN = (pop: number | undefined) => pop != null && pop < 20000 ? FLAG.smallN : 0;
const monthEnd = (ym: number) => ymDate(ymNext(ym));

// ------------------------------------------------------------------------------------------------ crosswalk por nome (Senatran e PRF)
export interface TraXw { byUfKey: Map<string, number>; aliasUsed: Map<string, number> }
const xk = (uf: number, key: string) => `${uf}|${key}`;
export function buildTraCrosswalk(dir: EntityDir, ufByAcronym: Map<string, number>): TraXw {
  const byUfKey = new Map<string, number>(); const seen = new Map<string, string>();
  for (const m of dir.municipalities) {
    const k = xk(m.ufCode, compactKey(m.name));
    if (byUfKey.has(k)) throw new Error(`colisão de chave compacta no IBGE: ${k} (${seen.get(k)} × ${m.name})`);
    byUfKey.set(k, m.entityId); seen.set(k, m.name);
  }
  const aliasUsed = new Map<string, number>();
  for (const al of TRA_ALIASES) {
    const uf = ufByAcronym.get(al.uf); if (uf == null) throw new Error(`alias com UF desconhecida: ${al.uf}`);
    const e = byUfKey.get(xk(uf, compactKey(al.canonical)));
    if (e === undefined) throw new Error(`alias ${al.uf}/${al.key}: município canônico "${al.canonical}" inexistente`);
    const m = dir.municipalities.find(x => x.entityId === e)!;
    if (m.ibge6 !== String(Math.floor(al.ibge7 / 10))) throw new Error(`alias ${al.key}: código ${al.ibge7} difere do IBGE (${m.ibge6})`);
    const k = xk(uf, al.key);
    if (byUfKey.has(k) && byUfKey.get(k) !== e) throw new Error(`alias ${al.uf}/${al.key} colide com nome oficial de outro município`);
    byUfKey.set(k, e); aliasUsed.set(k, 0);
  }
  return { byUfKey, aliasUsed };
}
export type MunResolve = { entity: number; how: 'direto' | 'alias' | 'nao_informado' | 'nao_conciliado' };
export function resolveTraName(name: string, ufCode: number, dir: EntityDir, xw: TraXw): MunResolve {
  const ignored = dir.ignoredByUf.get(ufCode); if (ignored === undefined) throw new Error(`UF ${ufCode} sem município ignorado`);
  const key = compactKey(name);
  if (!key || TRA_UNASSIGNED_KEYS.has(key)) return { entity: ignored, how: 'nao_informado' };
  const e = xw.byUfKey.get(xk(ufCode, key));
  if (e === undefined) return { entity: ignored, how: 'nao_conciliado' };
  if (xw.aliasUsed.has(xk(ufCode, key))) { xw.aliasUsed.set(xk(ufCode, key), (xw.aliasUsed.get(xk(ufCode, key)) ?? 0) + 1); return { entity: e, how: 'alias' }; }
  return { entity: e, how: 'direto' };
}

// ------------------------------------------------------------------------------------------------ SIM trânsito
export interface TraSimAgg { res: Record<string, Record<string, number>>; occ: Record<string, Record<string, number>>; stats: Record<string, number> }
interface Tally { TT: number; OUT: number; SEQ: number; cat: Record<string, number> }
const emptyTally = (): Tally => ({ TT: 0, OUT: 0, SEQ: 0, cat: {} });
function addKey(t: Tally, k: string, n: number): void {
  const c = classifyTra(k);
  if (c.group === 'TT') { t.TT += n; t.cat[c.cat!] = (t.cat[c.cat!] ?? 0) + n; } else if (c.group === 'OUT') t.OUT += n; else if (c.group === 'SEQ') t.SEQ += n;
}
const mergeTally = (a: Tally, b: Tally) => { a.TT += b.TT; a.OUT += b.OUT; a.SEQ += b.SEQ; for (const [k, v] of Object.entries(b.cat)) a.cat[k] = (a.cat[k] ?? 0) + v; };
const anyT = (t: Tally) => t.TT + t.OUT + t.SEQ > 0;
export interface TraSimArgs { year: number; prelim: boolean; dir: EntityDir; pop: Map<number, number> }
type Ids = typeof SIM_TRA_IDS.res | typeof SIM_TRA_IDS.occ;
function simRows(ids: Ids, entity: number, t: Tally, a: TraSimArgs, o: { rates: boolean; isUf: boolean; explicit: boolean }): IndicatorRow[] {
  const ps = `${a.year}-01-01`, pe = nextYear(a.year), st = a.prelim ? 1 : 2, base = a.prelim ? FLAG.preliminary : 0;
  const mk = (id: number, v: number): IndicatorRow => ({ indicator_id: id, entity_id: entity, period_start: ps, period_end: pe, status: st, numerator: v, denominator: null, value: v, flags: base });
  const out: IndicatorRow[] = [];
  const at = t.TT + t.OUT;
  if (o.explicit || t.TT > 0) out.push(mk(ids.TT, t.TT));
  if (o.explicit || at > 0) out.push(mk(ids.AT, at));
  if (o.explicit || t.SEQ > 0) out.push(mk(ids.SEQ, t.SEQ));
  if (t.OUT > 0) out.push(mk(ids.OUT, t.OUT));
  for (const [c, v] of Object.entries(t.cat)) if (v > 0) out.push(mk(ids.cat[c]!, v));
  if (o.rates && 'taxaTT' in ids) {
    const pop = a.pop.get(entity);
    if (pop != null && pop > 0) {
      out.push({ indicator_id: ids.taxaTT, entity_id: entity, period_start: ps, period_end: pe, status: st, numerator: t.TT, denominator: pop, value: t.TT / pop * 100000, flags: base | (o.isUf ? 0 : smallN(pop)) });
      out.push({ indicator_id: ids.taxaAT, entity_id: entity, period_start: ps, period_end: pe, status: st, numerator: at, denominator: pop, value: at / pop * 100000, flags: base | (o.isUf ? 0 : smallN(pop)) });
    }
  }
  return out;
}
export interface TraSimResult { rows: IndicatorRow[]; totals: { TT: number; OUT: number; SEQ: number; AT: number; cats: Record<string, number> }; quality: Record<string, unknown> }
const totalsOf = (t: Tally) => ({ TT: t.TT, OUT: t.OUT, SEQ: t.SEQ, AT: t.TT + t.OUT, cats: t.cat });

/** UF × ano, perspectiva de residência. Totais (TT, AT, SEQ) com zero explícito para todo município do universo; categorias e V90–V99 só quando > 0 (fatia publicada sem linha = zero). */
export function buildSimTraResidence(agg: TraSimAgg, ufCode: number, a: TraSimArgs): TraSimResult {
  const ignored = a.dir.ignoredByUf.get(ufCode); if (ignored === undefined) throw new Error(`UF ${ufCode} sem município ignorado`);
  const by = new Map<number, Tally>(); const tot = emptyTally(); let invalid = 0, unresolved = 0, otherUf = 0, seqOther = 0;
  const get = (e: number) => { let t = by.get(e); if (!t) by.set(e, t = emptyTally()); return t; };
  for (const [code, keys] of Object.entries(agg.res)) {
    const t = emptyTally();
    for (const [k, n] of Object.entries(keys)) { if (classifyTra(k).group === 'OTHERSEQ') { seqOther += n; continue; } addKey(t, k, n); }
    mergeTally(tot, t);
    if (!anyT(t)) continue;
    const n = t.TT + t.OUT + t.SEQ;
    if (code === '') { invalid += n; mergeTally(get(ignored), t); continue; }
    const e = resolveIbge6(code, a.dir);
    if (e === undefined) { unresolved += n; mergeTally(get(ignored), t); continue; }
    if (a.dir.ufOf.get(e) !== ufCode) { otherUf += n; mergeTally(get(ignored), t); continue; }
    mergeTally(get(e), t);
  }
  const rows: IndicatorRow[] = [];
  const universe = a.dir.municipalities.filter(m => m.ufCode === ufCode && (!m.unproven || by.has(m.entityId)));
  for (const m of universe) rows.push(...simRows(SIM_TRA_IDS.res, m.entityId, by.get(m.entityId) ?? emptyTally(), a, { rates: true, isUf: false, explicit: true }));
  const ign = by.get(ignored); if (ign && anyT(ign)) rows.push(...simRows(SIM_TRA_IDS.res, ignored, ign, a, { rates: false, isUf: false, explicit: false }));
  rows.push(...simRows(SIM_TRA_IDS.res, ufCode, tot, a, { rates: true, isUf: true, explicit: true }));
  return { rows, totals: totalsOf(tot), quality: { family: 'sim-transito-residencia', rowsRead: agg.stats.rows_read ?? 0, nonfetal: agg.stats.nonfetal ?? 0, totals: totalsOf(tot), ignoredMunicipality: ign ? ign.TT + ign.OUT + ign.SEQ : 0, invalidCode: invalid, unresolvedCode: unresolved, otherUfCode: otherUf, sequelaOutras: seqOther, yearMismatch: agg.stats.year_mismatch ?? 0, universe: universe.length, prelim: a.prelim, parser: TRA_VERSION.sim } };
}
/** Nacional × ano, perspectiva de ocorrência (27 arquivos de residência reunidos). Óbitos sem município válido ficam fora das entidades e são declarados. */
export function buildSimTraOccurrence(aggs: TraSimAgg[], a: TraSimArgs): TraSimResult & { byUf: Map<number, Tally> } {
  const by = new Map<number, Tally>(); const tot = emptyTally(); let invalid = 0, unresolved = 0;
  const get = (e: number) => { let t = by.get(e); if (!t) by.set(e, t = emptyTally()); return t; };
  for (const agg of aggs) for (const [code, keys] of Object.entries(agg.occ)) {
    const t = emptyTally(); for (const [k, n] of Object.entries(keys)) { if (classifyTra(k).group === 'OTHERSEQ') continue; addKey(t, k, n); }
    mergeTally(tot, t); if (!anyT(t)) continue;
    const n = t.TT + t.OUT + t.SEQ;
    if (code === '') { invalid += n; continue; }
    const e = resolveIbge6(code, a.dir); if (e === undefined) { unresolved += n; continue; }
    mergeTally(get(e), t);
  }
  const byUf = new Map<number, Tally>(); let placed = 0;
  for (const [e, t] of by) { const uf = a.dir.ufOf.get(e)!; mergeTally(byUf.get(uf) ?? (byUf.set(uf, emptyTally()), byUf.get(uf)!), t); placed += t.TT + t.OUT + t.SEQ; }
  const rows: IndicatorRow[] = []; const ignoredSet = new Set(a.dir.ignoredByUf.values());
  for (const m of a.dir.municipalities) { if (m.unproven && !by.has(m.entityId)) continue; rows.push(...simRows(SIM_TRA_IDS.occ, m.entityId, by.get(m.entityId) ?? emptyTally(), a, { rates: false, isUf: false, explicit: true })); }
  for (const e of ignoredSet) { const t = by.get(e); if (t && anyT(t)) rows.push(...simRows(SIM_TRA_IDS.occ, e, t, a, { rates: false, isUf: false, explicit: false })); }
  for (const [uf, t] of byUf) rows.push(...simRows(SIM_TRA_IDS.occ, uf, t, a, { rates: false, isUf: true, explicit: true }));
  return { rows, byUf, totals: totalsOf(tot), quality: { family: 'sim-transito-ocorrencia', files: aggs.length, totals: totalsOf(tot), placed, unplacedInvalidCode: invalid, unplacedUnresolvedCode: unresolved, prelim: a.prelim, parser: TRA_VERSION.sim } };
}

// ------------------------------------------------------------------------------------------------ Senatran frota
export interface FrotaJson { title: string | null; sheet: string; header: string[]; rows: Array<[string, string, ...Array<number | null>]>; formula_total: string | null; skipped: number; source: string }
export interface FrotaRow { entity_id: number; competence: number; [col: string]: number | null }
export interface FrotaResult { rows: FrotaRow[]; indicators: IndicatorRow[]; totals: Record<string, number>; quality: Record<string, unknown>; resolution: { direto: number; alias: number; nao_informado: number; nao_conciliado: string[] } }
const EXPECTED_HEADER = ['TOTAL', ...FROTA_COLUMNS.map(c => c[0])];
export function frotaHeaderOk(h: string[]): boolean { return h.length === EXPECTED_HEADER.length && h.every((x, i) => x.toUpperCase() === EXPECTED_HEADER[i]); }

/** Um arquivo mensal "Frota por município e tipo" → fatia da UF. Linhas que mapeiam à mesma entidade são somadas (nulo ≠ 0). Nada é descartado: o que não concilia vai ao município ignorado da UF. */
export function buildFrotaSlice(j: FrotaJson, ufCode: number, ufAcr: string, competence: number, a: { dir: EntityDir; xw: TraXw; pop: Map<number, number>; emitIndicators: boolean }): FrotaResult {
  if (!frotaHeaderOk(j.header)) throw new Error(`cabeçalho da frota inesperado em ${competence}: ${j.header.join('|')}`);
  const cols = ['total', ...FROTA_COLUMNS.map(c => c[1])];
  const by = new Map<number, Array<number | null>>(); const res = { direto: 0, alias: 0, nao_informado: 0, nao_conciliado: [] as string[] };
  const totals: Record<string, number> = Object.fromEntries(cols.map(c => [c, 0]));
  let fileTotal = 0, fileSumTypes = 0;
  for (const r of j.rows) {
    const [uf, name, ...vals] = r as [string, string, ...Array<number | null>];
    if (uf !== ufAcr) continue;
    if (compactKey(name) === 'MUNICIPIO' && uf === 'UF') continue;
    const rr = resolveTraName(name, ufCode, a.dir, a.xw);
    if (rr.how === 'direto') res.direto++; else if (rr.how === 'alias') res.alias++; else if (rr.how === 'nao_informado') res.nao_informado++; else res.nao_conciliado.push(name);
    const cur = by.get(rr.entity) ?? cols.map(() => null as number | null);
    vals.forEach((v, i) => { if (v != null) cur[i] = (cur[i] ?? 0) + v; });
    by.set(rr.entity, cur);
    if (vals[0] != null) fileTotal += vals[0]; for (let i = 1; i < vals.length; i++) fileSumTypes += vals[i] ?? 0;
  }
  const rows: FrotaRow[] = [];
  for (const [e, v] of by) { const row: FrotaRow = { entity_id: e, competence }; cols.forEach((c, i) => { row[c] = v[i] ?? null; if (v[i] != null) totals[c] = totals[c]! + v[i]!; }); rows.push(row); }
  const indicators: IndicatorRow[] = [];
  if (a.emitIndicators) {
    const year = Math.floor(competence / 100), ps = ymDate(competence), pe = monthEnd(competence);
    const ent = (e: number, row: Record<string, number | null>, isUf: boolean) => {
      const tot = row.total; if (tot == null) return;
      const pop = a.pop.get(e);
      if (pop != null && pop > 0 && a.dir.ufOf.has(e)) indicators.push({ indicator_id: FROTA_IDS.porMil, entity_id: e, period_start: ps, period_end: pe, status: 2, numerator: tot, denominator: pop, value: tot / pop * 1000, flags: isUf ? 0 : smallN(pop) });
      if (tot > 0) {
        indicators.push({ indicator_id: FROTA_IDS.shareMoto, entity_id: e, period_start: ps, period_end: pe, status: 2, numerator: (row.motocicleta ?? 0) + (row.motoneta ?? 0), denominator: tot, value: ((row.motocicleta ?? 0) + (row.motoneta ?? 0)) / tot * 100, flags: 0 });
        indicators.push({ indicator_id: FROTA_IDS.shareAuto, entity_id: e, period_start: ps, period_end: pe, status: 2, numerator: row.automovel ?? 0, denominator: tot, value: (row.automovel ?? 0) / tot * 100, flags: 0 });
      }
    };
    const ignored = a.dir.ignoredByUf.get(ufCode)!;
    for (const r of rows) if (r.entity_id !== ignored) ent(r.entity_id, r, false);
    ent(ufCode, totals, true); void year;
  }
  return { rows, indicators, totals, resolution: res, quality: { family: 'senatran-frota', competence, sheet: j.sheet, title: j.title, rowsFile: j.rows.filter(r => r[0] === ufAcr).length, entities: rows.length, totalFile: fileTotal, totalSumOfTypes: fileSumTypes, totalMinusTypes: fileTotal - fileSumTypes, nameDirect: res.direto, nameAlias: res.alias, nameNotInformed: res.nao_informado, nameUnmatched: res.nao_conciliado, parser: TRA_VERSION.frota, crosswalk: TRA_VERSION.crosswalk } };
}

// ------------------------------------------------------------------------------------------------ RENAEST
export interface RenaestJson {
  bad: Record<string, number>; acidentes: number; vitimas_linhas: number; veiculos_total: number; veiculos_orfaos: number;
  muni: Array<[string, string, number, number, number, number, number, number]>;
  tp_acidente: Array<[string, number, string, number]>; gravidade: Array<[string, number, string, number]>; envolvido: Array<[string, number, string, number]>; veiculo: Array<[string, number, string, number]>;
  vitima_obitos: Array<[string, number, number]>; cov: Array<[string, number, number, number, number]>; localidade: Array<[string, number, number]>;
}
export interface TraCov { source: number; uf: number; competence: number; records: number; fatal_records: number; municipalities: number; universe: number; scope: number }
export interface RenaestResult { rows: IndicatorRow[]; cov: TraCov[]; months: number[]; quality: Record<string, unknown>; sums: Record<number, number> }
export function renaestScope(records: number, fatal: number): number {
  if (records === 0) return COV_SCOPE.sem_registros;
  return records >= 30 && fatal / records >= 0.9 ? COV_SCOPE.fatais_inferido : COV_SCOPE.presente;
}
/** UF × ano do RENAEST. Município pelo código IBGE nativo ('0000000' e códigos fora do IBGE → município ignorado). UF-mês sem registros NÃO gera valor: gera cobertura "sem registros". */
export function buildRenaestSlice(j: RenaestJson, ufAcr: string, ufCode: number, year: number, a: { dir: EntityDir; lastMonth: number; sourceSha: string }): RenaestResult {
  const ignored = a.dir.ignoredByUf.get(ufCode)!; const rows: IndicatorRow[] = []; const sums: Record<number, number> = {};
  const inYear = (ym: number) => Math.floor(ym / 100) === year;
  const prelimFrom = (() => { let m = a.lastMonth; for (let i = 0; i < 2; i++) m = m % 100 === 1 ? (Math.floor(m / 100) - 1) * 100 + 12 : m - 1; return m; })();
  const stOf = (ym: number) => ym >= prelimFrom ? 1 : 2; const flOf = (ym: number) => ym >= prelimFrom ? FLAG.preliminary : 0;
  const add = (ind: number, e: number, ym: number, v: number) => { rows.push({ indicator_id: ind, entity_id: e, period_start: ymDate(ym), period_end: monthEnd(ym), status: stOf(ym), numerator: v, denominator: null, value: v, flags: flOf(ym) }); sums[ind] = (sums[ind] ?? 0) + v; };
  const ufSum = new Map<string, number>(); const bump = (ind: number, ym: number, v: number) => { const k = `${ind}|${ym}`; ufSum.set(k, (ufSum.get(k) ?? 0) + v); };
  let badCode = 0, otherUf = 0; const munMonths = new Map<number, Set<string>>();
  const agg = new Map<string, number[]>();      // entity|ym → [n, f, ob, env, fi]
  for (const [uf, ibge, ym, n, f, ob, env, fi] of j.muni) {
    if (uf !== ufAcr || !inYear(ym)) continue;
    let e = resolveIbge6(ibge.slice(0, 6), a.dir);
    if (e === undefined || a.dir.ufOf.get(e) !== ufCode) { if (e !== undefined) otherUf += n; else badCode += n; e = ignored; }
    const k = `${e}|${ym}`; const cur = agg.get(k) ?? [0, 0, 0, 0, 0]; cur[0]! += n; cur[1]! += f; cur[2]! += ob; cur[3]! += env; cur[4]! += fi; agg.set(k, cur);
  }
  for (const [k, v] of agg) {
    const [e, ym] = k.split('|').map(Number) as [number, number];
    add(REN_CORE.sinistros, e, ym, v[0]!); add(REN_CORE.fatais, e, ym, v[1]!); add(REN_CORE.obitos, e, ym, v[2]!); add(REN_CORE.envolvidos, e, ym, v[3]!); add(REN_CORE.feridosIlesos, e, ym, v[4]!);
    [REN_CORE.sinistros, REN_CORE.fatais, REN_CORE.obitos, REN_CORE.envolvidos, REN_CORE.feridosIlesos].forEach((id, i) => bump(id, ym, v[i]!));
    const s = munMonths.get(ym) ?? new Set<string>(); s.add(String(e)); munMonths.set(ym, s);
  }
  // UF = Σ municípios + ignorado
  for (const [k, v] of ufSum) { const [ind, ym] = k.split('|').map(Number) as [number, number]; rows.push({ indicator_id: ind, entity_id: ufCode, period_start: ymDate(ym), period_end: monthEnd(ym), status: stOf(ym), numerator: v, denominator: null, value: v, flags: flOf(ym) }); }
  const dim = (list: Array<[string, number, string, number]>, ids: Map<string, number>, what: string) => {
    for (const [uf, ym, cat, v] of list) {
      if (uf !== ufAcr || !inYear(ym) || v === 0) continue;
      const id = ids.get(cat); if (id === undefined) throw new Error(`categoria desconhecida no RENAEST (${what}): "${cat}" — atualizar o contrato (transito-defs.ts)`);
      rows.push({ indicator_id: id, entity_id: ufCode, period_start: ymDate(ym), period_end: monthEnd(ym), status: stOf(ym), numerator: v, denominator: null, value: v, flags: flOf(ym) });
    }
  };
  dim(j.tp_acidente, REN_IDS.tp, 'tipo de acidente'); dim(j.gravidade, REN_IDS.grav, 'gravidade'); dim(j.envolvido, REN_IDS.env, 'tipo de envolvido'); dim(j.veiculo, REN_IDS.veic, 'tipo de veículo');
  // cobertura: todo UF × mês que a fonte (Localidade) lista no ano, inclusive os sem registro
  const loc = new Map<number, number>(); for (const [uf, ym, n] of j.localidade) if (uf === ufAcr && inYear(ym)) loc.set(ym, n);
  const cv = new Map<number, [number, number, number]>(); for (const [uf, ym, n, f, nm] of j.cov) if (uf === ufAcr && inYear(ym)) cv.set(ym, [n, f, nm]);
  const months = [...new Set([...loc.keys(), ...cv.keys()])].sort((x, y) => x - y);
  const cov: TraCov[] = months.map(ym => { const c = cv.get(ym) ?? [0, 0, 0]; return { source: COV_SOURCE.renaest, uf: ufCode, competence: ym, records: c[0], fatal_records: c[1], municipalities: c[2], universe: loc.get(ym) ?? 0, scope: renaestScope(c[0], c[1]) }; });
  return { rows, cov, months, sums, quality: { family: 'renaest', year, source: a.sourceSha, months, recordsYear: cov.reduce((n, c) => n + c.records, 0), invalidMunicipalityCode: badCode, otherUfCode: otherUf, scopeInferred: 'fatais_inferido quando records ≥ 30 e ≥ 90 % com óbito no UF × mês', prelimFrom, parser: TRA_VERSION.renaest } };
}

// ------------------------------------------------------------------------------------------------ PRF
export interface PrfJson { year: number; rows_read: number; sinistros: number; dup_ids: number; bad_date: number; other_year: number; classes: Record<string, number>; rows: Array<[string, string, number, ...number[]]> }
export interface PrfResult { rows: IndicatorRow[]; cov: TraCov[]; months: number[]; quality: Record<string, unknown>; resolution: { direto: number; alias: number; nao_informado: number; nao_conciliado: Record<string, number> }; totals: Record<string, number> }
const prfMetricValue = (v: number[], key: string): number => {
  // v = [sinistros, fatais, feridas, sem, class_ign, mortos, leves, graves, ilesos, pessoas, veiculos]
  switch (key) { case 'sinistros': return v[0]!; case 'fatais': return v[1]!; case 'feridas': return v[2]!; case 'sem_vitimas': return v[3]!; case 'comVitimas': return v[1]! + v[2]!; case 'mortos': return v[5]!; case 'feridos_leves': return v[6]!; case 'feridos_graves': return v[7]!; case 'ilesos': return v[8]!; case 'pessoas': return v[9]!; case 'veiculos': return v[10]!; default: throw new Error(key); }
};
/** UF × ano da PRF: mensal por UF (zero explícito dentro do período do arquivo) e anual por município (somente com sinistro). Nome sem correspondência → município ignorado; UF desconhecida não é inferida. */
export function buildPrfSlice(j: PrfJson, ufAcr: string, ufCode: number, year: number, a: { dir: EntityDir; xw: TraXw; lastMonth: number; sourceSha: string }): PrfResult {
  const res = { direto: 0, alias: 0, nao_informado: 0, nao_conciliado: {} as Record<string, number> };
  const byMon = new Map<number, number[]>(); const byMun = new Map<number, number[]>(); const munMon = new Map<number, Set<number>>();
  const z = () => new Array<number>(11).fill(0); const addTo = (m: Map<number, number[]>, k: number, v: number[]) => { const c = m.get(k) ?? z(); for (let i = 0; i < 11; i++) c[i]! += v[i]!; m.set(k, c); };
  let unknownUf = 0;
  for (const r of j.rows) {
    const [uf, mun, ym, ...v] = r as [string, string, number, ...number[]];
    if (uf !== ufAcr) { continue; }
    const rr = resolveTraName(mun, ufCode, a.dir, a.xw);
    if (rr.how === 'direto') res.direto++; else if (rr.how === 'alias') res.alias++; else if (rr.how === 'nao_informado') res.nao_informado++; else res.nao_conciliado[mun] = (res.nao_conciliado[mun] ?? 0) + v[0]!;
    addTo(byMon, ym, v); addTo(byMun, rr.entity, v);
    const s = munMon.get(ym) ?? new Set<number>(); s.add(rr.entity); munMon.set(ym, s);
  }
  void unknownUf;
  const lastM = year === Math.floor(a.lastMonth / 100) ? a.lastMonth % 100 : 12;
  const months: number[] = []; for (let m = 1; m <= lastM; m++) months.push(year * 100 + m);
  const rows: IndicatorRow[] = []; const prelimMonth = a.lastMonth;
  const totals: Record<string, number> = {};
  for (const ym of months) {
    const v = byMon.get(ym) ?? z(); const prelim = ym === prelimMonth;
    PRF_METRICS.forEach((m, i) => rows.push({ indicator_id: PRF_MONTHLY_IDS[i]!, entity_id: ufCode, period_start: ymDate(ym), period_end: monthEnd(ym), status: prelim ? 1 : 2, numerator: prfMetricValue(v, m.key), denominator: null, value: prfMetricValue(v, m.key), flags: prelim ? FLAG.preliminary : 0 }));
  }
  for (const [e, v] of byMun) PRF_METRICS.forEach((m, i) => { const x = prfMetricValue(v, m.key); if (x === 0 && m.key !== 'sinistros') { /* zero municipal só quando houve sinistro */ } rows.push({ indicator_id: PRF_ANNUAL_IDS[i]!, entity_id: e, period_start: `${year}-01-01`, period_end: nextYear(year), status: year === Math.floor(prelimMonth / 100) ? 1 : 2, numerator: x, denominator: null, value: x, flags: year === Math.floor(prelimMonth / 100) ? FLAG.preliminary : 0 }); });
  const yr = z(); for (const v of byMon.values()) for (let i = 0; i < 11; i++) yr[i]! += v[i]!;
  PRF_METRICS.forEach((m, i) => { const x = prfMetricValue(yr, m.key); totals[m.key] = x; rows.push({ indicator_id: PRF_ANNUAL_IDS[i]!, entity_id: ufCode, period_start: `${year}-01-01`, period_end: nextYear(year), status: year === Math.floor(prelimMonth / 100) ? 1 : 2, numerator: x, denominator: null, value: x, flags: year === Math.floor(prelimMonth / 100) ? FLAG.preliminary : 0 }); });
  const cov: TraCov[] = months.map(ym => { const v = byMon.get(ym) ?? z(); return { source: COV_SOURCE.prf, uf: ufCode, competence: ym, records: v[0]!, fatal_records: v[1]!, municipalities: munMon.get(ym)?.size ?? 0, universe: 0, scope: v[0]! > 0 ? COV_SCOPE.presente : COV_SCOPE.sem_registros }; });
  return { rows, cov, months, totals, resolution: res, quality: { family: 'prf', year, source: a.sourceSha, sinistrosFile: j.sinistros, dupIds: j.dup_ids, classes: j.classes, months, unmatchedNames: res.nao_conciliado, parser: TRA_VERSION.prf, crosswalk: TRA_VERSION.crosswalk } };
}

// ------------------------------------------------------------------------------------------------ Infrações
export interface InfrJson { layout: string; rows: Array<[string, number, number]>; blanks: number }
export interface InfrRow { uf: number; competence: number; cod_infracao: number; qtde: number }
export function buildInfrSlice(j: InfrJson, ufCode: number, ufNameKey: Map<string, number>, competence: number): { rows: InfrRow[]; indicators: IndicatorRow[]; total: number; quality: Record<string, unknown>; unknownUfNames: string[] } {
  const rows: InfrRow[] = []; const agg = new Map<number, number>(); const unknown = new Set<string>();
  for (const [name, cod, q] of j.rows) {
    const uf = ufNameKey.get(compactKey(name)); if (uf === undefined) { unknown.add(name); continue; }
    if (uf !== ufCode) continue;
    agg.set(cod, (agg.get(cod) ?? 0) + q);
  }
  let total = 0; for (const [cod, q] of [...agg].sort((a, b) => a[0] - b[0])) { rows.push({ uf: ufCode, competence, cod_infracao: cod, qtde: q }); total += q; }
  const indicators: IndicatorRow[] = rows.length ? [{ indicator_id: INFR_IDS.total, entity_id: ufCode, period_start: ymDate(competence), period_end: monthEnd(competence), status: 2, numerator: total, denominator: null, value: total, flags: 0 }] : [];
  return { rows, indicators, total, unknownUfNames: [...unknown], quality: { family: 'senatran-infracoes', layout: j.layout, competence, codes: rows.length, blanksInFile: j.blanks, total, parser: TRA_VERSION.infr } };
}
