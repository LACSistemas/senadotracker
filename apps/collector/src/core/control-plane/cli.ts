import { CollectorOrchestrator } from './orchestrator.ts';
import { CONTROL_DOMAINS, CONTROL_HOUSES, type ControlDomain, type ControlHouse, type ControlOperation } from './contracts.ts';
import { NATIONAL_CONTROL_REGISTRY, validateControlRegistry } from './registry.ts';
import { runCrossStackPreflight } from './preflight.ts';
import type { SchedulerEngine } from './scheduler.ts';

export interface ControlCliOptions { readonly command: ControlOperation | 'help'; readonly house?: ControlHouse; readonly domain?: ControlDomain; readonly year?: number; readonly dryRun: boolean; readonly json: boolean; readonly due: boolean; readonly operational: boolean; readonly blocked: boolean; readonly revision?: string; readonly limit?: number; readonly concurrency?: number; }
const value = (args: readonly string[], name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
export function parseControlCliArgs(args: readonly string[]): ControlCliOptions {
  const command = (args[0] ?? 'help') as ControlCliOptions['command']; const year = value(args, '--year'); const house = value(args, '--house')?.toUpperCase() as ControlHouse | undefined; const domain = value(args, '--domain')?.toUpperCase() as ControlDomain | undefined; const revision = value(args, '--revision'); const limit = value(args, '--limit'); const concurrency = value(args, '--concurrency'); return { command, ...(house ? { house } : {}), ...(domain ? { domain } : {}), ...(year ? { year: Number(year) } : {}), dryRun: args.includes('--dry-run'), json: args.includes('--json'), due: args.includes('--due'), operational: args.includes('--operational'), blocked: args.includes('--blocked'), ...(revision ? { revision } : {}), ...(limit ? { limit: Number(limit) } : {}), ...(concurrency ? { concurrency: Number(concurrency) } : {}) };
}
export const controlHelp = 'Civica control plane\\n\\nUso: npm run civica:collect -- <command> [options]\\n\\nComandos: status, health, validate, collect, refresh, backfill, replay, preflight, scheduler-tick\\nForma legada: collect --source senado|camara|all\\nFiltros: --house UF --domain DOMAIN --year YYYY --operational --blocked --due --dry-run --json\\nExemplo: npm run civica:collect -- status --house ES --domain BUDGET_AMENDMENTS --json\\n';

function validateOptions(options: ControlCliOptions): string | null { if (options.house && !CONTROL_HOUSES.includes(options.house.toUpperCase() as never)) return `invalid house: ${options.house}`; if (options.domain && !CONTROL_DOMAINS.includes(options.domain.toUpperCase() as never)) return `invalid domain: ${options.domain}`; if (options.year !== undefined && (!Number.isInteger(options.year) || options.year < 1900 || options.year > 2200)) return 'invalid year'; return null; }
export async function runControlCli(args: readonly string[], orchestrator: CollectorOrchestrator, preflight?: () => Promise<unknown>, scheduler?: SchedulerEngine): Promise<{ readonly exitCode: number; readonly output: unknown }> {
  const options = parseControlCliArgs(args); const knownFlags = new Set(['--help','-h','--house','--domain','--year','--dry-run','--json','--due','--operational','--blocked','--revision','--limit','--concurrency']); const unknownFlag = args.find(arg => arg.startsWith('--') && !knownFlags.has(arg)); if (unknownFlag) return { exitCode: 2, output: { status: 'INVALID_ARGUMENT', error: 'unknown option: ' + unknownFlag } }; if (options.command === 'help' || args.includes('--help') || args.includes('-h')) return { exitCode: 0, output: controlHelp }; const invalid = validateOptions(options); if (invalid) return { exitCode: 2, output: { status: 'INVALID_ARGUMENT', error: invalid } };
  if (options.command === 'preflight') return { exitCode: 0, output: preflight ? await preflight() : { status: 'ENVIRONMENT_NOT_READY', error: 'preflight query unavailable' } };
  if (options.command === 'scheduler-tick' || (options.command === 'refresh' && options.due && options.dryRun)) {
    if (!scheduler) return { exitCode: 1, output: { status: 'ENVIRONMENT_BLOCKED', error: 'scheduler engine unavailable' } };
    const output = await scheduler.tick({ dryRun: options.dryRun, ...(options.year !== undefined ? { year: options.year } : {}), ...(options.limit !== undefined ? { batchLimit: options.limit } : {}), ...(options.concurrency !== undefined ? { globalConcurrency: options.concurrency } : {}) });
    return { exitCode: 0, output: options.json ? output : `${output.tickId} ${output.dryRun ? 'DRY_RUN' : 'COMPLETED'} due=${output.metrics.due} started=${output.metrics.started}` };
  }
  if (options.command === 'status' || options.command === 'health') {
    if (options.command === 'health' && scheduler && options.json) return { exitCode: 0, output: await scheduler.health(options.year !== undefined ? { year: options.year } : {}) };
    const entries = await orchestrator.runtimeStatus(options);
    if (options.json) return { exitCode: 0, output: entries };
    const filtered = Boolean(options.house || options.domain || options.operational || options.blocked);
    if (!filtered && entries.length > 12) {
      const byStatus = entries.reduce<Record<string, number>>((counts, entry) => { counts[entry.operationalStatus] = (counts[entry.operationalStatus] ?? 0) + 1; return counts; }, {});
      return { exitCode: 0, output: `${entries.length} registry entries across ${new Set(entries.map(entry => entry.house)).size} houses and ${new Set(entries.map(entry => entry.domain)).size} domains\n${Object.entries(byStatus).map(([status, count]) => `${status}: ${count}`).join('\n')}` };
    }
    return { exitCode: 0, output: entries.map(entry => `${entry.house} ${entry.domain.padEnd(20)} ${entry.providerId ?? '-'} ${entry.operationalStatus}`).join('\n') };
  }
  if (options.command === 'validate') {
    const registry = validateControlRegistry();
    const selected = orchestrator.status(options);
    const preflightResult = preflight ? await preflight() : undefined;
    const output = { registry, selected, ...(preflightResult === undefined ? {} : { preflight: preflightResult }) };
    return { exitCode: registry.ok ? 0 : 2, output: options.json ? output : registry.ok ? `VALID (${selected.length} selected provider${selected.length === 1 ? '' : 's'})` : registry.errors.join('\n') };
  }
  const dispatchOptions = { command: options.command as Exclude<ControlOperation, 'status'|'health'|'validate'|'preflight'>, ...(options.house ? { house: options.house } : {}), ...(options.domain ? { domain: options.domain } : {}), ...(options.year !== undefined ? { year: options.year } : {}), dryRun: options.dryRun, due: options.due, operational: options.operational, blocked: options.blocked, ...(options.revision ? { revision: options.revision } : {}) };
  const results = await orchestrator.dispatch(dispatchOptions); const failed = results.some(item => ['FAILED_SAFE','INVALID_ARGUMENT'].includes(item.status)); return { exitCode: failed ? 1 : 0, output: options.json ? results : results.map(item => `${item.runId} ${item.status}`).join('\n') };
}
