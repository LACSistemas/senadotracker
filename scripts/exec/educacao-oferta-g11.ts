import { writeFile } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { extractOfferYear, loadOfferCadastro, locateOfferFiles, publishOfferSlice, readOfferTsv } from '../../apps/collector/src/exec/educacao-oferta.ts';
import { DATASET, buildOfferYear, offerCompetence, rollbackRun } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * G11 da P10.2 (idempotência, retificação, rollback, falha injetada, dependência da P10.1) com dados REAIS, somente em banco de teste: recusa rodar sem EXEC_DATABASE_URL.
 *   npx tsx scripts/exec/educacao-oferta-g11.ts <ano> <UF_codigo> <saida.json>
 */
if (!process.env.EXEC_DATABASE_URL) throw new Error('recusado: defina EXEC_DATABASE_URL apontando para o banco de TESTE');
const [yearArg, ufArg, out] = process.argv.slice(2); const year = Number(yearArg), uf = Number(ufArg);
const cfg = storageConfig(); const pool = openPool(3);
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const state = async () => ({ offer: await hash('SELECT * FROM civica_exec.exec_edu_offer_year'), agg: await hash('SELECT * FROM civica_exec.exec_edu_offer_agg'), cov: await hash('SELECT * FROM civica_exec.exec_edu_offer_cov') });
const cadState = async () => ({ school_year: await hash('SELECT * FROM civica_exec.exec_edu_school_year'), school: await hash('SELECT * FROM civica_exec.exec_edu_school'), cov: await hash('SELECT * FROM civica_exec.exec_edu_cov') });
const logRows = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
try {
  const files = await locateOfferFiles(cfg, year); const ex = await extractOfferYear(cfg, files); const rows = await readOfferTsv(ex.tsv); const cad = await loadOfferCadastro(pool, year);
  const built = buildOfferYear(year, rows, cad); const slice = built.slices.get(uf)!; const comp = offerCompetence(year);
  const res: Record<string, unknown> = { year, uf, schoolsInSlice: slice.rows.length };
  const s0 = await state(); const c0 = await cadState(); const l0 = await logRows(); res.s0 = s0;
  const again = await publishOfferSlice(pool, { year, slice, files, first: false }); res.replaySame = again.status; res.logAfterReplay = (await logRows()) - l0; res.stateAfterReplay = JSON.stringify(await state()) === JSON.stringify(s0);
  // retificação controlada: 5 escolas mudam matrículas/turmas (partições consistentes), 2 mudam tempo integral
  const mine = structuredClone(slice); const pick = mine.rows.filter(r => (r.mat_fund_ai ?? 0) >= 10 && (r.tur_fund_ai ?? 0) >= 1).slice(20, 25);
  for (const r of pick) { r.mat_fund_ai = (r.mat_fund_ai ?? 0) - 5; r.mat_fund_af = (r.mat_fund_af ?? 0) + 5; }              // desloca 5 matrículas entre anos iniciais e finais: o total e a partição seguem válidos
  const pick2 = mine.rows.filter(r => (r.mat_fund_ai ?? 0) > 0).slice(40, 42); for (const r of pick2) r.mat_int_fund = (r.mat_int_fund ?? 0) + 1;
  const g = new Map<string, number>(); // recalcula os agregados do mesmo recorte (dep × loc) a partir das linhas alteradas
  const rebuilt = buildOfferYear(year, rows.map(r => { const m = mine.rows.find(x => String(x.inep) === r.inep && (pick.includes(x) || pick2.includes(x))); if (!m) return r; const v = { ...r.v }; for (const c of ['mat_fund_ai', 'mat_fund_af', 'mat_int_fund']) v[c] = String(m[c] ?? ''); return { ...r, v }; }), cad).slices.get(uf)!;
  void g;
  res.changed = { nPartition: pick.length, nIntegral: pick2.length, inep: [...pick, ...pick2].map(r => r.inep) };
  const l1 = await logRows(); const pr = await publishOfferSlice(pool, { year, slice: rebuilt, files: { ...files, sha256: files.sha256.map(s => `retif${s.slice(5)}`) }, first: false }); res.retification = pr.status;
  if (pr.status !== 'PUBLISHED') throw new Error(`retificação não publicada: ${JSON.stringify(pr)}`);
  const ops = (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY table_id, op ORDER BY table_id, op`, [pr.runId])).rows;
  res.logByTableOp = ops.map(o => `t${o.table_id}:${o.op}=${o.n}`); res.logRowsAdded = (await logRows()) - l1; res.retificationRunId = pr.runId;
  res.stateAfterRetificationDiffers = JSON.stringify(await state()) !== JSON.stringify(s0);
  const rb = await rollbackRun(pool, pr.runId); res.rollback = rb.status; res.stateAfterRollbackEqualsReference = JSON.stringify(await state()) === JSON.stringify(s0);
  res.publicationActiveAfterRollback = (await pool.query(`SELECT run_id, state FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [DATASET.edu_oferta, uf, comp])).rows[0];
  const lf = await logRows(); let failed = false; try { await publishOfferSlice(pool, { year, slice: rebuilt, files: { ...files, sha256: files.sha256.map(s => `falha${s.slice(5)}`) }, first: false, failAfterApply: true }); } catch { failed = true; }
  res.injectedFailureThrew = failed; res.stateAfterInjectedFailureEqualsReference = JSON.stringify(await state()) === JSON.stringify(s0); res.logAfterInjectedFailure = (await logRows()) - lf;
  const orig = await publishOfferSlice(pool, { year, slice, files, first: false }); res.republishOriginal = orig.status; res.finalStateEqualsReference = JSON.stringify(await state()) === JSON.stringify(s0);
  res.cadastroP101Unchanged = JSON.stringify(await cadState()) === JSON.stringify(c0);
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
} finally { await pool.end(); }
