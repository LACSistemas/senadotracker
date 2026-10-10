import { createHash } from 'node:crypto';
import type { ExternalId, RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

export interface SaplRequestMetrics { requests: number; retries: number; failures: number; latencyMs: number; }
export interface SaplJsonResponse<T = unknown> { data: T; envelope: RawEnvelope; metrics: SaplRequestMetrics; }
export interface SaplClientOptions {
  readonly baseUrl: string;
  readonly house?: string;
  readonly provider?: string;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly delayMs?: number;
  readonly maxBytes?: number;
  readonly userAgent?: string;
}

export class SaplClient {
  readonly baseUrl: URL;
  readonly options: SaplClientOptions;
  readonly metrics: SaplRequestMetrics = { requests: 0, retries: 0, failures: 0, latencyMs: 0 };

  constructor(options: SaplClientOptions) {
    this.baseUrl = new URL(options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`);
    if (this.baseUrl.protocol !== 'https:') throw new Error('SAPL base URL must use HTTPS');
    this.options = options;
  }

  async json<T = unknown>(path: string, params: Readonly<Record<string, string | number | boolean | null>> = {}): Promise<SaplJsonResponse<T>> {
    const url = new URL(path.replace(/^\//, ''), this.baseUrl);
    for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    const attempts = this.options.maxAttempts ?? 3;
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error('maxAttempts must be between 1 and 5');
    const sleep = this.options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.metrics.requests++;
      if (this.options.delayMs) await sleep(this.options.delayMs);
      const started = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30_000);
      try {
        const response = await (this.options.fetch ?? fetch)(url, { headers: { Accept: 'application/json', 'User-Agent': this.options.userAgent ?? 'Civica/0.1 (state-collector)' }, signal: controller.signal, redirect: 'error' });
        const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
        if (reader) while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > (this.options.maxBytes ?? 20_000_000)) throw new Error('SAPL response exceeds maxBytes'); chunks.push(part.value); }
        const bytes = Buffer.concat(chunks); const contentType = response.headers.get('content-type') ?? ''; const hash = createHash('sha256').update(bytes).digest('hex');
        const pathExternalId = externalIdFromPath(path);
        const envelope: RawEnvelope = { house: houseCode(this.options.house ?? 'RO'), provider: providerId(this.options.provider ?? 'sapl'), resource: resourceType(resourceFromPath(path)), endpoint: url.href, params, ...(pathExternalId ? { externalId: pathExternalId } : {}), fetchedAt: new Date().toISOString(), status: response.status, contentType, sha256: hash, rawId: `raw:sha256:${hash}` };
        if (response.status === 429 || response.status >= 500) { if (attempt === attempts) throw new Error(`SAPL HTTP ${response.status}`); this.metrics.retries++; await sleep(retryAfter(response.headers.get('retry-after'), attempt)); continue; }
        if (response.status !== 200) throw new Error(`SAPL HTTP ${response.status}: ${url.pathname}`);
        if (!/json/i.test(contentType)) throw new Error(`SAPL response is not JSON: ${contentType}`);
        let data: unknown; let body: string; try { body = new TextDecoder('utf-8', { fatal: true }).decode(bytes); data = JSON.parse(body); } catch { throw new Error('SAPL response is invalid JSON/UTF-8'); }
        (envelope as { body?: string }).body = body;
        this.metrics.latencyMs += Date.now() - started;
        return { data: data as T, envelope, metrics: { ...this.metrics } };
      } catch (error) {
        this.metrics.failures++;
        if (attempt === attempts) throw error;
        this.metrics.retries++; await sleep(Math.min(10_000, 300 * 2 ** (attempt - 1)));
      } finally { clearTimeout(timer); }
    }
    throw new Error('SAPL request attempts exhausted');
  }

  async page<T = Record<string, unknown>>(path: string, options: { pageSize?: number; maxPages?: number } = {}): Promise<{ records: T[]; envelopes: RawEnvelope[]; metrics: SaplRequestMetrics }> {
    const pageSize = options.pageSize ?? 25; const maxPages = options.maxPages ?? 1; const records: T[] = []; const envelopes: RawEnvelope[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const result = await this.json<unknown>(path, { limit: pageSize, offset: (page - 1) * pageSize, page });
      envelopes.push(result.envelope); const pageRecords = extractRecords<T>(result.data); records.push(...pageRecords);
      if (pageRecords.length < pageSize || !hasNext(result.data)) break;
    }
    return { records, envelopes, metrics: { ...this.metrics } };
  }
}

function extractRecords<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  for (const key of ['results', 'objects', 'data', 'items']) if (Array.isArray(object[key])) return object[key] as T[];
  return [value as T];
}

function hasNext(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>; return Boolean(object.next) || Boolean(object.next_page) || Boolean(object.has_next);
}

function retryAfter(value: string | null, attempt: number): number { const parsed = value && /^\d+$/.test(value) ? Number(value) * 1000 : NaN; return Math.min(30_000, Number.isFinite(parsed) ? Math.max(0, parsed) : 300 * 2 ** (attempt - 1)); }
function resourceFromPath(path: string): string { const value = path.toLowerCase(); if (value.includes('parlamentar')) return value.includes('mandato') || value.includes('filiacao') ? 'mandato' : 'parlamentar'; if (value.includes('autoria')) return 'autoria'; if (value.includes('tramitacao')) return 'tramitacao'; if (value.includes('materia')) return 'materia'; if (value.includes('schema')) return 'schema'; return 'unknown'; }
function externalIdFromPath(path: string): ExternalId | undefined { const match = path.match(/\/(\d+)(?:\/|$)/); return match ? externalId(match[1]!) : undefined; }

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
