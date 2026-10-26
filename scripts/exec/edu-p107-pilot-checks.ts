import { DATASET, RUN_STATUS, rollbackRun } from '../../packages/db/src/exec/index.ts';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { loadContractCtx } from '../../apps/collector/src/exec/contratos.ts';
import { loadEduYear, publishEduContractSlice, publishEduContractYear } from '../../apps/collector/src/exec/educacao-contratos.ts';
import { openPool } from './db.ts';

/**
 * Verificações em banco ISOLADO (cluster de teste), com dados reais do RAW: publicação de uma fatia nova, falha injetada (sem rastro), rollback do run (volta ao estado anterior) e republicação.
 *   EXEC_DATABASE_URL=<cluster isolado> npx tsx scripts/exec/edu-p107-pilot-checks.ts <ano> <uf>
 */
const [yearArg, ufArg] = process.argv.slice(2); const year = Number(yearArg), uf = Number(ufArg);
const pool = openPool(3); const cfg = storageConfig();
const snap = async () => (await pool.query(`SELECT count(*)::int n, coalesce(sum(valor_global), 0)::bigint s, md5(coalesce(string_agg(pncp_id || ':' || coalesce(valor_global::text, 'n'), ',' ORDER BY pncp_id), '')) h FROM civica_exec.exec_edu_contract WHERE year = $1 AND uf = $2`, [year, uf])).rows[0];
const logN = async () => Number((await pool.query(`SELECT count(*)::bigint n FROM civica_exec.exec_change_log`)).rows[0].n);
const out: Record<string, unknown> = { year, uf };
try {
  out.antes = await snap(); const log0 = await logN();
  try { await publishEduContractYear(pool, cfg, year, { ufs: [uf], failAfterApply: true }); out.falha_injetada = 'NÃO FALHOU (inesperado)'; } catch (e) { out.falha_injetada = `falhou como esperado: ${(e as Error).message}`; }
  out.depois_da_falha = await snap(); out.sem_rastro_da_falha = JSON.stringify(out.antes) === JSON.stringify(out.depois_da_falha) && log0 === await logN();
  const r1 = await publishEduContractYear(pool, cfg, year, { ufs: [uf] }); out.publicacao = r1.results?.map(x => x.status); out.apos_publicar = await snap(); const logPub = await logN();
  const r2 = await publishEduContractYear(pool, cfg, year, { ufs: [uf] }); out.replay = r2.results?.map(x => x.status); out.replay_sem_log = logPub === await logN();
  // retificação real: mesma fatia do RAW com um contrato alterado e outro removido, fingerprint novo (gera change log); depois rollback do run e verificação do estado
  const y = await loadEduYear(cfg, await loadContractCtx(pool), year); const base = y.byUf.get(uf)!; const base0 = await snap(); const logBase = await logN();
  const rows = base.rows.map(r => ({ ...r })); const dropped = rows.pop()!; rows[0]!.valor_global = Number(rows[0]!.valor_global ?? 0) + 100;
  const slice = { ...base, rows, classes: base.classes.filter(k => k.pncp_id !== dropped.pncp_id) };
  const rect = await publishEduContractSlice(pool, { year, uf, slice, suppliers: [], fingerprint: `retificacao-${Date.now()}`, first: false, current: false, inputs: { teste: 'retificacao' }, quality: { teste: true } });
  out.retificacao = rect.status; out.apos_retificacao = await snap(); out.change_log_gerado = (await logN()) - logBase;
  out.retificacao_alterou = JSON.stringify(out.apos_retificacao) !== JSON.stringify(base0);
  if (rect.status === 'PUBLISHED') { out.rollback = await rollbackRun(pool, rect.runId); out.apos_rollback = await snap(); out.rollback_restaurou = JSON.stringify(out.apos_rollback) === JSON.stringify(base0); }
  console.log(JSON.stringify(out, null, 1));
} finally { await pool.end(); }
