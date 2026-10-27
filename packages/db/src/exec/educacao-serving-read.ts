import type { Pool } from 'pg';

type Q = Pick<Pool, 'query'>;
type Overview = { scope: number; scopeKey: string; year: number; schools: number; enrollments: number | null; internetPct: number | null; finance: unknown; programs: unknown; contracts: unknown; coverage: Record<string, unknown>; through: number; materialization: string; refreshedAt: string; sourceFingerprint: string };
type ScopeKey = { ibge7?: string; ufCode?: number };
const scopeOf = (o: ScopeKey): { scope: number; key: string } => o.ibge7 ? { scope: 4, key: o.ibge7 } : o.ufCode == null ? { scope: 1, key: 'BRASIL' } : { scope: 3, key: String(o.ufCode).padStart(2, '0') };

export async function getEducationOverview(q: Q, o: ScopeKey = {}, year = 2025) {
  const s = scopeOf(o);
  const row = (await q.query(`SELECT payload,refreshed_at,source_fingerprint FROM civica_exec.exec_edu_overview_rollup WHERE scope=$1 AND scope_key=$2 AND year=$3`, [s.scope, s.key, year])).rows[0];
  if (!row) return null;
  return { ...(row.payload as Record<string, unknown>), refreshedAt: new Date(row.refreshed_at).toISOString(), sourceFingerprint: String(row.source_fingerprint) } as Overview;
}

export type EducationSectionName = 'schools' | 'finance' | 'programs' | 'contracts' | 'coverage';
export async function getEducationSection(q: Q, o: ScopeKey & { section: EducationSectionName; year?: number }) {
  const overview = await getEducationOverview(q, o, o.year ?? 2025); if (!overview) return null;
  const section = o.section;
  if (section === 'schools') return { scope: overview.scope, scopeKey: overview.scopeKey, year: overview.year, schools: overview.schools, enrollments: overview.enrollments, internetPct: overview.internetPct, coverage: (overview.coverage as Record<string, unknown>).offer };
  return { scope: overview.scope, scopeKey: overview.scopeKey, year: overview.year, [section]: overview[section], coverage: (overview.coverage as Record<string, unknown>)[section] };
}

export async function getEducationSeries(q: Q, o: ScopeKey & { indicator: string; from?: number; to?: number; limit?: number }) {
  const s = scopeOf(o); const limit = Math.min(Math.max(o.limit ?? 25, 1), 100);
  return (await q.query(`SELECT indicator,scope,scope_key,year,value,unit,universe FROM civica_exec.exec_edu_series_rollup WHERE scope=$1 AND scope_key=$2 AND indicator=$3 AND ($4::smallint IS NULL OR year >= $4) AND ($5::smallint IS NULL OR year <= $5) ORDER BY year DESC LIMIT $6`, [s.scope, s.key, o.indicator, o.from ?? null, o.to ?? null, limit])).rows;
}

export async function getEducationComparison(q: Q, ibge7: string, year = 2025) {
  const municipality = await getEducationOverview(q, { ibge7 }, year); if (!municipality) return null;
  const ufCode = Number(String(ibge7).slice(0, 2));
  const [state, brazil, medians] = await Promise.all([
    getEducationOverview(q, { ufCode }, year),
    getEducationOverview(q, {}, year),
    (async () => {
      const [offer, infra, ideb, teachers] = await Promise.all([
        q.query(`WITH x AS (
          SELECT e.uf_code, e.ibge7, count(*)::numeric schools, sum(o.mat_bas)::numeric enrollments
          FROM civica_exec.exec_edu_offer_year o
          JOIN civica_exec.exec_edu_school_year y USING (inep, year)
          JOIN civica_exec.exec_entity e ON e.entity_id=y.entity_id
          WHERE o.year=$1 AND e.kind=4
          GROUP BY e.uf_code,e.ibge7
        ) SELECT
          percentile_cont(0.5) WITHIN GROUP (ORDER BY schools) FILTER (WHERE uf_code=$2) schools_state_median,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY schools) schools_brazil_median,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY enrollments) FILTER (WHERE uf_code=$2) state_median,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY enrollments) brazil_median,
          count(*) FILTER (WHERE uf_code=$2)::int state_sample,
          count(*)::int brazil_sample
        FROM x`, [year, ufCode]),
        q.query(`WITH x AS (
          SELECT e.uf_code,e.ibge7,
            count(*) FILTER (WHERE i.internet IS NOT NULL)::int answered,
            count(*) FILTER (WHERE i.internet)::int yes
          FROM civica_exec.exec_edu_infra_year i
          JOIN civica_exec.exec_edu_school_year y ON y.inep=i.inep AND y.year=i.year
          JOIN civica_exec.exec_entity e ON e.entity_id=y.entity_id
          WHERE i.year=$1 AND e.kind=4
          GROUP BY e.uf_code,e.ibge7
        ), p AS (
          SELECT uf_code,ibge7, CASE WHEN answered>0 THEN yes::numeric*100/answered END internet_pct FROM x
        ) SELECT
          percentile_cont(0.5) WITHIN GROUP (ORDER BY internet_pct) FILTER (WHERE uf_code=$2) state_median,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY internet_pct) brazil_median,
          count(*) FILTER (WHERE uf_code=$2 AND internet_pct IS NOT NULL)::int state_sample,
          count(*) FILTER (WHERE internet_pct IS NOT NULL)::int brazil_sample
        FROM p`, [year, ufCode]),
        q.query(`SELECT t.year,t.stage,t.dep,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ideb) FILTER (WHERE e.uf_code=$1) state_median,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ideb) brazil_median,
          count(*) FILTER (WHERE e.uf_code=$1)::int state_sample,
          count(*)::int brazil_sample
          FROM civica_exec.exec_edu_ideb_terr t
          JOIN civica_exec.exec_entity e ON e.entity_id=t.entity_id
          WHERE e.kind=4 AND t.ideb IS NOT NULL
          GROUP BY t.year,t.stage,t.dep ORDER BY t.year,t.stage,t.dep`, [ufCode]),
        q.query(`WITH x AS (
          SELECT e.uf_code,e.ibge7,t.doc_total::numeric docentes
          FROM civica_exec.exec_edu_doc_terr t
          JOIN civica_exec.exec_entity e ON e.entity_id=t.entity_id
          WHERE t.year=$1 AND e.kind=4 AND t.doc_total IS NOT NULL
        ) SELECT
          percentile_cont(0.5) WITHIN GROUP (ORDER BY docentes) FILTER (WHERE uf_code=$2) state_median,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY docentes) brazil_median,
          count(*) FILTER (WHERE uf_code=$2)::int state_sample,
          count(*)::int brazil_sample
        FROM x`, [year, ufCode]),
      ]);
      const o = offer.rows[0] ?? {}; const i = infra.rows[0] ?? {};
      return {
        schools: { state: o.schools_state_median == null ? null : Number(o.schools_state_median), brazil: o.schools_brazil_median == null ? null : Number(o.schools_brazil_median), stateSample: Number(o.state_sample ?? 0), brazilSample: Number(o.brazil_sample ?? 0), universe: 'municípios com escolas observadas' },
        enrollments: { state: o.state_median == null ? null : Number(o.state_median), brazil: o.brazil_median == null ? null : Number(o.brazil_median), stateSample: Number(o.state_sample ?? 0), brazilSample: Number(o.brazil_sample ?? 0), universe: 'municípios com matrícula observada' },
        internet: { state: i.state_median == null ? null : Number(i.state_median), brazil: i.brazil_median == null ? null : Number(i.brazil_median), stateSample: Number(i.state_sample ?? 0), brazilSample: Number(i.brazil_sample ?? 0), universe: 'municípios com respostas válidas' },
        teachers: { state: teachers.rows[0]?.state_median == null ? null : Number(teachers.rows[0].state_median), brazil: teachers.rows[0]?.brazil_median == null ? null : Number(teachers.rows[0].brazil_median), stateSample: Number(teachers.rows[0]?.state_sample ?? 0), brazilSample: Number(teachers.rows[0]?.brazil_sample ?? 0), universe: 'municípios com docentes publicados' },
        ideb: ideb.rows.filter((r: Record<string, unknown>) => Number(r.year) === year).map((r: Record<string, unknown>) => ({ year, stage: Number(r.stage), dep: Number(r.dep), state: r.state_median == null ? null : Number(r.state_median), brazil: r.brazil_median == null ? null : Number(r.brazil_median), stateSample: Number(r.state_sample ?? 0), brazilSample: Number(r.brazil_sample ?? 0), universe: 'municípios com Ideb publicado' })),
        idebSeries: ideb.rows.map((r: Record<string, unknown>) => ({ year: Number(r.year), stage: Number(r.stage), dep: Number(r.dep), state: r.state_median == null ? null : Number(r.state_median), brazil: r.brazil_median == null ? null : Number(r.brazil_median), stateSample: Number(r.state_sample ?? 0), brazilSample: Number(r.brazil_sample ?? 0), universe: 'municípios com Ideb publicado' })),
      };
    })(),
  ]);
  return { year, dimensions: ['schools', 'enrollments', 'internetPct'], municipality, state, brazil, medians, descriptiveOnly: true };
}

export async function getEducationList(q: Q, o: { ibge7?: string; ufCode?: number; year?: number; cursor?: number; limit?: number } = {}) {
  const year = o.year ?? 2025; const limit = Math.min(Math.max(o.limit ?? 25, 1), 100); const args: unknown[] = [year]; const conditions = ['y.year=$1'];
  if (o.ibge7) { args.push(Number(o.ibge7)); conditions.push(`y.entity_id=(SELECT entity_id FROM civica_exec.exec_entity WHERE kind=4 AND ibge7=$${args.length})`); }
  else if (o.ufCode != null) { args.push(o.ufCode); conditions.push(`y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind=4 AND uf_code=$${args.length})`); }
  if (o.cursor != null) { args.push(o.cursor); conditions.push(`y.inep > $${args.length}`); }
  args.push(limit); return (await q.query(`SELECT y.inep,y.name,y.entity_id,o.mat_bas AS enrollments FROM civica_exec.exec_edu_school_year y LEFT JOIN civica_exec.exec_edu_offer_year o ON o.inep=y.inep AND o.year=y.year WHERE ${conditions.join(' AND ')} ORDER BY y.inep LIMIT $${args.length}`, args)).rows;
}
