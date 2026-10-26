import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import type { Pool, PoolClient } from 'pg';
import {
  DATASET, EDU_WORK_VERSION, SPECS, buildWorks, publishSlice, sha256,
  type ObraEmpenho, type ObraFisica, type ObraProject, type PublishResult, type Row, type WorkSlice,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { isFirstPublication } from './seguranca.ts';
import { assertPgHeadroom, assertVolume, type StorageConfig } from './storage.ts';
import type { PagedMeta } from './raw-paged.ts';

/**
 * Publica as obras educacionais do Obrasgov (dataset 117; fatia UF; competência = mês da coleta) a partir do RAW preservado em raw/obrasgov (projetos por UF × situação, execução física e
 * execução financeira nacionais) e dos contratos educacionais do PNCP que apontam obras pelo CIPI. A cobertura declara páginas que falharam na coleta (`pending`).
 */
export type Log = (m: string) => void;
async function* pages(path: string): AsyncGenerator<{ p: number; s: number; b: string }> {
  for await (const l of createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity })) if (l.trim()) yield JSON.parse(l) as { p: number; s: number; b: string };
}
async function readContent<T>(path: string): Promise<T[]> {
  const out: T[] = []; if (!(await stat(path).then(() => true, () => false))) return out; for await (const pg of pages(path)) { if (pg.s !== 200) continue; const j = JSON.parse(pg.b) as { content?: T[] }; if (Array.isArray(j.content)) out.push(...j.content); } return out;
}
const metaOf = async (path: string): Promise<PagedMeta | null> => { try { return JSON.parse(await readFile(`${path}.meta.json`, 'utf8')) as PagedMeta; } catch { return null; } };
export interface ObrasRaw { projects: ObraProject[]; fisica: ObraFisica[]; empenhos: ObraEmpenho[]; failedPagesByUf: Map<number, number>; collectedAt: string; files: string[]; incomplete: string[]; /** UFs com RAW de projetos presente */ ufsPresent: string[]; /** arquivos nacionais (execução física/financeira) ainda em coleta ou ausentes: valem para todas as UFs */ nationalPartial: string[] }
export async function readObrasRaw(cfg: StorageConfig): Promise<ObrasRaw> {
  const root = join(cfg.rawDir, 'obrasgov'); const files: string[] = []; const incomplete: string[] = []; const failedByUf = new Map<number, number>(); let at = '';
  const projects: ObraProject[] = []; const ufDirs = (await readdir(join(root, 'projetos')).catch(() => [] as string[])).sort();
  const expected = new Set<string>(); for (const ufDir of ufDirs) for (const f of await readdir(join(root, 'projetos', ufDir))) if (f.endsWith('.jsonl.gz')) expected.add(f);   // situações vistas em qualquer UF
  for (const ufDir of ufDirs) {
    const present = new Set((await readdir(join(root, 'projetos', ufDir))).filter(x => x.endsWith('.jsonl.gz')));
    const missing = [...expected].filter(f => !present.has(f)).length; if (missing) { incomplete.push(`${ufDir}/(${missing} situações em coleta)`); const u = UF_CODE[ufDir] ?? 0; failedByUf.set(u, (failedByUf.get(u) ?? 0) + missing); }
    for (const f of [...present].sort()) {
      const path = join(root, 'projetos', ufDir, f); files.push(`obrasgov/projetos/${ufDir}/${f}`); const m = await metaOf(path); if (m) { at = m.at > at ? m.at : at; if (m.failedPages.length || m.aborted) { incomplete.push(`${ufDir}/${f}`); const u = UF_CODE[ufDir] ?? 0; failedByUf.set(u, (failedByUf.get(u) ?? 0) + m.failedPages.length + (m.aborted ? 1 : 0)); } }
      projects.push(...await readContent<ObraProject>(path));
    }
  }
  const fis = join(root, 'execucao-fisica', 'nacional.jsonl.gz'); const fin = join(root, 'execucao-financeira', 'nacional.jsonl.gz');
  const fisica = await readContent<ObraFisica>(fis).catch(() => []); const empenhos = await readContent<ObraEmpenho>(fin).catch(() => []);
  for (const [p, rel] of [[fis, 'obrasgov/execucao-fisica/nacional.jsonl.gz'], [fin, 'obrasgov/execucao-financeira/nacional.jsonl.gz']] as const) { files.push(rel); const m = await metaOf(p); if (m) { at = m.at > at ? m.at : at; if (m.failedPages.length) incomplete.push(rel); } }
  const nationalPartial: string[] = []; for (const [p, rel] of [[fis, 'execucao-fisica'], [fin, 'execucao-financeira']] as const) { try { await readFile(p); } catch { nationalPartial.push(rel); } }
  return { projects, fisica, empenhos, failedPagesByUf: failedByUf, collectedAt: at, files, incomplete, ufsPresent: ufDirs, nationalPartial };
}
export async function loadWorkContext(pool: Pool): Promise<{ entityByUf: Map<number, number>; cipi: Set<string> }> {
  const e = await pool.query(`SELECT uf_code, entity_id FROM civica_exec.exec_entity WHERE kind = 3`);
  const c = await pool.query(`SELECT DISTINCT cipi FROM civica_exec.exec_edu_contract WHERE cipi IS NOT NULL`);
  return { entityByUf: new Map(e.rows.map(x => [Number(x.uf_code), Number(x.entity_id)])), cipi: new Set(c.rows.map(x => String(x.cipi))) };
}
export async function publishWorkSlice(pool: Pool, a: { uf: number; competence: number; slice: WorkSlice; pending: number; first: boolean; failAfterApply?: boolean; tag?: string }): Promise<PublishResult> {
  const year = Math.floor(a.competence / 100); const s = a.slice;
  const cov: Row = { kind: 4, year, uf: a.uf, rows_in: s.in, rows_out: s.works.length, rejected: s.rejected, no_value: s.noValue, pending: a.pending };
  const fp = sha256(`${EDU_WORK_VERSION.classify}:${EDU_WORK_VERSION.publish}:${a.uf}:${a.competence}:${sha256(JSON.stringify(s.works))}:${sha256(JSON.stringify(s.commits))}:${a.pending}${a.tag ?? ''}`);
  return publishSlice(pool, {
    datasetId: DATASET.edu_work, uf: a.uf, competence: a.competence, stage: 2, sourceHash: fp, parserVersion: `${EDU_WORK_VERSION.classify}/${EDU_WORK_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_work, rows: s.works }, { spec: SPECS.edu_work_commit, rows: s.commits }, { spec: SPECS.edu_ctr_cov_work, rows: [cov] }], inputs: { uf: a.uf, competence: a.competence, read: s.in },
    quality: { rowsIn: s.in, valid: s.works.length, rejected: s.rejected, pendingPages: a.pending }, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async (c: PoolClient) => {
      const r = await c.query(`SELECT count(*)::int n, coalesce(sum(committed), 0)::numeric c FROM civica_exec.exec_edu_work WHERE uf = $1 AND year = $2`, [a.uf, year]);
      const cm = s.works.reduce((x, w) => x + (w.committed == null ? 0n : BigInt(String(w.committed))), 0n);
      if (Number(r.rows[0].n) !== s.works.length || BigInt(String(r.rows[0].c).split('.')[0]!) !== cm) throw new Error(`reconciliação de obras ${a.uf}: ${r.rows[0].n} linhas / Σ empenhado ${r.rows[0].c} ≠ ${s.works.length} / ${cm}`);
      const k = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_work_commit WHERE uf = $1 AND year = $2`, [a.uf, year]);
      if (Number(k.rows[0].n) !== s.commits.length) throw new Error(`empenhos de obras ${a.uf}: ${k.rows[0].n} ≠ ${s.commits.length}`);
    },
  });
}
export async function publishEduWorks(pool: Pool, cfg: StorageConfig, o: { log?: Log; ufs?: number[]; competence?: number; failAfterApply?: boolean } = {}): Promise<{ stats: Record<string, number>; incomplete: string[]; results: Array<{ uf: number; status: string; rows: number }> }> {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const raw = await readObrasRaw(cfg); const ctx = await loadWorkContext(pool);
  const competence = o.competence ?? (raw.collectedAt ? Number(raw.collectedAt.slice(0, 4)) * 100 + Number(raw.collectedAt.slice(5, 7)) : new Date().getUTCFullYear() * 100 + 1);
  const built = buildWorks(raw.projects, raw.fisica, raw.empenhos, ctx.cipi, { ufCode: a => UF_CODE[a], entityByUf: ctx.entityByUf, year: Math.floor(competence / 100) });
  const results: Array<{ uf: number; status: string; rows: number }> = [];
  for (const [uf, slice] of [...built.bySlice.entries()].sort((a, b) => a[0] - b[0])) {
    if (o.ufs && !o.ufs.includes(uf)) continue;
    const first = await isFirstPublication(pool, DATASET.edu_work, uf, competence);
    const r = await publishWorkSlice(pool, { uf, competence, slice, pending: (raw.failedPagesByUf.get(uf) ?? 0) + raw.nationalPartial.length, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    results.push({ uf, status: r.status, rows: slice.works.length }); o.log?.(JSON.stringify({ edu_obras: 'uf', uf, status: r.status, obras: slice.works.length, projetos_lidos: slice.in, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  return { stats: built.stats, incomplete: raw.incomplete, results };
}
