import { createHash } from 'node:crypto';
import type { ExternalId, RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export interface AlepRequestMetrics { requests: number; retries: number; failures: number; latencyMs: number; }
export interface AlepResponse<T> { readonly data: T; readonly envelope: RawEnvelope; readonly metrics: AlepRequestMetrics; }
export interface AlepClientOptions { readonly baseUrl: string; readonly fetch?: typeof fetch; readonly sleep?: (ms: number) => Promise<void>; readonly timeoutMs?: number; readonly maxAttempts?: number; readonly delayMs?: number; readonly maxBytes?: number; readonly userAgent?: string; }

export class AlepClient {
  readonly baseUrl: URL;
  readonly options: AlepClientOptions;
  readonly metrics: AlepRequestMetrics = { requests: 0, retries: 0, failures: 0, latencyMs: 0 };

  constructor(options: AlepClientOptions) {
    this.baseUrl = new URL(options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`);
    if (!['http:', 'https:'].includes(this.baseUrl.protocol)) throw new Error('ALEP base URL must use HTTP or HTTPS');
    this.options = options;
  }

  async json<T = unknown>(path: string, params: Readonly<Record<string, string | number | boolean | null>> = {}, method: 'GET' | 'POST' = 'GET'): Promise<AlepResponse<T>> {
    const url = new URL(path.replace(/^\//, ''), this.baseUrl);
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': this.options.userAgent ?? 'Civica/0.1 (state-collector)' };
    let body: string | undefined;
    if (method === 'GET') {
      for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    } else {
      headers['Content-Type'] = 'application/json'; body = JSON.stringify(params);
    }
    const attempts = this.options.maxAttempts ?? 3;
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error('maxAttempts must be between 1 and 5');
    const sleep = this.options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.metrics.requests++;
      if (this.options.delayMs) await sleep(this.options.delayMs);
      const started = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30_000);
      try {
        const response = await (this.options.fetch ?? fetch)(url, { method, headers, ...(body ? { body } : {}), signal: controller.signal, redirect: 'error' });
        const bytes = await readBody(response, this.options.maxBytes ?? 20_000_000);
        const contentType = response.headers.get('content-type') ?? ''; const hash = createHash('sha256').update(bytes).digest('hex');
        const pathExternalId = externalIdFromPath(path);
        const envelope: RawEnvelope = { house: houseCode('PR'), provider: providerId('alep_api'), resource: resourceType(resourceFromPath(path)), endpoint: url.href, params, ...(pathExternalId ? { externalId: pathExternalId } : {}), fetchedAt: new Date().toISOString(), status: response.status, contentType, sha256: hash, rawId: `raw:sha256:${hash}`, body: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
        if (response.status === 429 || response.status >= 500) { if (attempt === attempts) throw new Error(`ALEP HTTP ${response.status}`); this.metrics.retries++; await sleep(retryAfter(response.headers.get('retry-after'), attempt)); continue; }
        if (response.status !== 200) throw new Error(`ALEP HTTP ${response.status}: ${url.pathname}`);
        if (!/json/i.test(contentType)) throw new Error(`ALEP response is not JSON: ${contentType}`);
        let data: unknown; try { data = JSON.parse(envelope.body!); } catch { throw new Error('ALEP response is invalid JSON'); }
        this.metrics.latencyMs += Date.now() - started;
        return { data: data as T, envelope, metrics: { ...this.metrics } };
      } catch (error) {
        this.metrics.failures++;
        if (attempt === attempts) throw error;
        this.metrics.retries++; await sleep(Math.min(10_000, 300 * 2 ** (attempt - 1)));
      } finally { clearTimeout(timer); }
    }
    throw new Error('ALEP request attempts exhausted');
  }

  async filter(params: Readonly<Record<string, string | number | boolean | null>>): Promise<AlepResponse<unknown>> { return this.json('/proposicao/filtrar', params, 'POST'); }
}

async function readBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new TextEncoder().encode(await response.text());
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maxBytes) throw new Error('ALEP response exceeds maxBytes'); chunks.push(part.value); }
  return Buffer.concat(chunks);
}

function resourceFromPath(path: string): string { const value = path.toLowerCase(); if (value.includes('campos')) return 'proposicao_campos'; if (value.includes('filtrar')) return 'proposicao_lista'; if (value.includes('proposicao/')) return 'proposicao'; return 'unknown'; }
function externalIdFromPath(path: string): ExternalId | undefined { const match = path.match(/\/([0-9]+)(?:\/|$)/); return match ? externalId(match[1]!) : undefined; }
function retryAfter(value: string | null, attempt: number): number { const parsed = value && /^\d+$/.test(value) ? Number(value) * 1000 : NaN; return Math.min(30_000, Number.isFinite(parsed) ? Math.max(0, parsed) : 300 * 2 ** (attempt - 1)); }
