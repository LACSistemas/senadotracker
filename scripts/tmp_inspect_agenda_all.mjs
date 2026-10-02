import pg from 'pg';
import fs from 'node:fs';
const e = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x => x.includes('=')).map(x => { const i=x.indexOf('='); return [x.slice(0,i), x.slice(i+1).trim()]; }));
const p = new pg.Pool({host:e.DB_HOST, port:+e.DB_PORT, database:e.DB_NAME, user:e.DB_USER, password:e.DB_PASSWORD});
const ts = await p.query(`select table_schema, table_name from information_schema.tables where table_schema in ('civica','civica_committees_poc','civica_poc') order by 1,2`);
for (const t of ts.rows) if (/agenda|meeting|commission|complement/i.test(t.table_name)) {
  try { const q=await p.query(`select count(*)::int n from ${t.table_schema}.${t.table_name}`); console.log(t, q.rows[0]); } catch (err) { console.log('ERR',t,err.message); }
}
for (const name of ['civica.agenda_meetings','civica.agenda_items','civica.commission_meetings','civica.commission_agenda_items','civica.legislative_complements']) {
  try { const q=await p.query(`select * from ${name} limit 1`); console.log('SAMPLE', name, q.rows[0]); } catch {}
}
await p.end();
