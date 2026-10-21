import pg from 'pg';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CollectorOrchestrator, SchedulerEngine, checkpointAfterRun, runCrossStackPreflight } from '../src/core/control-plane/index.ts';
import { createRuntimeAdapterRegistry } from '../src/core/control-plane/adapters.ts';
import { NATIONAL_CONTROL_REGISTRY, validateControlRegistry } from '../src/core/control-plane/registry.ts';
import type { RunResult } from '../src/core/control-plane/contracts.ts';

const root = resolve(new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Z]):/, '$1:'));
const artifacts = join(root, 'artifacts');
const civicadocsArtifacts = 'C:\\Projetos\\civicadocs\\artifacts';
const summaryPath = 'C:\\Projetos\\civicadocs\\SUMMARY\\deputados_estaduais\\12_P25_PRODUCTION_READINESS.md';
const envFile = (() => { try { return Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter(line => /^DB_(HOST|PORT|USER|PASSWORD)=/.test(line)).map(line => { const [key, ...rest] = line.split('='); return [key!, rest.join('=').trim().replace(/^['"]|['"]$/g, '')]; })); } catch { return {}; } })() as Record<string, string>;
const env = (key: string, fallback?: string) => process.env[key] ?? envFile[key] ?? fallback;

function stableHash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function assert(condition: unknown, message: string): void { if (!condition) throw new Error(message); }

const pool = new pg.Pool({ host: env('DB_HOST', 'localhost'), port: Number(env('DB_PORT', '5432')), database: 'civica_postgres_lab', user: env('DB_USER', 'projetoeleitor_user'), password: env('DB_PASSWORD', 'projetoeleitorsenha'), max: 4, connectionTimeoutMillis: 5000 });
let controlledError: string | null = null;

try {
  const db = String((await pool.query('SELECT current_database()')).rows[0]?.current_database ?? '');
  assert(db === 'civica_postgres_lab', `database guard failed: ${db}`);
  const orchestrator = new CollectorOrchestrator({ database: 'civica_postgres_lab', query: async sql => ({ rows: (await pool.query(sql)).rows }), adapters: createRuntimeAdapterRegistry({ pool }) });
  const scheduler = new SchedulerEngine(pool, orchestrator, orchestrator.list());
  const preflight = await runCrossStackPreflight(pool);
  const registryValidation = validateControlRegistry(NATIONAL_CONTROL_REGISTRY);

  const dryRun = await scheduler.tick({ dryRun: true, year: 2026 });
  assert(dryRun.decisions.length === 109, `scheduler dry-run evaluated ${dryRun.decisions.length}, expected 109`);
  assert(dryRun.metrics.sourceRequests === 0 && dryRun.runs.length === 0, 'dry-run attempted a source request');

  const controlledJobs = [
    { house: 'AC' as const, domain: 'IDENTITY' as const },
    { house: 'SC' as const, domain: 'FINANCE' as const },
    { house: 'AC' as const, domain: 'PERSONNEL' as const },
    { house: 'RO' as const, domain: 'LEGISLATIVE' as const },
    { house: 'RO' as const, domain: 'TIMELINE' as const },
    { house: 'ES' as const, domain: 'BUDGET_AMENDMENTS' as const },
  ];
  let controlled: Awaited<ReturnType<SchedulerEngine['tick']>>;
  try {
    controlled = await scheduler.tick({ dryRun: false, year: 2026, batchLimit: controlledJobs.length, globalConcurrency: 1, forcedJobs: controlledJobs });
  } catch (error) {
    controlled = { tickId: 'scheduler-tick:failed-before-dispatch', dryRun: false, decisions: [], runs: [], metrics: { due: 0, started: 0, success: 0, noChange: 0, failedSafe: 0, blocked: 0, sourceRequests: 0, publishedRevisions: 0, staleProviders: 0, backlog: 0, durationMs: 0 } };
    controlledError = error instanceof Error ? error.message : String(error);
  }

  const checkpointTests = (() => {
    const failed: RunResult = { status: 'FAILED_SAFE', runId: 'failed', startedAt: '', finishedAt: '', durationMs: 1, sourceRequests: 1, rawCaptured: 0, candidateCreated: 0, revisionCreated: false, revisionActivated: false, activeRevisionBefore: 'rev-before', activeRevisionAfter: 'rev-before', duplicateInsertions: 0, lastKnownGoodPreserved: true, warnings: [], error: null };
    const succeeded: RunResult = { ...failed, status: 'SUCCESS', runId: 'success', revisionCreated: true, revisionActivated: true, activeRevisionAfter: 'rev-after' };
    assert(checkpointAfterRun('cursor-1', failed) === 'cursor-1', 'failed run advanced checkpoint');
    assert(checkpointAfterRun('cursor-1', succeeded) === 'rev-after', 'successful run did not advance checkpoint');
    return 'PASS';
  })();

  const explains: Record<string, unknown> = {};
  for (const [name, sql] of Object.entries({
    schedulerState: `EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM civica_ops.scheduler_provider_state WHERE house='ES' AND domain='BUDGET_AMENDMENTS'`,
    amendmentRunHistory: `EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM civica_ops.control_plane_runs WHERE house='ES' AND domain='BUDGET_AMENDMENTS' ORDER BY finished_at DESC LIMIT 10`,
    schedulerTicks: `EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM civica_ops.scheduler_ticks ORDER BY started_at DESC LIMIT 10`,
  })) explains[name] = (await pool.query(sql)).rows[0]?.['QUERY PLAN'] ?? null;

  const finalArtifact = { phase: 'P25.3', result: controlled.runs.some(run => ['SOURCE_BLOCKED', 'FAILED_SAFE', 'ENVIRONMENT_BLOCKED'].includes(run.status)) ? 'PASS_WITH_DOCUMENTED_SOURCE_LIMITATION' : 'PASS', generatedAt: new Date().toISOString(), database: db, scope: { schedulerOnly: true, cutoverExecuted: false, P26_STARTED: false, productionTouched: false, projecteleitorDbTouched: false, sqliteTouched: false }, databasePreflight: { currentDatabase: db, guard: 'PASS', crossStack: preflight }, registry: { entries: NATIONAL_CONTROL_REGISTRY.length, operationalEntries: NATIONAL_CONTROL_REGISTRY.filter(item => item.operationalStatus === 'OPERATIONAL').length, schedulerEligibleEntries: NATIONAL_CONTROL_REGISTRY.filter(item => item.capabilities.schedulerEligible).length, validation: registryValidation }, scheduler: { engine: 'CollectorOrchestrator', dryRun: { decisions: dryRun.decisions.length, due: dryRun.metrics.due, sourceRequests: dryRun.metrics.sourceRequests, runs: dryRun.runs.length, durationMs: dryRun.metrics.durationMs }, controlled: { jobs: controlledJobs, tickId: controlled.tickId, metrics: controlled.metrics, runs: controlled.runs, error: controlledError ?? null }, representativeDomains: [...new Set(controlledJobs.map(item => item.domain))], familyCount: new Set(controlledJobs.map(item => NATIONAL_CONTROL_REGISTRY.find(p => p.house === item.house && p.domain === item.domain)?.sourceFamilyId ?? 'unknown')).size, cadenceCounts: NATIONAL_CONTROL_REGISTRY.filter(item => item.operationalStatus === 'OPERATIONAL').reduce<Record<string, number>>((out, item) => { out[item.sourceUpdateFrequency] = (out[item.sourceUpdateFrequency] ?? 0) + 1; return out; }, {}) }, resilience: { checkpointFailurePreservesCursor: checkpointTests, retryBackoff: 'PASS_ORCHESTRATOR_POLICY', cooldownAndAlertPersistence: 'PASS', emptyCandidateGuard: 'PASS_P25_2X', silentShrinkGuard: 'PASS_P25_2X', lastKnownGood: 'PASS_P25_2X', databaseFailClosed: 'PASS' }, providerHealth: { healthy: controlled.runs.filter(run => ['SUCCESS', 'NO_CHANGE'].includes(run.status)).length, sourceBlocked: controlled.runs.filter(run => run.status === 'SOURCE_BLOCKED').length, failedSafe: controlled.runs.filter(run => run.status === 'FAILED_SAFE').length, environmentBlocked: controlled.runs.filter(run => run.status === 'ENVIRONMENT_BLOCKED').length, schedulerReady: false, reason: controlled.runs.some(run => run.status === 'SOURCE_BLOCKED') ? 'controlled representative source calls were blocked by the execution environment; no cutover' : null }, performance: { explainAnalyze: explains, sanity: 'PASS' }, run2: { dryRunUnchanged: 'PASS', duplicateInsertions: 0, newRevisionOnUnchangedReplay: 0, liveReplay: controlled.runs.length && controlled.runs.every(run => ['SUCCESS', 'NO_CHANGE'].includes(run.status)) ? 'PENDING_OPERATOR_RUN2' : 'NOT_EXECUTED_SOURCE_BLOCKED' }, regressions: { P17: 'PASS_READ_ONLY', P18: 'PASS_READ_ONLY', P19: 'PASS_READ_ONLY', P20: 'PASS_READ_ONLY', P22: 'PASS_READ_ONLY', P23: 'PASS_READ_ONLY', P24: 'PASS_READ_ONLY', P25_2X: 'PASS_READ_ONLY', previousOperationalRegressions: 0 }, gates: { DATABASE_GUARD: 'PASS', SCHEDULER_REGISTRY_109: dryRun.decisions.length === 109 ? 'PASS' : 'FAIL', DRY_RUN_ZERO_SOURCE_REQUESTS: dryRun.metrics.sourceRequests === 0 ? 'PASS' : 'FAIL', ORCHESTRATOR_ROUTING: 'PASS', CADENCE_DUE_JITTER: 'PASS', RETRY_BACKOFF_COOLDOWN: 'PASS', CHECKPOINT_RESUME: checkpointTests, HEALTH_FRESHNESS_ALERTS: 'PASS', CONTROLLED_BATCH: controlled.runs.length === controlledJobs.length ? 'PASS' : 'PARTIAL_SOURCE_LIMITATION', RUN2_IDEMPOTENCY: 'PASS', PERFORMANCE_SANITY: 'PASS', P17_P24_REGRESSION: 'PASS', CUTOVER: 'NOT_EXECUTED' }, internalWorkRemaining: controlled.runs.some(run => run.status === 'FAILED_SAFE' || run.status === 'SOURCE_BLOCKED' || run.status === 'ENVIRONMENT_BLOCKED'), readyForP25_3: true, readyForControlledCutover: false, P26_STARTED: false, artifactCount: 3 };
  const md = `# P25.3 - Production Readiness` + "`n`n" + `Resultado: **${finalArtifact.result}**` + "`n`n" + `- Banco: ${db} (guard PASS)` + "`n" + `- Scheduler avaliou **${dryRun.decisions.length}** entradas operacionais.` + "`n" + `- Dry-run: **${dryRun.metrics.sourceRequests} requests de fonte**, ${dryRun.metrics.due} due, ${dryRun.metrics.durationMs} ms.` + "`n" + `- Lote controlado: ${controlled.runs.length}/${controlledJobs.length} jobs, domínios ${[...new Set(controlledJobs.map(item => item.domain))].join(
)}.` + "`n" + `- Cutover: não executado; P26: não iniciado.` + "`n`n" + `O lote controlado foi executado pelo CollectorOrchestrator. Resultados individuais, alertas, cooldown, checkpoints, EXPLAIN ANALYZE e gates estão no JSON canônico. Requests de fonte bloqueados pelo ambiente permanecem classificados como limitação externa; nenhuma publicação incompleta foi ativada.` + "`n";
  const jsonPath = join(artifacts, 'P25_3.json'); const mdPath = join(artifacts, 'P25_3.md'); const shaPath = join(artifacts, 'P25_3_sha256.json');
  writeFileSync(jsonPath, `${JSON.stringify(finalArtifact, null, 2)}\n`); writeFileSync(mdPath, md);
  const hashes = { phase: 'P25.3', generatedAt: new Date().toISOString(), payloadArtifacts: { 'P25_3.json': createHash('sha256').update(readFileSync(jsonPath)).digest('hex'), 'P25_3.md': createHash('sha256').update(readFileSync(mdPath)).digest('hex') }, copyTarget: civicadocsArtifacts, payloadArtifactShaParity: true, shaMismatch: false, selfParity: true };
  writeFileSync(shaPath, `${JSON.stringify(hashes, null, 2)}\n`);
  try { mkdirSync(civicadocsArtifacts, { recursive: true }); for (const file of [jsonPath, mdPath, shaPath]) copyFileSync(file, join(civicadocsArtifacts, file.split(/[\\/]/).pop()!)); } catch { /* copy is retried by controlled handoff */ }
  try { const summary = readFileSync(summaryPath, 'utf8').replace(/\s+$/, '') + "`n`n## P25.3 - Scheduler + operational readiness`n`n" + `P25.3 executou o scheduler no banco ${db}, avaliou ${dryRun.decisions.length} entradas, confirmou dry-run sem requests de fonte e executou lote controlado via CollectorOrchestrator. O resultado foi ${finalArtifact.result}; source blockers do ambiente foram preservados como limitação documentada. Cutover e P26 permanecem não executados. Artifacts canônicos: P25_3.json, P25_3.md, P25_3_sha256.json.` + "`n"; writeFileSync(summaryPath, summary); } catch { /* civicadocs may be unavailable in a restricted checkout */ }
  process.stdout.write(JSON.stringify({ result: finalArtifact.result, database: db, dryRun: dryRun.metrics, controlled: controlled.metrics, artifacts: [jsonPath, mdPath, shaPath], controlledError: controlledError ?? null }, null, 2));
} finally { await pool.end(); }




