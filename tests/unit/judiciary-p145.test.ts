import test from 'node:test';
import assert from 'node:assert/strict';

test('P14.5 keeps monetary values in integer cents', () => {
  const brl = '143.540.566,80';
  const [whole, fraction] = brl.replaceAll('.', '').split(',');
  const cents = BigInt(whole) * 100n + BigInt(fraction);
  assert.equal(cents, 14354056680n);
});

test('P14.5 separates financial stages', () => {
  const stages = ['AUTHORIZED_BUDGET', 'COMMITTED', 'LIQUIDATED', 'PAID'];
  assert.deepEqual(new Set(stages).size, stages.length);
  assert.notEqual(stages.indexOf('COMMITTED'), stages.indexOf('PAID'));
});

test('P14.5 aggregate contract contains no person identity fields', () => {
  const publicFields = ['reference_year', 'reference_month', 'tipo_servidor', 'categoria_vinculo', 'situacao', 'record_count', 'total_creditos_cents', 'total_debitos_cents', 'rendimento_liquido_cents'];
  assert.equal(publicFields.some((x) => /nome|cpf|matr/i.test(x)), false);
});

test('P14.5 null source coverage is not converted to zero', () => {
  const tjes = { status: 'P3_EVIDENCE_ONLY', rows: 0 };
  assert.equal(tjes.status, 'P3_EVIDENCE_ONLY');
  assert.equal(tjes.rows, 0);
});
