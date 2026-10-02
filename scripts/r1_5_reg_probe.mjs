import pg from 'pg'; import {readFileSync} from 'node:fs';
const e=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]}));const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
for(const n of ['civica_poc.proposal_identity_bridge','civica_poc.proposal_aliases','civica.proposal_identity_bridge','civica.legislative_complements']) console.log(n,(await p.query('select to_regclass($1) r',[n])).rows[0]); await p.end();
