import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectorRuntime, InMemoryCollectorLock, carryForwardStableEnrichment, evaluateSchema, reconcileSnapshot, type CollectorProvider, type RevisionAdapter } from '../../apps/collector/src/core/index.ts';

type Item = { id: string; value: number; enrichment?: string };
const provider: CollectorProvider<readonly Item[], readonly Item[], Item> = {
  manifest: { house: 'TEST', domain: 'finance', provider: 'fixture', providerVersion: 'v1', collectionModel: 'SNAPSHOT', source: { url: 'fixture://core', format: 'json' }, schemaPolicy: { version: 'v1', unknownDrift: 'FAIL_CLOSED' }, revisionScope: 'TEST:finance' },
  async fetch() { return [{ id: 'a', value: 1 }]; },
  validateSource() { return { ok: true }; },
  async parse(source) { return source; },
  async canonicalize(parsed) { return parsed; },
  validateCanonical() { return { ok: true }; },
  logicalId(value) { return value.id; },
};

test('core snapshot reconciliation preserves duplicate multiplicity and detects no-op', () => {
  const same = reconcileSnapshot([{ id: 'a', value: 1 }, { id: 'a', value: 2 }], [{ id: 'a', value: 1 }, { id: 'a', value: 2 }], x => x.id, x => x.value);
  assert.equal(same.noOp, true); assert.equal(same.duplicateLogicalIds, 2);
  const delta = reconcileSnapshot([{ id: 'a', value: 1 }], [{ id: 'a', value: 2 }, { id: 'b', value: 1 }], x => x.id, x => x.value);
  assert.equal(delta.changed, 1); assert.equal(delta.added, 1);
});

test('core schema drift fails closed', () => {
  const result = evaluateSchema({ expectedVersion: 'v1', observedVersion: 'v2', expectedFields: ['id'], observedFields: ['id'], unknownDrift: 'FAIL_CLOSED' });
  assert.equal(result.status, 'PROVIDER_VERSION_REQUIRED');
});

test('generic enrichment carry-forward does not know finance fields', () => {
  const result = carryForwardStableEnrichment([{ id: 'a', value: 1, enrichment: 'stable' }], [{ id: 'a', value: 2 }], x => x.id, x => x.enrichment, (x, e) => ({ ...x, enrichment: e }));
  assert.equal(result[0]?.enrichment, 'stable');
});

test('core runtime no-op and publication transaction boundary', async () => {
  const calls: string[] = []; const revision: RevisionAdapter<readonly Item[]> = { async getActiveRevision() { return 'before'; }, async stageRevision() { calls.push('stage'); }, async validateStage() { calls.push('validate'); }, async promoteRevisionAtomically() { calls.push('promote'); }, async preservePreviousRevision() { calls.push('preserve'); } };
  const runtime = new CollectorRuntime();
  const noOp = await runtime.run(provider, { runId: 'r1', house: 'TEST', domain: 'finance', provider: 'fixture', providerVersion: 'v1', startedAt: new Date().toISOString() }, [{ id: 'a', value: 1 }], revision);
  assert.equal(noOp.status, 'NO_OP'); assert.deepEqual(calls, []);
  const published = await runtime.run(provider, { runId: 'r2', house: 'TEST', domain: 'finance', provider: 'fixture', providerVersion: 'v1', startedAt: new Date().toISOString() }, [], revision);
  assert.equal(published.status, 'PUBLISHED'); assert.deepEqual(calls, ['stage', 'validate', 'promote', 'preserve']);
});

test('independent lock keys do not serialize each other', async () => {
  const lock = new InMemoryCollectorLock(); let active = 0; let max = 0;
  await Promise.all(['SC', 'MS'].map(house => lock.withLock({ house, domain: 'finance', provider: 'p' }, async () => { active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; })));
  assert.equal(max, 2);
});
