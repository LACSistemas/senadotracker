import { randomUUID } from 'node:crypto';
import { assertDatabaseTarget, type DatabaseQuery } from '../guards/database-guard.ts';
import { isDue, type DueMetadata } from './due.ts';
import { NATIONAL_CONTROL_REGISTRY, selectProviders } from './registry.ts';
import type { ControlDomain, ControlHouse, ControlOperation, ControlSelection, ProviderAdapter, ProviderMetadata, RunContext, RunResult } from './contracts.ts';

export interface ControlPlaneOptions { readonly database: string; readonly query?: DatabaseQuery; readonly registry?: readonly ProviderMetadata[]; readonly adapters?: readonly ProviderAdapter[]; readonly now?: () => Date; /** Chamado após uma revisão ser ativada com sucesso (nunca em dry-run). Falha aqui não altera o resultado da coleta. */ readonly afterPublication?: (event: PublicationEvent) => Promise<void>; }
export interface PublicationEvent { readonly house: ControlHouse; readonly domain: ControlDomain; readonly provider: ProviderMetadata; readonly run: RunResult }
export interface DispatchOptions extends ControlSelection { readonly command: ControlOperation; readonly dryRun?: boolean; readonly json?: boolean; readonly revision?: string; readonly trigger?: 'MANUAL_CLI' | 'SCHEDULER'; readonly dueMetadata?: DueMetadata; readonly options?: Readonly<Record<string, string | number | boolean | null>>; }
const nowIso = (now: () => Date) => now().toISOString();

function result(context: RunContext, status: RunResult['status'], patch: Partial<RunResult> = {}): RunResult { const finishedAt = new Date().toISOString(); return { status, runId: context.runId, startedAt: context.startedAt, finishedAt, durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(context.startedAt)), sourceRequests: 0, rawCaptured: 0, candidateCreated: 0, revisionCreated: false, revisionActivated: false, activeRevisionBefore: null, activeRevisionAfter: null, duplicateInsertions: 0, lastKnownGoodPreserved: true, warnings: [], error: null, ...patch }; }

export class CollectorOrchestrator {
  private readonly registry: readonly ProviderMetadata[];
  private readonly adapters: ReadonlyMap<string, ProviderAdapter>;
  private readonly now: () => Date;
  private readonly familyRunning = new Map<string, number>();
  constructor(private readonly options: ControlPlaneOptions) { this.registry = options.registry ?? NATIONAL_CONTROL_REGISTRY; this.adapters = new Map((options.adapters ?? []).map(adapter => [adapter.providerId, adapter])); this.now = options.now ?? (() => new Date()); }
  list(selection: ControlSelection = {}): readonly ProviderMetadata[] { return selectProviders(selection, this.registry); }
  status(selection: ControlSelection = {}): readonly ProviderMetadata[] { return this.list(selection); }
  /** Merge static capability metadata with the latest publication/run state. */
  async runtimeStatus(selection: ControlSelection = {}): Promise<readonly ProviderMetadata[]> {
    const selected = this.list(selection);
    if (!this.options.query) return selected;
    try { await this.options.query('SELECT 1'); } catch { return selected; }
    const out: ProviderMetadata[] = [];
    for (const provider of selected) {
      if (!provider.providerId) { out.push(provider); continue; }
      try {
        const budget = provider.domain === 'BUDGET_AMENDMENTS';
        const activeSql = budget
          ? `SELECT revision_id FROM civica_state_budget.active_publications WHERE house='${provider.house}' AND fiscal_year=${Number(selection.year ?? 2026)} LIMIT 1`
          : `SELECT revision_id FROM civica_state.active_publications WHERE house='${provider.house}' AND domain='${provider.domain.toLowerCase()}' LIMIT 1`;
        const activeRows = (await this.options.query(activeSql)).rows as readonly Record<string, unknown>[];
        const activeRevision = activeRows[0]?.revision_id ? String(activeRows[0].revision_id) : null;
        const history = (await this.options.query(`SELECT finished_at, status AS quality_status, revision_before AS public_revision_before, revision_after AS public_revision_after FROM civica_ops.control_plane_runs WHERE house='${provider.house}' AND provider_id='${provider.providerId}' AND domain='${provider.domain}' ORDER BY finished_at DESC NULLS LAST LIMIT 1`)).rows as readonly Record<string, unknown>[];
        const last = history[0];
        const lastSuccessAt = last?.finished_at ? new Date(String(last.finished_at)).toISOString() : provider.lastSuccessAt;
        const lastStatus = last?.quality_status ? String(last.quality_status).toUpperCase() : '';
        const failed = ['FAILED_SAFE', 'ENVIRONMENT_BLOCKED', 'SOURCE_BLOCKED'].includes(lastStatus);
        const healthStatus = failed ? 'DEGRADED' : activeRevision ? 'HEALTHY_FRESH' : provider.healthStatus;
        out.push({ ...provider, activeRevision, lastSuccessAt, healthStatus, notes: `${provider.notes} Runtime state hydrated from the configured database.` });
      } catch { out.push(provider); }
    }
    return out;
  }
  due(selection: ControlSelection = {}, metadata: Readonly<Record<string, DueMetadata>> = {}): readonly ProviderMetadata[] { return this.list(selection).filter(provider => isDue(provider, metadata[`${provider.house}:${provider.domain}`] ?? {}, this.now())); }
  async dispatch(options: DispatchOptions): Promise<readonly RunResult[]> {
    const selected = options.due ? this.due(options, options.dueMetadata ? { [`${options.house}:${options.domain}`]: options.dueMetadata } : {}) : this.list(options);
    if (!selected.length) return [];
    const out: RunResult[] = [];
    for (const provider of selected) { const run = await this.dispatchOne(provider, options); await this.recordRun(provider, options, run); out.push(await this.notifyPublication(provider, options, run)); }
    return out;
  }
  /** Gancho pós-publicação (ex.: recalcular agregados de leitura). Isolado: erro vira aviso, a revisão já publicada permanece. */
  private async notifyPublication(provider: ProviderMetadata, options: DispatchOptions, run: RunResult): Promise<RunResult> {
    const hook = this.options.afterPublication;
    if (!hook || options.dryRun || run.status !== 'SUCCESS' || !run.revisionActivated) return run;
    try { await hook({ house: provider.house as ControlHouse, domain: provider.domain as ControlDomain, provider, run }); return run; }
    catch (error) { return { ...run, warnings: [...run.warnings, `after-publication hook failed: ${error instanceof Error ? error.message : String(error)}`] }; }
  }
  private async recordRun(provider: ProviderMetadata, options: DispatchOptions, run: RunResult): Promise<void> {
    if (!this.options.query) return;
    const q = (value: unknown) => value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
    try {
      await this.options.query('CREATE SCHEMA IF NOT EXISTS civica_ops');
      await this.options.query(`CREATE TABLE IF NOT EXISTS civica_ops.control_plane_runs (run_id text PRIMARY KEY, provider_id text NOT NULL, house text NOT NULL, domain text NOT NULL, command text NOT NULL, trigger_kind text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz NOT NULL, status text NOT NULL, attempts integer NOT NULL DEFAULT 1, revision_before text, revision_after text, error_class text, source_requests integer NOT NULL, candidate_created integer NOT NULL, duplicate_insertions integer NOT NULL, last_known_good_preserved boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
      const attempts = run.warnings.filter(value => /^retry=/.test(value)).length + 1;
      await this.options.query(`INSERT INTO civica_ops.control_plane_runs(run_id,provider_id,house,domain,command,trigger_kind,started_at,finished_at,status,attempts,revision_before,revision_after,error_class,source_requests,candidate_created,duplicate_insertions,last_known_good_preserved) VALUES (${q(run.runId)},${q(provider.providerId)},${q(provider.house)},${q(provider.domain)},${q(options.command)},${q(options.trigger ?? 'MANUAL_CLI')},${q(run.startedAt)},${q(run.finishedAt)},${q(run.status)},${attempts},${q(run.activeRevisionBefore)},${q(run.activeRevisionAfter)},${q(run.error?.classification ?? null)},${run.sourceRequests},${run.candidateCreated},${run.duplicateInsertions},${run.lastKnownGoodPreserved}) ON CONFLICT(run_id) DO NOTHING`);
    } catch { /* observability failure cannot publish or replace a safe result */ }
  }
  private async dispatchOne(provider: ProviderMetadata, options: DispatchOptions): Promise<RunResult> {
    const startedAt = nowIso(this.now); const context: RunContext = { runId: `control:${options.command}:${provider.house}:${provider.domain}:${randomUUID()}`, command: options.command, providerId: provider.providerId ?? 'none', house: provider.house as ControlHouse, domain: provider.domain as ControlDomain, year: options.year ?? null, startedAt, database: this.options.database, dryRun: options.dryRun === true, trigger: options.trigger ?? 'MANUAL_CLI', options: options.options ?? {} };
    if (provider.operationalStatus === 'PROVEN_EXTERNAL_BLOCKER' || provider.implementationState === 'BLOCKED_SOURCE') return result(context, 'SOURCE_BLOCKED', { warnings: [provider.notes] });
    if (provider.operationalStatus === 'UPSTREAM_BLOCKER' || provider.operationalStatus === 'EXECUTION_ENVIRONMENT_BLOCKED') return result(context, 'ENVIRONMENT_BLOCKED', { warnings: [provider.notes] });
    if (provider.operationalStatus === 'NOT_APPLICABLE') return result(context, 'UNSUPPORTED_OPERATION', { warnings: [provider.notes] });
    if (options.dryRun) return result(context, 'SUCCESS', { warnings: ['dry-run: no source request and no publication'] });
    if (!this.options.query) return result(context, 'ENVIRONMENT_BLOCKED', { error: { classification: 'DATABASE_GUARD', message: 'database query is required for a mutating control-plane command' } });
    try { await assertDatabaseTarget(this.options.query, { database: this.options.database }); } catch (error) { return result(context, 'ENVIRONMENT_BLOCKED', { error: { classification: 'DATABASE_GUARD', message: error instanceof Error ? error.message : String(error) } }); }
    const adapter = provider.providerId ? this.adapters.get(provider.providerId) : undefined; const operation = adapter?.operations[options.command];
    if (!operation) return result(context, 'UNSUPPORTED_OPERATION', { warnings: [`No safe adapter dispatch registered for ${provider.providerId ?? 'unregistered provider'}.`] });
    const family = provider.sourceFamilyId ?? adapter?.sourceFamilyId ?? provider.providerId ?? `${provider.house}:${provider.domain}`;
    const maxConcurrency = Math.max(1, provider.rateLimitProfile.maxConcurrency);
    const running = this.familyRunning.get(family) ?? 0;
    if (running >= maxConcurrency) return result(context, 'FAILED_SAFE', { error: { classification: 'SOURCE_FAMILY_CONCURRENCY', message: `source family ${family} is at max concurrency` } });
    this.familyRunning.set(family, running + 1);
    try {
      const retries = Math.max(0, provider.retryPolicy.maxRetries);
      let last: unknown = null;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const patch = await withTimeout(operation(context), provider.defaultTimeoutMs);
          return result(context, patch.status === 'NO_CHANGE' ? 'NO_CHANGE' : patch.status === 'PARTIAL_SOURCE_BOUNDARY' ? 'PARTIAL_SOURCE_BOUNDARY' : 'SUCCESS', { ...patch, warnings: [...(patch.warnings ?? []), ...(attempt ? [`retry=${attempt}`] : [])] });
        } catch (error) {
          last = error;
          if (!isRetryable(error, provider.retryPolicy.retryableErrors) || attempt >= retries) break;
          await delay(provider.retryPolicy.backoffMs * (2 ** attempt));
        }
      }
      return result(context, 'FAILED_SAFE', { error: { classification: isTimeout(last) ? 'TIMEOUT' : 'PROVIDER_FAILURE', message: last instanceof Error ? last.message : String(last) } });
    } finally { this.familyRunning.set(family, Math.max(0, (this.familyRunning.get(family) ?? 1) - 1)); }
  }
}

function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, Math.max(0, ms))); }
function isTimeout(error: unknown): boolean { return error instanceof Error && (/timeout|timed out|abort/i.test(error.message) || (error as any).name === 'AbortError'); }
function isRetryable(error: unknown, configured: readonly string[]): boolean { const message = error instanceof Error ? error.message : String(error); if (isTimeout(error)) return configured.includes('TIMEOUT'); return configured.some(code => message.includes(code) || message.includes(code.replace('HTTP_', 'HTTP '))); }
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`TIMEOUT after ${timeoutMs}ms`)), timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }
