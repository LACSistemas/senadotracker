import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('P18.3GR2 proves the PE multi-step pipeline and honest zero-overlap statuses', () => {
  const report = JSON.parse(fs.readFileSync('artifacts/P18_3gr2.json', 'utf8')) as any;
  const providers = Object.values(report.providers) as any[];
  assert.equal(report.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.equal(report.gates.pePipelineImplemented, 'YES');
  assert.equal(report.gates.peDependsOnTempScript, 'NO');
  assert.equal(report.providers.PE.sourceCompleteness, 'PROVEN');
  assert.equal(report.providers.PE.sourceMap.failedNoteCalls, 0);
  assert.equal(report.providers.PE.sourceRows, report.providers.PE.canonicalRows);
  assert.equal(report.gates.zeroOverlapDoesNotImplyKeyMigration, 'PASS');
  assert.equal(report.gates.zeroOverlapClassificationTest, 'PASS');
  for (const provider of providers) {
    if ((provider.reconciliation?.semanticOverlap ?? provider.key?.semanticOverlaps) === 0) {
      assert.notEqual(provider.externalIdParity, 'PASS');
      assert.notEqual(provider.finalStatus, 'DEFERRED_KEY_MIGRATION_REQUIRED');
    }
  }
  assert.equal(report.summary.sourceCompletenessProven, providers.filter(provider => provider.sourceCompleteness === 'PROVEN').length);
  assert.equal(report.summary.externalIdParityNotTestable, providers.filter(provider => provider.externalIdParity === 'NOT_TESTABLE_NO_OVERLAP').length);
  assert.equal(report.integrity.activeRevisionChanges.length, 0);
  assert.equal(report.integrity.identityRevisionsCreated, 0);
});
