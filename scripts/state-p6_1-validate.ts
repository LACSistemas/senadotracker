import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (file: string): any => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const coverage = read('artifacts/state_coverage_operational_p6.json');
const base = read('artifacts/state_coverage_operational_p5.json');
const rollout = read('artifacts/p6_sapl_rollout_results.json');
const dimensions = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'];
const rows = coverage.dimensions;
assert.equal(rows.length, 162);
const houses = [...new Set(rows.map((row: any) => row.house))].sort();
assert.equal(houses.length, 27);
for (const house of houses) assert.deepEqual(rows.filter((row: any) => row.house === house).map((row: any) => row.dimension).sort(), [...dimensions].sort());
for (const row of rows) assert.ok(dimensions.includes(row.dimension));
for (const house of ['RO', 'PR', 'AP', 'ES']) assert.deepEqual(rows.filter((row: any) => row.house === house), base.dimensions.filter((row: any) => row.house === house));
for (const item of rollout.rows) {
  const get = (dimension: string) => rows.find((row: any) => row.house === item.house && row.dimension === dimension);
  assert.equal(get('name').recordsFound, item.controlledCorpus.persons);
  assert.equal(get('party').recordsFound, item.controlledCorpus.memberships);
  assert.equal(get('mandate_history').recordsFound, item.controlledCorpus.mandates);
  const proposals = get('proposals');
  assert.equal(proposals.primaryRecordsFound, item.controlledCorpus.proposals);
  assert.equal(proposals.components.proposals.recordsFound, item.controlledCorpus.proposals);
  assert.equal(proposals.components.authorship.recordsFound, item.controlledCorpus.authors);
  assert.equal(proposals.components.movements.recordsFound, item.controlledCorpus.movements);
  assert.equal(proposals.activeRevisionId, item.revisions.legislative);
  assert.equal(get('name').activeRevisionId, item.revisions.identity);
  assert.equal(get('party').activeRevisionId, item.revisions.identity);
  assert.equal(get('mandate_history').activeRevisionId, item.revisions.identity);
}
const to = rollout.rows.find((row: any) => row.house === 'TO');
assert.equal(to.compatibility, 'COMPATIBLE');
assert.equal(to.reachable, true);
assert.equal(rollout.gates.newRegressions, 0);
console.log(JSON.stringify({ stage: 'P6_1_VALIDATION', rows: rows.length, houses: houses.length, crossArtifactMismatches: 0, unchangedHouses: true, revisionsUnchanged: true, toFinalOperationalStatus: to.compatibility }, null, 2));
