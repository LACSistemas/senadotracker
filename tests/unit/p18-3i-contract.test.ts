import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const result = JSON.parse(fs.readFileSync('artifacts/P18_3i.json', 'utf8')) as any;
const expected = ['CE','SP','DF','PE','BA','ES','MS','GO','MA','PA','PI','RO','RR','RS','AM','AP','MG','RN','SE','TO'];

test('P18.3I targets and lab guard are exact', () => {
  assert.equal(result.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.equal(result.databaseGuard.pass, true);
  assert.deepEqual(result.scope.targets, expected);
  assert.equal(result.summary.targets, 20);
  assert.equal(result.summary.audited, 20);
});

test('P18.3I does not mutate protected scope and has no executable blockers', () => {
  assert.equal(result.integrity.nonTargetFinanceChanges, 0);
  assert.equal(result.integrity.identityRevisionsCreated, 0);
  assert.equal(result.summary.executableBlockersRemaining, 0);
  assert.equal(result.scope.scTouched, false);
  assert.equal(result.scope.productionTouched, 'NO');
  assert.equal(result.scope.projectEleitorDbTouched, 'NO');
  assert.equal(result.scope.sqliteTouched, 'NO');
  assert.equal(result.scheduler.eligible.includes('SC'), true);
});

test('P18.3I has one final status per target and only permanent/operational classes', () => {
  const allowed = new Set(['OPERATIONALLY_PROVEN','OPERATIONALLY_PROVEN_WITH_SAFE_KEY_MIGRATION','PERMANENTLY_DEFERRED_EXTERNAL_SOURCE_BLOCK','PERMANENTLY_DEFERRED_AUTH_SOURCE_RESTRICTION','PERMANENTLY_DEFERRED_SOURCE_CONTRACT_UNAVAILABLE','PERMANENTLY_DEFERRED_SOURCE_UNIVERSE_AMBIGUOUS','PERMANENTLY_DEFERRED_SEMANTIC_INCOMPATIBILITY','PERMANENTLY_DEFERRED_RESOURCE_LIMIT','PERMANENTLY_DEFERRED_OTHER_PROVEN_BLOCKER']);
  assert.deepEqual(Object.keys(result.providers).sort(), expected.slice().sort());
  for (const house of expected) {
    assert.equal(allowed.has(result.providers[house].finalStatus), true, house);
    assert.ok(result.providers[house].exhaustion?.exactBlocker, house);
    assert.ok(result.providers[house].exhaustion?.lastSuccessfulStep, house);
    assert.ok(result.providers[house].exhaustion?.firstFailedStep, house);
  }
});

test('P18.3I artifact projections are explicit', () => {
  assert.equal(result.artifactStatusParity, 'PASS');
  assert.equal(result.artifactRowcountParity, 'PASS');
  assert.equal(result.artifactRevisionParity, 'PASS');
  assert.equal(result.artifactSchedulerParity, 'PASS');
  assert.equal(result.artifactResidualMatrixParity, 'PASS');
});
