import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import type { CrimeRecord } from '@senadotracker/db';
import { BROWSER_UA, fetchSnapshot, type CrimeLoaded, type Log } from './crime.ts';
import { assertCanDecode, runPython, type StorageConfig } from './storage.ts';

const PAGE = 'https://ssp.rs.gov.br/indicadores-criminais';
const ORIGIN = 'https://ssp.rs.gov.br';
/** Cabeçalho normalizado da planilha → código do contrato. */
const HEADER: Array<[RegExp, string]> = [
  [/^HOMICIDIO DOLOSO$/, 'HOMICIDIO_DOLOSO'], [/^(TOTAL DE )?VITIMAS DE HOMICIDIO DOLOSO$/, 'VITIMAS_HOMICIDIO_DOLOSO'], [/^LATROCINIO$/, 'LATROCINIO'], [/^VITIMAS DE LATROCINIO$/, 'VITIMAS_LATROCINIO'],
  [/^VITIMAS DE LESAO CORP SEG MORTE$/, 'VITIMAS_LESAO_CORPORAL_SEGUIDA_DE_MORTE'], [/^(TOTAL DE )?VITIMAS DE CVLI$/, 'VITIMAS_CVLI'], [/^FURTOS?$/, 'FURTO'], [/^ABIGEATO$/, 'ABIGEATO'], [/^FURTO DE VEICULO$/, 'FURTO_VEICULO'],
  [/^ROUBOS?$/, 'ROUBO'], [/^ROUBO DE VEICULO$/, 'ROUBO_VEICULO'], [/^ESTELIONATO$/, 'ESTELIONATO'], [/^DELITOS RELACIONADOS A ARMAS E MUNICOES$/, 'ARMAS_MUNICOES'], [/^ENTORPECENTES POSSE$/, 'ENTORPECENTES_POSSE'], [/^ENTORPECENTES TRAFICO$/, 'ENTORPECENTES_TRAFICO'],
];
export const rsHeaderCode = (h: string): string | null => HEADER.find(([re]) => re.test(h.replace(/\s+/g, ' ').trim()))?.[1] ?? null;
/** Ano de cada planilha pelo nome do arquivo (o ano de publicação/atualização também aparece no nome: vale o ano do conteúdo). */
export function discoverRsLinks(html: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of html.matchAll(/href="([^"]+\.xlsx)"/gi)) {
    let href = decodeURIComponent(m[1]!.replace(/&amp;/g, '&')); const file = href.split('/').pop()!.toLowerCase();
    if (!/(site-geral-e-munici|por-municipio)/.test(file)) continue;
    const y = /ano-(20\d\d)/.exec(file) ?? /municipios-(20\d\d)-publicacao/.exec(file) ?? /municipio-(20\d\d)\.xlsx/.exec(file) ?? /municipios-(?:set|ago|jul|jun)-(20\d\d)/.exec(file) ?? /municipios-(20\d\d)/.exec(file);
    if (!y) continue; href = href.replace(/^(\.\.\/)+/, '/'); const url = href.startsWith('http') ? href : `${ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`; const yr = Number(y[1]);
    if (!out.has(yr) || url.includes('/202610/') || url.includes('/2026')) out.set(yr, out.get(yr) && !url.includes('/2026') && !url.includes('/202610/') ? out.get(yr)! : url);
  }
  return out;
}
interface RsExtract { periodo: string | null; sheets: Record<string, { sheet: string; header: string[]; rows: Array<Array<string | number | null>>; total: Array<number | null> | null }>; geral: { header: string[]; months: Record<string, Array<number | null>> } | null }
const MONTHS_PT: Record<string, number> = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
/** Último mês do período declarado ("... a 30 de setembro de 2026"); null se não legível. */
export function lastMonthOfPeriod(p: string | null, year: number): number | null {
  const t = (p ?? '').normalize('NFC').toLowerCase(); const m = /a\s+\d{1,2}\s+de\s+([a-zç]+)\s+de\s+(20\d\d)/.exec(t.replace(/�/g, 'ç'));
  if (!m || Number(m[2]) !== year) return null; return MONTHS_PT[m[1]!] ?? null;
}

export async function loadRs(pool: Pool, cfg: StorageConfig, log?: Log): Promise<CrimeLoaded> {
  const html = await (await fetch(PAGE, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pt-BR,pt;q=0.9', Accept: 'text/html' } })).text();
  const links = discoverRsLinks(html); if (links.size < 10) throw new Error(`SSP-RS: só ${links.size} planilhas anuais descobertas na página (layout mudou ou WAF bloqueou)`);
  await mkdir(cfg.stagingDir, { recursive: true });
  const records: CrimeRecord[] = []; const files: CrimeLoaded['files'] = []; const months = new Set<number>(); const ufTotals = new Map<string, number>(); const years: Record<string, unknown> = {}; const skippedYears: number[] = [];
  for (const [year, url] of [...links.entries()].sort((a, b) => a[0] - b[0])) {
    if (year < 2012) { skippedYears.push(year); continue; }
    const f = await fetchSnapshot(pool, cfg, { url, dir: 'rs', name: `ssp_rs_indicadores_${year}.xlsx`, dataset: 'ssp_rs_indicadores', uf: 43, ...(log ? { log } : {}), accept: h => h.subarray(0, 2).toString('latin1') === 'PK' });
    const cache = join(cfg.stagingDir, `crime_rs_${year}_${f.sha256.slice(0, 12)}.json`); let x: RsExtract;
    try { x = JSON.parse(await readFile(cache, 'utf8')) as RsExtract; } catch {
      await assertCanDecode(cfg, f.bytes); const r = await runPython('scripts/exec/rs_ssp_extract.py', [join(cfg.rawDir, f.relPath), cache]); if (r.code !== 0) throw new Error(`extração SSP-RS ${year} falhou: ${(r.err || r.out).slice(0, 300)}`);
      x = JSON.parse(await readFile(cache, 'utf8')) as RsExtract;
    }
    files.push({ relPath: f.relPath, sha256: f.sha256 }); const lastDeclared = lastMonthOfPeriod(x.periodo, year) ?? 12; const present: number[] = [];
    for (const [mk, sh] of Object.entries(x.sheets)) {
      const month = Number(mk); const codes = sh.header.map(h => rsHeaderCode(h)); const bad = sh.header.filter((_, i) => !codes[i]); if (bad.length) throw new Error(`SSP-RS ${year}/${sh.sheet}: cabeçalho sem contrato: ${bad.join(' | ')}`);
      const active = sh.rows.some(r => r.slice(1).some(v => typeof v === 'number' && v > 0)); if (!active || month > lastDeclared) continue;
      const ym = year * 100 + month; present.push(month); months.add(ym);
      for (const row of sh.rows) for (let i = 0; i < codes.length; i++) { const v = row[i + 1]; records.push({ ym, name: String(row[0]), code: codes[i]!, value: typeof v === 'number' ? v : null, prelim: false }); }
      if (sh.total) for (let i = 0; i < codes.length; i++) { const t = sh.total[i]; if (typeof t === 'number') ufTotals.set(`${codes[i]}|${ym}`, t); }
    }
    years[year] = { months: present.length, last: Math.max(0, ...present), periodo: x.periodo?.replace(/\s+/g, ' ').slice(0, 110) };
  }
  return { files, records, months, explicitZeros: true, duplicates: 'error', ufTotals, notes: { years, skippedYearsLegacyXls: skippedYears, controle: 'linha "Total RS" de cada aba mensal', note: 'anos anteriores a 2012 estão em .xls legado e não foram carregados' } };
}
