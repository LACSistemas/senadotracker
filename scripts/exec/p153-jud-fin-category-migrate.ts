import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_FINANCIAL_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-financial.ts';

const VERSION='p14.37-judiciary-expense-category-v1'; const pool=openPool(2);
try {
  const db=(await pool.query<{current_database:string}>('SELECT current_database()')).rows[0]?.current_database;
  if(db!=='projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const all=[...JUDICIARY_FINANCIAL_SCHEMA_SQL];
  const hash=crypto.createHash('sha256').update(all.join('\n')).digest('hex'); const c=await pool.connect();
  try { await c.query('BEGIN'); for(const sql of all) await c.query(sql); await c.query(`INSERT INTO civica_jud.schema_migrations(version,sha256) VALUES($1,$2) ON CONFLICT(version) DO NOTHING`,[VERSION,hash]); await c.query('COMMIT'); } catch(e){await c.query('ROLLBACK');throw e} finally{c.release()}
  console.log(JSON.stringify({database:db,version:VERSION,sha256:hash,added:['jud_fin_inciso_code()','jud_fin_inciso_label']}));
} catch(e){console.error(e);process.exitCode=1} finally{await pool.end()}
