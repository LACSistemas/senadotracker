import { openPool } from './db.ts';
const p = openPool(1);
console.log((await p.query("select table_name,column_name,data_type from information_schema.columns where table_schema='civica_exec' and table_name in ('exec_ind_value','exec_ind_latest','exec_ind_def') order by table_name,ordinal_position")).rows);
console.log((await p.query("select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='civica_exec.exec_ind_value'::regclass")).rows);
await p.end();
