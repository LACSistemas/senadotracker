import { join } from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { ymNext, ymRange } from '../../packages/db/src/exec/index.ts';
import { collectPni, collectSihHospital, collectSihResidents, collectVital } from '../../apps/collector/src/exec/epi.ts';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/**
 * Pilotos de epidemiologia e SIH.
 *   vital <UF> <anoIni> <anoFim>        SINASC+SIM → IND-08/11/12
 *   pni <UF|ALL>                            cobertura vacinal (arquivo oficial SIPNIBD)
 *   sih-hosp <UF> <compIni> <compFim>   SIH-RD por hospital
 *   sih-month <compIni> [compFim]       SIH-RD de 27 UFs: hospitais por UF + residentes nacionais (1 decodificação)
 *   sih-resid <competência>             SIH-RD nacional (27 arquivos) → residentes por município e IND-10
 */
const [cmd, a, b, c] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const log = (m: string) => { console.log(m); void appendFile(join(cfg.logsDir, `epi-${cmd}.jsonl`), m + '\n'); };
const pool = openPool(3);
try {
  const t0 = Date.now();
  if (cmd === 'vital') { for (let y = Number(b); y <= Number(c); y++) log(JSON.stringify({ uf: a, year: y, ...(await collectVital(pool, cfg, { uf: a!, year: y })) })); }
  else if (cmd === 'pni') log(JSON.stringify(await collectPni(pool, cfg, { uf: a! })));
  else if (cmd === 'sih-hosp') log(JSON.stringify(await collectSihHospital(pool, cfg, { uf: a!, competences: ymRange(Number(b), Number(c)), log })));
  else if (cmd === 'sih-resid') log(JSON.stringify(await collectSihResidents(pool, cfg, { competence: Number(a), log })));
  else if (cmd === 'sih-month') {   // 27 arquivos de uma competência: hospitais por UF + residentes nacionais, com uma única decodificação
    for (let comp = Number(a); comp <= Number(b ?? a); comp = ymNext(comp)) {
      const done = (await pool.query(`SELECT (SELECT count(*) FROM civica_exec.exec_publication WHERE dataset_id = 10 AND competence = $1)::int h, (SELECT count(*) FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r ON r.run_id = p.run_id WHERE p.dataset_id = 11 AND p.competence = $1 AND r.parser_version = 'sih-resid-v3')::int r`, [comp])).rows[0];
      if (done.h === 27 && done.r === 1 && !process.argv.includes('--force')) { log(JSON.stringify({ competence: comp, skipped: 'já publicado (27 hospitais + residentes)' })); continue; }
      const t1 = Date.now(); const r = await collectSihResidents(pool, cfg, { competence: comp, withHospital: true });
      log(JSON.stringify({ competence: comp, ...r, s: Math.round((Date.now() - t1) / 1000) }));
    }
  }
  else throw new Error('comando desconhecido');
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { await pool.end(); }
