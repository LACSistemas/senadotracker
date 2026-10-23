import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import {
  DATASET, EFE_VERSION, ESTADIC_IDS, FBSP_ALL_IDS, IBGE_EDITIONS, SIAPE_IDS, buildSiape, FBSP_CORPS, FBSP_GCM_IDS, FBSP_PLANS, MUNIC_IDS, MUNIC_UF_AGG, SPECS, buildEstadic, buildFbsp, buildMunic, publishSlice, replaceIndicatorsBulk,
  seedEfetivosDefs, sha256, type EstadicBuilt, type FbspBuilt, type FbspJson, type IbgeEdition, type IbgeJson, type IndicatorRow, type MunicBuilt, type SiapeBuilt, type SiapeJson,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { ALL_UFS, UF_ACRONYM, isFirstPublication, loadEntityDir, loadPopulation } from './seguranca.ts';
import { assertCanDecode, assertVolume, fetchRaw, readManifest, recordManifest, registerLocalRaw, runPython, type ManifestEntry, type StorageConfig } from './storage.ts';

export type Log = (m: string) => void;
void SPECS;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const IBGE_SRC = Object.fromEntries(Object.values(IBGE_EDITIONS).map(e => [e.key, { url: e.url, relPath: e.relPath, competence: e.competence, dataset: e.dataset, magic: 'PK' }])) as Record<IbgeEdition['key'], { url: string; relPath: string; competence: number; dataset: string; magic: string }>;
export const EFE_SOURCES = {
  fbsp: { url: 'https://forumseguranca.org.br/wp-content/uploads/2026/08/raio-x-forcas-seguranca-2026.pdf', relPath: 'seguranca/efetivos/fbsp-raiox-2026/raio-x-forcas-seguranca-2026.pdf', competence: 202501, dataset: 'fbsp_raiox', magic: '%PDF' },
  ...IBGE_SRC,
} as const;
export type EfeSourceKey = keyof typeof EFE_SOURCES;
const extractSpec = (key: EfeSourceKey): { script: string; args: string[]; version: string } => key === 'fbsp'
  ? { script: 'scripts/exec/fbsp_extract.py', args: [], version: EFE_VERSION.fbspExtract }
  : { script: 'scripts/exec/ibge_perfil_extract.py', args: [IBGE_EDITIONS[key].mode], version: EFE_VERSION.ibgeExtract };

export interface EfeFile { key: EfeSourceKey; entry: ManifestEntry; reused: boolean }
/** Baixa (ou reutiliza por hash) o arquivo oficial para o RAW. Fonte republicada com conteúdo diferente vira nova pasta de data, nunca sobrescreve. */
export async function fetchEfetivosSource(pool: Pool, cfg: StorageConfig, key: EfeSourceKey, log?: Log): Promise<EfeFile> {
  const s = EFE_SOURCES[key]; await assertVolume(cfg);
  const entry = await fetchRaw(cfg, { url: s.url, relPath: s.relPath, competence: s.competence, uf: 0, retention: 1, dataset: s.dataset, dedupeByHash: true, userAgent: BROWSER_UA, accept: head => head.subarray(0, s.magic.length).toString('latin1') === s.magic });
  await recordManifest(pool, entry); log?.(JSON.stringify({ efetivos: 'raw', key, sha256: entry.sha256, bytes: entry.bytes, reused: entry.reused }));
  return { key, entry, reused: entry.reused };
}
/** Extração para JSON em staging (cache por hash + versão do extrator); o JSON não contém dado pessoal. */
export async function extractEfetivos<T>(cfg: StorageConfig, f: EfeFile): Promise<T> {
  await mkdir(cfg.stagingDir, { recursive: true }); const py = extractSpec(f.key);
  const cache = join(cfg.stagingDir, `efe_${f.key}_${f.entry.sha256.slice(0, 12)}_${py.version}.json`);
  try { return JSON.parse(await readFile(cache, 'utf8')) as T; } catch { /* sem cache */ }
  await assertCanDecode(cfg, f.entry.bytes);
  const r = await runPython(py.script, [...py.args, join(cfg.rawDir, f.entry.relPath), cache, ...(f.key === 'fbsp' ? [] : [String(IBGE_EDITIONS[f.key].year)])]);
  if (r.code !== 0) throw new Error(`extração ${f.key} falhou: ${(r.err || r.out).slice(0, 500)}`);
  return JSON.parse(await readFile(cache, 'utf8')) as T;
}

interface Ents { ufEntityBySigla: Map<string, number>; ufEntityByCode: Map<number, number>; brEntity: number }
export async function loadEntities(pool: Pick<Pool, 'query'>): Promise<Ents> {
  const r = await pool.query(`SELECT entity_id, kind, uf, uf_code FROM civica_exec.exec_entity WHERE kind IN (1, 3)`);
  const ufEntityBySigla = new Map<string, number>(); const ufEntityByCode = new Map<number, number>(); let br = 0;
  for (const x of r.rows) { if (Number(x.kind) === 1) br = Number(x.entity_id); else { ufEntityBySigla.set(String(x.uf), Number(x.entity_id)); ufEntityByCode.set(Number(x.uf_code), Number(x.entity_id)); } }
  if (!br || ufEntityBySigla.size !== 27) throw new Error(`entidades Brasil/UF incompletas (br=${br}, ufs=${ufEntityBySigla.size})`);
  return { ufEntityBySigla, ufEntityByCode, brEntity: br };
}
const dayAfter = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const span = (rows: IndicatorRow[]) => ({ from: rows.map(r => r.period_start).sort()[0]!, to: dayAfter(rows.map(r => r.period_start).sort().at(-1)!) });

// ===================================================================== FBSP
export interface FbspPublishArgs { file: EfeFile; built: FbspBuilt; first: boolean; failAfterApply?: boolean }
export async function publishFbspSlice(pool: Pool, a: FbspPublishArgs) {
  const { from, to } = span(a.built.rows);
  return publishSlice(pool, {
    datasetId: DATASET.efe_fbsp, uf: 0, competence: EFE_SOURCES.fbsp.competence, stage: 2, sourceHash: sha256(`${a.file.entry.sha256}:${EFE_VERSION.fbsp}:${EFE_VERSION.fbspExtract}`), parserVersion: EFE_VERSION.fbsp, bootstrap: a.first,
    tables: [], inputs: { file: a.file.entry.relPath, sha256: a.file.entry.sha256 }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: FBSP_ALL_IDS, ufCode: 0, from, to, includeNational: true }, a.built.rows, !a.first); },
    verify: async c => verifyAdditive(c, [...FBSP_CORPS.filter(x => x.byUf).map(x => x.id), ...FBSP_PLANS.flatMap(p => [p.previsto]), FBSP_GCM_IDS.munFinal, FBSP_GCM_IDS.efRais, FBSP_GCM_IDS.munRais], 'FBSP'),
  });
}
/** Σ das 27 UFs = linha Brasil, por indicador aditivo e período (a fonte publica os dois níveis; a soma não pode divergir após a gravação). */
async function verifyAdditive(c: PoolClient, ids: number[], tag: string): Promise<void> {
  const r = await c.query(`SELECT x.indicator_id, x.period_start::text AS p, x.s, x.b FROM (
      SELECT v.indicator_id, v.period_start, sum(v.value) FILTER (WHERE e.kind = 3) AS s, max(v.value) FILTER (WHERE e.kind = 1) AS b, count(*) FILTER (WHERE e.kind = 1) AS nb
      FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE v.indicator_id = ANY($1::smallint[]) GROUP BY 1, 2) x
    WHERE x.nb = 1 AND x.s IS DISTINCT FROM x.b`, [ids]);
  if (r.rows.length) throw new Error(`reconciliação ${tag}: Σ UFs ≠ Brasil em ${r.rows.map(x => `${x.indicator_id}@${x.p} (${x.s} × ${x.b})`).join('; ')}`);
}
export async function collectFbsp(pool: Pool, cfg: StorageConfig, o: { log?: Log; file?: EfeFile; failAfterApply?: boolean } = {}) {
  const file = o.file ?? await fetchEfetivosSource(pool, cfg, 'fbsp', o.log);
  const j = await extractEfetivos<FbspJson>(cfg, file); const ents = await loadEntities(pool);
  const pop = await loadPopulation(pool, 2025); const built = buildFbsp(j, { ufEntityBySigla: ents.ufEntityBySigla, brEntity: ents.brEntity, popByEntity: pop });
  const first = await isFirstPublication(pool, DATASET.efe_fbsp, 0, EFE_SOURCES.fbsp.competence);
  const r = await publishFbspSlice(pool, { file, built, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
  o.log?.(JSON.stringify({ efetivos: 'fbsp', status: r.status, rows: built.rows.length, recon: built.recon.length, reconFailed: built.recon.filter(x => !x.ok).length, first }));
  return { file, built, result: r };
}

// ===================================================================== ESTADIC
export interface EstadicPublishArgs { file: EfeFile; edition: IbgeEdition; built: EstadicBuilt; first: boolean; failAfterApply?: boolean }
export async function publishEstadicSlice(pool: Pool, a: EstadicPublishArgs) {
  const { from, to } = span(a.built.rows);
  return publishSlice(pool, {
    datasetId: DATASET.efe_estadic, uf: 0, competence: a.edition.competence, stage: 2, sourceHash: sha256(`${a.file.entry.sha256}:${EFE_VERSION.estadic}:${EFE_VERSION.ibgeExtract}`), parserVersion: EFE_VERSION.estadic, bootstrap: a.first,
    tables: [], inputs: { file: a.file.entry.relPath, sha256: a.file.entry.sha256, edition: a.edition.key }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: ESTADIC_IDS, ufCode: 0, from, to }, a.built.rows, !a.first); },
    verify: async c => {
      const r = await c.query(`SELECT indicator_id, sum(value)::float8 AS s FROM civica_exec.exec_ind_value WHERE indicator_id = ANY($1::smallint[]) AND period_start >= $2::date AND period_start < $3::date GROUP BY 1`, [ESTADIC_IDS, from, to]);
      const got = new Map(r.rows.map(x => [Number(x.indicator_id), Number(x.s)]));
      for (const [id, expected] of Object.entries(a.built.sums)) if (got.get(Number(id)) !== expected) throw new Error(`reconciliação ESTADIC ${a.edition.year} ${id}: banco ${got.get(Number(id))} × arquivo ${expected}`);
    },
  });
}
export async function collectEstadic(pool: Pool, cfg: StorageConfig, o: { edition?: IbgeEdition['key']; log?: Log; file?: EfeFile; failAfterApply?: boolean } = {}) {
  const key = o.edition ?? 'estadic2023'; const edition = IBGE_EDITIONS[key]; if (edition.mode !== 'estadic') throw new Error(`${key} não é ESTADIC`);
  const file = o.file ?? await fetchEfetivosSource(pool, cfg, key, o.log);
  const j = await extractEfetivos<IbgeJson>(cfg, file); const ents = await loadEntities(pool);
  const built = buildEstadic(j, { ufEntityByCode: ents.ufEntityByCode, edition });
  const first = await isFirstPublication(pool, DATASET.efe_estadic, 0, edition.competence);
  const r = await publishEstadicSlice(pool, { file, edition, built, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
  o.log?.(JSON.stringify({ efetivos: 'estadic', edition: key, status: r.status, rows: built.rows.length, respondents: built.quality.respondents, first }));
  return { file, built, result: r };
}

// ===================================================================== MUNIC
export interface MunicPublishArgs { file: EfeFile; edition: IbgeEdition; ufCode: number; built: MunicBuilt; first: boolean; failAfterApply?: boolean }
export async function publishMunicSlice(pool: Pool, a: MunicPublishArgs) {
  const { from, to } = span(a.built.rows);
  return publishSlice(pool, {
    datasetId: DATASET.efe_munic, uf: a.ufCode, competence: a.edition.competence, stage: 2, sourceHash: sha256(`${a.file.entry.sha256}:${EFE_VERSION.munic}:${EFE_VERSION.ibgeExtract}`), parserVersion: EFE_VERSION.munic, bootstrap: a.first,
    tables: [], inputs: { file: a.file.entry.relPath, sha256: a.file.entry.sha256, uf: a.ufCode, edition: a.edition.key }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: MUNIC_IDS, ufCode: a.ufCode, from, to }, a.built.rows, !a.first); },
    verify: async c => verifyMunicUf(c, a.ufCode, a.built, from, to),
  });
}
/** Σ dos municípios da UF = agregado da UF = estatística do arquivo (guardas, efetivo, sem resposta, delegacia), dentro das janelas da edição. */
async function verifyMunicUf(c: PoolClient, ufCode: number, b: MunicBuilt, from: string, to: string): Promise<void> {
  const r = await c.query(`SELECT v.indicator_id, sum(v.value) FILTER (WHERE e.kind = 4)::float8 AS mun, max(v.value) FILTER (WHERE e.kind = 3)::float8 AS uf,
      count(*) FILTER (WHERE e.kind = 4 AND v.value = 1)::int AS yes, count(*) FILTER (WHERE e.kind = 4 AND v.value IS NULL AND (v.flags & 1536) <> 0)::int AS ni
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e ON e.entity_id = v.entity_id WHERE e.uf_code = $1 AND v.indicator_id = ANY($2::smallint[]) AND v.period_start >= $3::date AND v.period_start < $4::date GROUP BY 1`,
  [ufCode, [5201, 5202, 5211, MUNIC_UF_AGG.guardas, MUNIC_UF_AGG.efetivo, MUNIC_UF_AGG.semResposta, MUNIC_UF_AGG.delegacia], from, to]);
  const g = new Map(r.rows.map(x => [Number(x.indicator_id), x])); const s = b.stats; const bad: string[] = []; const semResp = s.naoInformou + s.recusa;
  const eq = (name: string, a: unknown, e: number) => { if (Number(a) !== e) bad.push(`${name}: banco ${String(a)} × arquivo ${e}`); };
  eq('guardas (Σ municípios)', g.get(5201)?.mun, s.comGuarda); eq('guardas (UF)', g.get(MUNIC_UF_AGG.guardas)?.uf, s.comGuarda);
  eq('efetivo (Σ municípios)', g.get(5202)?.mun ?? 0, s.efetivo); eq('efetivo (UF)', g.get(MUNIC_UF_AGG.efetivo)?.uf, s.efetivo);
  eq('sem resposta (UF)', g.get(MUNIC_UF_AGG.semResposta)?.uf, semResp); eq('sem resposta (municípios)', g.get(5201)?.ni, semResp);
  eq('delegacia PC (Σ municípios)', g.get(5211)?.mun, s.comDelegaciaPc); eq('delegacia PC (UF)', g.get(MUNIC_UF_AGG.delegacia)?.uf, s.comDelegaciaPc);
  if (bad.length) throw new Error(`reconciliação MUNIC ${UF_ACRONYM[ufCode] ?? ufCode}: ${bad.join('; ')}`);
}
export interface MunicResult { uf: string; status: string; rows?: number; stats?: MunicBuilt['stats']; firstTime?: boolean }
export async function collectMunic(pool: Pool, cfg: StorageConfig, o: { edition?: IbgeEdition['key']; ufs?: string[] | undefined; log?: Log; file?: EfeFile; failAfterApply?: boolean } = {}): Promise<{ file: EfeFile; results: MunicResult[] }> {
  const key = o.edition ?? 'munic2023'; const edition = IBGE_EDITIONS[key]; if (edition.mode !== 'munic') throw new Error(`${key} não é MUNIC`);
  const file = o.file ?? await fetchEfetivosSource(pool, cfg, key, o.log);
  const j = await extractEfetivos<IbgeJson>(cfg, file); const ents = await loadEntities(pool); const { dir } = await loadEntityDir(pool);
  const ufs = o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS; const results: MunicResult[] = [];
  for (const uf of ufs) {
    const ufCode = UF_CODE[uf]; if (!ufCode) throw new Error(`UF desconhecida: ${uf}`);
    const built = buildMunic(j, { ufCode, ufEntity: ents.ufEntityByCode.get(ufCode)!, dir, edition });
    if (built.unmatched.length) throw new Error(`MUNIC ${uf}: municípios sem entidade ${built.unmatched.join(',')}`);
    const first = await isFirstPublication(pool, DATASET.efe_munic, ufCode, edition.competence);
    const r = await publishMunicSlice(pool, { file, edition, ufCode, built, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    results.push({ uf, status: r.status, rows: built.rows.length, stats: built.stats, firstTime: first });
    o.log?.(JSON.stringify({ efetivos: 'munic', edition: key, uf, status: r.status, rows: built.rows.length, ...built.stats }));
  }
  return { file, results };
}

export async function seedEfetivos(pool: Pool): Promise<number> { return seedEfetivosDefs(pool); }

// ===================================================================== SIAPE (agregado por órgão; o original tem dado pessoal e é descartado)
const SIAPE_URL = (ym: number) => `https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/servidores/${ym}_Servidores_SIAPE.zip`;
const SIAPE_AGG_DIR = 'seguranca/efetivos/siape-agg';
type SiapeAgg = SiapeJson & { source: { url: string; sha256: string; bytes: number } };
export interface SiapePublishArgs { ym: number; agg: SiapeAgg; built: SiapeBuilt; first: boolean; failAfterApply?: boolean }
export async function publishSiapeSlice(pool: Pool, a: SiapePublishArgs) {
  const { from, to } = span(a.built.rows);
  return publishSlice(pool, {
    datasetId: DATASET.efe_siape, uf: 0, competence: a.ym, stage: 2, sourceHash: sha256(`${a.agg.source.sha256}:${EFE_VERSION.siape}:${a.agg.version}`), parserVersion: EFE_VERSION.siape, bootstrap: a.first,
    tables: [], inputs: { source: a.agg.source, aggregate: `${SIAPE_AGG_DIR}/${a.ym}` }, quality: a.built.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: SIAPE_IDS, ufCode: 0, from, to, includeNational: true }, a.built.rows, !a.first); },
  });
}
/** Uma competência por vez: baixa o zip para o staging, agrega em memória (somente contagens por órgão), grava o agregado no RAW, registra o original como descartado e o apaga. */
export async function collectSiape(pool: Pool, cfg: StorageConfig, o: { months: number[]; log?: Log; refresh?: boolean; keepOriginal?: boolean; failAfterApply?: boolean }) {
  await assertVolume(cfg); const ents = await loadEntities(pool); const out: Array<{ ym: number; status: string; rows: number; pf: number; prf: number; reusedAggregate: boolean }> = [];
  const dl = { ...cfg, rawDir: join(cfg.stagingDir, 'siape-dl') }; await mkdir(dl.rawDir, { recursive: true }); await mkdir(join(cfg.rawDir, SIAPE_AGG_DIR), { recursive: true });
  for (const ym of o.months) {
    const existing = (await readdir(join(cfg.rawDir, SIAPE_AGG_DIR))).find(f => f.startsWith(`${ym}_`) && f.endsWith('.agg.json.gz'));
    let agg: SiapeAgg; let reused = false;
    if (existing && !o.refresh) {
      agg = JSON.parse(gunzipSync(await readFile(join(cfg.rawDir, SIAPE_AGG_DIR, existing))).toString('utf8')) as SiapeAgg; reused = true;
      // o agregado já está no RAW: garante o espelho no banco (exec_raw_manifest) para o agregado e para o original descartado
      const known = (await readManifest(cfg)).get(`${SIAPE_AGG_DIR}/${existing}`); if (known) await recordManifest(pool, known);
      await pool.query(`INSERT INTO civica_exec.exec_raw_manifest (run_id, source_url, rel_path, sha256, bytes, source_modified_at, competence, uf, fetched_at, state, retention_class)
        VALUES (NULL,$1,$2,$3,$4,NULL,$5,0,now(),3,4) ON CONFLICT (sha256) DO NOTHING`, [agg.source.url, `(descartado) ${ym}_Servidores_SIAPE.zip`, Buffer.from(agg.source.sha256, 'hex'), agg.source.bytes, ym]);
    }
    else {
      const rel = `${ym}_Servidores_SIAPE.zip`; const zip = join(dl.rawDir, rel);
      const entry = await fetchRaw(dl, { url: SIAPE_URL(ym), relPath: rel, competence: ym, uf: 0, retention: 4, dataset: 'siape_original', userAgent: BROWSER_UA, accept: h => h[0] === 0x50 && h[1] === 0x4b });
      await assertCanDecode(cfg, entry.bytes);
      const tmp = join(cfg.stagingDir, `siape_${ym}_${entry.sha256.slice(0, 12)}.json`);
      const r = await runPython('scripts/exec/siape_extract.py', [zip, tmp]); if (r.code !== 0) throw new Error(`extração SIAPE ${ym} falhou: ${(r.err || r.out).slice(0, 400)}`);
      agg = { ...(JSON.parse(await readFile(tmp, 'utf8')) as SiapeJson), source: { url: SIAPE_URL(ym), sha256: entry.sha256, bytes: entry.bytes } }; await rm(tmp, { force: true });
      const aggRel = `${SIAPE_AGG_DIR}/${ym}_${entry.sha256.slice(0, 16)}.agg.json.gz`; await writeFile(join(cfg.rawDir, aggRel), gzipSync(Buffer.from(JSON.stringify(agg))));
      await recordManifest(pool, await registerLocalRaw(cfg, { url: SIAPE_URL(ym), relPath: aggRel, competence: ym, uf: 0, retention: 1, dataset: 'siape_agg' }));
      await pool.query(`INSERT INTO civica_exec.exec_raw_manifest (run_id, source_url, rel_path, sha256, bytes, source_modified_at, competence, uf, fetched_at, state, retention_class)
        VALUES (NULL,$1,$2,$3,$4,NULL,$5,0,now(),3,4) ON CONFLICT (sha256) DO NOTHING`, [SIAPE_URL(ym), `(descartado) ${rel}`, Buffer.from(entry.sha256, 'hex'), entry.bytes, ym]);
      if (!o.keepOriginal) await rm(zip, { force: true });
    }
    const built = buildSiape(agg, { brEntity: ents.brEntity }); const first = await isFirstPublication(pool, DATASET.efe_siape, 0, ym);
    const res = await publishSiapeSlice(pool, { ym, agg, built, first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    const pf = (built.quality.PF as { rows: number }).rows, prf = (built.quality.PRF as { rows: number }).rows;
    out.push({ ym, status: res.status, rows: built.rows.length, pf, prf, reusedAggregate: reused });
    o.log?.(JSON.stringify({ efetivos: 'siape', ym, status: res.status, pf, prf, fileRows: agg.file_rows, original: o.keepOriginal ? 'mantido' : 'descartado' }));
  }
  return out;
}
