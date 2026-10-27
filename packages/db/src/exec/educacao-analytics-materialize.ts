import type { Pool, PoolClient } from 'pg';

export interface EducationAnalyticsRefreshResult {
  materialization: 'education_contract_rollup_v1';
  refreshedAt: string;
  sourceContractRows: number;
  sourceClassRows: number;
  rollupRows: number;
  sourceFingerprint: string;
}

const LOCK_KEY = 'civica_exec:p108:education_contract_rollup_v1';

async function sourceState(c: Pick<PoolClient, 'query'>): Promise<{ contracts: number; classes: number; fingerprint: string }> {
  const r = await c.query(`WITH c AS (
      SELECT count(*)::int n, coalesce(sum(hashtextextended(pncp_id, 0)), 0)::text h FROM civica_exec.exec_edu_contract
    ), k AS (
      SELECT count(*)::int n, coalesce(sum(hashtextextended(pncp_id || ':' || category, 0)), 0)::text h FROM civica_exec.exec_edu_contract_class
    ) SELECT c.n contracts, k.n classes, md5(c.n || ':' || c.h || ':' || k.n || ':' || k.h) fingerprint FROM c, k`);
  const x = r.rows[0]!;
  return { contracts: Number(x.contracts), classes: Number(x.classes), fingerprint: String(x.fingerprint) };
}

/**
 * Reconstrói atomicamente o único agregado persistido da P10.8.
 * Categoria 0 conta contratos únicos; categorias 1..16 não são aditivas entre si.
 * Escopo UF preserva a regra da P10.7: órgão estadual/distrital/municipal cuja UF é a consultada.
 */
export async function refreshEducationAnalytics(pool: Pool): Promise<EducationAnalyticsRefreshResult> {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [LOCK_KEY]);
    await c.query('BEGIN');
    const source = await sourceState(c);
    await c.query(`CREATE TEMP TABLE p108_contract_rollup (
      scope smallint NOT NULL, scope_key integer NOT NULL, year smallint NOT NULL, category smallint NOT NULL, confidence smallint NOT NULL,
      contracts integer NOT NULL, with_value integer NOT NULL, outliers integer NOT NULL, contracted_value bigint NOT NULL,
      PRIMARY KEY (scope, scope_key, year, category, confidence)
    ) ON COMMIT DROP`);
    await c.query(`INSERT INTO p108_contract_rollup
      SELECT 1, 0, year, 0, best_confidence, count(*)::int, count(valor_global)::int,
        count(*) FILTER (WHERE outlier)::int, coalesce(sum(valor_global) FILTER (WHERE NOT outlier), 0)::bigint
      FROM civica_exec.exec_edu_contract GROUP BY year, best_confidence
      UNION ALL
      SELECT 3, uf::int, year, 0, best_confidence, count(*)::int, count(valor_global)::int,
        count(*) FILTER (WHERE outlier)::int, coalesce(sum(valor_global) FILTER (WHERE NOT outlier), 0)::bigint
      FROM civica_exec.exec_edu_contract WHERE uf > 0 AND esfera IN ('E', 'D', 'M') GROUP BY uf, year, best_confidence
      UNION ALL
      SELECT 1, 0, year, category, confidence, count(*)::int, count(valor)::int,
        count(*) FILTER (WHERE outlier)::int, coalesce(sum(valor) FILTER (WHERE NOT outlier), 0)::bigint
      FROM civica_exec.exec_edu_contract_class GROUP BY year, category, confidence
      UNION ALL
      SELECT 3, uf::int, year, category, confidence, count(*)::int, count(valor)::int,
        count(*) FILTER (WHERE outlier)::int, coalesce(sum(valor) FILTER (WHERE NOT outlier), 0)::bigint
      FROM civica_exec.exec_edu_contract_class WHERE uf > 0 AND esfera IN ('E', 'D', 'M') GROUP BY uf, year, category, confidence`);
    const check = (await c.query(`SELECT
      coalesce(sum(contracts) FILTER (WHERE scope=1 AND scope_key=0 AND category=0), 0)::int contracts,
      coalesce(sum(contracts) FILTER (WHERE scope=1 AND scope_key=0 AND category>0), 0)::int classes,
      count(*)::int rows FROM p108_contract_rollup`)).rows[0]!;
    if (Number(check.contracts) !== source.contracts || Number(check.classes) !== source.classes) {
      throw new Error(`P10.8 rollup reconciliation failed: contracts ${check.contracts}/${source.contracts}; classes ${check.classes}/${source.classes}`);
    }
    await c.query('DELETE FROM civica_exec.exec_edu_contract_rollup');
    await c.query(`INSERT INTO civica_exec.exec_edu_contract_rollup SELECT * FROM p108_contract_rollup ORDER BY scope, scope_key, year, category, confidence`);
    const meta = (await c.query(`INSERT INTO civica_exec.exec_edu_analytics_meta
      (materialization, refreshed_at, source_contract_rows, source_class_rows, source_fingerprint, details)
      VALUES ('education_contract_rollup_v1', clock_timestamp(), $1, $2, $3, jsonb_build_object('rollup_rows', $4::int, 'category_zero_is_unique_contracts', true))
      ON CONFLICT (materialization) DO UPDATE SET refreshed_at=excluded.refreshed_at, source_contract_rows=excluded.source_contract_rows,
        source_class_rows=excluded.source_class_rows, source_fingerprint=excluded.source_fingerprint, details=excluded.details
      RETURNING refreshed_at`, [source.contracts, source.classes, source.fingerprint, Number(check.rows)])).rows[0]!;
    await c.query('COMMIT');
    return { materialization: 'education_contract_rollup_v1', refreshedAt: new Date(meta.refreshed_at).toISOString(), sourceContractRows: source.contracts, sourceClassRows: source.classes, rollupRows: Number(check.rows), sourceFingerprint: source.fingerprint };
  } catch (error) {
    try { await c.query('ROLLBACK'); } catch { /* connection already closed */ }
    throw error;
  } finally {
    try { await c.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [LOCK_KEY]); } catch { /* connection already closed */ }
    c.release();
  }
}

export async function educationAnalyticsFreshness(q: Pick<Pool, 'query'>): Promise<EducationAnalyticsRefreshResult | null> {
  const r = await q.query(`SELECT refreshed_at, source_contract_rows, source_class_rows, source_fingerprint,
    coalesce((details->>'rollup_rows')::int, 0) rollup_rows FROM civica_exec.exec_edu_analytics_meta WHERE materialization='education_contract_rollup_v1'`);
  if (!r.rowCount) return null;
  const x = r.rows[0]!;
  return { materialization: 'education_contract_rollup_v1', refreshedAt: new Date(x.refreshed_at).toISOString(), sourceContractRows: Number(x.source_contract_rows), sourceClassRows: Number(x.source_class_rows), rollupRows: Number(x.rollup_rows), sourceFingerprint: String(x.source_fingerprint) };
}

export interface EducationProgramRollupRefreshResult {
  materialization: 'education_program_rollup_v1';
  refreshedAt: string;
  sourceRows: number;
  rollupRows: number;
}

/** Materializa somente os trÃªs grÃ£os necessÃ¡rios para leituras de programas; os fatos permanecem na tabela fonte. */
export async function refreshEducationProgramRollup(pool: Pool): Promise<EducationProgramRollupRefreshResult> {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', ['civica_exec:p108:education_program_rollup_v1']);
    await c.query('BEGIN');
    const source = (await c.query('SELECT count(*)::int n FROM civica_exec.exec_edu_program_fact')).rows[0]!;
    await c.query(`CREATE TEMP TABLE p108_program_rollup AS
      SELECT 1::smallint scope, 'BRASIL'::text scope_key, source_dataset, year, coalesce(month, 0)::smallint, program_code, financial_stage,
        count(*)::int rows, sum(amount_cents)::bigint amount_cents,
        count(DISTINCT beneficiary_code)::int beneficiaries, count(DISTINCT school_inep)::int schools
      FROM civica_exec.exec_edu_program_fact
      GROUP BY source_dataset, year, month, program_code, financial_stage
      UNION ALL
      SELECT 3::smallint, lpad(uf::text, 2, '0'), source_dataset, year, coalesce(month, 0)::smallint, program_code, financial_stage,
        count(*)::int, sum(amount_cents)::bigint, count(DISTINCT beneficiary_code)::int, count(DISTINCT school_inep)::int
      FROM civica_exec.exec_edu_program_fact
      GROUP BY uf, source_dataset, year, month, program_code, financial_stage
      UNION ALL
      SELECT 4::smallint, e.ibge7::text, f.source_dataset, f.year, coalesce(f.month, 0)::smallint, f.program_code, f.financial_stage,
        count(*)::int, sum(amount_cents)::bigint, count(DISTINCT beneficiary_code)::int, count(DISTINCT school_inep)::int
      FROM civica_exec.exec_edu_program_fact f
      JOIN civica_exec.exec_edu_program_municipality_map mm ON mm.source_dataset=f.source_dataset AND mm.year=f.year AND mm.uf=f.uf AND mm.municipality_siafi=f.municipality_siafi AND mm.status='LINKED'
      JOIN civica_exec.exec_entity e ON e.entity_id=mm.entity_id AND e.kind=4
      WHERE f.municipality_siafi IS NOT NULL
      GROUP BY e.ibge7, f.source_dataset, f.year, f.month, f.program_code, f.financial_stage`);
    const count = Number((await c.query('SELECT count(*)::int n FROM p108_program_rollup')).rows[0]!.n);
    await c.query('DELETE FROM civica_exec.exec_edu_program_rollup');
    await c.query('INSERT INTO civica_exec.exec_edu_program_rollup SELECT * FROM p108_program_rollup');
    await c.query(`INSERT INTO civica_exec.exec_edu_analytics_meta
      (materialization, refreshed_at, source_contract_rows, source_class_rows, source_fingerprint, details)
      VALUES ('education_program_rollup_v1', clock_timestamp(), 0, 0, md5($1), jsonb_build_object('rollup_rows', $2::int, 'source_rows', $3::int))
      ON CONFLICT (materialization) DO UPDATE SET refreshed_at=excluded.refreshed_at, source_fingerprint=excluded.source_fingerprint, details=excluded.details`, [String(source.n), count, Number(source.n)]);
    const refreshedAt = new Date().toISOString();
    await c.query('COMMIT');
    return { materialization: 'education_program_rollup_v1', refreshedAt, sourceRows: Number(source.n), rollupRows: count };
  } catch (error) { try { await c.query('ROLLBACK'); } catch {} throw error; }
  finally { try { await c.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', ['civica_exec:p108:education_program_rollup_v1']); } catch {} c.release(); }
}

export interface EducationFinanceRollupRefreshResult { materialization: 'education_finance_rollup_v1'; refreshedAt: string; rollupRows: number }

/** Agregado pequeno por fonte/estÃ¡gio para evitar reagrupamento de SIOPE/Siconfi em cada perfil. */
export async function refreshEducationFinanceRollup(pool: Pool): Promise<EducationFinanceRollupRefreshResult> {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', ['civica_exec:p108:education_finance_rollup_v1']);
    await c.query('BEGIN');
    await c.query(`CREATE TEMP TABLE p108_finance_rollup AS
      WITH s AS (
        SELECT f.entity_id, f.exercicio AS yr, k.code AS stg, max(f.valor)::bigint amount
        FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code c ON c.ref_id=f.conta_id AND c.domain=30 AND c.code='12'
        JOIN civica_exec.exec_ref_code k ON k.ref_id=f.coluna_id AND k.domain=31 WHERE f.exercicio=2025 GROUP BY f.entity_id,f.exercicio,k.code
      ), o AS (
        SELECT 1::smallint scope,'BRASIL'::text scope_key,'SICONFI'::text source_name,yr,0::smallint component,''::text code,stg,count(*)::int entities,sum(amount)::bigint amount_cents FROM s GROUP BY yr,stg
        UNION ALL SELECT 3::smallint,lpad(e.uf_code::text,2,'0'),'SICONFI',s.yr,0::smallint,''::text,s.stg,count(*)::int,sum(s.amount)::bigint FROM s JOIN civica_exec.exec_entity e ON e.entity_id=s.entity_id WHERE e.kind=4 GROUP BY e.uf_code,s.yr,s.stg
      ), t AS (
        SELECT f.entity_id,f.exercicio AS yr,f.componente AS component,f.codigo AS code,f.estagio AS stg,max(f.valor_cents)::bigint amount
        FROM civica_exec.exec_edu_siope_fact f WHERE f.exercicio=2025 GROUP BY f.entity_id,f.exercicio,f.componente,f.codigo,f.estagio
      )
        SELECT scope,scope_key,source_name,yr,component,code,stg,entities,amount_cents FROM o
      UNION ALL SELECT 1::smallint,'BRASIL','SIOPE',yr,component,code,stg,count(*)::int,sum(amount)::bigint FROM t GROUP BY yr,component,code,stg
      UNION ALL SELECT 3::smallint,lpad(e.uf_code::text,2,'0'),'SIOPE',t.yr,t.component,t.code,t.stg,count(*)::int,sum(t.amount)::bigint FROM t JOIN civica_exec.exec_entity e ON e.entity_id=t.entity_id WHERE e.kind=4 GROUP BY e.uf_code,t.yr,t.component,t.code,t.stg`);
    const count = Number((await c.query('SELECT count(*)::int n FROM p108_finance_rollup')).rows[0]!.n);
    await c.query('DELETE FROM civica_exec.exec_edu_finance_rollup');
    await c.query('INSERT INTO civica_exec.exec_edu_finance_rollup SELECT * FROM p108_finance_rollup');
    await c.query(`INSERT INTO civica_exec.exec_edu_analytics_meta
      (materialization, refreshed_at, source_contract_rows, source_class_rows, source_fingerprint, details)
      VALUES ('education_finance_rollup_v1', clock_timestamp(), 0, 0, md5($1), jsonb_build_object('rollup_rows', $2::int))
      ON CONFLICT (materialization) DO UPDATE SET refreshed_at=excluded.refreshed_at, source_fingerprint=excluded.source_fingerprint, details=excluded.details`, [String(count), count]);
    const refreshedAt = new Date().toISOString(); await c.query('COMMIT');
    return { materialization: 'education_finance_rollup_v1', refreshedAt, rollupRows: count };
  } catch (error) { try { await c.query('ROLLBACK'); } catch {} throw error; }
  finally { try { await c.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', ['civica_exec:p108:education_finance_rollup_v1']); } catch {} c.release(); }
}
