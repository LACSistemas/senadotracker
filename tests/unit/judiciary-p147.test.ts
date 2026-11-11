import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('packages/db/src/postgres-judiciary-serving.ts', 'utf8');

test('P14.7 serving exposes typed availability and provenance', () => {
  assert.match(source, /AvailabilityState/);
  assert.match(source, /provenance/);
  assert.match(source, /PARTIAL_COVERAGE/);
  assert.match(source, /UNVERIFIED_RELATION/);
});

test('P14.7 does not create national rate aggregations', () => {
  assert.match(source, /METHOD_INCOMPATIBLE/);
  assert.doesNotMatch(source, /avg\(o\.value_numeric\).*CONGESTION/);
});

test('P14.7 keeps territorial facts physical and avoids municipal imputation', () => {
  assert.match(source, /physical_entity_id IS NOT NULL/);
  assert.match(source, /LocalizaÃ§Ã£o fÃ­sica nÃ£o equivale a jurisdiÃ§Ã£o|Localização física não equivale a jurisdição/);
});

test('P14.7 paginates institutional and STJ explorers', () => {
  assert.match(source, /LIMIT \$\$\{listArgs\.length-1\} OFFSET \$\$\{listArgs\.length\}/);
  assert.match(source, /getJudiciaryStjPrecedents/);
});
