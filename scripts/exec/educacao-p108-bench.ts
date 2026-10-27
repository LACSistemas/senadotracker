import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { getEducationMunicipalityBenchmarks, getEducationMunicipalityProfile, getEducationNationalProfile, getEducationSchoolProfile, getEducationStateProfile } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

const output = process.argv[2]; if (!output) throw new Error('usage: educacao-p108-bench.ts <output.json> [repetitions]');
const repetitions = Math.max(3, Number(process.argv[3] ?? 8)); const pool = openPool(8);
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1]!;
async function bench(name: string, budgetMs: number, work: () => Promise<unknown>) {
  await work(); const times: number[] = []; let sample: unknown;
  for (let i = 0; i < repetitions; i++) { const t = performance.now(); sample = await work(); times.push(performance.now() - t); }
  const p50 = pct(times, .5), p95 = pct(times, .95); return { name, budgetMs, p50Ms: Math.round(p50 * 10) / 10, p95Ms: Math.round(p95 * 10) / 10, maxMs: Math.round(Math.max(...times) * 10) / 10, pass: p95 <= budgetMs, samplePresent: sample != null };
}
async function explain(name: string, sql: string, args: unknown[] = []) {
  const row = (await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, args)).rows[0];
  const report = row['QUERY PLAN'] as Array<Record<string, unknown>>;
  return { name, report };
}
try {
  const schoolRows = (await pool.query(`SELECT DISTINCT y.inep FROM civica_exec.exec_edu_school_year y JOIN civica_exec.exec_edu_ideb_school i ON i.inep=y.inep JOIN civica_exec.exec_edu_offer_year o ON o.inep=y.inep WHERE y.year=2025 LIMIT 1`)).rows;
  const inep = Number(schoolRows[0]?.inep ?? 32000001);
  const scenarios = [
    await bench('school_profile', 100, () => getEducationSchoolProfile(pool, inep)),
    await bench('municipality_vitoria', 200, () => getEducationMunicipalityProfile(pool, '3205309')),
    await bench('municipality_sao_paulo', 200, () => getEducationMunicipalityProfile(pool, '3550308')),
    await bench('state_es', 200, () => getEducationStateProfile(pool, 32)),
    await bench('state_sp', 200, () => getEducationStateProfile(pool, 35)),
    await bench('brazil', 300, () => getEducationNationalProfile(pool)),
    await bench('benchmarks_vitoria', 200, () => getEducationMunicipalityBenchmarks(pool, '3205309')),
  ];
  const diagnostics = await Promise.all([
    explain('contracts_rollup_brazil_2025', `SELECT category,confidence,sum(contracts),sum(contracted_value) FROM civica_exec.exec_edu_contract_rollup WHERE scope=1 AND scope_key=0 AND year=$1 GROUP BY category,confidence`, [2025]),
    explain('programs_brazil_2025_rollup', `SELECT program_code,financial_stage,sum(rows),sum(beneficiaries),sum(amount_cents) FROM civica_exec.exec_edu_program_rollup WHERE scope=1 AND scope_key='BRASIL' AND year=$1 GROUP BY program_code,financial_stage`, [2025]),
    explain('siconfi_function12_brazil_2025', `WITH x AS (SELECT f.entity_id,k.code stage,max(f.valor)::bigint amount FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code c ON c.ref_id=f.conta_id AND c.domain=30 AND c.code='12' JOIN civica_exec.exec_ref_code k ON k.ref_id=f.coluna_id AND k.domain=31 WHERE f.exercicio=$1 GROUP BY f.entity_id,k.code) SELECT stage,count(*),sum(amount) FROM x GROUP BY stage`, [2025]),
    explain('siope_brazil_2025', `WITH x AS (SELECT entity_id,componente,codigo,estagio,max(valor_cents)::bigint amount FROM civica_exec.exec_edu_siope_fact WHERE exercicio=$1 GROUP BY entity_id,componente,codigo,estagio) SELECT componente,codigo,estagio,count(*),sum(amount) FROM x GROUP BY componente,codigo,estagio`, [2025]),
  ]);
  const result = { generatedAt: new Date().toISOString(), repetitions, scenarios, diagnostics, summary: { pass: scenarios.every(x => x.pass), failures: scenarios.filter(x => !x.pass).map(x => x.name) } };
  await writeFile(output, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await pool.end(); }
