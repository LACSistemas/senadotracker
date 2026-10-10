import { createHash } from 'node:crypto';
import type { RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export interface AlemalegisResponse<T> { readonly data: T; readonly envelope: RawEnvelope }
export interface AlemalegisClientOptions { readonly baseUrl?: string; readonly fetch?: typeof fetch; readonly timeoutMs?: number; readonly maxAttempts?: number; readonly delayMs?: number }
export interface AlemalegisMetrics { requests: number; retries: number; failures: number; latencyMs: number }

export class AlemalegisClient {
  readonly baseUrl: URL;
  readonly metrics: AlemalegisMetrics = { requests: 0, retries: 0, failures: 0, latencyMs: 0 };
  constructor(private readonly options: AlemalegisClientOptions = {}) { this.baseUrl = new URL(options.baseUrl ?? 'https://alemalegis.al.ma.leg.br/api/v1/public'); }
  async get<T = unknown>(path: string, params: Record<string, string | number | null> = {}, resource = 'unknown'): Promise<AlemalegisResponse<T>> {
    const url = new URL(path.replace(/^\//, ''), `${this.baseUrl.toString().replace(/\/$/, '')}/`);
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
    const attempts = this.options.maxAttempts ?? 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.metrics.requests++; const started = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30000);
      try {
        const response = await (this.options.fetch ?? fetch)(url, { headers: { Accept: 'application/json', 'User-Agent': 'Civica/0.1 (state-collector)' }, signal: controller.signal, redirect: 'error' });
        const body = await response.text(); const hash = createHash('sha256').update(body).digest('hex');
        const envelope: RawEnvelope = { house: houseCode('MA'), provider: providerId('alemalegis'), resource: resourceType(resource), endpoint: url.href, params, ...(idFromPath(path) ? { externalId: externalId(idFromPath(path)!) } : {}), fetchedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type') ?? '', sha256: hash, rawId: `raw:sha256:${hash}`, body };
        if (response.status >= 500 || response.status === 429) { if (attempt === attempts) throw new Error(`ALEMALEGIS HTTP ${response.status}`); this.metrics.retries++; continue; }
        if (!response.ok) throw new Error(`ALEMALEGIS HTTP ${response.status}: ${url.pathname}`);
        if (!/json/i.test(envelope.contentType)) throw new Error(`ALEMALEGIS non-JSON response: ${envelope.contentType}`);
        this.metrics.latencyMs += Date.now() - started; return { data: JSON.parse(body) as T, envelope };
      } catch (error) { this.metrics.failures++; if (attempt === attempts) throw error; this.metrics.retries++; }
      finally { clearTimeout(timer); }
    }
    throw new Error('ALEMALEGIS request attempts exhausted');
  }
}
function idFromPath(path: string): string | undefined { const m = path.match(/\/(\d+)(?:$|\?)/); return m?.[1]; }
