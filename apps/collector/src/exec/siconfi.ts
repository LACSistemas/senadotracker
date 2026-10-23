import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import type { Pool } from 'pg';
import { appendSerial } from './http-gate.ts';
import { assertCanStore, assertVolume, fetchRaw, recordManifest, registerLocalRaw, type ManifestEntry, type StorageConfig } from './storage.ts';

/**
 * Coleta RAW do Siconfi (API de dados abertos do Tesouro, apidatalake.tesouro.gov.br): DCA (Anexo I-E, despesa por função/subfunção e estágio) e
 * RREO (Anexo 02, dotação e execução por função/subfunção até o bimestre). Uma chamada por ente; o resultado de uma UF × exercício é gravado
 * verbatim em um pacote JSONL gzip no SSD (raw/siconfi/...), com checkpoint por ente (.part) para retomar sem rebaixar.
 * Nenhum valor é interpretado aqui: resposta vazia é registrada como vazia (≠ zero) e vira cobertura NOT_REPORTED no construtor.
 */
export type Log = (m: string) => void;
const API = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt';
export const SICONFI_USER_AGENT = 'civica-exec/1.0 (pesquisa de dados abertos)';

export interface SiconfiEnte { cod_ibge: number; ente: string; uf: string; esfera: 'M' | 'E' | 'D' | 'U'; populacao: number | null; cnpj: string | null }
/** Lista oficial de entes do Siconfi (5.598): ponte de identidade com o território (cod_ibge = ibge7 do ente). */
export async function fetchEntes(pool: Pool, cfg: StorageConfig): Promise<{ entes: SiconfiEnte[]; entry: ManifestEntry }> {
  const entry = await fetchRaw(cfg, { url: `${API}/entes`, relPath: 'siconfi/entes/entes.json', competence: null, uf: 0, retention: 1, dataset: 'siconfi_entes', dedupeByHash: false, userAgent: SICONFI_USER_AGENT });
  await recordManifest(pool, entry);
  const j = JSON.parse(await readFile(join(cfg.rawDir, entry.relPath), 'utf8')) as { items: Array<Record<string, unknown>> };
  const entes = j.items.map(x => ({ cod_ibge: Number(x.cod_ibge), ente: String(x.ente), uf: String(x.uf), esfera: String(x.esfera) as SiconfiEnte['esfera'], populacao: x.populacao == null ? null : Number(x.populacao), cnpj: x.cnpj ? String(x.cnpj) : null }));
  return { entes, entry };
}

export type Anexo = 'DCA-Anexo I-E' | 'DCA-Anexo I-G' | 'RREO-Anexo 02';
export const bundleKind = (a: Anexo) => a.startsWith('DCA') ? 'dca' : 'rreo';
export function requestUrl(a: Anexo, ente: number, year: number, periodo: number): string {
  if (a.startsWith('DCA')) return `${API}/dca?an_exercicio=${year}&id_ente=${ente}&no_anexo=${encodeURIComponent(a)}`;
  return `${API}/rreo?an_exercicio=${year}&nr_periodo=${periodo}&co_tipo_demonstrativo=RREO&no_anexo=${encodeURIComponent(a)}&id_ente=${ente}`;
}
/** Último bimestre cujo prazo legal de publicação (30 dias após o fim do bimestre) já passou; anos encerrados = 6. */
export function latestBimester(year: number, today = new Date()): number {
  if (year < today.getUTCFullYear()) return 6;
  if (year > today.getUTCFullYear()) return 0;
  let b = 0; for (let i = 1; i <= 6; i++) { const due = Date.UTC(year, i * 2, 1) + 30 * 864e5; if (due <= today.getTime()) b = i; }
  return b;
}
export interface BundleLine { e: number; y: number; a: Anexo; p: number; s: number; n: number; b: string }
export const bundleRel = (a: Anexo, year: number, uf: number, periodo: number) => `siconfi/${bundleKind(a)}/${a.replace(/[^A-Za-z0-9]+/g, '_')}/${year}${a.startsWith('RREO') ? `_b${periodo}` : ''}/uf${String(uf).padStart(2, '0')}.jsonl.gz`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Limitador global (todos os workers e pacotes do processo): espaçamento mínimo entre requisições que dobra em 429/5xx e relaxa após sucessos; 429 também pausa todos. */
const gate = { nextAt: 0, spacing: Number(process.env.SICONFI_MIN_SPACING_MS ?? 150), pauseUntil: 0, ok: 0, hits429: 0 };
const MIN_SPACING = Number(process.env.SICONFI_MIN_SPACING_MS ?? 150);
async function slot(): Promise<void> {
  const now = Date.now(); const at = Math.max(now, gate.nextAt, gate.pauseUntil); gate.nextAt = at + gate.spacing; if (at > now) await sleep(at - now);
}
function throttled(retryAfterSec: number | null, n: number): number {
  gate.hits429++; gate.ok = 0; gate.spacing = Math.min(gate.spacing * 2, 4000);
  const wait = Math.max((retryAfterSec ?? 0) * 1000, Math.min(20_000 * 2 ** Math.min(n, 4), 300_000)); gate.pauseUntil = Math.max(gate.pauseUntil, Date.now() + wait); return wait;
}
async function getText(url: string, tries = 14): Promise<{ status: number; body: string }> {
  let last = '';
  for (let n = 1; n <= tries; n++) {
    await slot();
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 90_000);
      const r = await fetch(url, { headers: { 'User-Agent': SICONFI_USER_AGENT, Accept: 'application/json' }, signal: ctl.signal }); clearTimeout(t);
      if (r.status === 429) { last = 'HTTP 429'; throttled(Number(r.headers.get('retry-after')) || null, n); continue; }
      const body = Buffer.from(await r.arrayBuffer()).toString('utf8');
      if (r.status === 200) { JSON.parse(body); if (++gate.ok % 50 === 0) gate.spacing = Math.max(MIN_SPACING, Math.round(gate.spacing * 0.8)); return { status: 200, body }; }   // corpo truncado/HTML cai no catch e repete
      if (r.status === 404) return { status: 404, body };
      last = `HTTP ${r.status}`; gate.spacing = Math.min(gate.spacing * 1.5, 4000);
    } catch (e) { last = e instanceof Error ? e.message : String(e); }
    await sleep(Math.min(1500 * n, 30_000));
  }
  throw new Error(`Siconfi indisponível após ${tries} tentativas: ${url} (${last})`);
}
export const gateStats = () => ({ spacingMs: gate.spacing, hits429: gate.hits429 });

export interface BundleArgs { anexo: Anexo; year: number; uf: number; entes: number[]; periodo?: number; concurrency?: number; log?: Log }
export interface BundleResult { relPath: string; entry: ManifestEntry; lines: number; empty: number; reused: boolean }
/** Gera (ou reutiliza) o pacote RAW de uma UF × exercício. Retomável: o .part guarda os entes já obtidos. */
export async function fetchBundle(pool: Pool, cfg: StorageConfig, a: BundleArgs): Promise<BundleResult> {
  await assertVolume(cfg);
  const periodo = a.periodo ?? 0; const rel = bundleRel(a.anexo, a.year, a.uf, periodo); const dest = join(cfg.rawDir, rel); const part = `${dest}.part.jsonl`;
  await mkdir(dirname(dest), { recursive: true });
  try {
    const s = await stat(dest); if (s.size > 0) {
      const known = (await (await import('./storage.ts')).readManifest(cfg)).get(rel);
      if (known && known.bytes === s.size) { const c = await countBundle(dest); return { relPath: rel, entry: known, lines: c.lines, empty: c.empty, reused: true }; }
    }
  } catch { /* ainda não existe */ }
  const done = new Set<number>();
  const readPart = async (): Promise<BundleLine[]> => {   // a última linha, truncada por queda do processo, é descartada e refeita
    try { return (await readFile(part, 'utf8')).split('\n').filter(l => l.trim()).flatMap(l => { try { return [JSON.parse(l) as BundleLine]; } catch { return []; } }); } catch { return []; }
  };
  for (const l of await readPart()) done.add(l.e);
  const todo = a.entes.filter(e => !done.has(e)); let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++; if (i >= todo.length) return;
      const e = todo[i]!; const r = await getText(requestUrl(a.anexo, e, a.year, periodo));
      const n = r.status === 200 ? (JSON.parse(r.body) as { items: unknown[] }).items.length : 0;
      const line: BundleLine = { e, y: a.year, a: a.anexo, p: periodo, s: r.status, n, b: r.body };
      await assertCanStore(cfg, r.body.length); await appendSerial(part, JSON.stringify(line) + '\n');
    }
  };
  await Promise.all(Array.from({ length: a.concurrency ?? 3 }, worker));
  // Ordena por ente (determinismo do hash) e comprime.
  const lines = [...new Map((await readPart()).map(l => [l.e, l])).values()].sort((x, y) => x.e - y.e);
  if (lines.length !== a.entes.length) throw new Error(`pacote incompleto ${rel}: ${lines.length}/${a.entes.length} entes`);
  const tmp = `${dest}.tmp`; const gz = createGzip({ level: 6 }); const out = createWriteStream(tmp);
  const done2 = pipeline(gz, out); for (const l of lines) gz.write(JSON.stringify(l) + '\n'); gz.end(); await done2;
  await rename(tmp, dest); await rm(part, { force: true });
  const entry = await registerLocalRaw(cfg, { url: requestUrl(a.anexo, 0, a.year, periodo).replace('id_ente=0', 'id_ente=<ente>'), relPath: rel, competence: a.year * 100 + 12, uf: a.uf, retention: 1, dataset: `siconfi_${bundleKind(a.anexo)}_${a.anexo.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}` });
  await recordManifest(pool, entry);
  a.log?.(JSON.stringify({ siconfi: 'bundle', gate: gateStats(), anexo: a.anexo, year: a.year, uf: a.uf, entes: lines.length, empty: lines.filter(l => l.n === 0).length, bytes: entry.bytes }));
  return { relPath: rel, entry, lines: lines.length, empty: lines.filter(l => l.n === 0).length, reused: false };
}
async function countBundle(path: string): Promise<{ lines: number; empty: number }> {
  let lines = 0, empty = 0; const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) { if (!l.trim()) continue; lines++; if ((JSON.parse(l) as BundleLine).n === 0) empty++; }
  return { lines, empty };
}
/** Lê um pacote RAW (linhas = resposta de um ente). */
export async function* readBundle(cfg: StorageConfig, relPath: string): AsyncGenerator<BundleLine> {
  const rl = createInterface({ input: createReadStream(join(cfg.rawDir, relPath)).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) if (l.trim()) yield JSON.parse(l) as BundleLine;
}
