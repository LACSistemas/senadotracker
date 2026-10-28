import { join } from 'node:path';
import { appendFile, mkdir, readdir, stat } from 'node:fs/promises';
import { storageConfig, dirSize, freeBytes } from '../../apps/collector/src/exec/storage.ts';
import { censoYears, discoverCensoLinks, fetchCensoEdition } from '../../apps/collector/src/exec/inep-censo.ts';
import { collectEduYear, extractCensoYear, locateCensoFiles } from '../../apps/collector/src/exec/educacao.ts';
import { collectOfferYear, extractOfferYear, locateOfferFiles } from '../../apps/collector/src/exec/educacao-oferta.ts';
import { collectIdeb, collectSaeb, extractIdeb, locateIdebFiles, registerLearnFiles } from '../../apps/collector/src/exec/educacao-learn.ts';
import { collectFlow, collectInse, readFlowInventory, flowYears, registerFlowFiles } from '../../apps/collector/src/exec/educacao-flow.ts';
import { publishEduContractYear } from '../../apps/collector/src/exec/educacao-contratos.ts';
import { publishEduProcurement, publishEduTerms } from '../../apps/collector/src/exec/educacao-complemento.ts';
import { publishEduWorks } from '../../apps/collector/src/exec/educacao-obras-publish.ts';
import { collectDocYear, prepareDocFiles } from '../../apps/collector/src/exec/educacao-doc.ts';
import { collectIndYear, extractIndFile, locateIndFiles, readIndInventory, registerIndFiles } from '../../apps/collector/src/exec/educacao-ind.ts';
import { collectInfraYear, extractInfraYear, locateInfraFiles } from '../../apps/collector/src/exec/educacao-infra.ts';
import { recordManifest, registerLocalRaw } from '../../apps/collector/src/exec/storage.ts';
import { applyExecMigrations } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';
import { execFileSync } from 'node:child_process';

/**
 * Cadastro de escolas (P10.1, Censo Escolar). EXEC_DATABASE_URL aponta para banco de teste quando definido.
 *   migrate           aplica a migration v9 (3 tabelas: identidade, escola × edição, cobertura)
 *   fetch [anos]      baixa/valida os arquivos do Censo (2007–2025) para o RAW no SSD (2025: só as tabelas Escola e Matrícula)
 *   extract [anos]    extrai a whitelist de colunas do RAW para staging (sem banco)
 *   publish [anos] [UF,…]   publica as edições (padrão: todas as UFs); mesma entrada → NO_CHANGE
 *   oferta-extract [anos]   (P10.2) extrai matrículas/turmas por escola do RAW para staging
 *   oferta-publish [anos] [UF,…]   (P10.2) publica matrículas, turmas e oferta (dataset 71); mesma entrada → NO_CHANGE
 *   infra-extract [anos]   (P10.3) extrai as variáveis de infraestrutura por escola do RAW para staging e grava o resumo de distribuição (evidência)
 *   infra-publish [anos] [UF,…]   (P10.3) publica a infraestrutura (dataset 72); mesma entrada → NO_CHANGE
 *   ind-register   (P10.3) confere o CRC e registra no manifesto os ZIPs de Indicadores Educacionais já baixados
 *   ind-extract [anos]   (P10.3) extrai as planilhas oficiais para staging (TSV)
 *   ind-publish [anos] [UF,…]   (P10.3) publica os Indicadores Educacionais oficiais (dataset 73; UF 0 = nacional)
 *   doc-prepare [anos]   (P10.3) converte as tabelas 2.1/2.2 da Sinopse (JSON já extraído) em TSV no RAW e registra no manifesto
 *   doc-publish [anos]   (P10.3) publica os docentes distintos oficiais (dataset 74; UF 0 = Brasil)
 *   learn-register   (P10.4) confere o CRC e registra no manifesto os arquivos oficiais do Ideb (2025) e do Saeb (2017–2025) já baixados
 *   ideb-publish [anos] [UF,…]   (P10.4) publica o Ideb oficial (dataset 75; as planilhas trazem todas as edições; UF 0 = nacional)
 *   saeb-publish [anos] [UF,…]   (P10.4) publica os resultados agregados do Saeb (dataset 76)
 *   flow-register   (P10.4) confere o CRC e registra no manifesto os arquivos de rendimento, distorção, transição e INSE já baixados
 *   flow-publish [anos] [UF,…]   (P10.4) publica rendimento + distorção idade-série (dataset 77)
 *   trn-publish [anos] [UF,…]   (P10.4) publica as taxas de transição (dataset 78; ano = ano de origem)
 *   inse-publish [anos] [UF,…]   (P10.4) publica o INSE agregado (dataset 79; 2019, 2021, 2023)
 *   ctr-publish [anos] [UF,…]   (P10.7) publica os contratos educacionais do PNCP lidos do RAW já preservado (dataset 114; fatia UF × ano)
 *   ctr-compras-publish [anos] [UF,…]   (P10.7) publica as contratações (compras) dos contratos educacionais, do RAW complementar (dataset 115)
 *   ctr-termos-publish [anos] [UF,…]    (P10.7) publica os termos aditivos dos contratos educacionais (dataset 116)
 *   obras-publish [UF,…]                (P10.7) publica as obras educacionais do Obrasgov (dataset 117; fatia UF; competência = mês da coleta)
 *   register-docs     registra no manifesto os documentos jurídicos do INEP já copiados para raw/inep/docs
 *   measure [rótulo]  mede banco, tabelas/índices da Educação, change log, WAL (LSN e pasta pg_wal), C: livre, RAW e staging; acrescenta em <logs>/educacao-measure.jsonl
 * `anos` = 2021,2022 | 2007-2025 | all.
 */
const [cmd, a, b] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `educacao-${cmd}.jsonl`), m + '\n'); };
export function parseYears(v?: string): number[] {
  if (!v || v === 'all') return censoYears();
  if (/^\d{4}-\d{4}$/.test(v)) { const [x, y] = v.split('-').map(Number); return censoYears(x!, y!); }
  return v.split(',').map(Number);
}
const pool = openPool(3);
const WAL_DIR = process.env.EDU_WAL_DIR ?? 'C:/Program Files/PostgreSQL/17/data/pg_wal';
export async function measure(label: string) {
  const one = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows[0] as Record<string, unknown>;
  const edu = (await pool.query(`SELECT c.relname, pg_total_relation_size(c.oid)::bigint total, pg_relation_size(c.oid)::bigint heap, pg_indexes_size(c.oid)::bigint idx, c.reltuples::bigint est FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'civica_exec' AND c.relkind = 'r' AND c.relname LIKE 'exec_edu_%' ORDER BY c.relname`)).rows;
  const exact: Record<string, number> = {}; for (const t of edu) exact[String(t.relname)] = Number((await one(`SELECT count(*)::bigint n FROM civica_exec.${String(t.relname)}`)).n);
  let walBytes = 0, walFiles = 0; try { for (const f of await readdir(WAL_DIR)) { const st = await stat(join(WAL_DIR, f)); if (st.isFile()) { walBytes += st.size; walFiles++; } } } catch { /* sem acesso */ }
  const log = await one(`SELECT count(*)::bigint n, pg_total_relation_size('civica_exec.exec_change_log')::bigint bytes FROM civica_exec.exec_change_log`);
  const m = {
    at: new Date().toISOString(), label, dbBytes: Number((await one(`SELECT pg_database_size(current_database())::bigint b`)).b),
    execSchemaBytes: Number((await one(`SELECT sum(pg_total_relation_size(c.oid))::bigint b FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'civica_exec' AND c.relkind IN ('r','m')`)).b),
    eduTables: edu.map(t => ({ table: t.relname, rows: exact[String(t.relname)], totalBytes: Number(t.total), heapBytes: Number(t.heap), indexBytes: Number(t.idx) })),
    changeLogRows: Number(log.n), changeLogBytes: Number(log.bytes), walLsnBytes: Number((await one(`SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')::bigint b`)).b), walDirBytes: walBytes, walDirFiles: walFiles,
    cFreeBytes: await freeBytes('C:/Program Files/PostgreSQL/17/data'), dFreeBytes: await freeBytes(cfg.rawDir), rawInepBytes: await dirSize(join(cfg.rawDir, 'inep')), stagingEducacaoBytes: await dirSize(join(cfg.stagingDir, 'educacao')), stagingTotalBytes: await dirSize(cfg.stagingDir),
  };
  return m;
}
try {
  const t0 = Date.now();
  if (cmd === 'fetch') {
    const links = await discoverCensoLinks();
    for (const y of parseYears(a)) { const url = links.get(y); if (!url) throw new Error(`sem link para ${y}`); await fetchCensoEdition(pool, cfg, y, url, log); }
  } else if (cmd === 'migrate') log(JSON.stringify({ applied: await applyExecMigrations(pool) }));
  else if (cmd === 'measure') { const m = await measure(a ?? 'sem-rotulo'); log(JSON.stringify(m)); }
  else if (cmd === 'oferta-extract') { for (const y of parseYears(a)) { const f = await locateOfferFiles(cfg, y); const r = await extractOfferYear(cfg, f); log(JSON.stringify({ year: y, tsv: r.tsv, reused: r.reused, ...(r.summary ?? {}) })); } }
  else if (cmd === 'oferta-publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    for (const y of parseYears(a)) { const r = await collectOfferYear(pool, cfg, y, { ...(ufs ? { ufs } : {}), log }); log(JSON.stringify({ year: y, rowsIn: r.rowsIn, rejected: r.rejected, rejectReasons: r.rejectReasons, skippedNoOffer: r.skippedNoOffer, slices: r.slices.length, statuses: Object.fromEntries(r.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) })); }
  }
  else if (cmd === 'infra-extract') { for (const y of parseYears(a)) { const f = await locateInfraFiles(cfg, y); const r = await extractInfraYear(cfg, f); log(JSON.stringify({ year: y, tsv: r.tsv, reused: r.reused, ...(r.summary ? { rows: r.summary.rows, missing: r.summary.missing } : {}) })); } }
  else if (cmd === 'infra-publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    for (const y of parseYears(a)) { const r = await collectInfraYear(pool, cfg, y, { ...(ufs ? { ufs } : {}), log }); log(JSON.stringify({ year: y, rowsIn: r.rowsIn, rejected: r.rejected, rejectReasons: r.rejectReasons, notActive: r.notActive, slices: r.slices.length, statuses: Object.fromEntries(r.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) })); }
  }
  else if (cmd === 'ind-register') { const r = await registerIndFiles(pool, cfg, log); log(JSON.stringify({ registered: r.registered, missing: r.missing.length, missingFiles: r.missing.slice(0, 30) })); }
  else if (cmd === 'ind-extract') { const inv = await readIndInventory(); for (const y of parseYears(a)) for (const f of await locateIndFiles(cfg, y, inv)) { const r = await extractIndFile(cfg, f); log(JSON.stringify({ year: y, family: f.family, level: f.level, tsv: r.tsv, reused: r.reused, ...(r.summary ? { rows: r.summary.rows, cells: r.summary.cells, lossy: r.summary.lossy_x100 } : {}) })); } }
  else if (cmd === 'ind-publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    for (const y of parseYears(a)) { const r = await collectIndYear(pool, cfg, y, { ...(ufs ? { ufs } : {}), log }); log(JSON.stringify({ year: y, files: r.files, rejected: r.rejected, rejectReasons: r.rejectReasons, slices: r.slices.length, statuses: Object.fromEntries(r.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) })); }
  }
  else if (cmd === 'doc-prepare') { const n = await prepareDocFiles(pool, cfg, parseYears(a), log); log(JSON.stringify({ prepared: n })); }
  else if (cmd === 'doc-publish') { for (const y of parseYears(a)) await collectDocYear(pool, cfg, y, { log }); }
  else if (cmd === 'learn-register') { log(JSON.stringify({ registered: await registerLearnFiles(pool, cfg, log) })); }
  else if (cmd === 'ideb-publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    const ys = !a || a === 'all' ? [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025] : parseYears(a);
    for (const r of await collectIdeb(pool, cfg, ys, { ...(ufs ? { ufs } : {}), log })) log(JSON.stringify({ year: r.year, rejected: r.rejected, rejectReasons: r.rejectReasons, slices: r.slices.length, statuses: Object.fromEntries(r.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) }));
  }
  else if (cmd === 'saeb-publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    const ys = !a || a === 'all' ? [2017, 2019, 2021, 2023, 2025] : a.split(',').map(Number);
    for (const r of await collectSaeb(pool, cfg, ys, { ...(ufs ? { ufs } : {}), log })) log(JSON.stringify(r));
  }
  else if (cmd === 'flow-register') { log(JSON.stringify(await registerFlowFiles(pool, cfg, log))); }
  else if (cmd === 'flow-publish' || cmd === 'trn-publish') {
    const mode = cmd === 'trn-publish' ? 'trn' : 'flow'; const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    const ys = !a || a === 'all' ? flowYears(await readFlowInventory(), mode === 'trn' ? ['TRN'] : ['TXR', 'TDI']) : parseYears(a);
    for (const r of await collectFlow(pool, cfg, ys, { mode, ...(ufs ? { ufs } : {}), log })) log(JSON.stringify({ year: r.year, rejected: r.rejected, slices: r.slices.length }));
  }
  else if (cmd === 'inse-publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number); const ys = !a || a === 'all' ? [2019, 2021, 2023] : a.split(',').map(Number);
    for (const r of await collectInse(pool, cfg, ys, { ...(ufs ? { ufs } : {}), log })) log(JSON.stringify({ year: r.year, rejected: r.rejected, slices: r.slices.length }));
  }
  else if (cmd === 'ctr-publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number); const ys = !a || a === 'all' ? [2021, 2022, 2023, 2024, 2025, 2026] : parseYears(a);
    for (const y of ys) { const r = await publishEduContractYear(pool, cfg, y, { log, ...(ufs ? { ufs } : {}) }); log(JSON.stringify({ year: y, status: r.status, slices: r.slices, educacionais: r.educacionais, statuses: Object.fromEntries((r.results ?? []).reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) })); }
  }
  else if (cmd === 'ctr-compras-publish' || cmd === 'ctr-termos-publish') {
    const ys = !a || a === 'all' ? undefined : parseYears(a); const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    const res = cmd === 'ctr-compras-publish' ? await publishEduProcurement(pool, cfg, { log, ...(ys ? { years: ys } : {}), ...(ufs ? { ufs } : {}) }) : await publishEduTerms(pool, cfg, { log, ...(ys ? { years: ys } : {}), ...(ufs ? { ufs } : {}) });
    log(JSON.stringify({ slices: res.length, statuses: Object.fromEntries(res.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())), rows: res.reduce((n, x) => n + x.rows, 0), pending: res.reduce((n, x) => n + x.pending, 0) }));
  }
  else if (cmd === 'obras-publish') {
    const ufs = !a || a === 'all' ? undefined : a.split(',').map(Number); const r = await publishEduWorks(pool, cfg, { log, ...(ufs ? { ufs } : {}) });
    log(JSON.stringify({ stats: r.stats, incomplete: r.incomplete.length, slices: r.results.length, statuses: Object.fromEntries(r.results.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) }));
  }
  else if (cmd === 'register-docs') {
    const dir = join(cfg.rawDir, 'inep', 'docs', '2025');
    for (const f of await readdir(dir)) { const e = await registerLocalRaw(cfg, { url: `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2025_.zip#${f}`, relPath: `inep/docs/2025/${f}`, competence: 202505, uf: 0, retention: 1, dataset: 'inep_censo_escolar_docs_2025' }); await recordManifest(pool, e); log(JSON.stringify({ doc: f, sha256: e.sha256, bytes: e.bytes })); }
  }
  else if (cmd === 'extract') { for (const y of parseYears(a)) { const f = await locateCensoFiles(cfg, y); const r = await extractCensoYear(cfg, f); log(JSON.stringify({ year: y, tsv: r.tsv, ...r.summary })); } }
  else if (cmd === 'publish') {
    const ufs = !b || b === 'all' ? undefined : b.split(',').map(Number);
    for (const y of parseYears(a)) { const r = await collectEduYear(pool, cfg, y, { ...(ufs ? { ufs } : {}), log }); log(JSON.stringify({ year: y, rowsIn: r.rowsIn, rejected: r.rejected, slices: r.slices.length, statuses: Object.fromEntries(r.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) })); }
  } else if (cmd === 'higher-collect') {
    // The high-volume Censo Superior path uses psycopg2 COPY; all inputs remain on D:\Civica.
    execFileSync(process.env.PYTHON ?? 'python', ['scripts/exec/educacao-superior-p112.py', a ?? '2022,2023,2024'], { stdio: 'inherit', env: process.env });
  } else throw new Error('comando desconhecido');
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
