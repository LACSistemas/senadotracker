import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'artifacts');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const lateral = ['parliamentary_allowance', 'suppliers', 'parliamentary_compensation', 'cabinet', 'staff', 'daily_allowances', 'travel', 'contracts', 'procurement'];
const sourceStatuses = new Set(['STRUCTURED_SOURCE_CONFIRMED', 'PUBLIC_SOURCE_CONFIRMED', 'SOURCE_PRESENT_UNSTRUCTURED', 'SOURCE_PRESENT_ACCESS_RESTRICTED', 'SOURCE_PRESENT_HITL_REQUIRED', 'SOURCE_PRESENT_NETWORK_BLOCKED']);

test('P16.2 has proof-scoped 675-cell closure with zero semantic gates', () => {
  const result = read('p16_2_results.json');
  assert.equal(result.P16_2, 'PASS');
  assert.equal(result.P16, 'CLOSED');
  assert.equal(result.NATIONAL_CAPABILITY_CENSUS, 'RELIABLE');
  assert.equal(result.READY_FOR_P17, 'YES');
  assert.equal(result.READY_FOR_NATIONAL_BACKFILL, 'NO');
  assert.equal(result.gates.CAPABILITY_CELLS, 675);
  for (const [name, value] of Object.entries(result.gates)) {
    if (name.includes('WITHOUT_') || name.includes('PROPAGATION') || name.includes('INDEPENDENCE') || name.includes('MISMATCHES') || name.includes('CONTRADICTIONS') || name.endsWith('_GT_PROPOSAL_SOURCE')) assert.equal(value, 0, name);
  }
  assert.equal(result.metrics.capabilitiesSourceConfirmed + result.metrics.capabilitiesSourceNotYetProven + result.metrics.capabilitiesNotFoundAfterExhaustion, 675);
});

test('P16.2 does not promote generic provider pages or SAPL into lateral capabilities', () => {
  const matrix = read('p16_2_capability_matrix.json');
  assert.equal(matrix.length, 675);
  for (const row of matrix) {
    if (sourceStatuses.has(row.availabilityStatus)) {
      assert.equal(row.proofScope, 'CAPABILITY', `${row.house}:${row.capability}`);
      assert.ok(row.evidence.some((entry: any) => (entry.whatItProves ?? []).includes('CAPABILITY_SOURCE_EXISTS')), `${row.house}:${row.capability}`);
    }
  }
  const ac = matrix.filter((row: any) => row.house === 'AC' && lateral.includes(row.capability));
  assert.equal(ac.length, lateral.length);
  assert.ok(ac.every((row: any) => row.availabilityStatus === 'SOURCE_NOT_YET_PROVEN'));
  assert.ok(ac.every((row: any) => row.primarySourceProvider === null && row.accessMode === 'NOT_PROVEN' && row.automationMode === 'UNPROVEN'));
});

test('P16.2 preserves the independent MS CEAP and SGPLE classifications', () => {
  const matrix = read('p16_2_capability_matrix.json');
  const ms = (capability: string) => matrix.find((row: any) => row.house === 'MS' && row.capability === capability);
  const allowance = ms('parliamentary_allowance');
  assert.equal(allowance.availabilityStatus, 'STRUCTURED_SOURCE_CONFIRMED');
  assert.equal(allowance.accessMode, 'DIRECT_CSV');
  assert.equal(allowance.sampleRecordsObserved, 4834);
  assert.equal(allowance.stableExpenseKeyPresent, true);
  assert.equal(allowance.stableFinancePersonIdentity, false);
  assert.equal(allowance.financePersonCrosswalkProven, false);
  const suppliers = ms('suppliers');
  assert.equal(suppliers.sampleRecordsObserved, 1340);
  assert.equal(suppliers.supplierTaxIdsPresent, true);
  assert.equal(suppliers.supplierTaxIdCount, 1053);
  for (const capability of ['proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']) {
    const row = ms(capability);
    assert.equal(row.availabilityStatus, 'SOURCE_PRESENT_HITL_REQUIRED', capability);
    assert.equal(row.accessMode, 'POW_CAPTCHA_HITL', capability);
    assert.equal(row.HITLRequired, true, capability);
  }
});

test('P16.2 preserves prior artifacts and proves read-only database integrity', () => {
  const result = read('p16_2_results.json');
  assert.deepEqual(result.preservation, {
    P12_PRESERVED: true,
    P13_PRESERVED: true,
    P14_PRESERVED: true,
    P15_CE_PRESERVED: true,
    P16_ORIGINAL_ARTIFACTS_PRESERVED: true,
    P16_1_ARTIFACTS_PRESERVED: true,
    MS_CEAP_CORRECTION_PRESERVED: true,
    MS_SGPLE_HITL_ISOLATION_PRESERVED: true,
  });
  assert.equal(result.dbIntegrity.database, 'civica_postgres_lab');
  assert.equal(result.dbIntegrity.DB_ROWS_CHANGED, 0);
  assert.equal(result.dbIntegrity.ACTIVE_REVISIONS_CHANGED, 0);
  assert.equal(result.dbIntegrity.SCHEMA_CHANGED, 0);
  assert.equal(result.dbIntegrity.productionTouched, 'NO');
  assert.equal(result.dbIntegrity.projetoeleitorDbTouched, 'NO');
  assert.equal(result.dbIntegrity.sqliteTouched, 'NO');
  assert.ok(read('p16_2_classification_changes.json').length > 0);
  assert.ok(fs.existsSync(path.join(root, 'p16')));
  assert.ok(fs.existsSync(path.join(root, 'p16_1')));
});
