import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { assertDatabaseTarget } from '../guards/database-guard.ts';
import { CollectorOrchestrator } from './orchestrator.ts';
import { isDue } from './due.ts';
import type { ControlDomain, ControlHouse, ProviderMetadata, RunResult, SourceFrequency } from './contracts.ts';

export type ControlSchedulerCadence = SourceFrequency | 'MANUAL_TRIGGER_ONLY';
export type SchedulerDecisionReason = 'DUE' | 'NOT_DUE' | 'BLOCKED' | 'COOLDOWN' | 'NOT_ELIGIBLE' | 'IRREGULAR' | 'MANUAL_TRIGGER_ONLY';
export type ControlSchedulerHealth = 'HEALTHY_FRESH' | 'HEALTHY_STALE' | 'DEGRADED' | 'SOURCE_BLOCKED' | 'FAILED_LAST_RUN' | 'ENVIRONMENT_BLOCKED' | 'UNKNOWN';

export interface SchedulerProviderState {
  readonly providerId: string;
  readonly house: ControlHouse;
  readonly domain: ControlDomain;
  readonly enabled: boolean;
  readonly schedulerEligible: boolean;
  readonly consecutiveFailures: number;
  readonly cooldownUntil: string | null;
  readonly nextDue: string | null;
  readonly checkpointBefore: string | null;
  readonly checkpointAfter: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastStatus: string | null;
  readonly lastSuccessAt: string | null;
  readonly sourceUpdatedAt: string | null;
  readonly dataThrough: string | null;
}

export interface SchedulerDecision {
  readonly providerId: string;
  readonly house: ControlHouse;
  readonly domain: ControlDomain;
  readonly cadence: ControlSchedulerCadence;
  readonly reason: SchedulerDecisionReason;
  readonly due: boolean;
  readonly nextDue: string | null;
  readonly jitterMs: number;
  readonly consecutiveFailures: number;
  readonly cooldownUntil: string | null;
  readonly schedulerEligible: boolean;
}

export interface SchedulerTickOptions {
  readonly dryRun?: boolean;
  readonly batchLimit?: number;
  readonly year?: number;
  readonly now?: Date;
  readonly jitterWindowMs?: number;
  readonly globalConcurrency?: number;
  readonly forcedJobs?: readonly { readonly house: ControlHouse; readonly domain: ControlDomain }[];
}

export interface SchedulerTickResult {
  readonly tickId: string;
  readonly dryRun: boolean;
  readonly decisions: readonly SchedulerDecision[];
  readonly runs: readonly RunResult[];
  readonly metrics: {
    readonly due: number;
    readonly started: number;
    readonly success: number;
    readonly noChange: number;
    readonly failedSafe: number;
    readonly blocked: number;
    readonly sourceRequests: number;
    readonly publishedRevisions: number;
    readonly staleProviders: number;
    readonly backlog: number;
    readonly durationMs: number;
  };
}

const STATE_TABLE = 'civica_ops.scheduler_provider_state';
const TICK_TABLE = 'civica_ops.scheduler_ticks';
const DECISION_TABLE = 'civica_ops.scheduler_decisions';
const ALERT_TABLE = 'civica_ops.alert_events';
const CONTROL_PLANE_DATABASE = process.env.CIVICA_CONTROL_PLANE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';

const asIso = (value: unknown): string | null => value ? new Date(String(value)).toISOString() : null;
export const controlSchedulerJobKey = (provider: Pick<ProviderMetadata, 'providerId' | 'house' | 'domain'>): string => `${provider.providerId ?? 'unregistered'}:${provider.house}:${provider.domain}`;
const cadence = (provider: ProviderMetadata): ControlSchedulerCadence => provider.sourceUpdateFrequency === 'MANUAL' ? 'MANUAL_TRIGGER_ONLY' : provider.sourceUpdateFrequency === 'UNKNOWN' ? 'IRREGULAR' : provider.sourceUpdateFrequency;
const cadenceMs = (value: ControlSchedulerCadence): number | null => ({ HOURLY: 3_600_000, DAILY: 86_400_000, DAILY_D_MINUS_1: 86_400_000, WEEKLY: 7 * 86_400_000, MONTHLY: 28 * 86_400_000 } as Record<string, number>)[value] ?? null;
const jitterFor = (providerId: string, windowMs: number): number => windowMs <= 0 ? 0 : Number.parseInt(createHash('sha256').update(providerId).digest('hex').slice(0, 8), 16) % (windowMs + 1);

export function providerCadence(provider: ProviderMetadata): ControlSchedulerCadence { return cadence(provider); }

export function nextDueAt(provider: ProviderMetadata, state: { readonly lastSuccessAt: string | null; readonly sourceUpdatedAt: string | null }, now = new Date(), jitterWindowMs = 30_000): string | null {
  const frequency = cadence(provider); const interval = cadenceMs(frequency); const jitter = jitterFor(provider.providerId ?? `${provider.house}:${provider.domain}`, jitterWindowMs);
  if (frequency === 'SOURCE_DRIVEN') return state.sourceUpdatedAt && (!state.lastSuccessAt || Date.parse(state.sourceUpdatedAt) > Date.parse(state.lastSuccessAt)) ? now.toISOString() : null;
  if (frequency === 'IRREGULAR' || frequency === 'MANUAL_TRIGGER_ONLY') return null;
  if (!interval || !state.lastSuccessAt) return now.toISOString();
  return new Date(Date.parse(state.lastSuccessAt) + interval + jitter).toISOString();
}

export function checkpointAfterRun(before: string | null, run: Pick<RunResult, 'status' | 'runId' | 'activeRevisionAfter'>): string | null {
  return ['SUCCESS', 'NO_CHANGE'].includes(run.status) ? (run.activeRevisionAfter ?? run.runId) : before;
}

export function decideScheduler(provider: ProviderMetadata, state: SchedulerProviderState, now = new Date(), jitterWindowMs = 30_000): SchedulerDecision {
  const providerId = controlSchedulerJobKey(provider); const frequency = cadence(provider); const jitterMs = jitterFor(providerId, jitterWindowMs); const nextDue = state.nextDue ?? nextDueAt(provider, { lastSuccessAt: state.lastSuccessAt ?? null, sourceUpdatedAt: state.sourceUpdatedAt ?? null }, now, jitterWindowMs);
  let reason: SchedulerDecisionReason = 'DUE';
  if (!provider.enabled || provider.operationalStatus !== 'OPERATIONAL' || !provider.capabilities.supportsRefresh || !state.schedulerEligible) reason = 'NOT_ELIGIBLE';
  else if (state.cooldownUntil && Date.parse(state.cooldownUntil) > now.getTime()) reason = 'COOLDOWN';
  else if (frequency === 'MANUAL_TRIGGER_ONLY') reason = 'MANUAL_TRIGGER_ONLY';
  else if (frequency === 'IRREGULAR' || frequency === 'UNKNOWN') reason = 'IRREGULAR';
  else if (!isDue(provider, { lastSuccessAt: state.lastSuccessAt ?? null, sourceUpdatedAt: state.sourceUpdatedAt ?? null, dataThrough: state.dataThrough ?? null }, now)) reason = 'NOT_DUE';
  return { providerId, house: provider.house, domain: provider.domain, cadence: frequency, reason, due: reason === 'DUE', nextDue, jitterMs, consecutiveFailures: state.consecutiveFailures, cooldownUntil: state.cooldownUntil, schedulerEligible: state.schedulerEligible };
}

export async function ensureSchedulerSchema(pool: Pick<Pool, 'query'>): Promise<void> {
  const query = async (sql: string, params?: readonly unknown[]) => pool.query(sql, params as unknown[] | undefined);
  await assertDatabaseTarget(query, { database: CONTROL_PLANE_DATABASE, readOnly: true });
  await pool.query(`CREATE SCHEMA IF NOT EXISTS civica_ops`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (provider_id text PRIMARY KEY, house text NOT NULL, domain text NOT NULL, enabled boolean NOT NULL DEFAULT true, scheduler_eligible boolean NOT NULL DEFAULT false, cadence text NOT NULL, last_attempt_at timestamptz, last_success_at timestamptz, source_updated_at timestamptz, data_through timestamptz, consecutive_failures integer NOT NULL DEFAULT 0, cooldown_until timestamptz, next_due timestamptz, checkpoint_before text, checkpoint_after text, last_status text, updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ${TICK_TABLE} (tick_id text PRIMARY KEY, started_at timestamptz NOT NULL, finished_at timestamptz, dry_run boolean NOT NULL, due_jobs integer NOT NULL DEFAULT 0, started_jobs integer NOT NULL DEFAULT 0, success_jobs integer NOT NULL DEFAULT 0, no_change_jobs integer NOT NULL DEFAULT 0, failed_safe_jobs integer NOT NULL DEFAULT 0, blocked_jobs integer NOT NULL DEFAULT 0, source_requests integer NOT NULL DEFAULT 0, published_revisions integer NOT NULL DEFAULT 0, stale_providers integer NOT NULL DEFAULT 0, backlog integer NOT NULL DEFAULT 0, metrics jsonb NOT NULL DEFAULT '{}'::jsonb)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ${DECISION_TABLE} (tick_id text NOT NULL, provider_id text NOT NULL, house text NOT NULL, domain text NOT NULL, cadence text NOT NULL, reason text NOT NULL, due boolean NOT NULL, next_due timestamptz, jitter_ms integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tick_id, provider_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ${ALERT_TABLE} (id bigserial PRIMARY KEY, tick_id text, run_id text, provider_id text NOT NULL, house text NOT NULL, domain text NOT NULL, alert_type text NOT NULL, severity text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS civica_ops.control_plane_runs (run_id text PRIMARY KEY, provider_id text NOT NULL, house text NOT NULL, domain text NOT NULL, command text NOT NULL, trigger_kind text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz NOT NULL, status text NOT NULL, attempts integer NOT NULL DEFAULT 1, revision_before text, revision_after text, error_class text, source_requests integer NOT NULL DEFAULT 0, candidate_created integer NOT NULL DEFAULT 0, duplicate_insertions integer NOT NULL DEFAULT 0, last_known_good_preserved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`ALTER TABLE civica_ops.control_plane_runs ADD COLUMN IF NOT EXISTS raw_captured integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS revision_created boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS revision_activated boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS checkpoint_before text, ADD COLUMN IF NOT EXISTS checkpoint_after text, ADD COLUMN IF NOT EXISTS duration_ms integer NOT NULL DEFAULT 0`);
}

function emptyState(provider: ProviderMetadata): SchedulerProviderState {
  return { providerId: controlSchedulerJobKey(provider), house: provider.house, domain: provider.domain, enabled: provider.enabled, schedulerEligible: provider.capabilities.schedulerEligible, consecutiveFailures: 0, cooldownUntil: null, nextDue: null, checkpointBefore: null, checkpointAfter: null, lastAttemptAt: null, lastStatus: null, lastSuccessAt: provider.lastSuccessAt, sourceUpdatedAt: provider.sourceUpdatedAt, dataThrough: provider.dataThrough };
}

export class SchedulerEngine {
  constructor(private readonly pool: Pool, private readonly orchestrator: CollectorOrchestrator, private readonly registry: readonly ProviderMetadata[], private readonly now: () => Date = () => new Date()) {}

  async states(): Promise<ReadonlyMap<string, SchedulerProviderState>> {
    await ensureSchedulerSchema(this.pool);
    const rows = (await this.pool.query<Record<string, unknown>>(`SELECT provider_id,house,domain,enabled,scheduler_eligible,cadence,last_attempt_at,last_success_at,source_updated_at,data_through,consecutive_failures,cooldown_until,next_due,checkpoint_before,checkpoint_after,last_status FROM ${STATE_TABLE}`)).rows;
    const byId = new Map(rows.map(row => [String(row.provider_id), { providerId: String(row.provider_id), house: String(row.house) as ControlHouse, domain: String(row.domain) as ControlDomain, enabled: Boolean(row.enabled), schedulerEligible: Boolean(row.scheduler_eligible), consecutiveFailures: Number(row.consecutive_failures ?? 0), cooldownUntil: asIso(row.cooldown_until), nextDue: asIso(row.next_due), checkpointBefore: row.checkpoint_before ? String(row.checkpoint_before) : null, checkpointAfter: row.checkpoint_after ? String(row.checkpoint_after) : null, lastAttemptAt: asIso(row.last_attempt_at), lastStatus: row.last_status ? String(row.last_status) : null, lastSuccessAt: asIso(row.last_success_at), sourceUpdatedAt: asIso(row.source_updated_at), dataThrough: asIso(row.data_through) } satisfies SchedulerProviderState]));
    for (const provider of this.registry) { const id = controlSchedulerJobKey(provider); if (!byId.has(id)) byId.set(id, emptyState(provider)); }
    return byId;
  }

  async decisions(options: SchedulerTickOptions = {}): Promise<readonly SchedulerDecision[]> {
    const now = options.now ?? this.now(); const states = await this.states(); const window = options.jitterWindowMs ?? 30_000;
    return this.registry.filter(provider => provider.operationalStatus === 'OPERATIONAL').map(provider => decideScheduler(provider, states.get(controlSchedulerJobKey(provider)) ?? emptyState(provider), now, window));
  }

  async health(options: SchedulerTickOptions = {}): Promise<readonly (SchedulerDecision & { readonly health: ControlSchedulerHealth; readonly lastAttemptAt: string | null; readonly lastStatus: string | null })[]> {
    const states = await this.states(); const decisions = await this.decisions(options); return decisions.map(decision => { const state = states.get(decision.providerId)!; const health: ControlSchedulerHealth = state.lastStatus === 'SOURCE_BLOCKED' ? 'SOURCE_BLOCKED' : state.lastStatus === 'FAILED_SAFE' ? 'FAILED_LAST_RUN' : state.lastStatus === 'ENVIRONMENT_BLOCKED' ? 'ENVIRONMENT_BLOCKED' : state.lastStatus && ['SUCCESS','NO_CHANGE'].includes(state.lastStatus) ? (decision.reason === 'NOT_DUE' ? 'HEALTHY_FRESH' : 'HEALTHY_STALE') : 'UNKNOWN'; return { ...decision, health, lastAttemptAt: state.lastAttemptAt, lastStatus: state.lastStatus }; });
  }

  async tick(options: SchedulerTickOptions = {}): Promise<SchedulerTickResult> {
    const started = Date.now(); const tickId = `scheduler-tick:${randomUUID()}`; const decisions = await this.decisions(options); const forced = new Set((options.forcedJobs ?? []).map(job => `${job.house}:${job.domain}`)); const due = decisions.filter(item => item.due); const eligible = decisions.filter(item => item.due || forced.has(`${item.house}:${item.domain}`)); const limit = Math.max(0, options.batchLimit ?? (options.dryRun ? due.length : 6)); const selected = [...eligible.filter(item => forced.has(`${item.house}:${item.domain}`)), ...eligible.filter(item => !forced.has(`${item.house}:${item.domain}`))].slice(0, limit); const backlog = Math.max(0, eligible.length - selected.length);
    await this.pool.query(`INSERT INTO ${TICK_TABLE}(tick_id,started_at,dry_run,due_jobs,backlog) VALUES($1,$2,$3,$4,$5)`, [tickId, new Date(started).toISOString(), options.dryRun === true, due.length, backlog]);
    for (const decision of decisions) await this.pool.query(`INSERT INTO ${DECISION_TABLE}(tick_id,provider_id,house,domain,cadence,reason,due,next_due,jitter_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [tickId, decision.providerId, decision.house, decision.domain, decision.cadence, decision.reason, decision.due, decision.nextDue, decision.jitterMs]);
    if (options.dryRun) { const metrics = this.metrics([], decisions, backlog, Date.now() - started); await this.finishTick(tickId, metrics); return { tickId, dryRun: true, decisions, runs: [], metrics }; }
    const completed = await runWithConcurrency(selected, Math.max(1, options.globalConcurrency ?? 2), async decision => { try { const [run] = await this.orchestrator.dispatch({ command: 'refresh', house: decision.house, domain: decision.domain, year: options.year ?? 2026, trigger: 'SCHEDULER', due: false }); if (run) return run; const finishedAt = new Date().toISOString(); return { status: 'FAILED_SAFE', runId: `scheduler-no-run:${decision.house}:${decision.domain}:${randomUUID()}`, startedAt: finishedAt, finishedAt, durationMs: 0, sourceRequests: 0, rawCaptured: 0, candidateCreated: 0, revisionCreated: false, revisionActivated: false, activeRevisionBefore: null, activeRevisionAfter: null, duplicateInsertions: 0, lastKnownGoodPreserved: true, warnings: [], error: { classification: 'NO_ORCHESTRATOR_RESULT', message: `no run result for ${decision.house}:${decision.domain}` } }; } catch (error) { const finishedAt = new Date().toISOString(); return { status: 'FAILED_SAFE', runId: `scheduler-error:${decision.house}:${decision.domain}:${randomUUID()}`, startedAt: finishedAt, finishedAt, durationMs: 0, sourceRequests: 0, rawCaptured: 0, candidateCreated: 0, revisionCreated: false, revisionActivated: false, activeRevisionBefore: null, activeRevisionAfter: null, duplicateInsertions: 0, lastKnownGoodPreserved: true, warnings: [], error: { classification: 'SCHEDULER_DISPATCH_FAILURE', message: error instanceof Error ? error.message : String(error) } }; } });
    const runs = completed.map(item => item.result).filter((run): run is RunResult => Boolean(run));
    await this.persistOutcomes(completed, tickId, options); const metrics = this.metrics(runs, decisions, backlog, Date.now() - started); await this.finishTick(tickId, metrics); return { tickId, dryRun: false, decisions, runs, metrics };
  }

  private metrics(runs: readonly RunResult[], decisions: readonly SchedulerDecision[], backlog: number, durationMs: number): SchedulerTickResult['metrics'] { return { due: decisions.filter(d => d.due).length, started: runs.length, success: runs.filter(r => r.status === 'SUCCESS').length, noChange: runs.filter(r => r.status === 'NO_CHANGE').length, failedSafe: runs.filter(r => r.status === 'FAILED_SAFE').length, blocked: runs.filter(r => ['SOURCE_BLOCKED','ENVIRONMENT_BLOCKED'].includes(r.status)).length, sourceRequests: runs.reduce((n, r) => n + r.sourceRequests, 0), publishedRevisions: runs.filter(r => r.revisionActivated).length, staleProviders: decisions.filter(d => d.reason === 'NOT_DUE').length, backlog, durationMs }; }
  private async finishTick(tickId: string, metrics: SchedulerTickResult['metrics']): Promise<void> { await this.pool.query(`UPDATE ${TICK_TABLE} SET finished_at=now(),started_jobs=$2,success_jobs=$3,no_change_jobs=$4,failed_safe_jobs=$5,blocked_jobs=$6,source_requests=$7,published_revisions=$8,stale_providers=$9,backlog=$10,metrics=$11 WHERE tick_id=$1`, [tickId, metrics.started, metrics.success, metrics.noChange, metrics.failedSafe, metrics.blocked, metrics.sourceRequests, metrics.publishedRevisions, metrics.staleProviders, metrics.backlog, JSON.stringify(metrics)]); }
  private async persistOutcomes(completed: readonly { readonly item: SchedulerDecision; readonly result: RunResult | undefined }[], tickId: string, options: SchedulerTickOptions): Promise<void> { const now = (options.now ?? this.now()).toISOString(); for (const completedItem of completed) { const run = completedItem.result; const decision = completedItem.item; if (!run) continue; const provider = this.registry.find(p => controlSchedulerJobKey(p) === decision.providerId); if (!provider) continue; const failure = ['FAILED_SAFE','SOURCE_BLOCKED','ENVIRONMENT_BLOCKED'].includes(run.status); const failures = failure ? decision.consecutiveFailures + 1 : 0; const cooldown = failure ? new Date(Date.parse(now) + Math.min(3_600_000, 60_000 * (2 ** Math.min(failures, 6)))).toISOString() : null; const before = null; const after = checkpointAfterRun(before, run); const next = failure ? cooldown : nextDueAt(provider, { lastSuccessAt: ['SUCCESS','NO_CHANGE'].includes(run.status) ? now : null, sourceUpdatedAt: now }, new Date(now)); await this.pool.query(`INSERT INTO ${STATE_TABLE}(provider_id,house,domain,enabled,scheduler_eligible,cadence,last_attempt_at,last_success_at,consecutive_failures,cooldown_until,next_due,checkpoint_before,checkpoint_after,last_status,updated_at) VALUES($1,$2,$3,true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()) ON CONFLICT(provider_id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at,last_success_at=COALESCE(excluded.last_success_at,${STATE_TABLE}.last_success_at),consecutive_failures=excluded.consecutive_failures,cooldown_until=excluded.cooldown_until,next_due=excluded.next_due,checkpoint_before=COALESCE(${STATE_TABLE}.checkpoint_after,excluded.checkpoint_before),checkpoint_after=COALESCE(excluded.checkpoint_after,${STATE_TABLE}.checkpoint_after),last_status=excluded.last_status,updated_at=now()`, [decision.providerId, decision.house, decision.domain, decision.schedulerEligible, decision.cadence, now, ['SUCCESS','NO_CHANGE'].includes(run.status) ? now : null, failures, cooldown, next, before, after, run.status]); if (failure) await this.pool.query(`INSERT INTO ${ALERT_TABLE}(tick_id,run_id,provider_id,house,domain,alert_type,severity,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [tickId, run.runId, decision.providerId, decision.house, decision.domain, run.status === 'SOURCE_BLOCKED' ? 'SOURCE_BLOCKED' : run.status === 'ENVIRONMENT_BLOCKED' ? 'DATABASE_UNAVAILABLE' : 'REPEATED_FAILURE', failures > 1 ? 'critical' : 'warning', JSON.stringify({ status: run.status, error: run.error })]); } }
}

async function runWithConcurrency<T>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<RunResult | undefined>): Promise<Array<{ readonly item: T; readonly result: RunResult | undefined }>> { const out: Array<{ item: T; result: RunResult | undefined }> = []; let index = 0; const worker = async () => { while (true) { const current = index++; if (current >= items.length) return; const item = items[current]!; out[current] = { item, result: await fn(item) }; } }; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker())); return out; }

