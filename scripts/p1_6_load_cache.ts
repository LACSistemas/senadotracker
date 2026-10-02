import {DatabaseSync} from 'node:sqlite'; import fs from 'node:fs'; const env:any={DB_PASSWORD:fs.readFileSync('.env','utf8').match(/DB_PASSWORD=(.*)/)?.[1]?.trim()}; import pg from 'pg'; import {publishedProposition} from '../packages/db/src/propositions.ts';
const s=new DatabaseSync('artifacts/postgres-parity/senadotracker-parity.sqlite',{readOnly:true}); const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:env.DB_PASSWORD}); const c=await p.connect(); await c.query(`CREATE TABLE IF NOT EXISTS civica_poc.proposal_detail_cache (source text NOT NULL, proposal_id text NOT NULL, detail jsonb NOT NULL, PRIMARY KEY(source,proposal_id))`); const rows:any[]=s.prepare("SELECT DISTINCT p.source,p.external_id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE p.external_id IN (SELECT proposal_id FROM legislative_complements) ORDER BY p.source,p.external_id LIMIT 300").all(); for(const x of rows){const d=publishedProposition(s,x.source,x.external_id); await c.query(`INSERT INTO civica_poc.proposal_detail_cache VALUES($1,$2,$3) ON CONFLICT(source,proposal_id) DO UPDATE SET detail=excluded.detail`,[x.source,x.external_id,JSON.stringify(d)]);} console.log({rows:rows.length}); c.release(); await p.end(); s.close();






