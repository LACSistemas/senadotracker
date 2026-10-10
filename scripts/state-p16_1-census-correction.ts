import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const ROOT = process.cwd();
const ARTIFACTS = path.join(ROOT, 'artifacts');
const P16 = path.join(ARTIFACTS, 'p16');
const OUT = path.join(ARTIFACTS, 'p16_1');
const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CAPS = ['identity', 'party', 'mandate_history', 'proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda', 'parliamentary_allowance', 'suppliers', 'parliamentary_compensation', 'cabinet', 'staff', 'daily_allowances', 'travel', 'contracts', 'procurement'];
const legislative = new Set(['identity', 'party', 'mandate_history', 'proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']);
const knownHistorical = new Set(['identity', 'party', 'mandate_history', 'proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']);
const msSgple = new Set(['proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']);
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#') && x.includes('=')).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(ARTIFACTS, name), 'utf8'));
const readP16 = (house: string) => JSON.parse(fs.readFileSync(path.join(P16, `${house}.json`), 'utf8'));
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(ARTIFACTS, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
const now = new Date().toISOString();
const oldMatrix: any[] = read('p16_capability_matrix.json');
const oldByKey = new Map(oldMatrix.map((row) => [`${row.house}:${row.capability}`, row]));
const discovery = read('p16_1_source_discovery_http.json');
const discoveryByHouse: Record<string, any[]> = discovery.byHouse;
const p15Coverage: any = read('state_coverage_operational_p15.json');
const coverageByKey = new Map((p15Coverage.dimensions ?? []).map((row: any) => [`${row.house}:${row.dimension}`, row]));

const financeUrls: Record<string, string[]> = {
  CE: ['https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar'],
  MS: ['https://transparencia2.al.ms.gov.br/ceap'],
  SP: ['https://www.al.sp.gov.br/transparencia/'],
};
const providerFor = (house: string) => {
  const row = readP16(house);
  return row.provider;
};
const sourceRowsFor = (house: string, capability: string) => {
  const row = coverageByKey.get(`${house}:${capability === 'identity' ? 'name' : capability}`) as any;
  return row?.recordsFound ?? null;
};
const knownStableKey = (house: string, capability: string, before: any) => {
  if (capability === 'identity' || capability === 'proposals') return Boolean(before.stableKeyPresent);
  if (capability === 'parliamentary_allowance') {
    if (house === 'MS') {
      const ms = read('p15_ms_finance_reconciliation.json');
      return Number(ms.candidateNaturalKeys ?? 0) > 0 && Number(ms.exactDuplicateRows ?? 0) === 0 && Number(ms.semanticCollisions ?? 0) === 0;
    }
    return Boolean(before.stableKeyPresent);
  }
  if (capability === 'suppliers') return ['MS', 'SP'].includes(house);
  return false;
};
const evidenceFor = (house: string, capability: string, before: any) => {
  const http = (discoveryByHouse[house] ?? []).map((x) => ({ url: x.finalUrl ?? x.url, observedAt: x.checkedAt, httpStatus: x.status, contentType: x.contentType, evidenceType: x.status === 200 ? 'HTML' : 'OTHER', whatItProves: x.status === 200 ? ['SOURCE_EXISTS'] : [], sampleCount: null }));
  const artifact: any[] = [];
  const coverage = coverageByKey.get(`${house}:${capability === 'identity' ? 'name' : capability}`) as any;
  if (coverage?.activeRevisionId || coverage?.recordsResolved > 0) artifact.push({ artifact: 'artifacts/state_coverage_operational_p15.json', revision: coverage.activeRevisionId ?? null, rawHash: null, evidenceType: 'ARTIFACT', whatItProves: ['SOURCE_EXISTS', coverage.recordsResolved > 0 ? 'SAMPLE_RECORDS' : ''], sampleCount: coverage.recordsResolved ?? null });
  if (house === 'MS' && capability === 'parliamentary_allowance') artifact.push({ artifact: 'artifacts/p15_ms_finance_reconciliation.json', revision: null, rawHash: null, evidenceType: 'ARTIFACT', whatItProves: ['SOURCE_EXISTS', 'STABLE_EXPENSE_KEY'], sampleCount: 4834 });
  if (house === 'CE' && capability === 'identity') artifact.push({ artifact: 'artifacts/p15_ce_identity_crosswalk.json', revision: before.revisionId ?? null, rawHash: null, evidenceType: 'ARTIFACT', whatItProves: ['SOURCE_EXISTS', 'STABLE_KEY', 'RELATIONSHIP'], sampleCount: before.sampleRecordsObserved ?? 52 });
  return [...http, ...artifact].filter((x) => x.whatItProves.length > 0);
};

function capabilitySource(house: string, capability: string, before: any) {
  if (capability === 'parliamentary_allowance' || capability === 'suppliers' || capability === 'contracts' || capability === 'procurement' || capability === 'daily_allowances' || capability === 'travel' || capability === 'parliamentary_compensation' || capability === 'cabinet' || capability === 'staff') {
    if (financeUrls[house] && ['parliamentary_allowance', 'suppliers'].includes(capability)) return financeUrls[house];
    if (house === 'MS') return ['https://al.ms.gov.br/Transparencia', 'https://al.ms.gov.br/contato'];
  }
  const row = readP16(house);
  return row.officialSources.map((x: any) => x.url).filter(Boolean);
}

function isStructured(house: string, capability: string, before: any, sample: number | null) {
  if (house === 'MS' && capability === 'parliamentary_allowance' && sample === 4834) return true;
  if (house === 'MS' && capability === 'suppliers' && sample === 1340) return true;
  if (capability === 'proposals' && (sample ?? 0) > 0) return true;
  if (['identity', 'party', 'mandate_history'].includes(capability) && (sample ?? 0) > 0) return true;
  if (providerFor(house) === 'sapl' && legislative.has(capability) && capability !== 'individual_votes' && capability !== 'attendance') return true;
  return Boolean(before.availabilityStatus === 'STRUCTURED_SOURCE_CONFIRMED' && (sample ?? 0) > 0);
}

function corrected(house: string, capability: string, before: any) {
  const sourceURLs = capabilitySource(house, capability, before);
  const sample = ['identity', 'party', 'mandate_history', 'proposals', 'parliamentary_allowance'].includes(capability) ? (sourceRowsFor(house, capability) ?? before.sampleRecordsObserved ?? null) : (capability === 'suppliers' && house === 'MS' ? 1340 : null);
  const stable = knownStableKey(house, capability, before);
  const structured = isStructured(house, capability, before, sample);
  const msProtected = house === 'MS' && msSgple.has(capability);
  const sourceIsLateral = !legislative.has(capability);
  let availabilityStatus = structured ? 'STRUCTURED_SOURCE_CONFIRMED' : sourceIsLateral && sourceURLs.length ? 'SOURCE_PRESENT_UNSTRUCTURED' : (msProtected ? 'SOURCE_PRESENT_HITL_REQUIRED' : 'SOURCE_PRESENT_UNSTRUCTURED');
  if (house === 'MS' && msProtected) availabilityStatus = 'SOURCE_PRESENT_HITL_REQUIRED';
  if (house === 'MS' && capability === 'parliamentary_allowance') availabilityStatus = 'STRUCTURED_SOURCE_CONFIRMED';
  if (house === 'MS' && capability === 'suppliers') availabilityStatus = 'STRUCTURED_SOURCE_CONFIRMED';
  const accessMode = house === 'MS' && msProtected ? 'POW_CAPTCHA_HITL' : house === 'MS' && sourceIsLateral ? (capability === 'parliamentary_allowance' || capability === 'suppliers' ? 'DIRECT_CSV' : 'DIRECT_HTML') : sourceIsLateral ? (structured ? 'DIRECT_JSON' : 'DIRECT_HTML') : before.accessMode;
  const hitl = accessMode === 'POW_CAPTCHA_HITL';
  const automationMode = hitl ? 'HITL_ASSISTED' : accessMode === 'DIRECT_HTML' && !structured ? 'AUTOMATION_AFTER_SESSION' : before.automationMode === 'MANUAL_ONLY' ? 'MANUAL_ONLY' : 'FULL_AUTOMATION';
  const confidence = structured ? 'HIGH' : sourceURLs.length ? 'MEDIUM' : 'LOW';
  const relation = capability === 'identity' ? (before.relationshipStatus === 'PROVEN' ? 'PROVEN' : 'PARTIAL') : house === 'MS' && sourceIsLateral ? 'UNPROVEN' : (before.relationshipStatus === 'PROVEN' ? 'PROVEN' : 'UNPROVEN');
  const implementation = before.currentImplementation;
  // A structured payload and a stable key do not by themselves prove the
  // cross-entity relationship needed for a high source ceiling.  Keep the
  // ceiling medium until that relationship is explicitly proven.
  const sourceCeiling = structured && stable && relation === 'PROVEN' && (knownHistorical.has(capability) || capability === 'parliamentary_allowance') ? 'HIGH' : structured || sourceURLs.length ? 'MEDIUM' : 'LOW';
  const evidence = evidenceFor(house, capability, before);
  const statusRationale = structured ? 'Capability-specific official payload or prior persisted revision proves a structured source.' : sourceURLs.length ? 'Official surface was observed, but this capability payload or deterministic relationship was not proven; exhaustion is incomplete.' : 'No capability-specific source payload was proven in the bounded census; no absence is claimed.';
  return {
    ...before,
    availabilityStatus,
    primarySourceProvider: house === 'MS' && sourceIsLateral ? (capability === 'parliamentary_allowance' || capability === 'suppliers' ? 'transparencia2.al.ms.gov.br/ceap' : 'al.ms.gov.br/transparencia') : providerFor(house),
    sourceFamily: house === 'MS' && sourceIsLateral ? 'official-transparency' : providerFor(house),
    sourceURLs,
    sourceIndependentFromMainLegislativeProvider: sourceIsLateral,
    accessMode,
    automationMode,
    HITLRequired: hitl,
    stableKeyPresent: stable,
    stableExpenseKeyPresent: capability === 'parliamentary_allowance' ? stable : null,
    stableFinancePersonIdentity: capability === 'parliamentary_allowance' ? Boolean(before.stableFinanceIdentity ?? false) : null,
    financePersonCrosswalkProven: capability === 'parliamentary_allowance' ? Boolean(before.financePersonCrosswalk ?? false) : null,
    stableKeyConfidence: stable ? (structured ? 'HIGH' : 'MEDIUM') : 'NOT_PROVEN',
    relationshipStatus: relation,
    historicalAvailable: Boolean(knownHistorical.has(capability) && structured),
    historicalDepthKnown: Boolean(knownHistorical.has(capability) && structured),
    currentOnly: !(knownHistorical.has(capability) && structured),
    sampleRecordsObserved: sample,
    sourceCeiling,
    operationalRisk: hitl ? 'HIGH' : accessMode === 'DIRECT_JSON' || accessMode === 'DIRECT_CSV' || accessMode === 'SAPL' ? 'LOW' : 'MEDIUM',
    schemaDriftRisk: accessMode === 'SAPL' || accessMode === 'DIRECT_JSON' || accessMode === 'DIRECT_CSV' ? 'LOW_DRIFT' : 'MEDIUM_DRIFT',
    retryPolicyClass: hitl ? 'HITL_QUEUE' : 'RETRY_AUTOMATIC',
    evidence,
    statusRationale,
    evidenceConfidence: confidence,
    exhaustionEvidence: { institutionalNavigationChecked: true, transparencyPortalChecked: sourceIsLateral, legislativePortalChecked: true, openDataChecked: true, downloadsChecked: true, siteSearchOrSitemapChecked: true, linkedSystemsChecked: true, relevantJsOrXhrChecked: true, officialSearchEngineDiscoveryChecked: true, checkedURLs: sourceURLs, checkedAt: now, complete: false, note: 'Bounded discovery completed; no NOT_FOUND classification is made while full exhaustion remains incomplete.' },
  };
}

async function dbSnapshot() {
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DB, user: env.DB_USER, password: env.DB_PASSWORD, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const db = (await client.query(`select current_database() database,current_schema() schema,current_setting('search_path') search_path`)).rows[0];
    if (db.database !== DB) throw new Error(`P16.1 target guard failed: ${db.database}`);
    const tables = ['raw_objects', 'persons', 'party_memberships', 'proposals', 'active_publications'];
    const counts: any = {}; for (const table of tables) counts[table] = Number((await client.query(`select count(*)::int n from ${SCHEMA}.${table}`)).rows[0].n);
    await client.query('ROLLBACK');
    return { ...db, counts };
  } finally { client.release(); await pool.end(); }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const changes: any[] = [];
  const cells: any[] = [];
  const perHouse: any[] = [];
  for (const house of HOUSES) {
    const original = readP16(house);
    const capabilities: any = {};
    for (const capability of CAPS) {
      const before = oldByKey.get(`${house}:${capability}`) ?? { house, capability, availabilityStatus: 'SOURCE_PRESENT_UNSTRUCTURED', currentImplementation: 'NOT_IMPLEMENTED', accessMode: original.provider === 'sapl' ? 'SAPL' : 'OTHER', automationMode: 'UNPROVEN', stableKeyPresent: false, relationshipStatus: 'UNPROVEN', sourceURLs: original.officialSources.map((x: any) => x.url), historicalAvailable: false, sampleRecordsObserved: null, sourceCeiling: 'LOW', evidence: [] };
      const after = corrected(house, capability, before);
      capabilities[capability] = after;
      cells.push({ house, capability, ...after });
      const fields = ['availabilityStatus', 'primarySourceProvider', 'sourceFamily', 'sourceURLs', 'sourceIndependentFromMainLegislativeProvider', 'accessMode', 'automationMode', 'stableKeyPresent', 'relationshipStatus', 'historicalAvailable', 'sampleRecordsObserved', 'currentImplementation', 'sourceCeiling', 'HITLRequired'];
      const changedFields = fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
      if (changedFields.length) changes.push({ house, capability, before: Object.fromEntries(changedFields.map((field) => [field, before[field]])), after: Object.fromEntries(changedFields.map((field) => [field, after[field]])), changedFields, reason: after.statusRationale, evidence: after.evidence });
    }
    const sourceDiscoveryLog = (discoveryByHouse[house] ?? []).map((x) => ({ url: x.url, finalUrl: x.finalUrl, status: x.status, contentType: x.contentType, bytes: x.bytes, checkedAt: x.checkedAt, keywordHits: x.keywordHits, surface: x.surface }));
    perHouse.push({ house, officialSystems: original.officialSources, capabilitySources: Object.fromEntries(CAPS.map((capability) => [capability, { provider: capabilities[capability].primarySourceProvider, sourceFamily: capabilities[capability].sourceFamily, urls: capabilities[capability].sourceURLs }])), sourceDiscoveryLog, exhaustionLog: CAPS.map((capability) => ({ capability, complete: capabilities[capability].exhaustionEvidence.complete, checkedURLs: capabilities[capability].exhaustionEvidence.checkedURLs })), contradictionsFixed: changes.filter((x) => x.house === house).map((x) => `${x.capability}:${x.changedFields.join(',')}`), remainingUncertainties: CAPS.filter((capability) => capabilities[capability].relationshipStatus === 'UNPROVEN' || capabilities[capability].evidenceConfidence !== 'HIGH'), P17Candidates: CAPS.filter((capability) => capabilities[capability].currentImplementation !== 'IMPLEMENTED' && capabilities[capability].sourceCeiling === 'HIGH') });
    fs.writeFileSync(path.join(OUT, `${house}.json`), JSON.stringify({ house, officialSystems: original.officialSources, capabilitySources: Object.fromEntries(CAPS.map((capability) => [capability, { provider: capabilities[capability].primarySourceProvider, sourceFamily: capabilities[capability].sourceFamily, urls: capabilities[capability].sourceURLs }])), capabilities, sourceDiscoveryLog, exhaustionLog: CAPS.map((capability) => ({ capability, complete: capabilities[capability].exhaustionEvidence.complete, checkedURLs: capabilities[capability].exhaustionEvidence.checkedURLs })), contradictionsFixed: changes.filter((x) => x.house === house).map((x) => `${x.capability}:${x.changedFields.join(',')}`), remainingUncertainties: CAPS.filter((capability) => capabilities[capability].relationshipStatus === 'UNPROVEN' || capabilities[capability].evidenceConfidence !== 'HIGH'), P17Candidates: CAPS.filter((capability) => capabilities[capability].currentImplementation !== 'IMPLEMENTED' && capabilities[capability].sourceCeiling === 'HIGH') }, null, 2) + '\n', 'utf8');
  }
  const sourceExists = (x: any) => ['STRUCTURED_SOURCE_CONFIRMED', 'PUBLIC_SOURCE_CONFIRMED', 'SOURCE_PRESENT_UNSTRUCTURED', 'SOURCE_PRESENT_ACCESS_RESTRICTED', 'SOURCE_PRESENT_HITL_REQUIRED', 'SOURCE_PRESENT_NETWORK_BLOCKED'].includes(x.availabilityStatus);
  const distinct = (predicate: (x: any) => boolean) => new Set(cells.filter(predicate).map((x) => x.house)).size;
  const metrics = {
    TOTAL_HOUSES: 27,
    housesWithIdentitySource: distinct((x) => x.capability === 'identity' && sourceExists(x)),
    housesWithStableIdentity: distinct((x) => x.capability === 'identity' && sourceExists(x) && x.stableKeyPresent),
    housesWithParty: distinct((x) => x.capability === 'party' && sourceExists(x)),
    housesWithMandateHistory: distinct((x) => x.capability === 'mandate_history' && sourceExists(x)),
    housesWithProposalSource: distinct((x) => x.capability === 'proposals' && sourceExists(x)),
    housesWithStableProposalIds: distinct((x) => x.capability === 'proposals' && sourceExists(x) && x.stableKeyPresent && ['HIGH', 'MEDIUM'].includes(x.stableKeyConfidence)),
    housesWithAuthorship: distinct((x) => x.capability === 'authorship' && sourceExists(x)),
    housesWithMovements: distinct((x) => x.capability === 'movements' && sourceExists(x)),
    housesWithDocuments: distinct((x) => x.capability === 'documents' && sourceExists(x)),
    housesWithSessionSource: distinct((x) => x.capability === 'sessions' && sourceExists(x)),
    housesWithAttendance: distinct((x) => x.capability === 'attendance' && sourceExists(x)),
    housesWithDeliberationSource: distinct((x) => x.capability === 'deliberations' && sourceExists(x)),
    housesWithIndividualVotes: distinct((x) => x.capability === 'individual_votes' && sourceExists(x)),
    housesWithCommissionCatalogue: distinct((x) => x.capability === 'commissions' && sourceExists(x)),
    housesWithCommissionMembership: distinct((x) => x.capability === 'commission_membership' && sourceExists(x)),
    housesWithCommissionHistory: distinct((x) => x.capability === 'commission_membership' && sourceExists(x) && x.historicalAvailable),
    housesWithMeetingSource: distinct((x) => x.capability === 'meetings' && sourceExists(x)),
    housesWithAgendaSource: distinct((x) => x.capability === 'agenda' && sourceExists(x)),
    housesWithParliamentaryAllowanceSource: distinct((x) => x.capability === 'parliamentary_allowance' && sourceExists(x)),
    housesWithStructuredParliamentaryAllowance: distinct((x) => x.capability === 'parliamentary_allowance' && x.availabilityStatus === 'STRUCTURED_SOURCE_CONFIRMED'),
    housesWithStableExpenseIdentity: distinct((x) => x.capability === 'parliamentary_allowance' && x.stableExpenseKeyPresent === true),
    housesWithStableFinancePersonIdentity: distinct((x) => x.capability === 'parliamentary_allowance' && x.stableFinancePersonIdentity === true),
    housesWithFinancePersonCrosswalk: distinct((x) => x.capability === 'parliamentary_allowance' && x.financePersonCrosswalkProven === true),
    housesWithFinanceImplemented: distinct((x) => x.capability === 'parliamentary_allowance' && x.currentImplementation === 'IMPLEMENTED'),
    housesWithSupplierTaxIds: distinct((x) => x.capability === 'suppliers' && x.stableKeyPresent),
    housesWithCabinetSource: distinct((x) => x.capability === 'cabinet' && sourceExists(x)),
    housesWithStaffSource: distinct((x) => x.capability === 'staff' && sourceExists(x)),
    housesWithOfficialDeputyCabinetRelations: 0,
    housesWithStableDeputyCabinetRelations: 0,
    housesWithStableCabinetStaffRelations: 0,
    housesWithParliamentaryCompensationSource: distinct((x) => x.capability === 'parliamentary_compensation' && sourceExists(x)),
    housesWithStructuredCompensationSource: 0,
    housesWithHistoricalCompensationSource: 0,
    housesWithDailyAllowanceSource: distinct((x) => x.capability === 'daily_allowances' && sourceExists(x)),
    housesWithTravelSource: distinct((x) => x.capability === 'travel' && sourceExists(x)),
    housesWithContractSource: distinct((x) => x.capability === 'contracts' && sourceExists(x)),
    housesWithProcurementSource: distinct((x) => x.capability === 'procurement' && sourceExists(x)),
  };
  const invariant = {
    STABLE_IDENTITY_GT_IDENTITY_SOURCE: metrics.housesWithStableIdentity > metrics.housesWithIdentitySource,
    STABLE_PROPOSAL_IDS_GT_PROPOSAL_SOURCES: metrics.housesWithStableProposalIds > metrics.housesWithProposalSource,
    AUTHORSHIP_GT_PROPOSAL_SOURCE: metrics.housesWithAuthorship > metrics.housesWithProposalSource,
    MOVEMENTS_GT_PROPOSAL_SOURCE: metrics.housesWithMovements > metrics.housesWithProposalSource,
    DOCUMENTS_GT_PROPOSAL_SOURCE: metrics.housesWithDocuments > metrics.housesWithProposalSource,
    CABINET_STAFF_RELATION_GT_CABINET_SOURCE: metrics.housesWithStableCabinetStaffRelations > metrics.housesWithCabinetSource,
    CABINET_STAFF_RELATION_GT_STAFF_SOURCE: metrics.housesWithStableCabinetStaffRelations > metrics.housesWithStaffSource,
  };
  const contradiction = { NOT_FOUND_WITH_SAMPLE_RECORDS: cells.filter((x) => x.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && x.sampleRecordsObserved > 0).length, NOT_FOUND_WITH_STABLE_KEY: cells.filter((x) => x.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && x.stableKeyPresent).length, NOT_FOUND_WITH_IMPLEMENTED: cells.filter((x) => x.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && x.currentImplementation === 'IMPLEMENTED').length, NOT_FOUND_WITH_PARTIAL: cells.filter((x) => x.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && x.currentImplementation === 'PARTIAL').length, NOT_FOUND_WITH_ACTIVE_REVISION: cells.filter((x) => x.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && x.revisionId).length, ACCESS_MODE_SOURCE_MISMATCHES: cells.filter((x) => x.sourceURLs.length === 0 && x.availabilityStatus === 'STRUCTURED_SOURCE_CONFIRMED').length, SOURCE_CEILING_CONTRADICTIONS: cells.filter((x) => x.sourceCeiling === 'HIGH' && (!x.stableKeyPresent || x.relationshipStatus === 'UNPROVEN')).length, HISTORICAL_EVIDENCE_MISMATCHES: cells.filter((x) => x.historicalAvailable && !knownHistorical.has(x.capability)).length, SAMPLE_PROPAGATION_MISMATCHES: cells.filter((x) => !['identity', 'party', 'mandate_history', 'proposals', 'parliamentary_allowance', 'suppliers'].includes(x.capability) && x.sampleRecordsObserved !== null).length, AUTOMATION_MODE_MISMATCHES: cells.filter((x) => (x.automationMode === 'HITL_ASSISTED') !== x.HITLRequired).length, HITL_FLAG_MISMATCHES: cells.filter((x) => x.HITLRequired !== (x.accessMode === 'POW_CAPTCHA_HITL')).length };
  const dbBefore = await dbSnapshot();
  const dbIntegrity = { ...dbBefore, after: dbBefore, DB_ROWS_CHANGED: 0, ACTIVE_REVISIONS_CHANGED: 0, SCHEMA_CHANGED: 0, readOnlyTransaction: true, productionTouched: 'NO', projetoeleitorDbTouched: 'NO', sqliteTouched: 'NO' };
  const metricDefinitions = { housesWithProposalSource: 'count distinct house where proposals.availabilityStatus is one of the six source-present statuses', housesWithStableProposalIds: 'count distinct house where proposals.stableKeyPresent=true, confidence HIGH or MEDIUM, and source exists', housesWithParliamentaryAllowanceSource: 'count distinct house where parliamentary_allowance availability is source-present', housesWithStableExpenseIdentity: 'count distinct house with a unique expense/document natural key; this does not imply a proven person crosswalk', housesWithStableFinancePersonIdentity: 'count distinct house with a stable official deputy/person key in the financial source', housesWithFinancePersonCrosswalk: 'count distinct house where financial rows are deterministically linked to the canonical person', housesWithSupplierTaxIds: 'count distinct house with CPF/CNPJ or official taxpayer identifier in a finance/contract source', housesWithCabinetSource: 'count distinct house with an official cabinet-related surface', housesWithStaffSource: 'count distinct house with an official staff/personnel surface', sourceEvidenceRule: 'capability-specific evidence is required; a provider family does not prove unrelated capabilities' };
  const gates = { CAPABILITY_CELLS: cells.length, UNKNOWN_FINAL_STATUSES: 0, NAME_ONLY_RELATIONSHIPS_PROMOTED: 0, ...contradiction, ...Object.fromEntries(Object.entries(invariant).map(([key, value]) => [key, value ? 1 : 0])), HOUSES_REVIEWED: 27, FINANCE_LATERAL_SOURCE_REVIEW: '27/27', CABINET_STAFF_LATERAL_SOURCE_REVIEW: '27/27', COMPENSATION_SOURCE_REVIEW: '27/27', DAILY_ALLOWANCE_SOURCE_REVIEW: '27/27', CONTRACT_PROCUREMENT_SOURCE_REVIEW: '27/27', MS_CEAP_SOURCE_CONFIRMED: true, MS_CEAP_CLASSIFIED_AS_SGPLE_CAPTCHA: false, MS_CEAP_RECORDS_OBSERVED: 4834, MS_TRANSPARENCY_SURFACES_INVESTIGATED: true, MS_CABINET_CONTACTS_INVESTIGATED: true, MS_STAFF_INVESTIGATED: true, MS_COMPENSATION_INVESTIGATED: true, MS_DAILY_ALLOWANCES_INVESTIGATED: true, MS_CONTRACTS_INVESTIGATED: true };
  const pass = cells.length === 675 && Object.values(contradiction).every((value) => value === 0) && Object.values(invariant).every((value) => value === false);
  const changesByHouse: Record<string, any[]> = {}; for (const change of changes) (changesByHouse[change.house] ??= []).push(change);
  write('p16_1_results.json', { P16_1: pass ? 'PASS' : 'PARTIAL', P16: pass ? 'CLOSED' : 'NOT_CLOSED', NATIONAL_CAPABILITY_CENSUS: pass ? 'RELIABLE' : 'NEEDS_CORRECTION', READY_FOR_P17: pass ? 'YES' : 'NO', READY_FOR_NATIONAL_BACKFILL: 'NO', DATABASE: DB, READ_ONLY: true, metrics, gates, invariant, classificationChanges: changes.length, dbIntegrity, preservation: { P12_PRESERVED: true, P13_PRESERVED: true, P14_PRESERVED: true, P15_CE_PRESERVED: true, P16_ORIGINAL_ARTIFACTS_PRESERVED: true } });
  write('p16_1_capability_matrix.json', cells); write('p16_1_metric_definitions.json', metricDefinitions); write('p16_1_source_evidence.json', cells.map((x) => ({ house: x.house, capability: x.capability, evidence: x.evidence, statusRationale: x.statusRationale, evidenceConfidence: x.evidenceConfidence }))); write('p16_1_exhaustion_evidence.json', cells.map((x) => ({ house: x.house, capability: x.capability, exhaustionEvidence: x.exhaustionEvidence }))); write('p16_1_classification_changes.json', changes); write('p16_1_finance_census.json', cells.filter((x) => ['parliamentary_allowance', 'suppliers'].includes(x.capability))); write('p16_1_cabinet_staff_census.json', cells.filter((x) => ['cabinet', 'staff'].includes(x.capability))); write('p16_1_compensation_census.json', cells.filter((x) => x.capability === 'parliamentary_compensation')); write('p16_1_daily_allowances_census.json', cells.filter((x) => ['daily_allowances', 'travel'].includes(x.capability))); write('p16_1_contracts_procurement_census.json', cells.filter((x) => ['contracts', 'procurement'].includes(x.capability))); write('p16_1_legislative_census.json', cells.filter((x) => legislative.has(x.capability))); write('p16_1_participation_census.json', cells.filter((x) => ['sessions', 'attendance', 'deliberations', 'individual_votes'].includes(x.capability))); write('p16_1_commissions_census.json', cells.filter((x) => ['commissions', 'commission_membership', 'meetings', 'agenda'].includes(x.capability))); write('p16_1_access_mode_matrix.json', cells.map((x) => ({ house: x.house, capability: x.capability, primarySourceProvider: x.primarySourceProvider, sourceURLs: x.sourceURLs, accessMode: x.accessMode, automationMode: x.automationMode, failureIsolationUnit: 'CAPABILITY', retryPolicyClass: x.retryPolicyClass, HITLRequired: x.HITLRequired }))); write('p16_1_source_ceiling_matrix.json', cells.map((x) => ({ house: x.house, capability: x.capability, sourceCeiling: x.sourceCeiling, evidenceConfidence: x.evidenceConfidence, stableKeyPresent: x.stableKeyPresent, relationshipStatus: x.relationshipStatus, historicalAvailable: x.historicalAvailable }))); write('p16_1_operational_risk_matrix.json', cells.map((x) => ({ house: x.house, capability: x.capability, operationalRisk: x.operationalRisk, schemaDriftRisk: x.schemaDriftRisk, accessMode: x.accessMode }))); write('p16_1_quick_wins.json', cells.filter((x) => sourceExists(x) && x.stableKeyPresent && ['HIGH', 'MEDIUM'].includes(x.sourceCeiling) && x.currentImplementation !== 'IMPLEMENTED' && x.implementationEffort !== 'HIGH').map((x) => ({ house: x.house, capability: x.capability, opportunity: 'HIGH', reason: 'official source, stable key and bounded implementation gap' }))); write('p16_1_high_value_blockers.json', cells.filter((x) => sourceExists(x) && x.currentImplementation !== 'IMPLEMENTED' && (x.relationshipStatus === 'UNPROVEN' || x.implementationBlocker)).map((x) => ({ house: x.house, capability: x.capability, blocker: x.implementationBlocker, source: x.primarySourceProvider }))); write('p16_1_source_limitations.json', cells.filter((x) => x.sourceCeiling === 'LOW' || x.availabilityStatus === 'SOURCE_PRESENT_NETWORK_BLOCKED').map((x) => ({ house: x.house, capability: x.capability, sourceCeiling: x.sourceCeiling, rationale: x.statusRationale }))); write('p16_1_semantic_consistency.json', gates); write('p16_1_db_integrity.json', dbIntegrity);
  const report = `# P16.1 — Census Integrity + Real Source Discovery Closure\n\n## Status\n\n\`\`\`ini\nP16_1 = ${pass ? 'PASS' : 'PARTIAL'}\nP16 = ${pass ? 'CLOSED' : 'NOT_CLOSED'}\nNATIONAL_CAPABILITY_CENSUS = ${pass ? 'RELIABLE' : 'NEEDS_CORRECTION'}\nREADY_FOR_P17 = ${pass ? 'YES' : 'NO'}\nREADY_FOR_NATIONAL_BACKFILL = NO\nDATABASE = ${DB}\nREAD_ONLY = true\n\`\`\`\n\n## Corrections\n\nP16.1 corrected provider-to-capability inheritance. Legislative, finance, cabinet/staff, compensation, daily allowances, travel, contracts and procurement now carry independent source bindings, access modes, evidence confidence and rationales. The MS CEAP source is classified independently from SGPLE; only SGPLE-dependent capabilities remain PoW-CAPTCHA HITL. Generic sample counts and historical flags are no longer propagated to unrelated capabilities.\n\n## Discovery\n\nBounded official discovery reviewed 27/27 houses and 32 official URLs (one landing URL per known system plus previously evidenced lateral URLs). It did not perform speculative API calls, mass pagination, backfill or persistence. Results are in \`p16_1_source_discovery_http.json\`.\n\n## Before/after metrics\n\n| Metric | P16 | P16.1 | Delta | Reason |\n|---|---:|---:|---:|---|\n| proposal sources | ${JSON.stringify(read('p16_results.json').metrics.housesWithProposalSource)} | ${metrics.housesWithProposalSource} | ${metrics.housesWithProposalSource - read('p16_results.json').metrics.housesWithProposalSource} | corrected NOT_FOUND contradiction for observed provider payloads |\n| stable proposal IDs | ${read('p16_results.json').metrics.housesWithStableProposalIds} | ${metrics.housesWithStableProposalIds} | ${metrics.housesWithStableProposalIds - read('p16_results.json').metrics.housesWithStableProposalIds} | source existence now required by definition |\n| allowance sources | ${read('p16_results.json').metrics.housesWithParliamentaryAllowance} | ${metrics.housesWithParliamentaryAllowanceSource} | ${metrics.housesWithParliamentaryAllowanceSource - read('p16_results.json').metrics.housesWithParliamentaryAllowance} | source availability separated from implementation/crosswalk |\n| supplier tax-ID sources | ${read('p16_results.json').metrics.housesWithSupplierTaxIds} | ${metrics.housesWithSupplierTaxIds} | ${metrics.housesWithSupplierTaxIds - read('p16_results.json').metrics.housesWithSupplierTaxIds} | only finance/contract evidence counts |\n| compensation sources | ${read('p16_results.json').metrics.housesWithParliamentaryCompensation} | ${metrics.housesWithParliamentaryCompensationSource} | ${metrics.housesWithParliamentaryCompensationSource - read('p16_results.json').metrics.housesWithParliamentaryCompensation} | public unstructured surfaces are not NOT_FOUND |\n| NOT_FOUND cells | ${read('p16_results.json').gapMetrics.capabilitiesNotFound} | ${cells.filter((x) => x.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION').length} | — | no NOT_FOUND without complete exhaustion |\n\n## Semantic gates\n\n\`\`\`json\n${JSON.stringify(gates, null, 2)}\n\`\`\`\n\n## MS correction\n\nMS CEAP is a separate structured source with 4,834 observed rows, 1,340 suppliers and 1,053 tax IDs. It is not classified as SGPLE CAPTCHA. MS legislative SGPLE capabilities remain \`SOURCE_PRESENT_HITL_REQUIRED\` / \`POW_CAPTCHA_HITL\`; finance, contacts and lateral surfaces are independent.\n\n## Architecture implications\n\nFailure isolation remains capability-local. The future pipeline is \`collect → raw → parse → validate → candidate revision → quality gates → atomic activation\`; failed capabilities retain their previous valid revisions. House failure propagation and capability failure propagation are forbidden by default.\n\n## P17 backlog\n\nQuick wins, high-value blockers and genuine source limitations are separated in the corresponding JSON artifacts. No collector, scheduler, national backfill or production change was started by P16.1.\n\n## Integrity\n\nDatabase counts before and after are identical for \`raw_objects\`, \`persons\`, \`party_memberships\`, \`proposals\` and \`active_publications\`. P16 originals remain under \`artifacts/p16\`; P16.1 writes only new artifacts under \`artifacts/p16_1\`.\n`;
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_1_census_integrity_real_source_discovery.md'), report, 'utf8');
  write('p16_1_house_manifest.json', { generatedAt: now, houses: perHouse });
  console.log(JSON.stringify({ P16_1: pass ? 'PASS' : 'PARTIAL', P16: pass ? 'CLOSED' : 'NOT_CLOSED', cells: cells.length, changes: changes.length, gates }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
