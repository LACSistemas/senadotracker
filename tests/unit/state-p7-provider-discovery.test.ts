import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = process.cwd();
const read = (file: string): any => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('P7 covers exactly the 16 remaining houses without changing operational coverage', () => {
  const report = read('artifacts/p7_provider_family_clusters.json');
  assert.equal(report.housesInvestigated.length, 16);
  assert.equal(new Set(report.housesInvestigated).size, 16);
  assert.equal(report.operationalCoverageChanged, false);
  assert.equal(report.productionUntouched, true);
  assert.equal(report.sqliteUntouched, true);
  assert.ok(report.clusters.length < 16);
  assert.deepEqual(report.housesInvestigated, ['BA','CE','DF','GO','MA','MG','MS','PA','PB','PE','RJ','RN','RS','SC','SE','SP']);
});

test('P7 keeps capability status separate from operational coverage', () => {
  const report = read('artifacts/p7_provider_family_clusters.json');
  for (const house of report.houses) {
    assert.equal(Object.keys(house.capabilities).length, 6);
    assert.ok(house.family);
    assert.ok(house.evidence.length > 0);
  }
});
