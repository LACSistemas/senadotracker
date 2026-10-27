import assert from 'node:assert/strict';
import test from 'node:test';
import { EXEC_DDL_V21 } from '../../packages/db/src/exec/index.ts';
import { getEducationOverview, getEducationSection, getEducationSeries } from '../../packages/db/src/exec/index.ts';

test('P10.9.1: serving compacto possui overview e séries com chaves territoriais', () => {
  assert.match(EXEC_DDL_V21, /exec_edu_overview_rollup/);
  assert.match(EXEC_DDL_V21, /exec_edu_series_rollup/);
  assert.match(EXEC_DDL_V21, /PRIMARY KEY \(scope, scope_key, year\)/);
  assert.match(EXEC_DDL_V21, /source_fingerprint/);
  assert.doesNotMatch(EXEC_DDL_V21, /DROP\s|TRUNCATE\s|DELETE\s/i);
});

test('P10.9.1: contratos compactos não dependem de dados pessoais', () => {
  const forbidden = ['cpf', 'aluno_nome', 'professor_nome', 'telefone', 'email'];
  const source = `${getEducationOverview}\n${getEducationSection}\n${getEducationSeries}`;
  for (const x of forbidden) assert.equal(source.toLowerCase().includes(x), false, x);
});
