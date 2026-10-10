import pg from 'pg';
const DB='civica_postgres_lab';
const p=new pg.Pool({host:process.env.DB_HOST,port:process.env.DB_PORT||5432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:DB});
if((await p.query('select current_database() db')).rows[0].db!==DB) throw Error('wrong database');
await p.query('alter table civica_state.proposal_authors add column if not exists actor_type_raw text');
await p.query('alter table civica_state.proposal_authors add column if not exists actor_type_canonical text');
await p.query("update civica_state.proposal_authors set actor_type_raw=coalesce(actor_type_raw,actor_type), actor_type_canonical=coalesce(actor_type_canonical,case when lower(coalesce(actor_type,'')) in ('person','parliamentarian','deputy','senator') then 'PERSON' when lower(coalesce(actor_type,'')) in ('institution','collective','organization','commission') then 'INSTITUTION' else 'OTHER' end)");
console.log(JSON.stringify((await p.query("select count(*)::int total,count(*) filter(where actor_type_raw is not null)::int with_raw,count(*) filter(where actor_type_canonical is not null)::int with_canonical from civica_state.proposal_authors")).rows[0]));
await p.end();
