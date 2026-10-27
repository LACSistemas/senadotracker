import { applyExecMigrations, refreshEducationAnalytics, refreshEducationProgramRollup, refreshEducationFinanceRollup } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

const productionConfirmed = process.argv.includes('--confirm-production');
const pool = openPool(2);
try {
  const target = (await pool.query(`SELECT current_database() db,inet_server_addr()::text host,inet_server_port() port,pg_database_size(current_database())::bigint::text bytes`)).rows[0]!;
  const explicitUrl = Boolean(process.env.EXEC_DATABASE_URL);
  if (!explicitUrl && !productionConfirmed) throw new Error('Refusing production migration/materialization without --confirm-production');
  const applied = await applyExecMigrations(pool);
  const refresh = await refreshEducationAnalytics(pool);
  const programRollup = await refreshEducationProgramRollup(pool);
  const financeRollup = await refreshEducationFinanceRollup(pool);
  const after = String((await pool.query(`SELECT pg_database_size(current_database())::bigint::text bytes`)).rows[0]!.bytes);
  console.log(JSON.stringify({ target, explicitUrl, applied, refresh, programRollup, financeRollup, databaseBytesAfter: after }, null, 2));
} finally { await pool.end(); }
