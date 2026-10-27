import { openPool } from './db.ts';
const p = openPool(1);
try {
  await p.query('TRUNCATE civica_exec.exec_edu_finance_rollup');
  await p.query('VACUUM FULL civica_exec.exec_edu_finance_rollup');
  console.log('finance rollup cleared: direct source reads retained');
} finally { await p.end(); }
