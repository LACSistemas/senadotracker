import pg from 'pg'; import fs from 'node:fs'; const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]})); const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
for(const q of [
`select table_schema,table_name from information_schema.tables where table_schema='civica' and table_name ilike '%staff%'`,
`select column_name from information_schema.columns where table_schema='civica' and table_name='staff_snapshot_batches' order by ordinal_position`,
`select * from civica.staff_snapshot_batches order by 1 limit 20`,
`select * from civica.active_staff_snapshot_publications order by 1`,
`select source,batch_id,count(*)::int n,min(observed_at) minobs,max(observed_at) maxobs from civica.functional_staff_assignments group by 1,2 order by 1,2`
]){try{console.log((await p.query(q)).rows)}catch(err){console.log('ERR',err.message)}} await p.end();
