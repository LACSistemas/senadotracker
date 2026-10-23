import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { PNCP_FIRST_YEAR, fetchPncpMonth } from '../../apps/collector/src/exec/pncp.ts';
import { openPool } from './db.ts';

/** Coleta RAW dos contratos do PNCP por mês (P9.5). Uso: node --import tsx scripts/exec/pncp-fetch.ts [ano-ini] [ano-fim] [concorrência]. Retomável; meses fechados já coletados são reutilizados. */
const [a, b, c] = process.argv.slice(2); const now = new Date();
const y0 = Number(a ?? PNCP_FIRST_YEAR), y1 = Number(b ?? now.getUTCFullYear());
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, 'pncp-fetch.jsonl'), m + '\n'); };
const pool = openPool(2);
try {
  for (let y = y0; y <= y1; y++) for (let m = 1; m <= 12; m++) {
    if (y === now.getUTCFullYear() && m > now.getUTCMonth() + 1) break;
    const t0 = Date.now(); const r = await fetchPncpMonth(pool, cfg, y, m, { concurrency: Number(c ?? 3), log });
    log(JSON.stringify({ done: true, year: y, month: m, contracts: r.contracts, pages: r.pages, reused: r.reused, s: Math.round((Date.now() - t0) / 1000) }));
  }
} finally { await pool.end(); }
