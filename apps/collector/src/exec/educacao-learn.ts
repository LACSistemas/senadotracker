import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import type { Pool } from 'pg';
import {
  DATASET, IDEB_MEASURES, IDEB_VERSION, SAEB_VERSION, SAEB_LEVEL_COLS, SPECS, buildIdebYear, buildSaebYear, idebSliceFingerprint, learnCompetence, learnKey, publishSlice, saebSliceFingerprint, sha256,
  type IdebFile, type IdebLevel, type IdebRaw, type IdebSlice, type LearnEntities, type PublishResult, type SaebFile, type SaebLevel, type SaebRaw, type SaebSlice,
} from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, assertZipIntact, readManifest, recordManifest, registerLocalRaw, runPython, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

export type Log = (m: string) => void;
export const IDEB_REL_DIR = 'inep/ideb/2025', SAEB_REL_DIR = 'inep/saeb';
const SEVENZ = 'C:/Program Files/7-Zip/7z.exe';

/** Registra no manifesto (arquivo e banco) os arquivos oficiais já baixados do Ideb e do Saeb, depois de conferir o CRC dos ZIPs. Não baixa nada. */
export async function registerLearnFiles(pool: Pool, cfg: StorageConfig, log: Log): Promise<number> {
  let n = 0;
  for (const [dir, ds] of [[IDEB_REL_DIR, 'edu_ideb'], [SAEB_REL_DIR, 'edu_saeb']] as const) {
    for (const f of (await readdir(join(cfg.rawDir, dir))).sort()) {
      if (f.endsWith('.part')) continue;
      const rel = `${dir}/${f}`; if (f.toLowerCase().endsWith('.zip')) await assertZipIntact(cfg, rel);
      const year = Number(/(20\d\d)/.exec(f)?.[1] ?? 0);
      const e = await registerLocalRaw(cfg, { url: `https://download.inep.gov.br/${ds === 'edu_ideb' ? 'ideb/resultados' : 'saeb/resultados'}/${f}`, relPath: rel, competence: year ? year * 100 + 5 : null, uf: 0, retention: 1, dataset: ds });
      await recordManifest(pool, e); n++; log(JSON.stringify({ learn: 'registered', file: rel, bytes: e.bytes }));
    }
  }
  return n;
}

export interface LearnFiles { level: string; relPaths: string[]; sha256: string[] }
export async function locateIdebFiles(cfg: StorageConfig): Promise<Record<IdebLevel, LearnFiles>> {
  const man = await readManifest(cfg); const all = [...man.values()].filter(x => x.relPath.startsWith(IDEB_REL_DIR + '/') && x.relPath.endsWith('.zip'));
  const pick = (level: IdebLevel, rx: RegExp): LearnFiles => { const e = all.filter(x => rx.test(x.relPath)).sort((a, b) => a.relPath.localeCompare(b.relPath)); if (!e.length) throw new Error(`Ideb ${level}: arquivo ausente no RAW (rode "educacao-pilot learn-register")`); return { level, relPaths: e.map(x => x.relPath), sha256: e.map(x => x.sha256) }; };
  return { brasil: pick('brasil', /divulgacao_brasil_ideb_2025\.zip$/), ufs: pick('ufs', /divulgacao_regioes_ufs_ideb_2025\.zip$/), municipios: pick('municipios', /divulgacao_(anos_iniciais|anos_finais|ensino_medio)_municipios_2025\.zip$/), escolas: pick('escolas', /divulgacao_(anos_iniciais|anos_finais|ensino_medio)_escolas_2025\.zip$/) };
}

export async function extractIdeb(cfg: StorageConfig, level: IdebLevel, f: LearnFiles): Promise<{ tsv: string; reused: boolean; summary: Record<string, unknown> | null }> {
  const dir = join(cfg.stagingDir, 'educacao'); await mkdir(dir, { recursive: true });
  const tsv = join(dir, `ideb_${level}_${f.sha256.map(s => s.slice(0, 8)).join('')}_${IDEB_VERSION.parser}.tsv`);
  try { await stat(tsv); return { tsv, reused: true, summary: null }; } catch { /* sem cache */ }
  await assertCanDecode(cfg, 400 * 1024 * 1024);
  const r = await runPython('scripts/exec/ideb_extract.py', [level, tsv, ...f.relPaths.map(p => join(cfg.rawDir, p))]);
  if (r.code !== 0) throw new Error(`extração do Ideb (${level}) falhou: ${(r.err || r.out).slice(0, 400)}`);
  return { tsv, reused: false, summary: JSON.parse(r.out.trim().split('\n').at(-1)!) as Record<string, unknown> };
}
export async function readIdebTsv(path: string): Promise<IdebRaw[]> {
  const rows: IdebRaw[] = []; let first = true;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (first) { first = false; continue; } if (!line) continue;
    const p = line.split('\t'); const v: Record<string, string> = {};
    IDEB_MEASURES.forEach((m, i) => { v[m] = p[7 + i] ?? ''; });
    rows.push({ row: Number(p[0]), k1: p[1] ?? '', k2: p[2] ?? '', k3: p[3] ?? '', rede: p[4] ?? '', stage: Number(p[5]), year: Number(p[6]), v });
  }
  return rows;
}

export async function loadLearnContext(pool: Pick<Pool, 'query'>): Promise<LearnEntities & { uf: Map<number, { entityId: number; uf: number }>; brasil: number }> {
  const ents = await pool.query(`SELECT entity_id, kind, ibge7, ibge6, uf_code, uf, name FROM civica_exec.exec_entity WHERE kind IN (1, 2, 3, 4, 5)`);
  const byIbge7 = new Map<number, { entityId: number; uf: number }>(), byIbge6 = new Map<number, { entityId: number; uf: number }>(), geo = new Map<string, { entityId: number; uf: number }>(), ufBySigla = new Map<string, number>(), ufMap = new Map<number, { entityId: number; uf: number }>(); let brasil = 0;
  for (const e of ents.rows) {
    if (e.kind === 4 || e.kind === 5) { byIbge7.set(Number(e.ibge7), { entityId: Number(e.entity_id), uf: Number(e.uf_code) }); if (e.kind === 4 && e.ibge6) byIbge6.set(Number(e.ibge6), { entityId: Number(e.entity_id), uf: Number(e.uf_code) }); continue; }
    if (e.kind === 1) brasil = Number(e.entity_id);
    const target = { entityId: Number(e.entity_id), uf: e.kind === 3 ? Number(e.uf_code) : 0 };
    geo.set(learnKey(String(e.name)), target); if (e.kind === 3) { ufMap.set(Number(e.uf_code), target); if (e.uf) ufBySigla.set(String(e.uf).toUpperCase(), Number(e.uf_code)); }
  }
  const sc = await pool.query(`SELECT inep FROM civica_exec.exec_edu_school`);
  return { byIbge7, byIbge6, geo, ufBySigla, schools: new Set(sc.rows.map(r => Number(r.inep))), uf: ufMap, brasil };
}

const scopeUf = `SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $2 AND kind IN (3, 4, 5)`;
export async function publishIdebSlice(pool: Pool, a: { slice: IdebSlice; fileShas: string[]; relPaths: string[]; first: boolean; failAfterApply?: boolean }): Promise<PublishResult> {
  const { slice } = a; const year = slice.year; const fp = idebSliceFingerprint(a.fileShas, slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  const rowsIn = slice.cov.reduce((n, c) => n + c.rows_in, 0), valid = slice.cov.reduce((n, c) => n + c.valid, 0), rejected = slice.cov.reduce((n, c) => n + c.rejected, 0);
  return publishSlice(pool, {
    datasetId: DATASET.edu_ideb, uf: slice.uf, competence: learnCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${IDEB_VERSION.parser}/${IDEB_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_ideb_school, rows: slice.school as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_ideb_terr, rows: slice.terr as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_ideb_cov, rows: slice.cov as unknown as Array<Record<string, unknown>> }],
    inputs: { year, files: a.relPaths, sha256: a.fileShas },
    quality: { rowsIn, valid, rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50) },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_ideb_school WHERE year = $1 AND uf = $2`, [year, slice.uf]);
      if (n.rows[0].n !== slice.school.length) throw new Error(`ideb ${year}/${slice.uf}: ${n.rows[0].n} escolas no banco, fatia tem ${slice.school.length}`);
      const t = slice.uf === 0
        ? await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_ideb_terr WHERE year = $1 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))`, [year])
        : await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_ideb_terr WHERE year = $1 AND entity_id IN (${scopeUf})`, [year, slice.uf]);
      if (t.rows[0].n !== slice.terr.length) throw new Error(`ideb ${year}/${slice.uf}: ${t.rows[0].n} linhas territoriais no banco, fatia tem ${slice.terr.length}`);
    },
  });
}

export interface LearnYearResult { year: number; rejected: number; rejectReasons: Record<string, number>; slices: Array<{ uf: number; status: string; school: number; terr: number }> }
/** Carrega o Ideb inteiro uma vez (todas as edições vêm nas mesmas planilhas) e publica as edições pedidas. */
export async function collectIdeb(pool: Pool, cfg: StorageConfig, years: number[], o: { ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<LearnYearResult[]> {
  await assertPgHeadroom(cfg);
  const loc = await locateIdebFiles(cfg); const files: IdebFile[] = []; const shas: string[] = []; const rels: string[] = [];
  for (const level of ['brasil', 'ufs', 'municipios', 'escolas'] as IdebLevel[]) { const ex = await extractIdeb(cfg, level, loc[level]); files.push({ level, sha256: loc[level].sha256, rows: await readIdebTsv(ex.tsv) }); shas.push(...loc[level].sha256); rels.push(...loc[level].relPaths); }
  const ctx = await loadLearnContext(pool); const slices = buildIdebYear(files, ctx, years);
  const out: LearnYearResult[] = [];
  for (const y of years) {
    const res: LearnYearResult = { year: y, rejected: 0, rejectReasons: {}, slices: [] };
    for (const s of [...slices.values()].filter(x => x.year === y).sort((a, b) => a.uf - b.uf)) {
      if (o.ufs && !o.ufs.includes(s.uf)) continue;
      for (const x of s.rejects) { res.rejected++; res.rejectReasons[x.reason] = (res.rejectReasons[x.reason] ?? 0) + 1; }
      await assertPgHeadroom(cfg);
      const first = await isFirstPublication(pool, DATASET.edu_ideb, s.uf, learnCompetence(y));
      const r = await publishIdebSlice(pool, { slice: s, fileShas: shas.sort(), relPaths: rels.sort(), first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
      res.slices.push({ uf: s.uf, status: r.status, school: s.school.length, terr: s.terr.length });
      o.log?.(JSON.stringify({ ideb: 'slice', year: y, uf: s.uf, status: r.status, school: s.school.length, terr: s.terr.length, rejected: s.rejects.length, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
    }
    o.log?.(JSON.stringify({ ideb: 'year', ...res, slices: res.slices.length, statuses: Object.fromEntries(res.slices.reduce((m, x) => m.set(x.status, (m.get(x.status) ?? 0) + 1), new Map<string, number>())) }));
    out.push(res);
  }
  return out;
}

// ======================================================================= Saeb
export interface SaebSource { year: number; level: SaebLevel; path: string; sheet?: string; relPath: string; sha256: string }
function run(cmd: string, args: string[]): Promise<number> { return new Promise(res => { const p = spawn(cmd, args, { stdio: 'ignore' }); p.on('close', c => res(c ?? 1)); p.on('error', () => res(1)); }); }
/** Edições do Saeb no RAW: 2017 (ZIP com 4 xlsx), 2019, 2021 (+ planilha de alfabetização), 2023 (RAR com xlsb) e 2025. ZIP/RAR são descompactados em staging com o 7-Zip (derivado; o RAW fica intacto). */
export async function locateSaebSources(cfg: StorageConfig): Promise<SaebSource[]> {
  const man = await readManifest(cfg); const get = (rx: RegExp) => { const e = [...man.values()].find(x => x.relPath.startsWith(SAEB_REL_DIR + '/') && rx.test(x.relPath)); if (!e) throw new Error(`Saeb: arquivo ausente (${rx}); rode "educacao-pilot learn-register"`); return e; };
  const out: SaebSource[] = []; const stg = join(cfg.stagingDir, 'educacao', 'saeb_unpack'); await mkdir(stg, { recursive: true });
  const unpack = async (rx: RegExp, sub: string) => { const e = get(rx); const dest = join(stg, sub); if ((await readdir(dest).catch(() => [])).length === 0) { if (await run(SEVENZ, ['x', '-y', `-o${dest}`, join(cfg.rawDir, e.relPath)]) !== 0) throw new Error(`falha ao descompactar ${e.relPath}`); } return { e, dest }; };
  const u17 = await unpack(/Resultados_Saeb_2017.*\.zip$/, '2017');
  for (const [lvl, f] of [['brasil', 'TS_BRASIL.xlsx'], ['regioes', 'TS_REGIAO.xlsx'], ['estados', 'TS_UF.xlsx'], ['municipios', 'TS_MUNICIPIO.xlsx']] as const) out.push({ year: 2017, level: lvl, path: join(u17.dest, f), relPath: u17.e.relPath, sha256: u17.e.sha256 });
  const e19 = get(/Resultados_Saeb_2019.*\.xlsx$/); for (const [lvl, sh] of [['brasil', 'Brasil'], ['estados', 'Estados'], ['municipios', 'Municípios']] as const) out.push({ year: 2019, level: lvl, path: join(cfg.rawDir, e19.relPath), sheet: sh, relPath: e19.relPath, sha256: e19.sha256 });
  const e21 = get(/saeb_2021_brasil_estados_municipios\.xlsx$/); for (const [lvl, sh] of [['brasil', 'Brasil'], ['estados', 'Estados'], ['municipios', 'Municípios']] as const) out.push({ year: 2021, level: lvl, path: join(cfg.rawDir, e21.relPath), sheet: sh, relPath: e21.relPath, sha256: e21.sha256 });
  const a21 = get(/saeb_2021_brasil_estados_municipios_c_tx_alfabetizado\.xlsx$/); for (const [lvl, sh] of [['brasil', 'Brasil'], ['estados', 'Estados']] as const) out.push({ year: 2021, level: lvl, path: join(cfg.rawDir, a21.relPath), sheet: sh, relPath: a21.relPath, sha256: a21.sha256 });
  const u23 = await unpack(/planilha_de_resultados_2023\.rar$/, '2023');
  for (const [lvl, sh] of [['brasil', 'Brasil'], ['estados', 'Estados'], ['municipios', 'Municípios']] as const) out.push({ year: 2023, level: lvl, path: join(u23.dest, 'Resultados_Saeb_2023_Brasil_Estados_Municipios.xlsb'), sheet: sh, relPath: u23.e.relPath, sha256: u23.e.sha256 });
  const e25 = get(/saeb_2025_brasil_estados_municipios_censitario\.xlsx$/); for (const [lvl, sh] of [['brasil', 'Brasil'], ['estados', 'Estados'], ['municipios', 'Municípios']] as const) out.push({ year: 2025, level: lvl, path: join(cfg.rawDir, e25.relPath), sheet: sh, relPath: e25.relPath, sha256: e25.sha256 });
  return out;
}
export async function extractSaeb(cfg: StorageConfig, s: SaebSource): Promise<{ tsv: string; reused: boolean; summary: Record<string, unknown> | null }> {
  const dir = join(cfg.stagingDir, 'educacao'); await mkdir(dir, { recursive: true });
  const tsv = join(dir, `saeb_${s.year}_${s.level}_${s.sha256.slice(0, 8)}_${/c_tx_alf/.test(s.path) ? 'alf' : 'res'}_${SAEB_VERSION.parser}.tsv`);
  try { await stat(tsv); return { tsv, reused: true, summary: null }; } catch { /* sem cache */ }
  const r = await runPython('scripts/exec/saeb_extract.py', [String(s.year), s.level, tsv, s.path, ...(s.sheet ? [s.sheet] : [])]);
  if (r.code !== 0) throw new Error(`extração do Saeb ${s.year}/${s.level} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return { tsv, reused: false, summary: JSON.parse(r.out.trim().split('\n').at(-1)!) as Record<string, unknown> };
}
export async function readSaebTsv(path: string, level: SaebLevel): Promise<SaebRaw[]> {
  const rows: SaebRaw[] = []; let first = true;
  for await (const line of createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })) {
    if (first) { first = false; continue; } if (!line) continue;
    const p = line.split('\t');
    rows.push({ row: Number(p[0]), year: Number(p[1]), level, uf: p[3] ?? '', ibge7: p[4] ?? '', name: p[5] ?? '', dep: p[6] ?? '', loc: p[7] ?? '', cap: p[8] ?? '', grade: Number(p[9]), subj: p[10] ?? '', media: p[11] ?? '', tx_alf: p[12] ?? '', nv: Array.from({ length: 11 }, (_, i) => p[13 + i] ?? '') });
  }
  return rows;
}

export async function publishSaebSlice(pool: Pool, a: { slice: SaebSlice; fileShas: string[]; relPaths: string[]; first: boolean; failAfterApply?: boolean }): Promise<PublishResult> {
  const { slice } = a; const year = slice.year; const fp = saebSliceFingerprint(a.fileShas, slice);
  const reasons: Record<string, number> = {}; for (const x of slice.rejects) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
  return publishSlice(pool, {
    datasetId: DATASET.edu_saeb, uf: slice.uf, competence: learnCompetence(year), stage: 2, sourceHash: fp, parserVersion: `${SAEB_VERSION.parser}/${SAEB_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.edu_saeb_terr, rows: slice.rows as unknown as Array<Record<string, unknown>> }, { spec: SPECS.edu_saeb_cov, rows: [slice.cov as unknown as Record<string, unknown>] }],
    inputs: { year, files: a.relPaths, sha256: a.fileShas },
    quality: { rowsIn: slice.cov.rows_in, valid: slice.cov.valid, rejected: slice.cov.rejected, rejectReasons: reasons, rejectedRows: slice.rejects.slice(0, 50), lossyCells: slice.lossy, emptyStrata: slice.emptyStrata },
    ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => {
      const t = slice.uf === 0
        ? await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_saeb_terr WHERE year = $1 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))`, [year])
        : await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_saeb_terr WHERE year = $1 AND entity_id IN (${scopeUf})`, [year, slice.uf]);
      if (t.rows[0].n !== slice.rows.length) throw new Error(`saeb ${year}/${slice.uf}: ${t.rows[0].n} linhas no banco, fatia tem ${slice.rows.length}`);
    },
  });
}
export async function collectSaeb(pool: Pool, cfg: StorageConfig, years: number[], o: { ufs?: number[]; log?: Log; failAfterApply?: boolean } = {}): Promise<Array<{ year: number; rejected: number; lossy: number; slices: number; statuses: Record<string, number> }>> {
  await assertPgHeadroom(cfg);
  const sources = (await locateSaebSources(cfg)).filter(s => years.includes(s.year)); const ctx = await loadLearnContext(pool); const out = [];
  for (const y of years) {
    const files: SaebFile[] = []; const shas: string[] = []; const rels: string[] = [];
    for (const s of sources.filter(x => x.year === y)) { const ex = await extractSaeb(cfg, s); files.push({ level: s.level, sha256: [s.sha256], rows: await readSaebTsv(ex.tsv, s.level) }); shas.push(s.sha256); rels.push(s.relPath); }
    const slices = buildSaebYear(files, ctx); let rejected = 0, lossy = 0; const statuses = new Map<string, number>();
    for (const s of [...slices.values()].sort((a, b) => a.uf - b.uf)) {
      if (o.ufs && !o.ufs.includes(s.uf)) continue; rejected += s.rejects.length; lossy += s.lossy;
      await assertPgHeadroom(cfg); const first = await isFirstPublication(pool, DATASET.edu_saeb, s.uf, learnCompetence(y));
      const r = await publishSaebSlice(pool, { slice: s, fileShas: [...new Set(shas)].sort(), relPaths: [...new Set(rels)].sort(), first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
      statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
      o.log?.(JSON.stringify({ saeb: 'slice', year: y, uf: s.uf, status: r.status, rows: s.rows.length, rejected: s.rejects.length, first, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
    }
    const res = { year: y, rejected, lossy, slices: slices.size, statuses: Object.fromEntries(statuses) }; o.log?.(JSON.stringify({ saeb: 'year', ...res })); out.push(res);
  }
  void SAEB_LEVEL_COLS; void sha256;
  return out;
}
