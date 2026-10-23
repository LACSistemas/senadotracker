import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import {
  DATASET, FIN_PNCP_IDS, FIN_TRANSFER_IDS, FIN_VERSION, PNCP_VERSION, SPECS, buildContract, contractIndicators, publishSlice, replaceIndicatorsBulk, sha256, transferIndicators,
  type ContractCtx, type IndicatorRow, type PncpContract, type Row, type TransferRow,
} from '@senadotracker/db';
import { UF_CODE } from './cnes.ts';
import { ALL_UFS, isFirstPublication } from './seguranca.ts';
import { PNCP_FIRST_YEAR, pncpBundleRel, readPncpBundle } from './pncp.ts';
import { assertPgHeadroom, assertVolume, assertCanDecode, fetchRaw, readManifest, recordManifest, runPython, type StorageConfig } from './storage.ts';

export type Log = (m: string) => void;
const UF_BY_CODE = new Map(Object.entries(UF_CODE).map(([k, v]) => [v, k]));

export async function loadContractCtx(pool: Pool): Promise<ContractCtx> {
  const r = await pool.query(`SELECT entity_id, kind, ibge7, uf_code FROM civica_exec.exec_entity WHERE kind IN (1, 3, 4)`);
  const entityByIbge7 = new Map<number, number>(), entityByUf = new Map<number, number>(); let br = 0;
  for (const x of r.rows) { const k = Number(x.kind); if (k === 4) entityByIbge7.set(Number(x.ibge7), Number(x.entity_id)); else if (k === 3) entityByUf.set(Number(x.uf_code), Number(x.entity_id)); else br = Number(x.entity_id); }
  return { ufCode: a => UF_CODE[a], entityByIbge7, entityByUf, brEntity: br };
}

export interface PncpYear { year: number; months: number[]; monthHashes: string[]; byUf: Map<number, Row[]>; suppliers: Map<number, string>; stats: Record<string, number> }
/** Lê os pacotes mensais já coletados de um ano e classifica; só os contratos de segurança (institucional ou temático) são retidos. */
export async function loadPncpYear(cfg: StorageConfig, ctx: ContractCtx, year: number): Promise<PncpYear> {
  const man = await readManifest(cfg); const months: number[] = [], hashes: string[] = []; const byId = new Map<string, Row>(); const suppliers = new Map<number, string>();
  const stats: Record<string, number> = { contracts: 0, kept: 0, institucional: 0, tematico: 0, ambos: 0, nao_seguranca: 0, sem_cnpj_orgao: 0, sem_ente: 0, pf_omitida: 0, sem_data_publicacao_no_ano: 0 };
  for (let m = 1; m <= 12; m++) {
    const rel = pncpBundleRel(year, m); const e = man.get(rel); if (!e) continue; months.push(m); hashes.push(e.sha256);
    for await (const page of readPncpBundle(cfg, rel)) {
      if (page.s !== 200) continue;
      for (const c of (JSON.parse(page.b) as { data?: PncpContract[] }).data ?? []) {
        stats.contracts!++; const pub = c.dataPublicacaoPncp?.slice(0, 4); if (pub && Number(pub) !== year) stats.sem_data_publicacao_no_ano!++;
        const r = buildContract(c, year, ctx);
        if ('drop' in r) { stats[r.drop] = (stats[r.drop] ?? 0) + 1; continue; }
        stats.kept!++; const link = Number(r.row.link); if (link === 1) stats.institucional!++; else if (link === 2) stats.tematico!++; else stats.ambos!++;
        if (r.supplier) suppliers.set(r.supplier.cnpj, r.supplier.name); else if (c.tipoPessoa && c.tipoPessoa.toUpperCase() !== 'PJ') stats.pf_omitida!++;
        byId.set(String(r.row.pncp_id), r.row);   // retificação: a última linha do mês prevalece
      }
    }
  }
  const byUf = new Map<number, Row[]>(); for (const r of byId.values()) { const u = Number(r.uf); (byUf.get(u) ?? byUf.set(u, []).get(u)!).push(r); }
  return { year, months, monthHashes: hashes, byUf, suppliers, stats };
}

export async function publishPncpYear(pool: Pool, cfg: StorageConfig, year: number, o: { log?: Log; failAfterApply?: boolean; allowPartial?: boolean } = {}) {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const ctx = await loadContractCtx(pool); const y = await loadPncpYear(cfg, ctx, year); const now = new Date(); const current = year >= now.getUTCFullYear();
  if (!y.months.length) return { year, status: 'NO_RAW' as const, slices: 0, kept: 0 };
  if (!current && y.months.length < 12 && !o.allowPartial) return { year, status: 'INCOMPLETE_RAW' as const, slices: 0, kept: 0 };
  const results: Array<{ uf: number; status: string; rows: number }> = [];
  for (const uf of [0, ...ALL_UFS.map(u => UF_CODE[u]!)]) {
    const rows = y.byUf.get(uf) ?? []; const first = await isFirstPublication(pool, DATASET.fin_pncp, uf, year * 100 + 12);
    // A fatia nacional (uf = 0) também carrega os indicadores do ente Brasil (órgãos federais de qualquer UF); as fatias de UF nunca escrevem a entidade Brasil.
    const brRows = [...y.byUf.values()].flat().filter(r => Number(r.entity_id) === ctx.brEntity);
    if (!rows.length && first && !(uf === 0 && brRows.length)) continue;   // UF sem contrato classificado e nunca publicada: nada a registrar
    const sup = [...new Set(rows.map(r => r.supplier).filter(x => x != null))].map(c => ({ cnpj: Number(c), name: y.suppliers.get(Number(c)) ?? '' }));
    const fp = sha256(`${y.monthHashes.join(',')}:${PNCP_VERSION.classify}:${PNCP_VERSION.publish}:${uf}`); const inds = uf === 0 ? contractIndicators(brRows, year, current) : contractIndicators(rows.filter(r => Number(r.entity_id) !== ctx.brEntity), year, current);
    const r = await publishContractSlice(pool, { year, uf, rows, suppliers: sup, indicators: inds, fingerprint: fp, first, current, inputs: { year, months: y.months, uf }, quality: { ...y.stats, uf, rows: rows.length, monthsPresent: y.months.length, preliminary: current }, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    results.push({ uf, status: r.status, rows: rows.length }); o.log?.(JSON.stringify({ contratos: 'uf', year, uf: uf === 0 ? '--' : UF_BY_CODE.get(uf), status: r.status, rows: rows.length }));
  }
  return { year, status: 'DONE' as const, slices: results.length, kept: y.stats.kept!, results, stats: y.stats };
}
export interface ContractSliceArgs { year: number; uf: number; rows: Row[]; suppliers: Array<{ cnpj: number; name: string }>; indicators: IndicatorRow[]; fingerprint: string; first: boolean; current: boolean; inputs: unknown; quality: Record<string, unknown>; failAfterApply?: boolean }
/** Publica UMA fatia UF × ano de contratos classificados (fornecedores + contratos + indicadores na mesma transação, com verificação de linhas e Σ valor). */
export async function publishContractSlice(pool: Pool, a: ContractSliceArgs) {
  const { year, uf } = a;
  return publishSlice(pool, { datasetId: DATASET.fin_pncp, uf, competence: year * 100 + 12, stage: a.current ? 1 : 2, sourceHash: a.fingerprint, parserVersion: PNCP_VERSION.publish, bootstrap: a.first,
    tables: [{ spec: SPECS.fin_supplier, rows: a.suppliers }, { spec: SPECS.fin_contract, rows: a.rows }], inputs: a.inputs, quality: a.quality, ...(a.failAfterApply ? { failAfterApply: true } : {}),
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: FIN_PNCP_IDS, ufCode: uf, from: `${year}-01-01`, to: `${year + 1}-01-01`, ...(uf === 0 ? { nationalOnly: true } : {}) }, a.indicators, !a.first); },
    verify: async c => verifyContracts(c, year, uf, a.rows) });
}
async function verifyContracts(c: PoolClient, year: number, uf: number, rows: Row[]): Promise<void> {
  const r = await c.query(`SELECT count(*)::int n, coalesce(sum(valor_global), 0)::numeric s FROM civica_exec.exec_fin_contract WHERE year = $1 AND uf = $2`, [year, uf]);
  const sum = rows.reduce((s, x) => s + BigInt(String(x.valor_global)), 0n);
  if (Number(r.rows[0].n) !== rows.length || BigInt(String(r.rows[0].s).split('.')[0]!) !== sum) throw new Error(`reconciliação de contratos ${year}/${uf}: ${r.rows[0].n} linhas / Σ ${r.rows[0].s} ≠ ${rows.length} / ${sum}`);
  const bad = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_fin_contract WHERE year = $1 AND uf = $2 AND org_kind = 0 AND theme = 0`, [year, uf]);
  if (Number(bad.rows[0].n)) throw new Error(`contrato sem classificação persistido (${year}/${uf})`);
}

// ------------------------------------------------------------------ Transferências (Plataforma +Brasil / Transferegov)
const SICONV = 'https://repositorio.dados.gov.br/seges/detru';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const TRANSFER_BENEF: Array<[RegExp, number]> = [[/ESTADUAL OU DO DISTRITO FEDERAL/, 1], [/MUNICIPAL/, 2], [/CONSORCIO/, 3], [/SOCIEDADE CIVIL/, 4], [/EMPRESA PUBLICA|ECONOMIA MISTA/, 5]];
export const TRANSFER_INSTRUMENT: Array<[RegExp, number]> = [[/^CONVENIO OU CONTRATO DE REPASSE|^CONVENIO/, 1], [/CONTRATO DE REPASSE/, 2], [/TERMO DE (FOMENTO|PARCERIA|COLABORACAO)/, 3]];
export const TRANSFER_STATUS: Array<[RegExp, number]> = [[/REJEITAD|ELIMINADA/, 1], [/APROVAD/, 2], [/CADASTRAD|EM COMPLEMENTACAO|COMPLEMENTADO/, 3], [/ANALISE/, 4]];
export const CONV_STATUS: Array<[RegExp, number]> = [[/EM EXECUCAO/, 1], [/PRESTACAO DE CONTAS (CONCLUIDA|APROVADA)/, 2], [/PRESTACAO DE CONTAS (EM|ENVIADA|COMPROVADA|EM COMPLEMENTACAO)/, 3], [/REJEITADA|INADIMPLENTE/, 4], [/ANULADO|CANCELADO|RESCINDIDO/, 5], [/AGUARDANDO/, 6]];
const code = (tbl: Array<[RegExp, number]>, text: string | null, dflt: number): number => text == null ? 0 : (tbl.find(([re]) => re.test(text))?.[1] ?? dflt);

export interface SiconvExtract { proposals_in_file: number; kept: number; convenios: number; rows: Array<Record<string, unknown>> }
export async function fetchSiconv(pool: Pool, cfg: StorageConfig, log?: Log) {
  const out: Record<string, { relPath: string; sha256: string }> = {};
  for (const f of ['siconv_proposta', 'siconv_convenio']) {
    const e = await fetchRaw(cfg, { url: `${SICONV}/${f}.csv.zip`, relPath: `transferegov/${f}.csv.zip`, competence: null, uf: 0, retention: 1, dataset: f, dedupeByHash: false, userAgent: UA, accept: h => h.subarray(0, 2).toString('latin1') === 'PK' });
    await recordManifest(pool, e); out[f] = { relPath: e.relPath, sha256: e.sha256 }; log?.(JSON.stringify({ transferegov: 'raw', f, bytes: e.bytes, sha256: e.sha256 }));
  }
  return out;
}
/** Mapa CNPJ → entidade (EXATO) a partir do cadastro de entes do Siconfi já preservado no RAW. */
export async function cnpjToEntity(pool: Pool, cfg: StorageConfig): Promise<Map<string, number>> {
  const j = JSON.parse(await readFile(join(cfg.rawDir, 'siconfi/entes/entes.json'), 'utf8')) as { items: Array<{ cod_ibge: number; cnpj: string | null; esfera: string }> };
  const ids = await pool.query(`SELECT entity_id, kind, ibge7 FROM civica_exec.exec_entity WHERE kind IN (3, 4)`); const by = new Map(ids.rows.map(x => [`${x.kind}:${x.ibge7}`, Number(x.entity_id)]));
  const m = new Map<string, number>(); for (const e of j.items) { if (!e.cnpj || e.esfera === 'U') continue; const id = by.get(`${e.esfera === 'M' ? 4 : 3}:${e.cod_ibge}`); if (id !== undefined) m.set(e.cnpj, id); }
  return m;
}
export async function publishTransfers(pool: Pool, cfg: StorageConfig, files: Record<string, { relPath: string; sha256: string }>, o: { log?: Log; failAfterApply?: boolean } = {}) {
  await assertVolume(cfg); await assertPgHeadroom(cfg); await mkdir(cfg.stagingDir, { recursive: true });
  const cache = join(cfg.stagingDir, `siconv_${files.siconv_proposta!.sha256.slice(0, 10)}_${files.siconv_convenio!.sha256.slice(0, 10)}_${FIN_VERSION.fed}.json`);
  let x: SiconvExtract; try { x = JSON.parse(await readFile(cache, 'utf8')) as SiconvExtract; } catch {
    await assertCanDecode(cfg, 250 * 1024 * 1024);
    const r = await runPython('scripts/exec/siconv_extract.py', [join(cfg.rawDir, files.siconv_proposta!.relPath), join(cfg.rawDir, files.siconv_convenio!.relPath), cache]); if (r.code !== 0) throw new Error(`extração siconv falhou: ${(r.err || r.out).slice(0, 400)}`);
    x = JSON.parse(await readFile(cache, 'utf8')) as SiconvExtract;
  }
  const ent = await cnpjToEntity(pool, cfg); const now = new Date().getUTCFullYear(); const byUfYear = new Map<string, Row[]>(); const stats = { rows: 0, entityMatched: 0, ofEnteWithoutMatch: 0 };
  for (const r of x.rows) {
    const uf = UF_CODE[String(r.uf)] ?? 0; const year = Number(r.year); const nat = String(r.natureza); const kind = code(TRANSFER_BENEF, nat, 9); const entity = (kind === 1 || kind === 2) ? ent.get(String(r.cnpj)) ?? null : null;
    stats.rows++; if (entity != null) stats.entityMatched++; else if (kind === 1 || kind === 2) stats.ofEnteWithoutMatch++;
    const row: Row = { proposal_id: r.proposal_id, year, uf, entity_id: entity, benef_kind: kind, concedente: r.concedente, instrument: code(TRANSFER_INSTRUMENT, String(r.modalidade), 9), prop_status: code(TRANSFER_STATUS, String(r.prop_status), 9), conv_status: r.conv_status == null ? 0 : code(CONV_STATUS, String(r.conv_status), 9),
      v_global_prop: r.v_global_prop, v_repasse_prop: r.v_repasse_prop, v_global_conv: r.v_global_conv, v_repasse_conv: r.v_repasse_conv, v_empenhado_conv: r.v_empenhado_conv, v_desembolsado_conv: r.v_desembolsado_conv, signed: r.signed };
    const k = `${uf}:${year}`; (byUfYear.get(k) ?? byUfYear.set(k, []).get(k)!).push(row);
  }
  const results: Array<{ uf: number; year: number; status: string; rows: number }> = [];
  const existing = await pool.query(`SELECT uf, competence FROM civica_exec.exec_publication WHERE dataset_id = $1`, [DATASET.fin_transfer]);
  const keys = new Set<string>([...byUfYear.keys(), ...existing.rows.map(r => `${r.uf}:${Math.floor(Number(r.competence) / 100)}`)]);
  for (const k of [...keys].sort()) {
    const [ufS, yS] = k.split(':'); const uf = Number(ufS), year = Number(yS); const rows = byUfYear.get(k) ?? []; const first = await isFirstPublication(pool, DATASET.fin_transfer, uf, year * 100 + 12);
    const inds = transferIndicators(rows as unknown as TransferRow[], year, year >= now); const fp = sha256(`${files.siconv_proposta!.sha256}:${files.siconv_convenio!.sha256}:${FIN_VERSION.publish}:${uf}:${year}`);
    const r = await publishSlice(pool, { datasetId: DATASET.fin_transfer, uf, competence: year * 100 + 12, stage: 2, sourceHash: fp, parserVersion: FIN_VERSION.publish, bootstrap: first, tables: [{ spec: SPECS.fin_transfer, rows }],
      inputs: { uf, year, proposta: files.siconv_proposta, convenio: files.siconv_convenio }, quality: { ...stats, sliceRows: rows.length },
      ...(o.failAfterApply ? { failAfterApply: true } : {}),
      ...(uf === 0 ? {} : { derive: async (c: PoolClient, runId: number) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: FIN_TRANSFER_IDS, ufCode: uf, from: `${year}-01-01`, to: `${year + 1}-01-01` }, inds, !first); } }),
      verify: async c => { const q = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_fin_transfer WHERE uf = $1 AND year = $2`, [uf, year]); if (Number(q.rows[0].n) !== rows.length) throw new Error(`transferências ${uf}/${year}: ${q.rows[0].n} ≠ ${rows.length}`); } });
    results.push({ uf, year, status: r.status, rows: rows.length }); o.log?.(JSON.stringify({ transfers: 'slice', uf, year, status: r.status, rows: rows.length }));
  }
  return { results, stats };
}
void PNCP_FIRST_YEAR;
