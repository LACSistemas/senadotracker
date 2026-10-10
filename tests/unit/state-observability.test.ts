import assert from 'node:assert/strict';
import test from 'node:test';
import { completenessPercentage, projectDimensions } from '../../apps/collector/src/state/observability.ts';
import type { CoverageManifest } from '../../apps/collector/src/state/contracts.ts';

const manifest = (capability: string, recordsFound: number): CoverageManifest => ({
  house: 'RO' as CoverageManifest['house'],
  provider: 'sapl' as CoverageManifest['provider'],
  domain: capability === 'proposals' ? 'legislative' : 'identity',
  capability,
  sourceExists: true,
  endpointExists: true,
  payloadAvailable: true,
  relationshipResolved: true,
  historicalVerified: false,
  consumable: true,
  earliestRecordDate: null,
  latestRecordDate: null,
  checkedAt: '2026-10-02T00:00:00.000Z',
  availability: 'available',
  recordsFound,
  recordsExpected: null,
  recordsResolved: recordsFound,
});

test('P2 never invents a completeness denominator', () => {
    assert.equal(completenessPercentage(24, null), null);
    assert.equal(completenessPercentage(24, undefined), null);
    assert.equal(completenessPercentage(24, 0), null);
    assert.equal(completenessPercentage(24, 24), 1);
  });

test('P2 projects six product dimensions and keeps uncollected financial dimensions explicit', () => {
    const cells = projectDimensions([manifest('people', 24), manifest('mandates', 24), manifest('proposals', 25)], { identity: 'rev-i', legislative: 'rev-l' }, 'run-1');
    assert.equal(cells.length, 6);
    assert.equal(cells.find(cell => cell.dimension === 'name')?.status, 'CONSUMABLE');
    assert.equal(cells.find(cell => cell.dimension === 'name')?.completenessPercentage, null);
    assert.equal(cells.find(cell => cell.dimension === 'cabinet')?.status, 'NOT_COLLECTED');
    assert.equal(cells.find(cell => cell.dimension === 'parliamentary_allowance')?.status, 'NOT_COLLECTED');
  });
