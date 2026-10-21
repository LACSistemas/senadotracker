import type { Pool } from 'pg';
import { EXEC_DDL_V1 } from './ddl-v1.ts';

export interface ExecMigration { version: number; name: string; sql: string }
export const EXEC_MIGRATIONS: ExecMigration[] = [
  { version: 1, name: 'civica_exec_ddl_v1_revisao2', sql: EXEC_DDL_V1 },
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
