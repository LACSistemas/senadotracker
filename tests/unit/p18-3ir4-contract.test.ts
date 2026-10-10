import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'P18_3ir4.json'), 'utf8'));

test('P18.3IR4 is lab-guarded and preserves excluded scope', () => {
  assert.equal(artifact.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.deepEqual(artifact.scope.targets, ['CE', 'ES', 'AP', 'MG', 'DF', 'PE', 'BA', 'SE']);
  assert.equal(artifact.scope.spFrozen, true);
  assert.deepEqual(artifact.scope.excludedHouses, ['AC', 'AL', 'PB', 'PR', 'MS', 'SC']);
  assert.equal(artifact.scope.production, 'OFF');
  assert.equal(artifact.scope.projectEleitorDbTouched, 'NO');
  assert.equal(artifact.scope.sqliteTouched, 'NO');
});

test('CE merges October with carried Jan-Sep partitions and is operational', () => {
  const ce = artifact.providers.CE;
  assert.equal(ce.sourceRows, 74);
  assert.equal(ce.activeRows, 3171);
  assert.equal(ce.candidateRows, 3171);
  assert.equal(ce.sourcePartitions['2026-10'], 74);
  assert.equal(ce.result, 'OPERATIONALLY_PROVEN');
  assert.equal(ce.sourceKeyProof.collisions, 0);
  assert.equal(ce.publication, 'VALID_SNAPSHOT_NO_OP');
  assert.equal(ce.run2, 'NO_OP');
  assert.equal(ce.schedulerEligible, true);
});

test('PE canonicalizes providerPersonId and is operational without slug/id mixing', () => {
  const pe = artifact.providers.PE;
  assert.equal(pe.sourceRows, 1581);
  assert.equal(pe.activeRows, 1581);
  assert.equal(pe.candidateRows, 1581);
  assert.equal(pe.result, 'OPERATIONALLY_PROVEN');
  assert.equal(pe.sourceKeyProof.collisions, 0);
  assert.equal(pe.partitionContext, 'provenance.providerPersonId -> canonical person id');
  assert.equal(pe.publication, 'VALID_SNAPSHOT_NO_OP');
  assert.equal(pe.run2, 'NO_OP');
});

test('remaining providers retain exact root-cause blockers', () => {
  assert.equal(artifact.providers.ES.blocker, 'SOURCE_PARLIAMENTARIAN_CONTEXT_NOT_PERSISTED');
  assert.equal(artifact.providers.AP.blocker, 'SOURCE_PARLIAMENTARIAN_AND_COMPETENCE_CONTEXT_NOT_PERSISTED');
  assert.equal(artifact.providers.MG.blocker, 'SOURCE_COMPETENCE_NOT_AVAILABLE_IN_RAW_CORPUS');
  assert.equal(artifact.providers.DF.blocker, 'SOURCE_NATIVE_ROW_ID_NOT_PROVEN');
  assert.equal(artifact.providers.BA.blocker, 'IMMUTABLE_DOCUMENT_RESOURCE_ID_NOT_PERSISTED');
  assert.equal(artifact.providers.SE.blocker, 'CURRENT_SOURCE_RESOURCES_NOT_ENUMERATED');
  for (const house of ['ES', 'AP', 'MG', 'DF', 'BA', 'SE']) assert.notEqual(artifact.providers[house].blocker, 'COLLECTION_MODEL_OR_KEY_RECONCILIATION_REQUIRED');
  assert.equal(artifact.summary.executableLocalStepsUnattempted, 0);
});
