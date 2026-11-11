import test from 'node:test';
import assert from 'node:assert/strict';
import { JUDICIARY_SCHEMA, JUDICIARY_SCHEMA_SQL } from '../../packages/db/src/postgres-judiciary.ts';

test('P14.1 schema is institutional-only and separate from process ingestion', () => {
  assert.equal(JUDICIARY_SCHEMA, 'civica_jud');
  const ddl = JUDICIARY_SCHEMA_SQL.join('\n');
  for (const table of ['jud_branch', 'jud_degree', 'jud_tribunal', 'jud_unit', 'jud_external_id', 'jud_territorial_relation', 'jud_source_snapshot', 'jud_publication_revision']) {
    assert.match(ddl, new RegExp(`civica_jud\\.${table}`));
  }
  assert.doesNotMatch(ddl, /datajud|process|moviment|partes/i);
});

test('P14.1 schema preserves source/native and physical-vs-jurisdiction separation', () => {
  const ddl = JUDICIARY_SCHEMA_SQL.join('\n');
  assert.match(ddl, /physical_municipality_source_code/);
  assert.match(ddl, /physical_entity_id/);
  assert.match(ddl, /relation_kind/);
  assert.match(ddl, /territory_entity_id/);
});
