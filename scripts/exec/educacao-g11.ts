import { writeFile } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { loadMunicipalities, locateCensoFiles, extractCensoYear, publishEduSlice, readCensoTsv } from '../../apps/collector/src/exec/educacao.ts';
import { DATASET, buildEduYear, eduCompetence, rollbackRun } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * G11 (idempotência, retificação, rollback) com dados REAIS, somente em banco de teste: recusa rodar sem EXEC_DATABASE_URL.
 *   npx tsx scripts/exec/educacao-g11.ts <ano> <UF_codigo> <saida.json>
 * Passos: (1) estado de referência; (2) republicar o mesmo arquivo → NO_CHANGE; (3) retificação controlada da UF (renomear, mudar município e dependência, remover uma escola, incluir uma nova) com sha de arquivo
 * diferente → só o diferente entra no log; (4) rollback exato (hash do estado = referência); (5) falha injetada não deixa nada; (6) republicar o original → NO_CHANGE.
 */
if (!process.env.EXEC_DATABASE_URL) throw new Error('recusado: defina EXEC_DATABASE_URL apontando para o banco de TESTE');
const [yearArg, ufArg, out] = process.argv.slice(2); const year = Number(yearArg), uf = Number(ufArg);
const cfg = storageConfig(); const pool = openPool(3);
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const state = async () => ({ school_year: await hash('SELECT * FROM civica_exec.exec_edu_school_year'), school: await hash('SELECT * FROM civica_exec.exec_edu_school'), cov: await hash('SELECT * FROM civica_exec.exec_edu_cov') });
const logRows = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
try {
  const files = await locateCensoFiles(cfg, year); const ex = await extractCensoYear(cfg, files); const rows = await readCensoTsv(ex.tsv); const muns = await loadMunicipalities(pool);
  const built = buildEduYear(year, rows, muns); const slice = built.slices.get(uf)!; const comp = eduCompetence(year);
  const res: Record<string, unknown> = { year, uf, schoolsInSlice: slice.rows.length };
  const s0 = await state(); const l0 = await logRows(); res.s0 = s0;
  // (2) mesmo arquivo → NO_CHANGE
  const again = await publishEduSlice(pool, { year, slice, files, first: false, built }); res.replaySame = again.status; res.logAfterReplay = (await logRows()) - l0; res.stateAfterReplay = JSON.stringify(await state()) === JSON.stringify(s0);
  // (3) retificação controlada
  const mine = structuredClone(slice); const inUf = [...muns.values()].filter(m => m.ufCode === uf).map(m => m.entityId);
  const sorted = [...mine.rows].sort((a, b) => a.inep - b.inep); const [a1, a2, a3, m1, m2, d1, d2, gone] = sorted.slice(10, 18) as [typeof sorted[0], ...typeof sorted];
  for (const r of [a1!, a2!, a3!]) r.name = `${r.name} (RETIFICADA)`;
  for (const r of [m1!, m2!]) r.entity_id = inUf.find(e => e !== r.entity_id)!;
  for (const r of [d1!, d2!]) r.dep = r.dep === 3 ? 2 : 3;
  mine.rows = mine.rows.filter(r => r.inep !== gone!.inep);
  const fresh = { ...mine.rows[0]!, inep: 32999999, name: 'ESCOLA INCLUIDA NA RETIFICACAO' }; mine.rows.push(fresh);
  res.changed = { renamed: [a1, a2, a3].map(r => r!.inep), movedMunicipality: [m1, m2].map(r => r!.inep), dependency: [d1, d2].map(r => r!.inep), removed: gone!.inep, added: fresh.inep };
  const retifFiles = { ...files, sha256: files.sha256.map(s => `retif${s.slice(5)}`) };
  const l1 = await logRows(); const pr = await publishEduSlice(pool, { year, slice: mine, files: retifFiles, first: false, built }); res.retification = pr.status;
  if (pr.status !== 'PUBLISHED') throw new Error(`retificação não publicada: ${JSON.stringify(pr)}`);
  const ops = (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY table_id, op ORDER BY table_id, op`, [pr.runId])).rows;
  res.logByTableOp = ops.map(o => `t${o.table_id}:${o.op}=${o.n}`); res.logRowsAdded = (await logRows()) - l1; res.retificationRunId = pr.runId;
  res.stateAfterRetification = await state();
  // (4) rollback exato
  const rb = await rollbackRun(pool, pr.runId); res.rollback = rb.status; res.stateAfterRollbackEqualsReference = JSON.stringify(await state()) === JSON.stringify(s0);
  res.publicationActiveAfterRollback = (await pool.query(`SELECT run_id, state FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [DATASET.edu_censo, uf, comp])).rows[0];
  // (5) falha injetada
  const lf = await logRows(); let failed = false; try { await publishEduSlice(pool, { year, slice: mine, files: { ...files, sha256: files.sha256.map(s => `falha${s.slice(5)}`) }, first: false, built, failAfterApply: true }); } catch { failed = true; }
  res.injectedFailureThrew = failed; res.stateAfterInjectedFailureEqualsReference = JSON.stringify(await state()) === JSON.stringify(s0); res.logAfterInjectedFailure = (await logRows()) - lf;
  // (6) original → NO_CHANGE
  const orig = await publishEduSlice(pool, { year, slice, files, first: false, built }); res.republishOriginal = orig.status; res.finalStateEqualsReference = JSON.stringify(await state()) === JSON.stringify(s0);
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
} finally { await pool.end(); }
