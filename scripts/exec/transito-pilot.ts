import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { collectFrota, collectInfracoes, collectPrf, collectRenaest, collectSimTransito, inventoryFrota } from '../../apps/collector/src/exec/transito.ts';
import { applyExecMigrations, seedTransitoDefs } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Trânsito e Segurança Viária (P9.2). EXEC_DATABASE_URL aponta para banco de teste (nunca o do Cívica) quando definido.
 *   migrate | seed
 *   sim <ano> [UF,…] | sim-range <ini> <fim>        SIM trânsito (RAW já preservado; residência por UF e ocorrência nacional)
 *   frota-inventory                                 lista as competências oficiais do Senatran
 *   frota [AAAAMM,…|all] [UF,…]                      frota município × tipo
 *   prf [ano,…|all] [UF,…]                           PRF datatran (agrupado por ocorrência)
 *   renaest [UF,…]                                   RENAEST (pacote cumulativo mais recente; original descartado após agregar)
 *   infr [AAAAMM,…|all] [UF,…]                       infrações por UF de jurisdição
 * Idempotente: mesma fonte + mesma versão de parser → NO_CHANGE.
 */
const [cmd, a, b] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `transito-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
const list = (v?: string) => !v || v === 'all' ? undefined : v.split(',');
try {
  const t0 = Date.now();
  if (cmd === 'migrate') log(JSON.stringify({ applied: await applyExecMigrations(pool) }));
  else if (cmd === 'seed') log(JSON.stringify({ defs: await seedTransitoDefs(pool) }));
  else if (cmd === 'sim') log(JSON.stringify(await collectSimTransito(pool, cfg, { year: Number(a), ufs: list(b), log })));
  else if (cmd === 'sim-range') { for (let y = Number(a); y <= Number(b); y++) log(JSON.stringify(await collectSimTransito(pool, cfg, { year: y, log }))); }
  else if (cmd === 'frota-inventory') { const inv = await inventoryFrota(log); log(JSON.stringify({ meses: inv.length, primeiro: inv[0]?.competence, ultimo: inv.at(-1)?.competence })); }
  else if (cmd === 'frota') { const c = list(a)?.map(Number); log(JSON.stringify((await collectFrota(pool, cfg, { ...(c ? { competences: c } : {}), ufs: list(b), log })).map(r => ({ competence: r.competence, total: r.totalBrasil, reused: r.reused })))); }
  else if (cmd === 'prf') { const y = list(a)?.map(Number); log(JSON.stringify((await collectPrf(pool, cfg, { ...(y ? { years: y } : {}), ufs: list(b), log })).map(r => ({ year: r.year, sinistros: r.sinistrosFile })))); }
  else if (cmd === 'renaest') { const r = await collectRenaest(pool, cfg, { ufs: list(a), log }); log(JSON.stringify({ resource: r.resource.name, sha256: r.sha256, lastMonth: r.lastMonth, years: r.years, discarded: r.discarded })); }
  else if (cmd === 'infr') { const c = list(a)?.map(Number); log(JSON.stringify((await collectInfracoes(pool, cfg, { ...(c ? { competences: c } : {}), ufs: list(b), log })).map(r => ({ competence: r.competence, total: r.total, layout: r.layout })))); }
  else throw new Error('comando desconhecido');
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
