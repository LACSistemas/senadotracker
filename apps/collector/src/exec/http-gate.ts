/**
 * Limitador de requisições com retomada para APIs públicas que respondem 429/5xx sob carga: espaçamento mínimo global entre requisições que dobra em recusa
 * e relaxa após sucessos; um 429 também pausa todos os workers do processo (respeitando Retry-After). Uma instância por host.
 */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export class HttpGate {
  nextAt = 0; pauseUntil = 0; ok = 0; hits429 = 0; spacing: number;
  constructor(private readonly minSpacingMs: number, private readonly userAgent: string, private readonly maxSpacingMs = 4000, private readonly relaxEvery = 50, private readonly relaxFactor = 0.8) { this.spacing = minSpacingMs; }
  private async slot(): Promise<void> { const now = Date.now(); const at = Math.max(now, this.nextAt, this.pauseUntil); this.nextAt = at + this.spacing; if (at > now) await sleep(at - now); }
  stats() { return { spacingMs: this.spacing, hits429: this.hits429 }; }
  /** GET texto. 404 devolve {status: 404}; qualquer outro erro é repetido (até `tries`) e depois lançado — nunca devolve corpo parcial. */
  async get(url: string, o: { tries?: number; accept?: string; validate?: (body: string) => void } = {}): Promise<{ status: number; body: string }> {
    const tries = o.tries ?? 14; let last = '';
    for (let n = 1; n <= tries; n++) {
      await this.slot();
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 120_000);
        const r = await fetch(url, { headers: { 'User-Agent': this.userAgent, Accept: o.accept ?? 'application/json' }, signal: ctl.signal }); clearTimeout(t);
        if (r.status === 429) { last = 'HTTP 429'; this.hits429++; this.ok = 0; this.spacing = Math.min(this.spacing * 2, this.maxSpacingMs); this.pauseUntil = Math.max(this.pauseUntil, Date.now() + Math.max((Number(r.headers.get('retry-after')) || 0) * 1000, Math.min(20_000 * 2 ** Math.min(n, 4), 300_000))); continue; }
        const body = Buffer.from(await r.arrayBuffer()).toString('utf8');
        if (r.status === 200) { (o.validate ?? ((b: string) => { JSON.parse(b); }))(body); if (++this.ok % this.relaxEvery === 0) this.spacing = Math.max(this.minSpacingMs, Math.round(this.spacing * this.relaxFactor)); return { status: 200, body }; }
        if (r.status === 404 || r.status === 204) return { status: r.status, body };   // 204 = janela sem registros (PNCP): vazio, não erro
        last = `HTTP ${r.status}`; this.spacing = Math.min(this.spacing * 1.5, this.maxSpacingMs);
      } catch (e) { last = e instanceof Error ? e.message : String(e); }
      await sleep(Math.min(1500 * n, 30_000));
    }
    throw new Error(`fonte indisponível após ${tries} tentativas: ${url} (${last})`);
  }
}

import { appendFile } from 'node:fs/promises';
let chain: Promise<void> = Promise.resolve();
/** Anexa texto a um arquivo SERIALIZANDO as escritas do processo: linhas grandes anexadas por workers concorrentes podem se intercalar no Windows e corromper o JSONL. */
export function appendSerial(path: string, text: string): Promise<void> {
  const next = chain.then(() => appendFile(path, text)); chain = next.catch(() => undefined); return next;
}
