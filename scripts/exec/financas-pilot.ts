import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { collectFinancas } from '../../apps/collector/src/exec/financas.ts';
import { applyExecMigrations, seedFinancasDefs } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Finanças da Segurança (P9.5). EXEC_DATABASE_URL aponta para banco de teste (nunca o do Cívica) quando definido.
 *   migrate | seed                    migration v5 (cobertura + tabelas federais) e definições (indicadores 7001–7046)
 *   publish <dca|rreo|dcarp> <anos|a-b> [UF,…|all|BR]   publica pacotes RAW já coletados (scripts/exec/financas-fetch.ts); 'BR' = União; 'all' = 27 UFs + União
 * Idempotente: mesmo pacote RAW + mesma população → NO_CHANGE.
 */
const [cmd, kind, yearsArg, ufArg] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `financas-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
try {
  const t0 = Date.now();
  if (cmd === 'migrate') log(JSON.stringify({ applied: await applyExecMigrations(pool) }));
  else if (cmd === 'seed') log(JSON.stringify({ defs: await seedFinancasDefs(pool) }));
  else if (cmd === 'publish') {
    const years = (yearsArg ?? '').includes('-') ? (() => { const [a, b] = yearsArg!.split('-').map(Number); return Array.from({ length: b! - a! + 1 }, (_, i) => a! + i); })() : (yearsArg ?? '').split(',').map(Number);
    const all = !ufArg || ufArg === 'all'; const ufs = all ? undefined : ufArg!.split(',');
    const r = await collectFinancas(pool, cfg, { kind: kind as 'dca' | 'rreo' | 'dcarp', years, ...(ufs ? { ufs } : {}), includeUniao: all, log });
    const by: Record<string, number> = {}; for (const x of r.results) by[x.status] = (by[x.status] ?? 0) + 1;
    log(JSON.stringify({ slices: r.results.length, byStatus: by, missing: r.missing.length }));
  } else throw new Error('comando desconhecido');
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
