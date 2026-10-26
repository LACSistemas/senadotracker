import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Pool } from 'pg';
import { DATASET, DOC_COLS, DOC_VERSION, SPECS, buildDocYear, docCompetence, docKey, docSliceFingerprint, publishSlice, type DocEntities, type DocRaw, type DocSlice, type PublishResult } from '@senadotracker/db';
import { assertPgHeadroom, readManifest, recordManifest, registerLocalRaw, runPython, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

export type Log = (m: string) => void;
export const DOC_REL_DIR = 'inep/sinopse_docentes';
const EVID = 'docs/executivo-collector-plan/educacao-p103-execucao/evidencias/sinopse';

/** Converte os JSON das tabelas 2.1/2.2 da Sinopse (extraídos das planilhas oficiais) em TSV por edição, grava no RAW e registra no manifesto com o SHA-256 da planilha de origem. */
export async function prepareDocFiles(pool: Pool, cfg: StorageConfig, years: number[], log: Log): Promise<number> {
  await mkdir(join(cfg.rawDir, DOC_REL_DIR), { recursive: true }); let n = 0;
  for (const y of years) {
    const t21 = `${EVID}/t21_${y}.json`, t22 = `${EVID}/t22_${y}.json`, fetch = `${EVID}/fetch_doc_${y}.json`;
    try { await stat(t22); } catch { log(JSON.stringify({ doc: 'sem_json', year: y })); continue; }
    const tmp = join(cfg.stagingDir, 'educacao', `docentes_${y}.tsv`); await mkdir(join(cfg.stagingDir, 'educacao'), { recursive: true });
    const r = await runPython('scripts/exec/sinopse_docentes_tsv.py', [String(y), t21, t22, tmp]);
    if (r.code !== 0) throw new Error(`docentes ${y}: ${(r.err || r.out).slice(0, 300)}`);
    const rel = `${DOC_REL_DIR}/docentes_${y}.tsv`; await copyFile(tmp, join(cfg.rawDir, rel));
    let srcSha = 'desconhecido'; try { const f = JSON.parse(await readFile(fetch, 'utf8')) as { members: Array<{ sha256: string }> }; srcSha = f.members[0]!.sha256; } catch { /* Sinopse 2025 foi buscada fora do lote */ }
    const e = await registerLocalRaw(cfg, { url: `https://download.inep.gov.br/sinopse-estatistica-censo-escolar#ano=${y}&tabelas=2.1,2.2&xlsx-sha256=${srcSha}`, relPath: rel, competence: y * 100 + 5, uf: 0, retention: 1, dataset: 'edu_doc' });
    await recordManifest(pool, e); n++; log(JSON.stringify({ doc: 'prepared', year: y, bytes: e.bytes, sheetSha256: srcSha, rows: JSON.parse(r.out.trim().split('\n').at(-1)!).rows }));
  }
  return n;
}

export async function readDocTsv(path: string): Promise<DocRaw[]> {
  const rows: DocRaw[] = []; let cols: string[] | null = null;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (!cols) { cols = line.split('\t'); continue; }
    if (!line) continue;
    const p = line.split('\t'); const v: Record<string, string> = {};
    for (let i = 2; i < cols.length; i++) v[cols[i]!] = p[i] ?? '';
    rows.push({ row: rows.length + 1, key: p[0] ?? '', kind: p[1] ?? '', v });
  }
  return rows;
}
export async function loadDocEntities(pool: Pick<Pool, 'query'>): Promise<DocEntities> {
  const r = await pool.query(`SELECT entity_id, kind, ibge7, uf_code, uf, name FROM civica_exec.exec_entity WHERE kind IN (1, 3, 4)`);
  const uf = new Map<string, { entityId: number; uf: number }>(); const mun = new Map<number, { entityId: number; uf: number }>(); let brasil = 0;
  for (const e of r.rows) {
    if (e.kind === 1) brasil = Number(e.entity_id);
    else if (e.kind === 3) { const t = { entityId: Number(e.entity_id), uf: Number(e.uf_code) }; uf.set(docKey(String(e.name)), t); if (e.uf) uf.set(docKey(String(e.uf)), t); }
    else mun.set(Number(e.ibge7), { entityId: Number(e.entity_id), uf: Number(e.uf_code) });
  }
  return { brasil, uf, mun };
}

export async function publishDocSlice(pool: Pool, a: { year: number; slice: DocSlice; fileSha: string; relPath: string; first: boolean; failAfterApply?: boolean }): Promise<PublishResult> {
  const { slice, year } = a; const fp = docSliceFingerprint([a.fileSha], slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  return publishSlice(pool, {
    datasetId: DATASET.edu_doc, uf: slice.uf, competence: docCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${DOC_VERSION.parser}/${DOC_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_doc_terr, rows: slice.rows as unknown as Array<Record<string, unknown>> }],
    inputs: { year, files: [a.relPath], sha256: [a.fileSha] },
    quality: { rowsIn: slice.rows.length + slice.rejects.length, valid: slice.rows.length, rejected: slice.rejects.length, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50) },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      const n = slice.uf === 0
        ? await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_doc_terr WHERE year = $1 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1)`, [year])
        : await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_doc_terr WHERE year = $1 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2 AND kind IN (3, 4))`, [year, slice.uf]);
      if (n.rows[0].n !== slice.rows.length) throw new Error(`docentes ${year}/${slice.uf}: ${n.rows[0].n} linhas no banco, fatia tem ${slice.rows.length}`);
    },
  });
}

export async function collectDocYear(pool: Pool, cfg: StorageConfig, year: number, o: { log?: Log; failAfterApply?: boolean } = {}): Promise<{ year: number; rows: number; rejected: number; slices: Array<{ uf: number; status: string; rows: number }> }> {
  await assertPgHeadroom(cfg);
  const rel = `${DOC_REL_DIR}/docentes_${year}.tsv`; const e = (await readManifest(cfg)).get(rel); if (!e) throw new Error(`docentes ${year} não registrado (rode "educacao-pilot doc-prepare")`);
  const raw = await readDocTsv(join(cfg.rawDir, rel)); const ent = await loadDocEntities(pool); const b = buildDocYear(year, raw, ent);
  const res = { year, rows: raw.length, rejected: b.rejects.length, slices: [] as Array<{ uf: number; status: string; rows: number }> };
  for (const [uf, slice] of [...b.slices.entries()].sort((x, y) => x[0] - y[0])) {
    const first = await isFirstPublication(pool, DATASET.edu_doc, uf, docCompetence(year));
    const r = await publishDocSlice(pool, { year, slice, fileSha: e.sha256, relPath: rel, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    res.slices.push({ uf, status: r.status, rows: slice.rows.length });
  }
  o.log?.(JSON.stringify({ doc: 'year', ...res, slices: res.slices.length, statuses: Object.fromEntries(res.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) }));
  void DOC_COLS;
  return res;
}
