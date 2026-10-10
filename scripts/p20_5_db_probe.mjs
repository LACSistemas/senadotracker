import {readFileSync} from 'node:fs';
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
import pg from 'pg';
const p=new pg.Pool({host:env.DB_HOST,port:+(env.DB_PORT||5432),user:env.DB_USER,password:env.DB_PASSWORD,database:'civica_postgres_lab'});const c=await p.connect();
for(const t of ['civica_state.proposals','civica_state.proposal_authors','civica_state.profiles','civica_state.active_publications','civica_state.publication_profiles']){try{let r=await c.query(`select column_name,data_type from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position`,t.split('.')[0],t.split('.')[1]);console.log(t,r.rows)}catch(e){console.log(t,String(e))}}
await c.release();await p.end();
