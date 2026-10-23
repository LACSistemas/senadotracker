import type { Pool } from 'pg';
import { FLAG } from './indicator-defs.ts';
import { FROTA_COLUMNS, FROTA_TABLE_COLUMNS, COV_SCOPE, PRF_ANNUAL_IDS, PRF_MONTHLY_IDS, REN_ALL_IDS, SIM_TRA_OCC_IDS, SIM_TRA_RES_IDS, TRA_DEFS, TRA_DEF_BY_ID, FROTA_IDS, INFR_IDS, type TraDef } from './transito-defs.ts';

/**
 * Contratos de leitura de Trânsito e Segurança Viária (P9.2). Somente SELECT; no máximo 8 consultas por perfil, todas por índice.
 * Nenhum valor de uma fonte é somado ou comparado com outra: cada família vem em seção própria, com definição, perspectiva, cobertura e restrições.
 * Filtros: `sources` (quais famílias), `from` (AAAA-MM-DD) e `frequency` ('A' = só dezembro e último mês da frota).
 */
type Q = Pick<Pool, 'query'>;
export type TrafficSource = 'sim' | 'frota' | 'renaest' | 'prf' | 'infracoes';
export type TrafficPointKind = 'registrado' | 'zero_derivado' | 'sem_registro';
export interface TrafficPoint { period: string; value: number | null; numerator: number | null; denominator: number | null; status: 'preliminar' | 'definitivo'; kind: TrafficPointKind; flags: string[] }
export interface TrafficMetric {
  indicatorId: number; code: string; label: string; unit: string; family: TraDef['family']; definition: string; granularity: 'municipio' | 'uf'; grain: 'M' | 'A'; perspective: 'residencia' | 'ocorrencia' | null;
  denominator: string; comparability: string; series: TrafficPoint[]; latestPeriod: string | null; provisional: boolean;
}
export interface FleetPoint { competence: number; total: number | null; byType: Record<string, number | null> }
export interface FleetSection { source: 'Senatran — frota registrada (Renavam)'; semantics: string; latest: FleetPoint | null; series: FleetPoint[]; typeLabels: Record<string, string>; indicators: TrafficMetric[]; competences: { first: number | null; last: number | null; published: number } }
export interface CoveragePoint { source: 'renaest' | 'prf'; competence: number; records: number; fatalRecords: number; municipalities: number; universe: number; scope: 'registros_presentes' | 'restrito_a_fatais_inferido' | 'sem_registros' }
export interface TrafficSourceInfo { dataset: 'sim_residencia' | 'sim_ocorrencia' | 'frota' | 'renaest' | 'prf' | 'infracoes'; lastCompetence: number | null; slices: number; stage: 'preliminar' | 'definitivo' | null; activatedAt: string | null }
export interface InfractionCode { code: number; qtde: number }
export interface TrafficState {
  entityId: number; ufCode: number; fleet?: FleetSection; sim: TrafficMetric[]; renaest: TrafficMetric[]; prf: TrafficMetric[]; infractions?: { metric: TrafficMetric | null; latestCompetence: number | null; topCodes: InfractionCode[]; semantics: string };
  coverage: CoveragePoint[]; population: { years: number[]; missingYears: number[] }; sources: TrafficSourceInfo[]; restrictions: string[];
}
export interface TrafficMunicipality {
  entityId: number; name: string; ufCode: number; kind: 4 | 5; fleet?: FleetSection; sim: TrafficMetric[]; renaest: TrafficMetric[]; prf: TrafficMetric[];
  ufCoverage: CoveragePoint[]; population: { years: number[]; missingYears: number[] }; sources: TrafficSourceInfo[]; restrictions: string[];
}
export interface TrafficOptions { sources?: TrafficSource[]; from?: string; frequency?: 'M' | 'A' }

export const TRAFFIC_RESTRICTIONS = [
  'As fontes têm universos diferentes e NÃO se somam: SIM = óbitos; RENAEST = sinistros reportados (cobertura variável por UF e mês); PRF = sinistros em rodovias federais; Senatran = veículos registrados; infrações = notificações por UF de jurisdição do veículo.',
  'Frota registrada não é frota em circulação. Municípios-sede de locadoras e frotas empresariais têm razões inflacionadas.',
  'RENAEST: ausência de registro não é zero; UFs sem relato, com escopo restrito a fatais (inferido) ou com início tardio de relato não são comparáveis. Não há ranking nacional de sinistros totais.',
  'PRF cobre apenas rodovias federais; a partir de 2016 o arquivo traz poucos sinistros sem vítimas (use "com vítimas" para séries longas). Não somar PRF e RENAEST: pode haver sobreposição não resolvida.',
  'SIM por residência e por ocorrência são perspectivas diferentes; sequelas (Y85.0) não entram nas mortes por evento agudo; 2025 é preliminar.',
  'Infrações são por UF de JURISDIÇÃO do veículo, não pelo local da infração.',
  'Meses sem estimativa populacional oficial (2022 e 2023) ficam sem taxa; não há interpolação.',
];
const iso = (v: unknown): string => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const flagNames = (f: number): string[] => (Object.entries(FLAG) as Array<[string, number]>).filter(([, b]) => (f & b) !== 0).map(([k]) => k);
const SCOPE = ['', 'registros_presentes', 'restrito_a_fatais_inferido', 'sem_registros'] as const;
const metricOf = (d: TraDef, series: TrafficPoint[]): TrafficMetric => ({ indicatorId: d.id, code: d.code, label: d.label, unit: d.unit, family: d.family, definition: d.definition, granularity: d.granularity, grain: d.grain, perspective: d.perspective ?? null, denominator: d.denominator, comparability: d.comparability, series, latestPeriod: series.length ? series[series.length - 1]!.period : null, provisional: series.some(p => p.status === 'preliminar') });
const want = (o: TrafficOptions, s: TrafficSource) => !o.sources || o.sources.includes(s);
const DS_NAME: Record<number, TrafficSourceInfo['dataset']> = { 18: 'sim_residencia', 19: 'sim_ocorrencia', 20: 'frota', 21: 'renaest', 22: 'prf', 23: 'infracoes' };

function points(rows: Array<Record<string, unknown>>, id: number, fill?: { periods: string[]; kind: TrafficPointKind; value: number | null }): TrafficPoint[] {
  const own = rows.filter(r => Number(r.indicator_id) === id).map(r => ({ period: iso(r.period_start), value: r.value == null ? null : Number(r.value), numerator: r.numerator == null ? null : Number(r.numerator), denominator: r.denominator == null ? null : Number(r.denominator),
    status: Number(r.status) === 1 ? 'preliminar' : 'definitivo', kind: 'registrado', flags: flagNames(Number(r.flags)) }) as TrafficPoint);
  if (fill) { const have = new Set(own.map(p => p.period)); for (const p of fill.periods) if (!have.has(p)) own.push({ period: p, value: fill.value, numerator: fill.value, denominator: null, status: 'definitivo', kind: fill.kind, flags: [] }); }
  return own.sort((a, b) => a.period.localeCompare(b.period));
}
function fleetPoint(r: Record<string, unknown>): FleetPoint { return { competence: Number(r.competence), total: r.total == null ? null : Number(r.total), byType: Object.fromEntries(FROTA_TABLE_COLUMNS.filter(c => c !== 'total').map(c => [c, r[c] == null ? null : Number(r[c])])) }; }
function fleetSection(rows: Array<Record<string, unknown>>, o: TrafficOptions): FleetSection {
  let pts = rows.map(fleetPoint); const last = pts.length ? pts[pts.length - 1]! : null;
  const all = pts; if (o.frequency === 'A') pts = pts.filter(p => p.competence % 100 === 12 || p === last);
  return { source: 'Senatran — frota registrada (Renavam)', semantics: 'Veículos registrados no município (Renavam), por tipo; não é a frota em circulação.', latest: last, series: pts, typeLabels: Object.fromEntries(FROTA_COLUMNS.map(c => [c[1], c[2]])), indicators: [], competences: { first: all.length ? all[0]!.competence : null, last: last?.competence ?? null, published: all.length } };
}
async function popYears(q: Q, entityId: number): Promise<{ years: number[]; missingYears: number[] }> {
  const r = await q.query(`SELECT year FROM civica_exec.exec_territory_population WHERE entity_id = $1 AND source = 1 AND year BETWEEN 2013 AND extract(year FROM now())::int ORDER BY year`, [entityId]);
  const years = r.rows.map(x => Number(x.year)); const all: number[] = []; for (let y = 2013; y <= new Date().getFullYear(); y++) all.push(y);
  return { years, missingYears: all.filter(y => !years.includes(y)) };
}
async function sourcesOf(q: Q, ufCode: number): Promise<TrafficSourceInfo[]> {
  const r = await q.query(`SELECT dataset_id, max(competence)::int AS last, count(*)::int AS n, max(stage)::int AS stage, max(activated_at) AS at FROM civica_exec.exec_publication WHERE dataset_id BETWEEN 18 AND 23 AND (uf = $1 OR uf = 0) GROUP BY dataset_id ORDER BY dataset_id`, [ufCode]);
  return r.rows.map(x => ({ dataset: DS_NAME[Number(x.dataset_id)]!, lastCompetence: Number(x.last), slices: Number(x.n), stage: Number(x.stage) === 1 ? 'preliminar' : 'definitivo', activatedAt: iso(x.at) }));
}
async function covOf(q: Q, ufCode: number, from: string | undefined): Promise<CoveragePoint[]> {
  const r = await q.query(`SELECT source, competence, records, fatal_records, municipalities, universe, scope FROM civica_exec.exec_tra_cov WHERE uf = $1 AND ($2::integer IS NULL OR competence >= $2::integer) ORDER BY source, competence`, [ufCode, from ? Number(from.slice(0, 4)) * 100 + Number(from.slice(5, 7)) : null]);
  return r.rows.map(x => ({ source: Number(x.source) === 1 ? 'renaest' : 'prf', competence: Number(x.competence), records: Number(x.records), fatalRecords: Number(x.fatal_records), municipalities: Number(x.municipalities), universe: Number(x.universe), scope: SCOPE[Number(x.scope)] as CoveragePoint['scope'] }));
}
const ymIso = (c: number) => `${Math.floor(c / 100)}-${String(c % 100).padStart(2, '0')}-01`;
const isSim = (d: TraDef) => d.family === 'SIM';

export async function getTrafficState(q: Q, ufCode: number, o: TrafficOptions = {}): Promise<TrafficState> {
  const fam = (f: TraDef['family']) => TRA_DEFS.filter(d => d.family === f).map(d => d.id);
  const ids = [...(want(o, 'sim') ? [...SIM_TRA_RES_IDS, ...SIM_TRA_OCC_IDS] : []), ...(want(o, 'frota') ? [FROTA_IDS.porMil, FROTA_IDS.shareMoto, FROTA_IDS.shareAuto] : []), ...(want(o, 'renaest') ? REN_ALL_IDS : []), ...(want(o, 'prf') ? [...PRF_MONTHLY_IDS, ...PRF_ANNUAL_IDS] : []), ...(want(o, 'infracoes') ? [INFR_IDS.total] : [])];
  void fam;
  const [vals, cov, pop, sources, fleet, topInfr] = await Promise.all([
    ids.length ? q.query(`SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) AND ($3::date IS NULL OR period_start >= $3::date) ORDER BY indicator_id, period_start`, [ufCode, ids, o.from ?? null]) : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    want(o, 'renaest') || want(o, 'prf') ? covOf(q, ufCode, o.from) : Promise.resolve([] as CoveragePoint[]), popYears(q, ufCode), sourcesOf(q, ufCode),
    want(o, 'frota') ? q.query(`SELECT f.competence, ${FROTA_TABLE_COLUMNS.map(c => `sum(f.${c})::bigint AS ${c}`).join(', ')} FROM civica_exec.exec_tra_frota_mun_mes f JOIN civica_exec.exec_entity e ON e.entity_id = f.entity_id WHERE e.uf_code = $1 AND e.kind IN (4, 5) AND ($2::integer IS NULL OR f.competence >= $2::integer) GROUP BY f.competence ORDER BY f.competence`, [ufCode, o.from ? Number(o.from.slice(0, 4)) * 100 + Number(o.from.slice(5, 7)) : null]) : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    want(o, 'infracoes') ? q.query(`SELECT cod_infracao, qtde FROM civica_exec.exec_tra_infr_uf_mes WHERE uf = $1 AND competence = (SELECT max(competence) FROM civica_exec.exec_tra_infr_uf_mes WHERE uf = $1) ORDER BY qtde DESC LIMIT 15`, [ufCode]) : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
  ]);
  const metrics = (family: TraDef['family'], pick: (d: TraDef) => boolean = () => true) => TRA_DEFS.filter(d => d.family === family && pick(d) && vals.rows.some(r => Number(r.indicator_id) === d.id)).map(d => metricOf(d, points(vals.rows, d.id)));
  const infrMetric = metrics('INFR')[0] ?? null;
  const state: TrafficState = { entityId: ufCode, ufCode, sim: metrics('SIM'), renaest: metrics('RENAEST'), prf: metrics('PRF'), coverage: cov, population: pop, sources, restrictions: TRAFFIC_RESTRICTIONS };
  if (want(o, 'frota')) { const fm = metrics('FROTA'); state.fleet = fleetSection(fleet.rows, o); state.fleet.indicators = fm; }
  if (want(o, 'infracoes')) state.infractions = { metric: infrMetric, latestCompetence: infrMetric?.latestPeriod ? Number(infrMetric.latestPeriod.slice(0, 4)) * 100 + Number(infrMetric.latestPeriod.slice(5, 7)) : null, topCodes: topInfr.rows.map(r => ({ code: Number(r.cod_infracao), qtde: Number(r.qtde) })), semantics: 'Notificações de penalidade pela UF de jurisdição do veículo — não o local da infração.' };
  return state;
}

export async function getTrafficMunicipality(q: Q, entityId: number, o: TrafficOptions = {}): Promise<TrafficMunicipality | null> {
  const e = (await q.query(`SELECT entity_id, kind, name, uf_code FROM civica_exec.exec_entity WHERE entity_id = $1 AND kind IN (4, 5)`, [entityId])).rows[0];
  if (!e) return null; const ufCode = Number(e.uf_code); const real = Number(e.kind) === 4;
  const munIds = TRA_DEFS.filter(d => d.granularity === 'municipio').map(d => d.id);
  const ids = munIds.filter(id => { const d = TRA_DEF_BY_ID.get(id)!; return (d.family === 'SIM' && want(o, 'sim')) || (d.family === 'FROTA' && want(o, 'frota')) || (d.family === 'RENAEST' && want(o, 'renaest')) || (d.family === 'PRF' && want(o, 'prf')); });
  const fromYm = o.from ? Number(o.from.slice(0, 4)) * 100 + Number(o.from.slice(5, 7)) : null;
  const [vals, cov, pop, sources, fleet, pubs] = await Promise.all([
    q.query(`SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) AND ($3::date IS NULL OR period_start >= $3::date) ORDER BY indicator_id, period_start`, [entityId, ids, o.from ?? null]),
    want(o, 'renaest') || want(o, 'prf') ? covOf(q, ufCode, o.from) : Promise.resolve([] as CoveragePoint[]), popYears(q, entityId), sourcesOf(q, ufCode),
    want(o, 'frota') ? q.query(`SELECT * FROM civica_exec.exec_tra_frota_mun_mes WHERE entity_id = $1 AND ($2::integer IS NULL OR competence >= $2::integer) ORDER BY competence`, [entityId, fromYm]) : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    q.query(`SELECT dataset_id, competence FROM civica_exec.exec_publication WHERE dataset_id IN (18, 22) AND uf = $1 ORDER BY competence`, [ufCode]),
  ]);
  const pubYears = (ds: number) => pubs.rows.filter(r => Number(r.dataset_id) === ds).map(r => Math.floor(Number(r.competence) / 100));
  const yearPeriods = (ds: number) => pubYears(ds).filter(y => !o.from || `${y}-12-31` >= o.from).map(y => `${y}-01-01`);
  const out = (family: TraDef['family']) => TRA_DEFS.filter(d => d.family === family && d.granularity === 'municipio' && ids.includes(d.id)).flatMap(d => {
    let fill: Parameters<typeof points>[2];
    // SIM: categorias e V90–V99 só existem quando > 0; fatia publicada sem linha = nenhum óbito (universo do SIM é completo). PRF: município sem linha no ano = nenhum sinistro registrado pela PRF.
    if (family === 'SIM' && d.perspective === 'residencia' && d.grain === 'A' && !d.code.endsWith('TAXA') && real) fill = { periods: yearPeriods(18), kind: 'zero_derivado', value: 0 };
    if (family === 'PRF' && d.grain === 'A' && real) fill = { periods: yearPeriods(22), kind: 'zero_derivado', value: 0 };
    const series = points(vals.rows, d.id, fill);
    return series.length ? [metricOf(d, series)] : [];
  });
  const res: TrafficMunicipality = { entityId, name: String(e.name), ufCode, kind: Number(e.kind) as 4 | 5, sim: out('SIM'), renaest: [], prf: out('PRF'), ufCoverage: cov, population: pop, sources, restrictions: TRAFFIC_RESTRICTIONS };
  // RENAEST: nunca zero derivado; meses do UF sem registros/escopo restrito aparecem como "sem_registro" (valor nulo)
  for (const d of TRA_DEFS.filter(x => x.family === 'RENAEST' && x.granularity === 'municipio' && ids.includes(x.id))) {
    const series = points(vals.rows, d.id); const have = new Set(series.map(p => p.period));
    for (const c of cov.filter(x => x.source === 'renaest')) { const p = ymIso(c.competence); if (!have.has(p)) series.push({ period: p, value: null, numerator: null, denominator: null, status: 'definitivo', kind: 'sem_registro', flags: [] }); }
    series.sort((a, b) => a.period.localeCompare(b.period)); if (series.length) res.renaest.push(metricOf(d, series));
  }
  if (want(o, 'frota')) { res.fleet = fleetSection(fleet.rows, o); res.fleet.indicators = TRA_DEFS.filter(d => d.family === 'FROTA' && ids.includes(d.id)).map(d => metricOf(d, points(vals.rows, d.id))).filter(m => m.series.length); }
  void isSim; void COV_SCOPE;
  return res;
}
