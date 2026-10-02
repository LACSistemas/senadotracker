import pg from 'pg'; import { readFileSync } from 'node:fs';
const e=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
console.log(await p.query(`select id,status,expected_count,reconciliation_json from civica.ingestion_runs where id in ('pg-house-operations:senado:2026','pg-house-operations:camara:2026') order by id`));
console.log(await p.query(`select count(*)::int n,count(distinct sha256)::int hashes from civica.raw_objects where id like 'pgraw:%'`));
console.log(await p.query(`select count(*)::int n from civica.active_complement_publications where scope in ('house-operations-2026','senate-commission-agenda-2026','camara-agenda-2026')`)); await p.end();
