import { openPool } from './db.ts';
const pool = openPool(1);
try {
  const r = await pool.query(`SELECT indicator_id, extract(year from period_start)::int y, sum(value)::int s FROM civica_exec.exec_ind_value WHERE entity_id = 2611606 AND indicator_id IN (3101, 8501, 3001, 3011) AND period_start >= '2024-01-01' AND period_start < '2026-01-01' GROUP BY 1,2 ORDER BY 1,2`);
  console.log(JSON.stringify(r.rows));
  const d = await pool.query(`SELECT indicator_id, code FROM civica_exec.exec_ind_def WHERE indicator_id BETWEEN 8501 AND 8513 ORDER BY 1`); console.log(JSON.stringify(d.rows.map(x => x.indicator_id + ':' + x.code)));
} finally { await pool.end(); }
