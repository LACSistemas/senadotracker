import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Pool } from 'pg';
import {
  DATASET, EDU_VERSION, SPECS, buildEduYear, eduCompetence, eduLayoutOf, eduSliceFingerprint, logRows, publishSlice,
  type CensoRow, type EduMunicipality, type EduSlice, type EduYearBuilt, type PublishResult,
} from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, readManifest, runPython, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

export type Log = (m: string) => void;
export interface EduFiles { year: number; relPaths: string[]; sha256: string[]; bytes: number }

/** Arquivos do Censo da edição já preservados no RAW (o manifesto local é a fonte; nada é baixado aqui). */
export async function locateCensoFiles(cfg: StorageConfig, year: number): Promise<EduFiles> {
  const m = await readManifest(cfg); const prefix = `inep/censo_escolar/${year}/`;
  const e = [...m.values()].filter(x => x.relPath.startsWith(prefix) && !/Tabela_Turma_/i.test(x.relPath)).sort((a, b) => a.relPath.localeCompare(b.relPath));   // a oferta (P10.2) tem localizador próprio: não entra no hash do cadastro
  if (!e.length) throw new Error(`Censo ${year} não está no RAW (rode "educacao-pilot fetch ${year}")`);
  return { year, relPaths: e.map(x => x.relPath), sha256: e.map(x => x.sha256), bytes: e.reduce((n, x) => n + x.bytes, 0) };
}

/** Extração (whitelist) para um TSV compacto em staging, com cache por hash dos arquivos e versão do parser. */
export async function extractCensoYear(cfg: StorageConfig, f: EduFiles): Promise<{ tsv: string; reused: boolean; summary: { rows: number; layout: string; header_cols: number; bytes_in: number } }> {
  await mkdir(join(cfg.stagingDir, 'educacao'), { recursive: true });
  const tsv = join(cfg.stagingDir, 'educacao', `censo_${f.year}_${f.sha256.map(s => s.slice(0, 8)).join('')}_${EDU_VERSION.parser}.tsv`);
  try { await stat(tsv); return { tsv, reused: true, summary: { rows: -1, layout: '', header_cols: 0, bytes_in: f.bytes } }; } catch { /* sem cache */ }
  await assertCanDecode(cfg, 40 * 1024 * 1024);   // o TSV de staging tem ≈ 14 MB por edição; a reserva cobre a gravação, não a descompressão
  const r = await runPython('scripts/exec/censo_escola_extract.py', [String(f.year), tsv, ...f.relPaths.map(p => join(cfg.rawDir, p))]);
  if (r.code !== 0) throw new Error(`extração do Censo ${f.year} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return { tsv, reused: false, summary: JSON.parse(r.out.trim().split('\n').at(-1)!) as { rows: number; layout: string; header_cols: number; bytes_in: number } };
}

export async function readCensoTsv(path: string): Promise<CensoRow[]> {
  const rows: CensoRow[] = []; let header = true;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (header) { header = false; continue; }
    if (!line) continue;
    const [row, inep, ibge7, uf, name, dep, loc, sit, mat] = line.split('\t');
    rows.push({ row: Number(row), inep: inep ?? '', ibge7: ibge7 ?? '', uf: uf ?? '', name: name ?? '', dep: dep ?? '', loc: loc ?? '', sit: sit ?? '', mat: mat ?? '' });
  }
  return rows;
}

export async function loadMunicipalities(pool: Pick<Pool, 'query'>): Promise<Map<string, EduMunicipality>> {
  const r = await pool.query(`SELECT entity_id, ibge7, uf_code FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code IS NOT NULL`);
  return new Map(r.rows.map(x => [String(x.ibge7), { entityId: Number(x.entity_id), ufCode: Number(x.uf_code) }]));
}

export interface EduPublishArgs { year: number; slice: EduSlice; files: EduFiles; first: boolean; failAfterApply?: boolean; built: EduYearBuilt }
export async function publishEduSlice(pool: Pool, a: EduPublishArgs): Promise<PublishResult> {
  const { slice, year } = a; const fp = eduSliceFingerprint(a.files.sha256, slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  return publishSlice(pool, {
    datasetId: DATASET.edu_censo, uf: slice.uf, competence: eduCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${EDU_VERSION.parser}/${EDU_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_school_year, rows: slice.rows as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_cov, rows: [slice.cov as unknown as Record<string, unknown>] }],
    inputs: { year, files: a.files.relPaths, sha256: a.files.sha256, layout: eduLayoutOf(year) },
    quality: { rowsIn: slice.cov.rows_in, valid: slice.cov.valid, rejected: slice.cov.rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50) },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    // identidade: grava os códigos que faltam (a chave estrangeira é adiada até o COMMIT) e, fora da carga inicial, registra a inclusão no change log
    derive: async (c, runId) => {
      const ins = await c.query(`INSERT INTO civica_exec.exec_edu_school (inep)
        SELECT DISTINCT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = $1 AND y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2) ON CONFLICT (inep) DO NOTHING RETURNING inep`, [year, slice.uf]);
      if (!a.first) for (const r of ins.rows) await logRows(c, runId, SPECS.edu_school.tableId, 'I', { inep: r.inep }, null);
    },
    verify: async c => {
      const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_school_year y WHERE y.year = $1 AND y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2)`, [year, slice.uf]);
      if (n.rows[0].n !== slice.rows.length) throw new Error(`edu ${year}/${slice.uf}: ${n.rows[0].n} escolas no banco, fatia tem ${slice.rows.length}`);
      const dup = await c.query(`SELECT count(*)::int n FROM (SELECT inep FROM civica_exec.exec_edu_school_year WHERE year = $1 GROUP BY inep HAVING count(*) > 1) x`, [year]);
      if (dup.rows[0].n) throw new Error(`edu ${year}: código INEP repetido`);
    },
  });
}

export interface EduYearResult { year: number; rowsIn: number; rejected: number; rejectReasons: Record<string, number>; globalRejects: number; slices: Array<{ uf: number; status: string; rows: number; first: boolean; runId?: number }> }
/** Publica uma edição (todas as UFs ou as pedidas). Idempotente: mesma entrada → NO_CHANGE. */
export async function collectEduYear(pool: Pool, cfg: StorageConfig, year: number, o: { ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<EduYearResult> {
  await assertPgHeadroom(cfg);
  const files = await locateCensoFiles(cfg, year); const ex = await extractCensoYear(cfg, files);
  const rows = await readCensoTsv(ex.tsv); const muns = await loadMunicipalities(pool); const built = buildEduYear(year, rows, muns);
  const reasons: Record<string, number> = {}; for (const r of built.rejects) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
  const res: EduYearResult = { year, rowsIn: rows.length, rejected: built.rejects.length, rejectReasons: reasons, globalRejects: built.rejects.filter(r => r.reason === 'MUNICIPIO_INEXISTENTE').length, slices: [] };
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) {
    if (o.ufs && !o.ufs.includes(uf)) continue;
    await assertPgHeadroom(cfg);
    const first = await isFirstPublication(pool, DATASET.edu_censo, uf, eduCompetence(year));
    const r = await publishEduSlice(pool, { year, slice, files, first, built, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    res.slices.push({ uf, status: r.status, rows: slice.rows.length, first, ...(r.status === 'FAILED_SAFE' ? {} : { runId: r.runId }) });
    o.log?.(JSON.stringify({ edu: 'slice', year, uf, status: r.status, rows: slice.rows.length, rejected: slice.cov.rejected, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  o.log?.(JSON.stringify({ edu: 'year', year, rowsIn: res.rowsIn, rejected: res.rejected, rejectReasons: reasons, slices: res.slices.length }));
  return res;
}
