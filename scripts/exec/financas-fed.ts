import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { FED_FIRST_YEAR, buildOrgs, extractFed, fetchFed, publishFedDot, publishFedExec, type FedExtract, type FedFile } from '../../apps/collector/src/exec/federal.ts';
import { openPool } from './db.ts';

/**
 * Finanças federais (P9.5): execução mensal e orçamento anual do Portal da Transparência. EXEC_DATABASE_URL aponta para banco de teste.
 *   fetch   [ano-ini] [ano-fim]    baixa os CSV zipados para o RAW (SSD) — sem publicar
 *   publish [ano-ini] [ano-fim]    extrai (cache no staging) e publica órgãos + execução + dotação por exercício
 * Mês corrente e exercício corrente são preliminares (arquivo cresce): republicar com `publish` atualiza por hash.
 */
const [cmd, a, b] = process.argv.slice(2);
const now = new Date(); const lastYear = now.getUTCFullYear();
const y0 = Number(a ?? FED_FIRST_YEAR), y1 = Number(b ?? lastYear);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `financas-fed-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
const monthsOf = (y: number) => y < lastYear ? 12 : now.getUTCMonth() + 1;   // o mês corrente já tem arquivo (parcial)
try {
  if (cmd === 'fetch') {
    for (let y = y0; y <= y1; y++) {
      await fetchFed(pool, cfg, 'dot', y, 12, log);
      for (let m = 1; m <= monthsOf(y); m++) { await fetchFed(pool, cfg, 'exec', y, m, log); await new Promise(r => setTimeout(r, 3000)); }
    }
  } else if (cmd === 'publish') {
    const exts: Array<{ year: number; x: FedExtract }> = []; const execFiles = new Map<number, FedFile[]>(); const dotFiles = new Map<number, FedFile>();
    for (let y = y0; y <= y1; y++) {
      dotFiles.set(y, await fetchFed(pool, cfg, 'dot', y, 12)); exts.push({ year: y, x: await extractFed(cfg, dotFiles.get(y)!) });
      const fs: FedFile[] = []; for (let m = 1; m <= monthsOf(y); m++) { const f = await fetchFed(pool, cfg, 'exec', y, m); fs.push(f); exts.push({ year: y, x: await extractFed(cfg, f) }); }
      execFiles.set(y, fs);
    }
    const br = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0].entity_id as number;
    const orgs = buildOrgs(br, exts);
    for (let y = y0; y <= y1; y++) { await publishFedDot(pool, cfg, y, dotFiles.get(y)!, { orgs, log }); await publishFedExec(pool, cfg, y, execFiles.get(y)!, { orgs, log }); }
  } else throw new Error('comando desconhecido');
} finally { await pool.end(); }
