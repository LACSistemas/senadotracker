import { createHash } from 'node:crypto';
import type { ExternalId, RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export interface AlapRequestMetrics { requests: number; retries: number; failures: number; latencyMs: number }
export interface AlapResponse<T> { readonly data: T; readonly envelope: RawEnvelope }
export interface AlapClientOptions { readonly fetch?: typeof fetch; readonly timeoutMs?: number; readonly maxAttempts?: number; readonly delayMs?: number; readonly userAgent?: string }

export const ALAP_LEGISLATIVE_PROVIDER = 'alap_legislative';

export class AlapClient {
  readonly metrics: AlapRequestMetrics = { requests: 0, retries: 0, failures: 0, latencyMs: 0 };
  constructor(private readonly options: AlapClientOptions = {}) {}

  async get<T = string>(url: string, params: Readonly<Record<string, string | number | null>> = {}, resource = 'unknown', external?: string): Promise<AlapResponse<T>> {
    const target = new URL(url);
    for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined) target.searchParams.set(key, String(value));
    const attempts = this.options.maxAttempts ?? 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.metrics.requests++;
      if (this.options.delayMs) await new Promise(resolve => setTimeout(resolve, this.options.delayMs));
      const started = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30_000);
      try {
        const response = await (this.options.fetch ?? fetch)(target, { headers: { Accept: 'text/html,application/json', 'User-Agent': this.options.userAgent ?? 'Civica/0.1 (state-collector)' }, signal: controller.signal, redirect: 'error' });
        const body = await response.text(); const sha256 = createHash('sha256').update(body).digest('hex');
        const envelope: RawEnvelope = { house: houseCode('AP'), provider: providerId(ALAP_LEGISLATIVE_PROVIDER), resource: resourceType(resource), endpoint: target.href, params, ...(external ? { externalId: externalId(external) } : {}), fetchedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type') ?? 'text/html', sha256, rawId: `raw:sha256:${sha256}`, body };
        if (response.status === 429 || response.status >= 500) { if (attempt === attempts) throw new Error(`ALAP HTTP ${response.status}`); this.metrics.retries++; continue; }
        if (!response.ok) throw new Error(`ALAP HTTP ${response.status}: ${target.href}`);
        this.metrics.latencyMs += Date.now() - started;
        return { data: body as T, envelope };
      } catch (error) { this.metrics.failures++; if (attempt === attempts) throw error; this.metrics.retries++; }
      finally { clearTimeout(timer); }
    }
    throw new Error('ALAP request attempts exhausted');
  }
}
