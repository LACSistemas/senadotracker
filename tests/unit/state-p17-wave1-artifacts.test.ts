import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const result = JSON.parse(fs.readFileSync('artifacts/p17_wave1_results.json', 'utf8'));
const readiness = JSON.parse(fs.readFileSync('artifacts/p17_wave1_product_readiness.json', 'utf8'));
const expected = ['AC:proposals', 'AL:proposals', 'AP:proposals', 'AM:proposals', 'ES:proposals', 'MS:parliamentary_allowance', 'PB:proposals', 'PR:identity', 'PI:proposals', 'RR:proposals', 'TO:proposals'];

test('P17 uses exactly the confirmed Wave 1 ready list', () => {
  assert.equal(result.database, 'civica_postgres_lab');
  assert.deepEqual(readiness.readyItems, expected);
  assert.equal(result.readyItemCount, 11);
  assert.equal(result.gates.exactReadyList, true);
});

test('P17 proposal rows have stable identities, active revisions and replay evidence', () => {
  for (const item of result.items.filter((x: any) => x.capability === 'proposals')) {
    assert.equal(item.status, 'ALREADY_IMPLEMENTED');
    assert.ok(item.revision?.startsWith(`state:${item.house}:legislative:`));
    assert.equal(item.sourceRows, item.persistedRows);
    assert.equal(item.duplicateIds, 0);
    assert.equal(item.replay, 'PASS');
    assert.equal(item.idempotence, 'PASS');
  }
});

test('P17 MS CEAP preserves raw-first 1:1 controlled corpus semantics', () => {
  const ms = result.items.find((x: any) => x.house === 'MS');
  assert.equal(ms.sourceRows, 4834);
  assert.equal(ms.normalizedRows, 4834);
  assert.equal(ms.written, 4834);
  assert.equal(ms.duplicateNaturalKeys, 0);
  assert.equal(ms.suppliers, 1340);
  assert.equal(ms.taxIds, 1053);
  assert.equal(ms.stableExpenseKey, true);
  assert.equal(ms.financePersonIdentity, false);
  assert.equal(ms.rawFirst, true);
  assert.equal(ms.revisionActivated, true);
});

test('P17 does not silently invent PR identity', () => {
  const pr = result.items.find((x: any) => x.house === 'PR');
  assert.ok(pr);
  assert.notEqual(pr.status, 'READY');
  assert.equal(pr.noNameOnlyMatch, true);
  assert.match(String(pr.source), /assembleia\.pr\.leg\.br/);
});

