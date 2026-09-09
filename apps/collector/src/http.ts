import type { Source } from '@senadotracker/domain';
import type { RawResponse } from './raw.ts';

const bases: Record<Source, string> = { senado: 'https://legis.senado.leg.br/dadosabertos/', camara: 'https://dadosabertos.camara.leg.br/api/v2/' };
export function officialUrl(url: string, source: Source): string {
  const value = new URL(url); const base = new URL(bases[source]);
  if (value.origin !== base.origin || !value.pathname.startsWith(base.pathname) || value.username || value.password || value.hash) throw new Error('URL fora da fonte oficial');
  return value.href;
}
export interface JsonResponse { data: unknown; rawId: string; fetchedAt: string; url: string }
export interface HttpOptions {
  source: Source;
  save: (response: RawResponse) => Promise<string>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
  delayMs?: number;
  maxBytes?: number;
  onAttempt?: () => void;
}
export class OfficialHttp {
  constructor(private readonly options: HttpOptions) {}
  async json(input: string): Promise<JsonResponse> {
    const url = officialUrl(input, this.options.source);
    const sleep = this.options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const attempts = this.options.maxAttempts ?? 3;
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error('Número de tentativas inválido');
    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.options.onAttempt?.();
      await sleep(this.options.delayMs ?? 120);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000);
      let response: Response; let bytes: Uint8Array;
      try {
        response = await (this.options.fetch ?? fetch)(url, { headers: { Accept: 'application/json', 'User-Agent': 'SenadoTracker/0.1 (official-data-research)' }, signal: controller.signal, redirect: 'error' });
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = []; let size = 0;
        if (reader) while (true) {
          const result = await reader.read(); if (result.done) break;
          size += result.value.byteLength;
          if (size > (this.options.maxBytes ?? 10_000_000)) { controller.abort(); throw new Error('Resposta excede limite de tamanho'); }
          chunks.push(result.value);
        }
        bytes = Buffer.concat(chunks);
      } catch (error) {
        if (attempt === attempts) throw new Error(`Falha de rede/timeout após ${attempt} tentativas: ${new URL(url).pathname}`, { cause: error });
        await sleep(Math.min(500 * 2 ** (attempt - 1), 5000));
        continue;
      } finally { clearTimeout(timer); }
      this.options.onAttempt?.();
      const fetchedAt = new Date().toISOString();
      const contentType = response.headers.get('content-type') ?? '';
      const rawId = await this.options.save({ url, fetchedAt, status: response.status, contentType, bytes });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === attempts) throw new Error(`HTTP ${response.status} após ${attempt} tentativas; raw=${rawId}`);
        const header = response.headers.get('retry-after');
        const retryMs = header ? (/^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now()) : NaN;
        await sleep(Math.min(30_000, Math.max(0, Number.isFinite(retryMs) ? retryMs : 500 * 2 ** (attempt - 1) + Math.random() * 100)));
        continue;
      }
      if (response.status !== 200) throw new Error(`HTTP ${response.status}; raw=${rawId}`);
      if (!/^application\/json(?:;|$)/i.test(contentType)) throw new Error(`Resposta não é JSON; raw=${rawId}`);
      let data: unknown;
      try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { throw new Error(`JSON/UTF-8 inválido; raw=${rawId}`); }
      return { data, rawId, fetchedAt, url };
    }
    throw new Error('Tentativas esgotadas');
  }
}
