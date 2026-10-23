import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { normalizeName, type CrimeRecord } from '@senadotracker/db';
import { BROWSER_UA, fetchSnapshot, type CrimeLoaded, type Log } from './crime.ts';
import { assertCanDecode, runPython, type StorageConfig } from './storage.ts';

// O HTTPS da SDS-PE cai por timeout a partir desta rede; o mesmo conteúdo responde por HTTP (com retomada) — o coletor aceita só arquivos XLSX íntegros.
const BASE = 'http://www.sds.pe.gov.br';
const PAGES = ['/estatisticas/crimes-violentos-letais-intencionais', '/estatisticas/indicadores-criminais/crimes-contra-o-patrimonio', '/estatisticas/indicadores-criminais/estrupo', '/estatisticas/indicadores-criminais/violencia-domestica-e-familiar-contra-a-mulher'];
export type PeKind = 'cvli' | 'cvp' | 'estupro' | 'vd';
const KIND_BY_FILE: Array<[RegExp, PeKind]> = [[/microdados_de_cvli/i, 'cvli'], [/microdados_de_cvp/i, 'cvp'], [/microdados_estupro/i, 'estupro'], [/microdados_de_viol/i, 'vd']];
export function discoverPeFiles(html: string): Array<{ kind: PeKind; href: string }> {
  const out: Array<{ kind: PeKind; href: string }> = [];
  for (const m of html.matchAll(/href="([^"]+\.xlsx)"/gi)) { const href = decodeURIComponent(m[1]!.replace(/&amp;/g, '&')); const file = href.split('/').pop()!; const k = KIND_BY_FILE.find(([re]) => re.test(file.normalize('NFD').replace(/[̀-ͯ]/g, ''))); if (k) out.push({ kind: k[1], href }); }
  return out;
}
/** Grafias da SDS-PE que diferem do IBGE (conferidas contra a lista oficial de PE em 23/10/2026); "NAO INFORMADO" não é alias: segue para o município ignorado da UF. */
export const PE_ALIASES: Record<string, string> = { ITAMARACA: 'Ilha de Itamaracá', 'SAO CAETANO': 'São Caitano', 'LAGOA DO ITAENGA': 'Lagoa de Itaenga', IGUARACI: 'Iguaracy', 'BELEM DE SAO FRANCISCO': 'Belém do São Francisco' };
const canonMun = (n: string) => PE_ALIASES[normalizeName(n)] ?? n;
const codeOf = (kind: PeKind, nat: string) => kind === 'cvp' ? 'CVP_TOTAL' : nat.trim().replace(/\s+/g, '_').replace('ESTUPRO_DE_VULNERAVEL_COM_RESULTADO', 'ESTUPRO_VULNERAVEL_COM_RESULTADO'); // o CVLI grafa o rótulo das duas formas ao longo do tempo
/**
 * SDS-PE: baixa os XLSX de microdados, agrega em município × mês × natureza (Python, sem atributos individuais) e devolve registros. O arquivo de violência doméstica só é carregado quando o contrato
 * dele existe (`kinds`); sem contrato, a natureza desconhecida derruba a carga em vez de ser ignorada.
 */
export async function loadPe(pool: Pool, cfg: StorageConfig, log?: Log, kinds: PeKind[] = ['cvli', 'cvp', 'estupro']): Promise<CrimeLoaded> {
  const found = new Map<PeKind, string>();
  for (const p of PAGES) { const html = await (await fetch(`${BASE}${p}`, { headers: { 'User-Agent': BROWSER_UA } })).text(); for (const f of discoverPeFiles(html)) if (!found.has(f.kind)) found.set(f.kind, f.href); }
  await mkdir(cfg.stagingDir, { recursive: true });
  const records: CrimeRecord[] = []; const files: CrimeLoaded['files'] = []; const months = new Set<number>(); const notes: Record<string, unknown> = {};
  for (const kind of kinds) {
    const href = found.get(kind); if (!href) throw new Error(`SDS-PE: arquivo de ${kind} não encontrado nas páginas de estatísticas`);
    const url = `${BASE}${href.startsWith('/') ? '' : '/'}${encodeURI(href)}`;
    const f = await fetchSnapshot(pool, cfg, { url, dir: 'pe', name: `sds_pe_${kind}.xlsx`, dataset: `sds_pe_${kind}`, uf: 26, ...(log ? { log } : {}), accept: h => h.subarray(0, 2).toString('latin1') === 'PK' });
    const cache = join(cfg.stagingDir, `crime_pe_${kind}_${f.sha256.slice(0, 12)}.json`); let x: { rows: Array<[number, string, string, number]>; lines: number; badDates: number };
    try { x = JSON.parse(await readFile(cache, 'utf8')) as typeof x; } catch {
      await assertCanDecode(cfg, f.bytes); const r = await runPython('scripts/exec/pe_sds_extract.py', [kind, join(cfg.rawDir, f.relPath), cache]); if (r.code !== 0) throw new Error(`extração SDS-PE ${kind} falhou: ${(r.err || r.out).slice(0, 300)}`);
      x = JSON.parse(await readFile(cache, 'utf8')) as typeof x;
    }
    files.push({ relPath: f.relPath, sha256: f.sha256 }); const last = Math.max(...x.rows.map(r => r[0]));
    for (const [ym, mun, nat, v] of x.rows) { months.add(ym); records.push({ ym, name: canonMun(mun), code: codeOf(kind, nat), value: v, prelim: ym === last }); }
    notes[kind] = { lines: x.lines, aggregatedRows: x.rows.length, first: Math.min(...x.rows.map(r => r[0])), last, badDates: x.badDates, personalAttributesPersisted: false };
  }
  return { files, records, months, explicitZeros: false, duplicates: 'sum', suppressBelow: 3, notes };
}
