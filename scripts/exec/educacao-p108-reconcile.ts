import { writeFile } from 'node:fs/promises';
import { getEducationContractSummary, getEducationMunicipalityProfile, getEducationNationalProfile, getEducationStateProfile } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

const output = process.argv[2]; if (!output) throw new Error('usage: educacao-p108-reconcile.ts <output.json>');
const pool = openPool(8); const checks: Array<{ id: string; pass: boolean; expected: unknown; actual: unknown }> = [];
const check = (id: string, actual: unknown, expected: unknown) => checks.push({ id, pass: JSON.stringify(actual) === JSON.stringify(expected), expected, actual });
try {
  const vit = await getEducationMunicipalityProfile(pool, '3205309'); const es = await getEducationStateProfile(pool, 32); const br = await getEducationNationalProfile(pool);
  if (!vit || !es || !br) throw new Error('missing integrated profile');
  const offerDirect = Number((await pool.query(`SELECT sum(o.mat_bas)::bigint n FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING(inep,year) JOIN civica_exec.exec_entity e ON e.entity_id=y.entity_id WHERE o.year=2025 AND e.ibge7=3205309`)).rows[0].n);
  check('vitoria_offer', vit.offer?.totals.matriculas, offerDirect);
  const internet = vit.infrastructure?.itens.find(x => x.code === 'internet'); check('vitoria_internet_ratio', internet?.pct, internet && internet.sim + internet.nao > 0 ? Math.round(internet.sim / (internet.sim + internet.nao) * 1000) / 10 : null);
  for (const [name, key] of [['brasil', {}], ['es', { ufCode: 32 }], ['sp', { ufCode: 35 }]] as const) {
    const roll = await getEducationContractSummary(pool, { ...key, year: 2025 });
    const where = 'ufCode' in key ? `uf=$1 AND esfera IN ('E','D','M')` : 'TRUE'; const args = 'ufCode' in key ? [key.ufCode] : [];
    const direct = (await pool.query(`SELECT count(*) FILTER(WHERE best_confidence<=2)::int firm,count(*) FILTER(WHERE best_confidence=3)::int possible FROM civica_exec.exec_edu_contract WHERE year=2025 AND ${where}`, args)).rows[0];
    check(`${name}_contract_firm`, roll?.total.highAndConfirmed.contracts, Number(direct.firm)); check(`${name}_contract_possible`, roll?.total.possible.contracts, Number(direct.possible));
  }
  check('finance_sources_separate', vit.finance.rule, 'SOURCES_AND_FINANCIAL_STAGES_MUST_NOT_BE_ADDED'); check('brazil_works_partial', br.procurement.works.status, 'PARTIAL'); check('municipality_works_not_applicable', vit.procurement.works.status, 'NOT_APPLICABLE');
  const result = { generatedAt: new Date().toISOString(), pass: checks.every(x => x.pass), checks };
  await writeFile(output, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); if (!result.pass) process.exitCode = 1;
} finally { await pool.end(); }
