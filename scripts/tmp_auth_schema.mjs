import pg from 'pg';
import fs from 'node:fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]}));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
console.log((await p.query("select column_name,data_type from information_schema.columns where table_schema='civica_poc' and table_name='proposal_authors' order by ordinal_position")).rows);
await p.end();
