import { openPool } from './db.ts';
const p = openPool(2);
for (const q of [
  `select table_name,column_name,data_type,is_nullable,column_default,is_identity,identity_generation from information_schema.columns where table_schema='civica_exec' and table_name in ('exec_ingestion_run','exec_raw_manifest','exec_publication','exec_ind_def','exec_ind_value') order by table_name,ordinal_position`,
  `select dataset_id,count(*) from civica_exec.exec_publication group by dataset_id order by dataset_id`,
  `select domain,max(indicator_id) from civica_exec.exec_ind_def group by domain order by domain`,
]) console.log(JSON.stringify((await p.query(q)).rows));
console.log(JSON.stringify((await p.query(`select kind,count(*) from civica_exec.exec_entity group by kind order by kind`)).rows));
console.log(JSON.stringify((await p.query(`select entity_id,ibge7,name from civica_exec.exec_entity where kind=4 and name ilike '%Boa Esperan%'`)).rows));
console.log(JSON.stringify((await p.query(`select entity_id,kind,uf_code,ibge7,name from civica_exec.exec_entity where ibge7 in (110001,3205309,5300108) or kind=1 or (kind=3 and uf_code=11) limit 8`)).rows));
console.log(JSON.stringify((await p.query(`select count(*) from civica_exec.exec_entity where kind=4 and ibge7=110001`)).rows));
console.log(JSON.stringify((await p.query(`select entity_id,ibge7,name from civica_exec.exec_entity where kind=4 order by ibge7 limit 10`)).rows));
console.log(JSON.stringify((await p.query(`select indicator_id,count(*)::int rows,min(period_start) first,max(period_start) last from civica_exec.exec_ind_value where indicator_id between 9401 and 9503 group by indicator_id order by indicator_id`)).rows));
console.log(JSON.stringify((await p.query(`select dataset_id,count(*)::int slices from civica_exec.exec_publication where dataset_id in (122,123) group by dataset_id order by dataset_id`)).rows));
console.log(JSON.stringify((await p.query(`select pg_database_size(current_database())::bigint bytes`)).rows));
console.log(JSON.stringify((await p.query(`select count(*)::int total, count(*) filter (where a.value-d.value=b.value)::int exact, count(*) filter (where a.value-d.value<>b.value)::int mismatch from civica_exec.exec_ind_value a join civica_exec.exec_ind_value d on d.entity_id=a.entity_id and d.period_start=a.period_start and d.indicator_id=9502 join civica_exec.exec_ind_value b on b.entity_id=a.entity_id and b.period_start=a.period_start and b.indicator_id=9503 where a.indicator_id=9501`)).rows));
console.log(JSON.stringify((await p.query(`select indicator_id,period_start,count(*)::int rows,count(distinct entity_id)::int entities from civica_exec.exec_ind_value where indicator_id between 9500 and 9503 group by indicator_id,period_start order by indicator_id,period_start`)).rows));
console.log(JSON.stringify((await p.query(`select d.code,count(v.*)::int rows,count(distinct v.entity_id)::int entities from civica_exec.exec_ind_def d left join civica_exec.exec_ind_value v using(indicator_id) where d.indicator_id between 9401 and 9503 group by d.code order by d.code`)).rows));
console.log(JSON.stringify((await p.query(`select e.ibge7,e.name,a.period_start,a.value adm,d.value dis,b.value bal,(a.value-d.value-b.value) delta from civica_exec.exec_ind_value a join civica_exec.exec_ind_value d on d.entity_id=a.entity_id and d.period_start=a.period_start and d.indicator_id=9502 join civica_exec.exec_ind_value b on b.entity_id=a.entity_id and b.period_start=a.period_start and b.indicator_id=9503 join civica_exec.exec_entity e on e.entity_id=a.entity_id where a.indicator_id=9501 and a.value-d.value<>b.value limit 10`)).rows));
console.log(JSON.stringify((await p.query(`select indicator_id,extract(year from period_start)::int yr,sum(value)::numeric total from civica_exec.exec_ind_value where indicator_id in(9401,9402) group by indicator_id,yr order by indicator_id,yr`)).rows));
await p.end();
