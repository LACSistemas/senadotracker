import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_DOMAINS, CONTROL_HOUSES, CollectorOrchestrator, NATIONAL_CONTROL_REGISTRY, validateControlRegistry, isDue, parseControlCliArgs, runCrossStackPreflight, type ProviderMetadata } from '../../apps/collector/src/core/control-plane/index.ts';

test('P25.1 registry covers every house/domain exactly once', () => {
  assert.equal(NATIONAL_CONTROL_REGISTRY.length, 27 * 6);
  assert.equal(new Set(NATIONAL_CONTROL_REGISTRY.map(item => `${item.house}:${item.domain}`)).size, 162);
  assert.deepEqual(validateControlRegistry(), { ok: true, errors: [] });
  assert.equal(new Set(NATIONAL_CONTROL_REGISTRY.map(item => item.house)).size, CONTROL_HOUSES.length);
  assert.equal(new Set(NATIONAL_CONTROL_REGISTRY.map(item => item.domain)).size, CONTROL_DOMAINS.length);
});

test('P25.1 CLI parser normalizes selectors and preserves dry-run/json flags', () => {
  const parsed = parseControlCliArgs(['collect', '--house', 'es', '--domain', 'budget_amendments', '--year', '2026', '--dry-run', '--json']);
  assert.equal(parsed.command, 'collect'); assert.equal(parsed.house, 'ES'); assert.equal(parsed.domain, 'BUDGET_AMENDMENTS');
  assert.equal(parsed.year, 2026); assert.equal(parsed.dryRun, true); assert.equal(parsed.json, true);
});

const provider = (overrides: Partial<ProviderMetadata> = {}): ProviderMetadata => ({
  providerId: 'fixture-provider', house: 'ES', domain: 'BUDGET_AMENDMENTS', enabled: true, operationalStatus: 'OPERATIONAL', implementationState: 'PRODUCTION_CAPABLE', sourceAuthority: 'fixture', collectionModel: 'SNAPSHOT', sourceUpdateFrequency: 'DAILY',
  capabilities: { supportsCollect: true, supportsRefresh: true, supportsBackfill: true, supportsReplay: true, supportsCheckpoint: false, supportsIncremental: false, supportsFullBackfill: true, schedulerEligible: true, lastKnownGoodSupported: true },
  rateLimitProfile: { maxRequestsPerMinute: 60, maxConcurrency: 1, cooldownMs: 0 }, retryPolicy: { retryableErrors: [], maxRetries: 0, backoffMs: 0 }, defaultTimeoutMs: 1000, entrypoint: 'fixture', activePublicationSchema: 'civica_state_budget.active_publications', lastSuccessAt: null, lastFailureAt: null, sourceUpdatedAt: null, dataThrough: null, activeRevision: null, healthStatus: 'UNKNOWN', notes: '', evidence: [], ...overrides,
});

test('P25.1 due calculation is pure and source-driven/manual are distinct', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  assert.equal(isDue(provider(), { lastSuccessAt: '2026-10-07T12:00:00Z' }, now), true);
  assert.equal(isDue(provider(), { lastSuccessAt: '2026-10-09T11:30:00Z' }, now), false);
  assert.equal(isDue(provider({ sourceUpdateFrequency: 'SOURCE_DRIVEN' }), { sourceUpdatedAt: '2026-10-09T11:30:00Z', lastSuccessAt: '2026-10-09T10:00:00Z' }, now), true);
  assert.equal(isDue(provider({ sourceUpdateFrequency: 'MANUAL' }), {}, now), false);
});

test('P25.1 orchestrator fails safe, blocks sources, and supports dry-run', async () => {
  const orchestrator = new CollectorOrchestrator({ database: 'projetoeleitor_db', now: () => new Date('2026-10-09T12:00:00Z'), registry: [provider()] });
  const dryRun = await orchestrator.dispatch({ command: 'collect', house: 'ES', domain: 'BUDGET_AMENDMENTS', year: 2026, dryRun: true });
  assert.equal(dryRun[0]?.status, 'SUCCESS'); assert.equal(dryRun[0]?.revisionActivated, false); assert.equal(dryRun[0]?.lastKnownGoodPreserved, true);
  const blocked = new CollectorOrchestrator({ database: 'projetoeleitor_db', registry: [provider({ operationalStatus: 'PROVEN_EXTERNAL_BLOCKER', implementationState: 'BLOCKED_SOURCE' })] });
  const blockedResult = await blocked.dispatch({ command: 'refresh', house: 'ES', domain: 'BUDGET_AMENDMENTS' });
  assert.equal(blockedResult[0]?.status, 'SOURCE_BLOCKED');
});

test('P25.1 replay dispatch uses an injected provider adapter without refetching', async () => {
  const replay = new CollectorOrchestrator({ database: 'projetoeleitor_db', registry: [provider()], query: async sql => ({ rows: [{ current_database: sql.includes('current_database') ? 'projetoeleitor_db' : 'projetoeleitor_db' }] }), adapters: [{ providerId: 'fixture-provider', operations: { replay: async () => ({ status: 'NO_CHANGE', sourceRequests: 0, rawCaptured: 3, candidateCreated: 0, revisionCreated: false, revisionActivated: false, duplicateInsertions: 0 }) } }] });
  const result = await replay.dispatch({ command: 'replay', house: 'ES', domain: 'BUDGET_AMENDMENTS', revision: 'fixture-revision' });
  assert.equal(result[0]?.status, 'NO_CHANGE'); assert.equal(result[0]?.sourceRequests, 0); assert.equal(result[0]?.rawCaptured, 3);
  const wrongDb = new CollectorOrchestrator({ database: 'projetoeleitor_db', registry: [provider()], query: async () => ({ rows: [{ current_database: 'wrong_database' }] }), adapters: [{ providerId: 'fixture-provider', operations: { replay: async () => ({ status: 'SUCCESS' }) } }] });
  const guarded = await wrongDb.dispatch({ command: 'replay', house: 'ES', domain: 'BUDGET_AMENDMENTS' });
  assert.equal(guarded[0]?.status, 'ENVIRONMENT_BLOCKED');
});

test('P25.1 preflight discovers the official database boundary without fabricating legacy schema', async () => {
  // Hermético: o alvo esperado vem do ambiente, então o teste fixa o seu e restaura depois.
  const previous = process.env.CIVICA_CONTROL_PLANE_DATABASE; process.env.CIVICA_CONTROL_PLANE_DATABASE = 'projetoeleitor_db';
  try {
  const pool = { query: async (sql: string): Promise<{ rows: readonly Record<string, unknown>[] }> => {
    if (sql.includes('current_database')) return { rows: [{ current_database: 'projetoeleitor_db' }] };
    return { rows: [
      { name: 'civica_state.current_state_parliamentarians', present: true }, { name: 'civica_state.active_publications', present: true }, { name: 'civica_state_budget.active_publications', present: true },
      { name: 'civica.publication_batches', present: false }, { name: 'civica.active_publications', present: false }, { name: 'civica.profiles', present: false }, { name: 'civica.people', present: false },
    ] };
  } };
  const result = await runCrossStackPreflight(pool as unknown as Parameters<typeof runCrossStackPreflight>[0]);
  assert.equal(result.classification, 'ENVIRONMENT_NOT_READY'); assert.equal(result.currentDatabase, 'projetoeleitor_db'); assert.equal(result.productionUsedAsTest, false);
  assert.equal(result.routeReadiness.state, 'READY'); assert.equal(result.routeReadiness.federal, 'ENVIRONMENT_SCHEMA_BOUNDARY'); assert.ok(result.missingRequiredSchemas.includes('civica.publication_batches'));
  } finally { if (previous === undefined) delete process.env.CIVICA_CONTROL_PLANE_DATABASE; else process.env.CIVICA_CONTROL_PLANE_DATABASE = previous; }
});
