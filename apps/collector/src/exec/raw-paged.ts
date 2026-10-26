import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import type { Pool } from 'pg';
import { assertCanStore, assertVolume, readManifest, recordManifest, registerLocalRaw, type StorageConfig } from './storage.ts';

/**
 * Coleta RAW paginada de uma API pública, com retomada: cada página é anexada (verbatim, `{p, s, b, n}`) a um arquivo `.part.jsonl` e, ao fim, o conjunto vira um `.jsonl.gz`
 * registrado no manifesto, mais um arquivo `.meta.json` com contagens e as páginas que falharam. Nada é interpretado aqui. Páginas que falham depois de todas as tentativas
 * ficam registradas como falha (nunca silenciadas) e a cobertura que dependa delas é declarada incompleta pelo consumidor.
 * Total de páginas conhecido (`total`) ou desconhecido (lê até a primeira página vazia; a paginação de algumas APIs informa total errado).
 */
export type Log = (m: string) => void;
export interface PagedSpec {
  rel: string; sourceUrl: string; dataset: string; competence?: number | null; uf?: number | null; firstPage: number;
  url: (p: number) => string;
  /** itens da página (corpo JSON válido) */
  count: (body: string) => number;
  /** total de páginas informado pela API quando confiável; null = desconhecido (lê até a página vazia) */
  total?: (body: string) => number | null;
}
export interface PagedMeta { rel: string; pages: number; items: number; failedPages: number[]; aborted: boolean; endPage: number | null; at: string }
export interface PagedResult extends PagedMeta { reused: boolean; sha256: string }
interface Line { p: number; s: number; b: string; n: number; e?: string }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let lastStart = 0;
async function slot(spacing: number): Promise<void> { const now = Date.now(); const at = Math.max(now, lastStart + spacing); lastStart = at; if (at > now) await sleep(at - now); }

async function getOnce(url: string, ua: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try { const r = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' }, signal: ctl.signal }); return { status: r.status, body: Buffer.from(await r.arrayBuffer()).toString('utf8') }; } finally { clearTimeout(t); }
}

export async function collectPaged(pool: Pool | null, cfg: StorageConfig, spec: PagedSpec, o: { concurrency?: number; tries?: number; timeoutMs?: number; spacingMs?: number; maxPages?: number; refresh?: boolean; log?: Log; userAgent?: string } = {}): Promise<PagedResult> {
  await assertVolume(cfg);
  const dest = join(cfg.rawDir, spec.rel); const part = `${dest}.part.jsonl`; const metaPath = `${dest}.meta.json`; await mkdir(dirname(dest), { recursive: true });
  const ua = o.userAgent ?? 'civica-exec/1.0 (pesquisa de dados abertos)'; const tries = o.tries ?? 8; const timeoutMs = o.timeoutMs ?? 240_000; const spacing = o.spacingMs ?? 300; const maxPages = o.maxPages ?? 5000;
  if (!o.refresh) {
    try { await stat(dest); const meta = JSON.parse(await readFile(metaPath, 'utf8')) as PagedMeta; const known = (await readManifest(cfg)).get(spec.rel); if (known && !meta.failedPages.length) return { ...meta, reused: true, sha256: known.sha256 }; } catch { /* sem pacote completo */ }
  }
  const have = new Map<number, Line>();
  try { for (const l of (await readFile(part, 'utf8')).split('\n')) { if (!l.trim()) continue; try { const x = JSON.parse(l) as Line; if (x.s === 200) have.set(x.p, x); } catch { /* linha truncada */ } } } catch { /* sem parcial */ }
  let total: number | null = null; let endPage = Infinity; let next = spec.firstPage; let consecutiveFail = 0; let aborted = false; const failed = new Set<number>();
  const store = async (l: Line) => { await appendFile(part, JSON.stringify(l) + '\n'); };
  const first = have.get(spec.firstPage) ?? await (async () => {
    for (let n = 1; n <= tries; n++) {
      await slot(spacing);
      try { const r = await getOnce(spec.url(spec.firstPage), ua, timeoutMs); if (r.status === 200) { const l: Line = { p: spec.firstPage, s: 200, b: r.body, n: spec.count(r.body) }; await store(l); return l; } if (r.status === 404 || r.status === 204) { const l: Line = { p: spec.firstPage, s: r.status, b: '', n: 0 }; await store(l); return l; } } catch { /* repete */ }
      await sleep(Math.min(2000 * n, 30_000));
    }
    throw new Error(`primeira página indisponível: ${spec.url(spec.firstPage)}`);
  })();
  have.set(spec.firstPage, first);
  if (first.s === 200) { total = spec.total ? spec.total(first.b) : null; if (first.n === 0) endPage = spec.firstPage; }
  else endPage = spec.firstPage;
  const lastPage = total != null ? spec.firstPage + total - 1 : null; next = spec.firstPage + 1;
  const worker = async (): Promise<void> => {
    for (;;) {
      const p = next++; if (p > endPage || p >= spec.firstPage + maxPages || (lastPage != null && p > lastPage) || aborted) return;
      if (have.has(p)) continue;
      let done = false; let lastErr = '';
      for (let n = 1; n <= tries && !done; n++) {
        await slot(spacing);
        try {
          const r = await getOnce(spec.url(p), ua, timeoutMs);
          if (r.status === 200) { let cnt = 0; try { cnt = spec.count(r.body); } catch (e) { lastErr = `corpo inválido: ${(e as Error).message}`; await sleep(1500 * n); continue; } const l: Line = { p, s: 200, b: r.body, n: cnt }; await assertCanStore(cfg, r.body.length); await store(l); have.set(p, l); consecutiveFail = 0; if (cnt === 0 && total == null) endPage = Math.min(endPage, p); done = true; }
          else if (r.status === 404 || r.status === 204) { const l: Line = { p, s: r.status, b: '', n: 0 }; await store(l); have.set(p, l); if (total == null) endPage = Math.min(endPage, p); done = true; }
          else lastErr = `HTTP ${r.status}`;
        } catch (e) { lastErr = e instanceof Error ? e.message : String(e); }
        if (!done) await sleep(Math.min(2000 * n, 40_000));
      }
      if (!done) { failed.add(p); consecutiveFail++; await store({ p, s: 0, b: '', n: 0, e: lastErr }); o.log?.(JSON.stringify({ paged: 'falha', rel: spec.rel, page: p, erro: lastErr })); if (total == null && consecutiveFail >= 12) { aborted = true; return; } }
      if (p % 25 === 0) o.log?.(JSON.stringify({ paged: 'progresso', rel: spec.rel, page: p, total: lastPage, items: [...have.values()].reduce((s, x) => s + x.n, 0) }));
    }
  };
  await Promise.all(Array.from({ length: o.concurrency ?? 3 }, worker));
  const end = Number.isFinite(endPage) ? endPage : (lastPage ?? Math.max(...have.keys()));
  const pages = [...have.values()].filter(x => x.p <= end).sort((a, b) => a.p - b.p);
  const missing: number[] = []; for (let p = spec.firstPage; p <= end; p++) if (!have.has(p)) missing.push(p);
  const items = pages.reduce((s, x) => s + x.n, 0); const tmp = `${dest}.tmp`; const gz = createGzip({ level: 6 }); const outS = createWriteStream(tmp); const doneW = pipeline(gz, outS);
  for (const l of pages) gz.write(JSON.stringify({ p: l.p, s: l.s, b: l.b }) + '\n'); gz.end(); await doneW; await rename(tmp, dest);
  const meta: PagedMeta = { rel: spec.rel, pages: pages.length, items, failedPages: missing, aborted, endPage: Number.isFinite(endPage) ? endPage : null, at: new Date().toISOString() };
  await writeFile(metaPath, JSON.stringify(meta)); if (!missing.length && !aborted) await rm(part, { force: true });
  const entry = await registerLocalRaw(cfg, { url: spec.sourceUrl, relPath: spec.rel, competence: spec.competence ?? null, uf: spec.uf ?? 0, retention: 1, dataset: spec.dataset }); if (pool) await recordManifest(pool, entry);
  o.log?.(JSON.stringify({ paged: 'pacote', rel: spec.rel, pages: pages.length, items, falhas: missing.length, abortado: aborted }));
  return { ...meta, reused: false, sha256: entry.sha256 };
}
void createReadStream;
