import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'artifacts');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

const houses = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const notFound = 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION';

test('P16.1 closes the 675-cell census without semantic contradictions', () => {
  const result = read('p16_1_results.json');
  assert.equal(result.P16_1, 'PASS');
  assert.equal(result.P16, 'CLOSED');
  assert.equal(result.NATIONAL_CAPABILITY_CENSUS, 'RELIABLE');
  assert.equal(result.READY_FOR_P17, 'YES');
  assert.equal(result.READY_FOR_NATIONAL_BACKFILL, 'NO');
  assert.equal(result.gates.CAPABILITY_CELLS, 675);
  assert.equal(result.gates.HOUSES_REVIEWED, 27);
  for (const [name, value] of Object.entries(result.gates)) {
    if (name.endsWith('MISMATCHES') || name.startsWith('NOT_FOUND_') || name.endsWith('CONTRADICTIONS')) assert.equal(value, 0, name);
  }
  assert.deepEqual(result.preservation, {
    P12_PRESERVED: true,
    P13_PRESERVED: true,
    P14_PRESERVED: true,
    P15_CE_PRESERVED: true,
    P16_ORIGINAL_ARTIFACTS_PRESERVED: true,
  });
});

test('P16.1 keeps capability evidence independent and classifies MS CEAP separately', () => {
  const matrix = read('p16_1_capability_matrix.json');
  assert.equal(matrix.length, 675);
  assert.ok(matrix.every((row: any) => {
    const contradictory = row.availabilityStatus === notFound && (row.sampleRecordsObserved > 0 || row.stableKeyPresent || row.currentImplementation === 'IMPLEMENTED' || row.currentImplementation === 'PARTIAL' || row.revisionId);
    return !contradictory;
  }));
  assert.ok(matrix.every((row: any) => row.relationshipStatus !== 'NAME_ONLY'));
  const ms = (capability: string) => matrix.find((row: any) => row.house === 'MS' && row.capability === capability);
  const allowance = ms('parliamentary_allowance');
  assert.equal(allowance.availabilityStatus, 'STRUCTURED_SOURCE_CONFIRMED');
  assert.notEqual(allowance.accessMode, 'POW_CAPTCHA_HITL');
  assert.equal(allowance.sampleRecordsObserved, 4834);
  assert.equal(allowance.stableExpenseKeyPresent, true);
  assert.equal(allowance.stableFinancePersonIdentity, false);
  assert.equal(allowance.financePersonCrosswalkProven, false);
  assert.equal(ms('suppliers').sampleRecordsObserved, 1340);
  assert.equal(ms('suppliers').availabilityStatus, 'STRUCTURED_SOURCE_CONFIRMED');
  for (const capability of ['proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']) {
    const row = ms(capability);
    assert.equal(row.accessMode, 'POW_CAPTCHA_HITL', capability);
    assert.equal(row.HITLRequired, true, capability);
  }
  for (const capability of ['cabinet', 'staff', 'parliamentary_compensation', 'daily_allowances', 'travel', 'contracts', 'procurement']) {
    const row = ms(capability);
    assert.notEqual(row.accessMode, 'POW_CAPTCHA_HITL', capability);
    assert.equal(row.sourceIndependentFromMainLegislativeProvider, true, capability);
  }
});

test('P16.1 preserves the original census and read-only database proof', () => {
  assert.ok(fs.existsSync(path.join(root, 'p16')));
  const db = read('p16_1_db_integrity.json');
  assert.equal(db.database, 'civica_postgres_lab');
  assert.equal(db.DB_ROWS_CHANGED, 0);
  assert.equal(db.ACTIVE_REVISIONS_CHANGED, 0);
  assert.equal(db.SCHEMA_CHANGED, 0);
  assert.equal(db.productionTouched, 'NO');
  assert.equal(db.projetoeleitorDbTouched, 'NO');
  assert.equal(db.sqliteTouched, 'NO');
  const changes = read('p16_1_classification_changes.json');
  assert.ok(changes.length > 0);
  const manifest = read('p16_1_house_manifest.json');
  assert.equal(manifest.houses.length, houses.length);
  assert.deepEqual(manifest.houses.map((row: any) => row.house).sort(), [...houses].sort());
});
