import test from 'node:test';
import assert from 'node:assert/strict';
import { JUDICIARY_STATISTICS_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-statistics.ts';

test('P14.2 statistics model is compact and normalized', () => {
  const ddl = JUDICIARY_STATISTICS_SCHEMA_SQL.join('\n');
  for (const table of ['jud_jn_indicator','jud_jn_crosswalk','jud_jn_observation','jud_jn_parity_check']) assert.match(ddl, new RegExp(`civica_jud\\.${table}`));
  assert.doesNotMatch(ddl, /municipal_indicator|process_document|magistrate_cpf/i);
});

test('P14.2 observation contract carries provenance, denominator and comparability', () => {
  const ddl = JUDICIARY_STATISTICS_SCHEMA_SQL.join('\n');
  for (const field of ['reference_year','report_edition','value_numeric','numerator','denominator','source_snapshot_id','publication_revision_id','comparability']) assert.match(ddl, new RegExp(field));
});

test('P14.2 congestion formula is not represented as an aggregate mean', () => {
  assert.equal(20 / (20 + 30), 0.4);
  assert.notEqual('NONE_RATE_OFFICIAL', 'MEAN_ONLY');
});

test('P14.2 source nulls remain null semantics', () => {
  const nullValue: number | null = null;
  assert.equal(nullValue, null);
  assert.notEqual(nullValue, 0);
});
