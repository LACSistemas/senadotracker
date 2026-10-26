import { createReadStream } from 'node:fs';
import { readFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Pool } from 'pg';
import {
  DATASET, FLOW_COLS, FLOW_VERSION, INSE_LEVEL_COLS, INSE_VERSION, SPECS, TDI_COLS, TRN_COLS, TXR_COLS, buildFlowYear, buildInseYear, flowSliceFingerprint, inseSliceFingerprint, learnCompetence, publishSlice,
  type FlowFamily, type FlowFile, type FlowLevel, type FlowRaw, type FlowSlice, type InseFile, type InseLevel, type InseRaw, type InseSlice, type PublishResult,
} from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, assertZipIntact, readManifest, recordManifest, registerLocalRaw, runPython, type StorageConfig } from './storage.ts';
import { loadLearnContext, type Log } from './educacao-learn.ts';
import { IND_REL_DIR } from './educacao-ind.ts';
import { isFirstPublication } from './seguranca.ts';

const scopeUf = `SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2 AND kind IN (3, 4, 5)`;
const scopeNat = `SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2)`;

// ======================================================================= inventário e RAW
export type FlowKind = FlowFamily | 'INSE';
export interface FlowInvRow { kind: FlowKind; level: FlowLevel | InseLevel; year: number; file: string; url: string }
const PAGE_KIND: Record<string, FlowKind> = { 'taxas-de-rendimento-escolar': 'TXR', 'taxas-de-distorcao-idade-serie': 'TDI', 'taxas-de-transicao': 'TRN', 'nivel-socioeconomico': 'INSE' };
const FLOW_LEVEL: Record<string, FlowLevel> = { ESCOLAS: 'escolas', MUNICIPIOS: 'municipios', BRASIL_REGIOES_UFS: 'uf' };
const INSE_FILE_LEVEL = (file: string): InseLevel | null => /escolas/i.test(file) ? 'escolas' : /municipios/i.test(file) ? 'municipios' : /estados/i.test(file) ? 'estados' : /brasil/i.test(file) ? 'brasil' : null;
export const flowKindDataset = (k: FlowKind): 'edu_fluxo' | 'edu_trn' | 'edu_inse' => k === 'TRN' ? 'edu_trn' : k === 'INSE' ? 'edu_inse' : 'edu_fluxo';

/** Inventário oficial dos arquivos (investigação P10): rendimento, distorção, transição (ano = ano de origem do par Y/Y+1) e INSE 2019, 2021 e 2023 (as edições antigas 2011–2015 usam outra metodologia e não entram). */
export async function readFlowInventory(csvPath = 'docs/executivo-collector-plan/educacao-p10/inep_indicadores_arquivos.csv'): Promise<FlowInvRow[]> {
  const lines = (await readFile(csvPath, 'utf8')).split(/\r?\n/).filter(Boolean); const out: FlowInvRow[] = [];
  for (const l of lines.slice(1)) {
    const [page, file, , nivel, url] = l.split(','); const kind = PAGE_KIND[page ?? ''];
    if (!kind || !file || !url) continue;
    const year = Number(/(20\d\d)/.exec(file)?.[1] ?? 0); if (!year) continue;
    if (kind === 'INSE') { const lv = INSE_FILE_LEVEL(file); if (!lv || !file.endsWith('.xlsx') || year < 2019) continue; out.push({ kind, level: lv, year, file, url }); continue; }
    const level = FLOW_LEVEL[nivel ?? '']; if (!level) continue;
    out.push({ kind, level, year, file, url });
  }
  return out;
}

export async function registerFlowFiles(pool: Pool, cfg: StorageConfig, log: Log): Promise<{ registered: number; missing: string[] }> {
  const inv = await readFlowInventory(); const present = new Set(await readdir(join(cfg.rawDir, IND_REL_DIR))); let registered = 0; const missing: string[] = [];
  for (const r of inv) {
    if (!present.has(r.file)) { missing.push(r.file); continue; }
    const rel = `${IND_REL_DIR}/${r.file}`; if (r.file.toLowerCase().endsWith('.zip')) await assertZipIntact(cfg, rel);
    const e = await registerLocalRaw(cfg, { url: r.url, relPath: rel, competence: r.year * 100 + 5, uf: 0, retention: 1, dataset: flowKindDataset(r.kind) });
    await recordManifest(pool, e); registered++;
    log(JSON.stringify({ flow: 'registered', file: r.file, bytes: e.bytes }));
  }
  return { registered, missing };
}

export interface FlowFiles { kind: FlowKind; level: FlowLevel | InseLevel; year: number; relPaths: string[]; sha256: string[] }
export async function locateFlowFiles(cfg: StorageConfig, kinds: FlowKind[], year: number, inv?: FlowInvRow[]): Promise<FlowFiles[]> {
  const rows = (inv ?? await readFlowInventory()).filter(x => kinds.includes(x.kind) && x.year === year); const man = await readManifest(cfg); const groups = new Map<string, FlowInvRow[]>();
  for (const r of rows) groups.set(`${r.kind}|${r.level}`, [...(groups.get(`${r.kind}|${r.level}`) ?? []), r]);
  const out: FlowFiles[] = [];
  for (const [k, rs] of groups) {
    const [kind, level] = k.split('|') as [FlowKind, FlowLevel | InseLevel];
    const es = rs.map(r => man.get(`${IND_REL_DIR}/${r.file}`)).filter((x): x is NonNullable<typeof x> => !!x);
    if (es.length !== rs.length) throw new Error(`Fluxo ${kind}/${level}/${year}: arquivo não registrado no manifesto (rode "educacao-pilot flow-register")`);
    out.push({ kind, level, year, relPaths: es.map(x => x.relPath), sha256: es.map(x => x.sha256) });
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.level.localeCompare(b.level));
}

export function flowYears(inv: FlowInvRow[], kinds: FlowKind[]): number[] { return [...new Set(inv.filter(x => kinds.includes(x.kind)).map(x => x.year))].sort((a, b) => a - b); }

// ======================================================================= extração e leitura
export async function extractFlow(cfg: StorageConfig, f: FlowFiles): Promise<{ tsv: string; reused: boolean; summary: Record<string, unknown> | null }> {
  const dir = join(cfg.stagingDir, 'educacao'); await mkdir(dir, { recursive: true });
  const tag = f.sha256.map(s => s.slice(0, 8)).join('');
  const tsv = join(dir, `flow_${f.kind}_${f.level}_${f.year}_${tag}_${f.kind === 'INSE' ? INSE_VERSION.parser : FLOW_VERSION.parser}.tsv`);
  try { await stat(tsv); return { tsv, reused: true, summary: null }; } catch { /* sem cache */ }
  await assertCanDecode(cfg, 150 * 1024 * 1024);
  const paths = f.relPaths.map(p => join(cfg.rawDir, p));
  const r = f.kind === 'INSE' ? await runPython('scripts/exec/inse_extract.py', [String(f.year), f.level, tsv, paths[0]!]) : await runPython('scripts/exec/flow_extract.py', [f.kind, f.level, String(f.year), tsv, ...paths]);
  if (r.code !== 0) throw new Error(`extração de ${f.kind}/${f.level}/${f.year} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return { tsv, reused: false, summary: JSON.parse(r.out.trim().split('\n').at(-1)!) as Record<string, unknown> };
}

export async function readFlowTsv(path: string, level: FlowLevel): Promise<FlowRaw[]> {
  const rows: FlowRaw[] = []; let cols: string[] | null = null; const skip = level === 'escolas' ? 5 : 4;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (!cols) { cols = line.split('\t'); continue; }
    if (!line) continue;
    const p = line.split('\t'); const v: Record<string, string> = {};
    for (let i = skip; i < cols.length; i++) v[cols[i]!] = p[i] ?? '';
    rows.push(level === 'escolas' ? { row: Number(p[0]), key: p[1] ?? '', uf: p[2] ?? '', loc: p[3] ?? '', dep: p[4] ?? '', v } : { row: Number(p[0]), key: p[1] ?? '', loc: p[2] ?? '', dep: p[3] ?? '', v });
  }
  return rows;
}
export async function readInseTsv(path: string, level: InseLevel): Promise<InseRaw[]> {
  const rows: InseRaw[] = []; let first = true;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (first) { first = false; continue; } if (!line) continue;
    const p = line.split('\t');
    rows.push({ row: Number(p[0]), year: Number(p[1]), level, uf_code: p[3] ?? '', uf: p[4] ?? '', ibge7: p[5] ?? '', inep: p[6] ?? '', dep: p[7] ?? '', loc: p[8] ?? '', cap: p[9] ?? '', qtd: p[10] ?? '', media: p[11] ?? '', cls: p[12] ?? '', nv: Array.from({ length: 8 }, (_, i) => p[13 + i] ?? '') });
  }
  return rows;
}

// ======================================================================= publicação
export interface FlowYearResult { year: number; rejected: number; rejectReasons: Record<string, number>; lossy: number; sumChecked: number; sumOff: number; slices: Array<{ uf: number; status: string; school: number; terr: number }> }

export async function publishFlowSlice(pool: Pool, a: { slice: FlowSlice; mode: 'flow' | 'trn'; fileShas: string[]; relPaths: string[]; first: boolean; failAfterApply?: boolean }): Promise<PublishResult> {
  const { slice, mode } = a; const year = slice.year; const fp = flowSliceFingerprint(a.fileShas, slice, mode); const trn = mode === 'trn';
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  const rowsIn = slice.cov.reduce((n, c) => n + c.rows_in, 0), valid = slice.cov.reduce((n, c) => n + c.valid, 0), rejected = slice.cov.reduce((n, c) => n + c.rejected, 0);
  const tables = trn
    ? [{ spec: SPECS.edu_trn_terr, rows: slice.terr as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_trn_cov, rows: slice.cov as unknown as Array<Record<string, unknown>> }]
    : [{ spec: SPECS.edu_flow_school, rows: slice.school as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_flow_terr, rows: slice.terr as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_flow_cov, rows: slice.cov as unknown as Array<Record<string, unknown>> }];
  const terrTable = trn ? 'exec_edu_trn_terr' : 'exec_edu_flow_terr';
  return publishSlice(pool, {
    datasetId: trn ? DATASET.edu_trn : DATASET.edu_fluxo, uf: slice.uf, competence: learnCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${FLOW_VERSION.parser}/${FLOW_VERSION.publish}`, bootstrap: a.first,
    tables, inputs: { year, files: a.relPaths, sha256: a.fileShas },
    quality: { rowsIn, valid, rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50), lossyCells: slice.lossy, sumChecked: slice.sumChecked, sumOff: slice.sumOff },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      if (!trn) {
        const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_flow_school WHERE year = $1 AND uf = $2`, [year, slice.uf]);
        if (n.rows[0].n !== slice.school.length) throw new Error(`fluxo ${year}/${slice.uf}: ${n.rows[0].n} escolas no banco, fatia tem ${slice.school.length}`);
      }
      const t = slice.uf === 0 ? await c.query(`SELECT count(*)::int n FROM civica_exec.${terrTable} WHERE year = $1 AND entity_id IN (${scopeNat})`, [year]) : await c.query(`SELECT count(*)::int n FROM civica_exec.${terrTable} WHERE year = $1 AND entity_id IN (${scopeUf})`, [year, slice.uf]);
      if (t.rows[0].n !== slice.terr.length) throw new Error(`fluxo ${year}/${slice.uf}: ${t.rows[0].n} linhas territoriais no banco, fatia tem ${slice.terr.length}`);
    },
  });
}

export async function collectFlow(pool: Pool, cfg: StorageConfig, years: number[], o: { mode?: 'flow' | 'trn'; ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<FlowYearResult[]> {
  const mode = o.mode ?? 'flow'; const kinds: FlowKind[] = mode === 'trn' ? ['TRN'] : ['TXR', 'TDI'];
  await assertPgHeadroom(cfg);
  const inv = await readFlowInventory(); const ctx = await loadLearnContext(pool); const out: FlowYearResult[] = [];
  for (const y of years) {
    const located = await locateFlowFiles(cfg, kinds, y, inv); const files: FlowFile[] = []; const shas: string[] = []; const rels: string[] = [];
    for (const f of located) {
      const ex = await extractFlow(cfg, f); files.push({ family: f.kind as FlowFamily, level: f.level as FlowLevel, year: y, sha256: f.sha256, rows: await readFlowTsv(ex.tsv, f.level as FlowLevel) });
      shas.push(...f.sha256); rels.push(...f.relPaths);
    }
    const res: FlowYearResult = { year: y, rejected: 0, rejectReasons: {}, lossy: 0, sumChecked: 0, sumOff: 0, slices: [] };
    if (!files.length) { o.log?.(JSON.stringify({ flow: 'year', year: y, skipped: 'sem arquivos' })); out.push(res); continue; }
    const slices = buildFlowYear(files, ctx, mode);
    for (const s of [...slices.values()].sort((a, b) => a.uf - b.uf)) {
      if (o.ufs && !o.ufs.includes(s.uf)) continue;
      for (const x of s.rejects) { res.rejected++; res.rejectReasons[x.reason] = (res.rejectReasons[x.reason] ?? 0) + 1; }
      res.lossy += s.lossy; res.sumChecked += s.sumChecked; res.sumOff += s.sumOff;
      await assertPgHeadroom(cfg);
      const first = await isFirstPublication(pool, mode === 'trn' ? DATASET.edu_trn : DATASET.edu_fluxo, s.uf, learnCompetence(y));
      const r = await publishFlowSlice(pool, { slice: s, mode, fileShas: [...new Set(shas)].sort(), relPaths: [...new Set(rels)].sort(), first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
      res.slices.push({ uf: s.uf, status: r.status, school: s.school.length, terr: s.terr.length });
      o.log?.(JSON.stringify({ flow: 'slice', mode, year: y, uf: s.uf, status: r.status, school: s.school.length, terr: s.terr.length, rejected: s.rejects.length, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
    }
    o.log?.(JSON.stringify({ flow: 'year', mode, year: y, rejected: res.rejected, rejectReasons: res.rejectReasons, lossy: res.lossy, sumChecked: res.sumChecked, sumOff: res.sumOff, slices: res.slices.length, statuses: Object.fromEntries(res.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) }));
    out.push(res);
  }
  return out;
}

// ======================================================================= INSE
export async function publishInseSlice(pool: Pool, a: { slice: InseSlice; fileShas: string[]; relPaths: string[]; first: boolean; failAfterApply?: boolean }): Promise<PublishResult> {
  const { slice } = a; const year = slice.year; const fp = inseSliceFingerprint(a.fileShas, slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  const rowsIn = slice.cov.reduce((n, c) => n + c.rows_in, 0), valid = slice.cov.reduce((n, c) => n + c.valid, 0), rejected = slice.cov.reduce((n, c) => n + c.rejected, 0);
  return publishSlice(pool, {
    datasetId: DATASET.edu_inse, uf: slice.uf, competence: learnCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${INSE_VERSION.parser}/${INSE_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_inse_school, rows: slice.school as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_inse_terr, rows: slice.terr as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_inse_cov, rows: slice.cov as unknown as Array<Record<string, unknown>> }],
    inputs: { year, files: a.relPaths, sha256: a.fileShas },
    quality: { rowsIn, valid, rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50), lossyCells: slice.lossy, sumChecked: slice.sumChecked, sumOff: slice.sumOff, identicalRepeats: slice.identicalRepeats },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_inse_school WHERE year = $1 AND uf = $2`, [year, slice.uf]);
      if (n.rows[0].n !== slice.school.length) throw new Error(`inse ${year}/${slice.uf}: ${n.rows[0].n} escolas no banco, fatia tem ${slice.school.length}`);
      const t = slice.uf === 0 ? await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_inse_terr WHERE year = $1 AND entity_id IN (${scopeNat})`, [year]) : await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_inse_terr WHERE year = $1 AND entity_id IN (${scopeUf})`, [year, slice.uf]);
      if (t.rows[0].n !== slice.terr.length) throw new Error(`inse ${year}/${slice.uf}: ${t.rows[0].n} linhas territoriais no banco, fatia tem ${slice.terr.length}`);
    },
  });
}

export async function collectInse(pool: Pool, cfg: StorageConfig, years: number[], o: { ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<FlowYearResult[]> {
  await assertPgHeadroom(cfg); const inv = await readFlowInventory(); const ctx = await loadLearnContext(pool); const out: FlowYearResult[] = [];
  for (const y of years) {
    const located = await locateFlowFiles(cfg, ['INSE'], y, inv); const files: InseFile[] = []; const shas: string[] = []; const rels: string[] = [];
    for (const f of located) { const ex = await extractFlow(cfg, f); files.push({ level: f.level as InseLevel, sha256: f.sha256, rows: await readInseTsv(ex.tsv, f.level as InseLevel) }); shas.push(...f.sha256); rels.push(...f.relPaths); }
    const res: FlowYearResult = { year: y, rejected: 0, rejectReasons: {}, lossy: 0, sumChecked: 0, sumOff: 0, slices: [] };
    if (!files.length) { out.push(res); continue; }
    const slices = buildInseYear(files, ctx);
    for (const s of [...slices.values()].sort((a, b) => a.uf - b.uf)) {
      if (o.ufs && !o.ufs.includes(s.uf)) continue;
      for (const x of s.rejects) { res.rejected++; res.rejectReasons[x.reason] = (res.rejectReasons[x.reason] ?? 0) + 1; }
      res.lossy += s.lossy; res.sumChecked += s.sumChecked; res.sumOff += s.sumOff;
      await assertPgHeadroom(cfg); const first = await isFirstPublication(pool, DATASET.edu_inse, s.uf, learnCompetence(y));
      const r = await publishInseSlice(pool, { slice: s, fileShas: [...new Set(shas)].sort(), relPaths: [...new Set(rels)].sort(), first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
      res.slices.push({ uf: s.uf, status: r.status, school: s.school.length, terr: s.terr.length });
      o.log?.(JSON.stringify({ inse: 'slice', year: y, uf: s.uf, status: r.status, school: s.school.length, terr: s.terr.length, rejected: s.rejects.length, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
    }
    o.log?.(JSON.stringify({ inse: 'year', year: y, rejected: res.rejected, rejectReasons: res.rejectReasons, lossy: res.lossy, sumChecked: res.sumChecked, sumOff: res.sumOff, slices: res.slices.length }));
    out.push(res);
  }
  return out;
}
void FLOW_COLS; void TXR_COLS; void TDI_COLS; void TRN_COLS; void INSE_LEVEL_COLS;
