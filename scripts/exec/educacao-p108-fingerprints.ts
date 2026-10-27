import { writeFile } from 'node:fs/promises';
import { openPool } from './db.ts';

const output = process.argv[2]; if (!output) throw new Error('usage: educacao-p108-fingerprints.ts <output.json>');
const pool = openPool(1);
try {
  const tables = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='civica_exec' AND table_name LIKE 'exec_edu_%' ORDER BY table_name`)).rows.map(x => String(x.table_name));
  const state: Record<string, unknown> = {};
  for (const table of tables) {
    if (!/^exec_edu_[a-z0-9_]+$/.test(table)) throw new Error(`unsafe table ${table}`);
    state[table] = (await pool.query(`SELECT count(*)::bigint::text rows,coalesce(sum(hashtextextended(t::text,0)),0)::text checksum FROM civica_exec.${table} t`)).rows[0];
  }
  const metadata = (await pool.query(`SELECT current_database() database,current_user db_user,pg_database_size(current_database())::bigint::text database_bytes,now() captured_at`)).rows[0];
  const migrations = (await pool.query(`SELECT version,name FROM civica_exec.schema_migrations ORDER BY version`)).rows;
  await writeFile(output, JSON.stringify({ metadata, migrations, tables: state }, null, 2));
  console.log(JSON.stringify({ output, metadata, tableCount: tables.length }, null, 2));
} finally { await pool.end(); }
