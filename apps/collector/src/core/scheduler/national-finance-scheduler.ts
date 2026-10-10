import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { CollectorDomain } from '../collector-provider.ts';
import { advisoryLockKey } from '../lock/postgres-advisory-lock.ts';
import type { CapabilityRegistration } from '../registry/house-capability-registry.ts';
import { createNationalFinanceRegistry, type FinanceCapabilityRegistration } from '../registry/national-finance-registry.ts';

export type SchedulerTrigger = 'MANUAL' | 'SCHEDULED' | 'RETRY';
export type SchedulerRunStatus = 'QUEUED' | 'RUNNING' | 'NO_OP' | 'PUBLISHED' | 'FAILED' | 'DEFERRED' | 'LOCKED' | 'ABORTED_SCHEMA_DRIFT';
export type SchedulerNoChangeStatus = 'VALID_SNAPSHOT_NO_OP' | 'PIPELINE_NO_CHANGE';
export type SchedulerHealth = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'NEVER_RUN' | 'DISABLED';
export type SchedulerErrorCode = 'FETCH_ERROR' | 'HTTP_ERROR' | 'SOURCE_TIMEOUT' | 'SCHEMA_DRIFT' | 'PARSE_ERROR' | 'CANONICALIZATION_ERROR' | 'RECONCILIATION_ERROR' | 'PUBLICATION_ERROR' | 'DATABASE_GUARD_ERROR' | 'LOCKED' | 'UNKNOWN';

export interface SchedulerCadence { readonly frequency: 'daily' | 'hourly' | 'manual'; readonly timezone: 'America/Sao_Paulo'; readonly enabled: boolean; readonly retry: RetryConfig; readonly timeoutMs: number; readonly costClass: 'LOW' | 'MEDIUM' | 'HIGH'; readonly priority: number; readonly version: string; }
export interface RetryConfig { readonly maxAttempts: number; readonly baseDelayMs: number; readonly multiplier: number; readonly jitter: boolean; }
export interface SchedulerJobDefinition { readonly key: string; readonly house: string; readonly domain: CollectorDomain; readonly provider: string; readonly providerVersion: string; readonly manifest: FinanceCapabilityRegistration['manifest']; readonly cadence: SchedulerCadence; }
export interface SchedulerRunMetrics { readonly httpRequests: number; readonly bytes: number; readonly rawHash: string | null; readonly semanticHash: string | null; readonly sourceRows: number | null; readonly unchanged: number; readonly added: number; readonly removed: number; readonly changed: number; readonly warnings: readonly string[]; }
export interface SchedulerRunRecord { readonly runId: string; readonly jobKey: string; readonly house: string; readonly domain: string; readonly provider: string; readonly providerVersion: string; readonly trigger: SchedulerTrigger; readonly startedAt: string; readonly finishedAt: string; readonly durationMs: number; readonly status: SchedulerRunStatus; readonly noChangeStatus?: SchedulerNoChangeStatus; readonly revisionBefore: string | null; readonly revisionAfter: string | null; readonly metrics: SchedulerRunMetrics; readonly errorCode?: SchedulerErrorCode; readonly error?: string; readonly warnings: readonly string[]; }
export interface SchedulerExecutionResult { readonly status: 'NO_OP' | 'PUBLISHED' | 'FAILED' | 'DEFERRED' | 'ABORTED_SCHEMA_DRIFT'; readonly sourceCompletenessProven: boolean; readonly semanticDelta: boolean; readonly revisionBefore: string | null; readonly revisionAfter: string | null; readonly metrics: SchedulerRunMetrics; readonly errorCode?: SchedulerErrorCode; readonly error?: string; readonly warnings?: readonly string[]; }

export interface SchedulerLock { tryAcquire(key: string): Promise<boolean>; release(key: string): Promise<void>; }
export class InMemorySchedulerLock implements SchedulerLock {
  private readonly held = new Set<string>();
  async tryAcquire(key: string): Promise<boolean> { if (this.held.has(key)) return false; this.held.add(key); return true; }
  async release(key: string): Promise<void> { this.held.delete(key); }
}
export class PostgresSchedulerLock implements SchedulerLock {
  constructor(private readonly client: Pick<PoolClient, 'query'>) {}
  async tryAcquire(key: string): Promise<boolean> { const result = await this.client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS locked', [advisoryLockKey(parseLockKey(key)).toString()]); return Boolean(result.rows[0]?.locked); }
  async release(key: string): Promise<void> { await this.client.query('SELECT pg_advisory_unlock($1::bigint)', [advisoryLockKey(parseLockKey(key)).toString()]); }
}
function parseLockKey(key: string): { house: string; domain: string; provider: string } { const [house = '', domain = '', provider = ''] = key.split(':'); return { house, domain, provider }; }

export class InMemoryRunStore {
  private readonly rows: SchedulerRunRecord[] = [];
  append(record: SchedulerRunRecord): void { this.rows.push(record); }
  all(): readonly SchedulerRunRecord[] { return [...this.rows]; }
  last(jobKey: string): SchedulerRunRecord | undefined { return [...this.rows].reverse().find(row => row.jobKey === jobKey); }
}

/** Stable operational key. Provider versions are metadata and must not be
 * duplicated in the identity segment when they already carry the provider
 * prefix (for example `alms_ceap_csv:v1`). */
export function schedulerJobKey(entry: Pick<FinanceCapabilityRegistration, 'manifest'>): string {
  const m = entry.manifest;
  const version = m.providerVersion.startsWith(`${m.provider}:`) ? m.providerVersion.slice(m.provider.length + 1) : m.providerVersion;
  return `${m.house}:${m.domain}:${m.provider}:${version}`;
}
export function defaultCadence(entry: FinanceCapabilityRegistration): SchedulerCadence { return { frequency: 'daily', timezone: 'America/Sao_Paulo', enabled: true, retry: { maxAttempts: 3, baseDelayMs: 500, multiplier: 2, jitter: true }, timeoutMs: 120_000, costClass: entry.transport === 'HTTP_JSON' ? 'LOW' : entry.transport === 'HTTP_CSV' ? 'MEDIUM' : 'HIGH', priority: entry.manifest.house === 'SC' || entry.manifest.house === 'MS' ? 50 : 100, version: 'p18.3f-v1' }; }
export function isValidManifest(entry: CapabilityRegistration): entry is FinanceCapabilityRegistration { const value = entry as Partial<FinanceCapabilityRegistration>; const m = value.manifest; return Boolean(m && m.house && m.domain && m.provider && m.providerVersion && m.source?.url && m.schemaPolicy?.version && m.revisionScope); }
export function isSchedulerEligible(entry: CapabilityRegistration): entry is FinanceCapabilityRegistration { if (!isValidManifest(entry)) return false; const value = entry as FinanceCapabilityRegistration; return value.manifest.domain === 'finance' && value.frameworkStatus === 'CORE_MIGRATED' && value.operationStatus === 'CURRENT_OPERATIONAL' && value.schedulerEligible === true && value.schedulerEligibility === 'YES' && Boolean(value.manifest.providerVersion) && Boolean(value.currentEntrypoint) && value.status === 'OPERATIONAL'; }
export function buildSchedulerJobs(registry = createNationalFinanceRegistry()): readonly SchedulerJobDefinition[] { return registry.discover().filter(isSchedulerEligible).map(entry => ({ key: schedulerJobKey(entry), house: entry.manifest.house, domain: entry.manifest.domain, provider: entry.manifest.provider, providerVersion: entry.manifest.providerVersion, manifest: entry.manifest, cadence: defaultCadence(entry) })); }
export function registeredHouses(registry = createNationalFinanceRegistry()): readonly string[] { return buildSchedulerJobs(registry).map(job => job.house); }

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  const sensitive = /cookie|authorization|bearer|token|secret|password|session/i;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sensitive.test(key) ? '[REDACTED]' : redactSecrets(nested)]));
}
export function semanticHash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value, Object.keys((value && typeof value === 'object' ? value : {}) as object).sort())).digest('hex'); }
export function healthForRuns(runs: readonly SchedulerRunRecord[], jobKey: string, enabled = true): SchedulerHealth { if (!enabled) return 'DISABLED'; const latest = [...runs].reverse().find(row => row.jobKey === jobKey); if (!latest) return 'NEVER_RUN'; if (latest.status === 'FAILED' || latest.status === 'ABORTED_SCHEMA_DRIFT') return 'FAILED'; if (latest.status === 'DEFERRED' || latest.status === 'LOCKED') return 'DEGRADED'; return 'HEALTHY'; }
export function alertEvents(record: SchedulerRunRecord, previous: SchedulerRunRecord | undefined): readonly { readonly type: string; readonly jobKey: string; readonly runId: string; readonly details: Record<string, unknown> }[] {
  const events: { type: string; jobKey: string; runId: string; details: Record<string, unknown> }[] = [];
  if (record.errorCode === 'SCHEMA_DRIFT') events.push({ type: 'SCHEMA_DRIFT', jobKey: record.jobKey, runId: record.runId, details: {} });
  if (record.errorCode === 'SOURCE_TIMEOUT' || record.errorCode === 'FETCH_ERROR') events.push({ type: 'REPEATED_FETCH_FAILURE', jobKey: record.jobKey, runId: record.runId, details: { previousStatus: previous?.status ?? null } });
  if (record.status === 'FAILED' && record.errorCode === 'PUBLICATION_ERROR') events.push({ type: 'PUBLICATION_FAILURE', jobKey: record.jobKey, runId: record.runId, details: {} });
  if (record.metrics.sourceRows === 0) events.push({ type: 'SOURCE_EMPTY_UNEXPECTED', jobKey: record.jobKey, runId: record.runId, details: {} });
  if (previous && previous.metrics.sourceRows && record.metrics.sourceRows != null && record.metrics.sourceRows !== previous.metrics.sourceRows) events.push({ type: 'ROW_COUNT_ANOMALY', jobKey: record.jobKey, runId: record.runId, details: { previousCount: previous.metrics.sourceRows, currentCount: record.metrics.sourceRows, ratio: record.metrics.sourceRows / previous.metrics.sourceRows } });
  return events;
}

export interface SchedulerExecutorContext { readonly job: SchedulerJobDefinition; readonly runId: string; readonly trigger: SchedulerTrigger; readonly dryRun: boolean; }
export type SchedulerExecutor = (context: SchedulerExecutorContext) => Promise<SchedulerExecutionResult>;
export class NationalFinanceScheduler {
  constructor(private readonly jobs: readonly SchedulerJobDefinition[], private readonly lock: SchedulerLock = new InMemorySchedulerLock(), private readonly store = new InMemoryRunStore()) {}
  get registeredJobs(): readonly SchedulerJobDefinition[] { return this.jobs; }
  get runRecords(): readonly SchedulerRunRecord[] { return this.store.all(); }
  async run(job: SchedulerJobDefinition, executor: SchedulerExecutor, options: { readonly trigger?: SchedulerTrigger; readonly dryRun?: boolean; readonly runId?: string } = {}): Promise<SchedulerRunRecord> {
    const trigger = options.trigger ?? 'MANUAL'; const runId = options.runId ?? `scheduler:${job.key}:${Date.now()}`; const startedAt = new Date().toISOString(); const started = Date.now();
    const acquired = await this.lock.tryAcquire(`${job.house}:${job.domain}:${job.provider}`);
    if (!acquired) { const locked: SchedulerRunRecord = { runId, jobKey: job.key, house: job.house, domain: job.domain, provider: job.provider, providerVersion: job.providerVersion, trigger, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, status: 'LOCKED', revisionBefore: null, revisionAfter: null, metrics: emptyMetrics(), warnings: ['another run holds the provider lock'] }; this.store.append(locked); return locked; }
    try {
      const result = await executor({ job, runId, trigger, dryRun: options.dryRun === true });
      const status: SchedulerRunStatus = result.status === 'NO_OP' ? 'NO_OP' : result.status;
      const noChangeStatus = result.status === 'NO_OP' ? (result.sourceCompletenessProven && !result.semanticDelta ? 'VALID_SNAPSHOT_NO_OP' : 'PIPELINE_NO_CHANGE') : undefined;
      const revisionAfter = result.status === 'PUBLISHED' && result.revisionAfter !== result.revisionBefore ? result.revisionAfter : result.revisionBefore;
      const record: SchedulerRunRecord = { runId, jobKey: job.key, house: job.house, domain: job.domain, provider: job.provider, providerVersion: job.providerVersion, trigger, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, status, ...(noChangeStatus ? { noChangeStatus } : {}), revisionBefore: result.revisionBefore, revisionAfter, metrics: result.metrics, ...(result.errorCode ? { errorCode: result.errorCode } : {}), ...(result.error ? { error: String(redactSecrets(result.error)) } : {}), warnings: result.warnings ?? [] };
      this.store.append(record); return record;
    } catch (error) {
      const record: SchedulerRunRecord = { runId, jobKey: job.key, house: job.house, domain: job.domain, provider: job.provider, providerVersion: job.providerVersion, trigger, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, status: 'FAILED', revisionBefore: null, revisionAfter: null, metrics: emptyMetrics(), errorCode: 'UNKNOWN', error: String(redactSecrets(error instanceof Error ? error.message : error)), warnings: [] }; this.store.append(record); return record;
    } finally { await this.lock.release(`${job.house}:${job.domain}:${job.provider}`); }
  }
}
export function emptyMetrics(): SchedulerRunMetrics { return { httpRequests: 0, bytes: 0, rawHash: null, semanticHash: null, sourceRows: null, unchanged: 0, added: 0, removed: 0, changed: 0, warnings: [] }; }

