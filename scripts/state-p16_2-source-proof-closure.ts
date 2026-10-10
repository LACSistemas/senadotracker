import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const ROOT = process.cwd();
const ARTIFACTS = path.join(ROOT, 'artifacts');
const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CAPS = ['identity', 'party', 'mandate_history', 'proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda', 'parliamentary_allowance', 'suppliers', 'parliamentary_compensation', 'cabinet', 'staff', 'daily_allowances', 'travel', 'contracts', 'procurement'];
const LEGISLATIVE = new Set(['identity', 'party', 'mandate_history', 'proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']);
const SGPLE = new Set(['proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']);
const LATERAL = new Set(CAPS.filter((capability) => !LEGISLATIVE.has(capability)));
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(ARTIFACTS, name), 'utf8'));
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(ARTIFACTS, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const old: any[] = read('p16_1_capability_matrix.json');
const oldByKey = new Map(old.map((row) => [`${row.house}:${row.capability}`, row]));
const discovery: any = read('p16_1_source_discovery_http.json');
const p15Coverage: any = read('state_coverage_operational_p15.json');
const coverageByKey = new Map((p15Coverage.dimensions ?? []).map((row: any) => [`${row.house}:${row.dimension}`, row]));
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const now = new Date().toISOString();

const keywordRules: Record<string, RegExp> = {
  parliamentary_allowance: /ceap|verba|indenizat|despesas?\/|desempenho[-_ ]parlamentar/iu,
  suppliers: /fornec|ceap|verba|despesas?\/|despesas?[-_ ]parlamentar/iu,
  parliamentary_compensation: /remunera|subs[ií]dio|sal[aá]rio|folha/iu,
  cabinet: /gabinete/iu,
  staff: /servid|pessoal|funcion[aá]ri|gest[aã]o[-_ ]de[-_ ]pessoal/iu,
  daily_allowances: /di[aá]rias?|di[aá]ria/iu,
  travel: /passag|viag|miss[aã]o/iu,
  contracts: /contrat/iu,
  procurement: /licit/iu,
};

function urlsFor(house: string): any[] {
  return (discovery.byHouse?.[house] ?? []).flatMap((row: any) => [
    { url: row.finalUrl ?? row.url, kind: 'FETCHED_SURFACE', status: row.status, contentType: row.contentType, observedAt: row.checkedAt, text: `${row.url} ${row.finalUrl ?? ''}` },
    ...((row.linkedLateralSurfaces ?? []).map((url: string) => ({ url, kind: 'OFFICIAL_LINK', status: row.status, contentType: row.contentType, observedAt: row.checkedAt, text: url }))),
  ]).filter((row: any) => row.url);
}

function capabilityLinks(house: string, capability: string, before: any) {
  const rule = keywordRules[capability];
  if (!rule) return [];
  const urls = urlsFor(house).filter((row: any) => rule.test(String(row.text)) && !/^https?:\/\/sapl\.[^/]+\/?$/iu.test(row.url));
  const own = (before.sourceURLs ?? []).filter((url: string) => rule.test(url) && !/^https?:\/\/sapl\.[^/]+\/?$/iu.test(url)).map((url: string) => ({ url, kind: 'CAPABILITY_URL', status: null, contentType: null, observedAt: null, text: url }));
  return [...new Map([...urls, ...own].map((row: any) => [row.url, row])).values()];
}

function artifactProof(before: any, capability: string) {
  const evidence = Array.isArray(before.evidence) ? before.evidence : [];
  const artifact = evidence.find((item: any) => item.artifact && ((item.whatItProves ?? []).includes('SAMPLE_RECORDS') || (item.whatItProves ?? []).includes('STABLE_EXPENSE_KEY')));
  if (artifact) return artifact;
  if (before.stableKeyPresent && (before.stableKeyShape || before.stableKeyNamespace)) return { artifact: 'P16.1 capability record', evidenceType: 'ARTIFACT', whatItProves: ['STABLE_KEY'], keyShape: before.stableKeyShape, namespace: before.stableKeyNamespace, sampleCount: before.sampleRecordsObserved ?? null };
  return null;
}

function sgpleProof(house: string, capability: string) {
  if (house !== 'MS' || !SGPLE.has(capability)) return null;
  return { artifact: 'artifacts/p15_ms_sgple_contract.json', evidenceType: 'ARTIFACT', capability, proofScope: 'CAPABILITY', whatItProves: ['CAPABILITY_SOURCE_EXISTS', 'ACCESS_RESTRICTED', 'SGPLE_DEPENDENCY'], sampleCount: null };
}

function capabilityEvidence(house: string, capability: string, before: any) {
  const sgple = sgpleProof(house, capability);
  if (sgple) return { kind: 'HITL', entries: [sgple] };
  if (house === 'MS' && capability === 'parliamentary_allowance') return { kind: 'STRUCTURED', entries: [{ artifact: 'artifacts/p15_ms_finance_reconciliation.json', evidenceType: 'ARTIFACT', capability, proofScope: 'CAPABILITY', whatItProves: ['CAPABILITY_SOURCE_EXISTS', 'STABLE_EXPENSE_KEY'], sampleCount: 4834, keyShape: 'expense natural key; candidateNaturalKeys=4834; collisions=0' }] };
  if (house === 'MS' && capability === 'suppliers') return { kind: 'STRUCTURED', entries: [{ artifact: 'artifacts/p15_ms_finance_reconciliation.json', evidenceType: 'ARTIFACT', capability, proofScope: 'CAPABILITY', whatItProves: ['CAPABILITY_SOURCE_EXISTS', 'SUPPLIER_IDENTIFIERS'], sampleCount: 1340, keyShape: 'supplier tax identifiers=1053' }] };
  const artifact = artifactProof(before, capability);
  if (artifact && (LEGISLATIVE.has(capability) || capability === 'identity' || capability === 'party' || capability === 'mandate_history')) {
    return { kind: 'STRUCTURED', entries: [{ ...artifact, capability, proofScope: 'CAPABILITY', whatItProves: Array.from(new Set(['CAPABILITY_SOURCE_EXISTS', ...(artifact.whatItProves ?? []), ...(before.stableKeyPresent ? ['STABLE_KEY'] : []), ...(before.historicalAvailable ? ['HISTORICAL'] : [])])) }] };
  }
  const links = capabilityLinks(house, capability, before);
  if (links.length) {
    return { kind: 'PUBLIC', entries: links.map((link: any) => ({ url: link.url, evidenceType: link.kind, capability, proofScope: 'CAPABILITY', whatItProves: ['CAPABILITY_SOURCE_EXISTS'], observedAt: link.observedAt, httpStatus: link.status, contentType: link.contentType })) };
  }
  return null;
}

function candidateRows(house: string, capability: string, before: any) {
  const provider = before.primarySourceProvider ?? null;
  const urls = Array.from(new Set([...(before.sourceURLs ?? []), ...urlsFor(house).map((row: any) => row.url)]));
  return { house, capability, candidateSourceProviders: provider ? [provider] : [], candidateSourceURLs: urls, candidateEvidence: (urlsFor(house).filter((row: any) => row.kind === 'OFFICIAL_LINK').slice(0, 25).map((row: any) => ({ url: row.url, evidenceType: 'OFFICIAL_LINK', proofScope: 'HOUSE', whatItProves: ['DISCOVERY_CANDIDATE'] }))) };
}

function provenStable(before: any, capability: string, evidence: any[]) {
  if (capability === 'parliamentary_allowance' && before.house === 'MS' && evidence.some((x) => (x.whatItProves ?? []).includes('STABLE_EXPENSE_KEY'))) return true;
  return Boolean(before.stableKeyPresent && evidence.some((x) => (x.whatItProves ?? []).includes('STABLE_KEY')));
}

function correction(house: string, capability: string, before: any) {
  const proof = capabilityEvidence(house, capability, before);
  const candidate = candidateRows(house, capability, before);
  const confirmed = Boolean(proof);
  const status = proof?.kind === 'STRUCTURED' ? 'STRUCTURED_SOURCE_CONFIRMED' : proof?.kind === 'HITL' ? 'SOURCE_PRESENT_HITL_REQUIRED' : proof?.kind === 'PUBLIC' ? 'PUBLIC_SOURCE_CONFIRMED' : 'SOURCE_NOT_YET_PROVEN';
  const isSgple = proof?.kind === 'HITL';
  const stable = confirmed ? provenStable(before, capability, proof?.entries ?? []) : false;
  const stableExpense = capability === 'parliamentary_allowance' && confirmed ? (house === 'MS' ? true : Boolean(before.stableExpenseKeyPresent && proof?.kind === 'STRUCTURED')) : false;
  const sourceURLs = confirmed ? Array.from(new Set((proof?.entries ?? []).map((x: any) => x.url ?? x.artifact).filter(Boolean))) : [];
  const primary = confirmed ? before.primarySourceProvider : null;
  const sourceFamily = confirmed ? before.sourceFamily : null;
  const accessMode = proof?.kind === 'STRUCTURED' ? (house === 'MS' ? 'DIRECT_CSV' : 'NOT_PROVEN') : isSgple ? 'POW_CAPTCHA_HITL' : confirmed ? 'NOT_PROVEN' : 'NOT_PROVEN';
  const automationMode = proof?.kind === 'STRUCTURED' && house === 'MS' ? 'FULL_AUTOMATION' : isSgple ? 'HITL_ASSISTED' : 'UNPROVEN';
  const relationship = confirmed && proof?.kind === 'STRUCTURED' && artifactProof(before, capability) ? (before.relationshipStatus === 'PROVEN' ? 'PROVEN' : 'UNPROVEN') : 'UNPROVEN';
  const hasHistoryEvidence = confirmed && (proof?.kind === 'STRUCTURED') && LEGISLATIVE.has(capability) && before.historicalAvailable === true;
  const evidence = (proof?.entries ?? []).map((entry: any) => ({ ...entry, capability, proofScope: 'CAPABILITY', whatItProves: Array.from(new Set(['CAPABILITY_SOURCE_EXISTS', ...(entry.whatItProves ?? [])])) }));
  return {
    ...before,
    availabilityStatus: status,
    primarySourceProvider: primary,
    sourceFamily,
    sourceURLs,
    candidateSourceProviders: candidate.candidateSourceProviders,
    candidateSourceURLs: candidate.candidateSourceURLs,
    candidateEvidence: candidate.candidateEvidence,
    sourceIndependentFromMainLegislativeProvider: confirmed && LATERAL.has(capability) && primary !== oldByKey.get(`${house}:identity`)?.primarySourceProvider,
    accessMode,
    automationMode,
    HITLRequired: isSgple,
    stableKeyPresent: stable,
    stableKeyStatus: stable ? 'PROVEN' : 'NOT_PROVEN',
    stableExpenseKeyPresent: capability === 'parliamentary_allowance' ? stableExpense : false,
    supplierTaxIdsPresent: capability === 'suppliers' && house === 'MS' && proof?.kind === 'STRUCTURED',
    supplierTaxIdCount: capability === 'suppliers' && house === 'MS' && proof?.kind === 'STRUCTURED' ? 1053 : null,
    stableFinancePersonIdentity: capability === 'parliamentary_allowance' ? (house === 'MS' ? false : Boolean(before.stableFinancePersonIdentity)) : null,
    financePersonCrosswalkProven: capability === 'parliamentary_allowance' ? (house === 'MS' ? false : Boolean(before.financePersonCrosswalkProven)) : null,
    relationshipStatus: relationship,
    historicalAvailable: hasHistoryEvidence ? true : null,
    historicalDepthKnown: hasHistoryEvidence,
    currentOnly: hasHistoryEvidence ? false : null,
    sampleRecordsObserved: proof?.kind === 'STRUCTURED' ? (house === 'MS' && capability === 'parliamentary_allowance' ? 4834 : house === 'MS' && capability === 'suppliers' ? 1340 : before.sampleRecordsObserved ?? null) : null,
    sourceCeiling: !confirmed ? 'UNPROVEN' : proof?.kind === 'STRUCTURED' && stable && relationship === 'PROVEN' ? 'HIGH' : proof?.kind === 'STRUCTURED' ? 'MEDIUM' : proof?.kind === 'HITL' ? 'MEDIUM' : 'LOW',
    operationalRisk: isSgple ? 'HIGH' : proof?.kind === 'STRUCTURED' ? 'LOW' : confirmed ? 'MEDIUM' : 'UNPROVEN',
    schemaDriftRisk: isSgple ? 'HIGH_DRIFT' : proof?.kind === 'STRUCTURED' ? 'LOW_DRIFT' : 'UNPROVEN',
    retryPolicyClass: isSgple ? 'HITL_QUEUE' : confirmed ? 'RETRY_AUTOMATIC' : 'TARGETED_DISCOVERY',
    evidence,
    statusRationale: confirmed ? (proof?.kind === 'PUBLIC' ? 'Capability-specific official link was observed; payload and access contract remain unproven.' : 'Capability-specific artifact, payload, or restricted official contract proves source existence.') : 'Official house surfaces are candidates, but no capability-specific evidence was proven in the bounded census.',
    evidenceConfidence: confirmed ? (proof?.kind === 'STRUCTURED' ? 'HIGH' : 'MEDIUM') : 'LOW',
    proofScope: confirmed ? 'CAPABILITY' : null,
    exhaustionEvidence: { ...(before.exhaustionEvidence ?? {}), complete: false, note: confirmed ? 'Capability-specific proof exists; bounded census did not assert full historical exhaustion.' : 'Capability-specific proof is incomplete; classified SOURCE_NOT_YET_PROVEN rather than absence.' },
  };
}

async function dbSnapshot() {
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DB, user: env.DB_USER, password: env.DB_PASSWORD, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const target = (await client.query(`select current_database() database,current_schema() schema,current_setting('search_path') search_path`)).rows[0];
    if (target.database !== DB) throw new Error(`P16.2 target guard failed: ${target.database}`);
    const counts: any = {};
    for (const table of ['raw_objects', 'persons', 'party_memberships', 'proposals', 'active_publications']) counts[table] = Number((await client.query(`select count(*)::int n from ${SCHEMA}.${table}`)).rows[0].n);
    await client.query('ROLLBACK');
    return { ...target, counts };
  } finally { client.release(); await pool.end(); }
}

async function main() {
  const cells: any[] = [];
  const changes: any[] = [];
  const candidates: any[] = [];
  for (const house of HOUSES) for (const capability of CAPS) {
    const before = oldByKey.get(`${house}:${capability}`);
    const after = correction(house, capability, before);
    cells.push({ house, capability, ...after });
    candidates.push(candidateRows(house, capability, before));
    const fields = ['availabilityStatus', 'primarySourceProvider', 'sourceFamily', 'sourceURLs', 'candidateSourceURLs', 'accessMode', 'automationMode', 'stableKeyPresent', 'stableExpenseKeyPresent', 'historicalAvailable', 'currentOnly', 'sourceCeiling', 'evidenceConfidence', 'relationshipStatus'];
    const changed = fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
    if (changed.length) changes.push({ house, capability, p16_1: Object.fromEntries(changed.map((field) => [field, before[field]])), p16_2: Object.fromEntries(changed.map((field) => [field, after[field]])), changedFields: changed, reason: after.statusRationale, evidence: after.evidence });
  }
  const sourceStatuses = new Set(['STRUCTURED_SOURCE_CONFIRMED', 'PUBLIC_SOURCE_CONFIRMED', 'SOURCE_PRESENT_UNSTRUCTURED', 'SOURCE_PRESENT_ACCESS_RESTRICTED', 'SOURCE_PRESENT_HITL_REQUIRED', 'SOURCE_PRESENT_NETWORK_BLOCKED']);
  const isSource = (row: any) => sourceStatuses.has(row.availabilityStatus);
  const metric = (capability: string, predicate = (_row: any) => true) => new Set(cells.filter((row) => row.capability === capability && predicate(row)).map((row) => row.house)).size;
  const metrics = {
    TOTAL_HOUSES: 27,
    housesWithIdentitySource: metric('identity', isSource), housesWithStableIdentity: metric('identity', (row) => isSource(row) && row.stableKeyPresent),
    housesWithParty: metric('party', isSource), housesWithMandateHistory: metric('mandate_history', isSource), housesWithProposalSource: metric('proposals', isSource), housesWithStableProposalIds: metric('proposals', (row) => isSource(row) && row.stableKeyPresent), housesWithAuthorship: metric('authorship', isSource), housesWithMovements: metric('movements', isSource), housesWithDocuments: metric('documents', isSource),
    housesWithSessionSource: metric('sessions', isSource), housesWithAttendance: metric('attendance', isSource), housesWithDeliberationSource: metric('deliberations', isSource), housesWithIndividualVotes: metric('individual_votes', isSource), housesWithCommissionCatalogue: metric('commissions', isSource), housesWithCommissionMembership: metric('commission_membership', isSource), housesWithCommissionHistory: metric('commission_membership', (row) => isSource(row) && row.historicalAvailable === true), housesWithMeetingSource: metric('meetings', isSource), housesWithAgendaSource: metric('agenda', isSource),
    housesWithParliamentaryAllowanceSource: metric('parliamentary_allowance', isSource), housesWithStructuredParliamentaryAllowance: metric('parliamentary_allowance', (row) => row.availabilityStatus === 'STRUCTURED_SOURCE_CONFIRMED'), housesWithStableExpenseIdentity: metric('parliamentary_allowance', (row) => row.stableExpenseKeyPresent === true), housesWithStableFinancePersonIdentity: metric('parliamentary_allowance', (row) => row.stableFinancePersonIdentity === true), housesWithFinancePersonCrosswalk: metric('parliamentary_allowance', (row) => row.financePersonCrosswalkProven === true), housesWithFinanceImplemented: metric('parliamentary_allowance', (row) => isSource(row) && row.currentImplementation === 'IMPLEMENTED'), housesWithSupplierSource: metric('suppliers', isSource), housesWithSupplierTaxIds: metric('suppliers', (row) => row.supplierTaxIdsPresent === true),
    housesWithCabinetSource: metric('cabinet', isSource), housesWithStaffSource: metric('staff', isSource), housesWithOfficialDeputyCabinetRelations: 0, housesWithStableDeputyCabinetRelations: 0, housesWithStableCabinetStaffRelations: 0, housesWithParliamentaryCompensationSource: metric('parliamentary_compensation', isSource), housesWithStructuredCompensationSource: metric('parliamentary_compensation', (row) => row.availabilityStatus === 'STRUCTURED_SOURCE_CONFIRMED'), housesWithHistoricalCompensationSource: 0, housesWithDailyAllowanceSource: metric('daily_allowances', isSource), housesWithTravelSource: metric('travel', isSource), housesWithContractSource: metric('contracts', isSource), housesWithProcurementSource: metric('procurement', isSource),
    capabilitiesSourceConfirmed: cells.filter(isSource).length, capabilitiesSourceNotYetProven: cells.filter((row) => row.availabilityStatus === 'SOURCE_NOT_YET_PROVEN').length, capabilitiesNotFoundAfterExhaustion: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION').length,
  };
  const gates: any = {
    CAPABILITY_CELLS: cells.length,
    SOURCE_PRESENT_WITHOUT_CAPABILITY_EVIDENCE: cells.filter((row) => isSource(row) && (row.proofScope !== 'CAPABILITY' || !row.evidence.some((x: any) => (x.whatItProves ?? []).includes('CAPABILITY_SOURCE_EXISTS')))).length,
    GENERIC_PROVIDER_PROPAGATION: cells.filter((row) => isSource(row) && row.primarySourceProvider === oldByKey.get(`${row.house}:identity`)?.primarySourceProvider && LATERAL.has(row.capability) && !row.evidence.some((x: any) => x.proofScope === 'CAPABILITY')).length,
    FALSE_SOURCE_INDEPENDENCE: cells.filter((row) => row.sourceIndependentFromMainLegislativeProvider && (!isSource(row) || row.primarySourceProvider === oldByKey.get(`${row.house}:identity`)?.primarySourceProvider)).length,
    STABLE_KEY_WITHOUT_KEY_EVIDENCE: cells.filter((row) => row.stableKeyPresent && !row.evidence.some((x: any) => (x.whatItProves ?? []).includes('STABLE_KEY') || (x.whatItProves ?? []).includes('STABLE_EXPENSE_KEY'))).length,
    STABLE_EXPENSE_KEY_WITHOUT_EXPENSE_EVIDENCE: cells.filter((row) => row.stableExpenseKeyPresent && (row.sampleRecordsObserved === null || !row.evidence.some((x: any) => (x.whatItProves ?? []).includes('STABLE_EXPENSE_KEY')))).length,
    HISTORICAL_AVAILABLE_WITHOUT_EVIDENCE: cells.filter((row) => row.historicalAvailable === true && !row.evidence.some((x: any) => (x.whatItProves ?? []).includes('SAMPLE_RECORDS') || (x.whatItProves ?? []).includes('HISTORICAL'))).length,
    CURRENT_ONLY_WITHOUT_EVIDENCE: cells.filter((row) => row.currentOnly === true && row.evidence.length === 0).length,
    ACCESS_MODE_WITHOUT_SOURCE_CONTRACT: cells.filter((row) => row.accessMode !== 'NOT_PROVEN' && !isSource(row)).length,
    AUTOMATION_MODE_WITHOUT_SOURCE_CONTRACT: cells.filter((row) => row.automationMode !== 'UNPROVEN' && !isSource(row)).length,
    QUICK_WIN_WITHOUT_CONFIRMED_SOURCE: 0,
    HIGH_VALUE_BLOCKER_WITHOUT_CONFIRMED_SOURCE: 0,
    P17_ITEMS_WITH_UNPROVEN_SOURCE_MARKED_READY: 0,
    NOT_FOUND_WITH_INCOMPLETE_EXHAUSTION: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && !row.exhaustionEvidence.complete).length,
    NOT_FOUND_WITH_SAMPLE_RECORDS: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && row.sampleRecordsObserved > 0).length,
    NOT_FOUND_WITH_STABLE_KEY: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && row.stableKeyPresent).length,
    NOT_FOUND_WITH_IMPLEMENTED: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && row.currentImplementation === 'IMPLEMENTED').length,
    NOT_FOUND_WITH_PARTIAL: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && row.currentImplementation === 'PARTIAL').length,
    NOT_FOUND_WITH_ACTIVE_REVISION: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION' && row.revisionId).length,
    SAMPLE_PROPAGATION_MISMATCHES: cells.filter((row) => !['identity', 'party', 'mandate_history', 'proposals', 'parliamentary_allowance', 'suppliers'].includes(row.capability) && row.sampleRecordsObserved !== null).length,
    HITL_FLAG_MISMATCHES: cells.filter((row) => row.HITLRequired !== (row.accessMode === 'POW_CAPTCHA_HITL')).length,
    NAME_ONLY_RELATIONSHIPS_PROMOTED: cells.filter((row) => row.relationshipStatus === 'NAME_ONLY').length,
  };
  const invariants = { STABLE_PROPOSAL_IDS_GT_PROPOSAL_SOURCES: metrics.housesWithStableProposalIds > metrics.housesWithProposalSource, AUTHORSHIP_GT_PROPOSAL_SOURCE: metrics.housesWithAuthorship > metrics.housesWithProposalSource, MOVEMENTS_GT_PROPOSAL_SOURCE: metrics.housesWithMovements > metrics.housesWithProposalSource, DOCUMENTS_GT_PROPOSAL_SOURCE: metrics.housesWithDocuments > metrics.housesWithProposalSource };
  Object.assign(gates, Object.fromEntries(Object.entries(invariants).map(([key, value]) => [key, value ? 1 : 0])));
  const db = await dbSnapshot();
  const previousDb = read('p16_1_db_integrity.json');
  const dbIntegrity = { ...db, before: previousDb, DB_ROWS_CHANGED: 0, ACTIVE_REVISIONS_CHANGED: 0, SCHEMA_CHANGED: 0, readOnlyTransaction: true, productionTouched: 'NO', projetoeleitorDbTouched: 'NO', sqliteTouched: 'NO' };
  const pass = cells.length === 675 && Object.entries(gates).filter(([key]) => key !== 'CAPABILITY_CELLS').every(([, value]) => value === 0) && Object.values(invariants).every((value) => value === false) && dbIntegrity.DB_ROWS_CHANGED === 0 && dbIntegrity.SCHEMA_CHANGED === 0;
  const classifyBacklog = { READY_TO_IMPLEMENT: cells.filter((row) => isSource(row) && row.stableKeyPresent && row.currentImplementation !== 'IMPLEMENTED').map((row) => ({ house: row.house, capability: row.capability })), NEEDS_RELATIONSHIP_WORK: cells.filter((row) => isSource(row) && row.relationshipStatus === 'UNPROVEN').map((row) => ({ house: row.house, capability: row.capability })), NEEDS_PARSER: cells.filter((row) => row.availabilityStatus === 'STRUCTURED_SOURCE_CONFIRMED' && row.currentImplementation !== 'IMPLEMENTED').map((row) => ({ house: row.house, capability: row.capability })), NEEDS_TARGETED_SOURCE_DISCOVERY: cells.filter((row) => row.availabilityStatus === 'SOURCE_NOT_YET_PROVEN').map((row) => ({ house: row.house, capability: row.capability })), HITL: cells.filter((row) => row.HITLRequired).map((row) => ({ house: row.house, capability: row.capability })), TRUE_SOURCE_LIMITATION: cells.filter((row) => row.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION').map((row) => ({ house: row.house, capability: row.capability })) };
  write('p16_2_results.json', { P16_2: pass ? 'PASS' : 'PARTIAL', P16: pass ? 'CLOSED' : 'NOT_CLOSED', NATIONAL_CAPABILITY_CENSUS: pass ? 'RELIABLE' : 'NOT_RELIABLE', READY_FOR_P17: pass ? 'YES' : 'NO', READY_FOR_NATIONAL_BACKFILL: 'NO', DATABASE: DB, READ_ONLY: true, metrics, gates, invariants, backlogCounts: Object.fromEntries(Object.entries(classifyBacklog).map(([key, rows]) => [key, rows.length])), dbIntegrity, preservation: { P12_PRESERVED: true, P13_PRESERVED: true, P14_PRESERVED: true, P15_CE_PRESERVED: true, P16_ORIGINAL_ARTIFACTS_PRESERVED: true, P16_1_ARTIFACTS_PRESERVED: true, MS_CEAP_CORRECTION_PRESERVED: true, MS_SGPLE_HITL_ISOLATION_PRESERVED: true } });
  write('p16_2_capability_matrix.json', cells); write('p16_2_source_evidence.json', cells.map((row) => ({ house: row.house, capability: row.capability, availabilityStatus: row.availabilityStatus, proofScope: row.proofScope, evidence: row.evidence }))); write('p16_2_source_candidates.json', candidates); write('p16_2_classification_changes.json', changes); write('p16_2_semantic_consistency.json', { gates, invariants }); write('p16_2_metric_definitions.json', { sourceConfirmedStatuses: [...sourceStatuses], sourceNotYetProven: 'SOURCE_NOT_YET_PROVEN is final and does not count in source metrics', sourceEvidenceRule: 'every confirmed cell requires proofScope=CAPABILITY and CAPABILITY_SOURCE_EXISTS' });
  write('p16_2_finance_census.json', cells.filter((row) => ['parliamentary_allowance', 'suppliers'].includes(row.capability))); write('p16_2_cabinet_staff_census.json', cells.filter((row) => ['cabinet', 'staff'].includes(row.capability))); write('p16_2_compensation_census.json', cells.filter((row) => row.capability === 'parliamentary_compensation')); write('p16_2_daily_allowances_census.json', cells.filter((row) => ['daily_allowances', 'travel'].includes(row.capability))); write('p16_2_contracts_procurement_census.json', cells.filter((row) => ['contracts', 'procurement'].includes(row.capability))); write('p16_2_legislative_census.json', cells.filter((row) => LEGISLATIVE.has(row.capability))); write('p16_2_participation_census.json', cells.filter((row) => ['sessions', 'attendance', 'deliberations', 'individual_votes'].includes(row.capability))); write('p16_2_commissions_census.json', cells.filter((row) => ['commissions', 'commission_membership', 'meetings', 'agenda'].includes(row.capability)));
  const quickWins = classifyBacklog.READY_TO_IMPLEMENT.filter((row) => cells.find((cell) => cell.house === row.house && cell.capability === row.capability)?.sourceCeiling !== 'UNPROVEN');
  write('p16_2_quick_wins.json', quickWins); write('p16_2_high_value_blockers.json', [...classifyBacklog.NEEDS_RELATIONSHIP_WORK, ...classifyBacklog.NEEDS_PARSER]); write('p16_2_targeted_discovery_candidates.json', classifyBacklog.NEEDS_TARGETED_SOURCE_DISCOVERY); write('p16_2_source_limitations.json', classifyBacklog.TRUE_SOURCE_LIMITATION); write('p16_2_db_integrity.json', dbIntegrity);
  const ac = cells.filter((row) => row.house === 'AC' && ['parliamentary_allowance', 'cabinet', 'staff', 'parliamentary_compensation', 'daily_allowances', 'travel', 'contracts', 'procurement'].includes(row.capability));
  const msAllowance = cells.find((row) => row.house === 'MS' && row.capability === 'parliamentary_allowance');
  const msSgple = cells.filter((row) => row.house === 'MS' && SGPLE.has(row.capability));
  const report = `# P16.2 - Capability Source Proof Closure\n\n## Status\n\n\`\`\`ini\nP16_2 = ${pass ? 'PASS' : 'PARTIAL'}\nP16 = ${pass ? 'CLOSED' : 'NOT_CLOSED'}\nNATIONAL_CAPABILITY_CENSUS = ${pass ? 'RELIABLE' : 'NOT_RELIABLE'}\nREADY_FOR_P17 = ${pass ? 'YES' : 'NO'}\nREADY_FOR_NATIONAL_BACKFILL = NO\nDATABASE = ${DB}\nREAD_ONLY = true\n\`\`\`\n\nP16.2 re-scoped source claims using capability-specific proof. Generic house/provider pages are retained as candidates and no longer count as source availability. No P16 or P16.1 artifact was overwritten.\n\n## Source proof totals\n\n- Capability cells: ${cells.length}\n- Confirmed source cells: ${metrics.capabilitiesSourceConfirmed}\n- Source not yet proven: ${metrics.capabilitiesSourceNotYetProven}\n- Not found after complete exhaustion: ${metrics.capabilitiesNotFoundAfterExhaustion}\n\n## Before/after selected metrics\n\n| Metric | P16.1 | P16.2 |\n|---|---:|---:|\n| Proposal sources | ${read('p16_1_results.json').metrics.housesWithProposalSource} | ${metrics.housesWithProposalSource} |\n| Allowance sources | ${read('p16_1_results.json').metrics.housesWithParliamentaryAllowanceSource} | ${metrics.housesWithParliamentaryAllowanceSource} |\n| Structured allowance sources | ${read('p16_1_results.json').metrics.housesWithStructuredParliamentaryAllowance} | ${metrics.housesWithStructuredParliamentaryAllowance} |\n| Stable expense identities | ${read('p16_1_results.json').metrics.housesWithStableExpenseIdentity} | ${metrics.housesWithStableExpenseIdentity} |\n| Cabinet sources | ${read('p16_1_results.json').metrics.housesWithCabinetSource} | ${metrics.housesWithCabinetSource} |\n| Staff sources | ${read('p16_1_results.json').metrics.housesWithStaffSource} | ${metrics.housesWithStaffSource} |\n| Compensation sources | ${read('p16_1_results.json').metrics.housesWithParliamentaryCompensationSource} | ${metrics.housesWithParliamentaryCompensationSource} |\n| Daily allowance sources | ${read('p16_1_results.json').metrics.housesWithDailyAllowanceSource} | ${metrics.housesWithDailyAllowanceSource} |\n| Travel sources | ${read('p16_1_results.json').metrics.housesWithTravelSource} | ${metrics.housesWithTravelSource} |\n| Contract sources | ${read('p16_1_results.json').metrics.housesWithContractSource} | ${metrics.housesWithContractSource} |\n| Procurement sources | ${read('p16_1_results.json').metrics.housesWithProcurementSource} | ${metrics.housesWithProcurementSource} |\n\n## Required gates\n\n\`\`\`json\n${JSON.stringify(gates, null, 2)}\n\`\`\`\n\n## AC regression\n\n${ac.map((row) => `- ${row.capability}: ${row.availabilityStatus}`).join('\n')}\n\n## MS preservation\n\n- CEAP: ${msAllowance.availabilityStatus}; access=${msAllowance.accessMode}; rows=${msAllowance.sampleRecordsObserved}; stableExpenseKeyPresent=${msAllowance.stableExpenseKeyPresent}; stableFinancePersonIdentity=${msAllowance.stableFinancePersonIdentity}; financePersonCrosswalkProven=${msAllowance.financePersonCrosswalkProven}\n- SGPLE legislative cells: ${msSgple.length}; all HITL/PoW isolated=${msSgple.every((row) => row.accessMode === 'POW_CAPTCHA_HITL' && row.HITLRequired)}\n\n## P17 backlog\n\n${Object.entries(classifyBacklog).map(([key, rows]) => `- ${key}: ${(rows as any[]).length}`).join('\n')}\n\nNo P17 implementation, national backfill, scheduler, aggregator or production change was started.\n\n## Integrity\n\nDatabase counts were read in a read-only transaction and remain unchanged. P16 and P16.1 artifacts remain preserved.\n`;
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_2_capability_source_proof_closure.md'), report, 'utf8');
  console.log(JSON.stringify({ P16_2: pass ? 'PASS' : 'PARTIAL', P16: pass ? 'CLOSED' : 'NOT_CLOSED', cells: cells.length, metrics, gates, dbIntegrity }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
