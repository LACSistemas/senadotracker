import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = process.cwd();
const read = (file: string): any => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('P6.1 publishes a complete national public coverage matrix', () => {
  const report = read('artifacts/state_coverage_operational_p6.json');
  const rows = report.dimensions as any[];
  const expected = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'].sort();
  assert.equal(rows.length, 162);
  assert.equal(new Set(rows.map(row => row.house)).size, 27);
  for (const house of new Set(rows.map(row => row.house))) assert.deepEqual(rows.filter(row => row.house === house).map(row => row.dimension).sort(), expected);
});

test('P6.1 projection agrees with rollout counts and preserves untouched houses', () => {
  const report = read('artifacts/state_coverage_operational_p6.json');
  const base = read('artifacts/state_coverage_operational_p5.json');
  const rollout = read('artifacts/p6_sapl_rollout_results.json');
  for (const house of ['RO', 'PR', 'AP', 'ES']) assert.deepEqual(report.dimensions.filter((row: any) => row.house === house), base.dimensions.filter((row: any) => row.house === house));
  for (const item of rollout.rows) {
    const row = (dimension: string) => report.dimensions.find((value: any) => value.house === item.house && value.dimension === dimension);
    assert.equal(row('name').recordsFound, item.controlledCorpus.persons);
    assert.equal(row('party').recordsFound, item.controlledCorpus.memberships);
    assert.equal(row('mandate_history').recordsFound, item.controlledCorpus.mandates);
    assert.equal(row('proposals').primaryRecordsFound, item.controlledCorpus.proposals);
    assert.equal(row('proposals').components.authorship.recordsFound, item.controlledCorpus.authors);
    assert.equal(row('proposals').components.movements.recordsFound, item.controlledCorpus.movements);
    assert.equal(row('proposals').activeRevisionId, item.revisions.legislative);
  }
});
