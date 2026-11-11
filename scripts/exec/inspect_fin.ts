import {openPool} from './db.ts';
const p=openPool(1);
console.log((await p.query(`select column_name,data_type from information_schema.columns where table_schema='civica_exec' and table_name='exec_fin_exec' order by ordinal_position`)).rows);
await p.end();
