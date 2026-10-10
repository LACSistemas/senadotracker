import pg from 'pg';const p=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'civica_postgres_lab'});
const q=`select house,provider,lower(trim(author_raw)) raw,count(*)::int n from civica_state.proposal_authors where house in ('SP','SC','MG','PE') and person_external_id is null group by house,provider,lower(trim(author_raw)) order by n desc limit 200`;
console.log(JSON.stringify((await p.query(q)).rows,null,2));await p.end();
