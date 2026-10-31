import {openPool} from './db.ts';
const p=openPool(1);
const q=async(s:string)=>console.log((await p.query(s)).rows);
await q("select current_database() database, pg_database_size(current_database())::bigint size");
await q("select table_schema,table_name from information_schema.tables where table_schema='civica_exec' order by table_name");
await q("select table_name from information_schema.tables where table_schema='civica_exec' and (table_name ilike '%work%' or table_name ilike '%pncp%' or table_name ilike '%fin%' or table_name ilike '%payment%' or table_name ilike '%contract%') order by table_name");
await q("select table_name,column_name,data_type from information_schema.columns where table_schema='civica_exec' and (table_name in ('exec_work_c_project','exec_work_c_contract','exec_work_c_commitment','exec_work_c_physical','exec_work_c_location','exec_work_c_history','exec_fin_exec','exec_fin_dot','exec_fin_contract','exec_fin_fact','exec_fin_transfer') or table_name ilike '%pncp%') order by table_name,ordinal_position");
await p.end();
