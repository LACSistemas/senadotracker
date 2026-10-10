import pg from 'pg'; import fs from 'node:fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,user:e.DB_USER,password:e.DB_PASSWORD,database:'civica_postgres_lab'});const c=await p.connect();
console.log((await c.query('select current_database() db')).rows);
console.log((await c.query("select ap.house,ap.revision_id,count(distinct pr.external_id)::int proposals,count(pa.*)::int authors from civica_state.active_publications ap left join civica_state.proposals pr on pr.house=ap.house and pr.revision_id=ap.revision_id left join civica_state.proposal_authors pa on pa.house=ap.house and pa.revision_id=ap.revision_id where ap.domain='legislative' and ap.house in ('ES','BA','GO','RS','MA','MS','MT') group by ap.house,ap.revision_id order by ap.house")).rows);
await c.release();await p.end();

