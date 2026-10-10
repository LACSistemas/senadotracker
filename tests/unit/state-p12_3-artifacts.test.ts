import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(name: string): any { return JSON.parse(fs.readFileSync(`artifacts/${name}`, 'utf8')); }

test('P12.3 is scoped to the laboratory and never publishes unresolved votes', () => {
  const result = read('p12_3_results.json');
  assert.equal(result.DATABASE, 'civica_postgres_lab');
  assert.equal(result.SCHEMA, 'civica_state');
  assert.equal(result.SQLITE_TOUCHED, 'NO');
  assert.equal(result.PRODUCTION_TOUCHED, 'NO');
  assert.equal(result.NO_AMBIGUOUS_VOTE_PUBLISHED_AS_RESOLVED, true);
  assert.equal(result.NO_ORPHAN_VOTE_PUBLISHED_AS_RESOLVED, true);
  assert.equal(result.STALE_IMPLEMENTATION_BLOCKERS, 0);
  assert.equal(result.CROSS_ARTIFACT_COUNT_MISMATCHES, 0);
  assert.equal(result.P13, 'NOT_STARTED');
});

test('P12.3 artifacts agree on active participation revision', () => {
  const result = read('p12_3_results.json');
  const participation = read('p12_3_sp_participation_reconciliation.json');
  const consistency = read('p12_3_artifact_consistency.json');
  assert.equal(participation.newRevision, result.database.SP.revision);
  assert.equal(consistency.revisionMismatches, 0);
  assert.equal(consistency.countMismatches, 0);
  assert.equal(participation.publishedVotes, 0);
  assert.equal(participation.canonicalDeliberations, result.database.SP.deliberations);
  assert.notEqual(participation.newRevision, 'state:SP:participation:f4278b1a6c4247c65e337a45748c4e8c41eaaca77af2d560da82f61f40bb628e');
});

test('P12.3 projection truth is explicit for SC and DF', () => {
  const sc = read('p12_3_sc_projection_reconciliation.json');
  const df = read('p12_3_df_unit_cabinet_reconciliation.json');
  assert.equal(sc.documents, 42);
  assert.equal(sc.duplicateSlugs, 0);
  assert.deepEqual(sc.zeroResultRoutes.sort(), ['comissoes-tramitar', 'emendas', 'reunioes']);
  assert.equal(df.cabinetStatus, 'SOURCE_PRESENT + PERSON_UNIT_CROSSWALK_UNPROVEN');
});

test('P12.3 cross-format schema records JSON and alternate-format probes', () => {
  const schema = read('p12_3_sp_cross_format_schema.json');
  assert.equal(schema.provider, 'alesp_open_data');
  for (const name of ['authors', 'movements', 'participation']) {
    assert.ok(Array.isArray(schema.resources[name].formats));
    assert.ok(schema.resources[name].formats.length >= 2);
  }
});

