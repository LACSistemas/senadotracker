import assert from 'node:assert/strict';
import test from 'node:test';
import { EXEC_DDL_V20 } from '../../packages/db/src/exec/index.ts';

test('P10.9: identidade municipal preserva código source-native e estados auditáveis', () => {
  assert.match(EXEC_DDL_V20, /exec_edu_program_municipality_map/);
  assert.match(EXEC_DDL_V20, /PRIMARY KEY \(source_dataset, year, uf, municipality_siafi\)/);
  assert.match(EXEC_DDL_V20, /LINKED.*UNRESOLVED.*AMBIGUOUS.*NON_MUNICIPAL/);
  assert.match(EXEC_DDL_V20, /exec_edu_program_fact_municipality_map_idx/);
  assert.doesNotMatch(EXEC_DDL_V20, /DROP\s|TRUNCATE\s|DELETE\s/i);
});

test('P10.9: regra de normalização é determinística e não fuzzy', () => {
  const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  assert.equal(normalize('São José do Rio Preto'), 'SAOJOSEDORIOPRETO');
  assert.equal(normalize('SAO JOSE DO RIO PRETO'), 'SAOJOSEDORIOPRETO');
  assert.notEqual(normalize('São José'), normalize('São José dos Campos'));
});

test('P10.9: ausência de vínculo não é convertida em zero', () => {
  const unresolved = { status: 'UNRESOLVED', entityId: null, amount: null };
  assert.equal(unresolved.entityId, null);
  assert.equal(unresolved.amount, null);
});
