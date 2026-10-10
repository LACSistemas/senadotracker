import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dims = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'];
const coverage = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p9.json', 'utf8')) as any;
const results = JSON.parse(fs.readFileSync('artifacts/p9_structured_houses_results.json', 'utf8')) as any;

test('P9 preserves the 27x6 public coverage matrix', () => {
  assert.equal(coverage.dimensions.length, 162);
  assert.equal(new Set(coverage.dimensions.map((x: any) => x.house)).size, 27);
  assert.equal(coverage.dimensions.some((x: any) => !dims.includes(x.dimension)), false);
  for (const row of coverage.dimensions) if (row.status === 'NOT_COLLECTED') { assert.equal(row.lastSuccessfulRun, null); assert.equal(row.activeRevisionId, null); }
});

test('P9 keeps candidate houses isolated and does not claim operational implementation without relations', () => {
  assert.deepEqual(results.targetedHouses.sort(), ['DF', 'MG', 'SC', 'SE', 'SP']);
  assert.equal(results.housesOperationalized, 0);
  assert.equal(results.newProvidersCreated, 0);
  assert.equal(results.status, 'P9_DISCOVERY_PASS_IMPLEMENTATION_BLOCKED');
  assert.deepEqual(results.externalBlockerHouses, ['SE']);
  assert.deepEqual(results.contractUnprovenHouses, ['DF', 'MG', 'SC', 'SP']);
  assert.deepEqual(results.operationalization, { implemented: 0, targeted: 5 });
  assert.equal(results.gates.newRegressions, 0);
});
