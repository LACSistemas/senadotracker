import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { collectEstadic, collectFbsp, collectMunic, collectSiape, fetchEfetivosSource, seedEfetivos } from '../../apps/collector/src/exec/efetivos.ts';
import { applyExecMigrations } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Efetivos e estrutura institucional (P9.3). EXEC_DATABASE_URL aponta para banco de teste (nunca o do Cívica) quando definido.
 *   migrate | seed                 (a P9.3 não cria tabelas; migrate só confere que o schema está na versão corrente)
 *   fetch                          baixa/valida as 3 fontes para o RAW (SSD) sem publicar
 *   fbsp                           Raio-X FBSP 2026 (dados de 2025): fatia nacional
 *   estadic [2019|2023|all]        ESTADIC: fatia nacional (27 UFs) por edição (padrão: todas)
 *   munic [UF,…] [2019|2023|all]   MUNIC: uma fatia por UF (5.570 municípios) por edição (padrão: todas)
 *   siape <AAAAMM,…>               SIAPE: contagem agregada de vínculos de PF e PRF (original com dado pessoal é descartado)
 *   all                            fbsp + estadic + munic
 * Idempotente: mesma fonte + mesma versão de parser → NO_CHANGE.
 */
const [cmd, a, b] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `efetivos-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
const list = (v?: string) => !v || v === 'all' ? undefined : v.split(',');
const eds = (mode: 'estadic' | 'munic', y?: string): Array<'estadic2019' | 'estadic2023' | 'munic2019' | 'munic2023'> => !y || y === 'all' ? [`${mode}2019`, `${mode}2023`] as never : [`${mode}${y}`] as never;
try {
  const t0 = Date.now();
  if (cmd === 'migrate') log(JSON.stringify({ applied: await applyExecMigrations(pool) }));
  else if (cmd === 'seed') log(JSON.stringify({ defs: await seedEfetivos(pool) }));
  else if (cmd === 'fetch') for (const k of ['fbsp', 'estadic2019', 'estadic2023', 'munic2019', 'munic2023'] as const) await fetchEfetivosSource(pool, cfg, k, log);
  else if (cmd === 'fbsp') await collectFbsp(pool, cfg, { log });
  else if (cmd === 'estadic') for (const e of eds('estadic', a)) await collectEstadic(pool, cfg, { edition: e, log });
  else if (cmd === 'munic') for (const e of eds('munic', b)) await collectMunic(pool, cfg, { edition: e, ufs: list(a), log });
  else if (cmd === 'siape') await collectSiape(pool, cfg, { months: (a ?? '').split(',').map(Number).filter(Boolean), log });
  else if (cmd === 'all') { await collectFbsp(pool, cfg, { log }); for (const e of eds('estadic')) await collectEstadic(pool, cfg, { edition: e, log }); for (const e of eds('munic')) await collectMunic(pool, cfg, { edition: e, log }); }
  else throw new Error('comando desconhecido');
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
