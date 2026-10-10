import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchedulerJobs, InMemoryRunStore, InMemorySchedulerLock, NationalFinanceScheduler, healthForRuns, isSchedulerEligible, type SchedulerExecutionResult } from '../../apps/collector/src/core/scheduler/national-finance-scheduler.ts';
import { parseSchedulerCliArgs, selectSchedulerJobs, runSchedulerCommand } from '../../apps/collector/src/core/scheduler/cli.ts';
import { createNationalFinanceRegistry, NATIONAL_FINANCE_REGISTRY } from '../../apps/collector/src/core/registry/national-finance-registry.ts';
import { msExpenseExternalIdFromSourceRow, scExpenseExternalIdFromSourceKey } from '../../apps/collector/src/state/providers/state-finance/index.ts';

const noOp = async (): Promise<SchedulerExecutionResult> => ({ status: 'NO_OP', sourceCompletenessProven: true, semanticDelta: false, revisionBefore: 'same', revisionAfter: 'same', metrics: { httpRequests: 1, bytes: 10, rawHash: 'raw', semanticHash: 'semantic', sourceRows: 1, unchanged: 1, added: 0, removed: 0, changed: 0, warnings: [] } });

test('P18.3J Registry-derived scheduler registers only proven current providers', () => {
  const jobs = buildSchedulerJobs(createNationalFinanceRegistry());
  assert.deepEqual(jobs.map(job => job.house), ['AP', 'CE', 'ES', 'MG', 'MS', 'PE', 'SC', 'SP']);
  assert.equal(jobs.length, 8);
  assert.deepEqual(jobs.map(job => job.key), ['AP:finance:alap_ceap:v1', 'CE:finance:alce_vdp_csv:v1', 'ES:finance:alese_cotas:finance:v1', 'MG:finance:almg_verba_indenizatoria:v1', 'MS:finance:alms_ceap_csv:v1', 'PE:finance:alepe_ceap:v1', 'SC:finance:alesc_gabinetes_csv:v1', 'SP:finance:alesp_open_data:v1']);
  const ms = NATIONAL_FINANCE_REGISTRY.find(entry => entry.manifest.house === 'MS')!;
  assert.equal(ms.schedulerEligible, true);
  assert.equal(ms.schedulerEligibility, 'YES');
});

test('P18.3FR authoritative SC/MS key projections are pinned', () => {
  assert.equal(scExpenseExternalIdFromSourceKey('Volnei Weber|2026-05-31|ALMOXARIFADO|Material de Expediente||164,00|occurrence=1'), '6ad74e7adb68020722b56d8121a458bb9befa2085c7cf6267dee0e8a21ac2e0b');
  assert.equal(msExpenseExternalIdFromSourceRow({
    Deputado: 'Dep. Zeca do PT', Ano: '2026', 'M?s': 'Setembro', Categoria: 'Locomo\u00e7\u00e3o do Parlamentar, de secret\u00e1rios e adjuntos parlamentares(passagens, loca\u00e7\u00e3o de meios de transporte, hospedagem, alimenta\u00e7\u00e3o)', 'CPF/CNPJ': '20.392.930/0001-45', Fornecedor: 'OCAMPO & FERREIRA LTDA', Documento: 'CF-403', 'Emiss?o': '30/07/2026', 'Valor (R$)': 'R$ 99,00', Comprovante: 'http://www.transparencia.al.ms.gov.br/arquivo/2E1AG4-57_2c1a06efe4a5aded018947339de549d8.pdf',
  }), '764ad9c71f5a9f5d790ad7ab52478c6ca06e41675ad4c67f4e213cd90f3f68af');
});

test('P18.3F ineligible deferred providers are never scheduled', () => {
  const jobs = buildSchedulerJobs(createNationalFinanceRegistry());
  assert.equal(jobs.some(job => job.house === 'AM'), false);
  const am = NATIONAL_FINANCE_REGISTRY.find(entry => entry.manifest.house === 'AM')!;
  assert.equal(isSchedulerEligible(am), false);
});

test('P18.3F same job is blocked while a run holds the lock', async () => {
  const job = buildSchedulerJobs()[0]!;
  const lock = new InMemorySchedulerLock(); const scheduler = new NationalFinanceScheduler([job], lock, new InMemoryRunStore());
  let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
  const first = scheduler.run(job, async () => { await waiting; return noOp(); }, { runId: 'first' });
  await new Promise(resolve => setTimeout(resolve, 0));
  const second = await scheduler.run(job, noOp, { runId: 'second' });
  assert.equal(second.status, 'LOCKED'); release(); const firstResult = await first; assert.equal(firstResult.status, 'NO_OP');
});

test('P18.3FR1 house failure isolation keeps SC runnable when MS fails', async () => {
  const jobs = [
    { ...buildSchedulerJobs()[0]!, house: 'SC', key: 'SC:finance:alesc_gabinetes_csv:v1' },
    { ...buildSchedulerJobs()[0]!, house: 'MS', key: 'MS:finance:alms_ceap_csv:v1' },
  ];
  const scheduler = new NationalFinanceScheduler(jobs, new InMemorySchedulerLock());
  const sc = await scheduler.run(jobs[0]!, async () => noOp());
  const ms = await scheduler.run(jobs[1]!, async () => { throw new Error('MS deferred evidence blocker'); });
  assert.equal(sc.status, 'NO_OP'); assert.equal(ms.status, 'FAILED');
  const secondSc = await scheduler.run(jobs[0]!, async () => noOp()); assert.equal(secondSc.status, 'NO_OP');
});

test('P18.3G multi-provider failure isolation keeps C runnable when B fails', async () => {
  const jobs = [
    { ...buildSchedulerJobs()[0]!, house: 'A', key: 'A:finance:test:v1' },
    { ...buildSchedulerJobs()[0]!, house: 'B', key: 'B:finance:test:v1' },
    { ...buildSchedulerJobs()[0]!, house: 'C', key: 'C:finance:test:v1' },
  ];
  const scheduler = new NationalFinanceScheduler(jobs, new InMemorySchedulerLock());
  const results = await Promise.all(jobs.map((job, index) => scheduler.run(job, async () => {
    if (index === 1) throw new Error('provider B deferred');
    return noOp();
  })));
  assert.deepEqual(results.map(result => result.status), ['NO_OP', 'FAILED', 'NO_OP']);
  const retryC = await scheduler.run(jobs[2]!, async () => noOp());
  assert.equal(retryC.status, 'NO_OP');
});

test('P18.3F SC and MS locks are independent', async () => {
  const jobs = [
    { ...buildSchedulerJobs()[0]!, house: 'SC', key: 'SC:finance:alesc_gabinetes_csv:v1' },
    { ...buildSchedulerJobs()[0]!, house: 'MS', key: 'MS:finance:alms_ceap_csv:v1' },
  ]; const scheduler = new NationalFinanceScheduler(jobs, new InMemorySchedulerLock()); let active = 0; let max = 0;
  const executor = async (): Promise<SchedulerExecutionResult> => { active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return noOp(); };
  const results = await Promise.all(jobs.map(job => scheduler.run(job, executor)));
  assert.deepEqual(results.map(result => result.status), ['NO_OP', 'NO_OP']); assert.equal(max, 2);
});

test('P18.3F valid snapshot no-op is distinct from pipeline no-change', async () => {
  const job = buildSchedulerJobs()[0]!; const scheduler = new NationalFinanceScheduler([job]);
  const valid = await scheduler.run(job!, noOp); assert.equal(valid.noChangeStatus, 'VALID_SNAPSHOT_NO_OP');
  const pipeline = await scheduler.run(job!, async () => ({ ...await noOp(), sourceCompletenessProven: false })); assert.equal(pipeline.noChangeStatus, 'PIPELINE_NO_CHANGE');
});

test('P18.3F health model reflects deferred and failed runs', () => {
  const job = buildSchedulerJobs()[0]!; const store = new InMemoryRunStore(); const scheduler = new NationalFinanceScheduler([job], new InMemorySchedulerLock(), store);
  assert.equal(healthForRuns(store.all(), job.key), 'NEVER_RUN');
  store.append({ runId: 'd', jobKey: job.key, house: job.house, domain: job.domain, provider: job.provider, providerVersion: job.providerVersion, trigger: 'MANUAL', startedAt: '', finishedAt: '', durationMs: 0, status: 'DEFERRED', revisionBefore: null, revisionAfter: null, metrics: { httpRequests: 0, bytes: 0, rawHash: null, semanticHash: null, sourceRows: 0, unchanged: 0, added: 0, removed: 0, changed: 0, warnings: [] }, warnings: [] });
  assert.equal(healthForRuns(store.all(), job.key), 'DEGRADED');
});

test('P18.3F generic CLI selects Registry jobs and supports dry-run', async () => {
  assert.deepEqual(parseSchedulerCliArgs(['run', '--domain', 'finance', '--eligible', '--dry-run']).dryRun, true);
  assert.deepEqual(selectSchedulerJobs({ domain: 'finance', eligible: true, dryRun: true, trigger: 'MANUAL' }).map(job => job.house), ['AP', 'CE', 'ES', 'MG', 'MS', 'PE', 'SC', 'SP']);
  const records = await runSchedulerCommand(['run', '--house', 'SC', '--domain', 'finance', '--dry-run'], async () => { throw new Error('dry-run must not execute'); });
  assert.equal(records[0]?.status, 'QUEUED');
});

