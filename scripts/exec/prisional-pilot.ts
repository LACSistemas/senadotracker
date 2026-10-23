import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { PRI_CYCLES, collectPrisional, loadAllCycles, resolveAll, seedPrisional } from '../../apps/collector/src/exec/prisional.ts';
import { applyExecMigrations } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Sistema prisional (P9.4, SISDEPEN). EXEC_DATABASE_URL aponta para banco de teste (nunca o do Cívica) quando definido.
 *   migrate | seed        migration v4 (6 tabelas) e definições (indicadores 6001–6143 + catálogo de medidas)
 *   fetch                 baixa/valida os 19 ciclos para o RAW (SSD) e confere o layout, sem publicar
 *   identity              resolve a identidade histórica e imprime estatísticas
 *   publish [c1,c2|all] [UF,…|all]   publica ciclos (padrão: todos) × UFs (padrão: 27) + fatia nacional
 * Idempotente: mesmo arquivo + mesmas atribuições → NO_CHANGE.
 */
const [cmd, a, b] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `prisional-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3); const list = (v?: string) => !v || v === 'all' ? undefined : v.split(',');
try {
  const t0 = Date.now();
  if (cmd === 'migrate') log(JSON.stringify({ applied: await applyExecMigrations(pool) }));
  else if (cmd === 'seed') log(JSON.stringify({ defs: await seedPrisional(pool) }));
  else if (cmd === 'fetch') { const l = await loadAllCycles(pool, cfg, { log }); log(JSON.stringify({ cycles: l.length, rows: l.map(x => x.checked.rows.length) })); }
  else if (cmd === 'identity') { const l = await loadAllCycles(pool, cfg); const r = resolveAll(l); log(JSON.stringify({ units: r.units.size, stats: [...r.stats.entries()] })); }
  else if (cmd === 'publish') { const c = list(a)?.map(Number); const r = await collectPrisional(pool, cfg, { ...(c ? { cycles: c } : {}), ufs: list(b), log }); log(JSON.stringify({ slices: r.results.length, national: r.national.length, units: r.resolved.units.size })); }
  else throw new Error('comando desconhecido');
  void PRI_CYCLES; console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
