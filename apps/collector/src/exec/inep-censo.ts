import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { assertCanStore, assertVolume, assertZipIntact, fetchRaw, recordManifest, registerLocalRaw, runPython, type ManifestEntry, type StorageConfig } from './storage.ts';

/**
 * Censo Escolar (INEP), cadastro de escolas — P10.1. Contrato: docs/executivo-collector-plan/educacao-p10/contrato_censo_escolar.md.
 * 2007–2024: ZIP com UM CSV por ano (uma linha por escola), baixado inteiro (21–34 MB, DEFLATE).
 * 2025: seis tabelas STORED num ZIP de 537 MB; só `Tabela_Escola`, `Tabela_Matricula` e (P10.2) `Tabela_Turma` são copiadas (Range), nunca Gestor/Docente (minimização, G7).
 */
export type Log = (m: string) => void;
export const CENSO_PAGE = 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const CENSO_FIRST_YEAR = 2007;
export const CENSO_LAST_YEAR = 2025;
export const censoYears = (from = CENSO_FIRST_YEAR, to = CENSO_LAST_YEAR): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Os links vêm da página (a URL de 2025 tem um underscore final que quebra qualquer regra de montagem). */
export function parseCensoLinks(html: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of html.matchAll(/https:\/\/download\.inep\.gov\.br\/dados_abertos\/microdados_censo_escolar_(\d{4})_?\.zip/g)) out.set(Number(m[1]), m[0]);
  return out;
}
export async function discoverCensoLinks(fetchImpl: typeof fetch = fetch): Promise<Map<number, string>> {
  const r = await fetchImpl(CENSO_PAGE, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`página do Censo Escolar: HTTP ${r.status}`);
  const links = parseCensoLinks(await r.text());
  if (links.size < 20) throw new Error(`página do Censo Escolar devolveu só ${links.size} links; layout mudou?`);
  return links;
}

export interface CensoFile { year: number; url: string; entries: Array<ManifestEntry & { reused: boolean; member: string | null }>; layout: 'single_csv' | 'tables'; lastModified: string | null }
const relDir = (year: number) => `inep/censo_escolar/${year}`;
const competenceOf = (year: number) => year * 100 + 5;   // referência do Censo: última quarta-feira de maio

export async function fetchCensoEdition(pool: Pool, cfg: StorageConfig, year: number, url: string, log?: Log): Promise<CensoFile> {
  await assertVolume(cfg);
  if (year <= 2024) {
    const name = url.split('/').pop()!;
    const e = await fetchRaw(cfg, { url, relPath: `${relDir(year)}/${name}`, competence: competenceOf(year), uf: 0, retention: 1, dataset: `inep_censo_escolar_${year}`, userAgent: UA,
      accept: head => head.subarray(0, 2).toString('latin1') === 'PK' });
    if (!e.reused) await assertZipIntact(cfg, e.relPath);
    await recordManifest(pool, e); log?.(JSON.stringify({ censo: 'raw', year, sha256: e.sha256, bytes: e.bytes, reused: e.reused }));
    return { year, url, entries: [{ ...e, member: null }], layout: 'single_csv', lastModified: e.sourceModifiedAt };
  }
  const outDir = join(cfg.rawDir, relDir(year)); await mkdir(outDir, { recursive: true });
  await assertCanStore(cfg, 300 * 1024 * 1024);
  const r = await runPython('scripts/exec/inep_member_fetch.py', [url, outDir, 'Tabela_Escola_\\d{4}[^/]*\\.csv$', 'Tabela_Matricula_\\d{4}[^/]*\\.csv$', 'Tabela_Turma_\\d{4}[^/]*\\.csv$']);
  if (r.code !== 0) throw new Error(`cópia por Range do Censo ${year} falhou: ${(r.err || r.out).slice(0, 400)}`);
  const j = JSON.parse(r.out) as { zipBytes: number; lastModified: string | null; members: Array<{ name: string; file: string; bytes: number; sha256: string }> };
  const lm = j.lastModified ? new Date(j.lastModified).toISOString() : null;
  const entries: CensoFile['entries'] = [];
  for (const m of j.members) {
    const base = m.file.split(/[\\/]/).pop()!;
    const e = await registerLocalRaw(cfg, { url: `${url}#${m.name}`, relPath: `${relDir(year)}/${base}`, competence: competenceOf(year), uf: 0, retention: 1, dataset: `inep_censo_escolar_${year}` });
    await recordManifest(pool, e); entries.push({ ...e, reused: false, member: m.name });
    log?.(JSON.stringify({ censo: 'raw', year, member: m.name, sha256: e.sha256, bytes: e.bytes, zipBytes: j.zipBytes, lastModified: lm }));
  }
  return { year, url, entries, layout: 'tables', lastModified: lm };
}
