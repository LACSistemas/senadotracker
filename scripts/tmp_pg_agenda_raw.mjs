import pg from 'pg'; import fs from 'node:fs'; const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]})); const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
for(const q of [
`select count(*)::int n,max(fetched_at) max_fetched from civica.raw_objects where url ilike '%agendareuniao%' or url ilike '%reuniao%'`,
`select id,url,fetched_at from civica.raw_objects where url ilike '%agendareuniao%' or url ilike '%reuniao%' order by fetched_at desc limit 20`,
`select id,source,scope,record_count,reconciliation_json from civica.complement_batches where source='senado' and scope ilike '%agenda%' order by published_at desc`
]) console.log((await p.query(q)).rows); await p.end();
