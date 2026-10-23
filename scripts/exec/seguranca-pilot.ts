import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { collectSimSeg, collectVdeYear, fetchVdeYear, seedSeguranca } from '../../apps/collector/src/exec/seguranca.ts';
import { applyExecMigrations } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Criminalidade nacional (P9.1): SIM (RAW já preservado) e Sinesp VDE.
 *   migrate                       aplica as migrations do schema civica_exec (v2 = exec_seg_cov)
 *   seed                          grava as definições de indicadores de Segurança
 *   sim <ano> [UF,UF…]            SIM do ano: residência por UF e, com 27 UFs, ocorrência nacional
 *   sim-range <anoIni> <anoFim>   vários anos
 *   vde-fetch [anoIni] [anoFim]   baixa os XLSX do VDE para o RAW (versionado por hash)
 *   vde <ano> [UF,UF…]            publica o ano do VDE (arquivo já no RAW)
 *   vde-range <anoIni> <anoFim>   baixa e publica vários anos
 * EXEC_DATABASE_URL aponta para um banco de teste (nunca o do Cívica) quando definido.
 */
const [cmd, a, b, c] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `seguranca-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
const ufs = (v?: string) => v ? v.split(',') : undefined;
try {
  const t0 = Date.now();
  if (cmd === 'migrate') log(JSON.stringify({ applied: await applyExecMigrations(pool) }));
  else if (cmd === 'seed') log(JSON.stringify({ defs: await seedSeguranca(pool) }));
  else if (cmd === 'sim') log(JSON.stringify(await collectSimSeg(pool, cfg, { year: Number(a), ufs: ufs(b), log })));
  else if (cmd === 'sim-range') { for (let y = Number(a); y <= Number(b); y++) log(JSON.stringify(await collectSimSeg(pool, cfg, { year: y, log }))); }
  else if (cmd === 'vde-fetch') { for (let y = Number(a ?? 2015); y <= Number(b ?? new Date().getFullYear()); y++) { const f = await fetchVdeYear(pool, cfg, y, log); log(JSON.stringify({ vde: 'fetch', year: y, ok: !!f, reused: f?.reused, sha256: f?.entry.sha256, bytes: f?.entry.bytes, rel: f?.entry.relPath })); } }
  else if (cmd === 'vde') { const f = await fetchVdeYear(pool, cfg, Number(a), log); if (!f) throw new Error(`arquivo VDE ${a} indisponível`); log(JSON.stringify(await collectVdeYear(pool, cfg, f, { log, ufs: ufs(b) }))); void c; }
  else if (cmd === 'vde-range') { for (let y = Number(a); y <= Number(b); y++) { const f = await fetchVdeYear(pool, cfg, y, log); if (!f) { log(JSON.stringify({ vde: y, skipped: 'arquivo indisponível' })); continue; } log(JSON.stringify(await collectVdeYear(pool, cfg, f, { log }))); } }
  else throw new Error('comando desconhecido');
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
