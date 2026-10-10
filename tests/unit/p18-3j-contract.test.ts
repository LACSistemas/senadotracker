import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const result = JSON.parse(fs.readFileSync(new URL('../../artifacts/P18_3j.json', import.meta.url), 'utf8')) as any;
const targets = ['ES','AP','MG','DF','BA','SE','AM','RN','TO','MS','GO','MA','PA','PI','RO','RR','RS','AC','AL','PB','PR'];

test('P18.3J artifact is lab-guarded and covers exactly the requested national scope', () => {
  assert.equal(result.phase, 'P18.3J');
  assert.equal(result.databaseGuard.expected, 'civica_postgres_lab');
  assert.equal(result.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.equal(result.scope.production, 'OFF');
  assert.equal(result.scope.projectEleitorDbTouched, 'NO');
  assert.equal(result.scope.sqliteTouched, 'NO');
  assert.deepEqual(result.scope.targets, targets);
  assert.deepEqual(result.scope.notApplicableHouses, ['MT', 'RJ']);
  assert.equal(result.summary.jTargets, 21);
  assert.equal(result.summary.jAudited, 21);
  assert.equal(result.summary.jInternalBlockers, 0);
  assert.equal(result.summary.localExecutableStepsRemaining, 0);
  assert.equal(Object.keys(result.providers).length, 27);
});

test('P18.3J keeps the ES browser-flow publication replay-safe', () => {
  const es = result.providers.ES;
  assert.equal(es.finalStatus, 'OPERATIONALLY_PROVEN');
  assert.equal(es.sourceCompleteness, 'PROVEN');
  assert.equal(es.keyProven, true);
  assert.equal(es.keyCollisions, 0);
  assert.equal(es.publication, 'PUBLISHED');
  assert.equal(es.run2, 'NO_OP');
  assert.equal(es.schedulerEligible, true);
  assert.ok(es.sourceEvidence.enumeratedRequests > 0);
  assert.equal(es.sourceEvidence.enumeratedRequests, es.sourceEvidence.successfulRequests);
});

test('P18.3J national integrity gates remain zero-touch outside ES finance', () => {
  assert.equal(result.integrity.nonTargetFinanceChanges, 0);
  assert.equal(result.integrity.identityRevisionsCreated, 0);
  assert.equal(result.integrity.lostLinksOnUnchangedRows, 0);
  assert.equal(result.integrity.activeDuplicateExternalIds, 0);
  assert.equal(result.integrity.falsePersonLinks, 0);
  assert.equal(result.integrity.falseSupplierLinks, 0);
  assert.equal(result.readyForProduction, false);
});
