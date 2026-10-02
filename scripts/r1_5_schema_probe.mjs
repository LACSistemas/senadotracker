import pg from 'pg'; import {readFileSync} from 'node:fs';
const e=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]})); const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
for(const [s,t] of [['civica_poc','proposals'],['civica_poc','proposal_detail_atoms'],['civica','raw_objects'],['civica','ingestion_runs']]){console.log(s+'.'+t,await p.query('select column_name,data_type from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position',[s,t]));}
console.log('proposal sample',await p.query(`select * from civica_poc.proposals where source='senado' limit 2`));
await p.end();
