import { openPool } from './db.ts';
const p = openPool(1);
const r = await p.query(`update civica_exec.exec_raw_manifest set rel_path=regexp_replace(rel_path,'^raw/raw/','raw/') where rel_path like 'raw/raw/bem-estar/trabalho/%'`);
console.log(JSON.stringify({updated: r.rowCount}));
await p.end();
