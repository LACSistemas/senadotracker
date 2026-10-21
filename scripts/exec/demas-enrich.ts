import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { enrichDemas } from '../../apps/collector/src/exec/demas.ts';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/** Uso: node --import tsx scripts/exec/demas-enrich.ts <tpUnid[,tpUnid]> [--max-pages N]  (tipos institucionais: 5 hospital geral, 7 hospital especializado, 2 posto/UBS conforme a tabela de tipos). */
const types = process.argv[2]!.split(',').map(Number);
const maxPages = process.argv.includes('--max-pages') ? Number(process.argv[process.argv.indexOf('--max-pages') + 1]) : undefined;
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const pool = openPool(2);
try {
  for (const t of types) {
    const r = await enrichDemas(pool, cfg, { tpUnid: t, ...(maxPages ? { maxPages } : {}), log: m => console.log(m) });
    console.log(JSON.stringify(r));
    await appendFile(join(cfg.logsDir, 'demas.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...r }) + '\n');
  }
} finally { await pool.end(); }
