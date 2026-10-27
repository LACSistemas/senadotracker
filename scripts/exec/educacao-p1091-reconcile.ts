import { openPool } from './db.ts';
const p = openPool(2);
try {
  const rows = (await p.query(`WITH f AS (
    SELECT f.*,m.status map_status FROM civica_exec.exec_edu_program_fact f LEFT JOIN civica_exec.exec_edu_program_municipality_map m ON m.source_dataset=f.source_dataset AND m.year=f.year AND m.uf=f.uf AND m.municipality_siafi=f.municipality_siafi
    WHERE f.source_dataset='portal_transferencias'
  ) SELECT CASE WHEN municipality_siafi IS NULL THEN 'NO_MUNICIPAL_CODE' WHEN map_status='UNRESOLVED' THEN 'UNRESOLVED_CODE' WHEN map_status='AMBIGUOUS' THEN 'AMBIGUOUS_CODE' WHEN map_status='LINKED' THEN 'LINKED_MUNICIPAL' ELSE 'UNCLASSIFIED' END category,count(*)::int rows,coalesce(sum(amount_cents),0)::bigint amount_cents FROM f GROUP BY 1 ORDER BY 1`)).rows;
  const total = (await p.query(`SELECT count(*)::int rows,coalesce(sum(amount_cents),0)::bigint amount_cents FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias'`)).rows[0];
  console.log(JSON.stringify({ total, rows }, null, 2));
} finally { await p.end(); }
