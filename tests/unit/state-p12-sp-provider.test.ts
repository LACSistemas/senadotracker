import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJsonArrayPrefix, mapExpense, mapProposal } from '../../apps/collector/src/state/providers/alesp-open-data/index.ts';

const raw = { rawId: 'raw:test', endpoint: 'https://example.test', fetchedAt: '2026-01-01T00:00:00.000Z', sha256: 'sha' } as any;

test('P12 SP parses complete JSON prefix and preserves IdDocumento', () => {
  const rows = parseJsonArrayPrefix('[{"idDocumento":"D-1","anoLegislativo":2026},{"idDocumento":"D-2"');
  assert.equal(rows.length, 1);
  assert.equal(mapProposal(rows[0], raw).key.externalId, 'D-1');
});

test('P12 SP expense identity uses matricula-linked person and amount cents', () => {
  const expense = mapExpense({ id: 'E-1', matricula: '42', ano: 2026, mes: 3, valor: 123.45, cnpj: '001' }, { idDeputado: 'DEP-1', matricula: '42' }, raw);
  assert.equal(expense.key.externalId, 'E-1');
  assert.equal(expense.person?.externalId, 'DEP-1');
  assert.equal(expense.amountCents, 12345);
  assert.equal(expense.competence, '2026-03');
});
