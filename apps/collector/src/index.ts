import { runCli } from './cli.ts';
import { parseInstitutionalCli } from './institutional-cli.ts';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { CollectorOrchestrator, runControlCli, runCrossStackPreflight, SchedulerEngine } from './core/control-plane/index.ts';
import { createRuntimeAdapterRegistry } from './core/control-plane/adapters.ts';

const args = process.argv.slice(2);
const institutionalOptions=parseInstitutionalCli(args);
const option=(name:string)=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined};
const sourceArg = option('--source') ?? (args[1] === '--source' ? args[2] : undefined);
const isCollect = args[0] === 'collect' && ['senado','camara','all'].includes(sourceArg ?? '');
const isStatus = args.length === 1 && args[0] === 'status';
const isExpense = args[0] === 'collect-expenses' && ['senado','camara','all'].includes(option('--source') ?? args[2] ?? '') && /^20\d{2}$/.test(option('--year') ?? args[4] ?? '');
const isVotes = args[0] === 'collect-votes' && ['senado','camara','all'].includes(sourceArg ?? '') && /^20\d{2}$/.test((option('--year') ?? (args[3] === '--year' ? args[4] : '')) ?? '');
const isActivity = args[0] === 'collect-activity' && ['senado','camara','all'].includes(sourceArg ?? '');
const isPresence = args[0] === 'collect-presence' && ['senado','camara','all'].includes(sourceArg ?? '') && /^20\d{2}$/.test((option('--year') ?? (args[3] === '--year' ? args[4] : '')) ?? '');
const isComplement = args.length === 3 && args[0] === 'collect-complement' && args[1] === '--source' && ['senado','camara','all'].includes(args[2]!);
const isCabinet = args[0] === 'import-cabinet' && option('--source')==='senado' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(option('--competence')??'') && Boolean(option('--file'));
const isElection=args[0]==='import-elections'&&/^20(18|22)$/.test(option('--year')??'');
const isCamaraStaff=args[0]==='collect-camara-staff';
const isCamaraBudget=args[0]==='collect-camara-budget'&&/^20\d{2}$/.test(option('--year')??'');
const isSenateStaff=args[0]==='collect-senate-staff'&&/^20\d{2}$/.test(option('--year')??'');
const isPriceIndex=args[0]==='collect-price-index'&&['ipca'].includes(option('--index')??'');
const isThemes=args[0]==='collect-themes'&&/^20\d{2}$/.test(option('--year')??'');
const isCamaraPropositions=args[0]==='collect-camara-propositions'&&Boolean(option('--ids'));
const isCamaraMovements=args[0]==='collect-camara-tramitacoes'&&/^20\d{2}$/.test(option('--year')??'');
const isSenateProcesses=args[0]==='collect-senate-processes'&&/^20\d{2}$/.test(option('--year')??'');
const isSenateAgenda=args[0]==='collect-senate-agenda'&&/^20\d{2}$/.test(option('--year')??'');
const isCamaraAgenda=args[0]==='collect-camara-agenda'&&/^20\d{2}$/.test(option('--year')??'');
const isPropositionEnrichment=args[0]==='collect-proposition-enrichment'&&['senado','camara','all'].includes(option('--source')??'')&&/^20\d{2}$/.test(option('--year')??'');
const isCamaraPrincipals=args[0]==='collect-camara-principals';
const isCamaraPresented=args[0]==='collect-camara-presented'||args[0]==='reconcile-camara-presented';
const isSenadoPresented=args[0]==='collect-senado-presented'||args[0]==='reconcile-senado-presented';
const isStateCoverage=args[0]==='state'&&args[1]==='coverage'&&option('--house')==='RO';
const isControlPlane = ['--help','-h','status','health','validate','refresh','backfill','replay','preflight','scheduler-tick'].includes(args[0] ?? '') || (args[0] === 'collect' && !isCollect && args.length > 1);
// npm/PowerShell combinations may consume named options while forwarding a root
// workspace script. Accept the documented named form and an equivalent positional
// fallback so `collect-house-operations all 2026` remains deterministic.
const houseOperationsSource=option('--source')??(args[0]==='collect-house-operations'?args[1]:undefined);
const houseOperationsYear=option('--year')??(args[0]==='collect-house-operations'?args[2]:undefined);
const isHouseOperations=args[0]==='collect-house-operations'&&['senado','camara','all'].includes(houseOperationsSource??'')&&/^20\d{2}$/.test(houseOperationsYear??'');
const postgresHouseSource=option('--source')??(args[0]==='collect-house-operations-pg'?args[1]:undefined);
const postgresHouseYear=option('--year')??(args[0]==='collect-house-operations-pg'?args[2]:undefined);
const isPostgresHouseOperations=args[0]==='collect-house-operations-pg'&&['senado','camara','all'].includes(postgresHouseSource??'')&&/^20\d{2}$/.test(postgresHouseYear??'');
const isPostgresCollectorCommand = isSenadoPresented || isCamaraPresented || isCamaraPrincipals || isStateCoverage || isCollect || isActivity || isExpense || isElection || isComplement || isPropositionEnrichment || isThemes || isVotes || isPresence || isSenateAgenda || isCamaraAgenda || isHouseOperations || isPostgresHouseOperations || isCamaraPropositions || isCamaraMovements || isSenateProcesses || args[0] === 'refresh-proposition-operational' || ['rebuild-supplier-aggregates','collect-institutional-suppliers','sync-institutional-suppliers'].includes(institutionalOptions?.command ?? '');
if (isPostgresCollectorCommand) {
  if (isStateCoverage) {
    await import('../../../scripts/state-coverage-ro.ts');
  } else if (isSenadoPresented) {
    const { collectSenadoPresentedPostgres } = await import('./postgres-senado-presented.ts');
    const reconcileOnly = args[0] === 'reconcile-senado-presented';
    const result = await collectSenadoPresentedPostgres({ ...(option('--from') ? { from: option('--from')! } : {}), ...(option('--to') ? { to: option('--to')! } : {}), ...(option('--overlap-days') ? { overlapDays: Number(option('--overlap-days')) } : {}), ...(Number(option('--limit')) ? { limit: Number(option('--limit')) } : {}), concurrency: Number(option('--concurrency')) || 4, refresh: args.includes('--refresh'), backfillAuthors: args.includes('--backfill-authors'), ingest: !reconcileOnly, progress: message => console.error(message) });
    console.log(JSON.stringify({ ...result, errors: result.errors.slice(0, 10) }, null, 2));
  } else if (isCamaraPresented) {
    const { collectCamaraPresentedPostgres } = await import('./postgres-camara-presented.ts');
    const reconcileOnly = args[0] === 'reconcile-camara-presented';
    const result = await collectCamaraPresentedPostgres({ ...(option('--from') ? { from: option('--from')! } : {}), ...(option('--to') ? { to: option('--to')! } : {}), ...(option('--overlap-days') ? { overlapDays: Number(option('--overlap-days')) } : {}), ...(Number(option('--limit')) ? { limit: Number(option('--limit')) } : {}), concurrency: Number(option('--concurrency')) || 4, refresh: args.includes('--refresh'), ingest: !reconcileOnly, progress: message => console.error(message) });
    console.log(JSON.stringify({ ...result, errors: result.errors.slice(0, 10) }, null, 2));
  } else if (isCamaraPrincipals) {
    const { resolveCamaraPrincipalsPostgres } = await import('./postgres-principal-resolver.ts');
    const scope = option('--scope') === 'all' ? 'all' : 'amendments';
    console.log(JSON.stringify(await resolveCamaraPrincipalsPostgres({ scope, maxDepth: Number(option('--max-depth')) || 10, concurrency: Number(option('--concurrency')) || 4, ...(Number(option('--limit')) ? { limit: Number(option('--limit')) } : {}), progress: message => console.error(message) }), null, 2));
  } else {
  const { collectSourcePostgres, collectActivityPostgres, refreshPropositionOperationalComponentsPostgres, refreshPropositionEnrichmentPostgres, collectCommitteesPostgres, collectVotesPresencePostgres, collectExpensesPostgres, refreshSupplierDerivedPostgres, collectElectionsPostgres, collectInstitutionalSuppliersPostgres } = await import('./postgres-collector.ts');
  const selected = (option('--source') ?? (args[0] === 'collect-themes' ? 'camara' : (args[2] === 'all' ? 'all' : args[2]))) as 'senado'|'camara'|'all'|undefined;
  if (args[0] === 'collect-expenses') {
    const requested = (option('--source') ?? args[2]) as 'senado'|'camara'|'all'; const year = Number(option('--year') ?? args[4]);
    for (const source of (requested === 'all' ? ['senado','camara'] : [requested]) as ('senado'|'camara')[]) console.log(JSON.stringify(await collectExpensesPostgres(source, year, { limit: Number(option('--limit')) || 100, smoke: args.includes('--smoke') }), null, 2));
  } else if (args[0] === 'import-elections') {
    console.log(JSON.stringify(await collectElectionsPostgres(Number(option('--year')), { limit: Number(option('--limit')) || 100, smoke: args.includes('--smoke') }), null, 2));
  } else if (institutionalOptions?.command === 'collect-institutional-suppliers' || institutionalOptions?.command === 'sync-institutional-suppliers') {
    const supplierYear = Number(option('--year')); console.log(JSON.stringify({ suppliers: await collectInstitutionalSuppliersPostgres({ ...(supplierYear > 0 ? { year: supplierYear } : {}), smoke: args.includes('--smoke') }), derived: await refreshSupplierDerivedPostgres(supplierYear > 0 ? supplierYear : undefined) }, null, 2));
  } else if (institutionalOptions?.command === 'rebuild-supplier-aggregates') {
    console.log(JSON.stringify(await refreshSupplierDerivedPostgres(Number(option('--year')) || undefined), null, 2));
  } else if (isPostgresHouseOperations) {
    const { rebuildHouseOperationsPostgres } = await import('./postgres-house-operations.ts');
    const requested = postgresHouseSource as 'senado'|'camara'|'all'; const year = Number(postgresHouseYear);
    const cacheFile = option('--cache-file');
    for (const source of (requested === 'all' ? ['senado','camara'] : [requested]) as ('senado'|'camara')[]) console.log(JSON.stringify(await rebuildHouseOperationsPostgres(source, year, { ...(cacheFile ? { cacheFile } : {}), publish: args.includes('--publish') }), null, 2));
  } else if (args[0] === 'collect') {
    for (const source of (selected === 'all' ? ['senado','camara'] : [selected]) as ('senado'|'camara')[]) if (source) { const limit = Number(option('--limit')); console.log(JSON.stringify(await collectSourcePostgres({ source, ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}), smoke: args.includes('--smoke'), progress: message => console.error(message) }), null, 2)); }
  } else if (args[0] === 'collect-activity') {
    for (const source of (selected === 'all' ? ['senado','camara'] : [selected]) as ('senado'|'camara')[]) if (source) { const scope = option('--scope'); console.log(JSON.stringify(await collectActivityPostgres(source, { ...(scope ? { scope } : {}), smoke: args.includes('--smoke') }), null, 2)); }
  } else if (args[0] === 'collect-votes' || args[0] === 'collect-presence') {
    const year = Number(option('--year') ?? args[4]); for (const source of (selected === 'all' ? ['senado','camara'] : [selected]) as ('senado'|'camara')[]) if (source) console.log(JSON.stringify(await collectVotesPresencePostgres(source, year, { limit: Number(option('--limit')) || 100, smoke: args.includes('--smoke') }), null, 2));
  } else if (args[0] === 'collect-senate-agenda' || args[0] === 'collect-camara-agenda') {
    const source = args[0] === 'collect-senate-agenda' ? 'senado' : 'camara'; console.log(JSON.stringify(await collectCommitteesPostgres(source, { limit: Number(option('--limit')) || 50, smoke: args.includes('--smoke') }), null, 2));
  } else if (args[0] === 'refresh-proposition-operational') {
    console.log(JSON.stringify(await refreshPropositionOperationalComponentsPostgres(Number(option('--year')) || new Date().getUTCFullYear()), null, 2));
  } else if (isComplement || isCamaraPropositions || isCamaraMovements || isSenateProcesses || isHouseOperations) {
    const requested = (option('--source') ?? (isSenateProcesses ? 'senado' : isHouseOperations ? houseOperationsSource : 'camara')) as 'senado'|'camara'|'all';
    const sources = (requested === 'all' ? ['senado','camara'] : [requested]) as ('senado'|'camara')[];
    const limit = Number(option('--limit')) || 100;
    for (const source of sources) if (source) console.log(JSON.stringify(await refreshPropositionEnrichmentPostgres(source, limit), null, 2));
  } else {
    const sources = (selected === 'all' ? ['senado','camara'] : [selected]) as ('senado'|'camara')[];
    const limit = Number(option('--limit')) || 100;
    for (const source of sources) if (source) console.log(JSON.stringify(await refreshPropositionEnrichmentPostgres(source, limit), null, 2));
  }
  }
} else if (isControlPlane) {
  // Load the same local connection contract used by the application.  The
  // target is still checked by SELECT current_database() before any write.
  const localEnv = (() => { try { return Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => /^DB_(HOST|PORT|NAME|USER|PASSWORD)=/.test(line)).map(line => { const [key, ...rest] = line.split('='); return [key!, rest.join('=').trim().replace(/^['"]|['"]$/g, '')]; })); } catch { return {}; } })() as Record<string, string>;
  const env = (key: string, fallback?: string) => process.env[key] ?? localEnv[key] ?? fallback;
  const database = env('CIVICA_CONTROL_PLANE_DATABASE', env('DB_NAME', 'projetoeleitor_db'))!;
  const queryConfig = { host: env('DB_HOST', 'localhost'), port: Number(env('DB_PORT', '5432')), database, user: env('DB_USER'), password: env('DB_PASSWORD'), max: 3, connectionTimeoutMillis: 5000 };
  const pool = new pg.Pool(queryConfig);
  try {
    const orchestrator = new CollectorOrchestrator({ database, query: async sql => ({ rows: (await pool.query(sql)).rows }), adapters: createRuntimeAdapterRegistry({ pool }),
      // Agregados de leitura das páginas das Assembleias: só dependem destes três domínios; recalcula só a Casa publicada.
      afterPublication: async ({ house, domain }) => { if (['IDENTITY', 'LEGISLATIVE', 'FINANCE'].includes(domain)) { const { reconcileStateHouseStories } = await import('@senadotracker/db'); await reconcileStateHouseStories(pool, { houses: [house] }); } } });
    const scheduler = new SchedulerEngine(pool, orchestrator, orchestrator.list());
    const preflight = async () => { try { return await runCrossStackPreflight(pool); } catch (error) { return { currentDatabase: null, classification: 'ENVIRONMENT_NOT_READY', productionUsedAsTest: false, stateDependencies: {}, federalDependencies: {}, senateDependencies: {}, missingRequiredSchemas: [], routeReadiness: {}, checks: { database: 'ENVIRONMENT_NOT_READY' }, error: error instanceof Error ? error.message : String(error) }; } };
    const result = await runControlCli(args, orchestrator, preflight, scheduler); if (typeof result.output === 'string') process.stdout.write(`${result.output}\n`); else process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`); process.exitCode = result.exitCode;
    // Fronteira única pós-publicação: qualquer caminho que tenha ativado revisão (orquestrador, persistence.ts, promoção manual) é reconciliado aqui.
    if (!args.includes('--dry-run') && ['collect', 'refresh', 'backfill', 'replay', 'scheduler-tick'].includes(args[0] ?? '')) { try { const { reconcileStateHouseStories } = await import('@senadotracker/db'); const reconciled = await reconcileStateHouseStories(pool); if (reconciled.refreshed.length || reconciled.failed.length) process.stderr.write(`state-story: refreshed=${reconciled.refreshed.join(',') || '-'} failed=${reconciled.failed.map(item => item.house).join(',') || '-'}
`); } catch (error) { process.stderr.write(`state-story: reconcile skipped (${error instanceof Error ? error.message : String(error)})
`); }
      // Retratos novos ou velhos (cadastro recém-publicado): baixa o que falta, sem nunca falhar o comando.
      try { const { mirrorPendingPortraits } = await import('@senadotracker/db'); const mirrored = await mirrorPendingPortraits(pool, { limit: 300 }); if (mirrored.stored || mirrored.failed) process.stderr.write(`portraits: stored=${mirrored.stored} failed=${mirrored.failed}
`); } catch (error) { process.stderr.write(`portraits: mirror skipped (${error instanceof Error ? error.message : String(error)})
`); } }
  } finally { await pool.end(); }
} else if (!institutionalOptions && !isCollect && !isStatus && !isExpense && !isVotes && !isActivity && !isPresence && !isComplement && !isCabinet && !isElection && !isCamaraStaff && !isCamaraBudget && !isSenateStaff && !isThemes && !isPriceIndex && !isCamaraPropositions && !isCamaraMovements && !isSenateProcesses && !isSenateAgenda && !isCamaraAgenda && !isPropositionEnrichment && !isHouseOperations && !isStateCoverage) {
  const result = runCli(args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} else {
  throw new Error('SQLite runtime is permanently disabled after PostgreSQL cutover. Historical SQLite is available only through the archived baseline comparator tooling.');
}
