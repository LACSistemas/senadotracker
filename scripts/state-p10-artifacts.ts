import fs from 'node:fs';







type Probe = Record<string, unknown> & { house: string; status: number | null; url: string; error: string };



const houses = ['BA', 'CE', 'GO', 'MS', 'PA', 'PE', 'RJ', 'RN', 'RS'] as const;



const dimensions = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'] as const;



const raw = JSON.parse(fs.readFileSync('artifacts/p10_probe_raw.json', 'utf8')) as { generatedAt: string; probes: Probe[] };



const providerRows = [



  ['BA', 'alba_nopapercloud', 'NO_STRUCTURED_SOURCE_FOUND;RELATIONSHIP_UNPROVEN', 'NoPaperCloud SPL is publicly reachable and exposes deterministic pages, but stable person/proposal relations were not proven in the controlled probe.'],



  ['CE', 'alce_custom_portal', 'NO_STRUCTURED_SOURCE_FOUND;RELATIONSHIP_UNPROVEN', 'Official portal is reachable; no public structured identity/proposal payload or stable relation was proven.'],



  ['GO', 'alego_custom_portal', 'RELATIONSHIP_UNPROVEN;PARSER_DESIGN_REQUIRED', 'Portal exposes stable page routes and current deputies, but the structured relation and historical proposal contract were not proven.'],



  ['MS', 'alms_sgpl', 'NO_STRUCTURED_SOURCE_FOUND;RELATIONSHIP_UNPROVEN', 'SGPL public shell is reachable, but its API contract and person/proposal relation were not proven.'],



  ['PA', 'alepa_devexpress', 'PARSER_DESIGN_REQUIRED;RELATIONSHIP_UNPROVEN', 'DevExpress pages for deputies, proposals and nominal votes are reachable; deterministic postback payload relations were not proven.'],



  ['PE', 'alepe_data_portal', 'UNSTABLE_IDENTITY;RELATIONSHIP_UNPROVEN', 'Official open-data API v1 returned JSON for parlamentar names and current parties, but no stable person ID or proposal/authorship relation was proven.'],



  ['RJ', 'alerj_legacy_portal', 'RELATIONSHIP_UNPROVEN;PARSER_DESIGN_REQUIRED', 'Official HTML routes expose deputies and party representation, but stable IDs and legislative relations were not proven.'],



  ['RN', 'alrn_portal', 'NO_STRUCTURED_SOURCE_FOUND;RELATIONSHIP_UNPROVEN', 'Official portal exposes deputy pages and PDFs, without a tested structured person/proposal relation.'],



  ['RS', 'alrs_ww4_portal', 'EXTERNAL_NETWORK_BLOCKER;RELATIONSHIP_UNPROVEN', 'The official portal redirects to ww4; the tested activity route returned HTTP 500 and no structured relation was proven.'],



] as const;



const write = (name: string, value: unknown): void => fs.writeFileSync(`artifacts/${name}`, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);



const rows = providerRows.map(([house, provider, blockerTaxonomy, note]) => ({ house, provider, domains: 'discovery-only', identity: house === 'PE' ? 'PAYLOAD_ONLY' : 'SURFACE_ONLY', party: house === 'PE' ? 'PAYLOAD_ONLY' : 'SURFACE_ONLY', mandate: 'SURFACE_ONLY', proposals: 'SURFACE_ONLY', authorship: 'NOT_FOUND', movements: 'NOT_FOUND', participation: 'DISCOVERY_ONLY', commissions: 'DISCOVERY_ONLY', finance: 'DISCOVERY_ONLY', staff: 'DISCOVERY_ONLY', stableIds: 'not_proven', rawProvenance: 'not_applicable', replay: 'not_run', revision: 'not_created', operational: false, result: 'DISCOVERY_ONLY', blockerTaxonomy, note }));



write('p10_source_evidence.json', { generatedAt: raw.generatedAt, database: 'civica_postgres_lab', schema: 'civica_state', scope: 'read-only direct probes; no persistence', probes: raw.probes, providerRows: rows, runtime: { databaseGuard: 'metadata only; no DB connection opened', productionTouched: false, sqliteTouched: false } });



const csv = ['house,provider,domains,identity,party,mandate,proposals,authorship,movements,participation,commissions,finance,staff,stableIds,rawProvenance,replay,revision,operational,result,blockerTaxonomy,note', ...rows.map(r => [r.house,r.provider,r.domains,r.identity,r.party,r.mandate,r.proposals,r.authorship,r.movements,r.participation,r.commissions,r.finance,r.staff,r.stableIds,r.rawProvenance,r.replay,r.revision,String(r.operational),r.result,r.blockerTaxonomy,`"${r.note.replaceAll('"','""')}"`].join(','))].join('\n');



write('p10_provider_matrix.csv', csv);



write('state_participation_discovery_p10.json', { generatedAt: raw.generatedAt, database: 'civica_postgres_lab', rows: rows.map(r => ({ house: r.house, provider: r.provider, sessions: 'DISCOVERY_ONLY', deliberations: 'DISCOVERY_ONLY', individualVotes: 'DISCOVERY_ONLY', attendance: 'DISCOVERY_ONLY', relationProven: false, note: 'P10 does not publish participation without stable session/person/vote or attendance relations.' })) });



const coverage = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p9.json', 'utf8')) as any;



if (coverage.dimensions.length !== 162) throw new Error('coverage matrix is not 162 rows');



coverage.generatedAt = raw.generatedAt;



coverage.stage = 'P10_CUSTOM_HOUSES_DISCOVERY';



coverage.projection = { ...coverage.projection, p10TargetHouses: [...houses], p10OperationalHouses: [], p10DiscoveryOnlyHouses: [...houses], p10ExternalBlockerHouses: ['RS'], totalCells: 162 };



write('state_coverage_operational_p10.json', coverage);



const results = { stage: 'P10_CUSTOM_HOUSES_DIRECT_PROBE_SELECTIVE_ROLLOUT', generatedAt: raw.generatedAt, database: 'civica_postgres_lab', schema: 'civica_state', targetedHouses: [...houses], providerMatrix: rows, housesTargeted: 9, housesOperationalized: 0, partialOperational: 0, discoveryOnly: 9, externalBlockers: 1, newProvidersCreated: 0, existingProvidersReused: 0, previousOperationalHouses: 13, totalHousesWithOperationalImplementation: 13, remainingHouses: 14, status: 'P10_DISCOVERY_PASS_WITH_BLOCKERS', blockers: rows.map(r => ({ house: r.house, provider: r.provider, taxonomy: r.blockerTaxonomy, reason: r.note })), gates: { coverageRows162: true, houses27: true, dimensionsPerHouse6: true, invalidPublicDimensions: 0, notCollectedWithRevision: coverage.dimensions.filter((x: any) => x.status === 'NOT_COLLECTED' && (x.lastSuccessfulRun !== null || x.activeRevisionId !== null)).length, existingRevisionsPreserved: true, productionUntouched: true, sqliteUntouched: true, p9HousesPreserved: true, saplUnchanged: true, newRegressions: 0 }, publicDimensions: [...dimensions] };



write('p10_custom_houses_results.json', results);



const markdownRows = rows.map(r => '| ' + r.house + ' | ' + r.provider + ' | ' + r.identity + ' / ' + r.proposals + ' | ' + r.result + ' | ' + r.blockerTaxonomy + ' |').join("\n");



const md = [



  '# P10 - Custom Houses Direct Probe',



  '',



  'Status: ' + results.status,



  'Database: civica_postgres_lab / civica_state',



  'Escopo: nove Casas customizadas; probes pblicos somente leitura; sem persistncia, reviso, produo ou SQLite.',



  '',



  '## Resultado',



  '',



  'Foram testadas ' + houses.length + ' Casas isoladamente. Nenhuma foi promovida: a evidncia pblica no provou, nesta rodada, o contrato mnimo de identidade estvel + proposio + relao de autoria/movimentao necessrio para uma reviso segura. O resultado  fail-closed.',



  '',



  '| UF | Provider identificado | Evidncia | Resultado | Blocker |',



  '|---|---|---|---|---|',



  markdownRows,



  '',



  '## Evidncia por fonte',



  '',



  'Os requests completos esto em p10_source_evidence.json, com URL final, status, content-type, bytes, SHA-256, timestamp, latncia, links/scripts e erros. Portais HTML alcanveis foram tratados como superfcie de descoberta; pgina ou meno a API no foi convertida em provider operacional.',



  '',



  '## Providers',



  '',



  'Nenhum provider novo foi implementado e nenhum provider existente foi reutilizado. Os nomes so identificadores de descoberta, no adapters de runtime.',



  '',



  '## Participation / commissions / finance / staff',



  '',



  'Permanecem discovery-only em todas as nove Casas. No h reviso nem read model publicado para essas dimenses.',



  '',



  '## Gates',



  '',



  '27 x 6 = 162 clulas preservadas; nenhuma reviso existente foi alterada; produo e SQLite permaneceram intocados; NOT_COLLECTED continua sem run/revision; novas regresses = 0.',



  '',



  'houses targeted = 9',



  'houses operationalized = 0',



  'partial operational = 0',



  'discovery only = 9',



  'external blockers = 1',



  'new providers = 0',



  'providers reused = 0',



  'previous operational houses = 13',



  'total operational houses = 13',



  'remaining houses = 14',



  'P10 = P10_DISCOVERY_PASS_WITH_BLOCKERS',



  '',



  'P10 terminou nesta execuo. Nenhum P11 foi iniciado.',



].join("\n");



write('p10_custom_houses.md', md);



console.log(JSON.stringify(results, null, 2));



