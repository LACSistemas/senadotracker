import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary.ts';
import { JUDICIARY_STATISTICS_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-statistics.ts';

const VERSION = 'p14.2-justica-em-numeros-v1';
const pool = openPool(2);
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const hash = crypto.createHash('sha256').update([...JUDICIARY_SCHEMA_SQL, ...JUDICIARY_STATISTICS_SCHEMA_SQL].join('\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of JUDICIARY_SCHEMA_SQL) await client.query(sql);
    for (const sql of JUDICIARY_STATISTICS_SCHEMA_SQL) await client.query(sql);
    await client.query(`UPDATE civica_jud.jud_tribunal SET branch_id='JUD:BRANCH:ESTADUAL' WHERE sigla IN ('TJMA','TJMG','TJMS','TJMT')`);
    await client.query(`UPDATE civica_jud.jud_tribunal SET branch_id='JUD:BRANCH:MILITAR' WHERE sigla IN ('TJMMG','TJMRS','TJMSP')`);
    await client.query(`INSERT INTO civica_jud.schema_migrations(version,sha256) VALUES($1,$2) ON CONFLICT(version) DO NOTHING`, [VERSION, hash]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const counts = (await pool.query<{ branch_code: string; n: string }>(`SELECT b.code AS branch_code,count(*)::text AS n FROM civica_jud.jud_tribunal t JOIN civica_jud.jud_branch b ON b.branch_id=t.branch_id GROUP BY b.code ORDER BY b.code`)).rows;
  console.log(JSON.stringify({ database: db, version: VERSION, sha256: hash, branchCounts: counts }));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
