import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const result = JSON.parse(fs.readFileSync('artifacts/P18_3ir.json', 'utf8')) as any;

test('P18.3IR proves lab guard and prior artifact contradiction', () => {
  assert.equal(result.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.equal(result.databaseGuard.pass, true);
  assert.equal(result.sourceArtifacts.priorArtifactStatusParity, 'FAIL');
  assert.equal(result.originalStatus, 'PASS_WITH_PROVEN_EXTERNAL_BLOCKERS');
});

test('MS reconciliation is scoped to current 2026 only', () => {
  assert.equal(result.ms.currentRows, 4834);
  assert.equal(result.ms.historicalRows, 19356);
  assert.equal(result.ms.semanticOverlap, 4834);
  assert.equal(result.ms.sourceOnly, 26);
  assert.equal(result.ms.activeOnly, 0);
  assert.equal(result.ms.safeKeyMigration, false);
  assert.equal(result.ms.finalStatus, 'PERMANENTLY_DEFERRED_KEY_PROJECTION_EVIDENCE_MISSING');
});

test('focused reconciliation remains explicitly incomplete instead of being promoted', () => {
  for (const house of ['PE','AP','MG','SE','SP']) {
    assert.equal(result.providers[house].finalStatus, 'NO_GO_RECONCILIATION_INCOMPLETE', house);
    assert.equal(result.providers[house].publication, 'NOT_PUBLISHED', house);
    assert.ok(result.providers[house].projections, house);
  }
  assert.equal(result.aggregate.executableBlockersRemaining, 5);
  assert.equal(result.readyForP18_3J, false);
});

test('aggregate gates are derived and protected scope is unchanged', () => {
  assert.equal(result.aggregate.operationallyProven, 0);
  assert.equal(result.aggregate.safeKeyMigrations, 0);
  assert.equal(result.aggregate.schedulerEligibleCount, 0);
  assert.equal(result.scheduler.scHealth, 'HEALTHY');
  assert.equal(result.scheduler.scSchedulerEligible, 'YES');
  assert.equal(result.integrity.nonTargetFinanceChanges, 0);
  assert.equal(result.integrity.identityRevisionsCreated, 0);
  assert.equal(result.readyForProduction, false);
});

test('artifact parity gates pass', () => {
  assert.equal(result.gates.artifactStatusParity, 'PASS');
  assert.equal(result.gates.artifactRowcountParity, 'PASS');
  assert.equal(result.gates.artifactSchedulerParity, 'PASS');
});
