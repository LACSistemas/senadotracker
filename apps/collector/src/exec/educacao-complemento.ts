import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import type { Pool, PoolClient } from 'pg';
import {
  DATASET, EDU_COMPLEMENT_VERSION, SPECS, buildProcurement, buildTerm, publishSlice, sha256,
  type PncpCompra, type PncpTermo, type PublishResult, type Row,
} from '@senadotracker/db';
import { isFirstPublication } from './seguranca.ts';
import { assertPgHeadroom, assertVolume, type StorageConfig } from './storage.ts';

/**
 * Publica as contratações (compras) e os termos (aditivos) dos contratos educacionais a partir do RAW complementar do PNCP (raw/pncp/compras e raw/pncp/termos, coletado por
 * scripts/exec/pncp-complement.ts). A cobertura é explícita: `pending` = contratos educacionais cujo complemento ainda não foi coletado; nada é presumido para eles.
 */
export type Log = (m: string) => void;
export type BatchMap = Map<string, { s: number; b: string }>;
/** Lê todos os lotes de um tipo (compras|termos); respostas 200/404/204 contam como coletadas, a última linha de cada chave vale. */
export async function readBatches(cfg: StorageConfig, kind: 'compras' | 'termos'): Promise<BatchMap> {
  const dir = join(cfg.rawDir, 'pncp', kind); const out: BatchMap = new Map();
  for (const f of (await readdir(dir).catch(() => [] as string[])).filter(x => /^b\d+\.jsonl\.gz$/.test(x)).sort()) {
    for await (const l of createInterface({ input: createReadStream(join(dir, f)).pipe(createGunzip()), crlfDelay: Infinity })) {
      if (!l.trim()) continue; const x = JSON.parse(l) as { k: string; s: number; b: string };
      if (x.s === 200 || x.s === 404 || x.s === 204) out.set(x.k, { s: x.s, b: x.b });
    }
  }
  return out;
}
const digest = (rows: Row[]): string => sha256(JSON.stringify(rows));
const UFS = (): number[] => [0, 11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53];

// ======================================================================= contratações (compras)
export interface CompraRef { uf: number; entity_id: number }
export async function loadCompraRefs(pool: Pool): Promise<Map<string, CompraRef>> {
  const r = await pool.query(`SELECT compra, min(uf)::int uf, min(entity_id)::int entity_id FROM civica_exec.exec_edu_contract WHERE compra IS NOT NULL GROUP BY compra`);
  return new Map(r.rows.map(x => [String(x.compra), { uf: Number(x.uf), entity_id: Number(x.entity_id) }]));
}
const yearOfCompra = (k: string): number => Number(/(\d{4})$/.exec(k)?.[1] ?? 0);
export interface ProcSlice { year: number; uf: number; rows: Row[]; expected: number; fetched: number; rejected: number; noValue: number }
export function buildProcurementSlices(refs: Map<string, CompraRef>, batches: BatchMap): ProcSlice[] {
  const by = new Map<string, ProcSlice>(); const get = (y: number, u: number) => by.get(`${y}:${u}`) ?? by.set(`${y}:${u}`, { year: y, uf: u, rows: [], expected: 0, fetched: 0, rejected: 0, noValue: 0 }).get(`${y}:${u}`)!;
  for (const [k, ref] of refs) {
    const y = yearOfCompra(k); if (y < 2000) continue; const s = get(y, ref.uf); s.expected++;
    const got = batches.get(k); if (!got) continue; s.fetched++;
    if (got.s !== 200) { s.rejected++; continue; }
    let c: PncpCompra; try { c = JSON.parse(got.b) as PncpCompra; } catch { s.rejected++; continue; }
    const row = buildProcurement({ ...c, numeroControlePNCP: c.numeroControlePNCP ?? k }, ref);
    if ('drop' in row) { s.rejected++; continue; }
    if (row.valor_homologado == null && row.valor_estimado == null) s.noValue++;
    s.rows.push(row);
  }
  for (const s of by.values()) s.rows.sort((a, b) => String(a.compra) < String(b.compra) ? -1 : 1);
  return [...by.values()].sort((a, b) => a.year - b.year || a.uf - b.uf);
}
export async function publishProcurementSlice(pool: Pool, s: ProcSlice, o: { first: boolean; failAfterApply?: boolean; tag?: string }): Promise<PublishResult> {
  const cov: Row = { kind: 2, year: s.year, uf: s.uf, rows_in: s.expected, rows_out: s.rows.length, rejected: s.rejected, no_value: s.noValue, pending: s.expected - s.fetched };
  const fp = sha256(`${EDU_COMPLEMENT_VERSION.parse}:${EDU_COMPLEMENT_VERSION.publish}:proc:${s.year}:${s.uf}:${digest(s.rows)}:${s.expected}:${s.fetched}${o.tag ?? ''}`);
  return publishSlice(pool, {
    datasetId: DATASET.edu_procurement, uf: s.uf, competence: s.year * 100 + 12, stage: 2, sourceHash: fp, parserVersion: `${EDU_COMPLEMENT_VERSION.parse}/${EDU_COMPLEMENT_VERSION.publish}`, bootstrap: o.first,
    tables: [{ spec: SPECS.edu_procurement, rows: s.rows }, { spec: SPECS.edu_ctr_cov_procurement, rows: [cov] }], inputs: { year: s.year, uf: s.uf, expected: s.expected, fetched: s.fetched },
    quality: { rowsIn: s.expected, valid: s.rows.length, rejected: s.rejected, pending: s.expected - s.fetched }, ...(o.failAfterApply ? { failAfterApply: true } : {}),
    verify: async (c: PoolClient) => {
      const r = await c.query(`SELECT count(*)::int n, coalesce(sum(valor_homologado), 0)::numeric h FROM civica_exec.exec_edu_procurement WHERE year = $1 AND uf = $2`, [s.year, s.uf]);
      const h = s.rows.reduce((a, x) => a + (x.valor_homologado == null ? 0n : BigInt(String(x.valor_homologado))), 0n);
      if (Number(r.rows[0].n) !== s.rows.length || BigInt(String(r.rows[0].h).split('.')[0]!) !== h) throw new Error(`reconciliação de contratações ${s.year}/${s.uf}: ${r.rows[0].n} linhas / Σ homologado ${r.rows[0].h} ≠ ${s.rows.length} / ${h}`);
    },
  });
}
export async function publishEduProcurement(pool: Pool, cfg: StorageConfig, o: { log?: Log; years?: number[]; ufs?: number[]; failAfterApply?: boolean } = {}): Promise<Array<{ year: number; uf: number; status: string; rows: number; pending: number }>> {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const refs = await loadCompraRefs(pool); const batches = await readBatches(cfg, 'compras'); const out = [];
  for (const s of buildProcurementSlices(refs, batches)) {
    if ((o.years && !o.years.includes(s.year)) || (o.ufs && !o.ufs.includes(s.uf))) continue;
    const first = await isFirstPublication(pool, DATASET.edu_procurement, s.uf, s.year * 100 + 12);
    const r = await publishProcurementSlice(pool, s, { first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    out.push({ year: s.year, uf: s.uf, status: r.status, rows: s.rows.length, pending: s.expected - s.fetched });
    o.log?.(JSON.stringify({ edu_contratacoes: 'slice', year: s.year, uf: s.uf, status: r.status, rows: s.rows.length, pendentes: s.expected - s.fetched, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  return out;
}

// ======================================================================= termos
export interface ContractRef { year: number; uf: number; tipo: number }
export async function loadTermRefs(pool: Pool): Promise<Map<string, ContractRef>> {
  const r = await pool.query(`SELECT pncp_id, year::int AS year, uf::int AS uf, tipo::int AS tipo FROM civica_exec.exec_edu_contract WHERE tipo <> 7`);
  return new Map(r.rows.map(x => [String(x.pncp_id), { year: Number(x.year), uf: Number(x.uf), tipo: Number(x.tipo) }]));
}
export interface TermSlice { year: number; uf: number; rows: Row[]; expected: number; fetched: number; withTerms: number; rejected: number }
export function buildTermSlices(refs: Map<string, ContractRef>, batches: BatchMap): TermSlice[] {
  const by = new Map<string, TermSlice>(); const get = (y: number, u: number) => by.get(`${y}:${u}`) ?? by.set(`${y}:${u}`, { year: y, uf: u, rows: [], expected: 0, fetched: 0, withTerms: 0, rejected: 0 }).get(`${y}:${u}`)!;
  for (const [id, ref] of refs) {
    const s = get(ref.year, ref.uf); s.expected++; const got = batches.get(id); if (!got) continue; s.fetched++;
    if (got.s !== 200) continue;
    let arr: PncpTermo[]; try { const j = JSON.parse(got.b) as unknown; arr = Array.isArray(j) ? j as PncpTermo[] : []; } catch { s.rejected++; continue; }
    if (arr.length) s.withTerms++;
    const seen = new Set<number>();
    for (const t of arr) { const row = buildTerm(id, ref.year, ref.uf, t); if (!row || seen.has(Number(row.seq))) { s.rejected++; continue; } seen.add(Number(row.seq)); s.rows.push(row); }
  }
  for (const s of by.values()) s.rows.sort((a, b) => String(a.pncp_id) < String(b.pncp_id) ? -1 : String(a.pncp_id) > String(b.pncp_id) ? 1 : Number(a.seq) - Number(b.seq));
  return [...by.values()].sort((a, b) => a.year - b.year || a.uf - b.uf);
}
export async function publishTermSlice(pool: Pool, s: TermSlice, o: { first: boolean; failAfterApply?: boolean; tag?: string }): Promise<PublishResult> {
  const cov: Row = { kind: 3, year: s.year, uf: s.uf, rows_in: s.fetched, rows_out: s.rows.length, rejected: s.rejected, no_value: 0, pending: s.expected - s.fetched };
  const fp = sha256(`${EDU_COMPLEMENT_VERSION.parse}:${EDU_COMPLEMENT_VERSION.publish}:term:${s.year}:${s.uf}:${digest(s.rows)}:${s.expected}:${s.fetched}${o.tag ?? ''}`);
  return publishSlice(pool, {
    datasetId: DATASET.edu_term, uf: s.uf, competence: s.year * 100 + 12, stage: 2, sourceHash: fp, parserVersion: `${EDU_COMPLEMENT_VERSION.parse}/${EDU_COMPLEMENT_VERSION.publish}`, bootstrap: o.first,
    tables: [{ spec: SPECS.edu_term, rows: s.rows }, { spec: SPECS.edu_ctr_cov_term, rows: [cov] }], inputs: { year: s.year, uf: s.uf, expected: s.expected, fetched: s.fetched, withTerms: s.withTerms },
    quality: { rowsIn: s.fetched, valid: s.rows.length, rejected: s.rejected, pending: s.expected - s.fetched }, ...(o.failAfterApply ? { failAfterApply: true } : {}),
    verify: async (c: PoolClient) => {
      const r = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_term WHERE year = $1 AND uf = $2`, [s.year, s.uf]);
      if (Number(r.rows[0].n) !== s.rows.length) throw new Error(`reconciliação de termos ${s.year}/${s.uf}: ${r.rows[0].n} linhas ≠ ${s.rows.length}`);
    },
  });
}
export async function publishEduTerms(pool: Pool, cfg: StorageConfig, o: { log?: Log; years?: number[]; ufs?: number[]; failAfterApply?: boolean } = {}): Promise<Array<{ year: number; uf: number; status: string; rows: number; pending: number }>> {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const refs = await loadTermRefs(pool); const batches = await readBatches(cfg, 'termos'); const out = [];
  for (const s of buildTermSlices(refs, batches)) {
    if ((o.years && !o.years.includes(s.year)) || (o.ufs && !o.ufs.includes(s.uf))) continue;
    const first = await isFirstPublication(pool, DATASET.edu_term, s.uf, s.year * 100 + 12);
    const r = await publishTermSlice(pool, s, { first, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    out.push({ year: s.year, uf: s.uf, status: r.status, rows: s.rows.length, pending: s.expected - s.fetched });
    o.log?.(JSON.stringify({ edu_termos: 'slice', year: s.year, uf: s.uf, status: r.status, rows: s.rows.length, pendentes: s.expected - s.fetched, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  return out;
}
void UFS;
