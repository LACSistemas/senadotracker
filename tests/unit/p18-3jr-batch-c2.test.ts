import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const result = JSON.parse(fs.readFileSync(new URL('../../artifacts/P18_3jr_batch_c2.json', import.meta.url), 'utf8')) as any;

test('P18.3JR C2 uses the canonical 14-house pre-counter and five local steps', () => {
  assert.equal(result.databaseGuard.currentDatabase, 'civica_postgres_lab');
  assert.equal(result.strictNationalOperationalBefore, 14);
  assert.deepEqual(result.strictNationalOperationalHousesBefore, ['SC','SP','CE','PE','ES','AP','MG','MS','TO','AM','SE','BA','DF','PA']);
  assert.deepEqual(result.targets, ['MA','RO','RS','PI','GO']);
  assert.equal(result.localExecutableStepsBeforeC2, 5);
  assert.equal(result.aggregateParity, 'PASS');
  assert.equal(result.nationalCounterParity, 'PASS');
});

test('C2 never publishes an incomplete provider and has zero duplicate insertions', () => {
  for (const [house, row] of Object.entries(result.results) as any) {
    assert.equal(row.publication.duplicateInsertions, 0, house);
    if (row.result !== 'OPERATIONALLY_PROVEN') assert.equal(row.publication.status, 'NOT_PUBLISHED', house);
  }
  assert.equal(result.results.MA.competenceCompleteness, false);
  assert.equal(result.results.GO.degradedPartitionSafe, false);
  assert.equal(result.results.PI.paginationExhausted, false);
  assert.equal(result.integrity.productionTouched, false);
  assert.equal(result.integrity.projectEleitorDbTouched, false);
  assert.equal(result.integrity.sqliteTouched, false);
});
