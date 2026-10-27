import { openPool } from './db.ts';
import { applyExecMigrations, refreshEducationCompactServing } from '../../packages/db/src/exec/index.ts';

const p = openPool(8);
try {
  const applied = await applyExecMigrations(p);
  const refresh = await refreshEducationCompactServing(p, 2025);
  const bytes = Number((await p.query(`SELECT pg_total_relation_size('civica_exec.exec_edu_overview_rollup') + pg_total_relation_size('civica_exec.exec_edu_series_rollup') bytes`)).rows[0].bytes);
  console.log(JSON.stringify({ applied, refresh, compactBytes: bytes }, null, 2));
} finally { await p.end(); }
