import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { normalizeName, type CrimeRecord } from '@senadotracker/db';
import { BROWSER_UA, fetchSnapshot, type CrimeLoaded, type Log } from './crime.ts';
import { runPython, type StorageConfig } from './storage.ts';

const ORIGIN = 'https://www.ssp.sp.gov.br';
const LISTING = `${ORIGIN}/assets/estatistica/transparencia/spDados160_516.json`;
/** Anos do bloco "Dados criminais" do índice oficial de arquivos da SSP-SP (o site é uma SPA: o índice JSON é a fonte de verdade dos links). */
export function spYearFiles(json: { data?: Array<{ nome?: string; lista?: Array<{ periodo?: string; arquivo?: string }> }> }): Array<{ year: number; url: string }> {
  const blk = (json.data ?? []).find(b => normalizeName(b.nome ?? '') === 'DADOS CRIMINAIS'); if (!blk) throw new Error('SSP-SP: bloco "Dados criminais" ausente no índice de arquivos');
  return (blk.lista ?? []).filter(x => /^\d{4}$/.test(x.periodo ?? '') && x.arquivo).map(x => ({ year: Number(x.periodo), url: `${ORIGIN}/${x.arquivo!.replace(/^\//, '')}` })).sort((a, b) => a.year - b.year);
}
const codeOf = (nat: string) => normalizeName(nat).replace(/ /g, '_');
interface SpExtract { sheets: Record<string, number>; rows: Array<[number, number, string, string, number]>; lines: number; skipped: Record<string, number> }

/**
 * SSP-SP: cada ano é um XLSX de ~200 MB (um B.O. por linha, com endereço e coordenadas). O Python lê em streaming e devolve só município (COD IBGE) × mês estatístico × natureza apurada;
 * nada além disso sai do processo nem é gravado no RAW derivado. Município-mês sem linha = ausência (não zero).
 */
export async function loadSp(pool: Pool, cfg: StorageConfig, log?: Log, years?: number[]): Promise<CrimeLoaded> {
  const listing = await (await fetch(LISTING, { headers: { 'User-Agent': BROWSER_UA } })).json() as Parameters<typeof spYearFiles>[0];
  const targets = spYearFiles(listing).filter(t => !years || years.includes(t.year)); if (!targets.length) throw new Error('SSP-SP: nenhum ano elegível no índice');
  await mkdir(cfg.stagingDir, { recursive: true });
  const records: CrimeRecord[] = []; const files: CrimeLoaded['files'] = []; const months = new Set<number>(); const notes: Record<string, unknown> = {}; let last = 0;
  for (const t of targets) {
    const f = await fetchSnapshot(pool, cfg, { url: t.url, dir: 'sp', name: `ssp_sp_dados_criminais_${t.year}.xlsx`, dataset: 'ssp_sp_dados_criminais', uf: 35, ...(log ? { log } : {}), accept: h => h.subarray(0, 2).toString('latin1') === 'PK' });
    const cache = join(cfg.stagingDir, `crime_sp_${t.year}_${f.sha256.slice(0, 12)}.json`); let x: SpExtract;
    try { x = JSON.parse(await readFile(cache, 'utf8')) as SpExtract; } catch {
      const r = await runPython('scripts/exec/sp_ssp_extract.py', [join(cfg.rawDir, f.relPath), cache]); if (r.code !== 0) throw new Error(`extração SSP-SP ${t.year} falhou: ${(r.err || r.out).slice(0, 300)}`);
      x = JSON.parse(await readFile(cache, 'utf8')) as SpExtract;
    }
    files.push({ relPath: f.relPath, sha256: f.sha256 });
    for (const [ym, ibge7, mun, nat, v] of x.rows) { months.add(ym); if (ym > last) last = ym; records.push({ ym, ibge7, name: mun, code: codeOf(nat), value: v, prelim: false }); }
    notes[`ano_${t.year}`] = { sheets: x.sheets, lines: x.lines, aggregatedRows: x.rows.length, skipped: x.skipped, personalOrLocationFieldsPersisted: false };
  }
  for (const r of records) if (r.ym === last) r.prelim = true;
  return { files, records, months, explicitZeros: false, duplicates: 'sum', suppressBelow: 3, notes };
}
