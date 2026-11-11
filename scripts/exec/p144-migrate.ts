import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary.ts';
import { JUDICIARY_STATISTICS_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-statistics.ts';
import { JUDICIARY_STJ_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-stj.ts';

const VERSION = 'p14.4-stj-jurisprudence-v1';
const pool = openPool(2);
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const allSql = [...JUDICIARY_SCHEMA_SQL, ...JUDICIARY_STATISTICS_SCHEMA_SQL, ...JUDICIARY_STJ_SCHEMA_SQL];
  const hash = crypto.createHash('sha256').update(allSql.join('\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of allSql) await client.query(sql);
    await client.query(`INSERT INTO civica_jud.schema_migrations(version,sha256) VALUES($1,$2) ON CONFLICT(version) DO NOTHING`, [VERSION, hash]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  console.log(JSON.stringify({ database: db, version: VERSION, sha256: hash, tables: ['jud_stj_orgao','jud_stj_person','jud_stj_precedent','jud_stj_precedent_process','jud_stj_acordao_mirror','jud_stj_decision','jud_stj_document_relation'] }));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
