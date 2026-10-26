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
