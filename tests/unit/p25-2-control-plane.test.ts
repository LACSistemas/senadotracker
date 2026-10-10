import test from 'node:test';
import assert from 'node:assert/strict';
import { CollectorOrchestrator } from '../../apps/collector/src/core/control-plane/orchestrator.ts';
import { adapterInventory, createRuntimeAdapterRegistry } from '../../apps/collector/src/core/control-plane/adapters.ts';
import { NATIONAL_CONTROL_REGISTRY } from '../../apps/collector/src/core/control-plane/registry.ts';
import { HISTORICAL_RECOVERY_TRACES } from '../../apps/collector/src/core/historical-recovery.ts';
import { historicalRecoveryAdapter } from '../../apps/collector/src/core/historical-recovery-adapter.ts';
import { historicalLiveSourceAdapter } from '../../apps/collector/src/core/historical-live-adapter.ts';
import { STATE_BUDGET_SOURCE_CONTRACTS, stateBudgetSourceAdapter } from '../../apps/collector/src/state/providers/state-budget/source-runtime.ts';
import type { ProviderAdapter, ProviderMetadata } from '../../apps/collector/src/core/control-plane/contracts.ts';

const provider = (patch: Partial<ProviderMetadata> = {}): ProviderMetadata => ({
  providerId: 'fixture', house: 'ES', domain: 'LEGISLATIVE', enabled: true,
  operationalStatus: 'OPERATIONAL', implementationState: 'PRODUCTION_CAPABLE',
  sourceAuthority: 'fixture', collectionModel: 'PAGINATED_API', sourceUpdateFrequency: 'SOURCE_DRIVEN',
  capabilities: { supportsCollect: true, supportsRefresh: true, supportsBackfill: false, supportsReplay: true, supportsCheckpoint: true, supportsIncremental: false, supportsFullBackfill: false, schedulerEligible: false, lastKnownGoodSupported: true },
  rateLimitProfile: { maxRequestsPerMinute: null, maxConcurrency: 1, cooldownMs: 0 },
  retryPolicy: { retryableErrors: ['HTTP_503', 'TIMEOUT'], maxRetries: 2, backoffMs: 1 }, defaultTimeoutMs: 25,
  entrypoint: 'fixture', activePublicationSchema: 'civica_state.active_publications', lastSuccessAt: null, lastFailureAt: null,
  sourceUpdatedAt: null, dataThrough: null, activeRevision: null, healthStatus: 'UNKNOWN', notes: 'fixture', evidence: [], sourceFamilyId: 'fixture-family', canRunManually: true, ...patch,
});
const query = async (sql: string) => ({ rows: sql.includes('current_database') ? [{ current_database: 'projetoeleitor_db' }] : [] });

test('P25.2 retries transient failures and returns a safe result', async () => {
  let attempts = 0;
  const adapter: ProviderAdapter = { providerId: 'fixture', operations: { refresh: async () => { attempts += 1; if (attempts < 3) throw new Error('HTTP_503'); return { status: 'SUCCESS', sourceRequests: attempts }; } } };
  const orchestrator = new CollectorOrchestrator({ database: 'projetoeleitor_db', query, registry: [provider()], adapters: [adapter] });
  const [result] = await orchestrator.dispatch({ command: 'refresh', house: 'ES', domain: 'LEGISLATIVE' });
  assert.equal(result?.status, 'SUCCESS'); assert.equal(attempts, 3); assert.equal(result?.lastKnownGoodPreserved, true);
});

test('P25.2 classifies timeout and preserves the active publication', async () => {
  const adapter: ProviderAdapter = { providerId: 'fixture', operations: { refresh: async () => new Promise(() => {}) } };
  const orchestrator = new CollectorOrchestrator({ database: 'projetoeleitor_db', query, registry: [provider({ defaultTimeoutMs: 5 })], adapters: [adapter] });
  const [result] = await orchestrator.dispatch({ command: 'refresh', house: 'ES', domain: 'LEGISLATIVE' });
  assert.equal(result?.status, 'FAILED_SAFE'); assert.equal(result?.error?.classification, 'TIMEOUT'); assert.equal(result?.revisionActivated, false); assert.equal(result?.lastKnownGoodPreserved, true);
});

test('P25.2 blocks concurrent runs in one source family', async () => {
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  const adapter: ProviderAdapter = { providerId: 'fixture', operations: { refresh: async () => { await pending; return { status: 'SUCCESS' }; } } };
  const orchestrator = new CollectorOrchestrator({ database: 'projetoeleitor_db', query, registry: [provider()], adapters: [adapter] });
  const first = orchestrator.dispatch({ command: 'refresh', house: 'ES', domain: 'LEGISLATIVE' }); await new Promise(resolve => setTimeout(resolve, 1));
  const [second] = await orchestrator.dispatch({ command: 'refresh', house: 'ES', domain: 'LEGISLATIVE' }); assert.equal(second?.status, 'FAILED_SAFE'); assert.equal(second?.error?.classification, 'SOURCE_FAMILY_CONCURRENCY'); release(); await first;
});

test('P25.2 runtime inventory is explicit and serializable', () => {
  const inventory = adapterInventory([{ providerId: 'x', sourceFamilyId: 'F', capabilities: { supportsRefresh: true }, operations: { refresh: async () => ({}) } }]);
  assert.deepEqual(inventory.x, { sourceFamilyId: 'F', operations: ['refresh'], capabilities: { supportsRefresh: true } });
});

test('P25.2V recovers every historical P18-P22 entry without touching P23', () => {
  const identity = NATIONAL_CONTROL_REGISTRY.filter(item => item.domain === 'IDENTITY');
  assert.equal(identity.length, 27);
  assert.ok(identity.every(item => item.sourceFamilyId === 'P17_STATE_ROSTER'));
  assert.ok(identity.every(item => item.implementationState === 'PRODUCTION_CAPABLE'));
  const sapl = NATIONAL_CONTROL_REGISTRY.filter(item => item.sourceFamilyId === 'SAPL_INTERLEGIS');
  assert.deepEqual([...new Set(sapl.map(item => item.house))].sort(), ['AC', 'AL', 'AM', 'MT', 'PB', 'PI', 'RO', 'RR', 'TO']);
  assert.equal(NATIONAL_CONTROL_REGISTRY.filter(item => item.operationalStatus === 'OPERATIONAL' && item.implementationState === 'ADAPTER_REQUIRED').length, 0);
  assert.equal(NATIONAL_CONTROL_REGISTRY.filter(item => item.operationalStatus === 'OPERATIONAL' && item.implementationState === 'ADAPTER_REQUIRED_WITH_PROVEN_INTERNAL_BLOCKER').length, 0);
  const operational = NATIONAL_CONTROL_REGISTRY.filter(item => item.operationalStatus === 'OPERATIONAL');
  assert.equal(operational.length, 109);
  assert.equal(operational.filter(item => item.implementationState === 'PRODUCTION_CAPABLE').length, 109);
  assert.equal(operational.filter(item => item.implementationState === 'MANUAL_ONLY_WITH_RUNBOOK').length, 0);
  assert.equal(operational.filter(item => item.implementationState === 'UNSAFE_TO_AUTOMATE_WITH_PROVEN_REASON').length, 0);
  assert.equal(operational.filter(item => item.implementationState === 'ENVIRONMENT_DEPENDENT').length, 0);
  assert.ok(operational.filter(item => item.implementationState !== 'PRODUCTION_CAPABLE').every(item => Boolean(item.manualRunbook?.command)));
  assert.ok(NATIONAL_CONTROL_REGISTRY.filter(item => item.house === 'AC' && item.domain === 'LEGISLATIVE')[0]?.implementationState === 'PRODUCTION_CAPABLE');
  assert.deepEqual(NATIONAL_CONTROL_REGISTRY.filter(item => item.domain === 'FINANCE' && item.implementationState === 'PRODUCTION_CAPABLE').map(item => item.house).sort(), ['AM','AP','CE','DF','ES','MG','MS','PE','RN','SC','SE','SP','TO']);
  const budget = NATIONAL_CONTROL_REGISTRY.filter(item => item.domain === 'BUDGET_AMENDMENTS' && item.operationalStatus === 'OPERATIONAL');
  assert.equal(budget.length, 15);
  assert.ok(budget.every(item => item.refreshMode?.startsWith('LIVE_SOURCE')));
  assert.ok(budget.every(item => item.sourceRuntimeEntrypoint && item.publicationAdapter));
  assert.equal(HISTORICAL_RECOVERY_TRACES.length, 50);
  assert.equal(new Set(HISTORICAL_RECOVERY_TRACES.map(trace => trace.providerId)).size, 50);
  assert.ok(HISTORICAL_RECOVERY_TRACES.every(trace => trace.historicalCollector && trace.sourceUniverse && trace.rawReplay && trace.reconciliation && trace.publication));
});

test('P25.2W source adapter fetches official resources and keeps replay offline', async () => {
  const calls: string[] = [];
  const rows: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = { query: async (sql: string, params?: unknown[]) => { rows.push(params ? { sql, params } : { sql }); return sql.includes('active_publications') ? { rows: [{ revision_id: 'active:p23' }] } : { rows: [] }; } } as never;
  const contract = STATE_BUDGET_SOURCE_CONTRACTS.ES!;
  const fetchImpl = async (url: string) => { calls.push(url); return new Response('source,2026\n', { status: 200, headers: { 'content-type': 'text/csv' } }); };
  const adapter = stateBudgetSourceAdapter(contract, pool, fetchImpl as typeof fetch);
  const context = { runId: 'p25.2w', command: 'refresh', providerId: contract.providerId, house: 'ES', domain: 'BUDGET_AMENDMENTS', year: 2026, startedAt: new Date(0).toISOString(), database: 'projetoeleitor_db', dryRun: false, trigger: 'MANUAL_CLI', options: {} } as const;
  const live = await adapter.operations.refresh!(context);
  assert.equal(calls.length, 2);
  assert.equal(live.sourceRequests, 2);
  assert.equal(live.rawCaptured, 2);
  assert.equal(live.activeRevisionAfter, 'active:p23');
  calls.length = 0;
  const replay = await adapter.operations.replay!({ ...context, command: 'replay' });
  assert.equal(calls.length, 0);
  assert.equal(replay.status, 'NO_CHANGE');
  assert.equal(replay.sourceRequests, 0);
  assert.ok(rows.some(row => row.sql.includes('raw_evidence')));
});

test('P25.2W runtime inventory exposes collect and refresh for all 15 P23 sources', () => {
  const pool = { query: async () => ({ rows: [] }) } as never;
  const inventory = adapterInventory(createRuntimeAdapterRegistry({ pool }));
  for (const house of ['ES','MG','RS','SP','PA','PR','RO','AC','SE','AL','PI','RN','MS','PB','RR']) {
    const item = inventory[`state-${house.toLowerCase()}-budget`] as { operations: string[] } | undefined;
    assert.ok(item, `missing P23 source adapter ${house}`);
    assert.ok(item.operations.includes('collect'));
    assert.ok(item.operations.includes('refresh'));
    assert.ok(item.operations.includes('replay'));
  }
});

test('P25.2V historical adapter replays an active corpus without creating a revision', async () => {
  const pool = { query: async (sql: string) => sql.includes('active_publications') ? { rows: [{ revision_id: 'historical:active' }] } : { rows: [{ n: 3 }] } } as never;
  const trace = HISTORICAL_RECOVERY_TRACES.find(item => item.providerId === 'state-ac-timeline')!;
  const adapter = historicalRecoveryAdapter(trace, pool);
  const result = await adapter.operations.replay!({ runId: 'replay', command: 'replay', providerId: trace.providerId, house: trace.house, domain: trace.domain, year: 2026, startedAt: new Date(0).toISOString(), database: 'projetoeleitor_db', dryRun: false, trigger: 'MANUAL_CLI', options: {} });
  assert.equal(result.status, 'NO_CHANGE');
  assert.equal(result.activeRevisionBefore, 'historical:active');
  assert.equal(result.activeRevisionAfter, 'historical:active');
  assert.equal(result.duplicateInsertions, 0);
  assert.equal(result.revisionActivated, false);
});

test('P25.2X every historical trace dispatches refresh to source and replay stays offline', async () => {
  const calls: string[] = [];
  const pool = { query: async (sql: string) => sql.includes('active_publications') ? { rows: [{ revision_id: 'historical:active' }] } : { rows: [{ n: 3 }] } } as never;
  for (const trace of HISTORICAL_RECOVERY_TRACES) {
    const adapter = historicalLiveSourceAdapter(trace, pool, { sourceRunner: async () => { calls.push(trace.providerId); return { requests: 1, raw: 1, ok: true, bytes: 10, url: `https://source.test/${trace.providerId}` }; } });
    const context = { runId: `live:${trace.providerId}`, command: 'refresh', providerId: trace.providerId, house: trace.house, domain: trace.domain, year: 2026, startedAt: new Date(0).toISOString(), database: 'projetoeleitor_db', dryRun: false, trigger: 'MANUAL_CLI', options: {} } as const;
    const live = await adapter.operations.refresh!(context);
    assert.equal(live.sourceRequests, 1, trace.providerId);
    assert.equal(live.rawCaptured, 1, trace.providerId);
    const beforeReplay = calls.length;
    const replay = await adapter.operations.replay!({ ...context, command: 'replay' });
    assert.equal(replay.sourceRequests, 0, trace.providerId);
    assert.equal(calls.length, beforeReplay, trace.providerId);
  }
  assert.equal(calls.length, 50);
});
