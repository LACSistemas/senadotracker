import type { Pool } from 'pg';
import { normalizeName, type CrimeRecord } from '@senadotracker/db';
import { BROWSER_UA, fetchSnapshot, isText, readRaw, type CrimeLoaded, type Log } from './crime.ts';
import { parseCsv } from './crime-rj.ts';
import type { StorageConfig } from './storage.ts';

const CKAN = 'https://dados.mg.gov.br/api/3/action/package_show?id=';
/** Pacotes do portal de dados abertos de MG (SEJUSP) que o Cívica usa; cada um já vem agregado por município × mês × natureza. */
const PACKAGES = ['crimes-violentos', 'sejusp_lesao_corporal_consumado', 'sejusp_furto_consumado', 'sejusp_homicidio_consumado'];
export const mgCode = (nat: string): string => normalizeName(nat).replace(/ /g, '_');

export interface MgResource { pkg: string; name: string; url: string }
export function mgResources(pkg: string, json: { result?: { resources?: Array<{ format?: string; name?: string; url?: string }> } }): MgResource[] {
  return (json.result?.resources ?? []).filter(r => /^csv$/i.test(r.format ?? '') && r.url).map(r => ({ pkg, name: r.name ?? '', url: r.url! }));
}
/**
 * Corta os meses futuros preenchidos com zero pela fonte: depois do último mês com algum registro positivo do conjunto nada é publicado.
 * Zeros em meses até lá (fechados) são zeros declarados e ficam.
 */
export function truncateFutureZeros<T extends { ym: number; value: number | null }>(recs: T[]): { kept: T[]; lastMonth: number | null; dropped: number } {
  let last: number | null = null; for (const r of recs) if ((r.value ?? 0) > 0 && (last === null || r.ym > last)) last = r.ym;
  const kept = last === null ? [] : recs.filter(r => r.ym <= last!);
  return { kept, lastMonth: last, dropped: recs.length - kept.length };
}

export async function loadMg(pool: Pool, cfg: StorageConfig, log?: Log): Promise<CrimeLoaded> {
  const records: CrimeRecord[] = []; const files: CrimeLoaded['files'] = []; const months = new Set<number>(); const notes: Record<string, unknown> = {};
  for (const pkg of PACKAGES) {
    const meta = await (await fetch(`${CKAN}${pkg}`, { headers: { 'User-Agent': BROWSER_UA } })).json() as Parameters<typeof mgResources>[1];
    const res = mgResources(pkg, meta); if (!res.length) throw new Error(`SEJUSP-MG: pacote ${pkg} sem recurso CSV no CKAN`);
    const recs: CrimeRecord[] = [];
    for (const r of res) {
      const file = r.url.split('/').pop()!.split('?')[0]!;
      const f = await fetchSnapshot(pool, cfg, { url: r.url, dir: 'mg', name: file, dataset: `sejusp_mg_${pkg}`, uf: 31, ...(log ? { log } : {}), accept: isText });
      files.push({ relPath: f.relPath, sha256: f.sha256 });
      const rows = parseCsv((await readRaw(cfg, f.relPath)).toString('utf8').replace(/^﻿/, '')); const h = rows[0]!.map(x => x.trim().toLowerCase()); const ix = (n: string[]) => { const i = h.findIndex(c => n.includes(c)); if (i < 0) throw new Error(`SEJUSP-MG ${file}: coluna ${n.join('|')} ausente em ${h.join(',')}`); return i; };
      const iv = ix(['registros']), inat = ix(['natureza']), icod = ix(['cod_ibge', 'cod_municipio']), imes = ix(['mes']), iano = ix(['ano_fato', 'ano']), imun = ix(['municipio']);
      for (const x of rows.slice(1)) {
        const v = Number(x[iv]); if (!Number.isFinite(v)) throw new Error(`SEJUSP-MG ${file}: valor não numérico "${x[iv]}"`);
        recs.push({ ym: Number(x[iano]) * 100 + Number(x[imes]), ibge7: Number(x[icod]) * 10, name: x[imun] ?? '', code: mgCode(x[inat]!), value: v, prelim: false });
      }
    }
    const t = truncateFutureZeros(recs); for (const r of t.kept) { months.add(r.ym); records.push(r); }
    notes[pkg] = { resources: res.length, rows: recs.length, lastMonthWithData: t.lastMonth, futureZeroRowsDropped: t.dropped };
  }
  const last = Math.max(...months); for (const r of records) if (r.ym === last) r.prelim = true;
  return { files, records, months, explicitZeros: true, duplicates: 'error', notes };
}
