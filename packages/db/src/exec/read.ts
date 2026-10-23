import type { Pool } from 'pg';
import { sha256 } from './publication.ts';

/**
 * Camada de leitura das páginas territoriais (estados e municípios). Somente SELECT; uma consulta pequena por seção,
 * sem recalcular agregados pesados: usa exec_ind_latest, exec_ind_value e exec_story.
 */
type Q = Pick<Pool, 'query'>;
export interface Territory { entityId: number; kind: 1 | 2 | 3 | 4 | 5; ibge7: number; name: string; uf: string | null; ufCode: number | null; parentId: number | null; regionName: string | null; isCurrent: boolean; population: { year: number; value: number } | null; installationDateProven: boolean }
export interface MunicipalityRow { entityId: number; name: string; population: number | null }

const num = (v: unknown): number | null => v == null ? null : Number(v);
const iso = (v: unknown): string | null => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

async function withPop(q: Q, base: Omit<Territory, 'population' | 'installationDateProven' | 'regionName'> & { regionName?: string | null }): Promise<Territory> {
  const p = (await q.query(`SELECT year, value FROM civica_exec.exec_territory_population WHERE entity_id = $1 AND source = 1 ORDER BY year DESC LIMIT 1`, [base.entityId])).rows[0];
  const v = (await q.query(`SELECT evidence_ref FROM civica_exec.exec_entity_version WHERE entity_id = $1`, [base.entityId])).rows[0];
  const region = base.kind === 3 ? (await q.query(`SELECT r.name FROM civica_exec.exec_entity u JOIN civica_exec.exec_entity r ON r.entity_id = u.parent_id WHERE u.entity_id = $1`, [base.entityId])).rows[0]?.name ?? null : null;
  return { ...base, regionName: region, population: p ? { year: Number(p.year), value: Number(p.value) } : null, installationDateProven: !(v?.evidence_ref && /NÃO comprovada/.test(String(v.evidence_ref))) };
}
const mapEntity = (r: Record<string, unknown>) => ({ entityId: Number(r.entity_id), kind: Number(r.kind) as Territory['kind'], ibge7: Number(r.ibge7), name: String(r.name), uf: (r.uf as string | null) ?? null, ufCode: num(r.uf_code), parentId: num(r.parent_id), isCurrent: Boolean(r.is_current) });

export async function listStates(q: Q): Promise<Array<{ ufCode: number; uf: string; name: string; region: string; population: number | null; year: number | null }>> {
  const r = await q.query(`SELECT u.entity_id, u.uf, u.name, g.name AS region, p.value, p.year FROM civica_exec.exec_entity u JOIN civica_exec.exec_entity g ON g.entity_id = u.parent_id
    LEFT JOIN LATERAL (SELECT value, year FROM civica_exec.exec_territory_population WHERE entity_id = u.entity_id AND source = 1 ORDER BY year DESC LIMIT 1) p ON true WHERE u.kind = 3 ORDER BY g.entity_id, u.name`);
  return r.rows.map(x => ({ ufCode: Number(x.entity_id), uf: String(x.uf), name: String(x.name), region: String(x.region), population: num(x.value), year: num(x.year) }));
}
export async function getState(q: Q, uf: string): Promise<Territory | null> {
  const r = (await q.query(`SELECT * FROM civica_exec.exec_entity WHERE kind = 3 AND uf = $1`, [uf.toUpperCase()])).rows[0];
  return r ? withPop(q, mapEntity(r)) : null;
}
/** Município pelo código IBGE canônico de 7 dígitos; 6 dígitos são resolvidos pelo mapa de códigos externos. */
export async function resolveMunicipalityId(q: Q, code: string): Promise<number | null> {
  if (!/^\d{6,7}$/.test(code)) return null;
  const r = (await q.query(`SELECT entity_id FROM civica_exec.exec_entity_external_id WHERE source = $1 AND code = $2 AND valid_to IS NULL`, [code.length === 7 ? 2 : 1, code])).rows[0];
  return r ? Number(r.entity_id) : null;
}
export async function getMunicipality(q: Q, entityId: number): Promise<(Territory & { stateName: string }) | null> {
  const r = (await q.query(`SELECT m.*, u.name AS state_name FROM civica_exec.exec_entity m JOIN civica_exec.exec_entity u ON u.entity_id = m.parent_id WHERE m.entity_id = $1 AND m.kind = 4`, [entityId])).rows[0];
  if (!r) return null;
  return { ...(await withPop(q, mapEntity(r))), stateName: String(r.state_name) };
}
export async function listMunicipalities(q: Q, ufCode: number): Promise<MunicipalityRow[]> {
  const r = await q.query(`SELECT m.entity_id, m.name, p.value FROM civica_exec.exec_entity m LEFT JOIN LATERAL (SELECT value FROM civica_exec.exec_territory_population WHERE entity_id = m.entity_id AND source = 1 ORDER BY year DESC LIMIT 1) p ON true
    WHERE m.kind = 4 AND m.uf_code = $1 ORDER BY m.name`, [ufCode]);
  return r.rows.map(x => ({ entityId: Number(x.entity_id), name: String(x.name), population: num(x.value) }));
}
export async function searchMunicipalities(q: Q, o: { term?: string; ufCode?: number; limit?: number; offset?: number }): Promise<{ total: number; rows: Array<MunicipalityRow & { uf: string }> }> {
  const where: string[] = ['m.kind = 4']; const vals: unknown[] = [];
  if (o.ufCode) { vals.push(o.ufCode); where.push(`m.uf_code = $${vals.length}`); }
  if (o.term) { vals.push(o.term); where.push(`unaccent(lower(m.name)) LIKE '%' || unaccent(lower($${vals.length})) || '%'`); }
  const w = where.join(' AND ');
  const total = Number((await q.query(`SELECT count(*)::int n FROM civica_exec.exec_entity m WHERE ${w}`, vals)).rows[0].n);
  vals.push(o.limit ?? 30, o.offset ?? 0);
  const r = await q.query(`SELECT m.entity_id, m.name, m.uf, p.value FROM civica_exec.exec_entity m LEFT JOIN LATERAL (SELECT value FROM civica_exec.exec_territory_population WHERE entity_id = m.entity_id AND source = 1 ORDER BY year DESC LIMIT 1) p ON true
    WHERE ${w} ORDER BY p.value DESC NULLS LAST, m.name LIMIT $${vals.length - 1} OFFSET $${vals.length}`, vals);
  return { total, rows: r.rows.map(x => ({ entityId: Number(x.entity_id), name: String(x.name), uf: String(x.uf), population: num(x.value) })) };
}

export interface IndicatorView { code: string; version: number; label: string; unit: string; grain: string; periodStart: string; periodEnd: string; status: 'preliminary' | 'final'; value: number | null; numerator: number | null; denominator: number | null; flags: number; note: string | null; rankingAllowed: boolean }
export async function getLatestIndicators(q: Q, entityId: number, domain = 1): Promise<IndicatorView[]> {
  const r = await q.query(`SELECT d.code, d.method_version, d.label, d.unit, d.grain, d.methodology_note, d.ranking_allowed, l.period_start, v.period_end, l.status, l.value, l.numerator, l.denominator, l.flags
    FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id)
    JOIN civica_exec.exec_ind_value v ON v.indicator_id = l.indicator_id AND v.entity_id = l.entity_id AND v.period_start = l.period_start
    WHERE l.entity_id = $1 AND d.domain = $2 ORDER BY d.sort_order, d.indicator_id`, [entityId, domain]);
  return r.rows.map(x => ({ code: String(x.code), version: Number(x.method_version), label: String(x.label), unit: String(x.unit), grain: String(x.grain), periodStart: iso(x.period_start)!, periodEnd: iso(x.period_end)!, status: Number(x.status) === 1 ? 'preliminary' : 'final', value: num(x.value), numerator: num(x.numerator), denominator: num(x.denominator), flags: Number(x.flags), note: x.methodology_note ?? null, rankingAllowed: Boolean(x.ranking_allowed) }));
}
export async function getIndicatorSeries(q: Q, entityId: number, code: string, from = '2013-01-01'): Promise<Array<{ periodStart: string; value: number | null; numerator: number | null; denominator: number | null; flags: number; status: number }>> {
  const r = await q.query(`SELECT v.period_start, v.value, v.numerator, v.denominator, v.flags, v.status FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id)
    WHERE d.code = $2 AND v.entity_id = $1 AND v.period_start >= $3 ORDER BY v.period_start`, [entityId, code, from]);
  return r.rows.map(x => ({ periodStart: iso(x.period_start)!, value: num(x.value), numerator: num(x.numerator), denominator: num(x.denominator), flags: Number(x.flags), status: Number(x.status) }));
}
/** Valores mais recentes de um indicador para os municípios de uma UF (colore o mapa). Ausência de linha = sem registro. */
export async function getMapValues(q: Q, ufCode: number, code: string): Promise<Array<{ entityId: number; value: number | null; denominator: number | null; flags: number; periodStart: string }>> {
  const r = await q.query(`SELECT l.entity_id, l.value, l.denominator, l.flags, l.period_start FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id)
    JOIN civica_exec.exec_entity e ON e.entity_id = l.entity_id AND e.kind = 4 WHERE d.code = $2 AND e.uf_code = $1`, [ufCode, code]);
  return r.rows.map(x => ({ entityId: Number(x.entity_id), value: num(x.value), denominator: num(x.denominator), flags: Number(x.flags), periodStart: iso(x.period_start)! }));
}

export interface PublicationCoverage { datasetId: number; label: string; firstCompetence: number; lastCompetence: number; slices: number; stage: number; activatedAt: string }
export async function getCoverage(q: Q, ufCode: number): Promise<PublicationCoverage[]> {
  const r = await q.query(`SELECT p.dataset_id, rc.label, min(p.competence)::int first, max(p.competence)::int last, count(*)::int n, max(p.stage)::int stage, max(p.activated_at) at
    FROM civica_exec.exec_publication p LEFT JOIN civica_exec.exec_ref_code rc ON rc.domain = 0 AND rc.code = p.dataset_id::text
    WHERE p.uf IN ($1, 0) AND p.dataset_id < 15 GROUP BY p.dataset_id, rc.label ORDER BY p.dataset_id`, [ufCode]);   // datasets 15–17 (Segurança) têm cobertura própria em getSegState().sources
  return r.rows.map(x => ({ datasetId: Number(x.dataset_id), label: String(x.label ?? x.dataset_id), firstCompetence: Number(x.first), lastCompetence: Number(x.last), slices: Number(x.n), stage: Number(x.stage), activatedAt: new Date(x.at).toISOString() }));
}

export interface Facilities { total: number; sus: number; hospitals: number; ubs: number; byType: Array<{ code: number; label: string; n: number }>; beds: { existing: number; sus: number; byType: Array<{ code: number; label: string; existing: number; sus: number }> }; withoutBeds: number; competence: number | null }
/** Rede assistencial vigente (intervalos abertos). entity: município ou UF. */
export async function getFacilities(q: Q, o: { municipalityId?: number; ufCode?: number }): Promise<Facilities> {
  const scope = o.municipalityId ? 'entity_id = $1' : `entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1)`;
  const key = o.municipalityId ?? o.ufCode!;
  const tot = (await q.query(`SELECT count(*)::int total, count(*) FILTER (WHERE vinc_sus)::int sus, count(*) FILTER (WHERE tp_unid IN (5, 7))::int hosp, count(*) FILTER (WHERE tp_unid = 2)::int ubs FROM civica_exec.exec_sau_cnes_estab_v WHERE valid_to IS NULL AND ${scope}`, [key])).rows[0];
  const types = await q.query(`SELECT v.tp_unid, coalesce(rc.label, v.tp_unid::text) label, count(*)::int n FROM civica_exec.exec_sau_cnes_estab_v v LEFT JOIN civica_exec.exec_ref_code rc ON rc.domain = 3 AND rc.code = v.tp_unid::text
    WHERE v.valid_to IS NULL AND ${scope.replace('entity_id', 'v.entity_id')} GROUP BY v.tp_unid, rc.label ORDER BY n DESC`, [key]);
  const beds = await q.query(`SELECT l.tp_leito, coalesce(rc.label, l.tp_leito::text) label, sum(l.qt_exist)::int existing, sum(l.qt_sus)::int sus FROM civica_exec.exec_sau_cnes_leito_v l LEFT JOIN civica_exec.exec_ref_code rc ON rc.domain = 4 AND rc.code = l.tp_leito::text
    WHERE l.valid_to IS NULL AND ${scope.replace('entity_id', 'l.entity_id')} GROUP BY l.tp_leito, rc.label ORDER BY l.tp_leito`, [key]);
  const wb = (await q.query(`SELECT count(*)::int n FROM civica_exec.exec_sau_cnes_estab_v v WHERE v.valid_to IS NULL AND v.tp_unid IN (5, 7) AND ${scope.replace('entity_id', 'v.entity_id')}
    AND NOT EXISTS (SELECT 1 FROM civica_exec.exec_sau_cnes_leito_v l WHERE l.cnes = v.cnes AND l.valid_to IS NULL)`, [key])).rows[0].n;
  const comp = (await q.query(`SELECT max(competence)::int m FROM civica_exec.exec_publication WHERE dataset_id = 3 AND uf = $1`, [o.ufCode ?? (await q.query(`SELECT uf_code FROM civica_exec.exec_entity WHERE entity_id = $1`, [o.municipalityId])).rows[0].uf_code])).rows[0].m;
  const bt = beds.rows.filter(b => Number(b.tp_leito) !== 7);
  return { total: tot.total, sus: tot.sus, hospitals: tot.hosp, ubs: tot.ubs, byType: types.rows.map(t => ({ code: Number(t.tp_unid), label: String(t.label), n: Number(t.n) })),
    beds: { existing: bt.reduce((n, b) => n + Number(b.existing), 0), sus: bt.reduce((n, b) => n + Number(b.sus), 0), byType: beds.rows.map(b => ({ code: Number(b.tp_leito), label: String(b.label), existing: Number(b.existing), sus: Number(b.sus) })) }, withoutBeds: Number(wb), competence: num(comp) };
}
export interface HospitalRow { cnes: number; name: string | null; typeLabel: string; sus: boolean; bedsExisting: number; bedsSus: number }
export async function listHospitals(q: Q, municipalityId: number): Promise<HospitalRow[]> {
  const r = await q.query(`SELECT v.cnes, c.name, coalesce(rc.label, v.tp_unid::text) label, v.vinc_sus,
      coalesce((SELECT sum(l.qt_exist) FILTER (WHERE l.tp_leito <> 7) FROM civica_exec.exec_sau_cnes_leito_v l WHERE l.cnes = v.cnes AND l.valid_to IS NULL), 0)::int ex,
      coalesce((SELECT sum(l.qt_sus) FILTER (WHERE l.tp_leito <> 7) FROM civica_exec.exec_sau_cnes_leito_v l WHERE l.cnes = v.cnes AND l.valid_to IS NULL), 0)::int su
    FROM civica_exec.exec_sau_cnes_estab_v v JOIN civica_exec.exec_sau_cnes_estab c USING (cnes) LEFT JOIN civica_exec.exec_ref_code rc ON rc.domain = 3 AND rc.code = v.tp_unid::text
    WHERE v.entity_id = $1 AND v.valid_to IS NULL AND v.tp_unid IN (5, 7) ORDER BY ex DESC, v.cnes`, [municipalityId]);
  return r.rows.map(x => ({ cnes: Number(x.cnes), name: x.name ?? null, typeLabel: String(x.label), sus: Boolean(x.vinc_sus), bedsExisting: Number(x.ex), bedsSus: Number(x.su) }));
}
/** Internações de residentes (SIH) e destino: só competências carregadas. */
export async function getResidentFlow(q: Q, entityId: number): Promise<Array<{ competence: number; aih: number; icsap: number; outside: number; valueCents: number }>> {
  const r = await q.query(`SELECT competence, n_aih, n_icsap, n_fora_mun, valor_cents FROM civica_exec.exec_sau_sih_mun_mes WHERE entity_id = $1 ORDER BY competence`, [entityId]);
  return r.rows.map(x => ({ competence: Number(x.competence), aih: Number(x.n_aih), icsap: Number(x.n_icsap), outside: Number(x.n_fora_mun), valueCents: Number(x.valor_cents) }));
}
export async function getHospitalActivity(q: Q, municipalityId: number): Promise<Array<{ cnes: number; name: string | null; competences: number; aih: number; valueCents: number; deaths: number; first: number; last: number }>> {
  const r = await q.query(`SELECT a.cnes, c.name, count(DISTINCT a.competence)::int comps, sum(a.n_aih)::int aih, sum(a.valor_cents)::bigint val, sum(a.obitos)::int deaths, min(a.competence)::int f, max(a.competence)::int l
    FROM civica_exec.exec_sau_hosp_mes_subgrupo a JOIN civica_exec.exec_sau_cnes_estab c USING (cnes)
    WHERE a.cnes IN (SELECT cnes FROM civica_exec.exec_sau_cnes_estab_v WHERE entity_id = $1 AND valid_to IS NULL) GROUP BY a.cnes, c.name ORDER BY aih DESC LIMIT 12`, [municipalityId]);
  return r.rows.map(x => ({ cnes: Number(x.cnes), name: x.name ?? null, competences: Number(x.comps), aih: Number(x.aih), valueCents: Number(x.val), deaths: Number(x.deaths), first: Number(x.f), last: Number(x.l) }));
}

/** Read model da UF (exec_story): totais da rede e cobertura, reconstruído quando o source_key (ponteiros de publicação) muda. */
export async function readUfHealthStory(pool: Pool, ufCode: number): Promise<{ payload: Facilities & { coverage: PublicationCoverage[] }; builtAt: string; fresh: boolean }> {
  const key = sha256(`rede-v2:${JSON.stringify((await pool.query(`SELECT dataset_id, competence, run_id FROM civica_exec.exec_publication WHERE uf = $1 ORDER BY 1, 2`, [ufCode])).rows)}`);
  const cur = (await pool.query(`SELECT source_key, built_at, payload FROM civica_exec.exec_story WHERE entity_id = $1 AND domain = 1 AND section = 'rede'`, [ufCode])).rows[0];
  if (cur && cur.source_key === key) return { payload: cur.payload, builtAt: new Date(cur.built_at).toISOString(), fresh: true };
  const payload = { ...(await getFacilities(pool, { ufCode })), coverage: await getCoverage(pool, ufCode) };
  await pool.query(`INSERT INTO civica_exec.exec_story (entity_id, domain, section, source_key, built_at, payload) VALUES ($1, 1, 'rede', $2, now(), $3::jsonb)
    ON CONFLICT (entity_id, domain, section) DO UPDATE SET source_key = EXCLUDED.source_key, built_at = EXCLUDED.built_at, payload = EXCLUDED.payload`, [ufCode, key, JSON.stringify(payload)]);
  return { payload, builtAt: new Date().toISOString(), fresh: false };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Painel de Saúde: valores com variação anual, vacinas prioritárias e benchmark (distribuições pré-calculadas em exec_story).

export const PANEL_CODES = ['IND-SAU-05', 'IND-SAU-05S', 'IND-SAU-08', 'IND-SAU-10', 'IND-SAU-11', 'IND-SAU-12'] as const;
export interface PanelValue { code: string; periodStart: string; grain: string; status: 'preliminary' | 'final'; value: number | null; numerator: number | null; denominator: number | null; flags: number; prev: { periodStart: string; value: number | null; flags: number } | null }
/** Último valor de cada indicador do painel e o valor do mesmo período um ano antes (uma consulta; sem consulta por card). */
export async function getPanelValues(q: Q, entityId: number): Promise<Record<string, PanelValue>> {
  const r = await q.query(`SELECT d.code, d.grain, l.period_start, l.status, l.value, l.numerator, l.denominator, l.flags, p.period_start AS prev_start, p.value AS prev_value, p.flags AS prev_flags
    FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id)
    LEFT JOIN civica_exec.exec_ind_value p ON p.indicator_id = l.indicator_id AND p.entity_id = l.entity_id AND p.period_start = (l.period_start - interval '1 year')::date
    WHERE l.entity_id = $1 AND d.code = ANY($2::text[])`, [entityId, [...PANEL_CODES]]);
  const out: Record<string, PanelValue> = {};
  for (const x of r.rows) out[String(x.code)] = { code: String(x.code), periodStart: iso(x.period_start)!, grain: String(x.grain), status: Number(x.status) === 1 ? 'preliminary' : 'final', value: num(x.value), numerator: num(x.numerator), denominator: num(x.denominator), flags: Number(x.flags),
    prev: x.prev_start ? { periodStart: iso(x.prev_start)!, value: num(x.prev_value), flags: Number(x.prev_flags) } : null };
  return out;
}

export interface VaccineValue { slug: string; label: string; year: number; value: number | null; numerator: number | null; denominator: number | null; flags: number; status: 'preliminary' | 'final' }
/** Cobertura das vacinas pedidas (slugs canônicos) no último ano disponível de cada uma: definitivo se existir, senão o preliminar (uma consulta). */
export async function getVaccinePanel(q: Q, entityId: number, slugs: string[]): Promise<VaccineValue[]> {
  const r = await q.query(`SELECT substr(d.code, 12) AS slug, d.label, l.period_start, l.status, l.value, l.numerator, l.denominator, l.flags
    FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id)
    WHERE l.entity_id = $1 AND d.code = ANY($2::text[])`, [entityId, slugs.map(s => `IND-SAU-07:${s}`)]);
  return r.rows.map(x => ({ slug: String(x.slug), label: String(x.label).replace('Cobertura vacinal — ', ''), year: Number(iso(x.period_start)!.slice(0, 4)), value: num(x.value), numerator: num(x.numerator), denominator: num(x.denominator), flags: Number(x.flags), status: Number(x.status) === 1 ? 'preliminary' as const : 'final' as const }));
}

export interface DistStat { n: number; p10: number; p20: number; p40: number; p50: number; p60: number; p80: number; p90: number; periodStart: string }
export interface HealthBenchmarks {
  /** municípios do Brasil inteiro, por código de indicador */ brazilMunicipalities: Record<string, DistStat>;
  /** municípios de cada UF (chave = código IBGE da UF) */ byUf: Record<string, Record<string, DistStat>>;
  /** as 27 UFs entre si */ ufs: Record<string, DistStat>;
}
const BENCH_PCT = [0.1, 0.2, 0.4, 0.5, 0.6, 0.8, 0.9];
async function computeBenchmarks(pool: Pool): Promise<HealthBenchmarks> {
  const stat = (x: Record<string, unknown>): DistStat => { const a = x.pct as number[]; return { n: Number(x.n), p10: a[0]!, p20: a[1]!, p40: a[2]!, p50: a[3]!, p60: a[4]!, p80: a[5]!, p90: a[6]!, periodStart: iso(x.period_start)! }; };
  // Elegíveis: mesmo período (o mais recente do indicador), valor presente, sem pequeno número (1), suprimido (8) nem sem denominador (64), denominador ≥ mínimo do indicador.
  const sql = (kind: number, groupUf: boolean) => `
    WITH base AS (SELECT d.code, l.indicator_id, e.uf_code, l.period_start, l.value FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id)
      JOIN civica_exec.exec_entity e ON e.entity_id = l.entity_id WHERE e.kind = ${kind} AND d.code = ANY($1::text[]) AND l.value IS NOT NULL AND (l.flags & 73) = 0 AND (d.min_denominator IS NULL OR l.denominator >= d.min_denominator)),
    mx AS (SELECT indicator_id, max(period_start) p FROM base GROUP BY 1),
    cur AS (SELECT b.* FROM base b JOIN mx ON mx.indicator_id = b.indicator_id AND mx.p = b.period_start)
    SELECT code, ${groupUf ? 'uf_code' : 'NULL::int AS uf_code'}, count(*)::int n, min(period_start) AS period_start, percentile_cont($2::float8[]) WITHIN GROUP (ORDER BY value) AS pct FROM cur GROUP BY code${groupUf ? ', uf_code' : ''}`;
  const [br, uf, ufs] = await Promise.all([pool.query(sql(4, false), [[...PANEL_CODES], BENCH_PCT]), pool.query(sql(4, true), [[...PANEL_CODES], BENCH_PCT]), pool.query(sql(3, false), [[...PANEL_CODES], BENCH_PCT])]);
  const out: HealthBenchmarks = { brazilMunicipalities: {}, byUf: {}, ufs: {} };
  for (const x of br.rows) out.brazilMunicipalities[String(x.code)] = stat(x);
  for (const x of uf.rows) (out.byUf[String(x.uf_code)] ??= {})[String(x.code)] = stat(x);
  for (const x of ufs.rows) out.ufs[String(x.code)] = stat(x);
  return out;
}
/** Distribuições de comparação (percentis), reconstruídas só quando os ponteiros de publicação mudam; uma leitura de uma linha por requisição. */
export async function readHealthBenchmarks(pool: Pool): Promise<HealthBenchmarks> {
  const key = sha256(`bench-v1:${JSON.stringify((await pool.query(`SELECT dataset_id, uf, competence, run_id FROM civica_exec.exec_publication WHERE dataset_id IN (3, 4, 7, 8, 10, 11) ORDER BY 1, 2, 3`)).rows.map(r => `${r.dataset_id}.${r.uf}.${r.competence}.${r.run_id}`).join('|'))}`);
  const cur = (await pool.query(`SELECT source_key, payload FROM civica_exec.exec_story WHERE entity_id = 76 AND domain = 1 AND section = 'benchmark_saude'`)).rows[0];
  if (cur && cur.source_key === key) return cur.payload as HealthBenchmarks;
  const payload = await computeBenchmarks(pool);
  await pool.query(`INSERT INTO civica_exec.exec_story (entity_id, domain, section, source_key, built_at, payload) VALUES (76, 1, 'benchmark_saude', $1, now(), $2::jsonb)
    ON CONFLICT (entity_id, domain, section) DO UPDATE SET source_key = EXCLUDED.source_key, built_at = EXCLUDED.built_at, payload = EXCLUDED.payload`, [key, JSON.stringify(payload)]);
  return payload;
}
