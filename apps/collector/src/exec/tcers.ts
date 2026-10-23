import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { DATASET, FIN_VERSION, SPECS, norm, publishSlice, sha256, type Row } from '@senadotracker/db';
import { assertCanDecode, assertPgHeadroom, assertVolume, assertZipIntact, fetchRaw, recordManifest, runPython, type ManifestEntry, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

/**
 * Município detalhado — TCE-RS (empenhos municipais, único provedor estadual comprovado com FUNÇÃO + unidade orçamentária + natureza + estágio): função 06 por prefeitura
 * (órgão "PM DE <município>") × unidade orçamentária × subfunção × programa × projeto × natureza. Câmaras ("CM DE") e demais órgãos (fundos, autarquias) NÃO são atribuídos
 * ao município por nome (a DCA os consolida; a diferença é medida na reconciliação). Restos a pagar: só o pagamento de empenhos de exercícios anteriores (rp_pago).
 */
export type Log = (m: string) => void;
const BASE = 'https://dados.tce.rs.gov.br/dados/municipal/empenhos';
export const RS_UF = 43; export const RS_FIRST_YEAR = 2013;
export const orgIdMun = (ibge6: number, unit: string): number => 1_000_000_000 + ibge6 * 1000 + (Number(unit.replace(/\D/g, '')) % 1000);

export interface RsFile { year: number; entry: ManifestEntry }
export async function fetchRs(pool: Pool, cfg: StorageConfig, year: number, log?: Log): Promise<RsFile> {
  await assertVolume(cfg);
  const closed = year < new Date().getUTCFullYear();
  const e = await fetchRaw(cfg, { url: `${BASE}/${year}.csv.zip`, relPath: `tcers/empenhos/${year}.csv.zip`, competence: year * 100 + 12, uf: RS_UF, retention: 1, dataset: 'tcers_empenhos', dedupeByHash: false, accept: h => h.subarray(0, 2).toString('latin1') === 'PK', retries: 8 });
  await assertZipIntact(cfg, e.relPath);
  if (!closed && !(e as ManifestEntry & { reused?: boolean }).reused) log?.(JSON.stringify({ tcers: 'raw-parcial', year }));
  await recordManifest(pool, e); log?.(JSON.stringify({ tcers: 'raw', year, bytes: e.bytes, sha256: e.sha256 }));
  return { year, entry: e };
}
interface RsExtract { rows_in: number; rows_kept: number; rows: Array<[string, string, string, string, string, string, number, number, number, number, number, number, number]>; orgs: Array<[string, string, string]>; ctrl: Array<Array<string | number>> }
async function extractRs(cfg: StorageConfig, f: RsFile): Promise<RsExtract> {
  await mkdir(cfg.stagingDir, { recursive: true }); const cache = join(cfg.stagingDir, `rs_${f.year}_${f.entry.sha256.slice(0, 12)}_${FIN_VERSION.fed}.json`);
  try { return JSON.parse(await readFile(cache, 'utf8')) as RsExtract; } catch { /* sem cache */ }
  await assertCanDecode(cfg, 60 * 1024 * 1024);
  const r = await runPython('scripts/exec/rs_extract.py', [join(cfg.rawDir, f.entry.relPath), cache]); if (r.code !== 0) throw new Error(`extração TCE-RS ${f.year} falhou: ${(r.err || r.out).slice(0, 400)}`);
  return JSON.parse(await readFile(cache, 'utf8')) as RsExtract;
}
export interface RsBuilt { rows: Row[]; orgs: Row[]; stats: Record<string, number>; unmatched: string[] }
/**
 * Atribui prefeituras ("PM DE X") ao município pelo NOME (único no RS após normalização); o que não casa é relatado, nunca forçado. O exercício é o da DATA DA OPERAÇÃO:
 * o arquivo do ano Y é a remessa recebida em Y; operações de anos anteriores reenviadas depois NÃO são somadas (duplicam o arquivo do próprio ano).
 */
export function buildRsAll(exts: Array<{ fileYear: number; x: RsExtract }>, munByName: Map<string, { entityId: number; ibge6: number }>): Map<number, RsBuilt> {
  const out = new Map<number, RsBuilt>(); const accBy = new Map<number, Map<string, Row>>(); const unmatched = new Set<string>(); const orgsBy = new Map<number, Map<number, Row>>();
  const st = (y: number) => out.get(y) ?? out.set(y, { rows: [], orgs: [], stats: { rowsIn: 0, rowsFunction06: 0, aggregated: 0, pmRows: 0, pmMatchedRows: 0, nonPmRows: 0, undated: 0 }, unmatched: [] }).get(y)!;
  for (const { fileYear, x } of exts) {
    const unitName = new Map(x.orgs.map(([o, u, n]) => [`${o}|${u}`, n]));
    for (const [ymS, org, uo, sf, pr, acao, cat, gr, mod, rp, emp, liq, pag] of x.rows) {
      const year = Number(ymS.slice(0, 4)); if (!(year > 2000) || ymS.endsWith('-00')) { st(year || 0).stats.undated!++; continue; }
      // O arquivo do ano seguinte REENVIA operações do ano já presentes no arquivo do próprio ano (154 de 157 linhas de Roca Sales 2024 em 2025): somar os arquivos duplicaria o valor.
      // Cada exercício usa só a remessa do próprio ano; o que chegou só depois (ordem de 2% das linhas) fica de fora e é contado.
      if (year !== fileYear) { st(year).stats.lateResendSkipped = (st(year).stats.lateResendSkipped ?? 0) + 1; continue; }
      const b = st(year); b.stats.aggregated!++;
      if (!org.startsWith('PM DE ')) { b.stats.nonPmRows!++; continue; }
      b.stats.pmRows!++; const mun = munByName.get(norm(org.slice(6))); if (!mun) { unmatched.add(org); continue; } b.stats.pmMatchedRows!++;
      const month = Number(ymS.slice(5, 7)); const id = orgIdMun(mun.ibge6, uo); const orgs = orgsBy.get(year) ?? orgsBy.set(year, new Map()).get(year)!; const nm = (unitName.get(`${org}|${uo}`) ?? uo).slice(0, 160);
      if (!orgs.has(id)) orgs.set(id, { org_id: id, entity_id: mun.entityId, level: 3, code: uo, parent_id: null, name: nm, first_year: year, last_year: year, names: { [String(year)]: nm } });
      const acc = accBy.get(year) ?? accBy.set(year, new Map()).get(year)!; const k = [mun.entityId, month, id, sf, pr, acao, cat, gr, mod].join('|');
      const row = acc.get(k) ?? { entity_id: mun.entityId, exercicio: year, mes: month, org_id: id, funcao: 6, subfuncao: Number(sf) || 0, programa: Number(pr) || 0, acao: acao || '-', categoria: cat, grupo: gr, modalidade: mod, uf_loc: RS_UF, emp: 0, liq: 0, pago: 0, rp_insc: 0, rp_canc: 0, rp_pago: 0 };
      if (rp) row.rp_pago = Number(row.rp_pago) + pag; else { row.emp = Number(row.emp) + emp; row.liq = Number(row.liq) + liq; row.pago = Number(row.pago) + pag; }
      acc.set(k, row);
    }
  }
  for (const [y, b] of out) { b.rows = [...(accBy.get(y)?.values() ?? [])]; b.orgs = [...(orgsBy.get(y)?.values() ?? [])]; b.unmatched = [...unmatched]; }
  return out;
}
export async function loadRsMunicipalities(pool: Pool): Promise<Map<string, { entityId: number; ibge6: number }>> {
  const r = await pool.query(`SELECT entity_id, name, ibge6 FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $1`, [RS_UF]);
  return new Map(r.rows.map(x => [norm(String(x.name)), { entityId: Number(x.entity_id), ibge6: Number(x.ibge6) }]));
}
export async function publishRsAll(pool: Pool, cfg: StorageConfig, files: RsFile[], o: { log?: Log; from?: number; to?: number; failAfterApply?: boolean } = {}) {
  await assertPgHeadroom(cfg); const exts: Array<{ fileYear: number; x: RsExtract }> = []; for (const f of files) exts.push({ fileYear: f.year, x: await extractRs(cfg, f) });
  const built = buildRsAll(exts, await loadRsMunicipalities(pool)); const results: Array<{ year: number; status: string; rows: number }> = []; const lastFile = Math.max(...files.map(f => f.year));
  for (const [year, b] of [...built.entries()].sort((a, c) => a[0] - c[0])) {
    if (year < (o.from ?? files[0]!.year) || year > (o.to ?? lastFile) || !b.rows.length) continue;
    const feeding = files.filter(f => f.year >= year); const first = await isFirstPublication(pool, DATASET.fin_rs_exec, RS_UF, year * 100 + 12);
    const fp = sha256(`${feeding.filter(f => f.year === year).map(f => f.entry.sha256).join(',')}:${FIN_VERSION.publish}:${FIN_VERSION.rs}:own:${year}`);
    const r = await publishSlice(pool, { datasetId: DATASET.fin_rs_exec, uf: RS_UF, competence: year * 100 + 12, stage: year >= new Date().getUTCFullYear() ? 1 : 2, sourceHash: fp, parserVersion: FIN_VERSION.publish, bootstrap: first,
      tables: [{ spec: SPECS.fin_org, rows: b.orgs }, { spec: SPECS.fin_exec_uf, rows: b.rows }], inputs: { year, files: feeding.map(f => ({ rel: f.entry.relPath, sha256: f.entry.sha256 })) }, quality: { ...b.stats, unmatchedOrgs: b.unmatched.length, rowsOut: b.rows.length },
      ...(o.failAfterApply ? { failAfterApply: true } : {}) });
    results.push({ year, status: r.status, rows: b.rows.length }); o.log?.(JSON.stringify({ tcers: 'publish', year, status: r.status, rows: b.rows.length, ...b.stats, unmatchedOrgs: b.unmatched.length }));
  }
  return { results, built };
}
