import type { Pool } from 'pg';

export interface CompactServingRefreshResult { materialization: 'education_compact_serving_v1'; refreshedAt: string; overviewRows: number; seriesRows: number; sourceFingerprint: string }

/** Materializa apenas dados de primeira pintura e séries solicitáveis; fatos permanecem intactos. */
export async function refreshEducationCompactServing(pool: Pool, year = 2025): Promise<CompactServingRefreshResult> {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', ['civica_exec:p1091:compact_serving_v1']);
    await c.query('BEGIN');
    const source = (await c.query(`WITH x AS (
      SELECT 'offer:' || count(*)::text x FROM civica_exec.exec_edu_offer_year
      UNION ALL SELECT 'infra:' || count(*)::text FROM civica_exec.exec_edu_infra_agg
      UNION ALL SELECT 'finance:' || count(*)::text FROM civica_exec.exec_edu_finance_rollup
      UNION ALL SELECT 'program:' || count(*)::text FROM civica_exec.exec_edu_program_rollup
      UNION ALL SELECT 'contract:' || count(*)::text FROM civica_exec.exec_edu_contract_rollup
    ) SELECT md5(string_agg(x, ':' ORDER BY x)) fingerprint FROM x`)).rows[0]!;
    const overviewSql = `CREATE TEMP TABLE p1091_overview AS
      WITH territory AS (
        SELECT 1::smallint scope,'BRASIL'::text scope_key,$1::smallint AS yr
        UNION ALL SELECT 3,lpad(uf_code::text,2,'0'),$1 FROM civica_exec.exec_entity WHERE kind=3
        UNION ALL SELECT 4,ibge7::text,$1 FROM civica_exec.exec_entity WHERE kind=4 AND ibge7 IS NOT NULL
      ), offer AS (
        SELECT 1::smallint scope,'BRASIL'::text scope_key,o.year,count(*)::int schools,sum(o.mat_bas)::bigint enrollments
        FROM civica_exec.exec_edu_offer_year o WHERE o.year=$1::smallint GROUP BY o.year
        UNION ALL
        SELECT 3,e.uf_code::text,o.year,count(*)::int,sum(o.mat_bas)::bigint FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING(inep,year) JOIN civica_exec.exec_entity e ON e.entity_id=y.entity_id WHERE o.year=$1::smallint AND e.kind=4 GROUP BY e.uf_code,o.year
        UNION ALL
        SELECT 4,e.ibge7::text,o.year,count(*)::int,sum(o.mat_bas)::bigint FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING(inep,year) JOIN civica_exec.exec_entity e ON e.entity_id=y.entity_id WHERE o.year=$1::smallint AND e.kind=4 GROUP BY e.ibge7,o.year
      ), infra AS (
        SELECT 1::smallint scope,'BRASIL'::text scope_key,year,sum(internet_t)::bigint internet_yes,sum(internet_f)::bigint internet_no FROM civica_exec.exec_edu_infra_agg WHERE year=$1::smallint GROUP BY year
        UNION ALL SELECT 3,lpad(uf::text,2,'0'),year,sum(internet_t)::bigint,sum(internet_f)::bigint FROM civica_exec.exec_edu_infra_agg WHERE year=$1::smallint GROUP BY uf,year
      ), fin0 AS (
        SELECT scope,scope_key,year,source,stage,sum(entities)::int entities,sum(amount_cents)::bigint amount_cents FROM civica_exec.exec_edu_finance_rollup WHERE year=$1::smallint GROUP BY scope,scope_key,year,source,stage
      ), fin AS (
        SELECT scope,scope_key,year,jsonb_agg(jsonb_build_object('source',source,'stage',stage,'entities',entities,'amountCents',amount_cents) ORDER BY source,stage) rows FROM fin0 GROUP BY scope,scope_key,year
      ), prog0 AS (
        SELECT scope,scope_key,year,program_code,financial_stage,sum(rows)::int facts,sum(beneficiaries)::int beneficiaries,sum(amount_cents)::bigint amount_cents FROM civica_exec.exec_edu_program_rollup WHERE year=$1::smallint GROUP BY scope,scope_key,year,program_code,financial_stage
      ), prog AS (
        SELECT scope,scope_key,year,jsonb_agg(jsonb_build_object('program',program_code,'stage',financial_stage,'facts',facts,'beneficiaries',beneficiaries,'amountCents',amount_cents) ORDER BY program_code,financial_stage) rows FROM prog0 GROUP BY scope,scope_key,year
      ), con0 AS (
        SELECT scope,scope_key,year,category,confidence,sum(contracts)::int contracts,sum(contracted_value)::bigint contracted_value FROM civica_exec.exec_edu_contract_rollup WHERE year=$1::smallint GROUP BY scope,scope_key,year,category,confidence
      ), con AS (
        SELECT scope,scope_key,year,jsonb_agg(jsonb_build_object('category',category,'confidence',confidence,'contracts',contracts,'contractedValue',contracted_value) ORDER BY category,confidence) rows FROM con0 GROUP BY scope,scope_key,year
      )
      SELECT t.scope,t.scope_key,t.yr AS year,jsonb_build_object(
        'scope',t.scope,'scopeKey',t.scope_key,'year',t.yr,
        'schools',coalesce(o.schools,0),'enrollments',o.enrollments,
        'internetPct',CASE WHEN coalesce(i.internet_yes,0)+coalesce(i.internet_no,0)>0 THEN round(i.internet_yes::numeric*100/(i.internet_yes+i.internet_no),2) ELSE NULL END,
        'finance',coalesce(f.rows,'[]'::jsonb),'programs',coalesce(p.rows,'[]'::jsonb),'contracts',coalesce(c.rows,'[]'::jsonb),
        'coverage',jsonb_build_object('offer',o.schools IS NOT NULL,'finance',f.rows IS NOT NULL,'programs',p.rows IS NOT NULL,'contracts',c.rows IS NOT NULL),
        'through',t.yr,'materialization','education_compact_serving_v1') payload,
        $2::text source_fingerprint,clock_timestamp() refreshed_at
      FROM territory t LEFT JOIN offer o ON o.scope=t.scope AND o.scope_key=t.scope_key AND o.year=t.yr LEFT JOIN infra i ON i.scope=t.scope AND i.scope_key=t.scope_key AND i.year=t.yr LEFT JOIN fin f ON f.scope=t.scope AND f.scope_key=t.scope_key AND f.year=t.yr LEFT JOIN prog p ON p.scope=t.scope AND p.scope_key=t.scope_key AND p.year=t.yr LEFT JOIN con c ON c.scope=t.scope AND c.scope_key::text=t.scope_key AND c.year=t.yr`;
    try { await c.query(overviewSql, [year, String(source.fingerprint)]); } catch (error) { console.error('P1091_OVERVIEW_SQL_ERROR', (error as { position?: string }).position, overviewSql.slice(Math.max(0, Number((error as { position?: string }).position ?? 1) - 120), Number((error as { position?: string }).position ?? 1) + 120)); throw error; }
    await c.query(`CREATE TEMP TABLE p1091_series AS
      SELECT 1::smallint scope,'BRASIL'::text scope_key,'edu.enrollment.total'::text indicator,o.year,sum(o.mat_bas)::numeric value,'matriculas'::text unit,'escolas com oferta no ano'::text universe,$1::text source_fingerprint,clock_timestamp() refreshed_at FROM civica_exec.exec_edu_offer_year o GROUP BY o.year
      UNION ALL SELECT 3,e.uf_code::text,'edu.enrollment.total',o.year,sum(o.mat_bas)::numeric,'matriculas','escolas com oferta no ano',$1,clock_timestamp() FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING(inep,year) JOIN civica_exec.exec_entity e ON e.entity_id=y.entity_id WHERE e.kind=4 GROUP BY e.uf_code,o.year
      UNION ALL SELECT 4,e.ibge7::text,'edu.enrollment.total',o.year,sum(o.mat_bas)::numeric,'matriculas','escolas com oferta no ano',$1,clock_timestamp() FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING(inep,year) JOIN civica_exec.exec_entity e ON e.entity_id=y.entity_id WHERE e.kind=4 GROUP BY e.ibge7,o.year`, [String(source.fingerprint)]);
    const overviewRows = Number((await c.query('SELECT count(*)::int n FROM p1091_overview')).rows[0]!.n);
    const seriesRows = Number((await c.query('SELECT count(*)::int n FROM p1091_series')).rows[0]!.n);
    await c.query('DELETE FROM civica_exec.exec_edu_overview_rollup');
    await c.query('INSERT INTO civica_exec.exec_edu_overview_rollup SELECT * FROM p1091_overview');
    await c.query('DELETE FROM civica_exec.exec_edu_series_rollup');
    await c.query('INSERT INTO civica_exec.exec_edu_series_rollup SELECT * FROM p1091_series');
    const meta = (await c.query(`INSERT INTO civica_exec.exec_edu_analytics_meta(materialization,refreshed_at,source_contract_rows,source_class_rows,source_fingerprint,details) VALUES ('education_compact_serving_v1',clock_timestamp(),0,0,$1,jsonb_build_object('overview_rows',$2::int,'series_rows',$3::int,'year',$4::int)) ON CONFLICT(materialization) DO UPDATE SET refreshed_at=excluded.refreshed_at,source_fingerprint=excluded.source_fingerprint,details=excluded.details RETURNING refreshed_at`, [String(source.fingerprint),overviewRows,seriesRows,year])).rows[0]!;
    await c.query('COMMIT');
    return { materialization: 'education_compact_serving_v1', refreshedAt: new Date(meta.refreshed_at).toISOString(), overviewRows, seriesRows, sourceFingerprint: String(source.fingerprint) };
  } catch (error) { try { await c.query('ROLLBACK'); } catch {} throw error; }
  finally { try { await c.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', ['civica_exec:p1091:compact_serving_v1']); } catch {} c.release(); }
}
