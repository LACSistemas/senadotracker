import { openPool } from './db.ts';
const pool = openPool(1);
try {
  const d = await pool.query(`SELECT indicator_id, code, label, unit, grain, ranking_allowed, aggregation_allowed, null_semantics FROM civica_exec.exec_ind_def WHERE domain=4 ORDER BY indicator_id`);
  console.log(JSON.stringify(d.rows, null, 2));
} finally { await pool.end(); }
