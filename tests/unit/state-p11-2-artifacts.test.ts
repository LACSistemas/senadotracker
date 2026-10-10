import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const coverage = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p11_2.json', 'utf8')) as any;
const result = JSON.parse(fs.readFileSync('artifacts/p11_2_results.json', 'utf8')) as any;
const evidence = JSON.parse(fs.readFileSync('artifacts/p11_2_source_evidence.json', 'utf8')) as any;
const participation = JSON.parse(fs.readFileSync('artifacts/state_participation_discovery_p11_2.json', 'utf8')) as any;

test('P11.2 preserves 27x6 coverage and targets only BA/PA', () => {
  assert.equal(coverage.dimensions.length, 162); assert.equal(new Set(coverage.dimensions.map((row: any) => row.house)).size, 27);
  assert.deepEqual(result.targetedHouses, ['BA', 'PA']); assert.deepEqual(result.operationalizedDimensions, { BA: ['name', 'proposals'], PA: ['proposals'] });
  assert.equal(result.totalOperationalHouses, 16); assert.equal(result.remainingHouses, 11); assert.equal(result.gates.coverageRows162, true);
});

test('P11.2 BA components preserve primary proposal count and PA proposals are consumable', () => {
  const ba = coverage.dimensions.find((row: any) => row.house === 'BA' && row.dimension === 'proposals'); const pa = coverage.dimensions.find((row: any) => row.house === 'PA' && row.dimension === 'proposals');
  assert.equal(ba.primaryRecordsFound, 5); assert.equal(ba.components.proposals.recordsFound, 5); assert.equal(ba.components.authorship.recordsFound, 70); assert.equal(ba.components.authorship.recordsResolved, 0); assert.equal(ba.components.authorship.status, 'PARTIAL'); assert.equal(ba.components.movements.recordsFound, 29); assert.equal(ba.components.movements.recordsResolved, 29);
  assert.equal(pa.primaryRecordsFound, 10); assert.equal(pa.components.proposals.status, 'CONSUMABLE'); assert.equal(pa.components.authorship.status, 'PARTIAL'); assert.equal(pa.components.movements.status, 'NOT_COLLECTED');
});

test('P11.2 gates pass and participation remains discovery-only', () => {
  assert.equal(result.P11_2, 'PASS'); assert.equal(result.gates.databaseCorrect, true); assert.equal(result.gates.baRevisionsUnchanged, true); assert.equal(result.gates.paStableIdProposals, true); assert.equal(result.gates.paPagination, true); assert.equal(result.gates.paRawProvenance, true); assert.equal(result.gates.paReplay, true); assert.equal(result.gates.paRevisionStability, true); assert.equal(result.gates.NOT_COLLECTED_WITH_REVISION, 0); assert.equal(result.gates.productionUntouched, true); assert.equal(result.gates.sqliteUntouched, true); assert.equal(result.gates.newRegressions, 0);
  assert.equal(participation.relationProven, false); assert.equal(participation.published, false); assert.ok(evidence.participation?.endpoint);
});

test('P11.2 NOT_COLLECTED artifact rows have no revision or records', () => {
  for (const row of coverage.dimensions) if (row.status === 'NOT_COLLECTED') { assert.equal(row.recordsFound, null); assert.equal(row.recordsResolved, null); assert.equal(row.lastSuccessfulRun, null); assert.equal(row.activeRevisionId, null); }
});
