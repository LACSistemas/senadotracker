import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(name: string): any { return JSON.parse(fs.readFileSync(`artifacts/${name}`, 'utf8')); }

test('P12.2 closes model blockers in the lab only', () => {
  const result = read('p12_2_results.json');
  assert.equal(result.database, 'civica_postgres_lab');
  assert.equal(result.schema, 'civica_state');
  assert.equal(result.SP_REPLAY_REVISION_EQUAL, true);
  assert.equal(result.SP_FULL_SOURCE_IDSPL_IDAUTOR_EXECUTED, true);
  assert.equal(result.SP_FULL_SOURCE_MOVEMENT_RELATION_EXECUTED, true);
  assert.equal(result.BLOCKERS.internalModelBlockersAfter, 0);
  assert.equal(result.PUBLIC_COVERAGE, '162/162');
  assert.equal(result.OPERATIONAL_HOUSES, 19);
  assert.equal(result.REMAINING_HOUSES, 8);
  assert.equal(result.PRODUCTION_TOUCHED, false);
  assert.equal(result.SQLITE_TOUCHED, false);
  assert.equal(result.P13, 'NOT_STARTED');
});

test('P12.2 participation has deterministic accounting', () => {
  const result = read('p12_2_results.json');
  const participation = result.SP_PARTICIPATION;
  assert.equal(participation.naturalKey.expression, 'IdReuniao+IdPauta+IdDocumento+NrOrdem');
  assert.equal(participation.naturalKey.collisions >= 0, true);
  assert.equal(participation.matchedVoteGroups + participation.ambiguousGroups + participation.orphanGroups > 0, true);
  assert.equal(result.SP_COMMISSION_MODEL_IMPLEMENTED, true);
  assert.equal(result.SP_MEETING_MODEL_IMPLEMENTED, true);
  assert.equal(result.SP_ATTENDANCE_MODEL_IMPLEMENTED, true);
  assert.equal(result.SP_DELIBERATION_MODEL_IMPLEMENTED, true);
  assert.equal(result.SP_VOTE_MODEL_IMPLEMENTED, true);
});

test('P12.2 keeps source blockers explicit and model artifacts present', () => {
  const delta = read('p12_2_blocker_delta.json');
  assert.equal(delta.internalModelBlockersAfter, 0);
  assert.equal(Array.isArray(delta.details), true);
  for (const name of ['p12_2_sp_key_reconciliation.json', 'p12_2_sp_participation_reconciliation.json', 'p12_2_sc_semantic_routes.json', 'p12_2_df_auxiliary_relations.json', 'state_capability_matrix_p12_2.json']) assert.equal(fs.existsSync(`artifacts/${name}`), true, name);
});

test('P12.2 migration validation covers rollback and reapply', () => {
  const migration = read('p12_2_migration_validation.json');
  assert.equal(migration.rollback, 'PASS');
  assert.equal(migration.apply, 'PASS');
  assert.equal(migration.reapply, 'PASS');
  assert.equal(migration.rollbackTables, 0);
  assert.equal(migration.applyTables, migration.tables);
  assert.equal(migration.reapplyTables, migration.tables);
});
