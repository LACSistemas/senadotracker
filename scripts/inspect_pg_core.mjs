import fs from 'node:fs'; for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
const {webPostgresPool}=await import('../apps/web/lib/postgres-pool.ts'); const pool=webPostgresPool();
for (const schema of ['civica','civica_poc','civica_people_poc','civica_committees_poc','civica_votes_presence_poc']) {
 const ts=await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name',[schema]);
 console.log('SCHEMA',schema);
 for(const t of ts.rows){const c=await pool.query('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',[schema,t.table_name]); const n=await pool.query(`SELECT count(*)::int count FROM ${schema}.${t.table_name}`); console.log(t.table_name,n.rows[0].count,c.rows.map(x=>x.column_name+':'+x.data_type).join(','));}
}
await pool.end();
