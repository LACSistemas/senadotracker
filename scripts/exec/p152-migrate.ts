import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_STF_JURISPRUDENCIA_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-stf-jurisprudencia.ts';

const VERSION = 'p14.11-stf-jurisprudencia-geral-v1';
const pool = openPool(2);
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const allSql = [...JUDICIARY_STF_JURISPRUDENCIA_SCHEMA_SQL];
  const hash = crypto.createHash('sha256').update(allSql.join('\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of allSql) await client.query(sql);
    await client.query(`INSERT INTO civica_jud.schema_migrations(version,sha256) VALUES($1,$2) ON CONFLICT(version) DO NOTHING`, [VERSION, hash]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  console.log(JSON.stringify({ database: db, version: VERSION, sha256: hash, tables: ['jud_stf_jurisprudencia_acordao', 'jud_stf_jurisprudencia_decisao'] }));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
