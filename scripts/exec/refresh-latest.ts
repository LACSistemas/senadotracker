import { refreshLatest } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';
/** Recalcula exec_ind_latest (definitivo mais recente; sem definitivo, o preliminar mais recente) para todos os pares existentes. Idempotente. */
const pool = openPool(2); const c = await pool.connect();
try {
  await c.query('BEGIN');
  const pairs = (await c.query('SELECT DISTINCT indicator_id, entity_id FROM civica_exec.exec_ind_value')).rows;
  for (const p of pairs) await refreshLatest(c, p.indicator_id, p.entity_id);
  await c.query('COMMIT'); console.log('pares recalculados:', pairs.length);
} catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); await pool.end(); }
