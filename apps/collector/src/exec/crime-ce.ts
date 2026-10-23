import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { normalizeName, type CrimeRecord } from '@senadotracker/db';
import { BROWSER_UA, fetchSnapshot, type CrimeLoaded, type Log } from './crime.ts';
import { assertCanDecode, runPython, type StorageConfig } from './storage.ts';

const PAGE = 'https://www.ce.gov.br/sspds/estatisticas/';
export type CeKind = 'cvli' | 'cvp';
/** Links das planilhas de CVLI e CVP (`CVLI_Setembro.xlsx`, `CVP_2026.xlsx`...) na página de estatísticas; o rótulo da data muda a cada atualização. */
export function discoverCeFiles(html: string): Map<CeKind, string> {
  const out = new Map<CeKind, string>();
  for (const m of html.matchAll(/href="([^"]+\.xlsx)"/gi)) {
    const href = decodeURIComponent(m[1]!.replace(/&amp;/g, '&')); const file = href.split('/').pop()!;
    const k: CeKind | null = /^CVLI_[^_]+\.xlsx$/i.test(file) ? 'cvli' : /^CVP_[^_]+\.xlsx$/i.test(file) ? 'cvp' : null;
    if (k && !out.has(k)) out.set(k, href);
  }
  return out;
}
const codeOf = (kind: CeKind, nat: string) => kind === 'cvp' ? 'CVP_TOTAL' : nat.trim().replace(/\s+/g, '_');
/** Grafia da SSPDS-CE que difere do IBGE (conferida contra a lista oficial do CE). */
export const CE_ALIASES: Record<string, string> = {};
const canonMun = (n: string) => CE_ALIASES[normalizeName(n)] ?? n;

export async function loadCe(pool: Pool, cfg: StorageConfig, log?: Log): Promise<CrimeLoaded> {
  const html = await (await fetch(PAGE, { headers: { 'User-Agent': BROWSER_UA } })).text(); const found = discoverCeFiles(html);
  await mkdir(cfg.stagingDir, { recursive: true });
  const records: CrimeRecord[] = []; const files: CrimeLoaded['files'] = []; const months = new Set<number>(); const notes: Record<string, unknown> = {};
  for (const kind of ['cvli', 'cvp'] as CeKind[]) {
    const url = found.get(kind); if (!url) throw new Error(`SSPDS-CE: planilha de ${kind} não encontrada na página de estatísticas`);
    const f = await fetchSnapshot(pool, cfg, { url, dir: 'ce', name: `sspds_ce_${kind}.xlsx`, dataset: `sspds_ce_${kind}`, uf: 23, ...(log ? { log } : {}), accept: h => h.subarray(0, 2).toString('latin1') === 'PK' });
    const cache = join(cfg.stagingDir, `crime_ce_${kind}_${f.sha256.slice(0, 12)}.json`); let x: { rows: Array<[number, string, string, number]>; lines: number; badDates: number };
    try { x = JSON.parse(await readFile(cache, 'utf8')) as typeof x; } catch {
      await assertCanDecode(cfg, f.bytes); const r = await runPython('scripts/exec/ce_sspds_extract.py', [kind, join(cfg.rawDir, f.relPath), cache]); if (r.code !== 0) throw new Error(`extração SSPDS-CE ${kind} falhou: ${(r.err || r.out).slice(0, 300)}`);
      x = JSON.parse(await readFile(cache, 'utf8')) as typeof x;
    }
    files.push({ relPath: f.relPath, sha256: f.sha256 }); const last = Math.max(...x.rows.map(r => r[0]));
    for (const [ym, mun, nat, v] of x.rows) { months.add(ym); records.push({ ym, name: canonMun(mun), code: codeOf(kind, nat), value: v, prelim: ym === last }); }
    notes[kind] = { lines: x.lines, aggregatedRows: x.rows.length, first: Math.min(...x.rows.map(r => r[0])), last, badDates: x.badDates, personalAttributesPersisted: false, url };
  }
  return { files, records, months, explicitZeros: false, duplicates: 'sum', suppressBelow: 3, notes };
}
