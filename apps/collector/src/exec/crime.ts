import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import {
  CRIME_COV_SPECS, CRIME_VERSION, DATASET, buildCrimeSlice, buildVdeCrosswalk, crimeDefsOf, crimeIdsOf, publishSlice, replaceIndicatorsBulk, sha256,
  type CrimeRecord, type CrimeSlice, type CrimeSource,
} from '@senadotracker/db';
import { assertPgHeadroom, assertVolume, fetchRaw, recordManifest, type ManifestEntry, type StorageConfig } from './storage.ts';
import { isFirstPublication, loadEntityDir } from './seguranca.ts';

export type Log = (m: string) => void;
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const crimeDataset = (slot: number) => DATASET.crime_base + slot;

/** Resultado do adaptador de uma fonte: registros já normalizados + semântica temporal/de zero + controles da própria fonte. */
export interface CrimeLoaded {
  files: Array<{ relPath: string; sha256: string }>; records: CrimeRecord[]; months: Set<number>; explicitZeros: boolean; duplicates: 'error' | 'sum'; suppressBelow?: number;
  ufTotals?: Map<string, number>; notes: Record<string, unknown>;
}
/** Baixa um arquivo para o RAW com cópia por data e deduplicação por hash (fonte republicada igual não gera cópia nova). */
export async function fetchSnapshot(pool: Pool, cfg: StorageConfig, o: { url: string; dir: string; name: string; dataset: string; uf: number; log?: Log; accept?: (h: Buffer) => boolean }): Promise<ManifestEntry> {
  await assertVolume(cfg); const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, ''); const ext = o.name.includes('.') ? o.name.slice(o.name.lastIndexOf('.')) : '';
  const e = await fetchRaw(cfg, { url: o.url, relPath: `crime/${o.dir}/${o.name.replace(ext, '')}_${stamp}${ext}`, competence: null, uf: o.uf, retention: 1, dataset: o.dataset, dedupeByHash: true, userAgent: BROWSER_UA, ...(o.accept ? { accept: o.accept } : {}) });
  await recordManifest(pool, e); o.log?.(JSON.stringify({ crime: 'raw', dataset: o.dataset, rel: e.relPath, bytes: e.bytes, sha256: e.sha256 }));
  return e;
}
export const readRaw = (cfg: StorageConfig, rel: string) => readFile(join(cfg.rawDir, rel));
export const isText = (h: Buffer) => !h.subarray(0, 64).toString('latin1').trimStart().startsWith('<');

export interface PublishCrimeOpts { years?: number[]; log?: Log; failAfterApply?: boolean; today?: Date }
export interface PublishedSlice { year: number; status: string; rows: number; municipalities: number; quality: Record<string, unknown>; reconciliationDiffs: number; compositeViolations: number }
/** Publica as fatias UF × ano de uma fonte já carregada (transacional; mesmo RAW → NO_CHANGE). */
export async function publishCrimeSource(pool: Pool, cfg: StorageConfig, src: CrimeSource, loaded: CrimeLoaded, o: PublishCrimeOpts = {}): Promise<PublishedSlice[]> {
  await assertVolume(cfg); await assertPgHeadroom(cfg);
  const { dir, ufByAcronym } = await loadEntityDir(pool); const xw = buildVdeCrosswalk(dir, ufByAcronym); const defs = crimeDefsOf(src.slot); const currentYear = (o.today ?? new Date()).getUTCFullYear();
  const years = o.years ?? [...new Set([...loaded.months].map(m => Math.floor(m / 100)))].sort(); const out: PublishedSlice[] = [];
  for (const year of years) {
    const slice = buildCrimeSlice(loaded.records, { defs, year, ufCode: src.ufCode, dir, xw, currentYear, months: loaded.months, explicitZeros: loaded.explicitZeros, duplicates: loaded.duplicates, ...(loaded.suppressBelow != null ? { suppressBelow: loaded.suppressBelow } : {}), ...(loaded.ufTotals ? { ufTotals: loaded.ufTotals } : {}) });
    if (!slice.rows.length && !slice.cov.length) continue;
    const dataset = crimeDataset(src.slot); const comp = year * 100 + 12; const first = await isFirstPublication(pool, dataset, src.ufCode, comp);
    const fp = sha256(`${loaded.files.map(f => f.sha256).join(',')}:${CRIME_VERSION.contract}:${CRIME_VERSION.rj}:${src.key}:${year}`);
    const r = await publishSlice(pool, { datasetId: dataset, uf: src.ufCode, competence: comp, stage: year >= currentYear ? 1 : 2, sourceHash: fp, parserVersion: CRIME_VERSION.contract, bootstrap: first,
      tables: [{ spec: CRIME_COV_SPECS[src.slot]!, rows: slice.cov as unknown as Array<Record<string, unknown>> }], inputs: { source: src.key, year, files: loaded.files }, quality: { ...slice.quality, ...loaded.notes },
      ...(o.failAfterApply ? { failAfterApply: true } : {}),
      derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: crimeIdsOf(src.slot), ufCode: src.ufCode, from: `${year}-01-01`, to: `${year + 1}-01-01` }, slice.rows, !first); },
      verify: async c => verifyCrimeSlice(c, src, year, slice) });
    const muns = new Set(slice.rows.filter(x => x.entity_id !== src.ufCode).map(x => x.entity_id)).size;
    out.push({ year, status: r.status, rows: slice.rows.length, municipalities: muns, quality: slice.quality, reconciliationDiffs: slice.reconciliation.length, compositeViolations: slice.compositeViolations.length });
    o.log?.(JSON.stringify({ crime: 'slice', source: src.key, year, status: r.status, rows: slice.rows.length, municipalities: muns, ...slice.quality }));
  }
  return out;
}
/** Σ municípios (inclui o ignorado) = UF por indicador × mês, sem células suprimidas; linhas persistidas = linhas construídas. */
async function verifyCrimeSlice(c: PoolClient, src: CrimeSource, year: number, s: CrimeSlice): Promise<void> {
  const ids = crimeIdsOf(src.slot); const n = await c.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = ANY($1::smallint[]) AND period_start >= make_date($2, 1, 1) AND period_start < make_date($2 + 1, 1, 1) AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $3)`, [ids, year, src.ufCode]);
  if (Number(n.rows[0].n) !== s.rows.length) throw new Error(`crime ${src.key} ${year}: ${n.rows[0].n} linhas persistidas ≠ ${s.rows.length}`);
  if (Number((s.quality as { suppressedCells?: number }).suppressedCells ?? 0) > 0) return;
  const r = await c.query(`SELECT v.indicator_id, v.period_start::text p, sum(v.value) FILTER (WHERE e.kind IN (4, 5)) m, max(v.value) FILTER (WHERE e.kind = 3) u FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id)
    WHERE v.indicator_id = ANY($1::smallint[]) AND v.period_start >= make_date($2, 1, 1) AND v.period_start < make_date($2 + 1, 1, 1) AND e.uf_code = $3 GROUP BY 1, 2`, [ids, year, src.ufCode]);
  const bad = r.rows.filter(x => x.u != null && Math.abs(Number(x.m ?? 0) - Number(x.u)) > 1e-6).slice(0, 5).map(x => `${x.indicator_id}@${x.p}: Σ mun ${x.m} ≠ UF ${x.u}`);
  if (bad.length) throw new Error(`reconciliação ${src.key} ${year}: ${bad.join('; ')}`);
}
