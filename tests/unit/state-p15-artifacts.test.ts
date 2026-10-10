import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'artifacts');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

test('P15 records the CE/MS closure boundary and target guard', () => {
  const r = read('p15_results.json');
  assert.equal(r.P15, 'WAITING_FOR_MANUAL_CONTRACT_CAPTURE');
  assert.equal(r.database, 'civica_postgres_lab');
  assert.equal(r.schema, 'civica_state');
  assert.equal(r.operationalHousesBefore, 25);
  assert.equal(r.newOperationalHouses, 1);
  assert.equal(r.operationalHousesAfter, 26);
  assert.deepEqual(r.remainingHouses, ['MS']);
  assert.equal(r.PRODUCTION_TOUCHED, 'NO');
  assert.equal(r.PROJETOELEITOR_DB_TOUCHED, 'NO');
  assert.equal(r.SQLITE_TOUCHED, 'NO');
  assert.equal(r.NEW_REGRESSIONS, 0);
});

test('P15 persists CE identity and party with stable provider keys and replay', () => {
  const r = read('p15_results.json').CE;
  assert.equal(r.identity.recordsObserved, 52);
  assert.equal(r.identity.recordsWritten, 52);
  assert.equal(r.identity.recordsResolved, 52);
  assert.equal(r.identity.replay, 'PASS');
  assert.equal(r.identity.stableProviderIdentity, true);
  assert.equal(r.identity.nameOnlyMatches, 0);
  assert.match(r.identity.revision, /^state:CE:identity:/);
  assert.equal(r.currentParty.recordsWritten, 52);
  assert.equal(r.currentParty.replay, 'PASS');
  assert.match(r.currentParty.revision, /^state:CE:party:/);
  assert.equal(r.finance.expensesWritten, 0);
  assert.equal(r.finance.blocker, 'FINANCE_NATURAL_KEY_UNPROVEN');
});

test('P15 stops MS at the legitimate SGPLE CAPTCHA boundary', () => {
  const r = read('p15_results.json');
  const ms = r.MS;
  const sgple = read('p15_ms_sgple_contract.json');
  const manual = read('p15_manual_capture_request.json');
  assert.equal(ms.identity.status, 'NOT_PROVEN');
  assert.equal(ms.legislative.status, 'WAITING_FOR_MANUAL_CONTRACT_CAPTURE');
  assert.equal(ms.sgple.manualF12Required, true);
  assert.equal(sgple.shell.status, 200);
  assert.equal(sgple.captcha.challengeStatus, 200);
  assert.equal(sgple.captcha.protectedEndpointStatus, 403);
  assert.equal(sgple.captcha.programmaticAccess, 'BLOCKED_BY_POW_CAPTCHA');
  assert.equal(manual.house, 'MS');
  assert.match(manual.pageToOpen, /sgpl-publico/);
  assert.match(manual.requestPattern, /proposicoes|proponente/);
});

test('P15 projects exactly 27 houses and 162 capability cells', () => {
  const coverage = read('state_coverage_operational_p15.json');
  assert.equal(coverage.database, 'civica_postgres_lab');
  assert.equal(coverage.expectedCells, 162);
  assert.equal(new Set(coverage.dimensions.map((row: { house: string }) => row.house)).size, 27);
  assert.deepEqual(coverage.projection.p15OperationalizedHouses, ['CE']);
  assert.deepEqual(coverage.projection.p15ExternalBlockerHouses, ['MS']);
  assert.equal(coverage.projection.operationalHouses, 26);
  assert.deepEqual(coverage.projection.remainingHouses, ['MS']);
});
