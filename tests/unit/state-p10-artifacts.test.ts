import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dims = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'];
const targets = ['BA', 'CE', 'GO', 'MS', 'PA', 'PE', 'RJ', 'RN', 'RS'];
const coverage = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p10.json', 'utf8')) as any;
const results = JSON.parse(fs.readFileSync('artifacts/p10_custom_houses_results.json', 'utf8')) as any;

test('P10 preserves the 27x6 public coverage matrix', () => {
  assert.equal(coverage.dimensions.length, 162);
  assert.equal(new Set(coverage.dimensions.map((x: any) => x.house)).size, 27);
  assert.equal(coverage.dimensions.every((x: any) => dims.includes(x.dimension)), true);
  for (const row of coverage.dimensions) if (row.status === 'NOT_COLLECTED') {
    assert.equal(row.lastSuccessfulRun, null);
    assert.equal(row.activeRevisionId, null);
  }
});

test('P10 scope is isolated from P9 houses and does not claim unsafe providers', () => {
  assert.deepEqual(results.targetedHouses, targets);
  assert.equal(results.housesOperationalized, 0);
  assert.equal(results.partialOperational, 0);
  assert.equal(results.discoveryOnly, 9);
  assert.equal(results.newProvidersCreated, 0);
  assert.equal(results.existingProvidersReused, 0);
  assert.equal(results.status, 'P10_DISCOVERY_PASS_WITH_BLOCKERS');
  assert.equal(results.gates.newRegressions, 0);
  assert.equal(results.gates.existingRevisionsPreserved, true);
  assert.equal(results.gates.productionUntouched, true);
  assert.equal(results.gates.sqliteUntouched, true);
});
