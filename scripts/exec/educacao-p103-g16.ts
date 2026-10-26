import { writeFile } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { extractInfraYear, loadInfraCadastro, locateInfraFiles, publishInfraSlice, readInfraTsv } from '../../apps/collector/src/exec/educacao-infra.ts';
import { extractIndFile, loadIndContext, locateIndFiles, publishIndSlice, readIndInventory, readIndTsv } from '../../apps/collector/src/exec/educacao-ind.ts';
import { loadDocEntities, publishDocSlice, readDocTsv, DOC_REL_DIR } from '../../apps/collector/src/exec/educacao-doc.ts';
import { DATASET, buildDocYear, buildIndYear, buildInfraYear, docCompetence, indCompetence, infraCompetence, rollbackRun, type IndFileRows } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';
import { join } from 'node:path';
import { readManifest } from '../../apps/collector/src/exec/storage.ts';

/**
 * G16 da P10.3 (idempotência, retificação, rollback, falha injetada) com dados REAIS, somente em banco de teste: recusa rodar sem EXEC_DATABASE_URL.
 *   npx tsx scripts/exec/educacao-p103-g16.ts <ano> <UF_codigo> <saida.json>
 */
if (!process.env.EXEC_DATABASE_URL) throw new Error('recusado: defina EXEC_DATABASE_URL apontando para o banco de TESTE');
const [yearArg, ufArg, out] = process.argv.slice(2); const year = Number(yearArg), uf = Number(ufArg);
const cfg = storageConfig(); const pool = openPool(3);
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const tables = ['exec_edu_infra_year', 'exec_edu_infra_agg', 'exec_edu_infra_cov', 'exec_edu_ind_school', 'exec_edu_ind_terr', 'exec_edu_ind_cov', 'exec_edu_doc_terr'];
const state = async () => Object.fromEntries(await Promise.all(tables.map(async t => [t, await hash(`SELECT * FROM civica_exec.${t}`)])));
const preState = async () => ({ school_year: await hash('SELECT * FROM civica_exec.exec_edu_school_year'), offer: await hash('SELECT * FROM civica_exec.exec_edu_offer_year'), school: await hash('SELECT * FROM civica_exec.exec_edu_school') });
const logRows = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
try {
  const res: Record<string, unknown> = { year, uf }; const s0 = await state(); const p0 = await preState(); const l0 = await logRows();
  // ---------- infraestrutura
  const files = await locateInfraFiles(cfg, year); const ex = await extractInfraYear(cfg, files); const raw = await readInfraTsv(ex.tsv); const cad = await loadInfraCadastro(pool, year);
  const built = buildInfraYear(year, raw, cad); const slice = built.slices.get(uf)!; res.infraSchools = slice.rows.length;
  const again = await publishInfraSlice(pool, { year, slice, files, first: false }); res.infraReplay = again.status; res.logAfterReplay = (await logRows()) - l0; res.stateAfterReplay = same(await state(), s0);
  const inepsUf = new Set(slice.rows.map(r => String(r.inep))); const mod = structuredClone(raw); let nNet = 0, nSal = 0;
  for (const r of mod) { if (!inepsUf.has(r.inep)) continue; if (nNet < 5 && r.v.internet === '1') { r.v.internet = '0'; nNet++; } else if (nSal < 2 && /^\d+$/.test(r.v.salas_utilizadas ?? '')) { r.v.salas_utilizadas = String(Number(r.v.salas_utilizadas) + 1); nSal++; } }
  res.infraChanged = { internet: nNet, salas: nSal };
  const slice2 = buildInfraYear(year, mod, cad).slices.get(uf)!;
  const pr = await publishInfraSlice(pool, { year, slice: slice2, files: { ...files, sha256: files.sha256.map(s => `retif${s.slice(5)}`) }, first: false });
  if (pr.status !== 'PUBLISHED') throw new Error(`retificação não publicada: ${JSON.stringify(pr)}`);
  const ops = (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [pr.runId])).rows; res.infraLog = ops.map(o => `t${o.table_id}:${o.op}=${o.n}`);
  res.infraStateDiffers = !same(await state(), s0);
  const rb = await rollbackRun(pool, pr.runId); res.infraRollback = rb.status; res.infraStateAfterRollbackEqualsReference = same(await state(), s0);
  const lf = await logRows(); let failed = false; try { await publishInfraSlice(pool, { year, slice: slice2, files: { ...files, sha256: files.sha256.map(s => `falha${s.slice(5)}`) }, first: false, failAfterApply: true }); } catch { failed = true; }
  res.infraInjectedFailureThrew = failed; res.infraStateAfterFailureEqualsReference = same(await state(), s0); res.infraLogAfterFailure = (await logRows()) - lf;
  res.infraRepublishOriginal = (await publishInfraSlice(pool, { year, slice, files, first: false })).status;
  // ---------- indicadores oficiais
  const inv = await readIndInventory(); const ifiles = await locateIndFiles(cfg, year, inv); const parsed: IndFileRows[] = [];
  for (const f of ifiles) parsed.push({ family: f.family, level: f.level, sha256: f.sha256, rows: await readIndTsv((await extractIndFile(cfg, f)).tsv, f.level) });
  const ctx = await loadIndContext(pool, year); const ib = buildIndYear(year, parsed, ctx.cadastro, ctx.ent); const islice = ib.slices.get(uf)!;
  const shas = ifiles.flatMap(f => f.sha256).sort(); const rels = ifiles.flatMap(f => f.relPaths).sort();
  res.indSlice = { school: islice.school.length, terr: islice.terr.length };
  const iagain = await publishIndSlice(pool, { year, slice: islice, fileShas: shas, relPaths: rels, first: false }); res.indReplay = iagain.status;
  const mod2 = structuredClone(parsed); let nAtu = 0; const schoolsUf = new Set(islice.school.map(r => String(r.inep)));
  for (const f of mod2) if (f.family === 'ATU' && f.level === 'escolas') for (const r of f.rows) if (nAtu < 5 && schoolsUf.has(r.inep ?? '') && /^\d/.test(r.v.atu_fun ?? '')) { r.v.atu_fun = String(Number(r.v.atu_fun) + 1); nAtu++; }
  res.indChanged = { atu_fun: nAtu };
  const islice2 = buildIndYear(year, mod2, ctx.cadastro, ctx.ent).slices.get(uf)!;
  const ipr = await publishIndSlice(pool, { year, slice: islice2, fileShas: shas.map(s => `retif${s.slice(5)}`), relPaths: rels, first: false });
  if (ipr.status !== 'PUBLISHED') throw new Error(`retificação de indicadores não publicada: ${JSON.stringify(ipr)}`);
  res.indLog = (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [ipr.runId])).rows.map(o => `t${o.table_id}:${o.op}=${o.n}`);
  const irb = await rollbackRun(pool, ipr.runId); res.indRollback = irb.status; res.indStateAfterRollbackEqualsReference = same(await state(), s0);
  let ifailed = false; try { await publishIndSlice(pool, { year, slice: islice2, fileShas: shas.map(s => `falha${s.slice(5)}`), relPaths: rels, first: false, failAfterApply: true }); } catch { ifailed = true; }
  res.indInjectedFailureThrew = ifailed; res.indStateAfterFailureEqualsReference = same(await state(), s0);
  res.indRepublishOriginal = (await publishIndSlice(pool, { year, slice: islice, fileShas: shas, relPaths: rels, first: false })).status;
  // ---------- docentes oficiais
  const rel = `${DOC_REL_DIR}/docentes_${year}.tsv`; const me = (await readManifest(cfg)).get(rel)!; const draw = await readDocTsv(join(cfg.rawDir, rel)); const dent = await loadDocEntities(pool);
  const dslice = buildDocYear(year, draw, dent).slices.get(uf)!; res.docRows = dslice.rows.length;
  const dagain = await publishDocSlice(pool, { year, slice: dslice, fileSha: me.sha256, relPath: rel, first: false }); res.docReplay = dagain.status;
  const dmod = structuredClone(draw); let nd = 0; for (const r of dmod) if (r.kind === 'mun' && nd < 3 && dent.mun.get(Number(r.key))?.uf === uf && /^\d+$/.test(r.v.doc_total ?? '')) { r.v.doc_total = String(Number(r.v.doc_total) + 7); nd++; }
  const dslice2 = buildDocYear(year, dmod, dent).slices.get(uf)!; const dpr = await publishDocSlice(pool, { year, slice: dslice2, fileSha: `retif${me.sha256.slice(5)}`, relPath: rel, first: false });
  if (dpr.status !== 'PUBLISHED') throw new Error(`retificação de docentes não publicada: ${JSON.stringify(dpr)}`);
  res.docLog = (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [dpr.runId])).rows.map(o => `t${o.table_id}:${o.op}=${o.n}`);
  const drb = await rollbackRun(pool, dpr.runId); res.docRollback = drb.status; res.docStateAfterRollbackEqualsReference = same(await state(), s0);
  res.docRepublishOriginal = (await publishDocSlice(pool, { year, slice: dslice, fileSha: me.sha256, relPath: rel, first: false })).status;
  // ---------- dependências e estado final
  res.finalStateEqualsReference = same(await state(), s0); res.p101p102Unchanged = same(await preState(), p0);
  res.activePublications = (await pool.query(`SELECT dataset_id, run_id FROM civica_exec.exec_publication WHERE uf = $1 AND competence IN ($2, $3, $4) AND dataset_id IN ($5, $6, $7) ORDER BY 1`, [uf, infraCompetence(year), indCompetence(year), docCompetence(year), DATASET.edu_infra, DATASET.edu_ind, DATASET.edu_doc])).rowCount;
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
} finally { await pool.end(); }
