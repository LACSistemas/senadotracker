import { openPool } from './db.ts';
const p = openPool(1);
try {
  const tables = await p.query(`select table_name from information_schema.tables where table_schema='civica_exec' order by table_name`);
  console.log(JSON.stringify(tables.rows, null, 2));
  const mig = await p.query(`select version,name from civica_exec.schema_migrations order by version desc limit 5`).catch(() => ({ rows: [] } as any));
  console.log(JSON.stringify({ migrations: mig.rows }, null, 2));
  const cols = await p.query(`select table_name,column_name,data_type from information_schema.columns where table_schema='civica_exec' and table_name in ('exec_entity','exec_ind_def','exec_ind_value','exec_ingestion_run','exec_raw_manifest','exec_publication') order by table_name,ordinal_position`);
  console.log(JSON.stringify(cols.rows, null, 2));
} finally { await p.end(); }
