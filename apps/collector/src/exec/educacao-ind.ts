import { createReadStream } from 'node:fs';
import { readFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Pool } from 'pg';
import {
  DATASET, IND_MEASURES, IND_VERSION, SPECS, buildIndYear, indCompetence, indSliceFingerprint, publishSlice, sha256,
  type IndEntities, type IndFamily, type IndFileLevel, type IndFileRows, type IndRawRow, type IndSlice, type PublishResult,
} from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, assertZipIntact, readManifest, recordManifest, registerLocalRaw, runPython, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

export type Log = (m: string) => void;
export const IND_PAGE_FAMILY: Record<string, IndFamily> = {
  'media-de-alunos-por-turma': 'ATU', 'media-de-horas-aula-diaria': 'HAD', 'percentual-de-docentes-com-curso-superior': 'DSU', 'adequacao-da-formacao-docente': 'AFD',
  'esforco-docente': 'IED', 'regularidade-do-corpo-docente': 'IRD', 'complexidade-de-gestao-da-escola': 'ICG',
};
const LEVEL_OF: Record<string, IndFileLevel> = { ESCOLAS: 'escolas', MUNICIPIOS: 'municipios', BRASIL_REGIOES_UFS: 'uf' };
export const IND_REL_DIR = 'inep/indicadores/arquivos';
export interface IndInventoryRow { family: IndFamily; level: IndFileLevel; year: number; file: string; url: string }

/** Inventário oficial dos arquivos (investigação P10), restrito às sete famílias da P10.3 e aos níveis escola, município e UF/Brasil/regiões. */
export async function readIndInventory(csvPath = 'docs/executivo-collector-plan/educacao-p10/inep_indicadores_arquivos.csv'): Promise<IndInventoryRow[]> {
  const lines = (await readFile(csvPath, 'utf8')).split(/\r?\n/).filter(Boolean); const out: IndInventoryRow[] = [];
  for (const l of lines.slice(1)) {
    const [page, file, ano, nivel, url] = l.split(',');
    const family = IND_PAGE_FAMILY[page ?? '']; const level = LEVEL_OF[nivel ?? ''];
    if (!family || !level || !/^\d{4}$/.test(ano ?? '')) continue;
    out.push({ family, level, year: Number(ano), file: file!, url: url! });
  }
  return out;
}

/** Registra no manifesto (arquivo e banco) os ZIPs já baixados, depois de conferir o CRC. Não baixa nada. */
export async function registerIndFiles(pool: Pool, cfg: StorageConfig, log: Log): Promise<{ registered: number; missing: string[] }> {
  const inv = await readIndInventory(); const present = new Set(await readdir(join(cfg.rawDir, IND_REL_DIR))); let registered = 0; const missing: string[] = [];
  for (const r of inv) {
    if (!present.has(r.file)) { missing.push(r.file); continue; }
    const rel = `${IND_REL_DIR}/${r.file}`; await assertZipIntact(cfg, rel);
    const e = await registerLocalRaw(cfg, { url: r.url, relPath: rel, competence: r.year * 100 + 5, uf: 0, retention: 1, dataset: 'edu_ind' });
    await recordManifest(pool, e); registered++;
    log(JSON.stringify({ ind: 'registered', file: r.file, bytes: e.bytes }));
  }
  return { registered, missing };
}

export interface IndFiles { family: IndFamily; level: IndFileLevel; year: number; relPaths: string[]; sha256: string[]; bytes: number }
export async function locateIndFiles(cfg: StorageConfig, year: number, inv: IndInventoryRow[]): Promise<IndFiles[]> {
  const man = await readManifest(cfg); const out: IndFiles[] = [];
  const groups = new Map<string, IndInventoryRow[]>();
  for (const r of inv.filter(x => x.year === year)) groups.set(`${r.family}|${r.level}`, [...(groups.get(`${r.family}|${r.level}`) ?? []), r]);
  for (const [k, rows] of groups) {
    const [family, level] = k.split('|') as [IndFamily, IndFileLevel];
    const es = rows.map(r => man.get(`${IND_REL_DIR}/${r.file}`)).filter((x): x is NonNullable<typeof x> => !!x);
    if (es.length !== rows.length) throw new Error(`Indicadores ${family}/${level}/${year}: arquivo não registrado no manifesto (rode "educacao-pilot ind-register")`);
    out.push({ family, level, year, relPaths: es.map(x => x.relPath), sha256: es.map(x => x.sha256), bytes: es.reduce((n, x) => n + x.bytes, 0) });
  }
  return out.sort((a, b) => a.family.localeCompare(b.family) || a.level.localeCompare(b.level));
}

export interface IndSummary { family: string; level: string; year: number; rows: number; cells: { numeric: number; dash: number; empty: number }; lossy_x100: number; sheets: unknown[]; codes: Record<string, string[]> }
export async function extractIndFile(cfg: StorageConfig, f: IndFiles): Promise<{ tsv: string; reused: boolean; summary: IndSummary | null }> {
  const dir = join(cfg.stagingDir, 'educacao'); await mkdir(dir, { recursive: true });
  const tsv = join(dir, `ind_${f.family}_${f.level}_${f.year}_${f.sha256.map(s => s.slice(0, 8)).join('')}_${IND_VERSION.parser}.tsv`);
  try { await stat(tsv); return { tsv, reused: true, summary: null }; } catch { /* sem cache */ }
  await assertCanDecode(cfg, 120 * 1024 * 1024);
  const r = await runPython('scripts/exec/censo_ind_extract.py', [f.family, f.level, String(f.year), tsv, ...f.relPaths.map(p => join(cfg.rawDir, p))]);
  if (r.code !== 0) throw new Error(`extração de ${f.family}/${f.level}/${f.year} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return { tsv, reused: false, summary: JSON.parse(r.out.trim().split('\n').at(-1)!) as IndSummary };
}

export async function readIndTsv(path: string, level: IndFileLevel): Promise<IndRawRow[]> {
  const rows: IndRawRow[] = []; let cols: string[] | null = null; const skip = level === 'escolas' ? 2 : 4;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (!cols) { cols = line.split('\t'); continue; }
    if (!line) continue;
    const p = line.split('\t'); const v: Record<string, string> = {};
    for (let i = skip; i < cols.length; i++) v[cols[i]!] = p[i] ?? '';
    rows.push(level === 'escolas' ? { row: Number(p[0]), inep: p[1] ?? '', v } : level === 'municipios' ? { row: Number(p[0]), ibge7: p[1] ?? '', loc: p[2] ?? '', dep: p[3] ?? '', v } : { row: Number(p[0]), geo: p[1] ?? '', loc: p[2] ?? '', dep: p[3] ?? '', v });
  }
  return rows;
}

const strip = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export async function loadIndContext(pool: Pick<Pool, 'query'>, year: number): Promise<{ cadastro: Map<number, number>; ent: IndEntities }> {
  const cad = await pool.query(`SELECT y.inep, e.uf_code FROM civica_exec.exec_edu_school_year y JOIN civica_exec.exec_entity e ON e.entity_id = y.entity_id WHERE y.year = $1`, [year]);
  const ents = await pool.query(`SELECT entity_id, kind, ibge7, ibge6, uf_code, uf, name FROM civica_exec.exec_entity WHERE kind IN (1, 2, 3, 4, 5)`);
  const byIbge7 = new Map<number, { entityId: number; uf: number }>(); const byIbge6 = new Map<number, { entityId: number; uf: number }>(); const geo = new Map<string, { entityId: number; uf: number }>();
  for (const e of ents.rows) {
    if (e.kind === 4 || e.kind === 5) { byIbge7.set(Number(e.ibge7), { entityId: Number(e.entity_id), uf: Number(e.uf_code) }); if (e.kind === 4 && e.ibge6) byIbge6.set(Number(e.ibge6), { entityId: Number(e.entity_id), uf: Number(e.uf_code) }); continue; }
    const target = { entityId: Number(e.entity_id), uf: e.kind === 3 ? Number(e.uf_code) : 0 };
    geo.set(strip(String(e.name)), target); if (e.kind === 3 && e.uf) geo.set(strip(String(e.uf)), target); geo.set(String(e.entity_id), target);
  }
  return { cadastro: new Map(cad.rows.map(r => [Number(r.inep), Number(r.uf_code)])), ent: { byIbge7, byIbge6, geo } };
}

const SCOPE_UF = `SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2 AND kind IN (3, 4, 5)`;
export interface IndPublishArgs { year: number; slice: IndSlice; fileShas: string[]; relPaths: string[]; first: boolean; failAfterApply?: boolean }
export async function publishIndSlice(pool: Pool, a: IndPublishArgs): Promise<PublishResult> {
  const { slice, year } = a; const fp = indSliceFingerprint(a.fileShas, slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  const rowsIn = slice.cov.reduce((n, c) => n + c.rows_in, 0), valid = slice.cov.reduce((n, c) => n + c.valid, 0), rejected = slice.cov.reduce((n, c) => n + c.rejected, 0);
  return publishSlice(pool, {
    datasetId: DATASET.edu_ind, uf: slice.uf, competence: indCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${IND_VERSION.parser}/${IND_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_ind_school, rows: slice.school as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_ind_terr, rows: slice.terr as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_ind_cov, rows: slice.cov as unknown as Array<Record<string, unknown>> }],
    inputs: { year, files: a.relPaths, sha256: a.fileShas },
    quality: { rowsIn, valid, rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50) },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_ind_school o WHERE o.year = $1 AND o.inep IN (SELECT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = $1 AND y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2))`, [year, slice.uf]);
      if (n.rows[0].n !== slice.school.length) throw new Error(`indicadores ${year}/${slice.uf}: ${n.rows[0].n} escolas no banco, fatia tem ${slice.school.length}`);
      const t = slice.uf === 0
        ? await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_ind_terr WHERE year = $1 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))`, [year])
        : await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_ind_terr WHERE year = $1 AND entity_id IN (${SCOPE_UF})`, [year, slice.uf]);
      if (t.rows[0].n !== slice.terr.length) throw new Error(`indicadores ${year}/${slice.uf}: ${t.rows[0].n} linhas territoriais no banco, fatia tem ${slice.terr.length}`);
    },
  });
}

export interface IndYearResult { year: number; files: number; rejected: number; rejectReasons: Record<string, number>; slices: Array<{ uf: number; status: string; school: number; terr: number; first: boolean; runId?: number }> }
export async function collectIndYear(pool: Pool, cfg: StorageConfig, year: number, o: { ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<IndYearResult> {
  await assertPgHeadroom(cfg);
  const inv = await readIndInventory(); const files = await locateIndFiles(cfg, year, inv);
  const parsed: IndFileRows[] = [];
  for (const f of files) { const ex = await extractIndFile(cfg, f); parsed.push({ family: f.family, level: f.level, sha256: f.sha256, rows: await readIndTsv(ex.tsv, f.level) }); }
  const ctx = await loadIndContext(pool, year); const built = buildIndYear(year, parsed, ctx.cadastro, ctx.ent);
  const reasons: Record<string, number> = {}; for (const r of built.rejects) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
  const res: IndYearResult = { year, files: files.length, rejected: built.rejects.length, rejectReasons: reasons, slices: [] };
  const fileShas = files.flatMap(f => f.sha256).sort(); const relPaths = files.flatMap(f => f.relPaths).sort();
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) {
    if (o.ufs && !o.ufs.includes(uf)) continue;
    await assertPgHeadroom(cfg);
    const first = await isFirstPublication(pool, DATASET.edu_ind, uf, indCompetence(year));
    const r = await publishIndSlice(pool, { year, slice, fileShas, relPaths, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    res.slices.push({ uf, status: r.status, school: slice.school.length, terr: slice.terr.length, first, ...(r.status === 'FAILED_SAFE' ? {} : { runId: r.runId }) });
    o.log?.(JSON.stringify({ ind: 'slice', year, uf, status: r.status, school: slice.school.length, terr: slice.terr.length, rejected: slice.rejects.length, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  o.log?.(JSON.stringify({ ind: 'year', year, files: res.files, rejected: res.rejected, rejectReasons: reasons, slices: res.slices.length }));
  void IND_MEASURES; void sha256;
  return res;
}
