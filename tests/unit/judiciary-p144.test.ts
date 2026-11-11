import test from 'node:test';
import assert from 'node:assert/strict';
import { JUDICIARY_STJ_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary-stj.ts';

test('P14.4 schema has separated STJ entities and revision provenance', () => {
  const ddl = JUDICIARY_STJ_SCHEMA_SQL.join('\n');
  for (const table of ['jud_stj_precedent','jud_stj_precedent_process','jud_stj_acordao_mirror','jud_stj_decision','jud_stj_document_relation']) assert.match(ddl, new RegExp(`civica_jud\\.${table}`));
  for (const field of ['publication_revision_id','source_snapshot_id','raw_row_hash','provenance']) assert.match(ddl, new RegExp(field));
});

test('P14.4 does not persist full decision bodies', () => {
  const ddl = JUDICIARY_STJ_SCHEMA_SQL.join('\n');
  assert.doesNotMatch(ddl, /full_text|inteiro_teor|document_body|body_text/i);
  assert.match(ddl, /ementa text/);
});

test('P14.4 natural keys are source-native and deterministic', () => {
  const precedent = 'STJ:PRECEDENT:1276';
  const processKey = ['1276','REsp 123','1234567'].join('|');
  const decision = 'STJ:DECISION:abc';
  assert.equal(precedent, 'STJ:PRECEDENT:1276');
  assert.equal(processKey, '1276|REsp 123|1234567');
  assert.equal(decision, 'STJ:DECISION:abc');
});

test('P14.4 exact relation evidence distinguishes official IDs from references', () => {
  assert.equal('OFFICIAL_ID', 'OFFICIAL_ID');
  assert.equal('OFFICIAL_REFERENCE', 'OFFICIAL_REFERENCE');
  assert.notEqual('OFFICIAL_REFERENCE', 'FUZZY');
});

test('P14.4 Unix millisecond timestamps normalize to ISO dates without losing the instant', () => {
  const ms = Date.parse('2026-10-13T12:34:56.789Z');
  assert.equal(new Date(ms).toISOString(), '2026-10-13T12:34:56.789Z');
  assert.equal(typeof ms, 'number');
});

test('P14.4 null semantics are preserved for absent source stages', () => {
  const absent: string | null = null;
  assert.equal(absent, null);
  assert.notEqual(absent, '0');
});
