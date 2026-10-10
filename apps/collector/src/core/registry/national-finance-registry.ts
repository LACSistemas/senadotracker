import type { CollectionModel, CollectorManifest } from '../collector-provider.ts';
import { HouseCapabilityRegistry, type CapabilityRegistration, type CapabilityStatus } from './house-capability-registry.ts';

export type SourceStatus = 'OPERATIONAL_ITEMIZED' | 'OPERATIONAL_AGGREGATED' | 'PARTIAL_OPERATIONAL' | 'BLOCKED' | 'NO_TRANSACTION_SOURCE' | 'NOT_APPLICABLE' | 'SOURCE_SCHEMA_INSUFFICIENT' | 'MECHANISM_PROVEN_TRANSACTION_SOURCE_UNRESOLVED';
export type FrameworkStatus = 'CORE_MIGRATED' | 'CORE_COMPATIBLE' | 'CORE_COMPATIBLE_WITH_ADAPTER' | 'CORE_REQUIRES_PROVIDER_IMPLEMENTATION' | 'CORE_REQUIRES_PROVIDER_REPAIR' | 'CORE_NOT_APPLICABLE' | 'CORE_BLOCKED_EXTERNAL';
export type OperationStatus = 'CURRENT_OPERATIONAL' | 'CURRENT_PARTIAL' | 'HISTORICAL_ONLY' | 'BLOCKED' | 'NOT_APPLICABLE';
export type FinanceGranularity = 'ITEM' | 'CATEGORY_MONTH' | 'PARLIAMENTARIAN_PAYMENT' | 'FIXED_INDEMNITY' | 'NO_REIMBURSABLE_QUOTA' | 'UNKNOWN';
export type SourceTransport = 'HTTP_JSON' | 'HTTP_CSV' | 'HTTP_PDF' | 'JSF' | 'BROWSER_FLOW' | 'OTHER';

export type IdentityDependency = 'PROVEN' | 'PARTIAL' | 'UNRESOLVED' | 'NOT_APPLICABLE' | 'RESOLVED_FOR_PROVEN_HISTORICAL_RANGE';

export interface FinanceCapabilityRegistration extends CapabilityRegistration {
  readonly sourceStatus: SourceStatus;
  readonly frameworkStatus: FrameworkStatus;
  readonly operationStatus: OperationStatus;
  readonly granularity: FinanceGranularity;
  readonly transport: SourceTransport;
  readonly supportsCurrent: boolean;
  readonly supportsHistorical: boolean | 'UNKNOWN';
  readonly historicalFrom?: string;
  readonly historicalTo?: string;
  readonly currentEntrypoint: string | undefined;
  readonly identityDependency: IdentityDependency;
  readonly knownBlocker?: string;
  readonly migrationWave: 'A' | 'B' | 'PROVIDER_IMPLEMENTATION' | 'PROVIDER_REPAIR' | 'EXTERNAL_BLOCKER' | 'NOT_APPLICABLE';
  readonly schedulerEligible: boolean;
  readonly schedulerEligibility: 'YES' | 'PENDING_OPERATIONAL_PROOF' | 'NO';
  readonly historicalSourceProven: boolean | 'UNKNOWN';
  readonly historicalBackfilled: boolean | 'UNKNOWN';
  readonly historicalIdentityReconciled: boolean | 'UNKNOWN';
  readonly historicalRangeProven: boolean;
  readonly providerFiles: readonly string[];
  readonly tests: readonly string[];
  readonly artifactEvidence: readonly string[];
  readonly collectionModel: CollectionModel;
}

const HOUSES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'] as const;
const status = (house: string): SourceStatus => ({ AC:'MECHANISM_PROVEN_TRANSACTION_SOURCE_UNRESOLVED', AL:'MECHANISM_PROVEN_TRANSACTION_SOURCE_UNRESOLVED', AP:'OPERATIONAL_ITEMIZED', AM:'OPERATIONAL_ITEMIZED', BA:'PARTIAL_OPERATIONAL', CE:'OPERATIONAL_ITEMIZED', DF:'OPERATIONAL_ITEMIZED', ES:'OPERATIONAL_AGGREGATED', GO:'OPERATIONAL_AGGREGATED', MA:'OPERATIONAL_AGGREGATED', MG:'OPERATIONAL_ITEMIZED', MS:'OPERATIONAL_ITEMIZED', MT:'NOT_APPLICABLE', PA:'OPERATIONAL_AGGREGATED', PB:'SOURCE_SCHEMA_INSUFFICIENT', PE:'OPERATIONAL_ITEMIZED', PI:'PARTIAL_OPERATIONAL', PR:'BLOCKED', RJ:'NOT_APPLICABLE', RN:'OPERATIONAL_ITEMIZED', RO:'PARTIAL_OPERATIONAL', RR:'PARTIAL_OPERATIONAL', RS:'OPERATIONAL_AGGREGATED', SC:'OPERATIONAL_ITEMIZED', SE:'OPERATIONAL_ITEMIZED', SP:'OPERATIONAL_ITEMIZED', TO:'OPERATIONAL_ITEMIZED' } as Record<string, SourceStatus>)[house]!;
const provider = (house: string): string => ({ AC:'al_ac_viap', AL:'al_al_viap', AP:'alap_ceap', AM:'aleam_ceap_pdf', BA:'alba_nopapercloud', CE:'alce_vdp_csv', DF:'cldf_ckan_vi', ES:'alese_cotas', GO:'alego_transparencia', MA:'alema_ceap', MG:'almg_verba_indenizatoria', MS:'alms_ceap_csv', MT:'fixed_indemnity', PA:'alepa_devexpress', PB:'alpb_viap', PE:'alepe_ceap', PI:'alpi_transparencia', PR:'alpr_captcha', RJ:'no_reimbursable_quota', RN:'alrn_ceap', RO:'alro_transparencia', RR:'alrr_verbas', RS:'alrs_custom', SC:'alesc_gabinetes_csv', SE:'alese_ressarcimento', SP:'alesp_open_data', TO:'aleto_codap' } as Record<string, string>)[house]!;
const WAVE_A = new Set(['AM','AP','CE','DF','MG','MS','PE','RN','SE','SP','TO']);
const WAVE_B = new Set(['BA','ES','GO','MA','PA','PI','RO','RR','RS']);
const MIGRATED = new Set(['AM','AP','CE','DF','MG','MS','PE','RN','SE','SP','TO']);
const FIXTURE_DEFERRED = new Set(['CE','SP']);
// P18.3J promotes ES after its browser-flow collector, publication and replay
// were proven in the lab.  The registry is the scheduler source of truth; a
// provider cannot be considered operational merely because its source status
// says that an endpoint exists.
const PROVEN_CURRENT = new Set(['SC', 'SP', 'CE', 'PE', 'ES', 'AP', 'MG', 'MS']);
const framework = (house: string): FrameworkStatus => PROVEN_CURRENT.has(house) || MIGRATED.has(house) || house === 'SC' ? 'CORE_MIGRATED' : ['AC','AL','PB'].includes(house) ? 'CORE_REQUIRES_PROVIDER_REPAIR' : house === 'PR' ? 'CORE_BLOCKED_EXTERNAL' : ['MT','RJ'].includes(house) ? 'CORE_NOT_APPLICABLE' : WAVE_A.has(house) ? 'CORE_REQUIRES_PROVIDER_IMPLEMENTATION' : 'CORE_COMPATIBLE_WITH_ADAPTER';
const operation = (source: SourceStatus): OperationStatus => source === 'OPERATIONAL_ITEMIZED' || source === 'OPERATIONAL_AGGREGATED' ? 'CURRENT_OPERATIONAL' : source === 'PARTIAL_OPERATIONAL' ? 'CURRENT_PARTIAL' : source === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'BLOCKED';
const granularity = (house: string): FinanceGranularity => ({ ES:'CATEGORY_MONTH', GO:'PARLIAMENTARIAN_PAYMENT', MA:'CATEGORY_MONTH', PA:'CATEGORY_MONTH', RJ:'NO_REIMBURSABLE_QUOTA', MT:'FIXED_INDEMNITY', CE:'ITEM', PE:'ITEM', RN:'ITEM', RO:'ITEM', RR:'PARLIAMENTARIAN_PAYMENT', SC:'ITEM', SP:'ITEM', TO:'ITEM', default:'UNKNOWN' } as Record<string, FinanceGranularity>)[house] ?? 'UNKNOWN';
const transport = (house: string): SourceTransport => ({ AM:'HTTP_PDF', CE:'HTTP_CSV', MS:'HTTP_CSV', SC:'HTTP_CSV', SP:'HTTP_JSON', GO:'HTTP_JSON', ES:'BROWSER_FLOW', MA:'JSF', PE:'HTTP_JSON', RN:'BROWSER_FLOW', RR:'HTTP_PDF', default:'OTHER' } as Record<string, SourceTransport>)[house] ?? 'OTHER';
const currentEntrypoint = (house: string): string | undefined => ({ SC:'apps/collector/src/state/providers/state-finance/sc-current.ts:collectScCurrentFinance', AM:'apps/collector/src/state/providers/state-finance/am-core.ts:createAmCoreProvider', AP:'apps/collector/src/state/providers/state-finance/ap-core.ts:createApCoreProvider', CE:'apps/collector/src/state/providers/state-finance/ce-core.ts:createCeCoreProvider', DF:'apps/collector/src/state/providers/state-finance/df-core.ts:createDfCoreProvider', MG:'apps/collector/src/state/providers/state-finance/mg-core.ts:createMgCoreProvider', MS:'apps/collector/src/state/providers/state-finance/ms-core.ts:createMsCeapCoreProvider', PE:'apps/collector/src/state/providers/state-finance/pe-core.ts:createPeCoreProvider', RN:'apps/collector/src/state/providers/state-finance/rn-core.ts:createRnCoreProvider', SE:'apps/collector/src/state/providers/state-finance/se-core.ts:createSeCoreProvider', SP:'apps/collector/src/state/providers/state-finance/sp-core.ts:createSpCoreProvider', TO:'apps/collector/src/state/providers/state-finance/to-core.ts:createToCoreProvider', BA:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', ES:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', GO:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', MA:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', PA:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', PI:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', RO:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', RR:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent', RS:'apps/collector/src/state/providers/state-finance/live-wave-b.ts:collectWaveBCurrent' } as Record<string, string | undefined>)[house];
const files = (house: string): string[] => house === 'SC' ? ['apps/collector/src/state/providers/state-finance/sc-current.ts'] : WAVE_B.has(house) ? ['apps/collector/src/state/providers/state-finance/live-wave-b.ts','apps/collector/src/state/providers/state-finance/core-adapter.ts'] : currentEntrypoint(house) ? [currentEntrypoint(house)!.split(':')[0]!, 'apps/collector/src/state/providers/state-finance/wave-a.ts','apps/collector/src/state/providers/state-finance/core-adapter.ts'] : [];
const version = (house: string): string => house === 'SC' ? 'alesc_gabinetes_csv:v1' : house === 'MS' ? 'alms_ceap_csv:v1' : WAVE_B.has(house) ? `${provider(house)}:finance:v1` : MIGRATED.has(house) ? `${provider(house)}:v1` : 'inventory:v1';
const collectionModel = (house: string): CollectionModel => ({ ES:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', AP:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', MG:'PARTITIONED_BY_COMPETENCE', DF:'FULL_SNAPSHOT', BA:'IMMUTABLE_DOCUMENT_CORPUS', SE:'PARTITIONED_BY_COMPETENCE', AM:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', RN:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', TO:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', MS:'FULL_SNAPSHOT', GO:'PARTITIONED_BY_COMPETENCE', MA:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', PA:'PARTITIONED_BY_COMPETENCE', PI:'PARTITIONED_BY_COMPETENCE', RO:'PARTITIONED_BY_COMPETENCE', RR:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', RS:'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE', AC:'PARTITIONED_BY_COMPETENCE', AL:'PARTITIONED_BY_COMPETENCE', PB:'PARTITIONED_BY_COMPETENCE', PR:'OTHER_PROVEN_MODEL', default:'FULL_SNAPSHOT' } as Record<string, CollectionModel>)[house] ?? 'FULL_SNAPSHOT';
const manifest = (house: string): CollectorManifest => ({ house, domain:'finance', provider:provider(house), providerVersion: version(house), collectionModel:collectionModel(house), source:{ url:`registry://${house}/finance`, format:transport(house) }, schemaPolicy:{ version: house === 'MS' ? 'ms-ceap-csv-v1' : house === 'SC' ? 'sc-current-v1' : `${provider(house)}-v1`, unknownDrift:'FAIL_CLOSED' }, revisionScope:`${house}:finance` });

const historical = (house: string): { supports: boolean|'UNKNOWN'; from?: string; to?: string; proven: boolean|'UNKNOWN'; backfilled: boolean|'UNKNOWN'; identity: boolean|'UNKNOWN' } => {
  if (house === 'SC' || house === 'MS') return { supports: true, from: '2023', to: '2025', proven: true, backfilled: true, identity: true };
  return { supports: 'UNKNOWN', proven: 'UNKNOWN', backfilled: 'UNKNOWN', identity: 'UNKNOWN' };
};

export const NATIONAL_FINANCE_REGISTRY: readonly FinanceCapabilityRegistration[] = HOUSES.map(house => {
  const sourceStatus = status(house); const frameworkStatus = framework(house); const operationStatus = operation(sourceStatus); const notApplicable = frameworkStatus === 'CORE_NOT_APPLICABLE';
  const hist = historical(house);
  const schedulerEligibility = PROVEN_CURRENT.has(house) ? 'YES' : frameworkStatus === 'CORE_MIGRATED' && house === 'MS' ? 'PENDING_OPERATIONAL_PROOF' : frameworkStatus === 'CORE_MIGRATED' ? 'PENDING_OPERATIONAL_PROOF' : 'NO';
  const identityDependency: IdentityDependency = notApplicable ? 'NOT_APPLICABLE' : house === 'MS' ? 'RESOLVED_FOR_PROVEN_HISTORICAL_RANGE' : sourceStatus === 'OPERATIONAL_ITEMIZED' && house === 'SC' ? 'PROVEN' : sourceStatus === 'OPERATIONAL_ITEMIZED' ? 'PARTIAL' : sourceStatus === 'OPERATIONAL_AGGREGATED' ? 'PARTIAL' : 'UNRESOLVED';
  const tests = house === 'SC' ? ['tests/unit/core-collector.test.ts','tests/unit/state-p18-2b2cr.test.ts'] : frameworkStatus === 'CORE_MIGRATED' ? ['tests/unit/core-collector.test.ts','tests/unit/state-p18-3d-provider.test.ts'] : [];
  const artifactEvidence = house === 'SC' ? ['artifacts/P18_2b2.json','artifacts/P18_2b2i.json','artifacts/P18_2b2ir.json','artifacts/P18_2b2c.json','artifacts/P18_2b2cr.json'] : house === 'MS' ? ['artifacts/P18_2b1.json','artifacts/P18_2b1i.json','artifacts/P18_2b1ir.json'] : ['artifacts/P18_1d3.json'];
  const blocker = house === 'MS' ? 'Active external IDs cannot yet be reproduced from preserved raw/canonical evidence; identity migration is prohibited until source-byte evidence is recovered.' : frameworkStatus === 'CORE_REQUIRES_PROVIDER_REPAIR' ? 'Existing source/provider contract requires repair; no discovery in P18.3B.' : frameworkStatus === 'CORE_BLOCKED_EXTERNAL' ? 'External access blocker preserved.' : frameworkStatus === 'CORE_NOT_APPLICABLE' ? 'No reimbursable transaction source under house semantics.' : frameworkStatus === 'CORE_MIGRATED' && house !== 'SC' ? 'Operational proof deferred to P18.3E; no revision is published in P18.3D.' : undefined;
  const migrationWave = frameworkStatus === 'CORE_REQUIRES_PROVIDER_IMPLEMENTATION' ? 'PROVIDER_IMPLEMENTATION' : frameworkStatus === 'CORE_REQUIRES_PROVIDER_REPAIR' ? 'PROVIDER_REPAIR' : frameworkStatus === 'CORE_BLOCKED_EXTERNAL' ? 'EXTERNAL_BLOCKER' : frameworkStatus === 'CORE_NOT_APPLICABLE' ? 'NOT_APPLICABLE' : WAVE_B.has(house) ? 'B' : 'A';
  const msKeyRecovered = house !== 'MS';
  return { manifest:manifest(house), status:(PROVEN_CURRENT.has(house) || (frameworkStatus === 'CORE_MIGRATED' && msKeyRecovered) ? 'OPERATIONAL' : house === 'MS' ? 'PARTIAL' : sourceStatus === 'BLOCKED' ? 'BLOCKED' : notApplicable ? 'AVAILABLE' : sourceStatus === 'OPERATIONAL_ITEMIZED' || sourceStatus === 'OPERATIONAL_AGGREGATED' ? 'PARTIAL' : 'BLOCKED') as CapabilityStatus, sourceStatus, frameworkStatus, operationStatus, granularity:granularity(house), transport:transport(house), supportsCurrent:operationStatus === 'CURRENT_OPERATIONAL' || operationStatus === 'CURRENT_PARTIAL', supportsHistorical:hist.supports, ...(hist.from ? { historicalFrom: hist.from } : {}), ...(hist.to ? { historicalTo: hist.to } : {}), currentEntrypoint:currentEntrypoint(house), identityDependency, ...(blocker ? { knownBlocker: blocker } : {}), migrationWave, schedulerEligible:PROVEN_CURRENT.has(house), schedulerEligibility:PROVEN_CURRENT.has(house) ? 'YES' : house === 'MS' ? 'NO' : schedulerEligibility, historicalSourceProven:hist.proven, historicalBackfilled:hist.backfilled, historicalIdentityReconciled:hist.identity, historicalRangeProven:hist.proven === true, providerFiles:files(house), tests, artifactEvidence, collectionModel:collectionModel(house) };
});

export function createNationalFinanceRegistry(): HouseCapabilityRegistry { const registry = new HouseCapabilityRegistry(); for (const entry of NATIONAL_FINANCE_REGISTRY) registry.register(entry); return registry; }
export const NATIONAL_FINANCE_HOUSES = HOUSES;
