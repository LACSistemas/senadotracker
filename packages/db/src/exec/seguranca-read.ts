import type { Pool } from 'pg';
import { SEG_DEFS, SEG_DEF_BY_ID, VDE_EVENTS, type SegDef } from './seguranca-defs.ts';
import { SIM_OCC_IDS, SIM_RES_IDS } from './seguranca-build.ts';
import { FLAG } from './indicator-defs.ts';

/**
 * Contratos de leitura da Segurança Pública (P9.1) para as futuras páginas /estados/[uf]/seguranca e /municipios/[ibge]/seguranca.
 * Somente SELECT; no máximo 5 consultas por perfil, todas por índice (entidade × indicador × período). Nada é calculado no backend além de
 * preencher meses sem linha conforme a cobertura (exec_seg_cov). Gráficos e textos são responsabilidade do frontend.
 */
type Q = Pick<Pool, 'query'>;
export type PointKind = 'registrado' | 'zero_reportado' | 'sem_relato_ou_zero';
export interface SegPoint { period: string; value: number | null; numerator: number | null; denominator: number | null; status: 'preliminar' | 'definitivo'; kind: PointKind; flags: string[] }
export interface SegMetric {
  indicatorId: number; code: string; label: string; unit: string; source: 'SIM' | 'VDE'; definition: string; granularity: 'municipio' | 'uf'; grain: 'M' | 'A'; perspective: 'residencia' | 'ocorrencia' | null;
  denominator: string; comparability: string; series: SegPoint[]; latestPeriod: string | null; provisional: boolean;
}
export interface SegCoverage {
  simResidence: { years: number[]; provisionalYears: number[] };
  simOccurrence: { years: number[]; provisionalYears: number[] };
  vde: { firstMonth: string | null; lastMonth: string | null; municipalUniverse: number; ambiguousMonthsByIndicator: Record<number, string[]> };
  population: { years: number[]; missingYears: number[] };
}
export interface SegState { entityId: number; ufCode: number; metrics: SegMetric[]; coverage: SegCoverage; indeterminateShare: SegMetric | null; sources: SegSource[]; restrictions: string[] }
export interface SegMunicipality { entityId: number; name: string; ufCode: number; kind: 4 | 5; metrics: SegMetric[]; ufContext: { indeterminateShare: SegMetric | null }; coverage: SegCoverage; sources: SegSource[]; restrictions: string[] }
export interface SegSource { dataset: 'sim_residencia' | 'sim_ocorrencia' | 'sinesp_vde'; competence: number | null; stage: 'preliminar' | 'definitivo' | null; activatedAt: string | null }

const DS = { sim_residencia: 15, sim_ocorrencia: 16, sinesp_vde: 17 } as const;
const iso = (v: unknown): string => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const flagNames = (f: number): string[] => (Object.entries(FLAG) as Array<[string, number]>).filter(([, b]) => (f & b) !== 0).map(([k]) => k);
const RESTRICTIONS = [
  'SIM mede óbitos (saúde); VDE mede registros policiais. As séries não são equivalentes e não podem ser somadas ou comparadas como o mesmo fenômeno.',
  'Taxas de mortes por agressão (SIM) devem ser lidas junto da proporção de mortes por causa indeterminada; as indeterminadas não são reclassificadas.',
  'Ocorrência policial registrada não é crime judicialmente comprovado; vítimas, ocorrências, mandados e peso são medidas diferentes.',
  'Eventos do VDE sem município na fonte (estupro, tráfico, roubos de veículo e carga etc.) existem apenas por UF; nenhum valor foi distribuído por município.',
  'Meses sem estimativa populacional oficial (2022 e 2023) ficam sem taxa; não há interpolação.',
];
const metricOf = (d: SegDef, series: SegPoint[]): SegMetric => ({
  indicatorId: d.id, code: d.code, label: d.label, unit: d.unit, source: d.source, definition: d.definition, granularity: d.granularity, grain: d.grain, perspective: d.perspective ?? null,
  denominator: d.denominator, comparability: d.comparability, series, latestPeriod: series.length ? series[series.length - 1]!.period : null, provisional: series.some(p => p.status === 'preliminar'),
});

async function sourcesOf(q: Q, ufCode: number): Promise<SegSource[]> {
  const r = await q.query(`SELECT dataset_id, max(competence)::int AS competence, max(stage)::int AS stage, max(activated_at) AS at FROM civica_exec.exec_publication
    WHERE dataset_id = ANY($1::smallint[]) AND (uf = $2 OR uf = 0) GROUP BY dataset_id`, [[15, 16, 17], ufCode]);
  const name = (id: number) => id === 15 ? 'sim_residencia' : id === 16 ? 'sim_ocorrencia' : 'sinesp_vde';
  return r.rows.map(x => ({ dataset: name(Number(x.dataset_id)) as SegSource['dataset'], competence: Number(x.competence), stage: Number(x.stage) === 1 ? 'preliminar' : 'definitivo', activatedAt: iso(x.at) }));
}
async function populationYears(q: Q, entityId: number): Promise<{ years: number[]; missing: number[] }> {
  const r = await q.query(`SELECT year FROM civica_exec.exec_territory_population WHERE entity_id = $1 AND source = 1 AND year BETWEEN 2013 AND extract(year FROM now())::int ORDER BY year`, [entityId]);
  const years = r.rows.map(x => Number(x.year)); const all: number[] = [];
  for (let y = 2013; y <= new Date().getFullYear(); y++) all.push(y);
  return { years, missing: all.filter(y => !years.includes(y)) };
}
interface CovRow { indicator_id: number; competence: number; mun_pairs: number; status: number }
async function covOf(q: Q, ufCode: number, ids: number[]): Promise<CovRow[]> {
  if (!ids.length) return [];
  return (await q.query(`SELECT indicator_id, competence, mun_pairs, status FROM civica_exec.exec_seg_cov WHERE uf = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, competence`, [ufCode, ids])).rows.map(x => ({ indicator_id: Number(x.indicator_id), competence: Number(x.competence), mun_pairs: Number(x.mun_pairs), status: Number(x.status) }));
}
const ymIso = (c: number) => `${Math.floor(c / 100)}-${String(c % 100).padStart(2, '0')}-01`;
const VDE_MUN_IDS = VDE_EVENTS.filter(e => e.level === 'M').flatMap(e => Object.values(e.abr) as number[]);
const VDE_ALL_IDS = SEG_DEFS.filter(d => d.source === 'VDE').map(d => d.id);

function coverageOf(rows: Array<{ indicator_id: number; period_start: unknown; status: number }>, cov: CovRow[], pop: { years: number[]; missing: number[] }, universe: number): SegCoverage {
  const yearsOf = (ids: number[]) => [...new Set(rows.filter(r => ids.includes(Number(r.indicator_id))).map(r => Number(iso(r.period_start).slice(0, 4))))].sort();
  const provOf = (ids: number[]) => [...new Set(rows.filter(r => ids.includes(Number(r.indicator_id)) && Number(r.status) === 1).map(r => Number(iso(r.period_start).slice(0, 4))))].sort();
  const amb: Record<number, string[]> = {}; for (const c of cov) if (c.status === 2) (amb[c.indicator_id] ??= []).push(ymIso(c.competence).slice(0, 7));
  const comps = cov.map(c => c.competence);
  return { simResidence: { years: yearsOf(SIM_RES_IDS), provisionalYears: provOf(SIM_RES_IDS) }, simOccurrence: { years: yearsOf(SIM_OCC_IDS), provisionalYears: provOf(SIM_OCC_IDS) },
    vde: { firstMonth: comps.length ? ymIso(Math.min(...comps)).slice(0, 7) : null, lastMonth: comps.length ? ymIso(Math.max(...comps)).slice(0, 7) : null, municipalUniverse: universe, ambiguousMonthsByIndicator: amb }, population: { years: pop.years, missingYears: pop.missing } };
}
function seriesOf(rows: Array<Record<string, unknown>>, id: number, fill?: { cov: CovRow[]; universe: number; municipal: boolean; from?: string | undefined }): SegPoint[] {
  const own = rows.filter(r => Number(r.indicator_id) === id);
  const pts: SegPoint[] = own.map(r => ({ period: iso(r.period_start), value: r.value == null ? null : Number(r.value), numerator: r.numerator == null ? null : Number(r.numerator), denominator: r.denominator == null ? null : Number(r.denominator),
    status: Number(r.status) === 1 ? 'preliminar' : 'definitivo', kind: (Number(r.flags) & FLAG.zeroAmbiguous) ? 'sem_relato_ou_zero' : 'registrado', flags: flagNames(Number(r.flags)) }));
  if (!fill) return pts;
  // município sem linha: zero reportado só quando o mês tem registros na UF e o universo de municípios do arquivo está completo; senão, "sem relato ou zero"
  const have = new Set(pts.map(p => p.period.slice(0, 7)));
  for (const c of fill.cov.filter(x => x.indicator_id === id)) {
    const p = ymIso(c.competence); if (have.has(p.slice(0, 7)) || (fill.from && p < fill.from)) continue;
    const complete = c.mun_pairs >= fill.universe && c.status === 1;
    pts.push({ period: p, value: complete ? 0 : null, numerator: complete ? 0 : null, denominator: null, status: 'definitivo', kind: complete ? 'zero_reportado' : 'sem_relato_ou_zero', flags: [] });
  }
  return pts.sort((a, b) => a.period.localeCompare(b.period));
}

/** `indicatorIds` restringe os indicadores devolvidos (a página escolhe o que precisa); `from` (AAAA-MM-DD) corta o início das séries. Sem opções, devolve tudo. */
export interface SegReadOptions { indicatorIds?: number[]; from?: string }
export async function getSegState(q: Q, ufCode: number, opt: SegReadOptions = {}): Promise<SegState> {
  const all = [...SIM_RES_IDS, ...SIM_OCC_IDS, ...VDE_ALL_IDS]; const ids = opt.indicatorIds ? all.filter(i => opt.indicatorIds!.includes(i)) : all;
  const [vals, cov, pop, sources, uni] = await Promise.all([
    q.query(`SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) AND ($3::date IS NULL OR period_start >= $3::date) ORDER BY indicator_id, period_start`, [ufCode, ids, opt.from ?? null]),
    covOf(q, ufCode, VDE_ALL_IDS.filter(i => ids.includes(i))), populationYears(q, ufCode), sourcesOf(q, ufCode),
    q.query(`SELECT count(*)::int AS n FROM civica_exec.exec_entity e LEFT JOIN civica_exec.exec_entity_version v ON v.entity_id = e.entity_id AND v.valid_to IS NULL WHERE e.kind = 4 AND e.uf_code = $1 AND coalesce(v.evidence_ref NOT LIKE '%NÃO comprovada%', true)`, [ufCode]),
  ]);
  const metrics = SEG_DEFS.filter(d => vals.rows.some(r => Number(r.indicator_id) === d.id)).map(d => metricOf(d, seriesOf(vals.rows, d.id)));
  const universe = Number(uni.rows[0].n) + 1;     // municípios + "NÃO INFORMADO"
  const indet = metrics.find(m => m.indicatorId === 3008) ?? null;
  return { entityId: ufCode, ufCode, metrics, coverage: coverageOf(vals.rows as never, cov, pop, universe), indeterminateShare: indet, sources, restrictions: RESTRICTIONS };
}

export async function getSegMunicipality(q: Q, entityId: number, opt: SegReadOptions = {}): Promise<SegMunicipality | null> {
  const e = (await q.query(`SELECT e.entity_id, e.kind, e.name, e.uf_code, (SELECT count(*)::int FROM civica_exec.exec_entity m LEFT JOIN civica_exec.exec_entity_version v ON v.entity_id = m.entity_id AND v.valid_to IS NULL WHERE m.kind = 4 AND m.uf_code = e.uf_code AND coalesce(v.evidence_ref NOT LIKE '%NÃO comprovada%', true)) AS universe FROM civica_exec.exec_entity e WHERE e.entity_id = $1 AND e.kind IN (4, 5)`, [entityId])).rows[0];
  if (!e) return null;
  const ufCode = Number(e.uf_code);
  const munIds = SEG_DEFS.filter(d => d.granularity === 'municipio' && (!opt.indicatorIds || opt.indicatorIds.includes(d.id))).map(d => d.id);
  const [vals, cov, pop, sources, ufInd] = await Promise.all([
    q.query(`SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) AND ($3::date IS NULL OR period_start >= $3::date) ORDER BY indicator_id, period_start`, [entityId, munIds, opt.from ?? null]),
    covOf(q, ufCode, VDE_MUN_IDS.filter(i => munIds.includes(i))), populationYears(q, entityId), sourcesOf(q, ufCode),
    q.query(`SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = 3008 ORDER BY period_start`, [ufCode]),
  ]);
  const universe = Number(e.universe) + 1;
  const real = Number(e.kind) === 4;
  const metrics: SegMetric[] = [];
  for (const d of SEG_DEFS.filter(x => munIds.includes(x.id))) {
    if (!real && d.grain === 'A' && d.code.endsWith('TAXA')) continue;
    const isVdeCount = d.source === 'VDE' && d.grain === 'M';
    const s = seriesOf(vals.rows, d.id, isVdeCount ? { cov, universe, municipal: true, from: opt.from } : undefined);
    if (s.length) metrics.push(metricOf(d, s));
  }
  const ufShare = SEG_DEF_BY_ID.get(3008)!;
  return { entityId, name: String(e.name), ufCode, kind: Number(e.kind) as 4 | 5, metrics, ufContext: { indeterminateShare: ufInd.rows.length ? metricOf(ufShare, seriesOf(ufInd.rows, 3008)) : null },
    coverage: coverageOf(vals.rows as never, cov, pop, universe), sources, restrictions: RESTRICTIONS };
}
