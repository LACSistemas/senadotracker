import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Pool } from 'pg';
import { openPool } from './db.ts';
import { ENEM_MIN_CELL, reconcileEnemNational, suppressCell } from '../../packages/db/src/exec/educacao-enem-build.ts';

/**
 * P11.6 — ENEM: orquestra o extrator Python (streaming, agregados por município-da-escola/UF/Brasil x rede x
 * disciplina) e carrega o resultado. Só marca `published` quando reconcilia exatamente com a Sinopse do Inep;
 * caso contrário mantém a última revisão boa (nunca publica um agregado não reconciliado).
 */
const ROOT = process.env.CIVICA_EXEC_ROOT ?? 'D:/Civica';
const RAW = `${ROOT}/raw/inep/enem`;
const STAGING = `${ROOT}/staging/educacao`;
const PV = 'p11.6.1';
const EDITIONS = (process.argv.find(x => x.startsWith('--editions='))?.split('=')[1] ?? '2023,2024,2025').split(',').map(Number);
const SINOPSE_URL = 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem';

const INNER: Record<number, string> = {
  2023: 'microdados_enem_2023/DADOS/MICRODADOS_ENEM_2023.csv',
  2024: 'microdados_enem_2024/DADOS/RESULTADOS_2024.csv',
  2025: 'microdados_enem_2025/DADOS/RESULTADOS_2025.csv',
};
/** Reconciliação oficial do P11.1 (Sinopses Estatísticas do Enem, tabelas 1.1, 1.2, 7.4.1, 7.5.1), replicada aqui para nunca publicar sem o alvo. */
const SINOPSE: Record<number, { registrants: number; allFourPresent: number; mathValid: number; essayValid: number }> = {
  2023: { registrants: 3_933_955, allFourPresent: 2_678_264, mathValid: 2_692_427, essayValid: 2_704_814 },
  2024: { registrants: 4_332_944, allFourPresent: 2_990_093, mathValid: 3_004_981, essayValid: 3_002_710 },
  2025: { registrants: 4_810_772, allFourPresent: 3_244_348, mathValid: 3_260_336, essayValid: 3_245_696 },
};

async function digest(path: string) { const h = createHash('sha256'); for await (const b of createReadStream(path)) h.update(b); return { sha: h.digest('hex'), bytes: (await stat(path)).size }; }
async function insertMany(pool: Pool, sql: string, rows: unknown[][], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size); const args: unknown[] = []; let p = 1;
    const values = chunk.map(r => `(${r.map(() => `$${p++}`).join(',')})`).join(',');
    for (const r of chunk) args.push(...r);
    await pool.query(sql.replace('/*VALUES*/', values), args);
  }
}

type TerritoryLine = { type: 'territory'; edition: number; scope: number; scope_key: string; network: number; registrants: number; all_four_present: number; essay_valid: number };
type SubjectLine = { type: 'subject'; edition: number; scope: number; scope_key: string; network: number; subject: string; valid_n: number; mean: number; median: number | null; p25: number | null; p75: number | null };
type CoverageLine = { type: 'coverage'; edition: number; registrants: number; all_four_present: number; math_valid: number; essay_valid: number };

async function runEdition(pool: Pool, edition: number) {
  const zipPath = `${RAW}/${edition}/microdados_enem_${edition}.zip`;
  const inner = INNER[edition]!;
  const { sha, bytes } = await digest(zipPath);
  const existing = await pool.query(`SELECT source_run_id, status FROM civica_exec.exec_enem_source_run WHERE edition=$1 AND source_sha256=$2 AND parser_version=$3`, [edition, sha, PV]);
  if (existing.rowCount) { console.log(edition, 'NO_CHANGE', existing.rows[0]); return; }
  const ins = await pool.query(`INSERT INTO civica_exec.exec_enem_source_run(edition, source_url, source_file, source_sha256, source_bytes, parser_version, status) VALUES ($1,$2,$3,$4,$5,$6,'running') RETURNING source_run_id`, [edition, SINOPSE_URL, zipPath, sha, bytes, PV]);
  const runId = Number(ins.rows[0].source_run_id);

  const outPath = `${STAGING}/enem_${edition}.jsonl`;
  console.log(edition, 'extraindo...', outPath);
  execFileSync('py', ['-3', 'scripts/exec/enem_extract.py', '--edition', String(edition), '--zip', zipPath, '--inner', inner, '--out', outPath], { stdio: 'inherit', cwd: process.cwd() });

  const territoryRows: unknown[][] = []; const subjectRows: unknown[][] = []; let coverage: CoverageLine | null = null; let resultsRows = 0;
  const rl = createInterface({ input: createReadStream(outPath, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line) as TerritoryLine | SubjectLine | CoverageLine;
    if (obj.type === 'territory') { if (obj.scope === 1 && obj.network === 0) resultsRows = obj.registrants; const supp = suppressCell(obj.registrants); territoryRows.push([runId, obj.edition, obj.scope, obj.scope_key, obj.network, obj.registrants, obj.all_four_present, obj.essay_valid, obj.scope === 4 && supp]); }
    else if (obj.type === 'subject') { const supp = suppressCell(obj.valid_n); subjectRows.push([runId, obj.edition, obj.scope, obj.scope_key, obj.network, obj.subject, obj.valid_n, obj.mean, obj.median, obj.p25, obj.p75, obj.scope === 4 && supp]); }
    else if (obj.type === 'coverage') coverage = obj;
  }
  if (!coverage) throw new Error(`${edition}: extrator não emitiu linha de coverage`);

  await insertMany(pool, `INSERT INTO civica_exec.exec_enem_territory_year(source_run_id,edition,scope,scope_key,network,registrants,all_four_present,essay_valid,suppressed) VALUES /*VALUES*/`, territoryRows);
  await insertMany(pool, `INSERT INTO civica_exec.exec_enem_subject_year(source_run_id,edition,scope,scope_key,network,subject,valid_n,mean,median,p25,p75,suppressed) VALUES /*VALUES*/`, subjectRows);

  const target = SINOPSE[edition]!;
  const result = reconcileEnemNational({ edition, registrants: coverage.registrants, allFourPresent: coverage.all_four_present, mathValid: coverage.math_valid, essayValid: coverage.essay_valid, sinopseRegistrants: target.registrants, sinopseAllFourPresent: target.allFourPresent, sinopseMathValid: target.mathValid, sinopseEssayValid: target.essayValid });
  await pool.query(`INSERT INTO civica_exec.exec_enem_coverage(source_run_id,edition,registrants,all_four_present,math_valid,essay_valid,sinopse_registrants,sinopse_all_four_present,sinopse_math_valid,sinopse_essay_valid,reconciled,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [runId, edition, coverage.registrants, coverage.all_four_present, coverage.math_valid, coverage.essay_valid, target.registrants, target.allFourPresent, target.mathValid, target.essayValid, result.reconciled, result.note]);

  if (!result.reconciled) { await pool.query(`UPDATE civica_exec.exec_enem_source_run SET status='failed', finished_at=now(), results_rows=$2, error=$3 WHERE source_run_id=$1`, [runId, resultsRows, result.note]); console.error(edition, 'FAILED', result.note); process.exitCode = 1; return; }
  await pool.query(`UPDATE civica_exec.exec_enem_source_run SET status='published', finished_at=now(), results_rows=$2 WHERE source_run_id=$1`, [runId, resultsRows]);
  console.log(edition, 'PUBLISHED', result.note, `(corte de supressão municipal: n < ${ENEM_MIN_CELL})`);
}

const pool = openPool(3);
try { for (const edition of EDITIONS) await runEdition(pool, edition); }
catch (e) { console.error(e); process.exitCode = 1; }
finally { await pool.end(); }
