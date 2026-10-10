import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'civica_postgres_lab'});
const q=async(sql,params=[])=>{const r=await pool.query(sql,params); console.log(JSON.stringify(r.rows,null,2)); return r.rows;};
try {
 await q(`select current_database(), current_schema()`);
 await q(`select table_name,column_name,data_type from information_schema.columns where table_schema='civica_state' and table_name in ('proposal_authors','proposals','state_meetings','state_attendance','state_deliberations','state_individual_votes','state_proposal_themes') order by table_name,ordinal_position`);
 await q(`select column_name,data_type from information_schema.columns where table_schema='civica_state' and table_name='active_publications' order by ordinal_position`);
 await q(`select * from civica_state.active_publications limit 50`);
 await q(`select house,provider,actor_type,count(*)::int as n,count(person_external_id)::int as with_person,count(*) filter (where person_external_id is null)::int as without_person from civica_state.proposal_authors group by house,provider,actor_type order by house,provider,actor_type`);
 await q(`select house,provider,actor_type,author_raw,role,organization_external_id,actor_external_key,provenance from civica_state.proposal_authors where person_external_id is null order by house,provider limit 30`);
 await q(`select house,provider,revision_id,min(year) min_year,max(year) max_year,count(*)::int n,count(*) filter (where year=2026)::int rows_2026 from civica_state.proposals group by house,provider,revision_id order by house,provider`);
 await q(`select table_schema,table_name from information_schema.tables where table_name ilike '%raw%' order by table_schema,table_name`);
} finally { await pool.end(); }
