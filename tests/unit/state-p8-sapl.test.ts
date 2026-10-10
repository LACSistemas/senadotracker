import assert from 'node:assert/strict';
import test from 'node:test';
import { saplMultiBases, saplMultiHouseConfigs } from '../../apps/collector/src/state/providers/sapl/multi-config.ts';

test('P8 registers PB on the existing SAPL provider without creating a provider copy', () => {
  assert.equal(saplMultiBases.PB, 'https://sapl.al.pb.leg.br');
  assert.equal(saplMultiHouseConfigs.filter(config => config.house === 'PB').length, 1);
  assert.equal(saplMultiHouseConfigs.some(config => config.house === 'MA'), false);
  assert.equal(saplMultiHouseConfigs.filter(config => config.house === 'PB')[0]?.bindings.every(binding => binding.provider === 'sapl'), true);
});
