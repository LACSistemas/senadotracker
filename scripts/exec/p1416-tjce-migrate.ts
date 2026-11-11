import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_PERSONNEL_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-personnel.ts';

const VERSION = 'p14.16-judiciary-personnel-v1'; const pool = openPool(2);
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const all = [...JUDICIARY_PERSONNEL_SCHEMA_SQL];
  const hash = crypto.createHash('sha256').update(all.join('\n')).digest('hex'); const c = await pool.connect();
  try { await c.query('BEGIN'); for (const sql of all) await c.query(sql); await c.query(`INSERT INTO civica_jud.schema_migrations(version,sha256) VALUES($1,$2) ON CONFLICT(version) DO NOTHING`, [VERSION, hash]); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  console.log(JSON.stringify({ database: db, version: VERSION, sha256: hash, tables: ['jud_personnel_fact', 'jud_supplier_payment'] }));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
