import type { Pool, PoolClient } from 'pg';
import {
  DATASET, DCA_IE_COLUMNS, DCA_IG_COLUMNS, FIN_DCARP_IDS, FIN_DCA_IDS, FIN_DOMAIN, FIN_RREO_IDS, FIN_SOURCE, FIN_VERSION, RREO_COLUMNS, SPECS, buildFinSlice, collectCodes, ensureRefCodes, parseDcaIE, parseDcaIG, parseRreo02, publishSlice, replaceIndicatorsBulk, sha256,
  type FinEnteInput, type FinSlice, type SiconfiItem,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { ALL_UFS, isFirstPublication, loadPopulation } from './seguranca.ts';
import { assertPgHeadroom, assertVolume, readManifest, type StorageConfig } from './storage.ts';
import { bundleRel, latestBimester, readBundle, type Anexo } from './siconfi.ts';

export type Log = (m: string) => void;
type Kind = 'dca' | 'rreo' | 'dcarp';
const ANEXO: Record<Kind, Anexo> = { dca: 'DCA-Anexo I-E', rreo: 'RREO-Anexo 02', dcarp: 'DCA-Anexo I-G' };

/** cod_ibge do Siconfi → entity_id do Cívica (UF = código de 2 dígitos; município = ibge7; União = 1 → Brasil). */
export async function loadSiconfiEntityMap(pool: Pool): Promise<Map<number, number>> {
  const r = await pool.query(`SELECT entity_id, kind, ibge7 FROM civica_exec.exec_entity WHERE kind IN (1, 3, 4)`);
  const m = new Map<number, number>();
  for (const x of r.rows) { const kind = Number(x.kind); if (kind === 1) m.set(1, Number(x.entity_id)); else m.set(Number(x.ibge7), Number(x.entity_id)); }
  return m;
}
export interface FinLoaded { kind: Kind; year: number; ufCode: number; relPath: string; sha256: string; periodo: number; entes: FinEnteInput[]; unmatched: number[] }
/** Lê o pacote RAW preservado de uma UF × exercício (não baixa nada). null = pacote ainda não coletado. */
export async function loadFinBundle(cfg: StorageConfig, entityMap: Map<number, number>, kind: Kind, year: number, ufCode: number): Promise<FinLoaded | null> {
  const periodo = kind === 'rreo' ? latestBimester(year) : 0; const rel = bundleRel(ANEXO[kind], year, ufCode, periodo);
  const man = (await readManifest(cfg)).get(rel); if (!man) return null;
  const entes: FinEnteInput[] = []; const unmatched: number[] = [];
  for await (const l of readBundle(cfg, rel)) {
    const entityId = entityMap.get(l.e); if (entityId === undefined) { unmatched.push(l.e); continue; }
    const items = l.s === 200 ? (JSON.parse(l.b) as { items: SiconfiItem[] }).items : [];
    entes.push({ entityId, status: l.s === 200 || l.s === 404 ? 200 : l.s, items });
  }
  return { kind, year, ufCode, relPath: rel, sha256: man.sha256, periodo, entes, unmatched };
}

/** Resolve os códigos do dicionário (idempotente) e constrói a fatia. */
export async function buildSliceFor(pool: Pool, l: FinLoaded, pop: Map<number, number>): Promise<FinSlice> {
  const parse = l.kind === 'dca' ? parseDcaIE : l.kind === 'dcarp' ? parseDcaIG : parseRreo02; const parsed = l.entes.filter(e => e.items.length).map(e => parse(e.items));
  const contaMap = await ensureRefCodes(pool, FIN_DOMAIN.conta, [...collectCodes(parsed)].map(([code, label]) => ({ code, label, attrs: { source: 'Siconfi', note: code === 'TOT' || code === 'INTRA' ? 'total do ente' : code.includes('.') || code.startsWith('FU') ? 'subfunção' : 'função' } })));
  const cols = l.kind === 'dca' ? DCA_IE_COLUMNS : l.kind === 'dcarp' ? DCA_IG_COLUMNS : RREO_COLUMNS;
  const colMap = await ensureRefCodes(pool, l.kind === 'dca' ? FIN_DOMAIN.colDcaIE : l.kind === 'dcarp' ? FIN_DOMAIN.colDcaIG : FIN_DOMAIN.colRreo02, cols.map(c => ({ code: c.code, label: c.label, attrs: { unit: 'centavos', semantic: c.semantic, demonstrativo: ANEXO[l.kind] } })));
  const need = (m: Map<string, number>, c: string) => { const v = m.get(c); if (v === undefined) throw new Error(`código ${c} fora do dicionário`); return v; };
  return buildFinSlice({ source: l.kind === 'dca' ? FIN_SOURCE.dcaIE : l.kind === 'dcarp' ? FIN_SOURCE.dcaIG : FIN_SOURCE.rreo02, year: l.year, periodo: l.periodo, pop, entities: l.entes, ids: { conta: c => need(contaMap, c), col: c => need(colMap, c) } });
}

const popHash = (pop: Map<number, number>, entities: number[]) => sha256(entities.map(e => `${e}:${pop.get(e) ?? ''}`).join(','));
export interface FinPublishResult { kind: Kind; year: number; uf: number; status: string; facts: number; indicators: number; cov: Record<string, number>; failures: number }

/** Publica UMA fatia (UF × exercício, ou União × exercício quando ufCode = 0) com fatos, cobertura e indicadores na mesma transação. */
export async function publishFinSlice(pool: Pool, l: FinLoaded, slice: FinSlice, pop: Map<number, number>, o: { first: boolean; failAfterApply?: boolean } = { first: false }) {
  const isBr = l.ufCode === 0; const dca = l.kind === 'dca'; const competence = l.year * 100 + 12;
  const rp = l.kind === 'dcarp'; const pick = <T,>(a: T, ab: T, b: T, bb: T, c: T, cb: T): T => dca ? (isBr ? ab : a) : rp ? (isBr ? cb : c) : (isBr ? bb : b);
  const dataset = pick(DATASET.fin_dca_uf, DATASET.fin_dca_br, DATASET.fin_rreo_uf, DATASET.fin_rreo_br, DATASET.fin_dcarp_uf, DATASET.fin_dcarp_br);
  const factSpec = pick(SPECS.fin_fact_dca, SPECS.fin_fact_dca_br, SPECS.fin_fact_rreo, SPECS.fin_fact_rreo_br, SPECS.fin_fact_dcarp, SPECS.fin_fact_dcarp_br);
  const covSpec = pick(SPECS.fin_cov_dca, SPECS.fin_cov_dca_br, SPECS.fin_cov_rreo, SPECS.fin_cov_rreo_br, SPECS.fin_cov_dcarp, SPECS.fin_cov_dcarp_br);
  const ids = dca ? FIN_DCA_IDS : rp ? FIN_DCARP_IDS : FIN_RREO_IDS; const source = dca ? FIN_SOURCE.dcaIE : rp ? FIN_SOURCE.dcaIG : FIN_SOURCE.rreo02;
  const fingerprint = sha256(`${l.sha256}:${FIN_VERSION.publish}:${dca ? FIN_VERSION.dca : rp ? FIN_VERSION.dcaRp : FIN_VERSION.rreo}:${popHash(pop, l.entes.map(e => e.entityId))}`);
  return publishSlice(pool, {
    datasetId: dataset, uf: l.ufCode, competence, stage: 2, sourceHash: fingerprint, parserVersion: FIN_VERSION.publish, bootstrap: o.first,
    tables: [{ spec: factSpec, rows: slice.facts }, { spec: covSpec, rows: slice.cov }],
    inputs: { anexo: ANEXO[l.kind], year: l.year, periodo: l.periodo, file: l.relPath, sha256: l.sha256, entes: l.entes.length }, quality: slice.quality, ...(o.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: ids, ufCode: l.ufCode, from: `${l.year}-01-01`, to: `${l.year + 1}-01-01`, ...(isBr ? { nationalOnly: true } : {}) }, slice.indicators, !o.first); },
    verify: async c => verifyFinSlice(c, l, slice, source),
  });
}
/** Soma dos fatos persistidos = soma dos fatos de origem; indicador 7001/7043 (R$) × 100 = fato da função 06 correspondente. */
async function verifyFinSlice(c: PoolClient, l: FinLoaded, slice: FinSlice, source: number): Promise<void> {
  const ents = [...new Set(slice.facts.map(f => Number(f.entity_id)))];
  const staged = slice.facts.reduce((s, f) => s + Number(f.valor), 0);
  const r = await c.query(`SELECT count(*)::int AS n, coalesce(sum(f.valor), 0)::numeric AS s FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code k ON k.ref_id = f.coluna_id
    WHERE f.exercicio = $1 AND f.entity_id = ANY($2::int[]) AND k.domain = $3`, [l.year, ents, source === FIN_SOURCE.dcaIE ? FIN_DOMAIN.colDcaIE : source === FIN_SOURCE.dcaIG ? FIN_DOMAIN.colDcaIG : FIN_DOMAIN.colRreo02]);
  const bad: string[] = [];
  if (Number(r.rows[0].n) !== slice.facts.length) bad.push(`linhas de exec_fin_fact ${r.rows[0].n} ≠ ${slice.facts.length}`);
  if (BigInt(String(r.rows[0].s).split('.')[0]!) !== BigInt(staged)) bad.push(`Σ valor ${r.rows[0].s} ≠ ${staged}`);
  if (source === FIN_SOURCE.dcaIG) { if (bad.length) throw new Error(`reconciliação financeira ${l.kind} ${l.year}/${l.ufCode}: ${bad.join('; ')}`); return; }
  const indId = source === FIN_SOURCE.dcaIE ? 7001 : 7043; const colCode = source === FIN_SOURCE.dcaIE ? 'EMP' : 'EMP_ATE';
  const x = await c.query(`SELECT coalesce(sum(round(v.numerator * 100)), 0)::numeric AS ind, (SELECT coalesce(sum(f.valor), 0)::numeric FROM civica_exec.exec_fin_fact f
      JOIN civica_exec.exec_ref_code ct ON ct.ref_id = f.conta_id AND ct.domain = ${FIN_DOMAIN.conta} AND ct.code = '06' JOIN civica_exec.exec_ref_code cl ON cl.ref_id = f.coluna_id AND cl.code = $3
      WHERE f.exercicio = $1 AND f.entity_id = ANY($2::int[]) AND cl.domain IN (${FIN_DOMAIN.colDcaIE}, ${FIN_DOMAIN.colRreo02})) AS fact
    FROM civica_exec.exec_ind_value v WHERE v.indicator_id = $4 AND v.period_start = make_date($1, 1, 1) AND v.entity_id = ANY($2::int[])`, [l.year, ents, colCode, indId]);
  if (String(x.rows[0].ind) !== String(x.rows[0].fact)) bad.push(`indicador ${indId} ${x.rows[0].ind} ≠ fato 06 ${x.rows[0].fact}`);
  if (bad.length) throw new Error(`reconciliação financeira ${l.kind} ${l.year}/${l.ufCode}: ${bad.join('; ')}`);
}

export interface FinRunOptions { kind: Kind; years: number[]; ufs?: string[]; log?: Log; failAfterApply?: boolean; includeUniao?: boolean }
/** Publica os pacotes RAW já coletados. UFs/anos sem pacote são relatados como `missing` (não são zero). */
export async function collectFinancas(pool: Pool, cfg: StorageConfig, o: FinRunOptions): Promise<{ results: FinPublishResult[]; missing: Array<{ year: number; uf: number }> }> {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const emap = await loadSiconfiEntityMap(pool); const results: FinPublishResult[] = []; const missing: Array<{ year: number; uf: number }> = [];
  const ufs = (o.ufs?.length ? o.ufs.map(u => u.toUpperCase()) : ALL_UFS).map(u => ({ name: u, code: u === 'BR' ? 0 : UF_CODE[u]! }));
  if (o.includeUniao && !ufs.some(u => u.code === 0)) ufs.push({ name: 'BR', code: 0 });
  for (const year of o.years) {
    const pop = await loadPopulation(pool, year);
    for (const u of ufs) {
      const l = await loadFinBundle(cfg, emap, o.kind, year, u.code); if (!l) { missing.push({ year, uf: u.code }); continue; }
      const slice = await buildSliceFor(pool, l, pop);
      const dataset = o.kind === 'dca' ? (u.code === 0 ? DATASET.fin_dca_br : DATASET.fin_dca_uf) : o.kind === 'dcarp' ? (u.code === 0 ? DATASET.fin_dcarp_br : DATASET.fin_dcarp_uf) : (u.code === 0 ? DATASET.fin_rreo_br : DATASET.fin_rreo_uf);
      const first = await isFirstPublication(pool, dataset, u.code, year * 100 + 12);
      const r = await publishFinSlice(pool, l, slice, pop, { first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
      const covBy: Record<string, number> = {}; for (const c of slice.cov) covBy[String(c.status)] = (covBy[String(c.status)] ?? 0) + 1;
      results.push({ kind: o.kind, year, uf: u.code, status: r.status, facts: slice.facts.length, indicators: slice.indicators.length, cov: covBy, failures: slice.failures.length });
      o.log?.(JSON.stringify({ financas: o.kind, year, uf: u.name, status: r.status, facts: slice.facts.length, indicators: slice.indicators.length, cov: covBy, unmatched: l.unmatched.length, invariantFailures: slice.failures.length }));
    }
  }
  return { results, missing };
}
