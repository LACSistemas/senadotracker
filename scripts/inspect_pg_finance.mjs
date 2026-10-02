import fs from 'node:fs';
for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]]=m[2]; }
const { webPostgresPool } = await import('../apps/web/lib/postgres-pool.ts');
const pool = webPostgresPool();
const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='civica_finance_poc' ORDER BY table_name");
for (const t of tables.rows) {
  const cols = await pool.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='civica_finance_poc' AND table_name=$1 ORDER BY ordinal_position", [t.table_name]);
  console.log(t.table_name, cols.rows.map(x=>x.column_name+':'+x.data_type).join(','));
}
for (const name of ['supplier_category_snapshot','supplier_institutional_yearly','supplier_global_house_yearly','supplier_global_yearly']) {
  const c = await pool.query(`SELECT count(*)::int count FROM civica_finance_poc.${name}`);
  const s = await pool.query(`SELECT * FROM civica_finance_poc.${name} LIMIT 2`);
  console.log('SAMPLE', name, c.rows[0], JSON.stringify(s.rows));
}
await pool.end();
