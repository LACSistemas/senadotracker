import type { Pool, PoolClient } from 'pg';
import {
  DATASET, EDU_CONTRACT_VERSION, SPECS, buildEduContract, publishSlice, sha256,
  type ContractCtx, type EduPncpContract, type PublishResult, type Row,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { loadContractCtx } from './contratos.ts';
import { pncpBundleRel, readPncpBundle } from './pncp.ts';
import { ALL_UFS, isFirstPublication } from './seguranca.ts';
import { assertPgHeadroom, assertVolume, readManifest, type StorageConfig } from './storage.ts';

/**
 * Contratos educacionais do PNCP (P10.7): lê os pacotes mensais JÁ preservados em raw/pncp/contratos (5,1 milhões de contratos; nenhum download), classifica com
 * EDU_CONTRACT_VERSION e publica por UF × ano (dataset 114). Retificação: a última linha de cada contrato prevalece. Contrato sem órgão ou sem ente identificado é rejeitado e contado.
 */
export type Log = (m: string) => void;
const UF_BY_CODE = new Map(Object.entries(UF_CODE).map(([k, v]) => [v, k]));
export interface EduSlice { rows: Row[]; classes: Row[]; in: number; rejected: number; noValue: number }
export interface EduYear { year: number; months: number[]; monthHashes: string[]; byUf: Map<number, EduSlice>; suppliers: Map<number, string>; stats: Record<string, number> }

export async function loadEduYear(cfg: StorageConfig, ctx: ContractCtx, year: number): Promise<EduYear> {
  const man = await readManifest(cfg); const months: number[] = [], hashes: string[] = [];
  const byId = new Map<string, { row: Row; classes: Row[] }>(); const suppliers = new Map<number, string>(); const inByUf = new Map<number, number>(); const rejByUf = new Map<number, number>();
  const stats: Record<string, number> = { contracts: 0, educacionais: 0, nao_educacao: 0, ensino_superior: 0, sem_cnpj_orgao: 0, sem_ente: 0, pf_omitida: 0 };
  for (let m = 1; m <= 12; m++) {
    const rel = pncpBundleRel(year, m); const e = man.get(rel); if (!e) continue; months.push(m); hashes.push(e.sha256);
    for await (const page of readPncpBundle(cfg, rel)) {
      if (page.s !== 200) continue;
      for (const c of (JSON.parse(page.b) as { data?: EduPncpContract[] }).data ?? []) {
        stats.contracts!++; const ufc = c.unidadeOrgao?.ufSigla ? ctx.ufCode(c.unidadeOrgao.ufSigla.toUpperCase()) ?? 0 : 0; inByUf.set(ufc, (inByUf.get(ufc) ?? 0) + 1);
        const r = buildEduContract(c, year, ctx);
        if ('drop' in r) { if (r.drop === 'nao_educacao') stats.nao_educacao!++; else if (r.drop === 'ensino_superior') stats.ensino_superior!++; else { stats[r.drop] = (stats[r.drop] ?? 0) + 1; rejByUf.set(ufc, (rejByUf.get(ufc) ?? 0) + 1); } continue; }
        byId.set(String(r.row.pncp_id), { row: r.row, classes: r.classes });   // retificação: a última linha do mês prevalece
        if (r.supplier) suppliers.set(r.supplier.cnpj, r.supplier.name); else if (c.tipoPessoa && c.tipoPessoa.toUpperCase() !== 'PJ') stats.pf_omitida!++;
      }
    }
  }
  const byUf = new Map<number, EduSlice>(); const slice = (u: number) => byUf.get(u) ?? byUf.set(u, { rows: [], classes: [], in: inByUf.get(u) ?? 0, rejected: rejByUf.get(u) ?? 0, noValue: 0 }).get(u)!;
  for (const u of inByUf.keys()) slice(u);
  for (const { row, classes } of byId.values()) { const s = slice(Number(row.uf)); s.rows.push(row); s.classes.push(...classes); if (row.valor_global == null) s.noValue++; }
  stats.educacionais = byId.size;
  return { year, months, monthHashes: hashes, byUf, suppliers, stats };
}

export interface EduContractSliceArgs { year: number; uf: number; slice: EduSlice; suppliers: Array<{ cnpj: number; name: string }>; fingerprint: string; first: boolean; current: boolean; inputs: unknown; quality: Record<string, unknown>; failAfterApply?: boolean }
const sortRows = (rows: Row[], key: string): Row[] => [...rows].sort((a, b) => String(a[key]) < String(b[key]) ? -1 : 1);
/** Publica UMA fatia UF × ano de contratos educacionais (fornecedores + contratos + classes + cobertura na mesma transação, com verificação de linhas e Σ valor). */
export async function publishEduContractSlice(pool: Pool, a: EduContractSliceArgs): Promise<PublishResult> {
  const { year, uf, slice } = a; const cov: Row = { kind: 1, year, uf, rows_in: slice.in, rows_out: slice.rows.length, rejected: slice.rejected, no_value: slice.noValue, pending: 0 };
  return publishSlice(pool, {
    datasetId: DATASET.edu_contract, uf, competence: year * 100 + 12, stage: a.current ? 1 : 2, sourceHash: a.fingerprint, parserVersion: `${EDU_CONTRACT_VERSION.classify}/${EDU_CONTRACT_VERSION.publish}`, bootstrap: a.first,
    tables: [{ spec: SPECS.fin_supplier, rows: a.suppliers }, { spec: SPECS.edu_contract, rows: sortRows(slice.rows, 'pncp_id') }, { spec: SPECS.edu_contract_class, rows: [...slice.classes].sort((x, y) => String(x.pncp_id) < String(y.pncp_id) ? -1 : String(x.pncp_id) > String(y.pncp_id) ? 1 : Number(x.category) - Number(y.category)) }, { spec: SPECS.edu_ctr_cov_contract, rows: [cov] }],
    inputs: a.inputs, quality: a.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    verify: async c => verifyEduContracts(c, year, uf, slice),
  });
}
async function verifyEduContracts(c: PoolClient, year: number, uf: number, slice: EduSlice): Promise<void> {
  const r = await c.query(`SELECT count(*)::int n, coalesce(sum(valor_global), 0)::numeric s FROM civica_exec.exec_edu_contract WHERE year = $1 AND uf = $2`, [year, uf]);
  const sum = slice.rows.reduce((s, x) => s + (x.valor_global == null ? 0n : BigInt(String(x.valor_global))), 0n);
  if (Number(r.rows[0].n) !== slice.rows.length || BigInt(String(r.rows[0].s).split('.')[0]!) !== sum) throw new Error(`reconciliação de contratos educacionais ${year}/${uf}: ${r.rows[0].n} linhas / Σ ${r.rows[0].s} ≠ ${slice.rows.length} / ${sum}`);
  const k = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_class WHERE year = $1 AND uf = $2`, [year, uf]);
  if (Number(k.rows[0].n) !== slice.classes.length) throw new Error(`classificações ${year}/${uf}: ${k.rows[0].n} no banco, ${slice.classes.length} na fatia`);
  const drift = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_class k JOIN civica_exec.exec_edu_contract x ON x.pncp_id = k.pncp_id WHERE k.year = $1 AND k.uf = $2 AND (k.valor IS DISTINCT FROM x.valor_global OR k.entity_id <> x.entity_id OR k.esfera <> x.esfera OR k.outlier <> x.outlier)`, [year, uf]);
  if (Number(drift.rows[0].n)) throw new Error(`classe com valor/ente diferente do contrato (${year}/${uf}): ${drift.rows[0].n}`);
  const orphan = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_class k WHERE k.year = $1 AND k.uf = $2 AND NOT EXISTS (SELECT 1 FROM civica_exec.exec_edu_contract x WHERE x.pncp_id = k.pncp_id)`, [year, uf]);
  if (Number(orphan.rows[0].n)) throw new Error(`classificação sem contrato (${year}/${uf})`);
}

export interface EduYearResult { year: number; status: 'NO_RAW' | 'INCOMPLETE_RAW' | 'DONE'; slices: number; educacionais: number; results?: Array<{ uf: number; status: string; rows: number }>; stats?: Record<string, number> }
export async function publishEduContractYear(pool: Pool, cfg: StorageConfig, year: number, o: { log?: Log; failAfterApply?: boolean; allowPartial?: boolean; ufs?: number[] } = {}): Promise<EduYearResult> {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const ctx = await loadContractCtx(pool); const y = await loadEduYear(cfg, ctx, year); const now = new Date(); const current = year >= now.getUTCFullYear();
  if (!y.months.length) return { year, status: 'NO_RAW', slices: 0, educacionais: 0 };
  if (!current && y.months.length < 12 && !o.allowPartial) return { year, status: 'INCOMPLETE_RAW', slices: 0, educacionais: 0 };
  const results: Array<{ uf: number; status: string; rows: number }> = [];
  for (const uf of [0, ...ALL_UFS.map(u => UF_CODE[u]!)]) {
    if (o.ufs && !o.ufs.includes(uf)) continue;
    const slice = y.byUf.get(uf); const first = await isFirstPublication(pool, DATASET.edu_contract, uf, year * 100 + 12);
    if (!slice || (!slice.rows.length && first)) continue;   // UF sem contrato educacional e nunca publicada: nada a registrar
    const sup = [...new Set(slice.rows.map(r => r.supplier).filter(x => x != null))].map(c => ({ cnpj: Number(c), name: y.suppliers.get(Number(c)) ?? '' })).sort((p, q) => p.cnpj - q.cnpj);
    const fp = sha256(`${y.monthHashes.join(',')}:${EDU_CONTRACT_VERSION.classify}:${EDU_CONTRACT_VERSION.publish}:${uf}`);
    const r = await publishEduContractSlice(pool, { year, uf, slice, suppliers: sup, fingerprint: fp, first, current, inputs: { year, months: y.months, uf }, quality: { ...y.stats, uf, rows: slice.rows.length, monthsPresent: y.months.length, ...(o.failAfterApply ? { injectedFailure: true } : {}) }, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    results.push({ uf, status: r.status, rows: slice.rows.length }); o.log?.(JSON.stringify({ edu_contratos: 'uf', year, uf: uf === 0 ? '--' : UF_BY_CODE.get(uf), status: r.status, rows: slice.rows.length, ...(r.status === 'FAILED_SAFE' ? { reason: r.reason } : {}) }));
  }
  return { year, status: 'DONE', slices: results.length, educacionais: y.stats.educacionais!, results, stats: y.stats };
}
