import pg from 'pg';
const p=new pg.Pool({host:process.env.DB_HOST||'localhost',port:process.env.DB_PORT||5432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'civica_postgres_lab'});
for(const h of ['RO','AC','AL','PI','TO','RR']){const x=await p.query('select house,revision_id,count(*)::int n from civica_state.persons where house=$1 group by house,revision_id order by revision_id desc limit 3',[h]);console.log(h,x.rows)}
console.log((await p.query("select house,domain,revision_id from civica_state.active_publications where house=any($1) order by house,domain",[['RO','AC','AL','PI','TO','RR']])).rows)
for(const h of ['RO','AC','AL','PI']){const x=await p.query("select external_id,name,raw_id,provenance from civica_state.persons where house=$1 and revision_id=(select revision_id from civica_state.active_publications where house=$1 and domain='identity') limit 3",[h]);console.log('sample',h,x.rows)}
await p.end();
