import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { collectCnes, UF_CODE } from '../../apps/collector/src/exec/cnes.ts';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/**
 * CNES-PF (profissionais, agregados por município × grupo de CBO). Calendário aprovado: snapshot de dezembro de cada ano + a última competência.
 * Cada snapshot é uma fatia independente (sem contiguidade). Uso: node --import tsx scripts/exec/cnes-pf.ts <UF[,UF..]|ALL> <anoIni> <anoFim> [<últimaCompetência>]
 */
const [ufArg, y1, y2, last] = process.argv.slice(2);
const cfg = storageConfig(); await mkdir(cfg.logsDir, { recursive: true });
const ufs = ufArg === 'ALL' ? Object.keys(UF_CODE) : ufArg!.split(',');
const comps = [...Array.from({ length: Number(y2) - Number(y1) + 1 }, (_, i) => (Number(y1) + i) * 100 + 12), ...(last ? [Number(last)] : [])];
const pool = openPool(3);
try {
  for (const uf of ufs) {
    const dsId = 6; const ufCode = UF_CODE[uf]!;
    const done = new Set((await pool.query(`SELECT competence FROM civica_exec.exec_publication WHERE dataset_id=$1 AND uf=$2`, [dsId, ufCode])).rows.map(r => Number(r.competence)));
    for (const c of comps) {
      if (done.has(c)) continue;
      const r = await collectCnes(pool, cfg, { uf, competences: [c], kinds: ['pf'], bootstrapFirst: true, log: m => { void appendFile(join(cfg.logsDir, 'cnes-pf.jsonl'), m + '\n'); } });
      console.log(JSON.stringify(r.map(x => ({ uf, c, status: x.status, rows: x.rowsOut, mb: +(x.bytes / 1048576).toFixed(1), s: +(x.ms / 1000).toFixed(1) }))));
    }
  }
} finally { await pool.end(); }
