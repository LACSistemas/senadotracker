import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { RS_FIRST_YEAR, fetchRs, publishRsAll, type RsFile } from '../../apps/collector/src/exec/tcers.ts';
import { openPool } from './db.ts';

/** TCE-RS (função 06 das prefeituras gaúchas). Uso: financas-rs.ts <fetch|publish> [ano-ini] [ano-fim]. EXEC_DATABASE_URL aponta para banco de teste. */
const [cmd, a, b] = process.argv.slice(2); const now = new Date().getUTCFullYear();
const y0 = Number(a ?? RS_FIRST_YEAR), y1 = Number(b ?? now);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `financas-rs-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
try { const files: RsFile[] = []; for (let y = y0; y <= y1; y++) files.push(await fetchRs(pool, cfg, y, log)); if (cmd === 'publish') await publishRsAll(pool, cfg, files, { log }); } finally { await pool.end(); }
