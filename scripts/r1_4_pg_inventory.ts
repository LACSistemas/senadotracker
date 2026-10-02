import pg from 'pg';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]}));
const pool=new pg.Pool({host:env.DB_HOST??'localhost',port:Number(env.DB_PORT??5432),database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD});
const q=async(sql:string,values:unknown[]=[])=> (await pool.query(sql,values)).rows;
console.log({database:(await q('select current_database(), current_schema(), current_setting(\'search_path\')'))[0]});
for(const rel of ['civica.complement_batches','civica.legislative_complements','civica.active_complement_publications','civica_poc.proposal_detail_atoms','civica_committees_poc.agenda_items','civica_committees_poc.meetings']){
  console.log(rel,await q(`select column_name,data_type from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position`,[rel.split('.')[0],rel.split('.')[1]]));
}
console.log('active complements',await q(`select source,scope,batch_id from civica.active_complement_publications order by source,scope`));
console.log('house operation rows',await q(`select count(*)::int n from civica.legislative_complements where external_key like 'house-operations:%'`));
console.log('batches',await q(`select id,source,scope,record_count,reconciliation_json from civica.complement_batches order by published_at desc limit 20`));
const fs=await import('node:fs/promises');
const raw=JSON.parse(await fs.readFile('data/cache/senate-active-matters.json','utf8'));
const list=raw?.PesquisaBasicaMateria?.Materias?.Materia; const ids=(Array.isArray(list)?list:[list]).filter(Boolean).map((x:any)=>String(x.Codigo));
console.log('official cache ids',ids.length);
console.log('pg terminal intersections',await q(`WITH ids AS (SELECT unnest($1::text[]) id), ev AS (SELECT DISTINCT proposal_id::text id FROM civica_poc.proposal_detail_atoms WHERE source='senado' AND proposal_id IS NOT NULL AND kind='resulting_norm' AND occurred_at >= '2026-01-01' AND occurred_at < '2027-01-01') SELECT count(*)::int all_terminal,count(*) FILTER(WHERE ids.id IS NOT NULL)::int in_official FROM ev LEFT JOIN ids ON ids.id=ev.id`,[ids]));
console.log('pg terminal sample',await q(`WITH ids AS (SELECT unnest($1::text[]) id), ev AS (SELECT DISTINCT proposal_id::text id FROM civica_poc.proposal_detail_atoms WHERE source='senado' AND proposal_id IS NOT NULL AND kind='resulting_norm' AND occurred_at >= '2026-01-01' AND occurred_at < '2027-01-01') SELECT ev.id,ids.id IS NOT NULL in_official FROM ev LEFT JOIN ids ON ids.id=ev.id ORDER BY ev.id LIMIT 20`,[ids]));
await pool.end();
