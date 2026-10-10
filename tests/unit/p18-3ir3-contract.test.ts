import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'P18_3ir3.json'), 'utf8')) as any;
const targets = ['SP','ES','DF','PE','AP','MG','CE','BA','SE'];

test('P18.3IR3 is lab-guarded and preserves excluded scope', () => {
  assert.equal(artifact.databaseGuard.pass, true);
  assert.equal(artifact.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.deepEqual(artifact.scope.targets, targets);
  assert.equal(artifact.scope.msTouched, false);
  assert.equal(artifact.scope.scTouched, false);
  assert.equal(artifact.scope.projectEleitorDbTouched, 'NO');
  assert.equal(artifact.scope.sqliteTouched, 'NO');
});

test('SP is published with a deterministic full-snapshot corpus and Run 2 no-op', () => {
  const sp = artifact.providers.SP;
  assert.equal(sp.collectionModel, 'FULL_SNAPSHOT');
  assert.equal(sp.sourceRows, 16014);
  assert.equal(sp.activeRows, 16014);
  assert.equal(sp.sourceKeyProof.collisions, 0);
  assert.equal(sp.sourceKeyProof.nulls, 0);
  assert.equal(sp.result, 'OPERATIONALLY_PROVEN');
  assert.ok(['YES', 'VALID_NO_OP'].includes(sp.publication));
  assert.equal(sp.run2, 'NO_OP');
  assert.equal(sp.schedulerEligible, true);
});

test('IR3 keeps collection models and blockers provider-specific', () => {
  assert.equal(artifact.providers.ES.collectionModel, 'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE');
  assert.equal(artifact.providers.ES.result, 'RECONCILIATION_READY_MULTIPLICITY_UNRESOLVED');
  assert.equal(artifact.providers.AP.sourceKeyProof.collisions > 0, true);
  assert.equal(artifact.providers.DF.sourceKeyProof.collisions > 0, true);
  assert.equal(artifact.providers.SE.blocker, 'CURRENT_SOURCE_RESOURCES_NOT_ENUMERATED');
  assert.equal(artifact.providers.BA.collectionModel, 'IMMUTABLE_DOCUMENT_CORPUS');
});

test('IR3 counters separate ready, published, operational and scheduler states', () => {
  assert.equal(artifact.summary.reconciliationReady, '2/9');
  assert.equal(artifact.summary.publicationEligible, '1/9');
  assert.equal(artifact.summary.operationallyProven, '1/9');
  assert.equal(artifact.summary.newSchedulerEligible, 1);
  assert.equal(artifact.summary.publications, 1);
  assert.equal(artifact.summary.validNoOp, 1);
  assert.equal(artifact.gates.IDENTITY_REVISIONS_CREATED, 0);
  assert.equal(artifact.gates.NON_TARGET_FINANCE_CHANGES, 0);
});
