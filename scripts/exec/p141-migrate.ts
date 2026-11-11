import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_DATABASE, JUDICIARY_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary.ts';

const VERSION = 'p14.1-institutional-foundation-v1';

const pool = openPool(2);
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== JUDICIARY_DATABASE || db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const hash = crypto.createHash('sha256').update(JUDICIARY_SCHEMA_SQL.join('\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of JUDICIARY_SCHEMA_SQL) await client.query(sql);
    await client.query(`INSERT INTO civica_jud.schema_migrations(version, sha256) VALUES ($1,$2) ON CONFLICT (version) DO NOTHING`, [VERSION, hash]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  console.log(JSON.stringify({ database: db, schema: 'civica_jud', version: VERSION, sha256: hash, migrations: 1 }));
} catch (error) {
  try { await pool.query('ROLLBACK'); } catch { /* noop */ }
  console.error(error);
  process.exitCode = 1;
} finally { await pool.end(); }
