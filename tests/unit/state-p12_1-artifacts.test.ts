import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const result = JSON.parse(fs.readFileSync('artifacts/p12_1_results.json','utf8')) as any;
const matrix = JSON.parse(fs.readFileSync('artifacts/state_capability_matrix_p12_1.json','utf8')) as any;
const blockers = JSON.parse(fs.readFileSync('artifacts/p12_1_blockers.json','utf8')) as any[];
const reconciliation = JSON.parse(fs.readFileSync('artifacts/p12_1_reconciliation.json','utf8')) as any;

test('P12.1 exhaustion gate accounts for every known surface', () => {
  assert.equal(result.database, 'civica_postgres_lab');
  assert.equal(result.schema, 'civica_state');
  assert.equal(result.KNOWN_SURFACES, 80);
  assert.equal(result.SURFACES_ATTEMPTED, 80);
  assert.equal(result.UNACCOUNTED_SURFACES, 0);
  assert.equal(result.PUBLIC_COVERAGE, 162);
  assert.equal(result.OPERATIONAL_HOUSES, 19);
  assert.equal(result.REMAINING_HOUSES, 8);
  assert.equal(result.EXISTING_REVISIONS_PRESERVED, true);
});

test('P12.1 matrix has 20 capabilities for each target house', () => {
  assert.equal(matrix.capabilities.length, 80);
  for (const house of ['PA','SP','SC','DF']) {
    assert.equal(matrix.capabilities.filter((row: any) => row.house === house).length, 20);
  }
  assert.ok(matrix.capabilities.every((row: any) => row.status !== 'NOT_COLLECTED'));
});

test('P12.1 blockers retain precise relationship evidence', () => {
  assert.ok(blockers.some(row => row.house === 'PA' && row.blocker === 'PROPOSAL_RELATIONSHIP_UNPROVEN'));
  assert.ok(blockers.some(row => row.house === 'SP' && row.blocker === 'SOURCE_KEY_MISMATCH'));
  assert.ok(blockers.some(row => row.house === 'SC' && row.blocker === 'NO_PUBLIC_INDIVIDUAL_VOTE_PAYLOAD'));
  assert.deepEqual(reconciliation.PA.proposalId, '0');
  assert.equal(reconciliation.SP.IdDocumento_to_author, 'BLOCKED:SOURCE_KEY_MISMATCH');
  assert.equal(reconciliation.DF.movementCollisions, 0);
});
