import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { PE_FIRST_YEAR, fetchPe, publishPeYear } from '../../apps/collector/src/exec/tcepe.ts';
import { openPool } from './db.ts';

/** TCE-PE (função 06 do Estado de Pernambuco). Uso: financas-pe.ts <fetch|publish> [ano-ini] [ano-fim]. EXEC_DATABASE_URL aponta para banco de teste. */
const [cmd, a, b] = process.argv.slice(2); const now = new Date().getUTCFullYear();
const y0 = Number(a ?? PE_FIRST_YEAR), y1 = Number(b ?? now);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `financas-pe-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
try { for (let y = y0; y <= y1; y++) { const f = await fetchPe(pool, cfg, y, log); if (cmd === 'publish') await publishPeYear(pool, cfg, f, { log }); } } finally { await pool.end(); }
