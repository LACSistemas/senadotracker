import type { Pool, PoolClient } from 'pg';

type Q = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
type Kind = 1 | 2 | 3 | 4 | 5;
export type WellbeingChapter = 'conditions' | 'work' | 'social' | 'digital' | 'action' | 'evolution';
export type WellbeingTerritoryRef = { entityId?: number; ibge7?: number; ufCode?: number };

const CHAPTERS: Record<WellbeingChapter, number[]> = {
  conditions: [9001, 9002, 9003, 9004, 9005, 9006],
  social: [9101, 9102, 9103, 9104, 9105, 9106, 9201, 9202, 9203, 9301],
  work: [9401, 9402, 9500, 9501, 9502, 9503],
  digital: [9601, 9602, 9603, 9604, 9605],
  action: [],
  evolution: [9001, 9002, 9003, 9004, 9005, 9006, 9101, 9102, 9103, 9104, 9105, 9106, 9201, 9202, 9203, 9301, 9401, 9402, 9500, 9501, 9502, 9503, 9601, 9602, 9603, 9604, 9605],
};
const ALL_IDS = CHAPTERS.evolution;
const MUNIC_IDS = new Set([9601, 9602, 9603, 9604, 9605]);
const CAGED_IDS = new Set([9500, 9501, 9502, 9503]);
const GINI_ID = 9003;

export interface WellbeingTerritory {
  entityId: number; kind: Kind; ibge7: number; name: string; uf: string | null; ufCode: number | null; parentId: number | null;
}
export interface WellbeingObservation {
  indicatorCode: string; indicatorId: number; label: string; territory: WellbeingTerritory;
  value: number | null; unit: string | null; measureType: 'numeric' | 'categorical'; periodStart: string | null; periodEnd: string | null;
  frequency: 'annual' | 'monthly'; source: string | null; dataset: string | null; release: string | null; sourceUrl: string | null;
  methodVersion: number; universe: string | null; numerator: number | null; denominator: number | null; coverageStatus: string;
  dataThrough: string | null; sourcePublishedAt: string | null; ingestedAt: string | null; publicationId: string | null; revision: number | null;
  isComparable: boolean; comparisonRejectionReason: string | null; flags: number;
}
export interface WellbeingOverview { territory: WellbeingTerritory; observations: WellbeingObservation[]; chapters: Record<WellbeingChapter, WellbeingObservation[]>; coverage: WellbeingCoverageSummary[]; finance: WellbeingFinanceContext | null; }
export interface WellbeingComparator { eligible: boolean; value: number | null; reason: string | null; source: string; period: string | null; denominator: number | null; territory: WellbeingTerritory | null; }
export interface WellbeingCoverageSummary { indicatorCode: string; indicatorId: number; label: string; period: string | null; expectedTerritories: number | null; observedTerritories: number; validValues: number; nullValues: number; coveragePercent: number | null; status: 'PUBLISHED' | 'PARTIAL_COVERAGE' | 'NOT_PUBLISHED_AT_GRANULARITY'; source: string | null; release: string | null; dataThrough: string | null; notes: string[]; }
export interface WellbeingFinanceContext { entity: WellbeingTerritory; functionCode: '08'; functionLabel: string; rows: Array<{ year: number; period: number; stage: 'EMP' | 'LIQ' | 'PAG'; amountCents: number; amountBrl: number; accumulated: boolean; }>; notes: string[]; }

const iso = (v: unknown): string | null => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const n = (v: unknown): number | null => v == null ? null : Number(v);
const jsonPath = (x: any, path: string[]): any => path.reduce((a, k) => a == null ? null : a[k], x);
const sourceMeta = (inputs: any) => {
  const f = Array.isArray(inputs?.sourceFiles) ? inputs.sourceFiles[0] : null;
  return { source: inputs?.provider ?? null, release: inputs?.edition ?? inputs?.family ?? null, sourceUrl: f?.url ?? f?.sourceUrl ?? f?.source_url ?? null };
};
const frequency = (id: number): 'annual' | 'monthly' => CAGED_IDS.has(id) ? 'monthly' : 'annual';
const measureType = (id: number): 'numeric' | 'categorical' => MUNIC_IDS.has(id) ? 'categorical' : 'numeric';
const statusFor = (value: number | null, flags: number, observed: boolean, comparable: boolean) => !observed ? 'NOT_APPLICABLE' : value == null || flags !== 0 ? 'PARTIAL_COVERAGE' : comparable ? 'PUBLISHED' : 'PUBLISHED_WITH_CAVEAT';

async function entity(q: Q, ref: WellbeingTerritoryRef): Promise<WellbeingTerritory | null> {
  const vals: unknown[] = [];
  let where = '';
  if (ref.entityId != null) { vals.push(ref.entityId); where = `e.entity_id=$${vals.length}`; }
  else if (ref.ibge7 != null) { vals.push(ref.ibge7); where = `e.kind=4 and e.ibge7=$${vals.length}`; }
  else if (ref.ufCode != null) { vals.push(ref.ufCode); where = `e.kind=3 and e.uf_code=$${vals.length}`; }
  else { where = 'e.kind=1'; }
  const r = (await q.query(`select e.entity_id,e.kind,e.ibge7,e.name,e.uf,e.uf_code,e.parent_id from civica_exec.exec_entity e where ${where} limit 1`, vals)).rows[0];
  return r ? { entityId: Number(r.entity_id), kind: Number(r.kind) as Kind, ibge7: Number(r.ibge7), name: String(r.name), uf: r.uf ?? null, ufCode: n(r.uf_code), parentId: n(r.parent_id) } : null;
}
const activeJoin = `join civica_exec.exec_ingestion_run r on r.run_id=l.run_id join civica_exec.exec_publication p on p.run_id=l.run_id and p.state=1`;
const activeValueJoin = `join civica_exec.exec_ingestion_run r on r.run_id=v.run_id join civica_exec.exec_publication p on p.run_id=v.run_id and p.state=1`;

function observation(row: any, territory: WellbeingTerritory): WellbeingObservation {
  const value = n(row.value), flags = Number(row.flags ?? 0), observed = row.run_id != null;
  const comparable = Number(row.indicator_id) !== GINI_ID || territory.kind !== 4;
  const meta = sourceMeta(row.inputs);
  return {
    indicatorCode: String(row.code), indicatorId: Number(row.indicator_id), label: String(row.label), territory,
    value, unit: row.unit ?? null, measureType: measureType(Number(row.indicator_id)), periodStart: iso(row.period_start), periodEnd: iso(row.period_end), frequency: frequency(Number(row.indicator_id)),
    source: meta.source, dataset: row.dataset_id == null ? null : `exec:${row.dataset_id}`, release: meta.release, sourceUrl: meta.sourceUrl, methodVersion: Number(row.method_version), universe: row.denominator_desc ?? null,
    numerator: n(row.numerator), denominator: n(row.denominator), coverageStatus: statusFor(value, flags, observed, comparable), dataThrough: iso(row.period_end), sourcePublishedAt: row.activated_at ? new Date(row.activated_at).toISOString() : null, ingestedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    publicationId: row.dataset_id == null ? null : `${row.dataset_id}:${row.pub_uf}:${row.competence}`, revision: n(row.run_id), isComparable: comparable, comparisonRejectionReason: comparable ? null : 'Gini não foi publicado no recorte municipal', flags,
  };
}

export async function getWellbeingOverview(q: Q, ref: WellbeingTerritoryRef): Promise<WellbeingOverview | null> {
  const t = await entity(q, ref); if (!t) return null;
  const rows = (await q.query(`with active as (select l.*,r.dataset_id,r.finished_at,r.inputs,p.uf pub_uf,p.competence,p.activated_at from civica_exec.exec_ind_latest l ${activeJoin})
    select d.indicator_id,d.code,d.label,d.unit,d.grain,d.method_version,d.denominator_desc,d.methodology_note,d.ranking_allowed,a.entity_id,a.period_start,v.period_end,a.status,a.value,a.numerator,a.denominator,a.flags,a.run_id,a.dataset_id,a.finished_at,a.inputs,a.pub_uf,a.competence,a.activated_at
    from civica_exec.exec_ind_def d left join active a on a.indicator_id=d.indicator_id and a.entity_id=$1 left join civica_exec.exec_ind_value v on v.indicator_id=a.indicator_id and v.entity_id=a.entity_id and v.period_start=a.period_start and v.run_id=a.run_id
    where d.domain=4 and d.indicator_id=any($2::smallint[]) order by d.sort_order,d.indicator_id`, [t.entityId, ALL_IDS])).rows;
  const obs = rows.map(r => observation(r, t));
  const by = Object.fromEntries((Object.keys(CHAPTERS) as WellbeingChapter[]).map(ch => [ch, obs.filter(o => CHAPTERS[ch].includes(o.indicatorId))])) as Record<WellbeingChapter, WellbeingObservation[]>;
  // Overview carries territory-level coverage flags; the full national coverage matrix is a separate call.
  const coverage = await getWellbeingCoverage(q, undefined, t.entityId);
  const finance = await getWellbeingFinanceContext(q, { entityId: t.entityId });
  return { territory: t, observations: obs, chapters: by, coverage, finance };
}

export async function getWellbeingChapter(q: Q, ref: WellbeingTerritoryRef, chapter: WellbeingChapter) {
  const o = await getWellbeingOverview(q, ref); return o ? { ...o, observations: o.chapters[chapter], chapter } : null;
}

export async function getWellbeingSeries(q: Q, ref: WellbeingTerritoryRef, indicatorCode: string) {
  const t = await entity(q, ref); if (!t) return null;
  const rows = (await q.query(`select d.indicator_id,d.code,d.label,d.unit,d.method_version,d.denominator_desc,v.period_start,v.period_end,v.status,v.value,v.numerator,v.denominator,v.flags,v.run_id,r.dataset_id,r.finished_at,r.inputs,p.uf pub_uf,p.competence,p.activated_at
    from civica_exec.exec_ind_value v join civica_exec.exec_ind_def d using(indicator_id) ${activeValueJoin} where d.domain=4 and d.code=$2 and v.entity_id=$1 order by v.period_start`, [t.entityId, indicatorCode])).rows;
  return rows.map(r => observation(r, t));
}

export async function getWellbeingComparators(q: Q, ref: WellbeingTerritoryRef, indicatorCode: string) {
  const t = await entity(q, ref); if (!t) return null;
  const def = (await q.query(`select indicator_id,code,label from civica_exec.exec_ind_def where domain=4 and code=$1`, [indicatorCode])).rows[0]; if (!def) return null;
  const direct = (await q.query(`select x.*,e.entity_id,e.kind,e.ibge7,e.name,e.uf,e.uf_code,e.parent_id from (select l.indicator_id,l.entity_id,l.period_start,l.status,l.value,l.numerator,l.denominator,l.flags,r.dataset_id,r.finished_at,r.inputs,p.uf pub_uf,p.competence,p.activated_at from civica_exec.exec_ind_latest l ${activeJoin} where l.indicator_id=$1 and l.entity_id=any($2::int[])) x join civica_exec.exec_entity e using(entity_id)`, [def.indicator_id, [t.entityId, t.kind === 4 ? t.ufCode : null, 76].filter(x => x != null)])).rows;
  const target = direct.find(x => Number(x.entity_id) === t.entityId);
  const out: Record<string, WellbeingComparator> = {};
  const make = (label: string, row: any | null, reason: string | null = null): WellbeingComparator => row ? { eligible: row.value != null && Number(row.flags ?? 0) === 0, value: n(row.value), reason: row.value == null ? 'valor ausente na publicação ativa' : Number(row.flags ?? 0) ? 'valor com ressalva de cobertura' : null, source: sourceMeta(row.inputs).source ?? 'Cívica', period: iso(row.period_start), denominator: n(row.denominator), territory: { entityId: Number(row.entity_id), kind: Number(row.kind) as Kind, ibge7: Number(row.ibge7), name: String(row.name), uf: row.uf ?? null, ufCode: n(row.uf_code), parentId: n(row.parent_id) } } : { eligible: false, value: null, reason: reason ?? 'indicador não publicado nessa granularidade', source: 'Cívica', period: null, denominator: null, territory: null };
  if (MUNIC_IDS.has(Number(def.indicator_id)) && t.kind === 4) {
    const period = target?.period_start ?? '2024-12-31';
    const a = (await q.query(`select e.uf_code, sum(v.numerator) filter(where v.denominator is not null)::float8 num, sum(v.denominator)::float8 den, min(v.period_start) period from civica_exec.exec_ind_value v ${activeValueJoin} join civica_exec.exec_entity e using(entity_id) where v.indicator_id=$1 and v.period_start=$2 and e.kind=4 and e.uf_code=any($3::smallint[]) group by e.uf_code`, [def.indicator_id, period, [t.ufCode]])).rows[0];
    const b = (await q.query(`select sum(v.numerator) filter(where v.denominator is not null)::float8 num, sum(v.denominator)::float8 den, min(v.period_start) period from civica_exec.exec_ind_value v ${activeValueJoin} join civica_exec.exec_entity e using(entity_id) where v.indicator_id=$1 and v.period_start=$2 and e.kind=4`, [def.indicator_id, period])).rows[0];
    const agg = (x: any, label: string): WellbeingComparator => { const den = n(x?.den); const val = den && den > 0 ? Number(x.num) / den : null; return { eligible: val != null, value: val, reason: val == null ? 'sem respostas elegíveis no universo municipal' : null, source: 'IBGE MUNIC 2024; agregado de respostas municipais', period: iso(x?.period), denominator: den, territory: label === 'state' ? awaitableTerritory(t, 3) : awaitableTerritory({ entityId: 76, kind: 1, ibge7: 76, name: 'Brasil', uf: null, ufCode: null, parentId: null }, 1) }; };
    out.municipality = make('municipality', target, 'município sem resposta elegível na publicação');
    out.state = agg(a, 'state'); out.brazil = agg(b, 'brazil');
  } else {
    out.municipality = make('municipality', target, t.kind === 4 && Number(def.indicator_id) === GINI_ID ? 'Gini não foi publicado no recorte municipal' : null);
    const stateRow = direct.find(x => Number(x.kind) === 3 && Number(x.uf_code) === t.ufCode);
    const brRow = direct.find(x => Number(x.kind) === 1);
    out.state = t.kind === 4 || t.kind === 3 ? make('state', stateRow, 'estado sem publicação comparável') : make('state', null, 'não aplicável para Brasil');
    out.brazil = t.kind !== 1 ? make('brazil', brRow, 'Brasil sem publicação comparável') : make('brazil', target);
  }
  return { indicatorCode, target: t, comparisons: out, restrictions: ['Comparação é descritiva; não é ranking.', 'Período, unidade e universo precisam coincidir.', 'MUNIC usa municípios com resposta válida como denominador; não população.'] };
}

export interface WellbeingMunicDistribution {
  indicatorCode: string; indicatorId: number; label: string; period: string | null;
  positiveCount: number | null; validCount: number; totalMunicipalities: number; nullCount: number;
  value: number | null; scope: 'uf' | 'brazil'; ufCode: number | null; source: string;
}

/** Agregado das respostas MUNIC entre os municípios de uma UF (ou do Brasil, sem ufCode): mesma fórmula já usada no comparador município→UF/Brasil, generalizada para quando o próprio território de referência É a UF ou o Brasil. */
export async function getWellbeingMunicDistribution(q: Q, indicatorCode: string, ufCode?: number): Promise<WellbeingMunicDistribution | null> {
  const def = (await q.query(`select indicator_id,code,label from civica_exec.exec_ind_def where domain=4 and code=$1`, [indicatorCode])).rows[0];
  if (!def || !MUNIC_IDS.has(Number(def.indicator_id))) return null;
  const params: unknown[] = [def.indicator_id];
  let ufFilter = '';
  if (ufCode != null) { params.push(ufCode); ufFilter = `and e.uf_code=$${params.length}`; }
  const row = (await q.query(`select sum(v.numerator) filter(where v.denominator is not null)::float8 num, sum(v.denominator)::float8 den, count(*)::int total, max(v.period_start) period
    from civica_exec.exec_ind_value v ${activeValueJoin} join civica_exec.exec_entity e using(entity_id)
    where v.indicator_id=$1 and e.kind=4 ${ufFilter}`, params)).rows[0];
  const valid = n(row?.den) ?? 0; const total = Number(row?.total ?? 0);
  const value = valid > 0 ? Number(row.num) / valid : null;
  return {
    indicatorCode, indicatorId: Number(def.indicator_id), label: String(def.label), period: iso(row?.period),
    positiveCount: row?.num == null ? null : Number(row.num), validCount: valid, totalMunicipalities: total, nullCount: Math.max(0, total - valid),
    value, scope: ufCode != null ? 'uf' : 'brazil', ufCode: ufCode ?? null, source: 'IBGE MUNIC 2024; agregado de respostas municipais',
  };
}

export interface WellbeingSocialDistribution {
  indicatorCode: string; indicatorId: number; label: string; period: string | null;
  total: number | null; respondentMunicipalities: number; totalMunicipalities: number; scope: 'uf' | 'brazil'; ufCode: number | null; source: string;
}
/** Soma (nunca média) dos indicadores de contagem do Censo SUAS entre os municípios de uma UF (ou do Brasil, sem ufCode).
 * Deliberadamente não cobre IDCRAS/IDCREAS/IDConselho (índices): uma média simples entre municípios trataria todos como
 * peso igual, o que a metodologia oficial não endossa — esses índices só são mostrados por município. */
const SUAS_SUMMABLE_IDS = new Set([9101, 9102, 9103, 9104, 9201]);
export async function getWellbeingSocialDistribution(q: Q, indicatorCode: string, ufCode?: number): Promise<WellbeingSocialDistribution | null> {
  const def = (await q.query(`select indicator_id,code,label from civica_exec.exec_ind_def where domain=4 and code=$1`, [indicatorCode])).rows[0];
  if (!def || !SUAS_SUMMABLE_IDS.has(Number(def.indicator_id))) return null;
  const params: unknown[] = [def.indicator_id];
  let ufFilter = '';
  if (ufCode != null) { params.push(ufCode); ufFilter = `and e.uf_code=$${params.length}`; }
  const row = (await q.query(`select sum(v.value)::float8 total, count(*) filter(where v.value is not null)::int respondents, count(*)::int total_m, max(v.period_start) period
    from civica_exec.exec_ind_value v ${activeValueJoin} join civica_exec.exec_entity e using(entity_id)
    where v.indicator_id=$1 and e.kind=4 ${ufFilter}`, params)).rows[0];
  return {
    indicatorCode, indicatorId: Number(def.indicator_id), label: String(def.label), period: iso(row?.period),
    total: row?.total == null ? null : Number(row.total), respondentMunicipalities: Number(row?.respondents ?? 0), totalMunicipalities: Number(row?.total_m ?? 0),
    scope: ufCode != null ? 'uf' : 'brazil', ufCode: ufCode ?? null, source: 'Censo SUAS 2024; agregado de respondentes municipais',
  };
}

function awaitableTerritory(t: WellbeingTerritory, kind: Kind): WellbeingTerritory | null { return kind === 3 ? { entityId: t.ufCode ?? 0, kind, ibge7: t.ufCode ?? 0, name: t.uf ?? '', uf: t.uf, ufCode: t.ufCode, parentId: null } : { entityId: 76, kind, ibge7: 76, name: 'Brasil', uf: null, ufCode: null, parentId: null }; }

export async function getWellbeingCoverage(q: Q, indicatorCode?: string, entityId?: number, period?: string): Promise<WellbeingCoverageSummary[]> {
  const ids = indicatorCode ? undefined : ALL_IDS;
  const defWhere = indicatorCode ? 'd.code=$1' : 'd.indicator_id=any($1::smallint[])';
  const params: unknown[] = [indicatorCode ?? ids];
  let rows: any[];
  if (period) {
    params.push(period); if (entityId != null) params.push(entityId);
    rows = (await q.query(`with active as (select v.indicator_id,v.entity_id,v.period_start,v.value,v.flags,r.dataset_id,r.inputs,r.finished_at,p.activated_at from civica_exec.exec_ind_value v ${activeValueJoin} where v.period_start=$2 ${entityId != null ? 'and v.entity_id=$3' : ''})
      select d.indicator_id,d.code,d.label,a.period_start,count(distinct a.entity_id)::int observed,count(*) filter(where a.value is not null and a.flags=0)::int valid,count(*) filter(where a.value is null or a.flags<>0)::int nulls,max(a.dataset_id)::int dataset_id,(array_agg(a.inputs order by a.period_start desc))[1] inputs,max(a.finished_at) finished_at,max(a.activated_at) activated_at from civica_exec.exec_ind_def d left join active a on a.indicator_id=d.indicator_id where d.domain=4 and ${defWhere} group by d.indicator_id,d.code,d.label,a.period_start order by d.indicator_id`, params)).rows;
  } else if (entityId != null) {
    params.push(entityId);
    rows = (await q.query(`with active as (select l.indicator_id,l.entity_id,l.period_start,l.value,l.flags,r.dataset_id,r.inputs,r.finished_at,p.activated_at from civica_exec.exec_ind_latest l ${activeJoin} where l.entity_id=$2)
      select d.indicator_id,d.code,d.label,a.period_start,count(distinct a.entity_id)::int observed,count(*) filter(where a.value is not null and a.flags=0)::int valid,count(*) filter(where a.value is null or a.flags<>0)::int nulls,max(a.dataset_id)::int dataset_id,(array_agg(a.inputs order by a.period_start desc))[1] inputs,max(a.finished_at) finished_at,max(a.activated_at) activated_at from civica_exec.exec_ind_def d left join active a on a.indicator_id=d.indicator_id where d.domain=4 and ${defWhere} group by d.indicator_id,d.code,d.label,a.period_start order by d.indicator_id`, params)).rows;
  } else {
    rows = (await q.query(`with active as (select l.indicator_id,l.entity_id,l.period_start,l.value,l.flags,r.dataset_id,r.inputs,r.finished_at,p.activated_at from civica_exec.exec_ind_latest l ${activeJoin})
      select d.indicator_id,d.code,d.label,a.period_start,count(distinct a.entity_id)::int observed,count(*) filter(where a.value is not null and a.flags=0)::int valid,count(*) filter(where a.value is null or a.flags<>0)::int nulls,max(a.dataset_id)::int dataset_id,(array_agg(a.inputs order by a.period_start desc))[1] inputs,max(a.finished_at) finished_at,max(a.activated_at) activated_at from civica_exec.exec_ind_def d left join active a on a.indicator_id=d.indicator_id where d.domain=4 and ${defWhere} group by d.indicator_id,d.code,d.label,a.period_start order by d.indicator_id,a.period_start`, params)).rows;
  }
  return rows.map(r => { const id = Number(r.indicator_id); const observed = Number(r.observed ?? 0), valid = Number(r.valid ?? 0), period = iso(r.period_start), expected = entityId != null ? 1 : expectedUniverse(id, period ? Number(period.slice(0, 4)) : 0); const m = sourceMeta(r.inputs); return { indicatorCode: String(r.code), indicatorId: id, label: String(r.label), period, expectedTerritories: expected, observedTerritories: observed, validValues: valid, nullValues: Number(r.nulls ?? 0), coveragePercent: expected ? Math.round(observed / expected * 10000) / 100 : null, status: observed === 0 ? 'NOT_PUBLISHED_AT_GRANULARITY' : valid < observed ? 'PARTIAL_COVERAGE' : 'PUBLISHED', source: m.source, release: m.release, dataThrough: period, notes: id === 9605 ? ['Universo condicional; respostas “-” não são denominador válido.'] : [] }; });
}
function expectedUniverse(id: number, _year: number): number | null {
  if (id === GINI_ID) return 28;
  if ([9001, 9002, 9004, 9005, 9006].includes(id)) return 5598;
  if ([9101, 9102, 9103, 9104, 9106].includes(id)) return 5334;
  if (id === 9105) return 5570;
  if ([9201, 9202, 9203].includes(id)) return 2609;
  if (id === 9301) return 4976;
  if (id === 9401 || (id >= 9500 && id <= 9503)) return 5599;
  if (id === 9402) return 27;
  if (MUNIC_IDS.has(id)) return 5570;
  return null;
}

export async function getWellbeingMethodology(q: Q, indicatorCode: string) {
  const r = (await q.query(`select d.indicator_id,d.code,d.label,d.unit,d.grain,d.method_version,d.numerator_desc,d.denominator_desc,d.null_semantics,d.methodology_note,d.ranking_allowed,d.aggregation_allowed,r.dataset_id,r.inputs,r.finished_at,p.activated_at from civica_exec.exec_ind_def d left join lateral (select r.* from civica_exec.exec_ingestion_run r where r.dataset_id = case when d.indicator_id between 9001 and 9006 then 120 when d.indicator_id between 9101 and 9301 then 121 when d.indicator_id=9401 or d.indicator_id=9402 then 122 when d.indicator_id between 9500 and 9503 then 123 when d.indicator_id between 9601 and 9605 then 124 end and r.status=9 order by r.finished_at desc limit 1) r on true left join civica_exec.exec_publication p on p.run_id=r.run_id and p.state=1 where d.domain=4 and d.code=$1`, [indicatorCode])).rows[0];
  if (!r) return null; const m = sourceMeta(r.inputs); return { indicatorCode: String(r.code), indicatorId: Number(r.indicator_id), label: String(r.label), unit: r.unit ?? null, frequency: frequency(Number(r.indicator_id)), measureType: measureType(Number(r.indicator_id)), numerator: r.numerator_desc ?? null, denominator: r.denominator_desc ?? null, nullSemantics: r.null_semantics ?? 'missing_not_zero', methodology: r.methodology_note ?? null, source: m.source, release: m.release, sourceUrl: m.sourceUrl, rankingAllowed: Boolean(r.ranking_allowed), aggregationAllowed: Boolean(r.aggregation_allowed) };
}

export async function getWellbeingFinanceContext(q: Q, ref: WellbeingTerritoryRef, year?: number): Promise<WellbeingFinanceContext | null> {
  const t = await entity(q, ref); if (!t) return null; const rows = (await q.query(`select f.exercicio,f.periodo,k.code,f.valor from civica_exec.exec_fin_fact f join civica_exec.exec_ref_code c on c.ref_id=f.conta_id join civica_exec.exec_ref_code k on k.ref_id=f.coluna_id where f.entity_id=$1 and c.code='08' and k.code in('EMP','LIQ','PAG') ${year != null ? 'and f.exercicio=$2' : ''} order by f.exercicio,f.periodo,k.code`, year != null ? [t.entityId, year] : [t.entityId])).rows; return { entity: t, functionCode: '08', functionLabel: 'Assistência Social', rows: rows.map(r => ({ year: Number(r.exercicio), period: Number(r.periodo), stage: String(r.code) as 'EMP' | 'LIQ' | 'PAG', amountCents: Number(r.valor), amountBrl: Number(r.valor) / 100, accumulated: false })), notes: ['EMP, LIQ e PAG são estágios distintos.', 'Os valores são do exercício e não incluem restos a pagar pagos.', 'RREO acumulado não deve ser somado entre bimestres.'] }; }

export const WELLBEING_CHAPTERS = CHAPTERS;
export const WELLBEING_INDICATOR_IDS = ALL_IDS;
