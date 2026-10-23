import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { publishCrimeSource } from '../../apps/collector/src/exec/crime.ts';
import { loadRj } from '../../apps/collector/src/exec/crime-rj.ts';
import { loadEs } from '../../apps/collector/src/exec/crime-es.ts';
import { loadRs } from '../../apps/collector/src/exec/crime-rs.ts';
import { loadMg } from '../../apps/collector/src/exec/crime-mg.ts';
import { loadCe } from '../../apps/collector/src/exec/crime-ce.ts';
import { loadSp } from '../../apps/collector/src/exec/crime-sp.ts';
import { loadPe } from '../../apps/collector/src/exec/crime-pe.ts';
import { CRIME_SOURCE_BY_KEY, applyExecMigrations, seedCrimeDefs } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Criminalidade estadual municipalizada (P9.6). EXEC_DATABASE_URL aponta para banco de teste.
 *   migrate | seed                         migration v8 e definições (indicadores 8001+ + catálogo canônico)
 *   publish <FONTE> [ano1,ano2]            baixa (RAW no SSD, cópia por data deduplicada por hash) e publica a fonte: ISP-RJ | SEJUSP-MG | SESP-ES | SSP-RS | ...
 * Idempotente: mesmo arquivo → NO_CHANGE.
 */
const [cmd, srcKey, yearsArg] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `crime-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
try {
  const t0 = Date.now();
  if (cmd === 'migrate') log(JSON.stringify({ applied: await applyExecMigrations(pool) }));
  else if (cmd === 'seed') log(JSON.stringify({ defs: await seedCrimeDefs(pool) }));
  else if (cmd === 'publish') {
    const src = CRIME_SOURCE_BY_KEY.get(srcKey!); if (!src) throw new Error(`fonte desconhecida: ${srcKey}`);
    const years = yearsArg ? yearsArg.split(',').map(Number) : undefined;
    const loaders: Record<string, () => Promise<import('../../apps/collector/src/exec/crime.ts').CrimeLoaded>> = { 'ISP-RJ': () => loadRj(pool, cfg, log), 'SESP-ES': () => loadEs(pool, cfg, log), 'SSP-RS': () => loadRs(pool, cfg, log), 'SDS-PE': () => loadPe(pool, cfg, log), 'SEJUSP-MG': () => loadMg(pool, cfg, log), 'SSPDS-CE': () => loadCe(pool, cfg, log), 'SSP-SP': () => loadSp(pool, cfg, log, years) };
    const load = loaders[src.key]; if (!load) throw new Error(`adaptador de ${src.key} ainda não implementado`);
    const loaded = await load(); const r = await publishCrimeSource(pool, cfg, src, loaded, { ...(years ? { years } : {}), log });
    log(JSON.stringify({ source: src.key, slices: r.length, byStatus: r.reduce((m: Record<string, number>, x) => (m[x.status] = (m[x.status] ?? 0) + 1, m), {}), reconciliationDiffs: r.reduce((n, x) => n + x.reconciliationDiffs, 0), compositeViolations: r.reduce((n, x) => n + x.compositeViolations, 0) }));
  } else throw new Error('comando desconhecido');
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
