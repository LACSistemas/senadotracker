import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:process.env.DB_USER??'projetoeleitor_user',password:process.env.DB_PASSWORD??'projetoeleitorsenha'});
console.log((await p.query("select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='civica_state' and table_name in ('expenses','public_domain_revisions','active_publications','ingestion_runs','ingestion_revisions','public_revision_contributions') order by table_name,ordinal_position")).rows);
await p.end();
