import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import {
  DATASET, FROTA_IDS, INFR_IDS, PRF_ALL_IDS, REN_ALL_IDS, REN_MUN_IDS, SIM_TRA_OCC_IDS, SIM_TRA_RES_IDS, SPECS, TRA_VERSION,
  buildFrotaSlice, buildInfrSlice, buildPrfSlice, buildRenaestSlice, buildSimTraOccurrence, buildSimTraResidence, buildTraCrosswalk, compactKey, publishSlice, replaceIndicatorsBulk, sha256,
  type EntityDir, type FrotaJson, type FrotaResult, type InfrJson, type InfrRow, type PrfJson, type PrfResult, type RenaestJson, type RenaestResult, type TraCov, type TraSimAgg, type TraSimResult, type TraXw,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { ALL_UFS, UF_ACRONYM, isFirstPublication, loadEntityDir, loadPopulation, locateSimFile, type Log, type SimFile } from './seguranca.ts';
import { assertCanDecode, assertVolume, fetchRaw, recordManifest, registerLocalRaw, runPython, type ManifestEntry, type StorageConfig } from './storage.ts';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SENATRAN = 'https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran';
const PRF_PAGE = 'https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-abertos-da-prf';
const CKAN_RENAEST = 'https://dados.transportes.gov.br/api/3/action/package_show?id=renaest';
const PY = { sim: 'scripts/exec/sim_transito_extract.py', frota: 'scripts/exec/frota_extract.py', prf: 'scripts/exec/prf_extract.py', renaest: 'scripts/exec/renaest_extract.py', infr: 'scripts/exec/infr_extract.py' };

// ------------------------------------------------------------------------------------------------ utilidades
const head = (h: Buffer, n = 64) => h.subarray(0, n).toString('latin1');
/** O portal gov.br devolve a página HTML (status 200) quando limita a taxa: nunca aceitar HTML como planilha/CSV. */
export const notHtml = (h: Buffer): boolean => h.length > 0 && !/^\s*(﻿|ï»¿)?<\s*(!doctype|html)/i.test(head(h));
export const isZipMagic = (h: Buffer): boolean => h.length > 3 && h[0] === 0x50 && h[1] === 0x4b;
const accent = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
async function httpText(url: string): Promise<string | null> {
  try { const r = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } }); return r.ok ? await r.text() : null; } catch { return null; }
}
/** Baixa com validação de conteúdo; o portal limita a taxa, então tenta de novo com espera crescente. */
export async function fetchChecked(cfg: StorageConfig, spec: Parameters<typeof fetchRaw>[1], tries = 4): Promise<ManifestEntry & { reused: boolean }> {
  let last: unknown;
  for (let i = 1; i <= tries; i++) {
    try { return await fetchRaw(cfg, { userAgent: BROWSER_UA, retries: 3, ...spec }); } catch (e) { last = e; if (/conteúdo inesperado|download falhou/.test(String(e))) await sleep(3000 * i); else throw e; }
  }
  throw last;
}
async function runExtract<T>(cfg: StorageConfig, script: string, input: string, cacheKey: string, extra: string[] = []): Promise<T> {
  await mkdir(cfg.stagingDir, { recursive: true });
  const cache = join(cfg.stagingDir, `${cacheKey}.json`);
  try { return JSON.parse(await readFile(cache, 'utf8')) as T; } catch { /* sem cache */ }
  const r = await runPython(script, [input, cache, '--tmp', cfg.stagingDir, ...extra]);
  if (r.code !== 0) throw new Error(`extração ${script} falhou: ${r.err.slice(0, 400)}`);
  return JSON.parse(await readFile(cache, 'utf8')) as T;
}
const canon = (rows: Array<Record<string, unknown>>) => rows.map(r => JSON.stringify(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)))).sort().join('\n');

/** Soma das partes (municípios + município ignorado) = linha da UF, por indicador e período. Falha interrompe e desfaz a publicação. */
export async function verifyParts(c: PoolClient, ufCode: number, ids: number[], from: string, to: string, label: string): Promise<void> {
  const r = await c.query(`SELECT count(*)::int AS bad FROM (
      SELECT v.indicator_id, v.period_start, coalesce(sum(v.value) FILTER (WHERE e.kind IN (4, 5)), 0) AS parts, max(v.value) FILTER (WHERE e.kind = 3) AS uf
      FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id
      WHERE e.uf_code = $1 AND v.indicator_id = ANY($2::smallint[]) AND v.period_start >= $3::date AND v.period_start < $4::date GROUP BY 1, 2) x
    WHERE x.uf IS NOT NULL AND abs(x.parts - x.uf) > 1e-6 * greatest(1, abs(x.uf))`, [ufCode, ids, from, to]);
  if (r.rows[0].bad) throw new Error(`reconciliação ${label} ${ufCode}: ${r.rows[0].bad} indicador-período com soma municipal ≠ total da UF`);
}

// ================================================================================================ SIM trânsito
export interface TraSimSliceArgs { ufCode: number; year: number; prelim: boolean; fileSha: string; relPath: string; built: TraSimResult; first: boolean; failAfterApply?: boolean }
export async function publishSimTraResidenceSlice(pool: Pool, a: TraSimSliceArgs) {
  return publishSlice(pool, {
    datasetId: DATASET.tra_sim_res, uf: a.ufCode, competence: a.year * 100 + 1, stage: a.prelim ? 1 : 2, sourceHash: sha256(`${a.fileSha}:${TRA_VERSION.sim}`), parserVersion: TRA_VERSION.sim, bootstrap: a.first,
    tables: [], inputs: { sim: a.fileSha, file: a.relPath }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: SIM_TRA_RES_IDS, ufCode: a.ufCode, from: `${a.year}-01-01`, to: `${a.year + 1}-01-01` }, a.built.rows, !a.first); },
    verify: async c => verifyParts(c, a.ufCode, [4001, 4002, 4003, 4004, 4011, 4012, 4013, 4014, 4015, 4016, 4017, 4018, 4019], `${a.year}-01-01`, `${a.year + 1}-01-01`, 'SIM trânsito'),
  });
}
async function extractSimTra(cfg: StorageConfig, f: SimFile): Promise<TraSimAgg> {
  const abs = join(cfg.rawDir, f.relPath); const s = await stat(abs);
  if (s.size !== f.bytes) throw new Error(`RAW ${f.relPath}: tamanho ${s.size} difere do manifesto (${f.bytes})`);
  await assertCanDecode(cfg, f.bytes);
  return runExtract<TraSimAgg>(cfg, PY.sim, abs, `simtra_${f.uf}_${f.year}_${f.sha256.slice(0, 12)}_${TRA_VERSION.simExtract}`, ['--year', String(f.year)]);
}
export interface TraSimYear { year: number; residence: Array<{ uf: string; status: string; rows?: number; tt?: number; firstTime?: boolean }>; occurrence: { status: string; rows?: number; reason?: string } }
export async function collectSimTransito(pool: Pool, cfg: StorageConfig, o: { year: number; ufs?: string[] | undefined; withOccurrence?: boolean; log?: Log }): Promise<TraSimYear> {
  await assertVolume(cfg);
  const { dir } = await loadEntityDir(pool); const pop = await loadPopulation(pool, o.year);
  const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS; const comp = o.year * 100 + 1;
  const out: TraSimYear = { year: o.year, residence: [], occurrence: { status: 'SKIPPED' } }; const aggs: TraSimAgg[] = []; const files: SimFile[] = [];
  for (const uf of ufs) {
    const f = await locateSimFile(cfg, uf, o.year);
    if (!f) { out.residence.push({ uf, status: 'SEM_ARQUIVO_NO_RAW' }); continue; }
    const agg = await extractSimTra(cfg, f); aggs.push(agg); files.push(f);
    const built = buildSimTraResidence(agg, f.ufCode, { year: o.year, prelim: f.prelim, dir, pop });
    const first = await isFirstPublication(pool, DATASET.tra_sim_res, f.ufCode, comp);
    const r = await publishSimTraResidenceSlice(pool, { ufCode: f.ufCode, year: o.year, prelim: f.prelim, fileSha: f.sha256, relPath: f.relPath, built, first });
    out.residence.push({ uf, status: r.status, rows: built.rows.length, tt: built.totals.TT, firstTime: first });
    o.log?.(JSON.stringify({ simtra: 'res', uf, year: o.year, status: r.status, rows: built.rows.length, totals: built.totals }));
  }
  if (o.withOccurrence !== false && ufs.length === 27) {
    if (files.length !== 27) out.occurrence = { status: 'INCOMPLETO', reason: `${files.length}/27 arquivos` };
    else {
      const prelim = files.some(f => f.prelim); const built = buildSimTraOccurrence(aggs, { year: o.year, prelim, dir, pop });
      const first = await isFirstPublication(pool, DATASET.tra_sim_occ, 0, comp);
      const r = await publishSlice(pool, {
        datasetId: DATASET.tra_sim_occ, uf: 0, competence: comp, stage: prelim ? 1 : 2, sourceHash: sha256(files.map(f => f.sha256).sort().join(',') + `:${TRA_VERSION.sim}:occ`), parserVersion: TRA_VERSION.sim, bootstrap: first, tables: [], inputs: { files: files.map(f => f.sha256) }, quality: built.quality,
        derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: SIM_TRA_OCC_IDS, ufCode: 0, from: `${o.year}-01-01`, to: `${o.year + 1}-01-01` }, built.rows, !first); },
      });
      out.occurrence = { status: r.status, rows: built.rows.length };
      o.log?.(JSON.stringify({ simtra: 'occ', year: o.year, status: r.status, rows: built.rows.length, totals: built.totals, quality: built.quality }));
    }
  }
  return out;
}

// ================================================================================================ Senatran frota
export interface FrotaItem { competence: number; file: string; url: string; title: string }
const MESES: Array<[string, number]> = [['janeiro', 1], ['fevereiro', 2], ['marco', 3], ['maro', 3], ['abril', 4], ['maio', 5], ['junho', 6], ['julho', 7], ['agosto', 8], ['setembro', 9], ['outubro', 10], ['novembro', 11], ['dezembro', 12]];
const ABBR: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
/** Mês a partir do nome do arquivo (nomes variam: "dezembro", "dez_15", "JUL2024", "Maro"). null se não identificável. */
export function frotaMonthOf(name: string): number | null {
  const s = accent(name);
  for (const [k, v] of MESES) if (s.includes(k)) return v;
  for (const t of s.split(/[^a-z]+/)) if (ABBR[t]) return ABBR[t]!;
  const m = /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[_-]?\d{4}/.exec(s);
  return m ? ABBR[m[1]!]! : null;
}
/** Extrai os arquivos "Frota por Município e Tipo" de uma página anual do Senatran. */
export function parseFrotaPage(html: string, year: number): FrotaItem[] {
  const out: FrotaItem[] = [];
  for (const m of html.matchAll(/<a [^>]*href="([^"]+@@download[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = m[1]!; const title = accent(m[2]!.replace(/<[^>]+>/g, '').trim()); const file = href.split('/@@')[0]!.split('/').pop()!; const fl = accent(file);
    const ok = title.startsWith('frota por municipio') || title.startsWith('02 - frota por municipio') || (title === '' && fl.includes('municipio') && fl.includes('tipo'));
    if (!ok || /restri|eixos|especie/.test(fl)) continue;
    const mes = frotaMonthOf(file) ?? frotaMonthOf(href.split('/@@')[0]!); if (!mes) continue;
    out.push({ competence: year * 100 + mes, file, url: href.startsWith('/') ? `https://www.gov.br${href}` : href, title });
  }
  return out;
}
/** Arquivos de frota por UF e tipo (conferência independente do total por UF). */
export function parseFrotaUfPage(html: string, year: number): FrotaItem[] {
  const out: FrotaItem[] = [];
  for (const m of html.matchAll(/<a [^>]*href="([^"]+@@download[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = m[1]!; const title = accent(m[2]!.replace(/<[^>]+>/g, '').trim()); const file = href.split('/@@')[0]!.split('/').pop()!;
    if (!(title.startsWith('frota por uf e tipo') || title.startsWith('frota por tipo de veiculo'))) continue;
    const mes = frotaMonthOf(file) ?? frotaMonthOf(href.split('/@@')[0]!); if (!mes) continue;
    out.push({ competence: year * 100 + mes, file, url: href.startsWith('/') ? `https://www.gov.br${href}` : href, title });
  }
  return out;
}
/** Um item por competência (prefere planilha a CSV; mantém a primeira ocorrência). */
export function pickFrota(items: FrotaItem[]): FrotaItem[] {
  const by = new Map<number, FrotaItem>();
  for (const it of items) { const cur = by.get(it.competence); if (!cur || (/\.csv$/i.test(cur.file) && !/\.csv$/i.test(it.file))) by.set(it.competence, it); }
  return [...by.values()].sort((a, b) => a.competence - b.competence);
}
export async function inventoryFrota(log?: Log): Promise<FrotaItem[]> {
  const all: FrotaItem[] = [];
  for (let y = 2013; y <= new Date().getFullYear(); y++) {
    const html = await httpText(`${SENATRAN}/frota-de-veiculos-${y}`); if (!html) { log?.(JSON.stringify({ frota: 'pagina_ausente', year: y })); continue; }
    all.push(...parseFrotaPage(html, y));
  }
  return pickFrota(all);
}
export interface FrotaSliceArgs { ufCode: number; competence: number; fileSha: string; relPath: string; built: FrotaResult; first: boolean; failAfterApply?: boolean }
export async function publishFrotaSlice(pool: Pool, a: FrotaSliceArgs) {
  const ps = `${Math.floor(a.competence / 100)}-${String(a.competence % 100).padStart(2, '0')}-01`; const next = a.competence % 100 === 12 ? `${Math.floor(a.competence / 100) + 1}-01-01` : `${Math.floor(a.competence / 100)}-${String(a.competence % 100 + 1).padStart(2, '0')}-01`;
  return publishSlice(pool, {
    datasetId: DATASET.tra_frota, uf: a.ufCode, competence: a.competence, stage: 2, sourceHash: sha256(`${a.fileSha}:${TRA_VERSION.frota}:${TRA_VERSION.crosswalk}`), parserVersion: TRA_VERSION.frota, bootstrap: a.first,
    tables: [{ spec: SPECS.tra_frota, rows: a.built.rows as unknown as Array<Record<string, unknown>> }], inputs: { file: a.relPath, sha256: a.fileSha }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: Object.values(FROTA_IDS), ufCode: a.ufCode, from: ps, to: next }, a.built.indicators, !a.first); },
    verify: async c => {
      const r = await c.query(`SELECT coalesce(sum(f.total), 0)::bigint AS t, count(*)::int AS n FROM civica_exec.exec_tra_frota_mun_mes f JOIN civica_exec.exec_entity e ON e.entity_id = f.entity_id WHERE e.uf_code = $1 AND f.competence = $2`, [a.ufCode, a.competence]);
      if (Number(r.rows[0].t) !== a.built.totals.total || Number(r.rows[0].n) !== a.built.rows.length) throw new Error(`reconciliação frota ${a.ufCode}/${a.competence}: banco ${r.rows[0].t}/${r.rows[0].n} × arquivo ${a.built.totals.total}/${a.built.rows.length}`);
    },
  });
}
export interface FrotaMonthResult { competence: number; sha256: string; reused: boolean; totalBrasil: number; ufs: Array<{ uf: string; status: string; total: number; entities: number; unmatched: string[] }> }
export async function collectFrota(pool: Pool, cfg: StorageConfig, o: { competences?: number[]; ufs?: string[] | undefined; log?: Log; inventory?: FrotaItem[] } = {}): Promise<FrotaMonthResult[]> {
  await assertVolume(cfg);
  const inv = o.inventory ?? await inventoryFrota(o.log); const latest = Math.max(...inv.map(i => i.competence));
  const { dir, ufByAcronym } = await loadEntityDir(pool); const xw = buildTraCrosswalk(dir, ufByAcronym);
  const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS; const out: FrotaMonthResult[] = [];
  for (const it of inv) {
    if (o.competences && !o.competences.includes(it.competence)) continue;
    const entry = await fetchChecked(cfg, { url: it.url, relPath: `transito/senatran-frota/${today()}/${it.competence}__${it.file}`, competence: it.competence, uf: 0, retention: 1, dataset: 'senatran_frota', dedupeByHash: true, accept: notHtml });
    await recordManifest(pool, entry);
    const json = await runExtract<FrotaJson>(cfg, PY.frota, join(cfg.rawDir, entry.relPath), `frota_${it.competence}_${entry.sha256.slice(0, 12)}_${TRA_VERSION.frota}`);
    const pop = await loadPopulation(pool, Math.floor(it.competence / 100)); const emit = it.competence % 100 === 12 || it.competence === latest;
    const res: FrotaMonthResult = { competence: it.competence, sha256: entry.sha256, reused: entry.reused, totalBrasil: 0, ufs: [] };
    for (const uf of ufs) {
      const ufCode = UF_CODE[uf]!; const built = buildFrotaSlice(json, ufCode, uf, it.competence, { dir, xw, pop, emitIndicators: emit });
      const first = await isFirstPublication(pool, DATASET.tra_frota, ufCode, it.competence);
      const r = await publishFrotaSlice(pool, { ufCode, competence: it.competence, fileSha: entry.sha256, relPath: entry.relPath, built, first });
      res.totalBrasil += built.totals.total!; res.ufs.push({ uf, status: r.status, total: built.totals.total!, entities: built.rows.length, unmatched: built.resolution.nao_conciliado });
    }
    o.log?.(JSON.stringify({ frota: it.competence, file: it.file, total: res.totalBrasil, status: [...new Set(res.ufs.map(u => u.status))], unmatched: res.ufs.flatMap(u => u.unmatched) }));
    out.push(res);
  }
  return out;
}

// ================================================================================================ PRF
/** Linha da página da PRF → ID do Drive do arquivo "agrupado por ocorrência" de cada ano (a página tem links repetidos: vale o primeiro com texto "Baixar planilha"). */
export function parsePrfPage(html: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...tr[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1]!); if (tds.length < 2) continue;
    const title = accent(tds[0]!.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim());
    const y = /acidentes (\d{4}) \(agrupados por ocorrencia\)/.exec(title); if (!y) continue;
    const a = [...tds[1]!.matchAll(/<a [^>]*href="[^"]*\/d\/([^/"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].find(x => /baixar/i.test(x[2]!.replace(/<[^>]+>/g, '')));
    if (a) out.set(Number(y[1]), a[1]!);
  }
  return out;
}
export interface PrfSliceArgs { ufCode: number; year: number; fileSha: string; relPath: string; built: PrfResult; first: boolean; failAfterApply?: boolean }
export async function publishPrfSlice(pool: Pool, a: PrfSliceArgs) {
  const content = sha256(canon(a.built.rows as unknown as Array<Record<string, unknown>>) + canon(a.built.cov as unknown as Array<Record<string, unknown>>));
  return publishSlice(pool, {
    datasetId: DATASET.tra_prf, uf: a.ufCode, competence: a.year * 100 + 1, stage: 2, sourceHash: sha256(`${a.fileSha}:${TRA_VERSION.prf}:${TRA_VERSION.crosswalk}:${content}`), parserVersion: TRA_VERSION.prf, bootstrap: a.first,
    tables: [{ spec: SPECS.tra_cov_prf, rows: a.built.cov as unknown as Array<Record<string, unknown>> }], inputs: { file: a.relPath, sha256: a.fileSha, year: a.year }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: PRF_ALL_IDS, ufCode: a.ufCode, from: `${a.year}-01-01`, to: `${a.year + 1}-01-01` }, a.built.rows, !a.first); },
    verify: async c => {
      await verifyParts(c, a.ufCode, [4621, 4622, 4623, 4624, 4625, 4626, 4627, 4628, 4629, 4630, 4631], `${a.year}-01-01`, `${a.year + 1}-01-01`, 'PRF anual');
      const r = await c.query(`SELECT count(*)::int AS bad FROM (SELECT m.indicator_id, sum(m.value) AS s FROM civica_exec.exec_ind_value m WHERE m.entity_id = $1 AND m.indicator_id BETWEEN 4601 AND 4611 AND m.period_start >= $2::date AND m.period_start < $3::date GROUP BY 1) x
        JOIN civica_exec.exec_ind_value y ON y.indicator_id = x.indicator_id + 20 AND y.entity_id = $1 AND y.period_start = $2::date WHERE abs(x.s - y.value) > 1e-6`, [a.ufCode, `${a.year}-01-01`, `${a.year + 1}-01-01`]);
      if (r.rows[0].bad) throw new Error(`reconciliação PRF ${a.ufCode}/${a.year}: soma mensal ≠ total anual em ${r.rows[0].bad} indicadores`);
    },
  });
}
export interface PrfYearResult { year: number; sha256: string; sinistrosFile: number; unknownUf: number; slices: Array<{ uf: string; status: string; sinistros: number; unmatched: number }> }
export async function collectPrf(pool: Pool, cfg: StorageConfig, o: { years?: number[]; ufs?: string[] | undefined; log?: Log; ids?: Map<number, string> } = {}): Promise<PrfYearResult[]> {
  await assertVolume(cfg);
  let ids = o.ids; if (!ids) { const html = await httpText(PRF_PAGE); if (!html) throw new Error('página de dados abertos da PRF indisponível'); ids = parsePrfPage(html); }
  const { dir, ufByAcronym } = await loadEntityDir(pool); const xw = buildTraCrosswalk(dir, ufByAcronym);
  const years = (o.years ?? [...ids.keys()]).sort((a, b) => a - b); const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS; const out: PrfYearResult[] = [];
  for (const year of years) {
    const id = ids.get(year); if (!id) { o.log?.(JSON.stringify({ prf: year, skipped: 'sem link na página' })); continue; }
    const entry = await fetchChecked(cfg, { url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, relPath: `transito/prf/${today()}/datatran${year}.zip`, competence: year * 100 + 1, uf: 0, retention: 1, dataset: 'prf_datatran', dedupeByHash: true, accept: isZipMagic });
    await recordManifest(pool, entry);
    const json = await runExtract<PrfJson>(cfg, PY.prf, join(cfg.rawDir, entry.relPath), `prf_${year}_${entry.sha256.slice(0, 12)}_${TRA_VERSION.prf}`, ['--year', String(year)]);
    if (json.other_year > 0 || json.bad_date > 0) throw new Error(`PRF ${year}: ${json.other_year} datas de outro ano e ${json.bad_date} inválidas — arquivo não corresponde ao ano do link`);
    const lastMonth = Math.max(...json.rows.map(r => r[2] as number)); const ufSet = new Set(Object.keys(UF_CODE));
    const res: PrfYearResult = { year, sha256: entry.sha256, sinistrosFile: json.sinistros, unknownUf: json.rows.filter(r => !ufSet.has(r[0] as string)).reduce((n, r) => n + (r[3] as number), 0), slices: [] };
    for (const uf of ufs) {
      const ufCode = UF_CODE[uf]!; const built = buildPrfSlice(json, uf, ufCode, year, { dir, xw, lastMonth, sourceSha: entry.sha256 });
      const first = await isFirstPublication(pool, DATASET.tra_prf, ufCode, year * 100 + 1);
      const r = await publishPrfSlice(pool, { ufCode, year, fileSha: entry.sha256, relPath: entry.relPath, built, first });
      res.slices.push({ uf, status: r.status, sinistros: built.totals.sinistros ?? 0, unmatched: Object.keys(built.resolution.nao_conciliado).length });
    }
    o.log?.(JSON.stringify({ prf: year, sinistrosFile: json.sinistros, unknownUf: res.unknownUf, sumUf: res.slices.reduce((n, s) => n + s.sinistros, 0), status: [...new Set(res.slices.map(s => s.status))] }));
    out.push(res);
  }
  return out;
}

// ================================================================================================ RENAEST
export interface RenaestResource { name: string; url: string; created: string; size: number; month: number }
/** Resource cumulativo mais recente do CKAN ("RENAEST - Mensal - MM-AAAA"). Os recursos são cumulativos: um só basta para todo o histórico. */
export function latestRenaestResource(pkg: { result: { resources: Array<{ name: string; url: string; created: string; size?: number | string }> } }): RenaestResource {
  const list = pkg.result.resources.map(r => { const m = /(\d{2})-(\d{4})/.exec(r.name); return m ? { name: r.name, url: r.url, created: r.created, size: Number(r.size ?? 0), month: Number(m[2]) * 100 + Number(m[1]) } : null; }).filter((x): x is RenaestResource => !!x);
  if (!list.length) throw new Error('CKAN do RENAEST sem recursos reconhecíveis');
  return list.sort((a, b) => b.month - a.month || b.created.localeCompare(a.created))[0]!;
}
export interface RenaestSliceArgs { ufCode: number; year: number; versionSha: string; built: RenaestResult; first: boolean; failAfterApply?: boolean }
export async function publishRenaestSlice(pool: Pool, a: RenaestSliceArgs) {
  const content = sha256(canon(a.built.rows as unknown as Array<Record<string, unknown>>) + canon(a.built.cov as unknown as Array<Record<string, unknown>>));
  return publishSlice(pool, {
    datasetId: DATASET.tra_renaest, uf: a.ufCode, competence: a.year * 100 + 1, stage: 2, sourceHash: sha256(`${TRA_VERSION.renaest}:${content}`), parserVersion: TRA_VERSION.renaest, bootstrap: a.first,
    tables: [{ spec: SPECS.tra_cov_renaest, rows: a.built.cov as unknown as Array<Record<string, unknown>> }], inputs: { version: a.versionSha, year: a.year }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: REN_ALL_IDS, ufCode: a.ufCode, from: `${a.year}-01-01`, to: `${a.year + 1}-01-01` }, a.built.rows, !a.first); },
    verify: async c => verifyParts(c, a.ufCode, REN_MUN_IDS, `${a.year}-01-01`, `${a.year + 1}-01-01`, 'RENAEST'),
  });
}
export interface RenaestRunResult { resource: RenaestResource; sha256: string; bytes: number; reusedAggregate: boolean; lastMonth: number; years: number[]; slices: Array<{ year: number; uf: string; status: string; sinistros: number }>; discarded: boolean }
/**
 * Baixa o pacote cumulativo, agrega em fluxo e DESCARTA o original (microdados com endereço, coordenadas e atributos de vítimas: sem política aprovada de retenção).
 * Ficam: hash, tamanho e URL no manifesto (state 3 = original descartado) e o agregado sem dado pessoal (`*.agg.json.gz`) no RAW, que permite reprocessar sem baixar.
 */
export async function collectRenaest(pool: Pool, cfg: StorageConfig, o: { ufs?: string[] | undefined; years?: number[]; log?: Log; resource?: RenaestResource; keepOriginal?: boolean } = {}): Promise<RenaestRunResult> {
  await assertVolume(cfg);
  let res = o.resource;
  if (!res) { const txt = await httpText(CKAN_RENAEST); if (!txt) throw new Error('CKAN do RENAEST indisponível'); res = latestRenaestResource(JSON.parse(txt)); }
  const dl = { ...cfg, rawDir: join(cfg.stagingDir, 'renaest-dl') }; await mkdir(dl.rawDir, { recursive: true });
  const rel = `renaest_${res.month}.zip`; const zipPath = join(dl.rawDir, rel);
  // reaproveita o agregado se este pacote já foi processado (o hash do original está no manifesto do banco)
  const entry = await fetchChecked(dl, { url: res.url, relPath: rel, competence: res.month, uf: 0, retention: 4, dataset: 'renaest_original', accept: isZipMagic }, 3);
  const aggKey = `renaest_${res.month}_${entry.sha256.slice(0, 12)}_${TRA_VERSION.renaest}`;
  const aggRel = `transito/renaest/${entry.sha256.slice(0, 16)}_${res.month}.agg.json.gz`;
  await assertCanDecode(cfg, entry.bytes);
  const json = await runExtract<RenaestJson>(cfg, PY.renaest, zipPath, aggKey, []);
  // agregado preservado no RAW (sem dado pessoal) + manifesto do original (descartado)
  await mkdir(join(cfg.rawDir, 'transito', 'renaest'), { recursive: true });
  const aggAbs = join(cfg.rawDir, aggRel); await writeFile(aggAbs, gzipSync(Buffer.from(JSON.stringify(json))));
  const aggEntry = await registerLocalRaw(cfg, { url: res.url, relPath: aggRel, competence: res.month, uf: 0, retention: 1, dataset: 'renaest_agg' }); await recordManifest(pool, aggEntry);
  await pool.query(`INSERT INTO civica_exec.exec_raw_manifest (run_id, source_url, rel_path, sha256, bytes, source_modified_at, competence, uf, fetched_at, state, retention_class)
    VALUES (NULL,$1,$2,$3,$4,NULL,$5,0,now(),3,4) ON CONFLICT (sha256) DO NOTHING`, [res.url, `(descartado) ${rel}`, Buffer.from(entry.sha256, 'hex'), entry.bytes, res.month]);
  let discarded = false; if (!o.keepOriginal) { await rm(zipPath, { force: true }); discarded = true; }
  const { dir } = await loadEntityDir(pool); const lastMonth = Math.max(...json.localidade.map(l => l[1]));
  const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS; const years = o.years ?? [...new Set(json.localidade.map(l => Math.floor(l[1] / 100)))].sort(); const slices: RenaestRunResult['slices'] = [];
  for (const year of years) for (const uf of ufs) {
    const ufCode = UF_CODE[uf]!; const built = buildRenaestSlice(json, uf, ufCode, year, { dir, lastMonth, sourceSha: entry.sha256 });
    const first = await isFirstPublication(pool, DATASET.tra_renaest, ufCode, year * 100 + 1);
    const r = await publishRenaestSlice(pool, { ufCode, year, versionSha: entry.sha256, built, first });
    slices.push({ year, uf, status: r.status, sinistros: built.cov.reduce((n, c) => n + c.records, 0) });
  }
  o.log?.(JSON.stringify({ renaest: res.name, month: res.month, status: slices.reduce((m, s) => { m[s.status] = (m[s.status] ?? 0) + 1; return m; }, {} as Record<string, number>), sinistros: slices.reduce((n, s) => n + s.sinistros, 0), original: discarded ? 'descartado' : 'mantido' }));
  return { resource: res, sha256: entry.sha256, bytes: entry.bytes, reusedAggregate: false, lastMonth, years, slices, discarded };
}

// ================================================================================================ Infrações Senatran
export interface InfrItem { competence: number; file: string; ext: 'csv' | 'xlsx'; url: string }
const INFR_MES: Array<[string, number]> = MESES;
/** Competência a partir do nome ("2019-01_infracoes…", "2022_05_…", "…emSETEMBROde2026…", "…Maro2024…"). */
export function infrMonthOf(file: string): number | null {
  const s = accent(file); const m = /^(\d{4})[-_](\d{2})_/.exec(s); if (m) return Number(m[1]) * 100 + Number(m[2]);
  const mm = INFR_MES.find(([k]) => s.includes(k)); const ys = [...s.matchAll(/(20\d\d)/g)].map(x => Number(x[1])); if (!mm || !ys.length) return null;
  return ys[ys.length - 1]! * 100 + mm[1];
}
const infrScore = (it: InfrItem) => (/^https:\/\/www\.gov\.br\//.test(it.url) ? 0 : 10) + (it.ext === 'csv' ? 0 : 1);
/** Todos os arquivos de infrações da página, ordenados por competência e preferência (gov.br antes de hosts antigos; CSV antes de XLSX). */
export function parseInfrPage(html: string): InfrItem[] {
  const out: InfrItem[] = [];
  for (const m of html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)) {
    const href = m[1]!; if (!/(@@download|\.(csv|xlsx)$)/i.test(href)) continue;
    const file = href.split('/@@')[0]!.split('/').pop()!; const fl = accent(file);
    if (fl.includes('tabela') || fl.includes('condutores') || !/\.(csv|xlsx)/.test(fl)) continue;
    const ym = infrMonthOf(file); if (!ym) continue;
    const it: InfrItem = { competence: ym, file, ext: /\.csv(\.csv)?$/.test(fl) ? 'csv' : 'xlsx', url: href.startsWith('/') ? `https://www.gov.br${href}` : href };
    if (!out.some(o => o.url === it.url)) out.push(it);
  }
  return out.sort((a, b) => a.competence - b.competence || infrScore(a) - infrScore(b));
}
/** Melhor candidato por competência. */
export function pickInfr(items: InfrItem[]): InfrItem[] { const by = new Map<number, InfrItem>(); for (const it of items) if (!by.has(it.competence)) by.set(it.competence, it); return [...by.values()]; }
export interface InfrSliceArgs { ufCode: number; competence: number; fileSha: string; relPath: string; rows: InfrRow[]; indicators: ReturnType<typeof buildInfrSlice>['indicators']; quality: Record<string, unknown>; first: boolean; failAfterApply?: boolean }
export async function publishInfrSlice(pool: Pool, a: InfrSliceArgs) {
  const ps = `${Math.floor(a.competence / 100)}-${String(a.competence % 100).padStart(2, '0')}-01`; const next = a.competence % 100 === 12 ? `${Math.floor(a.competence / 100) + 1}-01-01` : `${Math.floor(a.competence / 100)}-${String(a.competence % 100 + 1).padStart(2, '0')}-01`;
  const total = a.rows.reduce((n, r) => n + r.qtde, 0);
  return publishSlice(pool, {
    datasetId: DATASET.tra_infr, uf: a.ufCode, competence: a.competence, stage: 2, sourceHash: sha256(`${a.fileSha}:${TRA_VERSION.infr}`), parserVersion: TRA_VERSION.infr, bootstrap: a.first,
    tables: [{ spec: SPECS.tra_infr, rows: a.rows as unknown as Array<Record<string, unknown>> }], inputs: { file: a.relPath, sha256: a.fileSha }, quality: a.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: [INFR_IDS.total], ufCode: a.ufCode, from: ps, to: next }, a.indicators, !a.first); },
    verify: async c => {
      const r = await c.query(`SELECT coalesce(sum(qtde), 0)::bigint AS t FROM civica_exec.exec_tra_infr_uf_mes WHERE uf = $1 AND competence = $2`, [a.ufCode, a.competence]);
      if (Number(r.rows[0].t) !== total) throw new Error(`reconciliação infrações ${a.ufCode}/${a.competence}: banco ${r.rows[0].t} × arquivo ${total}`);
    },
  });
}
export interface InfrMonthResult { competence: number; sha256: string; layout: string; total: number; slices: Array<{ uf: string; status: string; total: number }>; unknownUfNames: string[] }
export async function collectInfracoes(pool: Pool, cfg: StorageConfig, o: { competences?: number[]; ufs?: string[] | undefined; log?: Log; inventory?: InfrItem[] } = {}): Promise<InfrMonthResult[]> {
  await assertVolume(cfg);
  let inv = o.inventory; if (!inv) { const html = await httpText(`${SENATRAN}/estatisticas-quantidade-de-infracoes-denatran`); if (!html) throw new Error('página de infrações do Senatran indisponível'); inv = parseInfrPage(html); }
  const r = await pool.query(`SELECT entity_id, name FROM civica_exec.exec_entity WHERE kind = 3`); const ufKey = new Map<string, number>(r.rows.map(x => [compactKey(String(x.name)), Number(x.entity_id)]));
  const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS; const out: InfrMonthResult[] = [];
  const groups = new Map<number, InfrItem[]>(); for (const it of inv) groups.set(it.competence, [...(groups.get(it.competence) ?? []), it]);
  for (const [competence, cands] of [...groups].sort((x, y) => x[0] - y[0])) {
    if (o.competences && !o.competences.includes(competence)) continue;
    let entry: Awaited<ReturnType<typeof fetchChecked>> | null = null; let it = cands[0]!;
    for (const c of cands) { try { entry = await fetchChecked(cfg, { url: c.url, relPath: `transito/senatran-infracoes/${today()}/${c.competence}__${c.file}`, competence: c.competence, uf: 0, retention: 1, dataset: 'senatran_infracoes', dedupeByHash: true, accept: notHtml }); it = c; break; } catch (e) { o.log?.(JSON.stringify({ infracoes: competence, candidato_falhou: c.url, erro: String(e instanceof Error ? e.message : e).slice(0, 160) })); } }
    if (!entry) throw new Error(`infrações ${competence}: nenhum arquivo candidato pôde ser baixado`);
    await recordManifest(pool, entry);
    const json = await runExtract<InfrJson>(cfg, PY.infr, join(cfg.rawDir, entry.relPath), `infr_${it.competence}_${entry.sha256.slice(0, 12)}_${TRA_VERSION.infr}`);
    const res: InfrMonthResult = { competence: it.competence, sha256: entry.sha256, layout: json.layout, total: 0, slices: [], unknownUfNames: [] };
    for (const uf of ufs) {
      const ufCode = UF_CODE[uf]!; const b = buildInfrSlice(json, ufCode, ufKey, it.competence); res.unknownUfNames = b.unknownUfNames;
      const first = await isFirstPublication(pool, DATASET.tra_infr, ufCode, it.competence);
      const p = await publishInfrSlice(pool, { ufCode, competence: it.competence, fileSha: entry.sha256, relPath: entry.relPath, rows: b.rows, indicators: b.indicators, quality: b.quality, first });
      res.total += b.total; res.slices.push({ uf, status: p.status, total: b.total });
    }
    o.log?.(JSON.stringify({ infracoes: it.competence, layout: json.layout, total: res.total, status: [...new Set(res.slices.map(s => s.status))] }));
    out.push(res);
  }
  return out;
}
export { UF_ACRONYM };
export type { EntityDir, TraCov, TraXw };
void createHash;
