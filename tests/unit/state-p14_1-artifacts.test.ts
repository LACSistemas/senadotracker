import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'artifacts');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

test('P14.1 preserves the four persisted identity revisions and physical target', () => {
  const r = read('p14_1_results.json');
  assert.equal(r.P14_1, 'PASS');
  assert.equal(r.database, 'civica_postgres_lab');
  assert.equal(r.targetSchema, 'civica_state');
  assert.deepEqual(r.identityPreflight.counts, { GO: 49, RJ: 69, RS: 55, SE: 24 });
  assert.equal(r.identityPreflight.duplicateProviderIdentities, 0);
  assert.equal(r.identityPreflight.nameOnlyMatches, 0);
  assert.equal(r.identityPreflight.multipleActiveIdentityRevisions, 0);
  assert.equal(r.gates.PERSISTED_IDENTITY_BUT_RECONCILIATION_BLOCKED, 0);
  assert.equal(r.gates.ACTIVE_REVISION_BUT_RECORDS_WRITTEN_ZERO, 0);
  assert.equal(r.gates.REPLAY_STABLE_BUT_REPLAY_ATTEMPTED_FALSE, 0);
  assert.equal(r.gates.HTTP_200_CLASSIFIED_AS_EXTERNAL_NETWORK_BLOCKER, 0);
  assert.equal(r.gates.UNACCOUNTED_SURFACES, 0);
});

test('P14.1 physical schema audit is fail-closed and fully qualified', () => {
  const audit = read('p14_1_schema_audit.json');
  assert.equal(audit.database, 'civica_postgres_lab');
  assert.equal(audit.targetSchema, 'civica_state');
  assert.equal(audit.writesOutsideCivicaState, 0);
  assert.equal(audit.allP14WrittenTablesPhysicalSchema, true);
  assert.equal(audit.sqlAudit.fullyQualified, true);
  assert.ok(audit.tables.length >= 8);
  assert.ok(audit.tables.every((table: any) => table.physicalSchema === 'civica_state'));
});

test('P14.1 blocker taxonomy does not mislabel accessible HTTP 200 surfaces', () => {
  const b = read('p14_1_blocker_reclassification.json');
  assert.deepEqual(b.http200ExternalNetworkBlockers, []);
  const evidence = read('p14_1_source_evidence.json');
  assert.equal(evidence.rsJson.stableIds, true);
  assert.equal(evidence.seAspNet.dynamicViewState, true);
  assert.ok(evidence.lotus.keysFound.includes('OpenView'));
});

test('P14.1 party snapshots are revisioned and replay stable', () => {
  const p = read('p14_1_party_reconciliation.json');
  assert.equal(p.houses.length, 4);
  for (const row of p.houses) {
    assert.equal(row.status, 'PERSISTED_CURRENT_SNAPSHOT');
    assert.ok(row.recordsWritten > 0);
    assert.equal(row.replay, 'PASS');
    assert.match(row.revisionId, new RegExp(`^state:${row.house}:party:`));
  }
});

test('P14.1 SE parser proves dynamic ASP.NET fields and stable bounded IDs', () => {
  const r = read('p14_1_results.json');
  assert.equal(r.legislative.SE.status, 'PERSISTED_CONTROLLED_CORPUS');
  assert.equal(r.legislative.SE.stableIds, true);
  assert.equal(r.legislative.SE.records, 10);
  assert.equal(r.legislative.SE.recordsExpected, null);
  assert.equal(r.legislative.SE.replay, 'PASS');
  assert.match(r.legislative.SE.revisionId, /^state:SE:legislative:/);
});

test('P14.1 final SE/GO/RJ closure preserves scoped source semantics', () => {
  const r = read('p14_1_results.json');
  const go = r.houses.find((x: any) => x.house === 'GO');
  const goSurface = go.knownSurfaces.find((x: any) => x.surface === 'deputados/em-exercicio');
  assert.equal(goSurface.classification, 'IMPLEMENTED');
  assert.equal(goSurface.blocked, false);
  assert.equal(goSurface.records, 43);
  const rj = r.houses.find((x: any) => x.house === 'RJ');
  assert.equal(rj.probeUrlClassification['https://www3.alerj.rj.gov.br/'].status, 403);
  assert.equal(rj.probeUrlClassification['https://www.alerj.rj.gov.br/Deputados/QuemSao'].status, 200);
  assert.equal(rj.probeUrlClassification['https://www.alerj.rj.gov.br/atividade-parlamentar'].status, 404);
  const evidence = read('p14_1_source_evidence.json');
  const seEvidence = evidence.accessibleSurfaces.find((x: any) => x.house === 'SE');
  assert.equal(seEvidence.legislative.status, 'PERSISTED_CONTROLLED_CORPUS');
  assert.equal(seEvidence.legislative.recordsExpected, null);
  const rjReconciliation = read('p14_1_rj_reconciliation.json');
  const rjPortal = rjReconciliation.knownSurfaces.find((x: any) => x.surface === 'portal homepage');
  assert.equal(rjPortal.http200Source, false);
});
