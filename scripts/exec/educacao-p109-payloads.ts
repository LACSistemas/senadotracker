import { writeFile } from 'node:fs/promises';
import { getEducationMunicipalityBenchmarks, getEducationMunicipalityProfile, getEducationNationalProfile, getEducationSchoolProfile, getEducationStateProfile } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

const output = process.argv[2] ?? 'docs/executivo-collector-plan/educacao-p109-execucao/evidencias/payloads_p109.json';
const pool = openPool(8);
const bytes = (x: unknown) => Buffer.byteLength(JSON.stringify(x), 'utf8');
try {
  const inep = Number((await pool.query(`SELECT y.inep FROM civica_exec.exec_edu_school_year y JOIN civica_exec.exec_edu_ideb_school i USING (inep) WHERE y.year=2025 LIMIT 1`)).rows[0]?.inep ?? 32000001);
  const scenarios: Array<[string, () => Promise<unknown>]> = [
    ['school_profile', () => getEducationSchoolProfile(pool, inep)],
    ['municipality_sao_paulo', () => getEducationMunicipalityProfile(pool, '3550308')],
    ['state_sp', () => getEducationStateProfile(pool, 35)],
    ['brazil', () => getEducationNationalProfile(pool)],
    ['benchmarks_vitoria', () => getEducationMunicipalityBenchmarks(pool, '3205309')],
  ];
  const result = [];
  for (const [name, work] of scenarios) { const value = await work(); result.push({ name, payloadBytesUtf8: bytes(value), payloadPresent: value != null }); }
  await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), scenarios: result }, null, 2));
  console.log(JSON.stringify({ output, scenarios: result }, null, 2));
} finally { await pool.end(); }
