import pg from 'pg'; import {writeFileSync} from 'node:fs';
const pool=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'civica_postgres_lab'});
const out={};
out.actor=(await pool.query(`select house,provider,actor_type,count(*)::int n,count(person_external_id)::int linked,count(*) filter(where person_external_id is null)::int unresolved from civica_state.proposal_authors group by house,provider,actor_type order by house,provider,actor_type`)).rows;
out.nullSamples=(await pool.query(`select house,provider,actor_type,author_raw,role,organization_external_id,actor_external_key from civica_state.proposal_authors where person_external_id is null and house in ('SP','SC') limit 50`)).rows;
out.raw=(await pool.query(`select resource,endpoint,count(*)::int n from civica_state.raw_objects group by resource,endpoint order by n desc limit 300`)).rows;
writeFileSync('artifacts/p20_2_probe.json',JSON.stringify(out,null,2)); console.log(JSON.stringify(out.actor,null,2)); await pool.end();
