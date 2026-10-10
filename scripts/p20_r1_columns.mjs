import pg from 'pg'; import fs from 'node:fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,user:e.DB_USER,password:e.DB_PASSWORD,database:'civica_postgres_lab'});const c=await p.connect();
for(const t of ['current_state_parliamentarians','proposals','proposal_authors','active_publications','state_rapporteurships','state_meetings','state_attendance','state_deliberations','state_individual_votes','state_proposal_themes']){const r=await c.query("select column_name,data_type from information_schema.columns where table_schema='civica_state' and table_name=$1 order by ordinal_position",[t]);console.log(t,JSON.stringify(r.rows));}await c.release();await p.end();
