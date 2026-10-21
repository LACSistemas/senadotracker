import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { ymNext, ymRange } from '../../packages/db/src/exec/index.ts';
import { collectCnes, type CnesKind } from '../../apps/collector/src/exec/cnes.ts';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/**
 * Piloto CNES por UF e faixa de competências contíguas (retomável: competências já publicadas são puladas).
 * Uso: node --import tsx scripts/exec/cnes-pilot.ts ES 201301 202609 st,lt,eq [--bootstrap] [--max-comp N]
 * pf: node --import tsx scripts/exec/cnes-pilot.ts ES 202609 202609 pf
 */
const [uf, from, to, kindsArg] = process.argv.slice(2);
const kinds = (kindsArg ?? 'st,lt,eq').split(',') as CnesKind[];
const maxComp = process.argv.includes('--max-comp') ? Number(process.argv[process.argv.indexOf('--max-comp') + 1]) : Infinity;
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const logFile = join(cfg.logsDir, `cnes-${uf}-${from}-${to}.jsonl`);
const pool = openPool(3);
try {
  const datasetOf = { st: 3, lt: 4, eq: 5, pf: 6 } as const;
  const ufCode = (await import('../../apps/collector/src/exec/cnes.ts')).UF_CODE[uf!.toUpperCase()]!;
  let comps = ymRange(Number(from), Number(to));
  // retomada: para cada tipo, só publica competências posteriores à última já publicada (contiguidade dos intervalos)
  const lasts = await Promise.all(kinds.filter(k => k !== 'pf').map(async k => (await pool.query(`SELECT max(competence)::int m FROM civica_exec.exec_publication WHERE dataset_id=$1 AND uf=$2`, [datasetOf[k], ufCode])).rows[0].m as number | null));
  const done = lasts.length && lasts.every(m => m !== null) ? Math.min(...(lasts as number[])) : null;
  if (done !== null) comps = comps.filter(c => c > done);
  comps = comps.slice(0, maxComp);
  if (!comps.length) { console.log('nada a fazer (já publicado)'); process.exit(0); }
  const fresh = lasts.every(m => m === null);
  console.log(`${uf}: ${comps.length} competências (${comps[0]}…${comps.at(-1)}) kinds=${kinds.join(',')} bootstrap=${fresh}`);
  const t0 = Date.now();
  const res = await collectCnes(pool, cfg, { uf: uf!, competences: comps, kinds, bootstrapFirst: fresh || process.argv.includes('--bootstrap'), log: m => { void appendFile(logFile, m + '\n'); } });
  const bytes = res.reduce((n, r) => n + r.bytes, 0);
  console.log(`ok: ${res.length} publicações em ${((Date.now() - t0) / 1000).toFixed(0)}s; ${(bytes / 1048576).toFixed(1)} MiB de RAW; não mapeados: ${res.reduce((n, r) => n + r.unmapped, 0)}; status: ${[...new Set(res.map(r => r.status))].join(',')}`);
  void ymNext;
} finally { await pool.end(); }
