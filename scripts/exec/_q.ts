import { openPool } from './db.ts';
const p = openPool();
const sql = process.argv[2]!;
const r = await p.query(sql); console.log(JSON.stringify(r.rows, null, 0)); await p.end();
