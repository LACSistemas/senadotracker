import { openPool } from './db.ts';
const p = openPool(2);
try {
 const r = await p.query(`select program_code,
   count(distinct uf)::int as ufs,
   count(distinct municipality_siafi)::int as municipalities,
   count(distinct beneficiary_code)::int as beneficiaries
   from civica_exec.exec_edu_program_fact
   where source_dataset='portal_transferencias' and year=2025
   group by program_code order by program_code`);
 const s = await p.query(`select count(distinct uf)::int as ufs,
   count(distinct municipality_siafi)::int as municipalities,
   count(distinct school_inep)::int as schools
   from civica_exec.exec_edu_program_fact
   where source_dataset='pdde_info' and year=2025`);
 console.log(JSON.stringify({portal:r.rows,pdde:s.rows}));
} finally { await p.end(); }
