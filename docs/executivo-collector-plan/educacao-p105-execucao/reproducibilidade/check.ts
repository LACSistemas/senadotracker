import { openPool } from '../../../../scripts/exec/db.ts';
import { getEducationFinanceSummary, getSiopeEducationSummary, getEducationFinanceCoverage } from '../../../../packages/db/src/exec/index.ts';
const p = openPool(2);
console.log((await p.query(`SELECT current_database() db, pg_database_size(current_database())::bigint size,
 (SELECT count(*) FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code c ON c.ref_id=f.conta_id AND c.domain=30 WHERE c.code='12') fn12_facts,
 (SELECT count(*) FROM civica_exec.exec_edu_siope_fact) siope_facts`)).rows);
console.log(await getEducationFinanceSummary(p, 2024, 32));
console.log((await getSiopeEducationSummary(p, 2024, 32)).rows.slice(0, 10));
console.log(await getEducationFinanceCoverage(p, 2024, 32));
await p.end();
