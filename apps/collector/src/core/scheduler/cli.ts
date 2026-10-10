import { buildSchedulerJobs, NationalFinanceScheduler, type SchedulerExecutor, type SchedulerJobDefinition, type SchedulerRunRecord, type SchedulerTrigger } from './national-finance-scheduler.ts';
import { createNationalFinanceRegistry } from '../registry/national-finance-registry.ts';

export interface SchedulerCliOptions { readonly house?: string; readonly domain?: string; readonly eligible: boolean; readonly dryRun: boolean; readonly trigger: SchedulerTrigger; }
export function parseSchedulerCliArgs(args: readonly string[]): SchedulerCliOptions {
  const value = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const house = value('--house'); const domain = value('--domain'); const base = { eligible: args.includes('--eligible'), dryRun: args.includes('--dry-run'), trigger: args.includes('--retry') ? 'RETRY' as const : args.includes('--scheduled') ? 'SCHEDULED' as const : 'MANUAL' as const };
  return { ...base, ...(house ? { house } : {}), ...(domain ? { domain } : {}) };
}
export function selectSchedulerJobs(options: SchedulerCliOptions): readonly SchedulerJobDefinition[] {
  return buildSchedulerJobs(createNationalFinanceRegistry()).filter(job => (!options.house || job.house === options.house) && (!options.domain || job.domain === options.domain) && (options.eligible || Boolean(options.house)));
}
export async function runSchedulerCommand(args: readonly string[], executor: SchedulerExecutor): Promise<readonly SchedulerRunRecord[]> {
  const options = parseSchedulerCliArgs(args); const jobs = selectSchedulerJobs(options); if (!jobs.length) throw new Error('No eligible scheduler job matches the requested selector');
  if (options.dryRun) return jobs.map(job => ({ runId: `dry-run:${job.key}`, jobKey: job.key, house: job.house, domain: job.domain, provider: job.provider, providerVersion: job.providerVersion, trigger: options.trigger, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 0, status: 'QUEUED', revisionBefore: null, revisionAfter: null, metrics: { httpRequests: 0, bytes: 0, rawHash: null, semanticHash: null, sourceRows: null, unchanged: 0, added: 0, removed: 0, changed: 0, warnings: ['dry-run: publication disabled'] }, warnings: ['dry-run: publication disabled'] }));
  const scheduler = new NationalFinanceScheduler(jobs); const output: SchedulerRunRecord[] = []; for (const job of jobs) output.push(await scheduler.run(job, executor, { trigger: options.trigger, dryRun: options.dryRun })); return output;
}

