import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import {
  DATASET, PRI_ADDITIVE_IDS, PRI_IDS, PRI_VERSION, SPECS, buildPriNational, buildPriSlice, checkCycle, publishSlice, replaceIndicatorsBulk, resolveIdentities, semesterOfRef, seedPrisionalDefs, sha256,
  type EntityDir, type PriAgg, type PriChecked, type PriCycleJson, type PriResolved, type PriSlice, type Semester,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { ALL_UFS, isFirstPublication, loadEntityDir } from './seguranca.ts';
import { loadEntities } from './efetivos.ts';
import { assertCanDecode, assertVolume, fetchRaw, recordManifest, runPython, type ManifestEntry, type StorageConfig } from './storage.ts';

export type Log = (m: string) => void;
const BASE = 'https://www.gov.br/senappen/pt-br/servicos/sisdepen/bases-de-dados';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
/** Os 19 ciclos semestrais publicados (2016/2 a 2025/2). Os arquivos 2014, 2015 e "2016_basefinal_depen" são o formato anterior (INFOPEN) e não fazem parte do contrato. */
export const PRI_CYCLES: Array<{ cycle: number; ref: string; path: string }> = [
  [1, '2016/2', '2016/1o-ciclo-base-de-dados-2016-2-semestre.csv'], [2, '2017/1', '2017/2o-ciclo-base-de-dados-2017-1-semestre.csv'], [3, '2017/2', '2017/3o-ciclo-base-de-dados-2017-2-semestre.csv'],
  [4, '2018/1', '2018/4o-ciclo-base-de-dados-2018-1-semestre.csv'], [5, '2018/2', '2018/5o-ciclo-base-de-dados-2018-2-semestre.csv'], [6, '2019/1', '2019/6o-ciclo-base-de-dados-2019-1-semestre.csv'],
  [7, '2019/2', '2019/7o-ciclo-base-de-dados-2019-2-semestre.csv'], [8, '2020/1', '2020/8o-ciclo-base-de-dados-2020-1-semestre.csv'], [9, '2020/2', '2020/9o-ciclo-base-de-dados-2020-2-semestre.csv'],
  [10, '2021/1', '2021/10o-ciclo-base-de-dados-2021-1-semestre.csv'], [11, '2021/2', '2021/11o-ciclo-base-de-dados-2021-2-semestre.csv'], [12, '2022/1', '2022/12o-ciclo-base-de-dados-2022-1-semestre.csv'],
  [13, '2022/2', '2022/13o-ciclo-base-de-dados-2022-2-semestre.csv'], [14, '2023/1', '2023/14o-ciclo-base-de-dados-2023-1-semestre.csv'], [15, '2023/2', '2023/15o-ciclo-base-de-dados-2023-2-semestre.csv'],
  [16, '2024/1', '2024/16o-ciclo-base-de-dados-2024-1-semestre-retificado.csv'], [17, '2024/2', '2024/17o-ciclo-base-de-dados-2024-2-semestre.csv'], [18, '2025/1', '2025/18o-ciclo-base-de-dados-2025-1-semestre-retificado.csv'],
  [19, '2025/2', '2025/19o-ciclo-base-de-dados-2025-2-semestre.csv'],
].map(([cycle, ref, path]) => ({ cycle: cycle as number, ref: ref as string, path: path as string }));

export interface PriFile { cycle: number; ref: string; entry: ManifestEntry; reused: boolean }
/** Baixa (ou reutiliza por hash) o CSV oficial do ciclo para o RAW. O portal devolve HTML quando limita a taxa: a assinatura do cabeçalho é conferida. */
export async function fetchPriCycle(pool: Pool, cfg: StorageConfig, c: { cycle: number; ref: string; path: string }, log?: Log, urlBase = BASE): Promise<PriFile> {
  await assertVolume(cfg); const s = semesterOfRef(c.ref);
  const entry = await fetchRaw(cfg, { url: `${urlBase}/${c.path}/@@download/file`, relPath: `seguranca/prisional/sisdepen/${c.ref.replace('/', '-')}/${c.path.split('/').pop()!}`, competence: s.competence, uf: 0, retention: 1, dataset: `sisdepen_c${c.cycle}`, dedupeByHash: false, userAgent: UA,
    accept: head => head.subarray(0, 6).toString('latin1').replace(/^\xEF\xBB\xBF/, '').startsWith('ciclo;') || head.toString('latin1').includes('ciclo;Ano;') });
  await recordManifest(pool, entry); log?.(JSON.stringify({ prisional: 'raw', cycle: c.cycle, ref: c.ref, sha256: entry.sha256, bytes: entry.bytes, reused: entry.reused }));
  return { cycle: c.cycle, ref: c.ref, entry, reused: entry.reused };
}
export async function extractPriCycle(cfg: StorageConfig, f: PriFile): Promise<PriCycleJson> {
  await mkdir(cfg.stagingDir, { recursive: true });
  const cache = join(cfg.stagingDir, `pri_${f.cycle}_${f.entry.sha256.slice(0, 12)}_${PRI_VERSION.parser}.json`);
  try { return JSON.parse(await readFile(cache, 'utf8')) as PriCycleJson; } catch { /* sem cache */ }
  await assertCanDecode(cfg, f.entry.bytes);
  const r = await runPython('scripts/exec/sisdepen_extract.py', [join(cfg.rawDir, f.entry.relPath), cache]);
  if (r.code !== 0) throw new Error(`extração SISDEPEN ciclo ${f.cycle} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return JSON.parse(await readFile(cache, 'utf8')) as PriCycleJson;
}

export interface PriLoaded { file: PriFile; checked: PriChecked }
export async function loadAllCycles(pool: Pool, cfg: StorageConfig, o: { log?: Log; cycles?: typeof PRI_CYCLES } = {}): Promise<PriLoaded[]> {
  const out: PriLoaded[] = [];
  for (const c of o.cycles ?? PRI_CYCLES) { const file = await fetchPriCycle(pool, cfg, c, o.log); const j = await extractPriCycle(cfg, file); out.push({ file, checked: checkCycle(j, c.ref) }); }
  return out;
}
/** Resolução de identidade sobre TODOS os ciclos carregados (identidade é uma propriedade da série, não de um ciclo isolado). */
export function resolveAll(loaded: PriLoaded[]): PriResolved { return resolveIdentities(loaded.map(l => ({ semester: l.checked.semester, rows: l.checked.rows }))); }

const sliceFingerprint = (l: PriLoaded, resolved: PriResolved, uf: string) => sha256(`${l.file.entry.sha256}:${PRI_VERSION.publish}:${PRI_VERSION.identity}:` + JSON.stringify(l.checked.rows.filter(r => r.uf === uf).map(r => { const a = resolved.assigns.get(`${l.checked.semester.competence}:${r.row}`)!; return [r.row, a.unitId, a.method]; })));

export interface PriPublishArgs { loaded: PriLoaded; ufAcronym: string; ufCode: number; slice: PriSlice; fingerprint: string; first: boolean; failAfterApply?: boolean }
export async function publishPriUfSlice(pool: Pool, a: PriPublishArgs) {
  const w = a.loaded.checked.semester;
  return publishSlice(pool, {
    datasetId: DATASET.pri_uf, uf: a.ufCode, competence: w.competence, stage: 2, sourceHash: a.fingerprint, parserVersion: PRI_VERSION.publish, bootstrap: a.first,
    tables: [{ spec: SPECS.pri_unit, rows: dedupeUnits(a.slice.units) }, { spec: SPECS.pri_obs, rows: a.slice.obs }, { spec: SPECS.pri_fact, rows: a.slice.facts }, { spec: SPECS.pri_xwalk, rows: a.slice.xwalk }, { spec: SPECS.pri_cov, rows: a.slice.cov }],
    inputs: { cycle: w.cycle, ref: w.ref, file: a.loaded.file.entry.relPath, sha256: a.loaded.file.entry.sha256, uf: a.ufAcronym }, quality: a.slice.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: PRI_IDS, ufCode: a.ufCode, from: w.start, to: w.end }, a.slice.indicators, !a.first); },
    verify: async c => verifyUfSlice(c, a.ufCode, w, a.slice),
  });
}
const dedupeUnits = (rows: Array<Record<string, unknown>>) => [...new Map(rows.map(r => [r.unit_id, r])).values()];
/** Σ municípios + não conciliados = UF (indicadores aditivos) e Σ população dos fatos (celas físicas estaduais) = indicador da UF. */
async function verifyUfSlice(c: PoolClient, ufCode: number, w: Semester, s: PriSlice): Promise<void> {
  const r = await c.query(`SELECT v.indicator_id, coalesce(sum(v.value) FILTER (WHERE e.kind = 4), 0)::float8 AS mun, max(v.value) FILTER (WHERE e.kind = 3)::float8 AS uf
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.uf_code = $1 AND v.indicator_id = ANY($2::smallint[]) AND v.period_start = $3::date GROUP BY 1`, [ufCode, PRI_ADDITIVE_IDS, w.start]);
  const bad: string[] = [];
  for (const x of r.rows) { const un = s.unassigned[Number(x.indicator_id)] ?? 0; if (Math.abs(Number(x.mun) + un - Number(x.uf)) > 1e-6) bad.push(`${x.indicator_id}: municípios ${x.mun} + não conciliados ${un} ≠ UF ${x.uf}`); }
  const f = await c.query(`SELECT coalesce(sum(f.value), 0)::float8 AS pop FROM civica_exec.exec_pri_fact f JOIN civica_exec.exec_pri_obs o ON o.unit_id = f.unit_id AND o.competence = f.competence
    WHERE o.competence = $1 AND o.uf = $2 AND o.tipo = 1 AND o.ambito = 1 AND f.measure_id = 243`, [w.competence, ufCode]);
  if (Number(f.rows[0].pop) !== s.agg.popE) bad.push(`população das celas físicas estaduais nos fatos ${f.rows[0].pop} ≠ agregado ${s.agg.popE}`);
  if (bad.length) throw new Error(`reconciliação prisional ${ufCode}/${w.ref}: ${bad.join('; ')}`);
}
export async function publishPriNational(pool: Pool, a: { loaded: PriLoaded; rows: ReturnType<typeof buildPriNational>; fingerprint: string; first: boolean; failAfterApply?: boolean }) {
  const w = a.loaded.checked.semester;
  return publishSlice(pool, {
    datasetId: DATASET.pri_br, uf: 0, competence: w.competence, stage: 2, sourceHash: a.fingerprint, parserVersion: PRI_VERSION.publish, bootstrap: a.first, tables: [],
    inputs: { cycle: w.cycle, ref: w.ref, sha256: a.loaded.file.entry.sha256 }, quality: { ref: w.ref, rows: a.rows.length }, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: PRI_IDS, ufCode: 0, from: w.start, to: w.end, nationalOnly: true }, a.rows, !a.first); },
    verify: async c => {
      const r = await c.query(`SELECT v.indicator_id, sum(v.value) FILTER (WHERE e.kind = 3)::float8 AS ufs, max(v.value) FILTER (WHERE e.kind = 1)::float8 AS br FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id
        WHERE v.indicator_id = ANY($1::smallint[]) AND v.period_start = $2::date GROUP BY 1`, [PRI_ADDITIVE_IDS, w.start]);
      const bad = r.rows.filter(x => x.br != null && Math.abs(Number(x.ufs) - Number(x.br)) > 1e-6).map(x => `${x.indicator_id}: Σ UFs ${x.ufs} ≠ Brasil ${x.br}`);
      if (bad.length) throw new Error(`reconciliação prisional Brasil ${w.ref}: ${bad.join('; ')}`);
    },
  });
}

export interface PriRunResult { ref: string; uf: string; status: string; rows?: number; units?: number }
/** Publica os ciclos pedidos (padrão: todos) para as UFs pedidas (padrão: 27) e a fatia nacional do ciclo quando as 27 UFs foram publicadas. */
export async function collectPrisional(pool: Pool, cfg: StorageConfig, o: { cycles?: number[]; ufs?: string[]; log?: Log; loaded?: PriLoaded[]; failAfterApply?: boolean } = {}): Promise<{ results: PriRunResult[]; national: Array<{ ref: string; status: string }>; resolved: PriResolved }> {
  await assertVolume(cfg);
  const loaded = o.loaded ?? await loadAllCycles(pool, cfg, { ...(o.log ? { log: o.log } : {}) }); const resolved = resolveAll(loaded);
  const { dir } = await loadEntityDir(pool); const ents = await loadEntities(pool); const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS;
  const results: PriRunResult[] = []; const national: Array<{ ref: string; status: string }> = [];
  const sorted = [...loaded].sort((a, b) => a.checked.semester.competence - b.checked.semester.competence);
  for (const l of sorted) {
    if (o.cycles?.length && !o.cycles.includes(l.checked.semester.cycle)) continue;
    const w = l.checked.semester; const aggs: PriAgg[] = []; const idx = sorted.indexOf(l);
    for (const uf of ALL_UFS) {
      const ufCode = UF_CODE[uf]!; const prev = idx > 0 ? (resolved.seen.get(sorted[idx - 1]!.checked.semester.competence) ?? new Set<number>()) : new Set<number>();
      const slice = buildPriSlice(l.checked, { ufAcronym: uf, ufCode, ufEntity: ents.ufEntityByCode.get(ufCode)!, dir: dir as EntityDir, resolved, prevUnits: prev }); aggs.push(slice.agg);
      if (!ufs.includes(uf)) continue;
      const first = await isFirstPublication(pool, DATASET.pri_uf, ufCode, w.competence);
      const r = await publishPriUfSlice(pool, { loaded: l, ufAcronym: uf, ufCode, slice, fingerprint: sliceFingerprint(l, resolved, uf), first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
      results.push({ ref: w.ref, uf, status: r.status, rows: slice.facts.length, units: slice.obs.length }); o.log?.(JSON.stringify({ prisional: 'uf', ref: w.ref, uf, status: r.status, units: slice.obs.length, facts: slice.facts.length }));
    }
    if (ufs.length === 27) {
      const rows = buildPriNational(aggs, ents.brEntity, w); const first = await isFirstPublication(pool, DATASET.pri_br, 0, w.competence);
      const fp = sha256(`${l.file.entry.sha256}:${PRI_VERSION.publish}:${PRI_VERSION.identity}:br`); const r = await publishPriNational(pool, { loaded: l, rows, fingerprint: fp, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
      national.push({ ref: w.ref, status: r.status }); o.log?.(JSON.stringify({ prisional: 'br', ref: w.ref, status: r.status, rows: rows.length }));
    }
  }
  return { results, national, resolved };
}
export async function seedPrisional(pool: Pool): Promise<number> { return seedPrisionalDefs(pool); }
