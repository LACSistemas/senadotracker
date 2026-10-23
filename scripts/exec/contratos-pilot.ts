import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { fetchSiconv, publishPncpYear, publishTransfers } from '../../apps/collector/src/exec/contratos.ts';
import { openPool } from './db.ts';

/**
 * Contratos do PNCP e transferências do MJSP (P9.5). EXEC_DATABASE_URL aponta para banco de teste.
 *   pncp <ano-ini> [ano-fim]    classifica e publica os pacotes mensais já coletados (scripts/exec/pncp-fetch.ts); ano passado só com os 12 meses
 *   transfers                   baixa siconv_proposta/convenio para o RAW e publica as fatias UF × ano
 */
const [cmd, a, b] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `contratos-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
try {
  if (cmd === 'pncp') { for (let y = Number(a); y <= Number(b ?? a); y++) { const r = await publishPncpYear(pool, cfg, y, { log }); log(JSON.stringify({ year: y, status: r.status, slices: r.slices, kept: r.kept, stats: 'stats' in r ? r.stats : null })); } }
  else if (cmd === 'transfers') { const f = await fetchSiconv(pool, cfg, log); const r = await publishTransfers(pool, cfg, f, { log }); log(JSON.stringify({ slices: r.results.length, stats: r.stats })); }
  else throw new Error('comando desconhecido');
} finally { await pool.end(); }
