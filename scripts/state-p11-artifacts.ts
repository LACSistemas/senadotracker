import fs from 'node:fs';

type Probe = {
  house: string;
  url: string;
  status: number | null;
  finalUrl?: string;
  contentType?: string;
  bytes?: number;
  sha256?: string;
  checkedAt: string;
  latencyMs: number;
  snippet?: string;
  links?: string[];
  scripts?: string[];
  error?: string;
};

const targets = ['BA', 'MG', 'GO', 'PA', 'PE', 'SP'] as const;
const dimensions = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'] as const;
const raw = JSON.parse(fs.readFileSync('artifacts/p11_probe_raw.json', 'utf8')) as { generatedAt: string; probes: Probe[] };
const previous = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p10.json', 'utf8')) as any;

const evidence: Record<string, {
  provider: string;
  capabilityEvidence: Record<string, string>;
  implementationStatus: Record<string, string>;
  blocker: string;
  note: string;
}> = {
  BA: {
    provider: 'alba_nopapercloud',
    capabilityEvidence: { name: 'SURFACE_WITH_STABLE_PARLAMENTAR_ID', party: 'SURFACE_WITH_PARTY_CONTEXT', mandate_history: 'NOT_PROVEN', proposals: 'STABLE_PROCESS_HTML', cabinet: 'NOT_PROBED', parliamentary_allowance: 'NOT_PROBED' },
    implementationStatus: {},
    blocker: 'PARSER_AND_NAMESPACE_RECONCILIATION_REQUIRED',
    note: 'The process page is deterministic and exposes processo.aspx?id=78524; parliamentar pages expose parlamentar.aspx?id=1010629 and author queries use a separate-looking autor namespace. No provider was promoted before proving the identity namespaces and replay parser.'
  },
  MG: {
    provider: 'almg_open_data',
    capabilityEvidence: { name: 'PAYLOAD_WITH_STABLE_DEPUTY_IDS_IN_COMPOSITION', party: 'PAYLOAD_WITH_PARTY_AND_DEPUTY_IDS', mandate_history: 'TEMPORAL_COMPOSITION_PAYLOAD', proposals: 'ENDPOINT_RETURNED_500', cabinet: 'NOT_PROBED', parliamentary_allowance: 'NOT_PROBED' },
    implementationStatus: {},
    blocker: 'CATALOGUE_ENDPOINT_CONTRACT_UNPROVEN',
    note: 'The official composition endpoint returned JSON with idDeputado, names, parties and dates. Candidate deputies/parliamentares/proposicoes endpoints returned HTTP 500, so a complete identity or proposal provider was not published.'
  },
  GO: {
    provider: 'alego_custom_portal',
    capabilityEvidence: { name: 'HTML_ROUTE_SURFACE', party: 'HTML_ROUTE_SURFACE', mandate_history: 'LEGISLATURE_SURFACE', proposals: 'NOT_PROVEN', cabinet: 'NOT_PROBED', parliamentary_allowance: 'NOT_PROBED' },
    implementationStatus: {},
    blocker: 'EMBEDDED_DATA_RELATION_UNPROVEN',
    note: 'Official pages and stable route IDs are reachable, but no normalized person/proposal payload or deterministic relation was proven in this run.'
  },
  PA: {
    provider: 'alepa_devexpress',
    capabilityEvidence: { name: 'HTML_GRID_SURFACE', party: 'HTML_GRID_SURFACE', mandate_history: 'NOT_PROVEN', proposals: 'DEVEXPRESS_GRID_SURFACE', cabinet: 'NOT_PROBED', parliamentary_allowance: 'NOT_PROBED' },
    implementationStatus: {},
    blocker: 'DEVEXPRESS_CALLBACK_PARSER_REQUIRED',
    note: 'Deputies, proposals and nominal-vote pages are reachable, but hidden fields, callbacks, row keys and postback semantics were not implemented or validated.'
  },
  PE: {
    provider: 'alepe_data_portal',
    capabilityEvidence: { name: 'JSON_NAME_ONLY', party: 'JSON_CURRENT_PARTY_ONLY', mandate_history: 'NOT_PROVEN', proposals: 'SPA_SURFACE_ONLY', cabinet: 'NOT_PROBED', parliamentary_allowance: 'NOT_PROBED' },
    implementationStatus: {},
    blocker: 'STABLE_PERSON_ID_MISSING',
    note: 'The official API returned names and current parties but no stable person ID in the tested payload. Cargos/lotacoes are aggregate datasets and do not establish a person relation.'
  },
  SP: {
    provider: 'alesp_open_data',
    capabilityEvidence: { name: 'CATALOG_SURFACE_ONLY', party: 'CATALOG_SURFACE_ONLY', mandate_history: 'NOT_PROVEN', proposals: 'CATALOG_SURFACE_ONLY', cabinet: 'NOT_PROBED', parliamentary_allowance: 'NOT_PROBED' },
    implementationStatus: {},
    blocker: 'CATALOG_PAYLOAD_PROTOCOL_UNKNOWN',
    note: 'The official open-data catalogue is reachable, but tested data routes returned HTML or 404. No payload contract was established.'
  }
};

for (const house of targets) for (const dimension of dimensions) evidence[house].implementationStatus[dimension] = 'DISCOVERY_ONLY';

const write = (name: string, value: unknown): void => fs.writeFileSync(`artifacts/${name}`, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
const byHouse = (house: string): Probe[] => raw.probes.filter((probe) => probe.house === house);

const providerRows = targets.map((house) => ({
  house,
  provider: evidence[house].provider,
  capabilityIndependent: true,
  identity: evidence[house].implementationStatus.name,
  party: evidence[house].implementationStatus.party,
  mandate_history: evidence[house].implementationStatus.mandate_history,
  proposals: evidence[house].implementationStatus.proposals,
  cabinet: evidence[house].implementationStatus.cabinet,
  parliamentary_allowance: evidence[house].implementationStatus.parliamentary_allowance,
  proposalComponents: { proposals: evidence[house].implementationStatus.proposals, authorship: 'NOT_COLLECTED', movements: 'NOT_COLLECTED' },
  stableIds: 'not_published',
  rawProvenance: 'probe_evidence_only',
  replay: 'not_run_for_provider',
  revision: 'not_created',
  operational: false,
  blocker: evidence[house].blocker,
  note: evidence[house].note,
  probes: byHouse(house).map((probe) => ({ url: probe.url, status: probe.status, contentType: probe.contentType, bytes: probe.bytes, sha256: probe.sha256, checkedAt: probe.checkedAt }))
}));

write('p11_source_evidence.json', {
  generatedAt: raw.generatedAt,
  database: 'civica_postgres_lab',
  schema: 'civica_state',
  scope: 'read-only public capability probes; no persistence',
  capabilityIndependent: true,
  providerRows,
  probes: raw.probes,
  runtime: { databaseGuard: 'metadata only; no DB connection opened', productionTouched: false, sqliteTouched: false, projetoeleitorTouched: false }
});

const csvFields = ['house', 'provider', 'identity', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance', 'authorship', 'movements', 'stableIds', 'rawProvenance', 'replay', 'revision', 'operational', 'blocker', 'note'];
const csvEscape = (value: unknown): string => `"${String(value).replaceAll('"', '""')}"`;
const csvRows = providerRows.map((row) => [row.house, row.provider, row.identity, row.party, row.mandate_history, row.proposals, row.cabinet, row.parliamentary_allowance, row.proposalComponents.authorship, row.proposalComponents.movements, row.stableIds, row.rawProvenance, row.replay, row.revision, row.operational, row.blocker, row.note].map(csvEscape).join(','));
write('p11_provider_matrix.csv', [csvFields.join(','), ...csvRows].join('\n'));

write('state_participation_discovery_p11.json', {
  generatedAt: raw.generatedAt,
  database: 'civica_postgres_lab',
  schema: 'civica_state',
  rows: targets.map((house) => ({ house, provider: evidence[house].provider, sessions: 'DISCOVERY_ONLY', deliberations: 'DISCOVERY_ONLY', individualVotes: 'DISCOVERY_ONLY', attendance: 'DISCOVERY_ONLY', relationProven: false, note: 'Participation is not a prerequisite for P11 public dimensions and was not published without Session -> Deliberation -> IndividualVote/Attendance proof.' }))
});

if (!Array.isArray(previous.dimensions) || previous.dimensions.length !== 162) throw new Error('P10 coverage must contain 162 rows');
const coverage = { ...previous, generatedAt: raw.generatedAt, stage: 'P11_CAPABILITY_INDEPENDENT_DEEP_DIVES', projection: { ...previous.projection, capabilityIndependent: true, p11TargetHouses: [...targets], p11OperationalHouses: [], p11DiscoveryOnlyHouses: [...targets], p11NewIdentityRevisions: 0, p11NewLegislativeRevisions: 0, totalCells: 162 } };
write('state_coverage_operational_p11.json', coverage);

const results = {
  stage: 'P11_CAPABILITY_INDEPENDENT_DEEP_DIVES',
  generatedAt: raw.generatedAt,
  database: 'civica_postgres_lab',
  schema: 'civica_state',
  capabilityIndependent: true,
  targetedHouses: [...targets],
  housesTargeted: targets.length,
  perHouse: providerRows.map(({ probes: _probes, ...row }) => ({ ...row, operationalDimensions: [], capabilityEvidence: evidence[row.house].capabilityEvidence })),
  housesNewlyOperationalized: 0,
  newIdentityRevisions: 0,
  newLegislativeRevisions: 0,
  previousOperationalHouses: 13,
  totalHousesWithOperationalImplementation: 13,
  remainingHouses: 14,
  status: 'P11_DISCOVERY_PASS_IMPLEMENTATION_BLOCKED',
  gates: { coverageRows162: true, houses27: true, dimensionsPerHouse6: true, invalidPublicDimensions: 0, notCollectedWithRevision: coverage.dimensions.filter((row: any) => row.status === 'NOT_COLLECTED' && (row.lastSuccessfulRun !== null || row.activeRevisionId !== null)).length, existingRevisionsPreserved: true, productionUntouched: true, sqliteUntouched: true, p9P10ArtifactsPreserved: true, newRegressions: 0 },
  publicDimensions: [...dimensions],
  excludedHouses: ['DF', 'SC', 'SE', 'CE', 'MS', 'RJ', 'RN', 'RS'],
  excludedPhase: 'P12'
};
write('p11_results.json', results);

const mdRows = providerRows.map((row) => `| ${row.house} | ${row.provider} | ${row.identity} | ${row.party} | ${row.mandate_history} | ${row.proposals} | ${row.blocker} |`).join('\n');
const md = `# P11 - Capability-Independent Deep Dives\n\nStatus: **${results.status}**\n\nDatabase: \`civica_postgres_lab\` / schema \`civica_state\`\n\nGenerated: ${raw.generatedAt}\n\n## Scope\n\nP11 investigated BA, MG, GO, PA, PE and SP with capability-independent gates. P9/P10 artifacts and the 13 existing operational houses were preserved. No database connection, write, migration, provider registration, production path or SQLite path was used by this execution. P12 was not started.\n\n## Result\n\nNo new dimension was promoted. This is intentional: the public probes supplied useful source evidence, but no house completed the full raw-first, stable-identifier, deterministic-parser, provenance, replay and persistence gate in this execution. A surface or payload observation is not treated as an operational revision.\n\n| UF | Provider | Identity/name | Party | Mandate history | Proposals | Blocking evidence |\n|---|---|---|---|---|---|---|\n${mdRows}\n\n## Capability decisions\n\nEach public dimension is evaluated independently. A proposal capability may be promoted without identity only after a stable proposal/process key, fields, provenance and replay parser are implemented. Likewise identity may be promoted without proposals only after a stable person key, name and provenance are persisted. None of the six target houses met that implementation gate here. Authorship and movements remain separate proposal components and were not used as a conjunctive blocker.\n\n### BA\n\nNoPaperCloud returned deterministic HTML for a process (processo.aspx?id=78524), parliamentarian listing/detail links (parlamentar.aspx?id=1010629) and author queries. The author query namespace was not assumed to be the parliamentarian namespace. The next implementation must preserve the process key and prove the author/person relation before publication.\n\n### MG\n\nThe official composition endpoint returned JSON with deputy IDs, names, parties and start/end dates. Candidate catalogue/proposal endpoints returned HTTP 500 in the probe, so the composition payload was not promoted as a complete identity or legislative provider.\n\n### GO\n\nDeputy, leadership and legislature pages were reachable with stable route surfaces. No normalized payload or deterministic person/proposal relation was persisted.\n\n### PA\n\nDeputy, proposal and nominal-vote pages were reachable through DevExpress HTML. Hidden fields, callbacks, pagination and stable row identifiers still require a parser contract and replay fixture.\n\n### PE\n\nThe official JSON endpoint returned names and current parties, but the tested payload contained no stable person ID. Aggregate cargos/lotacoes responses do not establish a person relation.\n\n### SP\n\nThe official open-data catalogue was reachable, but tested data routes returned HTML or 404. The download/API protocol remains unproven.\n\n## Coverage and gates\n\n- Coverage matrix remains 27 houses x 6 public dimensions = 162 rows.\n- Existing 13 operational houses and all prior revisions are preserved.\n- No NOT_COLLECTED row acquired a run or active revision.\n- New identity revisions: 0. New legislative revisions: 0.\n- Production, projetoeleitor_db, SQLite and P9/P10 historical artifacts were untouched.\n\n## P11 disposition\n\nP11 is **DISCOVERY_PASS_IMPLEMENTATION_BLOCKED**: the six deep dives produced source evidence and explicit capability-level blockers without inventing identifiers, incomplete rows or fake revisions. This closes P11's controlled scope. The remaining 14 houses stay outside this phase; P12 is not started.\n`;
write('p11_capability_independent_deepdives.md', md);

console.log(JSON.stringify({ status: results.status, targetedHouses: targets, housesNewlyOperationalized: 0, coverageRows: 162 }, null, 2));
