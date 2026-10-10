import { NATIONAL_FINANCE_REGISTRY, type FinanceCapabilityRegistration } from '../registry/national-finance-registry.ts';
import { CONTROL_DOMAINS, CONTROL_HOUSES, type ControlDomain, type ControlHouse, type ImplementationState, type OperationalStatus, type ProviderMetadata, type ControlCollectionModel, type SourceFrequency } from './contracts.ts';

const finance = new Map(NATIONAL_FINANCE_REGISTRY.map(entry => [entry.manifest.house, entry]));
const operationalPersonnel = new Set(['AC','AP','DF','GO','PR','RO']);
const partialPersonnel = new Set(['BA','PA','SC','SP']);
const personnelProviders: Record<string, string> = { AC:'aleac_personnel', AP:'alap_personnel', BA:'alba_personnel', DF:'cldf_personnel', GO:'alego_personnel', PA:'alepa_personnel', PR:'alep_personnel', RO:'alro_personnel', SC:'alesc_personnel', SP:'alesp_personnel' };
const proposalOperational = new Set(['AC','AL','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PE','PI','PR','RJ','RN','RO','RR','SC','SE','SP','TO']);
const proposalPartial = new Set(['RS']);
const proposalBlocked = new Set(['AM','PB']);
const timelineOperational = new Set(['AC','AL','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PE','PI','PR','RJ','RN','RO','RR','SC','SE','SP','TO']);
const budgetOperational = new Set(['AC','AL','ES','MG','MS','PA','PB','PI','PR','RN','RO','RR','RS','SE','SP']);
const budgetPartial = new Set(['AP','MA','MT','RJ','SC','TO']);
const budgetBlocked = new Set(['AM','CE','DF']);
const budgetEnvironmentBlocked = new Set(['BA','GO','PE']);

function statusFromFinance(entry: FinanceCapabilityRegistration): OperationalStatus {
  if (entry.frameworkStatus === 'CORE_NOT_APPLICABLE' || entry.sourceStatus === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  if (entry.sourceStatus === 'BLOCKED') return 'PROVEN_EXTERNAL_BLOCKER';
  if (entry.sourceStatus === 'SOURCE_SCHEMA_INSUFFICIENT') return 'UPSTREAM_BLOCKER';
  if (entry.sourceStatus === 'PARTIAL_OPERATIONAL') return 'PARTIAL';
  return entry.status === 'OPERATIONAL' ? 'OPERATIONAL' : 'PARTIAL';
}

function capabilities(implementationState: ImplementationState, model: ControlCollectionModel, status: OperationalStatus, providerId: string | null = null) {
  const supported = implementationState === 'PRODUCTION_CAPABLE';
  const bounded = providerId === 'ales_legislative' || providerId === 'state-es-legislative';
  // P25.3 computes due/health at runtime. Static eligibility means that the
  // provider has a live refresh path, safe publication guards and a lab-safe
  // adapter; it does not enable a production daemon.
  const futureSchedulerEligible = supported && providerId !== null && status === 'OPERATIONAL';
  return { supportsCollect: supported, supportsRefresh: supported, supportsBackfill: supported && !bounded && model !== 'MANUAL_SOURCE_BOUNDARY', supportsCheckpoint: supported && !bounded && (model === 'PAGINATED_API' || model === 'PARTITIONED_SNAPSHOT'), supportsReplay: supported && !bounded, supportsIncremental: supported && !bounded && model !== 'SNAPSHOT', supportsFullBackfill: supported && !bounded, schedulerEligible: futureSchedulerEligible, lastKnownGoodSupported: true };
}

// Keep this list limited to adapters that can actually be resolved by the
// runtime registry.  A historical provider entry is not production-capable
// merely because its publication exists in PostgreSQL.
const saplHouses = new Set(['AC','AL','AM','MT','PB','PI','RO','RR','TO']);
const p18WaveAProviders = ['alap_ceap','alce_vdp_csv','cldf_ckan_vi','almg_verba_indenizatoria','alms_ceap_csv','alepe_ceap','alese_ressarcimento','alesp_open_data'];
const p25_2vHistoricalProviders = ['aleac_personnel','state-ac-timeline','state-al-timeline','alap_personnel','state-ap-legislative','state-ap-timeline','aleam_ceap_pdf','state-ba-legislative','state-ba-timeline','state-ce-legislative','state-ce-timeline','cldf_personnel','state-df-legislative','state-df-timeline','alese_cotas','state-es-timeline','alego_personnel','state-go-legislative','state-go-timeline','state-ma-legislative','state-ma-timeline','state-mg-legislative','state-mg-timeline','state-ms-legislative','state-ms-timeline','state-mt-timeline','state-pa-legislative','state-pa-timeline','state-pe-legislative','state-pe-timeline','state-pi-timeline','alep_personnel','state-pr-legislative','state-pr-timeline','state-rj-legislative','state-rj-timeline','alrn_ceap','state-rn-legislative','state-rn-timeline','alro_personnel','state-ro-timeline','state-rr-timeline','state-sc-legislative','state-sc-timeline','state-se-legislative','state-se-timeline','state-sp-legislative','state-sp-timeline','aleto_codap','state-to-timeline'];
const p23BudgetProviders = ['state-es-budget','state-mg-budget','state-rs-budget','state-sp-budget','state-pa-budget','state-pr-budget','state-ro-budget','state-ac-budget','state-se-budget','state-al-budget','state-pi-budget','state-rn-budget','state-ms-budget','state-pb-budget','state-rr-budget'];
const runtimeWired = new Set(['p17-state-roster','alesc_gabinetes_csv','ales_legislative','sapl','state-es-legislative','state-ro-legislative', ...p18WaveAProviders, ...p25_2vHistoricalProviders, ...p23BudgetProviders, ...[...saplHouses].flatMap(h => [`state-${h.toLowerCase()}-legislative`])]);
// P25.2X closes the remaining historical source wiring.  Replay remains an
// operation on the same adapter, but collect/refresh now dispatch to a source
// runtime entrypoint for every one of the 50 traces.
const productionWired = new Set(['p17-state-roster','alesc_gabinetes_csv','ales_legislative','state-es-legislative','state-ro-legislative', ...p18WaveAProviders, ...p25_2vHistoricalProviders, ...p23BudgetProviders, ...[...saplHouses].flatMap(h => [`state-${h.toLowerCase()}-legislative`])]);
const historicalLiveRefreshMode = (domain: ControlDomain): 'LIVE_SOURCE' | 'LIVE_SOURCE_FULL_SNAPSHOT' | 'LIVE_SOURCE_PARTITIONED' | 'LIVE_SOURCE_INCREMENTAL' => domain === 'PERSONNEL' ? 'LIVE_SOURCE_FULL_SNAPSHOT' : domain === 'TIMELINE' ? 'LIVE_SOURCE_INCREMENTAL' : domain === 'LEGISLATIVE' ? 'LIVE_SOURCE_PARTITIONED' : 'LIVE_SOURCE';
const internalBlockerFor = (house: ControlHouse, domain: ControlDomain, providerId: string | null): string | null => {
  if (domain === 'IDENTITY') return null;
  if (domain === 'FINANCE') return `P18 ${providerId ?? 'provider'} exposes parsing/fixtures, but no complete source fetch plus revision-safe persistence path is proven.`;
  if (domain === 'PERSONNEL') return 'P19 script probes sources and rewrites a derived roster table, but does not provide a revision-safe personnel snapshot collector; automatic execution could replace the last-known-good corpus.';
  if (domain === 'LEGISLATIVE') return `P20 ${house} has historical/bounded scripts or a verifier, but no complete source-family adapter with full enumeration and no-silent-shrink publication proof.`;
  if (domain === 'TIMELINE') return `P22 ${house} runbook points to reconciliation/finalization; existing collectors are bounded samples or family-specific scripts without a reusable incremental adapter.`;
  if (domain === 'BUDGET_AMENDMENTS') return `P23 ${house} source publication depends on staged files or source probes; the finalizer is not a source collector and no refresh-safe adapter is exposed.`;
  return null;
};
const sourceFamilyFor = (providerId: string | null, domain: ControlDomain): string | null => {
  if (providerId === 'sapl') return 'SAPL_INTERLEGIS';
  const stateMatch = providerId?.match(/^state-([a-z]{2})-(legislative|timeline)$/);
  if (stateMatch && saplHouses.has(stateMatch[1]!.toUpperCase())) return 'SAPL_INTERLEGIS';
  if (providerId === 'ales_legislative' || providerId === 'state-es-legislative' || providerId === 'state-es-timeline') return 'ALES_SPL';
  if (providerId === 'state-ba-legislative' || providerId === 'state-ba-timeline') return 'ALBA_NOPAPER';
  if (providerId === 'state-pa-legislative' || providerId === 'state-pa-timeline') return 'ALEPA_DEVEXPRESS';
  if (providerId === 'state-pr-legislative' || providerId === 'state-pr-timeline') return 'ALEP_PORTAL';
  if (providerId === 'state-rj-legislative' || providerId === 'state-rj-timeline') return 'ALERJ_LOTUS';
  if (providerId === 'state-mg-legislative' || providerId === 'state-mg-timeline') return 'ALMG_OPEN_DATA';
  if (providerId === 'state-sp-legislative' || providerId === 'state-sp-timeline') return 'ALESP_OPEN_DATA';
  if (providerId === 'state-sc-legislative' || providerId === 'state-sc-timeline') return 'ALESC_ELEGIS';
  if (providerId === 'alesc_gabinetes_csv') return 'ALESC_OPEN_DATA';
  if (providerId === 'p17-state-roster') return 'P17_STATE_ROSTER';
  if (providerId?.endsWith('-budget')) return 'STATE_BUDGET_SOURCE';
  if (domain === 'FINANCE') return 'P18_OTHER_FAMILIES';
  if (domain === 'PERSONNEL') return 'P19_PERSONNEL_SOURCES';
  return null;
};
function runbookFor(house: ControlHouse, domain: ControlDomain, providerId: string | null, family: string | null): NonNullable<ProviderMetadata['manualRunbook']> | null {
  if (!providerId) return null;
  const source = family === 'P17_STATE_ROSTER' ? 'P17 roster source and scripts/state-p17_3c1.py' : family === 'STATE_BUDGET_SOURCE' ? `P23 ${house} active publication and source collector` : family === 'P19_PERSONNEL_SOURCES' ? `P19 ${house} personnel publication` : family === 'SAPL_INTERLEGIS' ? `SAPL ${house} deployment` : `${family ?? domain} ${house} source contract`;
  const command = family === 'P17_STATE_ROSTER' ? 'python scripts/state-p17_3c1.py' : domain === 'PERSONNEL' ? 'node --import tsx scripts/p19_3.ts' : domain === 'BUDGET_AMENDMENTS' ? 'python scripts/p23_6_finalize.py' : domain === 'TIMELINE' ? 'node --import tsx scripts/p22_6_reconcile.mjs' : domain === 'FINANCE' ? 'node --import tsx scripts/p18_3e.ts' : 'node --import tsx scripts/p20_7f_verify.mjs';
  return { source, command, input: `Existing ${providerId} source contract, raw provenance and active revision`, validation: 'database guard; source rows > 0; reconciliation and source hash recorded; candidate is not smaller than active revision', publicationGate: 'activate only after raw → parsed → candidate → reconciliation; preserve last-known-good on failure', frequency: domain === 'PERSONNEL' ? 'MONTHLY' : 'SOURCE_DRIVEN', operator: 'Cívica data operator; review source response and run history before activation' };
}
function terminalState(house: ControlHouse, domain: ControlDomain, providerId: string | null, family: string | null, wired: boolean): ImplementationState {
  if (wired && providerId !== null && productionWired.has(providerId)) return 'PRODUCTION_CAPABLE';
  if (!providerId) return 'NO_IMPLEMENTATION';
  return domain === 'BUDGET_AMENDMENTS' ? 'ENVIRONMENT_DEPENDENT' : 'UNSAFE_TO_AUTOMATE_WITH_PROVEN_REASON';
}
function metadata(house: ControlHouse, domain: ControlDomain, providerId: string | null, status: OperationalStatus, implementationState: ImplementationState, notes: string, evidence: readonly string[], options: Partial<Pick<ProviderMetadata, 'collectionModel' | 'sourceUpdateFrequency' | 'entrypoint' | 'activePublicationSchema' | 'sourceFamilyId' | 'refreshMode' | 'sourceRuntimeEntrypoint' | 'publicationAdapter' | 'schedulerEligibleFuture'>> & { readonly defaultTimeoutMs?: number } = {}): ProviderMetadata {
  const model = options.collectionModel ?? 'SNAPSHOT';
  const wired = providerId !== null && runtimeWired.has(providerId);
  const family = options.sourceFamilyId ?? sourceFamilyFor(providerId, domain);
  const resolvedState = status === 'OPERATIONAL' ? (wired && providerId !== null && productionWired.has(providerId) ? 'PRODUCTION_CAPABLE' : implementationState) : implementationState;
  const blocker = status === 'OPERATIONAL' && ['ADAPTER_REQUIRED','ADAPTER_REQUIRED_WITH_PROVEN_INTERNAL_BLOCKER'].includes(resolvedState) ? internalBlockerFor(house, domain, providerId) : null;
  const finalState: ImplementationState = blocker ? terminalState(house, domain, providerId, family, wired) : resolvedState;
  const runbook = finalState === 'PRODUCTION_CAPABLE' ? null : runbookFor(house, domain, providerId, family);
  const historicalLive = providerId !== null && p25_2vHistoricalProviders.includes(providerId) && status === 'OPERATIONAL';
  const liveEntrypoint = historicalLive ? 'apps/collector/src/core/historical-live-adapter.ts:historicalLiveSourceAdapter' : null;
  return { providerId, house, domain, enabled: providerId !== null && status !== 'NOT_APPLICABLE', operationalStatus: status, implementationState: finalState, sourceAuthority: evidence.length ? evidence[0]!.split('/').slice(0, 2).join('/') : 'P17-P23 canonical evidence', collectionModel: model, sourceUpdateFrequency: options.sourceUpdateFrequency ?? 'UNKNOWN', capabilities: capabilities(finalState, model, status, providerId), rateLimitProfile: { maxRequestsPerMinute: null, maxConcurrency: 1, cooldownMs: 0 }, retryPolicy: { retryableErrors: ['HTTP_429','HTTP_502','HTTP_503','HTTP_504','TIMEOUT'], maxRetries: 2, backoffMs: 1000 }, defaultTimeoutMs: options.defaultTimeoutMs ?? 30_000, entrypoint: options.entrypoint ?? null, refreshMode: options.refreshMode ?? (historicalLive ? historicalLiveRefreshMode(domain) : finalState === 'PRODUCTION_CAPABLE' ? 'LIVE_SOURCE' : 'VALIDATE_ONLY'), sourceRuntimeEntrypoint: options.sourceRuntimeEntrypoint ?? liveEntrypoint, publicationAdapter: options.publicationAdapter ?? (historicalLive ? 'shared publication lifecycle with last-known-good guards' : null), schedulerEligibleFuture: options.schedulerEligibleFuture ?? false, activePublicationSchema: options.activePublicationSchema ?? (domain === 'BUDGET_AMENDMENTS' ? 'civica_state_budget.active_publications' : 'civica_state.active_publications'), lastSuccessAt: null, lastFailureAt: null, sourceUpdatedAt: null, dataThrough: null, activeRevision: null, healthStatus: status === 'PROVEN_EXTERNAL_BLOCKER' || status === 'EXECUTION_ENVIRONMENT_BLOCKED' ? 'BLOCKED' : status === 'OPERATIONAL' ? 'UNKNOWN' : 'DEGRADED', notes: blocker ? `${notes} ${blocker}` : wired && status === 'OPERATIONAL' ? `${notes} Runtime adapter wired by P25.2X.` : notes, evidence, sourceFamilyId: family, canRunManually: Boolean(providerId), manualRunbook: runbook };
}

function entry(house: ControlHouse, domain: ControlDomain): ProviderMetadata {
  if (domain === 'FINANCE') {
    const f = finance.get(house)!; const status = statusFromFinance(f); const state: ImplementationState = f.currentEntrypoint && status === 'OPERATIONAL' ? 'ADAPTER_REQUIRED' : status === 'PROVEN_EXTERNAL_BLOCKER' ? 'BLOCKED_SOURCE' : status === 'NOT_APPLICABLE' ? 'NO_IMPLEMENTATION' : 'ADAPTER_REQUIRED';
    const financeModel: ControlCollectionModel = f.manifest.collectionModel === 'INCREMENTAL' ? 'PAGINATED_API' : f.manifest.collectionModel === 'CUMULATIVE_SNAPSHOT' ? 'CUMULATIVE_SNAPSHOT' : f.manifest.collectionModel === 'FULL_SNAPSHOT' ? 'SNAPSHOT' : 'MIXED';
    return metadata(house, domain, f.manifest.provider, status, state, f.knownBlocker ?? 'Provider capability preserved from P18 registry; adapter dispatch is explicit.', f.artifactEvidence, { collectionModel: financeModel, sourceUpdateFrequency: f.schedulerEligible ? 'DAILY' : 'UNKNOWN', entrypoint: f.currentEntrypoint ?? null });
  }
  if (domain === 'IDENTITY') return metadata(house, domain, 'p17-state-roster', 'OPERATIONAL', 'ADAPTER_REQUIRED', 'P17 source refresh and publication are exposed through the shared state-roster runtime adapter; roster/mandate semantics remain unchanged.', ['artifacts/P17.json', 'scripts/state-p17_3c1.py'], { collectionModel: 'SNAPSHOT', sourceUpdateFrequency: 'SOURCE_DRIVEN', entrypoint: 'apps/collector/src/core/control-plane/adapters.ts:p17RosterAdapter', defaultTimeoutMs: 10 * 60_000 });
  if (domain === 'PERSONNEL') {
    const status: OperationalStatus = operationalPersonnel.has(house) ? 'OPERATIONAL' : partialPersonnel.has(house) ? 'PARTIAL' : 'UPSTREAM_BLOCKER';
    return metadata(house, domain, personnelProviders[house] ?? null, status, personnelProviders[house] ? 'ADAPTER_REQUIRED' : 'NO_IMPLEMENTATION', personnelProviders[house] ? 'P19 personnel publication is known; no provider is fabricated for uncovered houses.' : 'No P19 operational personnel publication for this house.', ['artifacts/P19_3.json'], { collectionModel: 'SNAPSHOT', sourceUpdateFrequency: 'MONTHLY' });
  }
  if (domain === 'LEGISLATIVE') {
    const status: OperationalStatus = proposalOperational.has(house) ? 'OPERATIONAL' : proposalPartial.has(house) ? 'PARTIAL' : proposalBlocked.has(house) ? 'PROVEN_EXTERNAL_BLOCKER' : 'UPSTREAM_BLOCKER';
    const providerId = `state-${house.toLowerCase()}-legislative`;
    return metadata(house, domain, providerId, status, status === 'PROVEN_EXTERNAL_BLOCKER' ? 'BLOCKED_SOURCE' : 'ADAPTER_REQUIRED', status === 'PARTIAL' ? 'P20 published a bounded partial corpus.' : status === 'PROVEN_EXTERNAL_BLOCKER' ? 'P20 source blocker is preserved; dispatch must fail closed.' : 'P20 proposal/authorship publication is the source of truth.', ['artifacts/P20_FINAL.json'], { collectionModel: 'PAGINATED_API', sourceUpdateFrequency: 'SOURCE_DRIVEN', entrypoint: runtimeWired.has(providerId) ? 'apps/collector/src/core/control-plane/adapters.ts:createRuntimeAdapterRegistry' : null });
  }
  if (domain === 'TIMELINE') return metadata(house, domain, timelineOperational.has(house) ? `state-${house.toLowerCase()}-timeline` : null, timelineOperational.has(house) ? 'OPERATIONAL' : 'UPSTREAM_BLOCKER', timelineOperational.has(house) ? 'ADAPTER_REQUIRED' : 'NO_IMPLEMENTATION', timelineOperational.has(house) ? 'P22 timeline publication is queryable.' : 'No P22 timeline publication is available.', ['artifacts/P22.json'], { collectionModel: 'DOCUMENT_SERIES', sourceUpdateFrequency: 'SOURCE_DRIVEN' });
  if (budgetBlocked.has(house)) return metadata(house, domain, `state-${house.toLowerCase()}-budget`, 'PROVEN_EXTERNAL_BLOCKER', 'BLOCKED_SOURCE', 'P23 proved an external source blocker; dispatch must fail closed.', ['artifacts/P23_6.json'], { collectionModel: 'MANUAL_SOURCE_BOUNDARY' });
  if (budgetEnvironmentBlocked.has(house)) return metadata(house, domain, `state-${house.toLowerCase()}-budget`, 'EXECUTION_ENVIRONMENT_BLOCKED', 'ADAPTER_REQUIRED', 'P23 source is known but the current execution environment is blocked; no source request is attempted.', ['artifacts/P23_6.json'], { collectionModel: 'MANUAL_SOURCE_BOUNDARY' });
  const status: OperationalStatus = budgetOperational.has(house) ? 'OPERATIONAL' : budgetPartial.has(house) ? 'PARTIAL' : 'UPSTREAM_BLOCKER';
  const providerId = status === 'UPSTREAM_BLOCKER' ? null : `state-${house.toLowerCase()}-budget`;
  const budgetLive = providerId !== null && p23BudgetProviders.includes(providerId);
  const options = { collectionModel: 'CUMULATIVE_SNAPSHOT' as const, sourceUpdateFrequency: 'SOURCE_DRIVEN' as const, entrypoint: budgetLive ? 'apps/collector/src/state/providers/state-budget/source-runtime.ts' : null, sourceRuntimeEntrypoint: budgetLive ? 'stateBudgetSourceAdapter:collect/refresh' : null, publicationAdapter: budgetLive ? 'civica_state_budget.revisions + active_publications' : null, schedulerEligibleFuture: false as const };
  return metadata(house, domain, providerId, status, status === 'UPSTREAM_BLOCKER' ? 'NO_IMPLEMENTATION' : 'ADAPTER_REQUIRED', status === 'PARTIAL' ? 'P23 published a source-bounded partial domain.' : status === 'OPERATIONAL' ? 'P23 canonical state-budget publication is available.' : 'No P23 active publication for this house.', ['artifacts/P23_6.json'], budgetLive ? { ...options, refreshMode: 'LIVE_SOURCE_FULL_SNAPSHOT' as const } : options);
}

export const NATIONAL_CONTROL_REGISTRY: readonly ProviderMetadata[] = CONTROL_HOUSES.flatMap(house => CONTROL_DOMAINS.map(domain => entry(house, domain)));
export function validateControlRegistry(registry: readonly ProviderMetadata[] = NATIONAL_CONTROL_REGISTRY): { readonly ok: boolean; readonly errors: readonly string[] } {
  const errors: string[] = []; if (registry.length !== CONTROL_HOUSES.length * CONTROL_DOMAINS.length) errors.push('registry must contain 27 houses x 6 domains');
  const keys = new Set<string>(); for (const item of registry) { const key = `${item.house}:${item.domain}`; if (keys.has(key)) errors.push(`duplicate house/domain: ${key}`); keys.add(key); if (item.providerId && item.providerId.trim() === '') errors.push(`${key} has empty providerId`); if (item.operationalStatus === 'OPERATIONAL' && !item.providerId) errors.push(`${key} operational entry has no providerId`); }
  return { ok: errors.length === 0, errors };
}
export function selectProviders(selection: { readonly house?: string; readonly domain?: string; readonly operational?: boolean; readonly blocked?: boolean; readonly due?: boolean } = {}, registry: readonly ProviderMetadata[] = NATIONAL_CONTROL_REGISTRY): readonly ProviderMetadata[] {
  return registry.filter(item => (!selection.house || item.house === selection.house.toUpperCase()) && (!selection.domain || item.domain === selection.domain.toUpperCase()) && (!selection.operational || item.operationalStatus === 'OPERATIONAL') && (!selection.blocked || item.operationalStatus === 'PROVEN_EXTERNAL_BLOCKER' || item.operationalStatus === 'UPSTREAM_BLOCKER'));
}
