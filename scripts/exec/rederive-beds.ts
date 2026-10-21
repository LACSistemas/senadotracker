import { ymRange } from '../../packages/db/src/exec/index.ts';
import { UF_CODE, deriveBeds } from '../../apps/collector/src/exec/cnes.ts';
import { openPool } from './db.ts';

/**
 * Recalcula IND-SAU-05/05S (leitos por 1.000 hab.) das fatias CNES-LT já publicadas de uma UF, depois que a população anual passou a existir para a UF.
 * Não republica fatos: reaplica a derivação (mesma função do collector) sob o run ativo do LT de cada competência; só linhas que mudam são gravadas.
 * Uso: node --import tsx scripts/exec/rederive-beds.ts <UF> [compIni compFim]
 */
const [uf, a, b] = process.argv.slice(2);
const ufCode = UF_CODE[uf!.toUpperCase()]!;
const pool = openPool(2);
try {
  const pubs = new Map((await pool.query(`SELECT competence, run_id FROM civica_exec.exec_publication WHERE dataset_id = 4 AND uf = $1`, [ufCode])).rows.map(r => [Number(r.competence), Number(r.run_id)]));
  let changed = 0, comps = 0;
  for (const comp of ymRange(Number(a ?? 201301), Number(b ?? 202609))) {
    const runId = pubs.get(comp); if (!runId) continue;
    const c = await pool.connect();
    try { await c.query('BEGIN'); changed += await deriveBeds(c, runId, ufCode, comp); await c.query('COMMIT'); comps++; }
    catch (e) { try { await c.query('ROLLBACK'); } catch { /* */ } throw e; } finally { c.release(); }
  }
  // os comparativos pré-calculados dependem destes valores: descartar o cache (será reconstruído na próxima leitura)
  await pool.query(`DELETE FROM civica_exec.exec_story WHERE domain = 1 AND section IN ('benchmark_saude', 'bench_series_saude')`);
  console.log(JSON.stringify({ uf, competencias: comps, linhasAlteradas: changed }));
} finally { await pool.end(); }
