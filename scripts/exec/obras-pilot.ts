import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { OBRAS_SITUACOES, OBRAS_UFS, collectObrasFinanceira, collectObrasFisica, collectObrasProjetos } from '../../apps/collector/src/exec/educacao-obras.ts';
import { openPool } from './db.ts';

/**
 * Coleta RAW do Obrasgov (P10.7). Só grava em D: (raw/obrasgov) e no manifesto; não escreve fatos no banco.
 *   fisica [simultaneidade]          execução física nacional (~71 mil registros)
 *   financeira [simultaneidade]      execução financeira nacional (empenhos)
 *   projetos [UF,UF|all] [situação,…|all] [partições simultâneas]   projetos por UF × situação
 */
const [cmd, a, b, c] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `obras-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(2);
try {
  if (cmd === 'fisica') log(JSON.stringify(await collectObrasFisica(pool, cfg, { concurrency: Number(a ?? 3), log })));
  else if (cmd === 'financeira') log(JSON.stringify(await collectObrasFinanceira(pool, cfg, { concurrency: Number(a ?? 3), log })));
  else if (cmd === 'projetos') {
    const ufs = !a || a === 'all' ? OBRAS_UFS : a.split(','); const sit = !b || b === 'all' ? OBRAS_SITUACOES : b.split(',');
    for (const r of await collectObrasProjetos(pool, cfg, ufs, sit, { parallel: Number(c ?? 4), log })) log(JSON.stringify({ projetos: r.rel, pages: r.pages, items: r.items, falhas: r.failedPages.length }));
  } else throw new Error('comando desconhecido');
} finally { await pool.end(); }
