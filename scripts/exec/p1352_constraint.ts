import { openPool } from './db.ts';
const pool = openPool(2);
console.log((await pool.query("select pg_get_constraintdef(oid) as def from pg_constraint where conrelid='civica_exec.exec_ind_value'::regclass")).rows);
await pool.end();
