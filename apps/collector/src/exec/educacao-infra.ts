import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Pool } from 'pg';
import {
  DATASET, INFRA_VARS, INFRA_VERSION, SPECS, buildInfraYear, infraCompetence, infraLayoutOf, infraSliceFingerprint, publishSlice, sha256,
  type InfraRaw, type InfraSchool, type InfraSlice, type PublishResult,
} from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, readManifest, runPython, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

export type Log = (m: string) => void;
export interface InfraFiles { year: number; relPaths: string[]; sha256: string[]; bytes: number }

/** Arquivo de escolas do Censo da edição no RAW (2007–2024: o ZIP único; 2025+: Tabela_Escola). Nada é baixado aqui. */
export async function locateInfraFiles(cfg: StorageConfig, year: number): Promise<InfraFiles> {
  const m = await readManifest(cfg); const prefix = `inep/censo_escolar/${year}/`;
  const all = [...m.values()].filter(x => x.relPath.startsWith(prefix)).sort((a, b) => a.relPath.localeCompare(b.relPath));
  const e = year >= 2025 ? all.filter(x => /Tabela_Escola_/i.test(x.relPath)) : all.filter(x => x.relPath.toLowerCase().endsWith('.zip'));
  if (e.length !== 1) throw new Error(`Censo ${year}: arquivo de escolas ausente no RAW (${e.length} encontrados); rode "educacao-pilot fetch ${year}"`);
  return { year, relPaths: e.map(x => x.relPath), sha256: e.map(x => x.sha256), bytes: e.reduce((n, x) => n + x.bytes, 0) };
}

const catalogJson = (): string => JSON.stringify(INFRA_VARS.map(x => ({ code: x.code, src: x.src, kind: x.kind })));
export interface InfraSummary { year: number; rows: number; bytes_in: number; present: string[]; missing: string[]; dist: Record<string, { '0': number; '1': number; empty: number; other: number }> }

export async function extractInfraYear(cfg: StorageConfig, f: InfraFiles): Promise<{ tsv: string; reused: boolean; summary: InfraSummary | null }> {
  const dir = join(cfg.stagingDir, 'educacao'); await mkdir(dir, { recursive: true });
  const cat = catalogJson(); const tag = sha256(cat).slice(0, 8);
  const tsv = join(dir, `infra_${f.year}_${f.sha256.map(s => s.slice(0, 8)).join('')}_${tag}_${INFRA_VERSION.parser}.tsv`);
  try { await stat(tsv); return { tsv, reused: true, summary: null }; } catch { /* sem cache */ }
  await assertCanDecode(cfg, 80 * 1024 * 1024);
  const catPath = join(dir, `infra_catalog_${tag}.json`); await writeFile(catPath, cat);
  const r = await runPython('scripts/exec/censo_infra_extract.py', [String(f.year), tsv, catPath, ...f.relPaths.map(p => join(cfg.rawDir, p))]);
  if (r.code !== 0) throw new Error(`extração de infraestrutura do Censo ${f.year} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return { tsv, reused: false, summary: JSON.parse(r.out.trim().split('\n').at(-1)!) as InfraSummary };
}

export async function readInfraTsv(path: string): Promise<InfraRaw[]> {
  const rows: InfraRaw[] = []; let cols: string[] | null = null;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (!cols) { cols = line.split('\t'); continue; }
    if (!line) continue;
    const p = line.split('\t'); const v: Record<string, string> = {};
    for (let i = 3; i < cols.length; i++) v[cols[i]!] = p[i] ?? '';
    rows.push({ row: Number(p[0]), inep: p[1] ?? '', sit: p[2] ?? '', v });
  }
  return rows;
}

/** Cadastro P10.1 da edição: inep → UF, dependência, localização e se tem matrícula básica (bit0). */
export async function loadInfraCadastro(pool: Pick<Pool, 'query'>, year: number): Promise<Map<number, InfraSchool>> {
  const r = await pool.query(`SELECT y.inep, e.uf_code, y.dep, y.loc, (y.flags & 1) <> 0 AS with_mat FROM civica_exec.exec_edu_school_year y JOIN civica_exec.exec_entity e ON e.entity_id = y.entity_id WHERE y.year = $1`, [year]);
  return new Map(r.rows.map(x => [Number(x.inep), { uf: Number(x.uf_code), dep: Number(x.dep), loc: x.loc == null ? null : Number(x.loc), withMat: Boolean(x.with_mat) }]));
}

const UF_ENT = `SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2`;
export interface InfraPublishArgs { year: number; slice: InfraSlice; files: InfraFiles; first: boolean; failAfterApply?: boolean }
export async function publishInfraSlice(pool: Pool, a: InfraPublishArgs): Promise<PublishResult> {
  const { slice, year } = a; const fp = infraSliceFingerprint(a.files.sha256, slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  return publishSlice(pool, {
    datasetId: DATASET.edu_infra, uf: slice.uf, competence: infraCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${INFRA_VERSION.parser}/${INFRA_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_infra_year, rows: slice.rows as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_infra_agg, rows: slice.agg as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_infra_cov, rows: [slice.cov as unknown as Record<string, unknown>] }],
    inputs: { year, files: a.files.relPaths, sha256: a.files.sha256, layout: infraLayoutOf(year) },
    quality: { rowsIn: slice.cov.rows_in, valid: slice.cov.valid, rejected: slice.cov.rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50) },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_infra_year o WHERE o.year = $1 AND o.inep IN (SELECT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = $1 AND y.entity_id IN (${UF_ENT}))`, [year, slice.uf]);
      if (n.rows[0].n !== slice.rows.length) throw new Error(`infra ${year}/${slice.uf}: ${n.rows[0].n} linhas no banco, fatia tem ${slice.rows.length}`);
      // os agregados precisam bater com as linhas gravadas (internet: sim e não; escolas)
      const chk = await c.query(`SELECT coalesce(sum(internet_t), 0)::bigint t, coalesce(sum(internet_f), 0)::bigint f, coalesce(sum(schools), 0)::bigint s FROM civica_exec.exec_edu_infra_agg WHERE year = $1 AND uf = $2`, [year, slice.uf]);
      const real = await c.query(`SELECT count(*) FILTER (WHERE internet)::bigint t, count(*) FILTER (WHERE NOT internet)::bigint f, count(*)::bigint s FROM civica_exec.exec_edu_infra_year o WHERE o.year = $1 AND o.inep IN (SELECT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = $1 AND y.entity_id IN (${UF_ENT}))`, [year, slice.uf]);
      for (const k of ['t', 'f', 's']) if (String(chk.rows[0][k]) !== String(real.rows[0][k])) throw new Error(`infra ${year}/${slice.uf}: agregado (${k}) difere das escolas`);
    },
  });
}

export interface InfraYearResult { year: number; rowsIn: number; rejected: number; rejectReasons: Record<string, number>; notActive: number; slices: Array<{ uf: number; status: string; rows: number; first: boolean; runId?: number }> }
export async function collectInfraYear(pool: Pool, cfg: StorageConfig, year: number, o: { ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<InfraYearResult> {
  await assertPgHeadroom(cfg);
  const files = await locateInfraFiles(cfg, year); const ex = await extractInfraYear(cfg, files);
  const rows = await readInfraTsv(ex.tsv); const cad = await loadInfraCadastro(pool, year); const built = buildInfraYear(year, rows, cad);
  const reasons: Record<string, number> = {}; for (const r of built.rejects) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
  const res: InfraYearResult = { year, rowsIn: rows.length, rejected: built.rejects.length, rejectReasons: reasons, notActive: built.notActive, slices: [] };
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) {
    if (o.ufs && !o.ufs.includes(uf)) continue;
    await assertPgHeadroom(cfg);
    const first = await isFirstPublication(pool, DATASET.edu_infra, uf, infraCompetence(year));
    const r = await publishInfraSlice(pool, { year, slice, files, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    res.slices.push({ uf, status: r.status, rows: slice.rows.length, first, ...(r.status === 'FAILED_SAFE' ? {} : { runId: r.runId }) });
    o.log?.(JSON.stringify({ infra: 'slice', year, uf, status: r.status, rows: slice.rows.length, rejected: slice.cov.rejected, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  o.log?.(JSON.stringify({ infra: 'year', year, rowsIn: res.rowsIn, rejected: res.rejected, rejectReasons: reasons, notActive: res.notActive, slices: res.slices.length }));
  return res;
}
