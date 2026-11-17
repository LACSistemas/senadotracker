import { openPool } from './db.ts';
import { fetchPublicDebt, writePublicDebt } from '../../apps/collector/src/public-debt.ts';

const pool = openPool(1);
try {
  const check = (await pool.query('select current_database() db')).rows[0];
  if (check.db !== 'projetoeleitor_db') throw new Error('DATABASE_GUARD');

  const points = await fetchPublicDebt();
  console.log(`Dívida pública (DBGG, % PIB): ${points.length} pontos mensais`);
  if (points.length) console.log(`  primeiro: ${points[0]!.periodStart} = ${points[0]!.value}`, `último: ${points.at(-1)!.periodStart} = ${points.at(-1)!.value}`);
  await writePublicDebt(pool, points);

  const summary = (await pool.query(`SELECT metric, count(*)::int n, min(period_start) min_p, max(period_start) max_p FROM civica_exec.exec_public_debt GROUP BY metric`)).rows;
  console.log('Resumo final:', JSON.stringify(summary, null, 2));
} finally {
  await pool.end();
}
