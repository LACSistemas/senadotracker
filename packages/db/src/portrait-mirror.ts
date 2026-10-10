import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Pool } from 'pg';

/**
 * Espelho local dos retratos oficiais. A página nunca deve depender de o site da Câmara, do Senado ou de uma Assembleia estar no ar
 * naquele instante: o retrato é baixado uma vez (e rebuscado só se a fonte mudar), reduzido e servido do nosso disco.
 * O nome do arquivo deriva só da URL de origem (sha256), então servir não exige consulta ao banco; a tabela guarda o estado de atualização.
 */
export const PORTRAIT_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  'al.ap.leg.br', 'al.ms.gov.br', 'alepa.quartertec.com.br', 'aleselegis.al.se.leg.br',
  'www3.al.sp.gov.br', 'saba.al.go.leg.br', 'sapl.al.ac.leg.br', 'sapl.al.al.leg.br',
  'sapl.al.am.leg.br', 'sapl.al.mt.leg.br', 'sapl.al.pb.leg.br', 'sapl.al.pi.leg.br', 'sapl.al.ro.leg.br',
  'sapl.al.rr.leg.br', 'sapl.al.to.leg.br', 'sapl3.al.pb.leg.br', 'storage.al.mt.gov.br',
  'storage2.assembleia.pr.leg.br', 'ww2.al.rs.gov.br', 'www.al.ba.gov.br', 'www.al.ce.gov.br',
  'www.al.ma.leg.br', 'www.al.rn.leg.br', 'www.al.to.leg.br', 'www.alepe.pe.gov.br', 'www.alerj.rj.gov.br',
  'www.alesc.sc.gov.br', 'www.almg.gov.br', 'www.cl.df.gov.br', 'www3.al.es.gov.br',
  // Congresso Nacional: o Senado redireciona http→https e depois para legis.senado.leg.br; cada salto é revalidado.
  'www.camara.leg.br', 'www.senado.leg.br', 'legis.senado.leg.br',
]);
/**
 * Endereço canônico do retrato. A ALESP serve as fotos em www3.al.sp.gov.br/legis/ (é o que o próprio portal usa); o cadastro antigo
 * guardou o caminho sob o host da API (legis-api-portal-prd…), que responde 404. Normalizar aqui conserta o cadastro já publicado.
 */
export function canonicalPortraitUrl(url: string): string {
  try { const parsed = new URL(url); if (parsed.hostname.toLowerCase() === 'legis-api-portal-prd.al.sp.gov.br' && parsed.pathname.startsWith('/biografia/fotos/')) return `https://www3.al.sp.gov.br/legis${parsed.pathname}${parsed.search}`; } catch { /* mantém o valor original */ }
  return url;
}
export const isPortraitUrlAllowed = (url: URL) => ['http:', 'https:'].includes(url.protocol) && PORTRAIT_ALLOWED_HOSTS.has(url.hostname.toLowerCase());

const MAX_REDIRECTS = 3, MAX_BYTES = 30 * 1024 * 1024, OUTPUT_WIDTH = 480;
const USER_AGENT = 'Civica/0.1 (official-data-research; portrait-mirror)';
export type PortraitExt = 'webp' | 'jpg' | 'png' | 'gif';
export const PORTRAIT_EXTS: readonly PortraitExt[] = ['webp', 'jpg', 'png', 'gif'];
export const PORTRAIT_CONTENT_TYPE: Record<PortraitExt, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };

/** Raiz do repositório (onde `data/` é ignorado pelo git). `PORTRAIT_DIR` tem precedência. */
export function portraitDirectory(): string {
  if (process.env.PORTRAIT_DIR) return resolve(process.env.PORTRAIT_DIR);
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth++) {
    const manifest = join(dir, 'package.json');
    if (existsSync(/* turbopackIgnore: true */ manifest)) { try { if (JSON.parse(readFileSync(/* turbopackIgnore: true */ manifest, 'utf8')).workspaces) return join(dir, 'data', 'portraits'); } catch { /* manifesto ilegível: continua subindo */ } }
    const parent = dirname(dir); if (parent === dir) break; dir = parent;
  }
  return join(process.cwd(), 'data', 'portraits');
}
export const portraitKey = (url: string) => createHash('sha256').update(url).digest('hex').slice(0, 32);
export const portraitPath = (dir: string, url: string, ext: PortraitExt) => { const key = portraitKey(url); return join(/* turbopackIgnore: true */ dir, key.slice(0, 2), `${key}.${ext}`); };

export function sniffImage(bytes: Uint8Array): PortraitExt | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'webp';
  return null;
}

export type FetchLike = (input: URL, init: { redirect: 'manual'; signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>;
/** Segue redirecionamentos só entre hosts da lista (evita SSRF por redirect aberto). */
export async function fetchPortraitFollowingRedirects(start: URL, headers: Record<string, string> = {}, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<Response> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'user-agent': USER_AGENT, accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8', ...headers } });
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = response.headers.get('location'); if (!location) return response;
      const next = new URL(location, current); if (!isPortraitUrlAllowed(next)) return new Response(null, { status: 403 });
      current = next; continue;
    }
    return response;
  }
  return new Response(null, { status: 508 });
}

export const PORTRAIT_SCHEMA_SQL = [
  `CREATE SCHEMA IF NOT EXISTS civica_media`,
  `CREATE TABLE IF NOT EXISTS civica_media.portraits (source_url text PRIMARY KEY, key text NOT NULL, file_ext text, sha256 text, bytes integer, width integer, height integer, etag text, last_modified text, status text NOT NULL, fetched_at timestamptz, checked_at timestamptz NOT NULL DEFAULT now(), failures integer NOT NULL DEFAULT 0, last_error text)`,
];
export async function ensurePortraitSchema(pool: Pick<Pool, 'query'>) { for (const sql of PORTRAIT_SCHEMA_SQL) await pool.query(sql); }

export type MirrorStatus = 'stored' | 'not_modified' | 'failed' | 'skipped';
export interface MirrorOptions { dir?: string; fetchImpl?: FetchLike; force?: boolean; now?: () => Date }

async function resizeIfPossible(bytes: Buffer): Promise<{ bytes: Buffer; ext: PortraitExt; width: number | null; height: number | null } | null> {
  const sniffed = sniffImage(bytes); if (!sniffed) return null;
  try {
    const { default: sharp } = await import('sharp');
    const out = await sharp(bytes).rotate().resize({ width: OUTPUT_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    return { bytes: out.data, ext: 'webp', width: out.info.width, height: out.info.height };
  } catch { return { bytes, ext: sniffed, width: null, height: null }; } // sem sharp: guarda o original (continua local e estável)
}

/** Baixa (com requisição condicional), reduz e grava um retrato. Nunca apaga a última foto boa quando a fonte falha. */
export async function mirrorPortrait(pool: Pick<Pool, 'query'>, sourceUrl: string, options: MirrorOptions = {}): Promise<{ status: MirrorStatus; error?: string }> {
  sourceUrl = canonicalPortraitUrl(sourceUrl);
  let target: URL; try { target = new URL(sourceUrl); } catch { return { status: 'skipped', error: 'url inválida' }; }
  if (!isPortraitUrlAllowed(target)) return { status: 'skipped', error: 'host fora da lista' };
  const dir = options.dir ?? portraitDirectory(), key = portraitKey(sourceUrl), now = (options.now ?? (() => new Date()))().toISOString();
  await ensurePortraitSchema(pool);
  const prior = (await pool.query<{ file_ext: PortraitExt | null; etag: string | null; last_modified: string | null; failures: number }>(`SELECT file_ext, etag, last_modified, failures FROM civica_media.portraits WHERE source_url=$1`, [sourceUrl])).rows[0];
  const havePrior = Boolean(prior?.file_ext && existsSync(/* turbopackIgnore: true */ portraitPath(dir, sourceUrl, prior.file_ext)));
  const conditional: Record<string, string> = {}; if (havePrior && !options.force) { if (prior!.etag) conditional['if-none-match'] = prior!.etag; if (prior!.last_modified) conditional['if-modified-since'] = prior!.last_modified; }
  const fail = async (error: string) => { await pool.query(`INSERT INTO civica_media.portraits(source_url,key,status,checked_at,failures,last_error) VALUES($1,$2,'failed',$3,1,$4) ON CONFLICT(source_url) DO UPDATE SET status=CASE WHEN civica_media.portraits.file_ext IS NULL THEN 'failed' ELSE 'stale' END, checked_at=$3, failures=civica_media.portraits.failures+1, last_error=$4`, [sourceUrl, key, now, error]); return { status: 'failed' as const, error }; };
  try {
    const response = await fetchPortraitFollowingRedirects(target, conditional, options.fetchImpl);
    if (response.status === 304 && havePrior) { await pool.query(`UPDATE civica_media.portraits SET checked_at=$2, status='ok', failures=0, last_error=NULL WHERE source_url=$1`, [sourceUrl, now]); return { status: 'not_modified' }; }
    if (!response.ok) return await fail(`HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length') ?? 0); if (declared > MAX_BYTES) return await fail('imagem grande demais');
    const raw = Buffer.from(await response.arrayBuffer()); if (raw.length === 0 || raw.length > MAX_BYTES) return await fail('corpo vazio ou grande demais');
    const processed = await resizeIfPossible(raw); if (!processed) return await fail('conteúdo não é uma imagem reconhecida');
    const file = portraitPath(dir, sourceUrl, processed.ext); await mkdir(/* turbopackIgnore: true */ dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`; await writeFile(/* turbopackIgnore: true */ tmp, processed.bytes); await rename(/* turbopackIgnore: true */ tmp, /* turbopackIgnore: true */ file);
    if (prior?.file_ext && prior.file_ext !== processed.ext) await rm(/* turbopackIgnore: true */ portraitPath(dir, sourceUrl, prior.file_ext), { force: true });
    const sha = createHash('sha256').update(processed.bytes).digest('hex');
    await pool.query(`INSERT INTO civica_media.portraits(source_url,key,file_ext,sha256,bytes,width,height,etag,last_modified,status,fetched_at,checked_at,failures,last_error) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'ok',$10,$10,0,NULL) ON CONFLICT(source_url) DO UPDATE SET key=excluded.key,file_ext=excluded.file_ext,sha256=excluded.sha256,bytes=excluded.bytes,width=excluded.width,height=excluded.height,etag=excluded.etag,last_modified=excluded.last_modified,status='ok',fetched_at=excluded.fetched_at,checked_at=excluded.checked_at,failures=0,last_error=NULL`, [sourceUrl, key, processed.ext, sha, processed.bytes.length, processed.width, processed.height, response.headers.get('etag'), response.headers.get('last-modified'), now]);
    return { status: 'stored' };
  } catch (error) { return await fail(error instanceof Error ? error.message : String(error)); }
}

/** Retratos em uso: parlamentares federais (qualquer lote publicado) e o cadastro corrente de cada Assembleia. Só hosts permitidos. */
export async function listPortraitSources(pool: Pick<Pool, 'query'>): Promise<string[]> {
  const urls = new Set<string>();
  const add = (value: unknown) => { if (typeof value !== 'string') return; const canonical = canonicalPortraitUrl(value); try { if (isPortraitUrlAllowed(new URL(canonical))) urls.add(canonical); } catch { /* ignora valor que não é URL */ } };
  try { for (const row of (await pool.query<{ url: string }>(`SELECT DISTINCT payload->>'photoUrl' AS url FROM civica.profiles WHERE payload->>'photoUrl' IS NOT NULL`)).rows) add(row.url); } catch (error) { if ((error as { code?: string }).code !== '42P01') throw error; }
  try { for (const row of (await pool.query<{ url: string }>(`SELECT DISTINCT m.photo_url AS url FROM civica_state.current_state_parliamentarians c JOIN LATERAL (SELECT photo_url FROM civica_state.state_profile_metadata WHERE house=c.house AND external_id=c.external_id ORDER BY observed_at DESC NULLS LAST LIMIT 1) m ON true WHERE m.photo_url IS NOT NULL`)).rows) add(row.url); } catch (error) { if ((error as { code?: string }).code !== '42P01') throw error; }
  return [...urls].sort();
}

export interface MirrorBatchResult { considered: number; stored: number; notModified: number; failed: number; skipped: number; errors: Array<{ url: string; error: string }> }
/** Baixa o que falta e revalida o que ficou velho (padrão 7 dias; falhas só voltam depois de 6 h e até 5 tentativas). */
export async function mirrorPendingPortraits(pool: Pick<Pool, 'query'>, options: MirrorOptions & { limit?: number; concurrency?: number; staleDays?: number; allSources?: string[] } = {}): Promise<MirrorBatchResult> {
  await ensurePortraitSchema(pool);
  const sources = options.allSources ?? await listPortraitSources(pool);
  const rows = (await pool.query<{ source_url: string; status: string; checked_at: Date; failures: number }>(`SELECT source_url, status, checked_at, failures FROM civica_media.portraits`)).rows;
  const known = new Map(rows.map(row => [row.source_url, row])), nowMs = (options.now ?? (() => new Date()))().getTime(), staleMs = (options.staleDays ?? 7) * 86_400_000;
  const pending = sources.filter(url => { const row = known.get(url); if (!row) return true; const age = nowMs - new Date(row.checked_at).getTime(); if (row.status === 'ok') return age > staleMs; return row.failures < 5 && age > 6 * 3_600_000; }).slice(0, options.limit ?? sources.length);
  const result: MirrorBatchResult = { considered: pending.length, stored: 0, notModified: 0, failed: 0, skipped: 0, errors: [] };
  let next = 0; const lastByHost = new Map<string, number>();
  const worker = async () => {
    while (next < pending.length) {
      const url = pending[next++]!, host = new URL(url).hostname, wait = (lastByHost.get(host) ?? 0) + 120 - Date.now(); lastByHost.set(host, Date.now() + Math.max(0, wait));
      if (wait > 0) await new Promise(done => setTimeout(done, wait));
      const outcome = await mirrorPortrait(pool, url, options);
      if (outcome.status === 'stored') result.stored++; else if (outcome.status === 'not_modified') result.notModified++; else if (outcome.status === 'skipped') result.skipped++; else { result.failed++; result.errors.push({ url, error: outcome.error ?? 'falha' }); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 4) }, worker));
  return result;
}
