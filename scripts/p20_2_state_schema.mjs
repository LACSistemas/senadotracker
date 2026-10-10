import pg from 'pg'; const p=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'civica_postgres_lab'});
const t=['public_domain_revisions','public_revision_contributions','ingestion_runs','active_publications','proposals','proposal_authors','raw_objects'];
for(const x of t){const r=await p.query(`select column_name,data_type,is_nullable from information_schema.columns where table_schema='civica_state' and table_name=$1 order by ordinal_position`,[x]);console.log(x,r.rows)} await p.end();
