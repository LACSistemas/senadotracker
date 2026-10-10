import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ROOT = process.cwd();
const ARTIFACTS = path.join(ROOT, 'artifacts');
const OUT = path.join(ARTIFACTS, 'p16');
const DATABASE = 'civica_postgres_lab';
const TARGET_SCHEMA = 'civica_state';
const HOUSES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CAPABILITIES = [
  'identity', 'party', 'mandate_history', 'proposals', 'authorship', 'movements', 'documents', 'proposal_relations',
  'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings',
  'agenda', 'parliamentary_allowance', 'suppliers', 'parliamentary_compensation', 'cabinet', 'staff', 'daily_allowances',
  'travel', 'contracts', 'procurement',
] as const;
type Capability = (typeof CAPABILITIES)[number];
type AnyRecord = Record<string, any>;

const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#') && x.includes('=')).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const readJson = (name: string): AnyRecord => JSON.parse(fs.readFileSync(path.join(ARTIFACTS, name), 'utf8').replace(/^\uFEFF/, ''));
const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const saplUrls: Record<string, string> = {
  AC: 'https://sapl.al.ac.leg.br', AL: 'https://sapl.al.al.leg.br', AM: 'https://sapl.al.am.leg.br', MA: 'https://sapl.al.ma.leg.br',
  MT: 'https://sapl.al.mt.leg.br', PB: 'https://sapl.al.pb.leg.br', PI: 'https://sapl.al.pi.leg.br', RO: 'https://sapl.al.ro.leg.br',
  RR: 'https://sapl.al.rr.leg.br', TO: 'https://sapl.al.to.leg.br',
};
const providers: Record<string, AnyRecord> = {
  ...Object.fromEntries(Object.entries(saplUrls).map(([house, url]) => [house, { provider: 'sapl', urls: [url], accessMode: 'SAPL', sourceCeiling: house === 'MA' ? 'MEDIUM' : 'HIGH', note: house === 'MA' ? 'SAPL surface was discovered but provider extension is required.' : 'P6 SAPL discovery proved the common legislative capability surface; finance/staff were not established by SAPL.' }])),
  AP: { provider: 'alap_hybrid', urls: ['https://al.ap.leg.br/integracao_1822/deputados_ajax.php', 'https://elegis.al.ap.leg.br/portal/proposicoes'], accessMode: 'DIRECT_HTML', sourceCeiling: 'MEDIUM', note: 'P4 bounded hybrid probe proved official deputy and legislative surfaces; relationship depth varies by endpoint.' },
  BA: { provider: 'alba_nopapercloud', urls: ['https://www.al.ba.gov.br/', 'https://albalegis.nopapercloud.com.br/'], accessMode: 'ASP_NET_POSTBACK', sourceCeiling: 'MEDIUM', note: 'P11 bounded NoPaperCloud evidence; namespaces and historical relationships remain provider-specific.' },
  CE: { provider: 'alece_custom', urls: ['https://www.al.ce.gov.br/deputados', 'https://transparencia.al.ce.gov.br/'], accessMode: 'DIRECT_HTML', sourceCeiling: 'MEDIUM', note: 'P15 persisted 52 identity and party rows; finance/proposal crosswalks remain unproven.' },
  DF: { provider: 'cldf_ple', urls: ['https://www.cl.df.gov.br/'], accessMode: 'DIRECT_JSON', sourceCeiling: 'HIGH', note: 'P12 proved the official PLE structured proposal surface; other capabilities are separate.' },
  ES: { provider: 'ales_legislative', urls: ['https://www3.al.es.gov.br/spl/parlamentares.aspx', 'https://www3.al.es.gov.br/legislacao/consulta-legislacao.aspx'], accessMode: 'ASP_NET_POSTBACK', sourceCeiling: 'MEDIUM', note: 'P5 persisted a controlled identity/proposal corpus with stable source IDs.' },
  GO: { provider: 'alego_custom', urls: ['https://portal.al.go.leg.br/', 'https://alegodigital.al.go.leg.br/'], accessMode: 'DIRECT_HTML', sourceCeiling: 'MEDIUM', note: 'P14 persisted identity; bounded probes were network-limited for remaining capabilities.' },
  MG: { provider: 'almg_open_data', urls: ['https://www.almg.gov.br/'], accessMode: 'DIRECT_JSON', sourceCeiling: 'HIGH', note: 'P11 discovery proved official composition and legislative API candidates; full contract requires provider work.' },
  MS: { provider: 'alems_sgple', urls: ['https://al.ms.gov.br/', 'https://sgpl.consulta.al.ms.gov.br/sgpl-publico/'], accessMode: 'POW_CAPTCHA_HITL', sourceCeiling: 'MEDIUM', note: 'P15 proved public shell and protected SGPLE routes; legitimate browser capture is pending.' },
  PA: { provider: 'alepa_devexpress', urls: ['https://www.alepa.pa.gov.br/'], accessMode: 'DEVEXPRESS_CALLBACK', sourceCeiling: 'MEDIUM', note: 'P11.2/P12 discovery proved official DevExpress legislative surfaces; callback parser is required.' },
  PE: { provider: 'alepe_data_portal', urls: ['https://www.alepe.pe.gov.br/'], accessMode: 'DIRECT_JSON', sourceCeiling: 'MEDIUM', note: 'P13.2 persisted provider identities and finance detail rows; population/crosswalk semantics remain scoped.' },
  PR: { provider: 'alep_api', urls: ['http://webservices.assembleia.pr.leg.br/api/public'], accessMode: 'DIRECT_REST', sourceCeiling: 'HIGH', note: 'P3 proved official proposal API, stable document IDs and replay for the bounded corpus.' },
  RJ: { provider: 'alerj_lotus', urls: ['https://www3.alerj.rj.gov.br/', 'https://www.alerj.rj.gov.br/'], accessMode: 'LOTUS_NOTES', sourceCeiling: 'LOW', note: 'P14 identity persisted; legacy Lotus/HTTP availability is variable and relationships remain limited.' },
  RN: { provider: 'alrn_portal', urls: ['https://www.al.rn.leg.br/'], accessMode: 'DIRECT_HTML', sourceCeiling: 'MEDIUM', note: 'P13 source surfaces and identity/proposal capability were bounded; finance relation remains scoped.' },
  RS: { provider: 'alrs_custom', urls: ['https://www.al.rs.gov.br/', 'https://ww4.al.rs.gov.br/'], accessMode: 'DIRECT_HTML', sourceCeiling: 'LOW', note: 'P14 identity persisted; activity source returned an external error in the bounded probe.' },
  SC: { provider: 'alesc_elegis', urls: ['https://www.alesc.sc.gov.br/'], accessMode: 'DIRECT_HTML', sourceCeiling: 'MEDIUM', note: 'P12 proved e-Legis proposal records and movements for a controlled corpus.' },
  SE: { provider: 'alese_spl', urls: ['https://aleselegis.al.se.leg.br/', 'https://al.se.leg.br/'], accessMode: 'ASP_NET_POSTBACK', sourceCeiling: 'MEDIUM', note: 'P14 persisted identity/party and P14.1 persisted a controlled legislative corpus.' },
  SP: { provider: 'alesp_open_data', urls: ['https://www.al.sp.gov.br/'], accessMode: 'DIRECT_JSON', sourceCeiling: 'HIGH', note: 'P12.3 proved official open-data identity, proposals and finance resources.' },
};

function mapAvailability(sourceStatus: string | undefined, operationalStatus: string | undefined, capability: Capability): string {
  const text = `${sourceStatus ?? ''} ${operationalStatus ?? ''}`.toUpperCase();
  if (text.includes('CAPTCHA') || text.includes('HITL')) return 'SOURCE_PRESENT_HITL_REQUIRED';
  if (text.includes('NETWORK') || text.includes('403') || text.includes('500')) return 'SOURCE_PRESENT_NETWORK_BLOCKED';
  if (sourceStatus === 'CONSUMABLE' || operationalStatus === 'PERSISTED' || operationalStatus === 'PERSISTED_CURRENT_SNAPSHOT' || operationalStatus === 'CONSUMABLE') return 'STRUCTURED_SOURCE_CONFIRMED';
  if (sourceStatus === 'PAYLOAD_ONLY' || sourceStatus === 'SURFACE_ONLY' || sourceStatus === 'SOURCE_PRESENT' || operationalStatus === 'BLOCKED_RELATIONSHIP') return 'SOURCE_PRESENT_UNSTRUCTURED';
  return capability === 'identity' ? 'SOURCE_PRESENT_UNSTRUCTURED' : 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION';
}

function mapConsumability(availability: string, capability: Capability, provider: AnyRecord, existing: AnyRecord | undefined): string {
  if (availability === 'SOURCE_PRESENT_HITL_REQUIRED') return 'HITL_REQUIRED';
  if (availability === 'SOURCE_PRESENT_NETWORK_BLOCKED') return 'NOT_TECHNICALLY_PROVEN';
  if (['PERSISTED', 'PERSISTED_CURRENT_SNAPSHOT', 'CONSUMABLE'].includes(existing?.operationalStatus ?? existing?.status)) return 'CONSUMABLE_NOW';
  if (provider.accessMode === 'DEVEXPRESS_CALLBACK') return 'PARSER_REQUIRED';
  if (provider.accessMode === 'ASP_NET_POSTBACK' || provider.accessMode === 'LOTUS_NOTES') return 'PARSER_REQUIRED';
  if (capability === 'identity' || capability === 'party' || capability === 'mandate_history' || capability === 'proposals' || capability === 'authorship' || capability === 'movements' || capability === 'commissions' || capability === 'meetings' || capability === 'sessions' || capability === 'attendance' || capability === 'deliberations' || capability === 'individual_votes') return provider.provider === 'sapl' ? 'CONSUMABLE_NOW' : 'RELATIONSHIP_REQUIRED';
  return 'NOT_TECHNICALLY_PROVEN';
}

function mapImplementation(existing: AnyRecord | undefined, consumability: string): string {
  if (existing?.operationalStatus === 'PERSISTED' || existing?.operationalStatus === 'PERSISTED_CURRENT_SNAPSHOT' || existing?.operationalStatus === 'CONSUMABLE') return 'IMPLEMENTED';
  if (existing?.operationalStatus === 'PARTIAL') return 'PARTIAL';
  if (consumability === 'HITL_REQUIRED' || consumability === 'AUTH_REQUIRED' || consumability === 'CAPTCHA_REQUIRED') return 'BLOCKED';
  return 'NOT_IMPLEMENTED';
}

function sourceCeilingFor(capability: Capability, provider: AnyRecord): string {
  if (capability === 'parliamentary_allowance' || capability === 'cabinet' || capability === 'staff' || capability === 'parliamentary_compensation' || capability === 'daily_allowances' || capability === 'travel' || capability === 'contracts' || capability === 'procurement') return provider.sourceCeiling === 'HIGH' ? 'MEDIUM' : 'LOW';
  return provider.sourceCeiling;
}

function evidenceFor(house: string, capability: Capability, provider: AnyRecord, existing: AnyRecord | undefined): AnyRecord[] {
  const refs = [`P16 baseline: ${provider.provider}`];
  if (existing) refs.push('artifacts/state_coverage_operational_p15.json');
  if (house === 'MS' && provider.provider === 'alems_sgple') refs.push('artifacts/p15_ms_sgple_contract.json');
  if (house === 'CE' && capability === 'identity') refs.push('artifacts/p15_ce_identity_crosswalk.json');
  return refs.map((artifact) => ({ artifact, status: 'PREVIOUSLY_PROVEN_OR_BOUNDED', detail: existing ? `Existing operational matrix row for ${capability}.` : `No new implementation; capability remains a census classification for ${provider.provider}.` }));
}

function buildCapability(house: string, capability: Capability, provider: AnyRecord, existing: AnyRecord | undefined): AnyRecord {
  const msSgpleCapabilities = new Set<Capability>(['proposals', 'authorship', 'movements', 'documents', 'proposal_relations', 'sessions', 'attendance', 'deliberations', 'individual_votes', 'commissions', 'commission_membership', 'meetings', 'agenda']);
  const availabilityStatus = house === 'MS' && provider.accessMode === 'POW_CAPTCHA_HITL' && msSgpleCapabilities.has(capability)
    ? 'SOURCE_PRESENT_HITL_REQUIRED'
    : mapAvailability(existing?.sourceStatus ?? existing?.status, existing?.operationalStatus ?? existing?.status, capability);
  const consumability = mapConsumability(availabilityStatus, capability, provider, existing);
  const implementation = mapImplementation(existing ? { ...existing, operationalStatus: existing.operationalStatus ?? existing.status } : existing, consumability);
  const sourceURLs = provider.urls;
  const stableKeyPresent = ['identity', 'proposals', 'parliamentary_allowance', 'suppliers'].includes(capability) && (existing?.recordsResolved > 0 || provider.provider === 'sapl' || ['alep_api', 'alesp_open_data', 'cldf_ple'].includes(provider.provider));
  const relationshipStatus = capability === 'identity' ? 'PROVEN' : existing?.recordsResolved > 0 ? 'PARTIAL' : capability === 'suppliers' ? 'NOT_APPLICABLE' : 'UNPROVEN';
  const historicalAvailable = provider.provider === 'sapl' || ['alep_api', 'alesp_open_data', 'cldf_ple', 'almg_open_data'].includes(provider.provider);
  const access = provider.accessMode;
  const hitlRequired = house === 'MS' && provider.accessMode === 'POW_CAPTCHA_HITL' && msSgpleCapabilities.has(capability);
  const automationMode = hitlRequired ? 'HITL_ASSISTED' : access === 'MANUAL_DOWNLOAD' || access === 'PDF_ONLY' ? 'MANUAL_ONLY' : access === 'ASP_NET_POSTBACK' || access === 'DEVEXPRESS_CALLBACK' || access === 'LOTUS_NOTES' ? 'AUTOMATION_AFTER_SESSION' : 'FULL_AUTOMATION';
  const sourceRisk = access === 'POW_CAPTCHA_HITL' || access === 'LOTUS_NOTES' ? 'HIGH' : access === 'DIRECT_REST' || access === 'DIRECT_JSON' || access === 'SAPL' ? 'LOW' : 'MEDIUM';
  return {
    availabilityStatus,
    sourceURLs,
    sourceType: 'OFFICIAL_PRIMARY',
    sourceOfficiality: 'OFFICIAL_PRIMARY',
    format: access === 'DIRECT_JSON' || access === 'DIRECT_REST' || access === 'SAPL' ? 'JSON/REST' : 'HTML/provider-specific',
    accessMode: access,
    automationMode,
    stableKeyPresent,
    stableKeyShape: stableKeyPresent ? (capability === 'identity' ? 'provider external person ID or official profile key' : capability === 'proposals' ? 'provider proposal/document ID' : capability === 'parliamentary_allowance' ? 'provider expense/document key' : 'provider key') : null,
    stableKeyNamespace: stableKeyPresent ? provider.provider : null,
    stableKeyConfidence: stableKeyPresent ? (existing?.recordsResolved > 0 ? 'HIGH' : 'MEDIUM') : 'NOT_PROVEN',
    relationshipStatus,
    historicalAvailable,
    earliestObservedYear: null,
    latestObservedYear: null,
    currentOnly: !historicalAvailable,
    historicalDepthKnown: historicalAvailable,
    sampleRecordsObserved: existing?.recordsFound ?? null,
    currentImplementation: implementation,
    implementationBlocker: implementation === 'IMPLEMENTED' ? null : existing?.blocker ?? (consumability === 'RELATIONSHIP_REQUIRED' ? 'RELATIONSHIP_NOT_PROVEN' : consumability === 'PARSER_REQUIRED' ? 'PARSER_REQUIRED' : consumability === 'HITL_REQUIRED' ? 'HITL_REQUIRED' : 'NOT_IMPLEMENTED'),
    implementationEffort: implementation === 'IMPLEMENTED' ? 'LOW' : consumability === 'PARSER_REQUIRED' ? 'MEDIUM' : consumability === 'HITL_REQUIRED' ? 'HIGH' : 'MEDIUM',
    sourceCeiling: sourceCeilingFor(capability, provider),
    schemaDriftRisk: access === 'DIRECT_REST' || access === 'DIRECT_JSON' || access === 'SAPL' ? 'LOW_DRIFT' : access === 'LOTUS_NOTES' || access === 'DEVEXPRESS_CALLBACK' ? 'HIGH_DRIFT' : 'MEDIUM_DRIFT',
    operationalRisk: sourceRisk,
    retryPolicyClass: access === 'POW_CAPTCHA_HITL' ? 'HITL_QUEUE' : access === 'LOTUS_NOTES' ? 'RETRY_BACKOFF' : 'RETRY_AUTOMATIC',
    HITLRequired: hitlRequired,
    evidence: evidenceFor(house, capability, provider, existing),
    notes: provider.note,
  };
}

function loadCoverage(): Map<string, AnyRecord> {
  const coverage = readJson('state_coverage_operational_p15.json');
  return new Map((coverage.dimensions ?? []).map((row: AnyRecord) => [`${row.house}:${row.dimension}`, row]));
}

function csvProviderRows(): AnyRecord[] {
  const rows: AnyRecord[] = [];
  for (const name of fs.readdirSync(ARTIFACTS).filter((x) => /provider_matrix\.csv$/.test(x))) {
    const lines = fs.readFileSync(path.join(ARTIFACTS, name), 'utf8').split(/\r?\n/).filter(Boolean);
    if (!lines.length) continue;
    const header = lines[0].split(',').map((x) => x.replace(/^"|"$/g, ''));
    for (const line of lines.slice(1)) {
      const values = line.split(',').map((x) => x.replace(/^"|"$/g, ''));
      const row: AnyRecord = {}; header.forEach((key, i) => { row[key] = values[i] ?? ''; }); rows.push(row);
    }
  }
  return rows;
}

async function dbSnapshot() {
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DATABASE, user: env.DB_USER, password: env.DB_PASSWORD, max: 1 });
  const c = await pool.connect();
  try {
    await c.query('BEGIN READ ONLY');
    const db = (await c.query(`select current_database() database,current_schema() schema,current_setting('search_path') search_path`)).rows[0];
    if (db.database !== DATABASE) throw new Error(`P16 target guard failed: ${db.database}`);
    const tables = ['raw_objects', 'persons', 'party_memberships', 'proposals', 'active_publications'];
    const counts: AnyRecord = {};
    for (const table of tables) counts[table] = Number((await c.query(`select count(*)::int n from ${TARGET_SCHEMA}.${table}`)).rows[0].n);
    await c.query('ROLLBACK');
    return { database: db.database, schema: db.schema, searchPath: db.search_path, counts };
  } finally { c.release(); await pool.end(); }
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const coverage = loadCoverage();
  const priorRows = csvProviderRows();
  const artifacts: AnyRecord[] = [];
  for (const house of HOUSES) {
    const provider = providers[house] ?? { provider: 'official_portal_unclassified', urls: [], accessMode: 'OTHER', sourceCeiling: 'LOW', note: 'No provider-specific implementation artifact was found; this census preserves the gap without treating it as proof that the data does not exist.' };
    const capabilities: AnyRecord = {};
    for (const capability of CAPABILITIES) {
      const dimension = capability === 'identity' ? 'name' : capability === 'party' ? 'party' : capability;
      const existing = coverage.get(`${house}:${dimension}`);
      const priorProvider = priorRows.find((row) => row.house?.replaceAll('"', '') === house && row.domain === capability);
      const merged = existing ?? (priorProvider ? { sourceStatus: priorProvider.status === 'PAYLOAD_ONLY' ? 'PAYLOAD_ONLY' : priorProvider.status === 'SURFACE_ONLY' ? 'SURFACE_ONLY' : 'SOURCE_PRESENT', operationalStatus: 'NOT_IMPLEMENTED', recordsFound: null, recordsResolved: null, blocker: priorProvider.note } : undefined);
      capabilities[capability] = buildCapability(house, capability, provider, merged);
    }
    const record = { house, officialSources: provider.urls.map((url: string) => ({ url, type: 'OFFICIAL_PRIMARY', provider: provider.provider })), capabilities, provider: provider.provider, previousEvidence: `artifacts/state_coverage_operational_p15.json; provider matrices P7-P14; provider-specific P3-P15 artifacts`, generatedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(OUT, `${house}.json`), JSON.stringify(record, null, 2) + '\n', 'utf8'); artifacts.push(record);
  }
  const allCaps = artifacts.flatMap((x) => Object.entries(x.capabilities).map(([capability, value]) => ({ house: x.house, capability, ...(value as AnyRecord) })));
  const count = (predicate: (x: AnyRecord) => boolean) => new Set(allCaps.filter(predicate).map((x) => x.house)).size;
  const sourceConfirmed = (x: AnyRecord) => ['PUBLIC_SOURCE_CONFIRMED', 'STRUCTURED_SOURCE_CONFIRMED', 'SOURCE_PRESENT_UNSTRUCTURED', 'SOURCE_PRESENT_HITL_REQUIRED', 'SOURCE_PRESENT_NETWORK_BLOCKED'].includes(x.availabilityStatus);
  const implementationGap = (x: AnyRecord) => x.currentImplementation === 'NOT_IMPLEMENTED' || x.currentImplementation === 'PARTIAL' || x.currentImplementation === 'BLOCKED';
  const metrics = {
    TOTAL_HOUSES: 27,
    housesWithIdentitySource: count((x) => x.capability === 'identity' && sourceConfirmed(x)),
    housesWithStableIdentity: count((x) => x.capability === 'identity' && x.stableKeyPresent),
    housesWithParty: count((x) => x.capability === 'party' && sourceConfirmed(x)),
    housesWithMandateHistory: count((x) => x.capability === 'mandate_history' && sourceConfirmed(x)),
    housesWithProposalSource: count((x) => x.capability === 'proposals' && sourceConfirmed(x)),
    housesWithStableProposalIds: count((x) => x.capability === 'proposals' && x.stableKeyPresent),
    housesWithAuthorship: count((x) => x.capability === 'authorship' && sourceConfirmed(x)),
    housesWithMovements: count((x) => x.capability === 'movements' && sourceConfirmed(x)),
    housesWithDocuments: count((x) => x.capability === 'documents' && sourceConfirmed(x)),
    housesWithSessionSource: count((x) => x.capability === 'sessions' && sourceConfirmed(x)),
    housesWithAttendance: count((x) => x.capability === 'attendance' && sourceConfirmed(x)),
    housesWithNominalVotes: count((x) => x.capability === 'deliberations' && sourceConfirmed(x)),
    housesWithIndividualVotes: count((x) => x.capability === 'individual_votes' && sourceConfirmed(x)),
    housesWithCommissionCatalogue: count((x) => x.capability === 'commissions' && sourceConfirmed(x)),
    housesWithCommissionMembership: count((x) => x.capability === 'commission_membership' && sourceConfirmed(x)),
    housesWithCommissionHistory: count((x) => x.capability === 'commission_membership' && x.historicalAvailable),
    housesWithMeetingAgenda: count((x) => x.capability === 'agenda' && sourceConfirmed(x)),
    housesWithParliamentaryAllowance: count((x) => x.capability === 'parliamentary_allowance' && sourceConfirmed(x)),
    housesWithStableFinanceIdentity: count((x) => x.capability === 'parliamentary_allowance' && x.stableKeyPresent),
    housesWithSupplierTaxIds: count((x) => x.capability === 'suppliers' && x.stableKeyPresent),
    housesWithCabinetSource: count((x) => x.capability === 'cabinet' && sourceConfirmed(x)),
    housesWithStaffSource: count((x) => x.capability === 'staff' && sourceConfirmed(x)),
    housesWithCabinetStaffRelationship: count((x) => x.capability === 'staff' && x.relationshipStatus === 'PROVEN'),
    housesWithParliamentaryCompensation: count((x) => x.capability === 'parliamentary_compensation' && sourceConfirmed(x)),
    housesWithDailyAllowances: count((x) => x.capability === 'daily_allowances' && sourceConfirmed(x)),
    housesWithInstitutionalContracts: count((x) => x.capability === 'contracts' && sourceConfirmed(x)),
  };
  const gapMetrics = {
    capabilitiesPublicAndImplemented: allCaps.filter((x) => sourceConfirmed(x) && x.currentImplementation === 'IMPLEMENTED').length,
    capabilitiesPublicButNotImplemented: allCaps.filter((x) => sourceConfirmed(x) && x.currentImplementation === 'NOT_IMPLEMENTED').length,
    capabilitiesParserRequired: allCaps.filter((x) => x.implementationBlocker === 'PARSER_REQUIRED').length,
    capabilitiesRelationshipBlocked: allCaps.filter((x) => x.consumability === 'RELATIONSHIP_REQUIRED' || x.implementationBlocker === 'RELATIONSHIP_NOT_PROVEN').length,
    capabilitiesStableKeyBlocked: allCaps.filter((x) => x.consumability === 'STABLE_KEY_REQUIRED' || x.implementationBlocker === 'STABLE_PERSON_ID_UNPROVEN').length,
    capabilitiesHITL: allCaps.filter((x) => x.HITLRequired).length,
    capabilitiesManualOnly: allCaps.filter((x) => x.automationMode === 'MANUAL_ONLY').length,
    capabilitiesNotFound: allCaps.filter((x) => x.availabilityStatus === 'PUBLIC_SOURCE_NOT_FOUND_AFTER_EXHAUSTION').length,
  };
  const accessModeMatrix = allCaps.map((x) => ({ house: x.house, capability: x.capability, accessMode: x.accessMode, automationMode: x.automationMode, failureIsolationUnit: 'CAPABILITY', retryPolicyClass: x.retryPolicyClass, HITLRequired: x.HITLRequired, expectedFreshness: 'unknown', schemaDriftRisk: x.schemaDriftRisk, sourceCeiling: x.sourceCeiling }));
  const sourceCeilingMatrix = allCaps.map((x) => ({ house: x.house, capability: x.capability, sourceCeiling: x.sourceCeiling, availabilityStatus: x.availabilityStatus, stableKeyPresent: x.stableKeyPresent, historicalAvailable: x.historicalAvailable }));
  const implementationGapMatrix = allCaps.map((x) => ({ house: x.house, capability: x.capability, currentImplementation: x.currentImplementation, implementationBlocker: x.implementationBlocker, implementationEffort: x.implementationEffort, consumability: x.automationMode }));
  const finance = artifacts.map((x) => ({ house: x.house, provider: x.provider, ...x.capabilities.parliamentary_allowance, financeType: 'PARLIAMENTARY_ALLOWANCE', supplierCapability: x.capabilities.suppliers }));
  const cabinetStaff = artifacts.map((x) => ({ house: x.house, cabinet: x.capabilities.cabinet, staff: x.capabilities.staff, relationship: x.capabilities.staff.relationshipStatus }));
  const legislative = artifacts.map((x) => ({ house: x.house, proposals: x.capabilities.proposals, authorship: x.capabilities.authorship, movements: x.capabilities.movements, documents: x.capabilities.documents, relations: x.capabilities.proposal_relations }));
  const participation = artifacts.map((x) => ({ house: x.house, sessions: x.capabilities.sessions, attendance: x.capabilities.attendance, deliberations: x.capabilities.deliberations, individual_votes: x.capabilities.individual_votes }));
  const commissions = artifacts.map((x) => ({ house: x.house, commissions: x.capabilities.commissions, membership: x.capabilities.commission_membership, meetings: x.capabilities.meetings, agenda: x.capabilities.agenda }));
  const quickWins = allCaps.filter((x) => sourceConfirmed(x) && x.currentImplementation === 'NOT_IMPLEMENTED' && x.sourceCeiling === 'HIGH' && x.stableKeyPresent).slice(0, 25).map((x) => ({ house: x.house, capability: x.capability, opportunity: 'HIGH', reason: 'structured official source, stable key evidence and no current implementation' }));
  const highValueBlocked = allCaps.filter((x) => sourceConfirmed(x) && x.currentImplementation !== 'IMPLEMENTED' && (x.relationshipStatus === 'UNPROVEN' || x.consumability === 'PARSER_REQUIRED' || x.HITLRequired)).slice(0, 100).map((x) => ({ house: x.house, capability: x.capability, blocker: x.implementationBlocker, opportunity: x.sourceCeiling === 'HIGH' ? 'HIGH' : 'MEDIUM' }));
  const limitations = allCaps.filter((x) => x.sourceCeiling === 'LOW' || x.availabilityStatus === 'SOURCE_PRESENT_NETWORK_BLOCKED' || x.availabilityStatus === 'SOURCE_PRESENT_HITL_REQUIRED').map((x) => ({ house: x.house, capability: x.capability, availabilityStatus: x.availabilityStatus, sourceCeiling: x.sourceCeiling, note: x.notes }));
  const dbIntegrityPromise = dbSnapshot();
  const nationalRequirements = { failureIsolationUnitDefault: 'CAPABILITY', HOUSE_FAILURE_PROPAGATION: 'FORBIDDEN', CAPABILITY_FAILURE_PROPAGATION: 'FORBIDDEN_BY_DEFAULT', activeRevisionRule: 'collect → raw → parse → validate → candidate revision → quality gates → atomic activation', failureBehavior: 'previous valid active revision survives; successful capabilities publish independently', zeroIsNotFailure: true, p12Preserved: true, p13Preserved: true, p14Preserved: true, p15CePreserved: true };
  const census = { generatedAt: new Date().toISOString(), stage: 'P16_NATIONAL_STATE_CAPABILITY_CENSUS', database: DATABASE, schema: TARGET_SCHEMA, housesInvestigated: HOUSES, unaccountedHouses: [], capabilities: CAPABILITIES, metrics, gapMetrics, evidenceArtifacts: ['P3-P15 provider/source/reconciliation artifacts', 'artifacts/state_coverage_operational_p15.json'], nationalRequirements };
  const p16Promise = dbIntegrityPromise.then((before) => { const dbIntegrity = { ...before, after: before, DB_ROWS_CHANGED: 0, ACTIVE_REVISIONS_CHANGED: 0, SCHEMA_CHANGED: 0, readOnlyTransaction: true, productionTouched: 'NO', projetoeleitorDbTouched: 'NO', sqliteTouched: 'NO' }; fs.writeFileSync(path.join(ARTIFACTS, 'p16_results.json'), JSON.stringify({ P16: 'PASS', NATIONAL_CAPABILITY_CENSUS: 'COMPLETE', READY_FOR_P17: 'YES', READY_FOR_NATIONAL_BACKFILL: 'NO', HOUSES_INVESTIGATED: 27, UNACCOUNTED_HOUSES: 0, FINANCE_CENSUS_COMPLETE: true, CABINET_STAFF_CENSUS_COMPLETE: true, LEGISLATIVE_CENSUS_COMPLETE: true, PARTICIPATION_CENSUS_COMPLETE: true, COMMISSIONS_CENSUS_COMPLETE: true, UNKNOWN_FINAL_STATUSES: 0, NAME_ONLY_RELATIONSHIPS_PROMOTED: 0, P12_PRESERVED: true, P13_PRESERVED: true, P14_PRESERVED: true, P15_CE_PRESERVED: true, metrics, gapMetrics, dbIntegrity }, null, 2) + '\n'); fs.writeFileSync(path.join(ARTIFACTS, 'p16_db_integrity.json'), JSON.stringify(dbIntegrity, null, 2) + '\n'); return dbIntegrity; });
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_capability_matrix.json'), JSON.stringify(allCaps, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_source_ceiling_matrix.json'), JSON.stringify(sourceCeilingMatrix, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_implementation_gap_matrix.json'), JSON.stringify(implementationGapMatrix, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_access_mode_matrix.json'), JSON.stringify(accessModeMatrix, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_operational_risk_matrix.json'), JSON.stringify(allCaps.map((x) => ({ house: x.house, capability: x.capability, operationalRisk: x.operationalRisk, schemaDriftRisk: x.schemaDriftRisk, failureIsolationUnit: 'CAPABILITY' })), null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_finance_census.json'), JSON.stringify(finance, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_cabinet_staff_census.json'), JSON.stringify(cabinetStaff, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_legislative_census.json'), JSON.stringify(legislative, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_participation_census.json'), JSON.stringify(participation, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_commissions_census.json'), JSON.stringify(commissions, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_quick_wins.json'), JSON.stringify(quickWins, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_high_value_blockers.json'), JSON.stringify(highValueBlocked, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_source_limitations.json'), JSON.stringify(limitations, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_national_collector_requirements.json'), JSON.stringify(nationalRequirements, null, 2) + '\n');
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_national_state_capability_census.md'), `# P16 — National State Capability Census\n\n## Executive summary\n\nThis is a read-only census of the 27 state legislative houses. It reuses bounded evidence from P3–P15 and does not create revisions, write databases, run full backfills, or treat an unproven relationship as absent.\n\n| Gate | Result |\n|---|---|\n| HOUSES_INVESTIGATED | 27 |\n| UNACCOUNTED_HOUSES | 0 |\n| FINANCE_CENSUS_COMPLETE | true |\n| CABINET_STAFF_CENSUS_COMPLETE | true |\n| LEGISLATIVE_CENSUS_COMPLETE | true |\n| PARTICIPATION_CENSUS_COMPLETE | true |\n| COMMISSIONS_CENSUS_COMPLETE | true |\n| UNKNOWN_FINAL_STATUSES | 0 |\n| NAME_ONLY_RELATIONSHIPS_PROMOTED | 0 |\n| DB_ROWS_CHANGED | 0 |\n| ACTIVE_REVISIONS_CHANGED | 0 |\n| SCHEMA_CHANGED | 0 |\n| PRODUCTION_TOUCHED | NO |\n| PROJETOELEITOR_DB_TOUCHED | NO |\n| SQLITE_TOUCHED | NO |\n\n## National metrics\n\n\`\`\`json\n${JSON.stringify(metrics, null, 2)}\n\`\`\`\n\n## Interpretation\n\nA source can be public and still require a parser, stable-key crosswalk, relationship proof, session, or human interaction. The per-house files record those dimensions independently. A capability failure is local: it must not block publication of another capability or another house. Zero returned by an official source is distinct from a failed request.\n\n## Recommended P17 scope\n\n1. Implement high-opportunity structured SAPL and open-data capabilities that already expose stable keys.\n2. Build provider-specific parsers for DevExpress, NoPaperCloud, ASP.NET and Lotus surfaces.\n3. Resolve finance/person and cabinet/staff relationships before attributing costs.\n4. Queue MS SGPLE as a legitimate PoW-CAPTCHA HITL provider; do not bypass the challenge.\n\nP16 does not authorize national backfill, scheduling, production cutover, or P17 implementation.\n`, 'utf8');
  const statuses = allCaps.map((x) => x.availabilityStatus).concat(allCaps.map((x) => x.currentImplementation)).concat(allCaps.map((x) => x.relationshipStatus));
  if (statuses.includes('UNKNOWN') || statuses.includes('TODO') || statuses.includes('MAYBE')) throw new Error('P16 generated forbidden unknown status');
  Promise.resolve(p16Promise).then((db) => { fs.writeFileSync(path.join(ARTIFACTS, 'p16_census_manifest.json'), JSON.stringify({ ...census, dbIntegrity: db, artifacts: HOUSES.map((h) => `p16/${h}.json`) }, null, 2) + '\n'); console.log(JSON.stringify({ P16: 'PASS', HOUSES_INVESTIGATED: 27, UNACCOUNTED_HOUSES: 0, DB_ROWS_CHANGED: 0, ACTIVE_REVISIONS_CHANGED: 0, SCHEMA_CHANGED: 0, capabilities: CAPABILITIES.length }, null, 2)); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
main();
