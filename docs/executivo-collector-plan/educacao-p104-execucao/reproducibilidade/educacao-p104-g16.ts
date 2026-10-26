import { writeFile } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import {
  extractIdeb, extractSaeb, loadLearnContext, locateIdebFiles, locateSaebSources, publishIdebSlice, publishSaebSlice, readIdebTsv, readSaebTsv,
} from '../../apps/collector/src/exec/educacao-learn.ts';
import { extractFlow, locateFlowFiles, publishFlowSlice, publishInseSlice, readFlowTsv, readInseTsv, type FlowKind } from '../../apps/collector/src/exec/educacao-flow.ts';
import {
  SPECS, buildFlowYear, buildIdebYear, buildInseYear, buildSaebYear, learnCompetence, rollbackRun,
  type FlowFile, type FlowLevel, type IdebFile, type InseFile, type InseLevel, type PublishResult, type SaebFile,
} from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * G16 da P10.4 (idempotência, retificação, rollback, falha injetada) com dados REAIS de uma fatia (ano × UF) de cada família, somente em banco de teste: recusa rodar sem EXEC_DATABASE_URL.
 *   npx tsx scripts/exec/educacao-p104-g16.ts <ano> <UF_codigo> <saida.json>
 * (o ano precisa existir em todas as famílias: 2019, 2021 ou 2023 para INSE; a transição usa o ano de origem)
 */
if (!process.env.EXEC_DATABASE_URL) throw new Error('recusado: defina EXEC_DATABASE_URL apontando para o banco de TESTE');
const [yearArg, ufArg, out, only] = process.argv.slice(2); const want = (n: string) => !only || only.split(',').includes(n);
const TAG = Date.now().toString(36);   // cada execução usa SHAs próprios: republicar o MESMO conteúdo reativa o run antigo (e então o rollback seria recusado por existir run mais novo da UF)
const year = Number(yearArg), uf = Number(ufArg);
const cfg = storageConfig(); const pool = openPool(3); const comp = learnCompetence(year);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// o change log tem milhões de linhas: contar só o que nasce depois do maior run_id existente na largada (a chave primária é (run_id, seq))
const baseRun = Number((await pool.query(`SELECT coalesce(max(run_id), 0)::int m FROM civica_exec.exec_change_log`)).rows[0].m);
const logRows = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log WHERE run_id > $1`, [baseRun])).rows[0].n);
type Spec = { name: string; scopeSql: string };
const stateOf = async (specs: Spec[], comp: number) => Object.fromEntries(await Promise.all(specs.map(async s => [s.name, String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (SELECT * FROM civica_exec.${s.name} WHERE ${s.scopeSql}) t`, [uf, comp])).rows[0].h)])));
const opsOf = async (runId: number) => (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [runId])).rows.map(o => `t${o.table_id}:${o.op}=${o.n}`);
const bump = (s: string, d: number): string => String(Math.round((Number(s) + d) * 1e6) / 1e6);

interface Family { name: string; comp: number; specs: Spec[]; publish: (mod: boolean, sha: string, failAfterApply?: boolean) => Promise<PublishResult>; changed: number }
const families: Family[] = [];
const ctx = await loadLearnContext(pool);

// ---------------------------------------------------------------- Ideb
if (want('ideb')) {
  const loc = await locateIdebFiles(cfg); const files: IdebFile[] = []; const shas: string[] = []; const rels: string[] = [];
  for (const level of ['brasil', 'ufs', 'municipios', 'escolas'] as const) { const ex = await extractIdeb(cfg, level, loc[level]); files.push({ level, sha256: loc[level].sha256, rows: await readIdebTsv(ex.tsv) }); shas.push(...loc[level].sha256); rels.push(...loc[level].relPaths); }
  const base = buildIdebYear(files, ctx, [year]).get(`${year}:${uf}`)!; const mod = structuredClone(files); let n = 0;
  for (const f of mod) if (f.level === 'escolas') for (const r of f.rows) if (n < 5 && r.year === year && r.k1 === 'ES' && /^\d/.test(r.v.ideb ?? '')) { r.v.ideb = bump(r.v.ideb!, 0.1); n++; }
  const modSlice = buildIdebYear(mod, ctx, [year]).get(`${year}:${uf}`)!;
  families.push({ name: 'ideb', comp, changed: n, specs: [SPECS.edu_ideb_school, SPECS.edu_ideb_terr, SPECS.edu_ideb_cov], publish: (m, sha, fail) => publishIdebSlice(pool, { slice: m ? modSlice : base, fileShas: (sha ? [...shas, sha] : [...shas]).sort(), relPaths: rels, first: false, ...(fail ? { failAfterApply: true } : {}) }) });
}
// ---------------------------------------------------------------- Saeb
if (want('saeb')) {
  const sources = (await locateSaebSources(cfg)).filter(s => s.year === year); const files: SaebFile[] = []; const shas: string[] = []; const rels: string[] = [];
  for (const s of sources) { const ex = await extractSaeb(cfg, s); files.push({ level: s.level, sha256: [s.sha256], rows: await readSaebTsv(ex.tsv, s.level) }); shas.push(s.sha256); rels.push(s.relPath); }
  const base = buildSaebYear(files, ctx).get(`${year}:${uf}`)!; const mod = structuredClone(files); let n = 0;
  for (const f of mod) if (f.level === 'municipios') for (const r of f.rows) if (n < 5 && r.uf === String(uf) && /^\d/.test(r.media) && r.grade === 5 && r.subj === 'LP') { r.media = bump(r.media, 1); n++; }
  const modSlice = buildSaebYear(mod, ctx).get(`${year}:${uf}`)!;
  families.push({ name: 'saeb', comp, changed: n, specs: [SPECS.edu_saeb_terr, SPECS.edu_saeb_cov], publish: (m, sha, fail) => publishSaebSlice(pool, { slice: m ? modSlice : base, fileShas: [...new Set(sha ? [...shas, sha] : shas)].sort(), relPaths: [...new Set(rels)].sort(), first: false, ...(fail ? { failAfterApply: true } : {}) }) });
}
// ---------------------------------------------------------------- Fluxo (rendimento + distorção) e transição
for (const mode of ['flow', 'trn'] as const) {
  if (!want(mode)) continue;
  const fy = mode === 'trn' ? Math.min(year, 2021) : year;   // a transição vai de 2007/2008 a 2021/2022
  const kinds: FlowKind[] = mode === 'trn' ? ['TRN'] : ['TXR', 'TDI']; const located = await locateFlowFiles(cfg, kinds, fy); const files: FlowFile[] = []; const shas: string[] = []; const rels: string[] = [];
  for (const f of located) { const ex = await extractFlow(cfg, f); files.push({ family: f.kind as FlowFile['family'], level: f.level as FlowLevel, year: fy, sha256: f.sha256, rows: await readFlowTsv(ex.tsv, f.level as FlowLevel) }); shas.push(...f.sha256); rels.push(...f.relPaths); }
  const base = buildFlowYear(files, ctx, mode).get(`${fy}:${uf}`)!; const mod = structuredClone(files); let n = 0; const col = mode === 'trn' ? 'pro_fun' : 'ap_fun';
  for (const f of mod) if (f.level === (mode === 'trn' ? 'municipios' : 'escolas')) for (const r of f.rows) if (n < 5 && (mode === 'trn' ? r.key.startsWith(String(uf)) && r.loc === 'Total' && r.dep === 'Total' : r.uf === 'ES') && /^\d/.test(r.v[col] ?? '')) { r.v[col] = bump(r.v[col]!, 0.1); n++; }
  const modSlice = buildFlowYear(mod, ctx, mode).get(`${fy}:${uf}`)!;
  const specs = mode === 'trn' ? [SPECS.edu_trn_terr, SPECS.edu_trn_cov] : [SPECS.edu_flow_school, SPECS.edu_flow_terr, SPECS.edu_flow_cov];
  families.push({ name: mode, comp: learnCompetence(fy), changed: n, specs, publish: (m, sha, fail) => publishFlowSlice(pool, { slice: m ? modSlice : base, mode, fileShas: [...new Set(sha ? [...shas, sha] : shas)].sort(), relPaths: [...new Set(rels)].sort(), first: false, ...(fail ? { failAfterApply: true } : {}) }) });
}
// ---------------------------------------------------------------- INSE
if (want('inse')) {
  const located = await locateFlowFiles(cfg, ['INSE'], year); const files: InseFile[] = []; const shas: string[] = []; const rels: string[] = [];
  for (const f of located) { const ex = await extractFlow(cfg, f); files.push({ level: f.level as InseLevel, sha256: f.sha256, rows: await readInseTsv(ex.tsv, f.level as InseLevel) }); shas.push(...f.sha256); rels.push(...f.relPaths); }
  const base = buildInseYear(files, ctx).get(`${year}:${uf}`)!; const mod = structuredClone(files); let n = 0;
  for (const f of mod) if (f.level === 'escolas') for (const r of f.rows) if (n < 5 && r.uf_code === String(uf) && /^\d/.test(r.media)) { r.media = bump(r.media, 0.1); n++; }
  const modSlice = buildInseYear(mod, ctx).get(`${year}:${uf}`)!;
  families.push({ name: 'inse', comp, changed: n, specs: [SPECS.edu_inse_school, SPECS.edu_inse_terr, SPECS.edu_inse_cov], publish: (m, sha, fail) => publishInseSlice(pool, { slice: m ? modSlice : base, fileShas: [...new Set(sha ? [...shas, sha] : shas)].sort(), relPaths: [...new Set(rels)].sort(), first: false, ...(fail ? { failAfterApply: true } : {}) }) });
}

try {
  const res: Record<string, unknown> = { year, uf };
  // ondas anteriores (P10.1–P10.3): nada pode mudar
  const prior = ['exec_edu_school', 'exec_edu_school_year', 'exec_edu_offer_year', 'exec_edu_infra_year', 'exec_edu_ind_school', 'exec_edu_ind_terr', 'exec_edu_doc_terr'];
  const priorHash = async () => Object.fromEntries(await Promise.all(prior.map(async t => [t, String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (SELECT * FROM civica_exec.${t} WHERE ${/school$/.test(t) ? 'true' : 'year = $1'}) t`, /school$/.test(t) ? [] : [year])).rows[0].h)])));
  const p0 = await priorHash();
  for (const f of families) {
    const r: Record<string, unknown> = { changedInputRows: f.changed }; const s0 = await stateOf(f.specs, f.comp); const l0 = await logRows();
    const replay = await f.publish(false, '');   // mesma fatia e mesmos arquivos
    r.replay = replay.status; r.logAfterReplay = (await logRows()) - l0; r.stateAfterReplay = same(await stateOf(f.specs, f.comp), s0);
    const pr = await f.publish(true, `retif${TAG}`);
    if (pr.status !== 'PUBLISHED') throw new Error(`${f.name}: retificação não publicada: ${JSON.stringify(pr)}`);
    r.log = await opsOf(pr.runId); r.stateDiffers = !same(await stateOf(f.specs, f.comp), s0);
    const rb = await rollbackRun(pool, pr.runId); r.rollback = rb.status; r.stateAfterRollbackEqualsReference = same(await stateOf(f.specs, f.comp), s0);
    const lf = await logRows(); let failed = false; try { await f.publish(true, `falha${TAG}`, true); } catch { failed = true; }
    r.injectedFailureThrew = failed; r.stateAfterFailureEqualsReference = same(await stateOf(f.specs, f.comp), s0); r.logAfterFailure = (await logRows()) - lf;
    res[f.name] = r; await writeFile(out!, JSON.stringify(res, null, 1));
  }
  res.finalStateAfterAll = true; res.priorWavesUnchanged = same(await priorHash(), p0);
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
} finally { await pool.end(); }
