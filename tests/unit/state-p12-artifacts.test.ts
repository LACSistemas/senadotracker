import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const result = JSON.parse(fs.readFileSync('artifacts/p12_results.json', 'utf8')) as any;
const coverage = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p12.json', 'utf8')) as any;
const evidence = JSON.parse(fs.readFileSync('artifacts/p12_source_evidence.json', 'utf8')) as any;

test('P12 artifacts prove target, coverage, operationalization and replay', () => {
  assert.equal(result.P12, 'PASS');
  assert.equal(result.database, 'civica_postgres_lab');
  assert.equal(result.schema, 'civica_state');
  assert.equal(result.coverageRows, 162);
  assert.equal(result.houses, 27);
  assert.equal(result.totalOperationalHouses, 19);
  assert.equal(result.remainingHouses, 8);
  assert.equal(result.NOT_COLLECTED_WITH_REVISION_ARTIFACT, 0);
  assert.equal(result.NOT_COLLECTED_WITH_REVISION_DB, 0);
  assert.equal(result.providers.SP.replay.stable, true);
  assert.equal(result.providers.SC.replay.stable, true);
  assert.equal(result.providers.DF.replay.stable, true);
  assert.equal(coverage.dimensions.length, 162);
});

test('P12 source evidence contains no CLDF private fields', () => {
  const text = JSON.stringify(evidence);
  assert.equal(text.includes('secret'), false);
  assert.equal(text.includes('10.0.0.1'), false);
  assert.deepEqual(evidence.providers.DF.redactedPaths, ['loginRede', 'ipUsuario']);
});
