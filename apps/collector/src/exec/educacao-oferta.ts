import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Pool } from 'pg';
import {
  DATASET, OFFER_VERSION, SPECS, buildOfferYear, offerCompetence, offerLayoutOf, offerSliceFingerprint, publishSlice,
  type OfferRaw, type OfferSchool, type OfferSlice, type PublishResult,
} from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, readManifest, runPython, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

export type Log = (m: string) => void;
export interface OfferFiles { year: number; relPaths: string[]; sha256: string[]; bytes: number }

/** Arquivos da edição no RAW: 2007–2024 = o ZIP único; 2025+ = Tabela_Matricula + Tabela_Turma (já preservados; nada é baixado aqui). */
export async function locateOfferFiles(cfg: StorageConfig, year: number): Promise<OfferFiles> {
  const m = await readManifest(cfg); const prefix = `inep/censo_escolar/${year}/`;
  const all = [...m.values()].filter(x => x.relPath.startsWith(prefix)).sort((a, b) => a.relPath.localeCompare(b.relPath));
  const e = year >= 2025 ? all.filter(x => /Tabela_(Matricula|Turma)_/i.test(x.relPath)) : all.filter(x => x.relPath.toLowerCase().endsWith('.zip'));
  if (year >= 2025 ? e.length !== 2 : e.length !== 1) throw new Error(`Censo ${year}: arquivos de oferta ausentes no RAW (${e.length} encontrados); rode "educacao-pilot fetch ${year}"`);
  return { year, relPaths: e.map(x => x.relPath), sha256: e.map(x => x.sha256), bytes: e.reduce((n, x) => n + x.bytes, 0) };
}

export async function extractOfferYear(cfg: StorageConfig, f: OfferFiles): Promise<{ tsv: string; reused: boolean; summary: { rows_in: number; rows_out: number; layout: string; missing: string[]; bytes_in: number } | null }> {
  await mkdir(join(cfg.stagingDir, 'educacao'), { recursive: true });
  const tsv = join(cfg.stagingDir, 'educacao', `oferta_${f.year}_${f.sha256.map(s => s.slice(0, 8)).join('')}_${OFFER_VERSION.parser}.tsv`);
  try { await stat(tsv); return { tsv, reused: true, summary: null }; } catch { /* sem cache */ }
  await assertCanDecode(cfg, 60 * 1024 * 1024);
  const r = await runPython('scripts/exec/censo_oferta_extract.py', [String(f.year), tsv, ...f.relPaths.map(p => join(cfg.rawDir, p))]);
  if (r.code !== 0) throw new Error(`extração de oferta do Censo ${f.year} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return { tsv, reused: false, summary: JSON.parse(r.out.trim().split('\n').at(-1)!) };
}

export async function readOfferTsv(path: string): Promise<OfferRaw[]> {
  const rows: OfferRaw[] = []; let cols: string[] | null = null;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (!cols) { cols = line.split('\t'); continue; }
    if (!line) continue;
    const p = line.split('\t'); const v: Record<string, string> = {};
    for (let i = 2; i < cols.length; i++) v[cols[i]!] = p[i] ?? '';
    rows.push({ row: Number(p[0]), inep: p[1] ?? '', v });
  }
  return rows;
}

/** Cadastro P10.1 da edição: inep → UF do município, dependência e localização. */
export async function loadOfferCadastro(pool: Pick<Pool, 'query'>, year: number): Promise<Map<number, OfferSchool>> {
  const r = await pool.query(`SELECT y.inep, e.uf_code, y.dep, y.loc FROM civica_exec.exec_edu_school_year y JOIN civica_exec.exec_entity e ON e.entity_id = y.entity_id WHERE y.year = $1`, [year]);
  return new Map(r.rows.map(x => [Number(x.inep), { uf: Number(x.uf_code), dep: Number(x.dep), loc: x.loc == null ? null : Number(x.loc) }]));
}

const UF_ENT = `SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2`;
export interface OfferPublishArgs { year: number; slice: OfferSlice; files: OfferFiles; first: boolean; failAfterApply?: boolean }
export async function publishOfferSlice(pool: Pool, a: OfferPublishArgs): Promise<PublishResult> {
  const { slice, year } = a; const fp = offerSliceFingerprint(a.files.sha256, slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  return publishSlice(pool, {
    datasetId: DATASET.edu_oferta, uf: slice.uf, competence: offerCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${OFFER_VERSION.parser}/${OFFER_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_offer_year, rows: slice.rows as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_offer_agg, rows: slice.agg as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_offer_cov, rows: [slice.cov as unknown as Record<string, unknown>] }],
    inputs: { year, files: a.files.relPaths, sha256: a.files.sha256, layout: offerLayoutOf(year) },
    quality: { rowsIn: slice.cov.rows_in, valid: slice.cov.valid, rejected: slice.cov.rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50) },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_offer_year o WHERE o.year = $1 AND o.inep IN (SELECT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = $1 AND y.entity_id IN (${UF_ENT}))`, [year, slice.uf]);
      if (n.rows[0].n !== slice.rows.length) throw new Error(`oferta ${year}/${slice.uf}: ${n.rows[0].n} linhas no banco, fatia tem ${slice.rows.length}`);
      // consistência com o cadastro da P10.1: bit0 (matrícula básica > 0) ⇔ existe linha de oferta com mat_bas > 0
      const bad = await c.query(`SELECT count(*)::int n, (array_agg(y.inep ORDER BY y.inep))[1:5] amostra FROM civica_exec.exec_edu_school_year y LEFT JOIN civica_exec.exec_edu_offer_year o ON o.inep = y.inep AND o.year = y.year
        WHERE y.year = $1 AND y.entity_id IN (${UF_ENT}) AND ((y.flags & 1) <> 0) <> (coalesce(o.mat_bas, 0) > 0)`, [year, slice.uf]);
      if (bad.rows[0].n) throw new Error(`oferta ${year}/${slice.uf}: ${bad.rows[0].n} escolas divergem do bit0 de matrícula do cadastro (ex.: ${(bad.rows[0].amostra as number[]).join(', ')})`);
      const sums = await c.query(`SELECT coalesce(sum(mat_bas), 0)::bigint m, coalesce(sum(tur_bas), 0)::bigint t FROM civica_exec.exec_edu_offer_agg WHERE year = $1 AND uf = $2`, [year, slice.uf]);
      const mat = slice.rows.reduce((s, r) => s + (r.mat_bas ?? 0), 0), tur = slice.rows.reduce((s, r) => s + (r.tur_bas ?? 0), 0);
      if (Number(sums.rows[0].m) !== mat || Number(sums.rows[0].t) !== tur) throw new Error(`oferta ${year}/${slice.uf}: soma agregada difere da soma das escolas`);
    },
  });
}

export interface OfferYearResult { year: number; rowsIn: number; rejected: number; rejectReasons: Record<string, number>; skippedNoOffer: number; slices: Array<{ uf: number; status: string; rows: number; first: boolean; runId?: number }> }
export async function collectOfferYear(pool: Pool, cfg: StorageConfig, year: number, o: { ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<OfferYearResult> {
  await assertPgHeadroom(cfg);
  const files = await locateOfferFiles(cfg, year); const ex = await extractOfferYear(cfg, files);
  const rows = await readOfferTsv(ex.tsv); const cad = await loadOfferCadastro(pool, year); const built = buildOfferYear(year, rows, cad);
  const reasons: Record<string, number> = {}; for (const r of built.rejects) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
  const res: OfferYearResult = { year, rowsIn: rows.length, rejected: built.rejects.length, rejectReasons: reasons, skippedNoOffer: built.skippedNoOffer, slices: [] };
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) {
    if (o.ufs && !o.ufs.includes(uf)) continue;
    await assertPgHeadroom(cfg);
    const first = await isFirstPublication(pool, DATASET.edu_oferta, uf, offerCompetence(year));
    const r = await publishOfferSlice(pool, { year, slice, files, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    res.slices.push({ uf, status: r.status, rows: slice.rows.length, first, ...(r.status === 'FAILED_SAFE' ? {} : { runId: r.runId }) });
    o.log?.(JSON.stringify({ oferta: 'slice', year, uf, status: r.status, rows: slice.rows.length, rejected: slice.cov.rejected, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  o.log?.(JSON.stringify({ oferta: 'year', year, rowsIn: res.rowsIn, rejected: res.rejected, rejectReasons: reasons, skippedNoOffer: res.skippedNoOffer, slices: res.slices.length }));
  return res;
}
