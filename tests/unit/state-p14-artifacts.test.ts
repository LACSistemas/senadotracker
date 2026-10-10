import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function json(name: string): any { return JSON.parse(fs.readFileSync(`artifacts/${name}`, 'utf8').replace(/^\uFEFF/, '')); }

test('P14 targets only GO/RJ/RS/SE and preserves explicit surface exhaustion', () => {
  const result = json('p14_results.json');
  assert.equal(result.database, 'civica_postgres_lab');
  assert.deepEqual(result.targetHouses, ['GO', 'RJ', 'RS', 'SE']);
  assert.equal(result.globalUnaccountedSurfaces, 0);
  assert.deepEqual(result.unaccountedSurfaces, { GO: 0, RJ: 0, RS: 0, SE: 0 });
  assert.equal(result.gates.productionTouched, false);
  assert.equal(result.gates.sqliteTouched, false);
});

test('P14 identity revisions are persisted with deterministic replay evidence', () => {
  const result = json('p14_results.json');
  for (const house of result.houses) {
    assert.equal(house.capabilities.identity.operationalStatus, 'PERSISTED');
    assert.ok(house.capabilities.identity.recordsWritten > 0);
    assert.match(house.capabilities.identity.revisionId, new RegExp(`^state:${house.house}:identity:`));
  }
  const audit = json('p14_revision_audit.json');
  assert.equal(audit.houses.filter((x: any) => x.revisionsCreated === 1).length, 4);
  assert.equal(audit.houses.reduce((n: number, x: any) => n + x.duplicateNaturalKeys, 0), 0);
  assert.equal(audit.houses.reduce((n: number, x: any) => n + x.semanticCollisions, 0), 0);
});

test('P14 keeps the six public dimensions and no empty fake revisions', () => {
  const coverage = json('state_coverage_operational_p14.json');
  assert.equal(coverage.dimensions.length, 162);
  const targets = coverage.dimensions.filter((x: any) => ['GO', 'RJ', 'RS', 'SE'].includes(x.house));
  assert.equal(targets.length, 24);
  for (const row of targets) {
    if (row.dimension === 'name') assert.ok(row.activeRevisionId && row.recordsWritten !== 0);
    else assert.equal(row.activeRevisionId, null);
  }
});

