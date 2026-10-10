import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'P18_3ir2.json'), 'utf8')) as any;
const targets = ['PE','AP','MG','SE','SP','CE','DF','BA','ES'];

test('P18.3IR2 artifact has database guard and exact target scope', () => {
  assert.equal(artifact.databaseGuard.pass, true);
  assert.equal(artifact.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.deepEqual(artifact.scope.targets, targets);
  assert.equal(artifact.scope.msTouched, false);
  assert.equal(artifact.scope.scTouched, false);
});

test('P18.3IR2 writes a row corpus and active scope for every target', () => {
  for (const house of targets) {
    const dir = path.join(root, 'artifacts', 'p18_3ir2', house);
    for (const file of ['manifest.json','raw-index.json','canonical-source.jsonl','active-scope.jsonl','reconciliation.json','request-log.jsonl']) assert.equal(fs.existsSync(path.join(dir, file)), true, `${house}/${file}`);
    const rec = JSON.parse(fs.readFileSync(path.join(dir, 'reconciliation.json'), 'utf8'));
    assert.equal(rec.publication, 'NOT_PUBLISHED');
    assert.equal(rec.noMutation, true);
  }
});

test('P18.3IR2 retains P0-P4 projections and provider-specific evidence', () => {
  for (const house of targets) {
    const provider = artifact.providers[house];
    assert.equal(provider.projections.levels.length, 5);
    assert.equal(provider.publication, 'NOT_PUBLISHED');
    assert.equal(provider.schedulerEligible, false);
    assert.ok(Number.isInteger(provider.sourceRows));
    assert.ok(Number.isInteger(provider.activeRows));
  }
  assert.equal(artifact.preserved.MS_STATUS, 'PERMANENTLY_DEFERRED_KEY_PROJECTION_EVIDENCE_MISSING');
  assert.equal(artifact.preserved.SC_HEALTH, 'HEALTHY');
  assert.equal(artifact.preserved.SC_SCHEDULER_ELIGIBLE, 'YES');
});

test('P18.3IR2 integrity gates show no database/identity mutation', () => {
  assert.equal(artifact.gates.NON_TARGET_FINANCE_CHANGES, 0);
  assert.equal(artifact.gates.IDENTITY_REVISIONS_CREATED, 0);
  assert.equal(artifact.gates.ACTIVE_DUPLICATE_EXTERNAL_IDS, 0);
  assert.equal(artifact.gates.LOST_LINKS_ON_UNCHANGED_ROWS, 0);
  assert.equal(artifact.gates.PRODUCTION_TOUCHED, 'NO');
  assert.equal(artifact.gates.PROJECTELEITOR_DB_TOUCHED, 'NO');
  assert.equal(artifact.gates.SQLITE_TOUCHED, 'NO');
});
