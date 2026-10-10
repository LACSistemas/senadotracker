import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dimensions = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'];
const matrix = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p8_1.json', 'utf8')) as any;
const result = JSON.parse(fs.readFileSync('artifacts/p8_1_ma_alemalegis_results.json', 'utf8')) as any;

test('P8.2 public coverage remains exactly six dimensions for 27 houses', () => {
  assert.equal(matrix.dimensions.length, 162);
  assert.equal(new Set(matrix.dimensions.map((x: any) => x.house)).size, 27);
  for (const house of new Set(matrix.dimensions.map((x: any) => x.house))) assert.deepEqual(matrix.dimensions.filter((x: any) => x.house === house).map((x: any) => x.dimension).sort(), [...dimensions].sort());
  assert.equal(matrix.dimensions.some((x: any) => !dimensions.includes(x.dimension)), false);
});

test('P8.2 MA projection keeps component counts nested and party unknown', () => {
  const ma = Object.fromEntries(matrix.dimensions.filter((x: any) => x.house === 'MA').map((x: any) => [x.dimension, x]));
  assert.equal(ma.name.recordsFound, 10); assert.equal(ma.name.activeRevisionId, result.revisions.identity);
  assert.equal(ma.proposals.primaryRecordsFound, 10); assert.equal(ma.proposals.components.authorship.recordsFound, 9); assert.equal(ma.proposals.components.movements.recordsFound, 29);
  assert.equal(ma.party.status, 'NOT_COLLECTED'); assert.equal(ma.party.recordsFound, null); assert.equal(ma.party.activeRevisionId, null); assert.equal(ma.party.lastSuccessfulRun, null);
  for (const row of matrix.dimensions) if (row.status === 'NOT_COLLECTED') { assert.equal(row.activeRevisionId, null); assert.equal(row.lastSuccessfulRun, null); }
});
