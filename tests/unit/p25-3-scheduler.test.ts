import test from 'node:test';
import assert from 'node:assert/strict';
import { checkpointAfterRun, decideScheduler, nextDueAt, providerCadence } from '../../apps/collector/src/core/control-plane/scheduler.ts';
import { NATIONAL_CONTROL_REGISTRY } from '../../apps/collector/src/core/control-plane/registry.ts';
import type { ProviderMetadata, RunResult } from '../../apps/collector/src/core/control-plane/contracts.ts';

const provider = NATIONAL_CONTROL_REGISTRY.find(item => item.house === 'AC' && item.domain === 'PERSONNEL') as ProviderMetadata;
const state = { providerId: 'aleac_personnel:AC:PERSONNEL', house: 'AC', domain: 'PERSONNEL', enabled: true, schedulerEligible: true, consecutiveFailures: 0, cooldownUntil: null, nextDue: null, checkpointBefore: null, checkpointAfter: null, lastAttemptAt: null, lastStatus: null, lastSuccessAt: null, sourceUpdatedAt: null, dataThrough: null } as const;

test('P25.3 cadence and due calculation are deterministic', () => {
  assert.equal(providerCadence(provider), 'MONTHLY');
  const now = new Date('2026-10-09T00:00:00.000Z');
  assert.equal(nextDueAt(provider, { lastSuccessAt: null, sourceUpdatedAt: null }, now, 0), now.toISOString());
  const decision = decideScheduler(provider, state, now, 0);
  assert.equal(decision.reason, 'DUE');
  assert.equal(decision.nextDue, now.toISOString());
});

test('P25.3 checkpoint is failed-safe and advances only after success', () => {
  const failed = { status: 'FAILED_SAFE', runId: 'f', activeRevisionAfter: 'old' } as Pick<RunResult, 'status' | 'runId' | 'activeRevisionAfter'>;
  const success = { status: 'SUCCESS', runId: 's', activeRevisionAfter: 'new' } as Pick<RunResult, 'status' | 'runId' | 'activeRevisionAfter'>;
  assert.equal(checkpointAfterRun('cursor-1', failed), 'cursor-1');
  assert.equal(checkpointAfterRun('cursor-1', success), 'new');
});

test('P25.3 registry exposes 109 operational scheduler entries', () => {
  assert.equal(NATIONAL_CONTROL_REGISTRY.filter(item => item.operationalStatus === 'OPERATIONAL').length, 109);
  assert.equal(NATIONAL_CONTROL_REGISTRY.filter(item => item.capabilities.schedulerEligible).length, 109);
});
