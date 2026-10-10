import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const coverage = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p11_1.json', 'utf8')) as any;
const result = JSON.parse(fs.readFileSync('artifacts/p11_1_results.json', 'utf8')) as any;

test('P11.1 preserves 27x6 coverage and operationalizes only BA/MG dimensions', () => {
  assert.equal(coverage.dimensions.length, 162); assert.equal(new Set(coverage.dimensions.map((row: any) => row.house)).size, 27); assert.deepEqual(result.targetedHouses, ['BA', 'MG']); assert.deepEqual(result.operationalizedDimensions, { BA: ['name', 'proposals'], MG: ['name'] });
  assert.equal(result.totalOperationalHouses, 15); assert.equal(result.remainingHouses, 12); assert.equal(result.gates.coverageMatrixPreserved, true);
});

test('P11.1 revisions are active and NOT_COLLECTED invariant remains valid', () => {
  for (const row of coverage.dimensions) if (row.status === 'NOT_COLLECTED') { assert.equal(row.lastSuccessfulRun, null); assert.equal(row.activeRevisionId, null); }
  const baName = coverage.dimensions.find((row: any) => row.house === 'BA' && row.dimension === 'name'); const baProposals = coverage.dimensions.find((row: any) => row.house === 'BA' && row.dimension === 'proposals'); const mgName = coverage.dimensions.find((row: any) => row.house === 'MG' && row.dimension === 'name');
  assert.equal(baName.status, 'CONSUMABLE'); assert.equal(baProposals.status, 'CONSUMABLE'); assert.equal(mgName.status, 'CONSUMABLE'); assert.ok(baName.activeRevisionId); assert.ok(baProposals.activeRevisionId); assert.ok(mgName.activeRevisionId);
});

test('P11.1 global safety gates pass', () => { assert.equal(result.p11_1, 'PASS'); assert.equal(result.gates.databaseCorrect, true); assert.equal(result.gates.rawFirst, true); assert.equal(result.gates.stableIds, true); assert.equal(result.gates.replaySemanticRevisionStable, true); assert.equal(result.gates.mgReplaySemanticRevisionStable, true); assert.equal(result.gates.existingRevisionsPreserved, true); assert.equal(result.gates.productionUntouched, true); assert.equal(result.gates.sqliteUntouched, true); assert.equal(result.gates.newRegressions, 0); });
