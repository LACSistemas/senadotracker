import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'artifacts');
const censusRoot = path.join(root, 'p16');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

test('P16 covers all 27 houses and every census capability', () => {
  const result = read('p16_results.json');
  assert.equal(result.P16, 'PASS');
  assert.equal(result.HOUSES_INVESTIGATED, 27);
  assert.equal(result.UNACCOUNTED_HOUSES, 0);
  assert.equal(result.READY_FOR_P17, 'YES');
  assert.equal(result.READY_FOR_NATIONAL_BACKFILL, 'NO');
  const expected = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const files = fs.readdirSync(censusRoot).filter((name) => /^[A-Z]{2}\.json$/.test(name)).sort();
  assert.deepEqual(files, expected.map((house) => `${house}.json`).sort());
  for (const house of expected) {
    const row = JSON.parse(fs.readFileSync(path.join(censusRoot, `${house}.json`), 'utf8'));
    assert.equal(row.house, house);
    assert.equal(Object.keys(row.capabilities).length, 25);
    assert.ok(row.officialSources instanceof Array);
  }
});

test('P16 contains no unknown final statuses or name-only promotion', () => {
  const resultText = fs.readFileSync(path.join(root, 'p16_results.json'), 'utf8');
  const matrixText = fs.readFileSync(path.join(root, 'p16_capability_matrix.json'), 'utf8');
  assert.doesNotMatch(resultText, /"(?:UNKNOWN|TODO|MAYBE)"/);
  assert.doesNotMatch(matrixText, /"(?:UNKNOWN|TODO|MAYBE)"/);
  const matrix = read('p16_capability_matrix.json');
  assert.ok(matrix.every((row: any) => row.relationshipStatus !== 'NAME_ONLY'));
  assert.equal(read('p16_national_collector_requirements.json').HOUSE_FAILURE_PROPAGATION, 'FORBIDDEN');
  assert.equal(read('p16_national_collector_requirements.json').CAPABILITY_FAILURE_PROPAGATION, 'FORBIDDEN_BY_DEFAULT');
});

test('P16 is read-only and preserves prior rollout stages', () => {
  const result = read('p16_results.json');
  const db = read('p16_db_integrity.json');
  assert.equal(db.database, 'civica_postgres_lab');
  assert.equal(db.DB_ROWS_CHANGED, 0);
  assert.equal(db.ACTIVE_REVISIONS_CHANGED, 0);
  assert.equal(db.SCHEMA_CHANGED, 0);
  assert.equal(db.productionTouched, 'NO');
  assert.equal(db.projetoeleitorDbTouched, 'NO');
  assert.equal(db.sqliteTouched, 'NO');
  assert.equal(result.metrics.TOTAL_HOUSES, 27);
});
