import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const result = JSON.parse(fs.readFileSync(new URL('../../artifacts/P18_3jr.json', import.meta.url), 'utf8')) as any;
const progress = fs.readFileSync(new URL('../../artifacts/p18_3jr/progress.jsonl', import.meta.url), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const targets = ['AP','MG','DF','BA','MS','TO','AM','SE','MA','PA','PI','RO','RS','RR','GO','RN','AC','AL','PB','PR'];

test('P18.3JR has a current-run attempt and checkpoint for every target', () => {
  assert.equal(result.phase, 'P18.3JR');
  assert.equal(result.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.deepEqual(result.targets, result.processed);
  assert.equal(result.currentRunAttempted, 20);
  const latest = new Map(progress.filter(row => targets.includes(row.house)).map(row => [row.house, row]));
  assert.equal(latest.size, 20);
  assert.deepEqual([...latest.keys()], targets);
  for (const house of targets) {
    assert.equal(result.providers[house].currentRunStarted, true);
    assert.ok(result.providers[house].currentRunImplementationAttempts >= 1);
    assert.ok(result.providers[house].currentRunSourceRequests >= 1);
  }
});

test('P18.3JR never promotes an implementation blocker to external without proof', () => {
  assert.equal(Array.isArray(result.invalidExternalClassifications) ? result.invalidExternalClassifications.length : result.invalidExternalClassifications, 0);
  if (result.batchC3) {
    assert.ok(['PASS','PARTIAL_WITH_PROVEN_EXTERNAL_BLOCKER'].includes(result.batchC3.status));
    assert.equal(result.batchC3.localExecutableStepsRemaining, 0);
    for (const house of ['MA','PI','GO']) {
      assert.ok(['OPERATIONALLY_PROVEN','OPERATIONALLY_PROVEN_DEGRADED_SOURCE_AVAILABILITY','PROVEN_EXTERNAL_BLOCKER','NO_GO_EXECUTION_FAILURE'].includes(result.batchC3.results[house].result));
      assert.notEqual(result.batchC3.results[house].result, 'INTERNAL_WORK_REMAINING');
    }
  } else {
    assert.ok(['NO_GO_INTERNAL_WORK_REMAINING','PARTIAL_WITH_REAL_IMPLEMENTATION'].includes(result.status));
    assert.ok(result.localExecutableStepsRemaining > 0);
  }
  for (const house of targets) {
    const row = result.providers[house];
    if (row.finalStatus === 'PROVEN_EXTERNAL_BLOCKER_VALIDATED_THIS_RUN') assert.ok(row.externalProof);
    if (row.finalStatus === 'INTERNAL_WORK_REMAINING') assert.ok(row.currentRunFirstUnresolvedStep);
  }
});
