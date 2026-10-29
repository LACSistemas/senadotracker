import { openPool } from './db.ts';
const p = openPool(2);
const qs: Record<string,string> = {
  db: `select current_database(),pg_database_size(current_database())::bigint bytes`,
  financeTables: `select table_name from information_schema.tables where table_schema='civica_exec' and table_name like 'exec_fin%' order by table_name`,
  financeFacts: `select count(*)::int rows,count(distinct entity_id)::int entities,min(exercicio)::int first_year,max(exercicio)::int last_year from civica_exec.exec_fin_fact`,
  financeDomains: `select domain,count(*)::int refs from civica_exec.exec_ref_code group by domain order by domain`,
  financeFunction08: `select f.exercicio,count(*)::int rows,count(distinct f.entity_id)::int entities,sum(f.valor)::numeric total from civica_exec.exec_fin_fact f join civica_exec.exec_ref_code c on c.ref_id=f.conta_id where c.code in ('08','FU08') group by f.exercicio order by f.exercicio`,
  financeFunction12: `select f.exercicio,count(*)::int rows,count(distinct f.entity_id)::int entities from civica_exec.exec_fin_fact f join civica_exec.exec_ref_code c on c.ref_id=f.conta_id where c.code in ('12','FU12') group by f.exercicio order by f.exercicio`,
  financeCodes: `select c.code,count(*)::int rows from civica_exec.exec_fin_fact f join civica_exec.exec_ref_code c on c.ref_id=f.conta_id where c.code like '08%' or c.code='08' group by c.code order by c.code`,
  financeStages08: `select f.exercicio,k.code,count(*)::int rows,count(distinct f.entity_id)::int entities from civica_exec.exec_fin_fact f join civica_exec.exec_ref_code c on c.ref_id=f.conta_id join civica_exec.exec_ref_code k on k.ref_id=f.coluna_id where c.code='08' and f.exercicio in(2023,2024,2025) group by f.exercicio,k.code order by f.exercicio,k.code`,
  activeDefs: `select indicator_id,code,label from civica_exec.exec_ind_def where indicator_id>=9400 order by indicator_id`,
  defsSchema: `select column_name,data_type,is_nullable from information_schema.columns where table_schema='civica_exec' and table_name='exec_ind_def' order by ordinal_position`,
  datasetTables: `select table_name from information_schema.tables where table_schema='civica_exec' and table_name like 'exec_dataset%' order by table_name`,
  datasetCols: `select table_name,column_name,data_type from information_schema.columns where table_schema='civica_exec' and table_name in ('exec_dataset_def','exec_dataset') order by table_name,ordinal_position`,
  maxDataset: `select coalesce(max(dataset_id),0)::int max_dataset from civica_exec.exec_publication`,
  muni: `select kind,count(*)::int entities from civica_exec.exec_entity group by kind order by kind`,
  pubs: `select dataset_id,count(*)::int slices from civica_exec.exec_publication group by dataset_id order by dataset_id desc limit 10`,
};
for (const [name,sql] of Object.entries(qs)) console.log(name,JSON.stringify((await p.query(sql)).rows));
await p.end();
