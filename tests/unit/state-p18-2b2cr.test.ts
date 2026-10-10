import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseScCabinetCsv,
  provenanceForRaw,
} from '../../apps/collector/src/state/providers/state-finance/index.ts';
import {
  scCurrentDeltaIsNoOp,
  selectScCurrentLinkage,
  validateScCurrentHeaders,
} from '../../apps/collector/src/state/providers/state-finance/sc-current.ts';

test('unchanged current rows carry forward linkage and provenance exactly', () => {
  const previous = { personExternalId: 'person-1', linkageMethod: 'EXACT_UNIQUE_HOUSE_NAME', linkageStatus: 'EXACT_UNIQUE_HOUSE_NAME', rawId: 'raw:old', provenance: { sourceKey: 'stable', canonicalPerson: 'person-1' } };
  assert.deepEqual(selectScCurrentLinkage(previous, null, 'Unknown'), previous);
});

test('new rows use the deterministic current identity resolver', () => {
  assert.deepEqual(selectScCurrentLinkage(null, 'person-2', 'Known'), { personExternalId: 'person-2', linkageMethod: 'EXACT_UNIQUE_HOUSE_NAME', linkageStatus: 'EXACT_UNIQUE_HOUSE_NAME' });
});

test('unknown new identities remain unresolved and non-person labels remain non-person', () => {
  assert.equal(selectScCurrentLinkage(null, null, 'Unknown Deputy').linkageStatus, 'UNRESOLVED_NEW_SOURCE_IDENTITY');
  assert.equal(selectScCurrentLinkage(null, null, 'Bancada de Partido').linkageStatus, 'NON_PERSON');
});

test('stable source delta is a no-op and does not require a revision', () => {
  assert.equal(scCurrentDeltaIsNoOp({ added: 0, removed: 0, semanticallyChanged: 0 }), true);
  assert.equal(scCurrentDeltaIsNoOp({ added: 1, removed: 0, semanticallyChanged: 0 }), false);
});

test('duplicate source rows retain occurrence multiplicity as distinct natural keys', () => {
  const raw = provenanceForRaw('raw:test', 'https://example.test/sc.csv', 'fixture');
  const body = [
    'Verba;Descrição;Conta;Favorecido;Trecho;Data de Referência;Valor',
    'DIÁRIAS;Diárias;Deputado X;Fornecedor Y;;01/01/2026;1,00',
    'DIÁRIAS;Diárias;Deputado X;Fornecedor Y;;01/01/2026;1,00',
  ].join('\n');
  const rows = parseScCabinetCsv(body, 'https://example.test/sc.csv', raw);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0]?.key.externalId, rows[1]?.key.externalId);
});

test('schema drift fails closed', () => {
  assert.equal(validateScCurrentHeaders(['Verba', 'Conta'], true), 'FAIL');
  assert.equal(validateScCurrentHeaders(['Verba', 'Descrição', 'Conta', 'Favorecido', 'Trecho', 'Data de Referência', 'Valor'], false), 'FAIL');
});
