import {openPool} from './db.ts';
const p=openPool(1);
console.log((await p.query("select current_database() db, count(*) filter(where indicator_id between 9701 and 9952)::int defs from civica_exec.exec_ind_def")).rows);
console.log((await p.query("select dataset_id,count(*)::int pubs from civica_exec.exec_publication where dataset_id between 146 and 149 group by dataset_id order by dataset_id")).rows);
console.log((await p.query("select indicator_id,count(*)::int rows,count(distinct entity_id)::int entities from civica_exec.exec_ind_value where indicator_id>=9701 group by indicator_id order by indicator_id")).rows);
await p.end();
