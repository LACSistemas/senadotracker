import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dimensions = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'];
const targets = ['BA', 'MG', 'GO', 'PA', 'PE', 'SP'];
const excluded = ['DF', 'SC', 'SE', 'CE', 'MS', 'RJ', 'RN', 'RS'];
const coverage = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p11.json', 'utf8')) as any;
const results = JSON.parse(fs.readFileSync('artifacts/p11_results.json', 'utf8')) as any;
const evidence = JSON.parse(fs.readFileSync('artifacts/p11_source_evidence.json', 'utf8')) as any;

test('P11 preserves the 27x6 public coverage matrix and NOT_COLLECTED invariant', () => {
  assert.equal(coverage.dimensions.length, 162);
  assert.equal(new Set(coverage.dimensions.map((row: any) => row.house)).size, 27);
  assert.equal(coverage.dimensions.every((row: any) => dimensions.includes(row.dimension)), true);
  for (const row of coverage.dimensions) if (row.status === 'NOT_COLLECTED') {
    assert.equal(row.lastSuccessfulRun, null);
    assert.equal(row.activeRevisionId, null);
  }
});

test('P11 is capability-independent and isolated from P9/P10/P12', () => {
  assert.deepEqual(results.targetedHouses, targets);
  assert.deepEqual(results.excludedHouses, excluded);
  assert.equal(results.capabilityIndependent, true);
  assert.equal(results.housesNewlyOperationalized, 0);
  assert.equal(results.newIdentityRevisions, 0);
  assert.equal(results.newLegislativeRevisions, 0);
  assert.equal(results.status, 'P11_DISCOVERY_PASS_IMPLEMENTATION_BLOCKED');
  assert.equal(results.gates.existingRevisionsPreserved, true);
  assert.equal(results.gates.productionUntouched, true);
  assert.equal(results.gates.sqliteUntouched, true);
  assert.equal(results.gates.newRegressions, 0);
});

test('P11 evidence covers every target and public dimension without claiming revisions', () => {
  assert.equal(evidence.providerRows.length, targets.length);
  for (const row of evidence.providerRows) {
    assert.equal(row.capabilityIndependent, true);
    assert.equal(row.operational, false);
    assert.equal(row.revision, 'not_created');
    for (const dimension of dimensions) assert.equal(row[dimension === 'name' ? 'identity' : dimension], 'DISCOVERY_ONLY');
  }
});
