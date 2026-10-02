import pg from 'pg'; import fs from 'node:fs'; const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]})); const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
for(const t of ['civica_poc.proposals','civica_poc.proposal_detail_atoms','civica.legislative_complements','civica_poc.proposal_authors']){const cols=await p.query(`select column_name,data_type from information_schema.columns where table_schema=split_part($1,'.',1) and table_name=split_part($1,'.',2) order by ordinal_position`,[t]); console.log('COLS',t,cols.rows)}
for(const q of [
`select source,count(*)::int n,count(*) filter(where payload::text ilike '%tema%' or payload::text ilike '%topic%')::int themed from civica_poc.proposals group by source`,
`select source,count(*)::int n,count(*) filter(where payload::text ilike '%tema%' or payload::text ilike '%topic%')::int themed from civica_poc.proposal_detail_atoms group by source`,
`select source,kind,count(*)::int n from civica.legislative_complements where kind='theme' group by source`,
`select source,count(*)::int n,count(*) filter(where payload::text ilike '%tema%' or payload::text ilike '%topic%')::int themed from civica_poc.proposal_authors group by source`
]) { try { console.log((await p.query(q)).rows); } catch(e) { console.log('ERR',e.message); } }
for(const q of [`select source,kind,count(*)::int n from civica_poc.proposal_detail_atoms group by source,kind order by source,n desc`, `select source,kind,proposal_id,payload from civica_poc.proposal_detail_atoms where payload::text ilike '%tema%' or payload::text ilike '%topic%' limit 10`]) console.log((await p.query(q)).rows);
await p.end();
