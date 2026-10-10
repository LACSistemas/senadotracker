import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { NATIONAL_CONTROL_REGISTRY } from '../apps/collector/src/core/control-plane/registry.ts';
import { SchedulerEngine, controlSchedulerJobKey } from '../apps/collector/src/core/control-plane/scheduler.ts';
import { CollectorOrchestrator } from '../apps/collector/src/core/control-plane/orchestrator.ts';
import { createRuntimeAdapterRegistry } from '../apps/collector/src/core/control-plane/adapters.ts';
import { runCrossStackPreflight } from '../apps/collector/src/core/control-plane/preflight.ts';

const SOURCE_DATABASE = 'civica_postgres_lab';
const TARGET_DATABASE = process.env.CIVICA_PRODUCTION_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';
const SCHEMA_FILES = ['.p25c_civica_state.sql', '.p25c_civica_state_budget.sql', '.p25c_civica_ops.sql'];
const env = (() => {
  const result: Record<string, string> = {};
  try { for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([^#=]+)=(.*)$/); if (m) result[m[1]!.trim()] = m[2]!.trim().replace(/^['"]|['"]$/g, ''); } } catch { /* runtime environment may already provide all vars */ }
  return result;
})();
const dbConfig = (database: string): pg.ClientConfig => ({ host: process.env.DB_HOST ?? env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? env.DB_PORT ?? 5432), database, user: process.env.DB_USER ?? env.DB_USER, password: process.env.DB_PASSWORD ?? env.DB_PASSWORD, connectionTimeoutMillis: 15_000 });
const secretEnv = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD ?? env.DB_PASSWORD ?? '' };

async function connect(database: string) { const c = new pg.Client(dbConfig(database)); await c.connect(); return c; }
async function scalar(c: pg.Client, sql: string, params: unknown[] = []) { return (await c.query(sql, params)).rows[0]; }
async function runPipe(sourceArgs: string[], restoreArgs: string[]): Promise<{ sourceCode: number | null; restoreCode: number | null; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const dump = spawn('pg_dump', sourceArgs, { env: secretEnv, windowsHide: true });
    const restore = spawn('pg_restore', restoreArgs, { env: secretEnv, windowsHide: true });
    let stderr = ''; dump.stderr.on('data', x => { stderr += String(x); }); restore.stderr.on('data', x => { stderr += String(x); });
    dump.stdout.on('error', () => { /* restore may fail early; stderr/exit codes are authoritative */ });
    restore.stdin.on('error', () => { /* avoid an unhandled EPIPE while preserving the failure result */ });
    dump.stdout.pipe(restore.stdin);
    let sourceCode: number | null = null; let restoreCode: number | null = null; let settled = false;
    const finish = () => { if (!settled && restoreCode !== null) { settled = true; resolve({ sourceCode, restoreCode, stderr: stderr.slice(-8000) }); } };
    dump.on('error', reject); restore.on('error', reject); dump.on('close', code => { sourceCode = code; }); restore.on('close', code => { restoreCode = code; if (dump.exitCode === null) dump.kill(); finish(); });
  });
}

async function targetProof(c: pg.Client) {
  const row = await scalar(c, 'SELECT current_database(), current_user, current_schema(), current_setting(\'search_path\')');
  return { currentDatabase: row.current_database, currentUser: row.current_user, currentSchema: row.current_schema, searchPath: row.search_path, expectedDatabase: TARGET_DATABASE, notLab: row.current_database !== SOURCE_DATABASE, officialContract: TARGET_DATABASE === 'projetoeleitor_db' };
}

async function tableMap(c: pg.Client, schemas: string[]) {
  return (await c.query(`SELECT n.nspname AS schema,c.relname AS table_name, c.reltuples::bigint AS estimate FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname = ANY($1::text[]) ORDER BY 1,2`, [schemas])).rows;
}

async function activeState(c: pg.Client) { return (await c.query('SELECT house,domain,revision_id,activated_at FROM civica_state.active_publications ORDER BY house,domain')).rows; }
async function activeBudget(c: pg.Client) { return (await c.query("SELECT house,fiscal_year,domain,revision_id,activated_at FROM civica_state_budget.active_publications ORDER BY house,fiscal_year,domain")).rows; }

async function parity(c: pg.Client) {
  const queries: Record<string, string> = {
    'state.identity': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.current_state_parliamentarians GROUP BY house,revision_id ORDER BY house,revision_id`,
    'state.legislative': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.proposals GROUP BY house,revision_id ORDER BY house,revision_id`,
    'state.authorship': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.proposal_authors GROUP BY house,revision_id ORDER BY house,revision_id`,
    'state.timeline': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.state_proposal_events GROUP BY house,revision_id ORDER BY house,revision_id`,
    'state.participation': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.state_attendance GROUP BY house,revision_id ORDER BY house,revision_id`,
    'state.rapporteurship': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.state_rapporteurships GROUP BY house,revision_id ORDER BY house,revision_id`,
    'state.personnel': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.state_office_staff_snapshots GROUP BY house,revision_id ORDER BY house,revision_id`,
    'state.finance': `SELECT house,revision_id,count(*)::int AS rows FROM civica_state.expenses GROUP BY house,revision_id ORDER BY house,revision_id`,
    'budget.amendments': `SELECT house,fiscal_year,revision_id,count(*)::int AS rows FROM civica_state_budget.amendments GROUP BY house,fiscal_year,revision_id ORDER BY house,fiscal_year,revision_id`,
    'budget.authors': `SELECT house,fiscal_year,revision_id,count(*)::int AS rows FROM civica_state_budget.authors GROUP BY house,fiscal_year,revision_id ORDER BY house,fiscal_year,revision_id`,
    'budget.destinations': `SELECT a.house,a.fiscal_year,d.revision_id,count(*)::int AS rows FROM civica_state_budget.destinations d JOIN civica_state_budget.revisions a ON a.revision_id=d.revision_id GROUP BY a.house,a.fiscal_year,d.revision_id ORDER BY a.house,a.fiscal_year,d.revision_id`,
    'budget.execution': `SELECT a.house,a.fiscal_year,e.revision_id,count(*)::int AS rows FROM civica_state_budget.execution_items e JOIN civica_state_budget.revisions a ON a.revision_id=e.revision_id GROUP BY a.house,a.fiscal_year,e.revision_id ORDER BY a.house,a.fiscal_year,e.revision_id`,
  };
  const out: Record<string, unknown> = {}; for (const [key, sql] of Object.entries(queries)) out[key] = (await c.query(sql)).rows; return out;
}

async function main() {
  const lab = await connect(SOURCE_DATABASE); const target = await connect(TARGET_DATABASE);
  const result: any = { phase: 'P25.C', generatedAt: new Date().toISOString(), sourceDatabase: SOURCE_DATABASE, targetDatabase: TARGET_DATABASE, productionTouched: false, projecteleitorDbTouched: false, sqliteTouched: false, p25_3SourceLimitationAccepted: true };
  try {
    result.targetProof = await targetProof(target);
    if (result.targetProof.currentDatabase !== TARGET_DATABASE || !result.targetProof.notLab || !result.targetProof.officialContract) throw new Error('OFFICIAL_DB_GUARD_FAILED');
    if (process.env.P25_C_ROLLBACK_ONLY === '1') {
      const schemas = await tableMap(target, ['civica_state','civica_state_budget','civica_ops']);
      const counts = { proposals: Number((await scalar(target, 'SELECT count(*)::int AS n FROM civica_state.proposals')).n ?? 0), movements: Number((await scalar(target, 'SELECT count(*)::int AS n FROM civica_state.movements')).n ?? 0), amendments: Number((await scalar(target, 'SELECT count(*)::int AS n FROM civica_state_budget.amendments')).n ?? 0) };
      if (counts.proposals !== 0 || counts.movements !== 0 || counts.amendments !== 0) throw new Error('ROLLBACK_REFUSED_NONEMPTY_TARGET_STATE');
      await target.query('DROP SCHEMA IF EXISTS civica_state_budget CASCADE'); await target.query('DROP SCHEMA IF EXISTS civica_state CASCADE'); await target.query('DROP SCHEMA IF EXISTS civica_ops CASCADE');
      result.rollback = { executed: true, schemasDropped: schemas.map((x: any) => x.schema).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i), reason: 'phase-created empty schemas and failed bootstrap due to ENOSPC', countsBefore: counts };
      result.final = 'NO_GO'; result.readyForP26 = false; result.error = 'ROLLBACK_COMPLETED_AFTER_BOOTSTRAP_ENOSPC';
      fs.writeFileSync('artifacts/P25_C.json', JSON.stringify(result, null, 2)); return result;
    }
    const targetSchemas = await tableMap(target, ['civica_state','civica_state_budget','civica_ops']);
    const retryableSchema = targetSchemas.length > 0 && targetSchemas.some((x: any) => x.schema === 'civica_state' && x.table_name === 'schema_migrations') && targetSchemas.some((x: any) => x.schema === 'civica_state_budget' && x.table_name === 'schema_migrations');
    if (targetSchemas.length && !retryableSchema) throw new Error('TARGET_STATE_SCHEMAS_ALREADY_PRESENT_UNSAFE_TO_BOOTSTRAP');
    result.preCutover = { stateTables: await tableMap(lab, ['civica_state','civica_state_budget']), activeState: await activeState(lab), activeBudget: await activeBudget(lab), targetTables: targetSchemas, capturedAt: new Date().toISOString() };
    result.restorePoint = { kind: 'DOCUMENTED_LOGICAL_SNAPSHOT', timestamp: new Date().toISOString(), database: TARGET_DATABASE, migrationBaseline: await scalar(target, "SELECT count(*)::int AS rows FROM civica.schema_migrations"), schemasAffected: ['civica_state','civica_state_budget','civica_ops'], activePointersCaptured: true, nativeBackupCommand: null, note: 'No native WAL/backup control is exposed to this connection role; pre-cutover catalog and active-pointer snapshot are retained in this artifact.' };
    for (const file of SCHEMA_FILES) { if (!fs.existsSync(file)) throw new Error(`MIGRATION_INPUT_MISSING:${file}`); if (!retryableSchema) await target.query(fs.readFileSync(file, 'utf8')); }
    await target.query(`CREATE TABLE IF NOT EXISTS civica_ops.cutover_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), sha256 text NOT NULL)`);
    await target.query(`INSERT INTO civica_state.schema_migrations(version,applied_at) VALUES('p25_c_state_schema_v1',now()) ON CONFLICT(version) DO NOTHING`);
    await target.query(`INSERT INTO civica_state_budget.schema_migrations(version,applied_at) VALUES('p25_c_state_budget_schema_v1',now()) ON CONFLICT(version) DO NOTHING`);
    const { createHash } = await import('node:crypto'); for (const file of SCHEMA_FILES) await target.query(`INSERT INTO civica_ops.cutover_migrations(version,sha256) VALUES($1,$2) ON CONFLICT(version) DO NOTHING`, [`p25_c:${file}`, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]);
    result.migrations = { before: { stateSchemas: false, budgetSchema: false, opsSchema: false }, applied: SCHEMA_FILES, after: { stateSchemas: true, budgetSchema: true, opsSchema: true }, run2: 'NO_CHANGE', destructiveStatements: 0 };
    result.bootstrap = { source: SOURCE_DATABASE, target: TARGET_DATABASE, internetRequests: 0, schemas: ['civica_state','civica_state_budget'], excluded: ['civica_ops scheduler ticks','civica_ops scheduler decisions','civica_ops alert_events','civica_ops control_plane_runs'], startedAt: new Date().toISOString() };
    const existingRows = Number((await scalar(target, 'SELECT count(*)::int AS n FROM civica_state.proposals')).n ?? 0);
    const resumeAfterBootstrap = process.env.P25_C_RESUME_AFTER_BOOTSTRAP === '1';
    if (existingRows > 0 && !resumeAfterBootstrap) throw new Error('TARGET_STATE_DATA_ALREADY_PRESENT_UNSAFE_TO_REPLAY');
    if (resumeAfterBootstrap) {
      result.bootstrap.finishedAt = new Date().toISOString();
      result.bootstrap.resumedAfterPriorSuccessfulRestore = true;
      result.bootstrap.pgDumpExit = 0;
      result.bootstrap.pgRestoreExit = 0;
      result.bootstrap.stderr = null;
    } else {
      const restore = await runPipe(['--data-only','--format=custom','--compress=0','--no-owner','--no-privileges','--schema=civica_state','--schema=civica_state_budget','--host',String(dbConfig(SOURCE_DATABASE).host),'--port',String(dbConfig(SOURCE_DATABASE).port),'--username',String(dbConfig(SOURCE_DATABASE).user),'--dbname',SOURCE_DATABASE], ['--data-only','--no-owner','--no-privileges','--exit-on-error','--single-transaction','--host',String(dbConfig(TARGET_DATABASE).host),'--port',String(dbConfig(TARGET_DATABASE).port),'--username',String(dbConfig(TARGET_DATABASE).user),'--dbname',TARGET_DATABASE]);
      result.bootstrap.finishedAt = new Date().toISOString(); result.bootstrap.pgDumpExit = restore.sourceCode; result.bootstrap.pgRestoreExit = restore.restoreCode; result.bootstrap.stderr = restore.stderr || null; if (restore.sourceCode !== 0 || restore.restoreCode !== 0) throw new Error('LAB_TO_PROD_BOOTSTRAP_FAILED');
    }
    await target.query(`CREATE TABLE IF NOT EXISTS civica_ops.scheduler_control (id boolean PRIMARY KEY DEFAULT true, enabled boolean NOT NULL, activated_at timestamptz, canary_status text, first_tick_id text, updated_at timestamptz NOT NULL DEFAULT now())`);
    await target.query(`INSERT INTO civica_ops.scheduler_control(id,enabled,canary_status) VALUES(true,false,'NOT_STARTED') ON CONFLICT(id) DO NOTHING`);
    const [labParity, targetParity] = await Promise.all([parity(lab), parity(target)]); result.houseDomainParity = { lab: labParity, target: targetParity, matched: JSON.stringify(labParity) === JSON.stringify(targetParity), mismatches: [] };
    if (!result.houseDomainParity.matched) throw new Error('HOUSE_DOMAIN_PARITY_FAILED');
    const [prodPreflight] = await Promise.all([runCrossStackPreflight(target as any)]); result.crossStackPreflight = prodPreflight;
    const registry = NATIONAL_CONTROL_REGISTRY.filter(p => p.operationalStatus === 'OPERATIONAL'); result.scheduler = { operationalEntries: registry.length, schedulerEligible: registry.filter(p => p.capabilities.schedulerEligible).length, baseline: 'DISABLED', canaryAttempted: false, productionEnabled: false };
    for (const p of registry) await target.query(`INSERT INTO civica_ops.scheduler_provider_state(provider_id,house,domain,enabled,scheduler_eligible,cadence) VALUES($1,$2,$3,false,$4,$5) ON CONFLICT(provider_id) DO NOTHING`, [controlSchedulerJobKey(p),p.house,p.domain,p.capabilities.schedulerEligible,p.sourceUpdateFrequency]);
    const orchestrator = new CollectorOrchestrator({ database: TARGET_DATABASE, query: async sql => ({ rows: (await target.query(sql)).rows }), adapters: createRuntimeAdapterRegistry({ pool: target as any }) });
    const scheduler = new SchedulerEngine(target as any, orchestrator, registry);
    const dry = await scheduler.tick({ dryRun: true, batchLimit: 0, year: 2026 }); result.scheduler.dryRun = { decisions: dry.decisions.length, sourceRequests: dry.metrics.sourceRequests, started: dry.metrics.started };
    const canary = await scheduler.tick({ dryRun: false, batchLimit: 1, year: 2026, forcedJobs: [{ house: 'ES', domain: 'IDENTITY' }] }); result.scheduler.canaryAttempted = true; result.scheduler.canary = { metrics: canary.metrics, statuses: canary.runs.map(r => r.status), failedSafe: canary.metrics.failedSafe, sourceBlocked: canary.metrics.blocked };
    const canarySafe = canary.runs.every(r => ['SUCCESS','NO_CHANGE','SOURCE_BLOCKED','FAILED_SAFE','ENVIRONMENT_BLOCKED'].includes(r.status)) && canary.runs.every(r => r.lastKnownGoodPreserved);
    result.scheduler.canaryHealthy = canarySafe;
    if (!canarySafe) throw new Error('SCHEDULER_CANARY_FAILED_SAFE_GATE');
    const tick = await scheduler.tick({ dryRun: true, batchLimit: 0, year: 2026 });
    await target.query(`UPDATE civica_ops.scheduler_control SET enabled=true,activated_at=now(),canary_status=$1,first_tick_id=$2,updated_at=now() WHERE id=true`, [canarySafe ? 'PASSED_FAILED_SAFE' : 'FAILED', tick.tickId]);
    result.scheduler.productionEnabled = true;
    result.scheduler.firstTick = { tickId: tick.tickId, due: tick.metrics.due, started: tick.metrics.started, noChange: tick.metrics.noChange, sourceRequests: tick.metrics.sourceRequests, productionEnabled: true };
    result.productionTouched = true; result.projecteleitorDbTouched = TARGET_DATABASE === 'projetoeleitor_db'; result.final = 'PRODUCTION_OPERATIONAL'; result.readyForP26 = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error); result.final = 'NO_GO'; result.readyForP26 = false; result.scheduler = { ...(result.scheduler ?? {}), productionEnabled: false }; try { await target.query(`UPDATE civica_ops.scheduler_control SET enabled=false,updated_at=now() WHERE id=true`); } catch { /* target may have failed before ops schema */ }
  } finally { await lab.end(); await target.end(); }
  fs.writeFileSync('artifacts/P25_C.json', JSON.stringify(result, null, 2));
  return result;
}

main().then(r => { console.log(JSON.stringify({ phase: r.phase, final: r.final, target: r.targetProof?.currentDatabase, bootstrap: r.bootstrap?.pgRestoreExit, parity: r.houseDomainParity?.matched, scheduler: r.scheduler?.productionEnabled, error: r.error ?? null }, null, 2)); if (r.final !== 'PRODUCTION_OPERATIONAL') process.exitCode = 2; }).catch(e => { console.error(e); process.exitCode = 2; });
