import {openPool} from './db.ts';
const p=openPool(1);
console.log((await p.query("select current_database() db,pg_database_size(current_database())::bigint bytes,pg_total_relation_size('civica_exec.exec_ind_value')::bigint values_bytes")).rows);
console.log((await p.query("select d.indicator_id,d.code,count(v.*)::int rows,count(distinct v.entity_id)::int entities,count(*) filter(where v.value is null)::int nulls from civica_exec.exec_ind_def d left join civica_exec.exec_ind_value v using(indicator_id) where d.indicator_id between 9701 and 9952 group by d.indicator_id,d.code order by d.indicator_id")).rows);
console.log((await p.query("select dataset_id,count(*)::int slices,sum(row_count)::bigint rows,min(run_id) min_run,max(run_id) max_run from civica_exec.exec_publication where dataset_id between 146 and 149 group by dataset_id order by dataset_id")).rows);
await p.end();
