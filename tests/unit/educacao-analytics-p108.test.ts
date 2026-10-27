import assert from 'node:assert/strict';
import test from 'node:test';
import { EDUCATION_FAMILY_COUNTS, EDUCATION_INDICATORS, EXEC_DDL_V17, safeEducationRatio, sameEducationBenchmarkDimension } from '../../packages/db/src/exec/index.ts';

test('P10.8: catálogo tem IDs únicos, dez famílias e diferencia oficial de derivado', () => {
  assert.ok(EDUCATION_INDICATORS.length >= 45);
  assert.equal(new Set(EDUCATION_INDICATORS.map(x => x.id)).size, EDUCATION_INDICATORS.length);
  assert.equal(Object.keys(EDUCATION_FAMILY_COUNTS).length, 10);
  assert.ok(EDUCATION_INDICATORS.some(x => x.origin === 'OFFICIAL'));
  assert.ok(EDUCATION_INDICATORS.some(x => x.origin === 'CIVICA_DERIVED'));
  for (const x of EDUCATION_INDICATORS) assert.ok(x.id.startsWith('edu.') && x.officialSource && x.unit && x.editions && x.granularities.length && x.interpretation && x.limitation && x.coverage && x.comparability);
});

test('P10.8: catálogo não inventa grãos proibidos', () => {
  assert.ok(EDUCATION_INDICATORS.filter(x => x.id.includes('saeb_')).every(x => !x.granularities.includes('ESCOLA')));
  assert.ok(EDUCATION_INDICATORS.filter(x => x.family === 'OBRAS').every(x => x.granularities.join(',') === 'UF'));
  assert.ok(!EDUCATION_INDICATORS.find(x => x.id === 'edu.program.pnae')!.granularities.includes('ESCOLA'));
  assert.ok(EDUCATION_INDICATORS.find(x => x.id === 'edu.flow.td_fun')!.granularities.includes('ESCOLA'));
  assert.ok(!EDUCATION_INDICATORS.find(x => x.id === 'edu.flow.rep_fun')!.granularities.includes('ESCOLA'));
  assert.ok(EDUCATION_INDICATORS.filter(x => ['INFRAESTRUTURA', 'FINANCIAMENTO', 'PROGRAMAS_TRANSFERENCIAS'].includes(x.family)).every(x => x.origin === 'CIVICA_DERIVED'));
});

test('P10.8: comparabilidade exige todas as dimensões iguais', () => {
  const a = { indicator: 'edu.learning.ideb', year: 2025, unit: 'índice', network: 3, stage: 1, financialStage: null, universe: 'oficial' };
  assert.equal(sameEducationBenchmarkDimension(a, { ...a }), true);
  for (const change of [{ year: 2023 }, { network: 2 }, { stage: 2 }, { unit: '%' }, { universe: 'escolas' }, { financialStage: 'PAID' }]) assert.equal(sameEducationBenchmarkDimension(a, { ...a, ...change }), false);
});

test('P10.8: razões preservam ausência e denominador inválido', () => {
  assert.equal(safeEducationRatio(null, 10), null); assert.equal(safeEducationRatio(10, null), null); assert.equal(safeEducationRatio(10, 0), null); assert.equal(safeEducationRatio(100, 4), 25);
});

test('P10.8: v17 é aditiva, compacta e não toca fatos anteriores', () => {
  assert.match(EXEC_DDL_V17, /CREATE TABLE civica_exec\.exec_edu_contract_rollup/);
  assert.match(EXEC_DDL_V17, /CREATE INDEX exec_edu_program_fact_entity_year_idx/);
  assert.match(EXEC_DDL_V17, /CREATE INDEX exec_fin_fact_year_account_idx/);
  assert.doesNotMatch(EXEC_DDL_V17, /DROP\s|TRUNCATE\s|ALTER TABLE/i);
  assert.doesNotMatch(EXEC_DDL_V17, /cpf|aluno_id|professor_id|email|telefone/i);
});
