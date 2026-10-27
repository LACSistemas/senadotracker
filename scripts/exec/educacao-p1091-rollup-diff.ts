import { openPool } from './db.ts';
const p = openPool(2);
try {
  const counts = (await p.query(`SELECT source_dataset,count(*)::int n FROM civica_exec.exec_edu_program_rollup GROUP BY source_dataset`)).rows;
  const other = (await p.query(`SELECT source_dataset,scope,scope_key,year,month,program_code,financial_stage,rows,amount_cents FROM civica_exec.exec_edu_program_rollup WHERE source_dataset != 'portal_transferencias' ORDER BY source_dataset,scope,scope_key,year,month,program_code,financial_stage`)).rows;
  console.log(JSON.stringify({ counts, other }, null, 2));
} finally { await p.end(); }
