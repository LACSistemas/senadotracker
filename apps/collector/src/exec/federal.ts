import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { DATASET, FIN_VERSION, SPECS, publishSlice, sha256, type Row } from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, assertVolume, assertZipIntact, fetchRaw, recordManifest, runPython, type ManifestEntry, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';
import { UF_CODE } from './cnes.ts';

export type Log = (m: string) => void;
const BASE = 'https://portaldatransparencia.gov.br/download-de-dados';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const isZip = (head: Buffer) => head.subarray(0, 2).toString('latin1') === 'PK';
export const FED_FIRST_YEAR = 2014;

export interface FedFile { kind: 'exec' | 'dot'; year: number; month: number; entry: ManifestEntry }
/** Execução mensal (despesas-execucao/AAAAMM) e orçamento anual (orcamento-despesa/AAAA) do Portal da Transparência: CSV agregado por unidade (sem credor). */
export async function fetchFed(pool: Pool, cfg: StorageConfig, kind: 'exec' | 'dot', year: number, month: number, log?: Log): Promise<FedFile> {
  await assertVolume(cfg);
  const key = kind === 'exec' ? `${year}${String(month).padStart(2, '0')}` : String(year);
  const attempt = async (): Promise<ManifestEntry> => fetchRaw(cfg, { url: `${BASE}/${kind === 'exec' ? 'despesas-execucao' : 'orcamento-despesa'}/${key}`, relPath: `federal/${kind === 'exec' ? 'despesas-execucao' : 'orcamento-despesa'}/${key}.zip`, competence: kind === 'exec' ? year * 100 + month : year * 100 + 12, uf: 0, retention: 1,
    dataset: kind === 'exec' ? 'portal_despesas_execucao' : 'portal_orcamento_despesa', dedupeByHash: false, userAgent: UA, accept: isZip });
  // O WAF do Portal devolve 405/403/429 quando a taxa passa do tolerado: espera longa e nova tentativa (retomável), sem desistir na primeira recusa.
  let entry: ManifestEntry | undefined;
  for (let n = 1; n <= 8 && !entry; n++) {
    try { entry = await attempt(); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/(405|403|429|502|503|504)|\(22\)|conteúdo inesperado/.test(msg) || n === 8) throw e;
      log?.(JSON.stringify({ federal: 'wait', key, attempt: n, minutes: 5 * n, reason: msg.slice(0, 120) })); await new Promise(r => setTimeout(r, 5 * n * 60_000));
    }
  }
  if (!entry) throw new Error(`download federal ${key} esgotou as tentativas`);
  await assertZipIntact(cfg, entry.relPath);
  await recordManifest(pool, entry); log?.(JSON.stringify({ federal: 'raw', kind, key, bytes: entry.bytes, sha256: entry.sha256, reused: (entry as ManifestEntry & { reused?: boolean }).reused ?? false }));
  return { kind, year, month, entry };
}
export interface FedExtract { mode: 'exec' | 'dot'; periods: string[]; rows_in: number; rows_kept: number; rows: Array<Array<string | number>>; orgs: { sup: Record<string, string>; sub: Record<string, [string, string]>; uo: Record<string, [string, string]> }; ctrl: Array<Array<string | number>> }
export async function extractFed(cfg: StorageConfig, f: FedFile): Promise<FedExtract> {
  await mkdir(cfg.stagingDir, { recursive: true });
  const cache = join(cfg.stagingDir, `fed_${f.kind}_${f.year}${f.kind === 'exec' ? String(f.month).padStart(2, '0') : ''}_${f.entry.sha256.slice(0, 12)}_${FIN_VERSION.fed}.json`);
  try { return JSON.parse(await readFile(cache, 'utf8')) as FedExtract; } catch { /* sem cache */ }
  await assertCanDecode(cfg, f.entry.bytes);
  const r = await runPython('scripts/exec/fed_extract.py', [f.kind, join(cfg.rawDir, f.entry.relPath), cache]);
  if (r.code !== 0) throw new Error(`extração federal ${f.kind} ${f.year}/${f.month} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return JSON.parse(await readFile(cache, 'utf8')) as FedExtract;
}

export const orgId = (level: 1 | 2 | 3, code: string): number => level * 1_000_000 + Number(code);
/** Identidade institucional federal a partir de TODOS os extratos (nome por exercício; o pai é o último visto). */
export function buildOrgs(brEntity: number, extracts: Array<{ year: number; x: FedExtract }>): Row[] {
  const m = new Map<number, { level: 1 | 2 | 3; code: string; parent: number | null; names: Record<string, string>; first: number; last: number }>();
  const add = (level: 1 | 2 | 3, code: string, name: string, parentId: number | null, year: number) => {
    const id = orgId(level, code); const o = m.get(id) ?? { level, code, parent: parentId, names: {}, first: year, last: year };
    o.names[String(year)] = name; o.first = Math.min(o.first, year); if (year >= o.last) { o.last = year; o.parent = parentId ?? o.parent; } m.set(id, o);
  };
  for (const { year, x } of extracts.sort((a, b) => a.year - b.year)) {
    for (const [c, n] of Object.entries(x.orgs.sup)) add(1, c, n, null, year);
    for (const [c, [n, p]] of Object.entries(x.orgs.sub)) add(2, c, n, orgId(1, p), year);
    for (const [c, [n, p]] of Object.entries(x.orgs.uo)) add(3, c, n, orgId(2, p), year);
  }
  return [...m.entries()].map(([id, o]) => ({ org_id: id, entity_id: brEntity, level: o.level, code: o.code, parent_id: o.parent, name: o.names[String(o.last)]!, first_year: o.first, last_year: o.last, names: o.names }));
}
const iv = (v: string | number) => typeof v === 'number' ? v : Number(v);
/** Linhas mensais: [ym, uo, fn, sf, programa, acao, cat, grupo, modalidade, uf, emp, liq, pago, rp_insc, rp_canc, rp_pago]. */
export function execRows(brEntity: number, year: number, x: FedExtract): Row[] {
  return x.rows.map(r => { const [ym, uo, fn, sf, pr, ac, cat, gr, mod, uf, emp, liq, pago, rpi, rpc, rpp] = r as [string, string, string, string, number, string, number, number, number, string, number, number, number, number, number, number];
    return { entity_id: brEntity, exercicio: year, mes: Number(ym.slice(5, 7)), org_id: orgId(3, uo), funcao: iv(fn), subfuncao: iv(sf), programa: pr, acao: ac, categoria: cat, grupo: gr, modalidade: mod, uf_loc: UF_CODE[uf] ?? 0, emp, liq, pago, rp_insc: rpi, rp_canc: rpc, rp_pago: rpp }; });
}
export function dotRows(brEntity: number, year: number, x: FedExtract): Row[] {
  return x.rows.map(r => { const [, uo, fn, sf, pr, ac, cat, gr, di, da, oe, orr] = r as [string, string, string, string, number, string, number, number, number, number, number, number];
    return { entity_id: brEntity, exercicio: year, org_id: orgId(3, uo), funcao: iv(fn), subfuncao: iv(sf), programa: pr, acao: ac, categoria: cat, grupo: gr, dot_ini: di, dot_atu: da, orc_emp: oe, orc_real: orr }; });
}

/** Execução federal de um exercício: 12 (ou menos, no exercício corrente) arquivos mensais → UMA fatia nacional × exercício. Órgãos (upsert) na mesma transação. */
export async function publishFedExec(pool: Pool, cfg: StorageConfig, year: number, files: FedFile[], o: { log?: Log; failAfterApply?: boolean; orgs: Row[] }) {
  await assertPgHeadroom(cfg);
  const br = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0].entity_id as number;
  const rows: Row[] = []; const months: number[] = []; let sup = 0, kept = 0, inRows = 0;
  for (const f of files.sort((a, b) => a.month - b.month)) { const x = await extractFed(cfg, f); rows.push(...execRows(br, year, x)); months.push(f.month); kept += x.rows_kept; inRows += x.rows_in; sup += 1; }
  const first = await isFirstPublication(pool, DATASET.fin_fed_exec, 0, year * 100 + 12);
  const fp = sha256(`${files.map(f => f.entry.sha256).join(',')}:${FIN_VERSION.publish}:${FIN_VERSION.fed}`);
  const r = await publishSlice(pool, { datasetId: DATASET.fin_fed_exec, uf: 0, competence: year * 100 + 12, stage: 2, sourceHash: fp, parserVersion: FIN_VERSION.publish, bootstrap: first,
    tables: [{ spec: SPECS.fin_org, rows: o.orgs }, { spec: SPECS.fin_exec, rows }], inputs: { year, months, files: files.map(f => ({ rel: f.entry.relPath, sha256: f.entry.sha256 })) }, quality: { year, months: months.length, rowsIn: inRows, rowsKept: kept, rowsOut: rows.length, files: sup },
    ...(o.failAfterApply ? { failAfterApply: true } : {}) });
  o.log?.(JSON.stringify({ federal: 'exec', year, months: months.length, status: r.status, rows: rows.length }));
  return { status: r.status, rows: rows.length, months };
}
export async function publishFedDot(pool: Pool, cfg: StorageConfig, year: number, file: FedFile, o: { log?: Log; failAfterApply?: boolean; orgs: Row[] }) {
  await assertPgHeadroom(cfg);
  const br = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0].entity_id as number;
  const x = await extractFed(cfg, file); const rows = dotRows(br, year, x);
  const first = await isFirstPublication(pool, DATASET.fin_fed_dot, 0, year * 100 + 12);
  const fp = sha256(`${file.entry.sha256}:${FIN_VERSION.publish}:${FIN_VERSION.fedDot}`);
  const r = await publishSlice(pool, { datasetId: DATASET.fin_fed_dot, uf: 0, competence: year * 100 + 12, stage: 2, sourceHash: fp, parserVersion: FIN_VERSION.publish, bootstrap: first,
    tables: [{ spec: SPECS.fin_org, rows: o.orgs }, { spec: SPECS.fin_dot, rows }], inputs: { year, file: file.entry.relPath, sha256: file.entry.sha256 }, quality: { year, rowsIn: x.rows_in, rowsKept: x.rows_kept, rowsOut: rows.length },
    ...(o.failAfterApply ? { failAfterApply: true } : {}) });
  o.log?.(JSON.stringify({ federal: 'dot', year, status: r.status, rows: rows.length }));
  return { status: r.status, rows: rows.length };
}
