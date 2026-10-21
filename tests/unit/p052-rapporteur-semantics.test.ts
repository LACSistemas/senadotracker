import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveMatterYear, rapporteurDateBasis, rapporteurDateLabel } from '@senadotracker/domain';

test('P0.5.2: Câmara appointment date is latest status unless an explicit basis says otherwise', () => {
  assert.equal(rapporteurDateBasis('camara', 'rapporteurship', undefined, '2026-04-14'), 'latest_status');
  assert.equal(rapporteurDateBasis('senado', 'rapporteurship', undefined, '2026-04-14'), 'designation');
  assert.equal(rapporteurDateBasis('camara', 'rapporteurship', 'designation', '2026-04-14'), 'designation');
});

test('P0.5.2: annual relatoria uses matter year and does not imply start date', () => {
  assert.equal(effectiveMatterYear(2026, '2025-12-01'), 2026);
  assert.equal(effectiveMatterYear(null, '2026-03-05'), 2026);
  assert.equal(effectiveMatterYear(null, null), null);
  assert.equal(rapporteurDateLabel('camara', 'rapporteurship', 'latest_status', '2026-04-14', '2026-04-14', null, value => value ?? '—'), 'Situação registrada em 2026-04-14');
  assert.equal(rapporteurDateLabel('senado', 'rapporteurship', 'designation', '2026-03-05', null, null, value => value ?? '—'), 'Designação em 2026-03-05');
});
