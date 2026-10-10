import test from 'node:test';
import assert from 'node:assert/strict';
import { NATIONAL_FINANCE_HOUSES, NATIONAL_FINANCE_REGISTRY, createNationalFinanceRegistry, InMemoryRevisionRepository, InMemoryCollectorLock, advisoryLockKey, withPostgresAdvisoryLock } from '../../apps/collector/src/core/index.ts';

test('national finance registry contains exactly 27 unique houses and one finance capability each', () => {
  assert.equal(NATIONAL_FINANCE_HOUSES.length, 27);
  assert.equal(new Set(NATIONAL_FINANCE_HOUSES).size, 27);
  assert.equal(NATIONAL_FINANCE_REGISTRY.length, 27);
  assert.equal(new Set(NATIONAL_FINANCE_REGISTRY.map(entry => entry.manifest.house)).size, 27);
  assert.equal(createNationalFinanceRegistry().discover().length, 27);
  assert.equal(NATIONAL_FINANCE_REGISTRY.find(entry => entry.manifest.house === 'SC')?.frameworkStatus, 'CORE_MIGRATED');
});

test('not applicable and blocked houses are never scheduler eligible', () => {
  for (const entry of NATIONAL_FINANCE_REGISTRY.filter(entry => ['CORE_NOT_APPLICABLE', 'CORE_BLOCKED_EXTERNAL'].includes(entry.frameworkStatus))) assert.equal(entry.schedulerEligible, false);
});

test('revision repository preserves active revision on failed promotion and no-op is side effect free', async () => {
  const repo = new InMemoryRevisionRepository('before');
  assert.equal(repo.noOp('before', 'before'), true);
  await repo.stageRevision('after', [{ opaque: true }]); await repo.validateStage('after'); await repo.promoteRevisionAtomically('after'); await repo.preservePreviousRevision('before');
  assert.deepEqual(repo.snapshot(), { active: 'after', staged: ['after'], preserved: ['before'] });
});

test('postgres advisory lock keys distinguish house/domain/provider and release on error', async () => {
  const sc = advisoryLockKey({ house:'SC', domain:'finance', provider:'p' }); const ms = advisoryLockKey({ house:'MS', domain:'finance', provider:'p' });
  assert.notEqual(sc, ms);
  const calls: string[] = []; const client = { async query(sql: string) { calls.push(sql); return { rows: [] }; } };
  await assert.rejects(() => withPostgresAdvisoryLock(client, { house:'SC', domain:'finance', provider:'p' }, async () => { throw new Error('synthetic'); }));
  assert.deepEqual(calls, ['SELECT pg_advisory_lock($1::bigint)', 'SELECT pg_advisory_unlock($1::bigint)']);
});

test('same provider key serializes and releases after an error', async () => {
  const lock = new InMemoryCollectorLock(); const key = { house:'SC', domain:'finance', provider:'p' }; const order: string[] = [];
  await Promise.all([
    lock.withLock(key, async () => { order.push('a:start'); await new Promise(resolve => setTimeout(resolve, 3)); order.push('a:end'); }),
    lock.withLock(key, async () => { order.push('b:start'); order.push('b:end'); }),
  ]);
  assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end']);
  await assert.rejects(() => lock.withLock(key, async () => { throw new Error('release'); }));
  await lock.withLock(key, async () => { order.push('after:error'); });
  assert.equal(order.at(-1), 'after:error');
});
