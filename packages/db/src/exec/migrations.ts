import type { Pool } from 'pg';
import { EXEC_DDL_V1 } from './ddl-v1.ts';
import { EXEC_DDL_V2 } from './ddl-v2.ts';
import { EXEC_DDL_V3 } from './ddl-v3.ts';
import { EXEC_DDL_V4 } from './ddl-v4.ts';
import { EXEC_DDL_V5 } from './ddl-v5.ts';
import { EXEC_DDL_V6 } from './ddl-v6.ts';
import { EXEC_DDL_V7 } from './ddl-v7.ts';
import { EXEC_DDL_V8 } from './ddl-v8.ts';
import { EXEC_DDL_V9 } from './ddl-v9.ts';
import { EXEC_DDL_V10 } from './ddl-v10.ts';
import { EXEC_DDL_V11 } from './ddl-v11.ts';
import { EXEC_DDL_V12 } from './ddl-v12.ts';
import { EXEC_DDL_V13 } from './ddl-v13.ts';
import { EXEC_DDL_V14 } from './ddl-v14.ts';
import { EXEC_DDL_V15 } from './ddl-v15.ts';
import { EXEC_DDL_V16 } from './ddl-v16.ts';
import { EXEC_DDL_V17 } from './ddl-v17.ts';
import { EXEC_DDL_V18 } from './ddl-v18.ts';
import { EXEC_DDL_V19 } from './ddl-v19.ts';
import { EXEC_DDL_V20 } from './ddl-v20.ts';
import { EXEC_DDL_V21 } from './ddl-v21.ts';
import { EXEC_DDL_V22 } from './ddl-v22.ts';
import { EXEC_DDL_V23 } from './ddl-v23.ts';
import { EXEC_DDL_V24 } from './ddl-v24.ts';
import { EXEC_DDL_V25 } from './ddl-v25.ts';
import { EXEC_DDL_V26 } from './ddl-v26.ts';
import { EXEC_DDL_V27 } from './ddl-v27.ts';
import { EXEC_DDL_V28 } from './ddl-v28.ts';
import { EXEC_DDL_V29 } from './ddl-v29.ts';
import { EXEC_DDL_V30 } from './ddl-v30.ts';
import { EXEC_DDL_V31 } from './ddl-v31.ts';
import { EXEC_DDL_V32 } from './ddl-v32.ts';
import { EXEC_DDL_V33 } from './ddl-v33.ts';
import { EXEC_DDL_V34 } from './ddl-v34.ts';
import { EXEC_DDL_V35 } from './ddl-v35.ts';
import { EXEC_DDL_V36 } from './ddl-v36.ts';
import { EXEC_DDL_V37 } from './ddl-v37.ts';
import { EXEC_DDL_V38 } from './ddl-v38.ts';
import { EXEC_DDL_V39 } from './ddl-v39.ts';
import { EXEC_DDL_V40 } from './ddl-v40.ts';
import { EXEC_DDL_V41 } from './ddl-v41.ts';
import { EXEC_DDL_V42 } from './ddl-v42.ts';
import { EXEC_DDL_V43 } from './ddl-v43.ts';
import { EXEC_DDL_V44 } from './ddl-v44.ts';
import { EXEC_DDL_V45 } from './ddl-v45.ts';
import { EXEC_DDL_V46 } from './ddl-v46.ts';
import { EXEC_DDL_V47 } from './ddl-v47.ts';

export interface ExecMigration { version: number; name: string; sql: string }
export const EXEC_MIGRATIONS: ExecMigration[] = [
  { version: 1, name: 'civica_exec_ddl_v1_revisao2', sql: EXEC_DDL_V1 },
  { version: 2, name: 'civica_exec_ddl_v2_seguranca_cobertura_vde', sql: EXEC_DDL_V2 },
  { version: 3, name: 'civica_exec_ddl_v3_transito', sql: EXEC_DDL_V3 },
  { version: 4, name: 'civica_exec_ddl_v4_prisional', sql: EXEC_DDL_V4 },
  { version: 5, name: 'civica_exec_ddl_v5_financas_seguranca', sql: EXEC_DDL_V5 },
  { version: 6, name: 'civica_exec_ddl_v6_contratos_transferencias', sql: EXEC_DDL_V6 },
  { version: 7, name: 'civica_exec_ddl_v7_refcode_sequence', sql: EXEC_DDL_V7 },
  { version: 8, name: 'civica_exec_ddl_v8_criminalidade_estadual', sql: EXEC_DDL_V8 },
  { version: 9, name: 'civica_exec_ddl_v9_educacao_escolas', sql: EXEC_DDL_V9 },
  { version: 10, name: 'civica_exec_ddl_v10_educacao_oferta', sql: EXEC_DDL_V10 },
  { version: 11, name: 'civica_exec_ddl_v11_educacao_infraestrutura', sql: EXEC_DDL_V11 },
  { version: 12, name: 'civica_exec_ddl_v12_educacao_indicadores_inep', sql: EXEC_DDL_V12 },
  { version: 13, name: 'civica_exec_ddl_v13_educacao_aprendizagem', sql: EXEC_DDL_V13 },
  { version: 14, name: 'civica_exec_ddl_v14_financas_educacao_siope', sql: EXEC_DDL_V14 },
  { version: 15, name: 'civica_exec_ddl_v15_programas_transferencias_educacionais', sql: EXEC_DDL_V15 },
  { version: 16, name: 'civica_exec_ddl_v16_educacao_contratacoes_obras', sql: EXEC_DDL_V16 },
  { version: 17, name: 'civica_exec_ddl_v17_educacao_inteligencia', sql: EXEC_DDL_V17 },
  { version: 18, name: 'civica_exec_ddl_v18_program_rollup_performance', sql: EXEC_DDL_V18 },
  { version: 19, name: 'civica_exec_ddl_v19_finance_rollup_performance', sql: EXEC_DDL_V19 },
  { version: 20, name: 'civica_exec_ddl_v20_program_municipality_identity', sql: EXEC_DDL_V20 },
  { version: 21, name: 'civica_exec_ddl_v21_compact_education_serving', sql: EXEC_DDL_V21 },
  { version: 22, name: 'civica_exec_ddl_v22_educacao_superior', sql: EXEC_DDL_V22 },
  { version: 23, name: 'civica_exec_ddl_v23_educacao_qualidade_superior', sql: EXEC_DDL_V23 },
  { version: 24, name: 'civica_exec_ddl_v24_programas_acesso_superior', sql: EXEC_DDL_V24 },
  { version: 25, name: 'civica_exec_ddl_v25_capes_sucupira', sql: EXEC_DDL_V25 },
  { version: 26, name: 'civica_exec_ddl_v26_enem', sql: EXEC_DDL_V26 },
  { version: 27, name: 'civica_exec_ddl_v27_obrasgov_works', sql: EXEC_DDL_V27 },
  { version: 28, name: 'civica_exec_ddl_v28_obrasgov_compact_serving', sql: EXEC_DDL_V28 },
  { version: 29, name: 'civica_exec_ddl_v29_dams_atlas', sql: EXEC_DDL_V29 },
  { version: 30, name: 'civica_exec_ddl_v30_energia_expandida', sql: EXEC_DDL_V30 },
  { version: 31, name: 'civica_exec_ddl_v31_energia_tarifas_compactas', sql: EXEC_DDL_V31 },
  { version: 32, name: 'civica_exec_ddl_v32_energia_tarifas_storage_gate', sql: EXEC_DDL_V32 },
  { version: 33, name: 'civica_exec_ddl_v33_energia_tarifas_hash_compact', sql: EXEC_DDL_V33 },
  { version: 34, name: 'civica_exec_ddl_v34_logistica_nacional_compact', sql: EXEC_DDL_V34 },
  { version: 35, name: 'civica_exec_ddl_v35_obras_integracao_evidencias', sql: EXEC_DDL_V35 },
  { version: 36, name: 'civica_exec_ddl_v36_infra_serving_nacional', sql: EXEC_DDL_V36 },
  { version: 37, name: 'civica_exec_ddl_v37_infra_indicator_ownership', sql: EXEC_DDL_V37 },
  { version: 38, name: 'civica_exec_ddl_v38_infra_serving_rollups', sql: EXEC_DDL_V38 },
  { version: 39, name: 'civica_exec_ddl_v39_distinct_territory_rollups', sql: EXEC_DDL_V39 },
  { version: 40, name: 'civica_exec_ddl_v40_gdp_territory', sql: EXEC_DDL_V40 },
  { version: 41, name: 'civica_exec_ddl_v41_executive_mandate', sql: EXEC_DDL_V41 },
  { version: 42, name: 'civica_exec_ddl_v42_idhm_territory', sql: EXEC_DDL_V42 },
  { version: 43, name: 'civica_exec_ddl_v43_executive_mandate_municipal', sql: EXEC_DDL_V43 },
  { version: 44, name: 'civica_exec_ddl_v44_executive_mandate_reelection', sql: EXEC_DDL_V44 },
  { version: 45, name: 'civica_exec_ddl_v45_executive_mandate_federal', sql: EXEC_DDL_V45 },
  { version: 46, name: 'civica_exec_ddl_v46_hdi_global', sql: EXEC_DDL_V46 },
  { version: 47, name: 'civica_exec_ddl_v47_pisa_score', sql: EXEC_DDL_V47 },
];

/** Aplica as migrations do schema civica_exec de forma idempotente (lock consultivo + uma transação por versão). Nunca toca outros schemas. */
export async function applyExecMigrations(pool: Pool): Promise<number[]> {
  const c = await pool.connect();
  const applied: number[] = [];
  try {
    await c.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', ['civica_exec:migrations']);
    await c.query('CREATE SCHEMA IF NOT EXISTS civica_exec');
    await c.query('CREATE TABLE IF NOT EXISTS civica_exec.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT version FROM civica_exec.schema_migrations')).rows.map(r => Number(r.version)));
    for (const m of EXEC_MIGRATIONS) {
      if (done.has(m.version)) continue;
      try {
        await c.query('BEGIN');
        await c.query(m.sql);
        await c.query('INSERT INTO civica_exec.schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
        await c.query('COMMIT');
        applied.push(m.version);
      } catch (error) { await c.query('ROLLBACK'); throw error; }
    }
    return applied;
  } finally {
    try { await c.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', ['civica_exec:migrations']); } catch { /* conexão encerrada */ }
    c.release();
  }
}
