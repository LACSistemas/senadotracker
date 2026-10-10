import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const result = JSON.parse(fs.readFileSync('artifacts/P18_3jr_batch_c3.json', 'utf8'));

test('MA valid-empty entries do not fail source completeness', () => {
  const ma = result.results.MA;
  assert.equal(ma.result, 'OPERATIONALLY_PROVEN');
  for (const competence of ma.enumeratedCompetences) {
    assert.equal(ma.visibleEntriesByCompetence[competence], ma.classifications[competence].sourceRowCount);
    assert.equal(ma.brokenByCompetence[competence], 0);
    assert.equal(ma.classifications[competence].parsingFailure, 0);
  }
  assert.ok(Object.values(ma.validEmptyByCompetence as Record<string, number>).some((n) => n > 0));
});

test('MA source completeness is independent of identity linkage', () => {
  const ma = result.results.MA;
  assert.equal(ma.sourceCompleteness, 'PROVEN');
  assert.equal(ma.keyCollisions, 0);
});

test('PI callback and pagination are exhausted before publication', () => {
  const pi = result.results.PI;
  assert.equal(pi.callbackReproduced, 'YES');
  assert.equal(pi.paginationExhausted, true);
  assert.equal(pi.keyCollisions, 0);
  assert.ok(pi.sourceRows > 0);
  assert.equal(pi.publication.status, 'PUBLISHED');
});

test('PI callback remaining cannot be a terminal internal result', () => {
  assert.notEqual(result.results.PI.result, 'INTERNAL_WORK_REMAINING');
});

test('GO unavailable partitions are carry-forward safe and retriable', () => {
  const go = result.results.GO;
  assert.equal(go.partitionCarryForward, true);
  assert.equal(go.degradedPartitionSafe, true);
  assert.ok(Object.values(go.monthStatuses as Record<string, any>).some((x) => x.status === 'TEMPORARILY_UNAVAILABLE_WITH_SAFE_CARRY_FORWARD'));
  assert.equal(go.currentOpenPartition.status, 'CURRENT_OPEN_PARTITION');
});

test('terminal results and local work remaining are closed', () => {
  for (const [house, value] of Object.entries(result.results as Record<string, any>)) {
    assert.ok(['OPERATIONALLY_PROVEN', 'OPERATIONALLY_PROVEN_DEGRADED_SOURCE_AVAILABILITY', 'PROVEN_EXTERNAL_BLOCKER', 'NO_GO_EXECUTION_FAILURE'].includes(value.result), house);
    assert.notEqual(value.result, 'INTERNAL_WORK_REMAINING');
  }
  assert.equal(result.localExecutableStepsRemaining, 0);
});
