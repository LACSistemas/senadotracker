import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import type { Pool } from 'pg';
import { HttpGate, appendSerial } from './http-gate.ts';
import { assertCanStore, assertVolume, readManifest, recordManifest, registerLocalRaw, type ManifestEntry, type StorageConfig } from './storage.ts';

/**
 * Coleta RAW dos contratos do PNCP (API de consulta, `contratos` por janela de publicação), um pacote por mês em raw/pncp/contratos/AAAA/MM.jsonl.gz.
 * Cada linha é uma página verbatim ({p, s, b}). Nada é interpretado aqui: a classificação (órgão de segurança × tema) é feita na construção, e só os
 * contratos classificados são persistidos. O PNCP começa em 2021 e só tem volume relevante a partir de 2022.
 */
export type Log = (m: string) => void;
const API = 'https://pncp.gov.br/api/consulta/v1/contratos';
export const PNCP_FIRST_YEAR = 2021;
export const PNCP_PAGE_SIZE = 500;
const gate = new HttpGate(Number(process.env.PNCP_MIN_SPACING_MS ?? 400), 'civica-exec/1.0 (pesquisa de dados abertos)', 1500, 10, 0.7);
export interface PncpPageLine { p: number; s: number; b: string }
export const pncpBundleRel = (year: number, month: number) => `pncp/contratos/${year}/${String(month).padStart(2, '0')}.jsonl.gz`;
const ymd = (y: number, m: number, d: number) => `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const pageUrl = (y: number, m: number, page: number) => `${API}?dataInicial=${ymd(y, m, 1)}&dataFinal=${ymd(y, m, lastDay(y, m))}&pagina=${page}&tamanhoPagina=${PNCP_PAGE_SIZE}`;

export interface PncpBundle { relPath: string; entry: ManifestEntry; pages: number; contracts: number; reused: boolean }
export async function fetchPncpMonth(pool: Pool, cfg: StorageConfig, year: number, month: number, o: { concurrency?: number; log?: Log } = {}): Promise<PncpBundle> {
  await assertVolume(cfg);
  const rel = pncpBundleRel(year, month); const dest = join(cfg.rawDir, rel); const part = `${dest}.part.jsonl`; await mkdir(dirname(dest), { recursive: true });
  const closed = Date.UTC(year, month, 1) < Date.now() - 3 * 864e5;   // mês corrente (ou recém-encerrado) é reescrito a cada rodada: não é reutilizado
  try { const s = await stat(dest); const known = (await readManifest(cfg)).get(rel); if (closed && known && known.bytes === s.size) { const c = await countPncp(dest); return { relPath: rel, entry: known, pages: c.pages, contracts: c.contracts, reused: true }; } } catch { /* ainda não existe */ }
  const readPart = async (): Promise<PncpPageLine[]> => { try { return (await readFile(part, 'utf8')).split('\n').filter(l => l.trim()).flatMap(l => { try { return [JSON.parse(l) as PncpPageLine]; } catch { return []; } }); } catch { return []; } };
  const have = new Map((await readPart()).map(l => [l.p, l] as const));
  const first = have.get(1) ?? await (async () => { const r = await gate.get(pageUrl(year, month, 1)); const l: PncpPageLine = { p: 1, s: r.status, b: r.body }; await appendFile(part, JSON.stringify(l) + '\n'); return l; })();
  const total = first.s === 200 ? Number((JSON.parse(first.b) as { totalPaginas?: number }).totalPaginas ?? 0) : 0;
  let next = 2; const worker = async () => {
    for (;;) {
      const p = next++; if (p > total) return; if (have.has(p)) continue;
      const r = await gate.get(pageUrl(year, month, p)); await assertCanStore(cfg, r.body.length); await appendSerial(part, JSON.stringify({ p, s: r.status, b: r.body } satisfies PncpPageLine) + '\n');
    }
  };
  await Promise.all(Array.from({ length: o.concurrency ?? 3 }, worker));
  const pages = [...new Map((await readPart()).map(l => [l.p, l] as const)).values()].sort((a, b) => a.p - b.p);
  const expect = Math.max(total, 1); if (pages.length !== expect || pages.some(x => x.s !== 200 && !(expect === 1 && (x.s === 404 || x.s === 204)))) throw new Error(`pacote PNCP ${rel} incompleto: ${pages.length}/${expect} páginas`);
  const tmp = `${dest}.tmp`; const gz = createGzip({ level: 6 }); const out = createWriteStream(tmp); const done = pipeline(gz, out); for (const l of pages) gz.write(JSON.stringify(l) + '\n'); gz.end(); await done;
  await rename(tmp, dest); await rm(part, { force: true });
  const entry = await registerLocalRaw(cfg, { url: `${API}?dataInicial=${ymd(year, month, 1)}&dataFinal=${ymd(year, month, lastDay(year, month))}&pagina=<n>&tamanhoPagina=${PNCP_PAGE_SIZE}`, relPath: rel, competence: year * 100 + month, uf: 0, retention: 1, dataset: 'pncp_contratos' });
  await recordManifest(pool, entry); const c = await countPncp(dest);
  o.log?.(JSON.stringify({ pncp: 'bundle', year, month, pages: c.pages, contracts: c.contracts, bytes: entry.bytes, gate: gate.stats() }));
  return { relPath: rel, entry, pages: c.pages, contracts: c.contracts, reused: false };
}
async function countPncp(path: string): Promise<{ pages: number; contracts: number }> {
  let pages = 0, contracts = 0; const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) { if (!l.trim()) continue; pages++; const x = JSON.parse(l) as PncpPageLine; if (x.s === 200) contracts += ((JSON.parse(x.b) as { data?: unknown[] }).data ?? []).length; }
  return { pages, contracts };
}
export async function* readPncpBundle(cfg: StorageConfig, relPath: string): AsyncGenerator<PncpPageLine> {
  const rl = createInterface({ input: createReadStream(join(cfg.rawDir, relPath)).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) if (l.trim()) yield JSON.parse(l) as PncpPageLine;
}
