import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import {
  DATASET, SEG_VERSION, SIM_OCC_IDS, SIM_RES_IDS, SPECS, VDE_DEFS, VDE_EVENTS, buildEntityDir, buildSimOccurrence, buildSimResidence, buildVdeCrosswalk, buildVdeSlice, findEmptyMonths,
  publishSlice, replaceIndicatorsBulk, seedSegurancaDefs, sha256, type CidGroup, type EntityDir, type EntityRow, type SimAgg, type VdeJson, type VdeCrosswalk,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { assertCanDecode, assertVolume, fetchRaw, readManifest, recordManifest, runPython, type ManifestEntry, type StorageConfig } from './storage.ts';

export type Log = (m: string) => void;
const SIM_PY = 'scripts/exec/sim_seg_extract.py';
const VDE_PY = 'scripts/exec/vde_extract.py';
const VDE_BASE = 'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download/dnsp-base-de-dados';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const UF_ACRONYM: Record<number, string> = Object.fromEntries(Object.entries(UF_CODE).map(([k, v]) => [v, k]));
const ALL_UFS = Object.keys(UF_CODE).sort((a, b) => UF_CODE[a]! - UF_CODE[b]!);

export async function loadEntityDir(q: Pick<Pool, 'query'>): Promise<{ dir: EntityDir; ufByAcronym: Map<string, number> }> {
  const r = await q.query(`SELECT e.entity_id, e.kind, e.ibge7, e.uf_code, e.uf, e.name, coalesce(v.evidence_ref LIKE '%NÃO comprovada%', false) AS unproven
    FROM civica_exec.exec_entity e LEFT JOIN civica_exec.exec_entity_version v ON v.entity_id = e.entity_id AND v.valid_to IS NULL WHERE e.kind IN (3, 4, 5)`);
  const ufByAcronym = new Map<string, number>(r.rows.filter(x => Number(x.kind) === 3).map(x => [String(x.uf), Number(x.uf_code)]));
  return { dir: buildEntityDir(r.rows.map(x => ({ entity_id: Number(x.entity_id), kind: Number(x.kind), ibge7: Number(x.ibge7), uf_code: x.uf_code == null ? null : Number(x.uf_code), name: String(x.name), unproven: !!x.unproven }) satisfies EntityRow)), ufByAcronym };
}
export async function loadPopulation(q: Pick<Pool, 'query'>, year: number): Promise<Map<number, number>> {
  const r = await q.query(`SELECT entity_id, value FROM civica_exec.exec_territory_population WHERE source = 1 AND year = $1`, [year]);
  return new Map(r.rows.map(x => [Number(x.entity_id), Number(x.value)]));
}
export async function isFirstPublication(pool: Pool, dataset: number, uf: number, competence: number): Promise<boolean> {
  return (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [dataset, uf, competence])).rowCount === 0;
}

// ===================================================================== SIM
export interface SimFile { uf: string; ufCode: number; year: number; relPath: string; sha256: string; bytes: number; prelim: boolean }
/** Localiza, no manifesto do RAW já preservado, o arquivo do SIM de uma UF e ano (definitivo tem precedência; entre preliminares, o mais recente). Não baixa nada. */
export async function locateSimFile(cfg: StorageConfig, uf: string, year: number): Promise<SimFile | null> {
  const ufCode = UF_CODE[uf]!; const m = [...(await readManifest(cfg)).values()].filter(e => e.dataset === 'sim' && e.competence === year * 100 + 1 && e.uf === ufCode && /\/DO[A-Z]{2}\d{4}\.dbc$/.test(e.relPath));
  const def = m.filter(e => e.relPath.includes('/definitivo/')).sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)).at(-1);
  const pre = m.filter(e => e.relPath.includes('/prelim/')).sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)).at(-1);
  const e = def ?? pre; if (!e) return null;
  return { uf, ufCode, year, relPath: e.relPath, sha256: e.sha256, bytes: e.bytes, prelim: !def };
}
export async function extractSim(cfg: StorageConfig, f: SimFile): Promise<SimAgg> {
  await mkdir(cfg.stagingDir, { recursive: true });
  const cache = join(cfg.stagingDir, `simseg_${f.uf}_${f.year}_${f.sha256.slice(0, 12)}_${SEG_VERSION.simExtract}.json`);
  try { return JSON.parse(await readFile(cache, 'utf8')) as SimAgg; } catch { /* sem cache */ }
  const abs = join(cfg.rawDir, f.relPath); const s = await stat(abs);
  if (s.size !== f.bytes) throw new Error(`RAW ${f.relPath}: tamanho ${s.size} difere do manifesto (${f.bytes})`);
  await assertCanDecode(cfg, f.bytes);
  const r = await runPython(SIM_PY, [abs, cache, '--year', String(f.year), '--tmp', cfg.stagingDir]);
  if (r.code !== 0) throw new Error(`extração SIM-segurança falhou (${f.relPath}): ${r.err.slice(0, 400)}`);
  return JSON.parse(await readFile(cache, 'utf8')) as SimAgg;
}

export interface SimResSliceArgs { ufCode: number; year: number; prelim: boolean; fileSha: string; relPath: string; built: ReturnType<typeof buildSimResidence>; first: boolean; failAfterApply?: boolean }
/** Publicação transacional de uma fatia de residência do SIM (UF × ano). Hash da fonte inclui a versão do parser: parser novo reprocessa. */
export async function publishSimResidenceSlice(pool: Pool, a: SimResSliceArgs) {
  return publishSlice(pool, {
    datasetId: DATASET.seg_sim_res, uf: a.ufCode, competence: a.year * 100 + 1, stage: a.prelim ? 1 : 2, sourceHash: sha256(`${a.fileSha}:${SEG_VERSION.sim}`), parserVersion: SEG_VERSION.sim, bootstrap: a.first,
    tables: [], inputs: { sim: a.fileSha, file: a.relPath }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: SIM_RES_IDS, ufCode: a.ufCode, from: `${a.year}-01-01`, to: `${a.year + 1}-01-01` }, a.built.rows, !a.first); },
    verify: async c => verifySimTotals(c, a.ufCode, a.year, [3001, 3002, 3003, 3004], a.built.totals),
  });
}
export interface VdeSliceArgs { ufCode: number; year: number; fileSha: string; relPath: string; built: ReturnType<typeof buildVdeSlice>; first: boolean; currentYear: number; failAfterApply?: boolean }
export async function publishVdeSlice(pool: Pool, a: VdeSliceArgs) {
  const ids = VDE_DEFS.map(d => d.id); const munIds = VDE_EVENTS.filter(e => e.level === 'M').flatMap(e => Object.values(e.abr) as number[]);
  return publishSlice(pool, {
    datasetId: DATASET.seg_vde, uf: a.ufCode, competence: a.year * 100 + 1, stage: a.year >= a.currentYear ? 1 : 2, sourceHash: sha256(`${a.fileSha}:${SEG_VERSION.vde}:${SEG_VERSION.crosswalk}`), parserVersion: SEG_VERSION.vde, bootstrap: a.first,
    tables: [{ spec: SPECS.seg_cov, rows: a.built.cov as unknown as Array<Record<string, unknown>> }], inputs: { file: a.relPath, sha256: a.fileSha, year: a.year }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: ids, ufCode: a.ufCode, from: `${a.year}-01-01`, to: `${a.year + 1}-01-01` }, a.built.rows, !a.first); },
    verify: async c => verifyVdeTotals(c, a.ufCode, a.year, munIds),
  });
}

const sumIds = (agg: Record<string, number>) => Object.values(agg).reduce((n, v) => n + v, 0);
export interface SimYearResult { year: number; residence: Array<{ uf: string; status: string; rows?: number; violent?: number; firstTime?: boolean }>; occurrence: { status: string; rows?: number; reason?: string } }

/** Publica um ano do SIM: 27 fatias de residência (uma por UF) + 1 fatia nacional de ocorrência. Reprocessar o mesmo arquivo não duplica (NO_CHANGE). */
export async function collectSimSeg(pool: Pool, cfg: StorageConfig, o: { year: number; ufs?: string[] | undefined; withOccurrence?: boolean; log?: Log }): Promise<SimYearResult> {
  await assertVolume(cfg);
  const { dir } = await loadEntityDir(pool); const pop = await loadPopulation(pool, o.year);
  const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS; const comp = o.year * 100 + 1;
  const res: SimYearResult = { year: o.year, residence: [], occurrence: { status: 'SKIPPED' } };
  const aggs: SimAgg[] = []; const files: SimFile[] = [];
  for (const uf of ufs) {
    const f = await locateSimFile(cfg, uf, o.year);
    if (!f) { res.residence.push({ uf, status: 'SEM_ARQUIVO_NO_RAW' }); continue; }
    const agg = await extractSim(cfg, f); aggs.push(agg); files.push(f);
    const built = buildSimResidence(agg, f.ufCode, { year: o.year, prelim: f.prelim, dir, pop });
    const first = await isFirstPublication(pool, DATASET.seg_sim_res, f.ufCode, comp);
    const r = await publishSimResidenceSlice(pool, { ufCode: f.ufCode, year: o.year, prelim: f.prelim, fileSha: f.sha256, relPath: f.relPath, built, first });
    res.residence.push({ uf, status: r.status, rows: built.rows.length, violent: sumIds(built.totals), firstTime: first });
    o.log?.(JSON.stringify({ sim: 'res', uf, year: o.year, status: r.status, rows: built.rows.length, totals: built.totals }));
  }
  if (o.withOccurrence !== false && ufs.length === 27) {
    if (files.length !== 27) res.occurrence = { status: 'INCOMPLETO', reason: `${files.length}/27 arquivos` };
    else {
      const prelim = files.some(f => f.prelim);
      const built = buildSimOccurrence(aggs, { year: o.year, prelim, dir, pop });
      const hash = sha256(files.map(f => f.sha256).sort().join(',') + `:${SEG_VERSION.sim}:occ`);
      const first = await isFirstPublication(pool, DATASET.seg_sim_occ, 0, comp);
      const r = await publishSlice(pool, {
        datasetId: DATASET.seg_sim_occ, uf: 0, competence: comp, stage: prelim ? 1 : 2, sourceHash: hash, parserVersion: SEG_VERSION.sim, bootstrap: first, tables: [], inputs: { files: files.map(f => f.sha256) }, quality: built.quality,
        derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: SIM_OCC_IDS, ufCode: 0, from: `${o.year}-01-01`, to: `${o.year + 1}-01-01` }, built.rows, !first); },
      });
      res.occurrence = { status: r.status, rows: built.rows.length };
      o.log?.(JSON.stringify({ sim: 'occ', year: o.year, status: r.status, rows: built.rows.length, totals: built.totals, quality: built.quality }));
    }
  }
  return res;
}
/** Soma dos municípios + município ignorado = linha da UF = total do arquivo (nenhuma perda por falta de município). */
async function verifySimTotals(c: PoolClient, ufCode: number, year: number, ids: number[], expected: Record<CidGroup, number>): Promise<void> {
  const r = await c.query(`SELECT v.indicator_id, sum(v.value) FILTER (WHERE e.kind IN (4, 5)) AS parts, max(v.value) FILTER (WHERE e.kind = 3) AS uf
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.uf_code = $1 AND v.indicator_id = ANY($2::smallint[]) AND v.period_start = $3::date GROUP BY 1`, [ufCode, ids, `${year}-01-01`]);
  const exp: Record<number, number> = { 3001: expected.AGR, 3002: expected.INT, 3003: expected.GUE, 3004: expected.IND };
  for (const x of r.rows) {
    const id = Number(x.indicator_id);
    if (Number(x.parts) !== Number(x.uf) || Number(x.uf) !== exp[id]) throw new Error(`reconciliação SIM ${ufCode}/${year} ind ${id}: municípios=${x.parts} UF=${x.uf} arquivo=${exp[id]}`);
  }
  if (r.rows.length !== ids.length) throw new Error(`reconciliação SIM: ${r.rows.length}/${ids.length} indicadores gravados`);
}

// ===================================================================== VDE
export interface VdeFile { year: number; entry: ManifestEntry; reused: boolean }
const nowYear = () => new Date().getFullYear();
/** Baixa (ou reutiliza por hash) o arquivo do ano. Fonte republicada com conteúdo diferente gera nova versão (pasta de data), nunca sobrescreve. */
export async function fetchVdeYear(pool: Pool, cfg: StorageConfig, year: number, log?: Log): Promise<VdeFile | null> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const entry = await fetchRaw(cfg, { url: `${VDE_BASE}/bancovde-${year}.xlsx`, relPath: `seguranca/sinesp-vde/${today}/bancovde-${year}.xlsx`, competence: year * 100 + 1, uf: 0, retention: 1, dataset: 'sinesp_vde', dedupeByHash: true, userAgent: BROWSER_UA });
    await recordManifest(pool, entry); return { year, entry, reused: entry.reused };
  } catch (e) { log?.(JSON.stringify({ vde: 'download', year, error: String(e instanceof Error ? e.message : e).slice(0, 200) })); return null; }
}
export async function extractVde(cfg: StorageConfig, f: VdeFile): Promise<VdeJson> {
  await mkdir(cfg.stagingDir, { recursive: true });
  const cache = join(cfg.stagingDir, `vde_${f.year}_${f.entry.sha256.slice(0, 12)}_${SEG_VERSION.vde}.json`);
  try { return JSON.parse(await readFile(cache, 'utf8')) as VdeJson; } catch { /* sem cache */ }
  const abs = join(cfg.rawDir, f.entry.relPath); await assertCanDecode(cfg, f.entry.bytes);
  const r = await runPython(VDE_PY, [abs, cache]);
  if (r.code !== 0) throw new Error(`extração VDE falhou (${f.year}): ${r.err.slice(0, 400)}`);
  return JSON.parse(await readFile(cache, 'utf8')) as VdeJson;
}
export interface VdeYearResult { year: number; sha256: string; reused: boolean; months: number[]; emptyMonths: number[]; slices: Array<{ uf: string; status: string; rows?: number; cov?: number; firstTime?: boolean }>; xw: { nonZeroKeys: number; direct: number; alias: number; unassigned: number; unmatched: string[] }; totalsByIndicator: Record<number, number> }

/** Publica um ano do VDE: 27 fatias (UF × ano). O arquivo reescrito pela fonte (hash novo) substitui a fatia inteira com change log. */
export async function collectVdeYear(pool: Pool, cfg: StorageConfig, f: VdeFile, o: { log?: Log; ufs?: string[] | undefined } = {}): Promise<VdeYearResult> {
  await assertVolume(cfg);
  const j = await extractVde(cfg, f); const { dir, ufByAcronym } = await loadEntityDir(pool); const xw = buildVdeCrosswalk(dir, ufByAcronym);
  const pop = await loadPopulation(pool, f.year); const empty = findEmptyMonths(j); const comp = f.year * 100 + 1;
  const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS;
  const out: VdeYearResult = { year: f.year, sha256: f.entry.sha256, reused: f.reused, months: j.competences.filter(m => !empty.has(m)), emptyMonths: [...empty], slices: [], xw: { nonZeroKeys: 0, direct: 0, alias: 0, unassigned: 0, unmatched: [] }, totalsByIndicator: {} };
  for (const uf of ufs) {
    const ufCode = UF_CODE[uf]!;
    const built = buildVdeSlice(j, { year: f.year, ufCode, ufAcronym: uf, dir, xw, pop, currentYear: nowYear(), emptyMonths: empty, ufByAcronym });
    const first = await isFirstPublication(pool, DATASET.seg_vde, ufCode, comp);
    const r = await publishVdeSlice(pool, { ufCode, year: f.year, fileSha: f.entry.sha256, relPath: f.entry.relPath, built, first, currentYear: nowYear() });
    out.slices.push({ uf, status: r.status, rows: built.rows.length, cov: built.cov.length, firstTime: first });
    out.xw.nonZeroKeys += built.xwStats.pairsNonZero; out.xw.direct += built.xwStats.matchedDirect; out.xw.alias += built.xwStats.matchedAlias; out.xw.unassigned += built.xwStats.unassignedName; out.xw.unmatched.push(...built.xwStats.unmatched.map(n => `${uf}:${n}`));
    for (const c of built.cov) out.totalsByIndicator[c.indicator_id] = (out.totalsByIndicator[c.indicator_id] ?? 0) + c.uf_total;
    o.log?.(JSON.stringify({ vde: f.year, uf, status: r.status, rows: built.rows.length, cov: built.cov.length }));
  }
  return out;
}
/** Por indicador municipal e mês: Σ(municípios + município ignorado) = linha da UF (a municipalização por nome não pode alterar o total estadual). */
async function verifyVdeTotals(c: PoolClient, ufCode: number, year: number, munIds: number[]): Promise<void> {
  const r = await c.query(`SELECT count(*)::int AS bad FROM (
      SELECT v.indicator_id, v.period_start, coalesce(sum(v.value) FILTER (WHERE e.kind IN (4, 5)), 0) AS parts, max(v.value) FILTER (WHERE e.kind = 3) AS uf
      FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id
      WHERE e.uf_code = $1 AND v.indicator_id = ANY($2::smallint[]) AND v.period_start >= $3::date AND v.period_start < $4::date AND v.period_end - v.period_start BETWEEN 28 AND 31 GROUP BY 1, 2) x
    WHERE x.uf IS NOT NULL AND abs(x.parts - x.uf) > 1e-6 * greatest(1, abs(x.uf))`, [ufCode, munIds, `${year}-01-01`, `${year + 1}-01-01`]);
  if (r.rows[0].bad) throw new Error(`reconciliação VDE ${ufCode}/${year}: ${r.rows[0].bad} indicador-mês com soma municipal ≠ total da UF`);
}

export async function seedSeguranca(pool: Pool): Promise<number> { return seedSegurancaDefs(pool); }
export { ALL_UFS };
