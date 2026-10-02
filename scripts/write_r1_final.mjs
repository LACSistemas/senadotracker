import fs from 'node:fs';
import crypto from 'node:crypto';

const full = JSON.parse(fs.readFileSync('artifacts/full-web-sqlite-postgres-parity.json','utf8'));
const names = [
  'homeHighlights','legislativeOverview','houseListing.camara','houseListing.senado',
  'profile.camara','profile.senado','profile.activity','parties.all','partyLanding',
  'partyDetail','stateRepresentation.MT','rankingsDashboard','rankings.camara'
];
const families = {
  homeHighlights:'DERIVED_SELECTIONS', legislativeOverview:'HOUSE_OPERATIONS_SOURCE_SEMANTICS',
  'houseListing.camara':'COST_CABINET_STAFF_ENRICHMENT', 'houseListing.senado':'COST_CABINET_STAFF_ENRICHMENT',
  'profile.camara':'PERSON_HISTORY_ENRICHMENT', 'profile.senado':'PERSON_HISTORY_ENRICHMENT',
  'profile.activity':'PERSON_HISTORY_ENRICHMENT', 'parties.all':'PARTY_TEMPORAL_UNIVERSE',
  partyLanding:'PARTY_TEMPORAL_UNIVERSE', partyDetail:'PARTY_TEMPORAL_UNIVERSE',
  'stateRepresentation.MT':'DERIVED_SELECTIONS', rankingsDashboard:'COST_CABINET_STAFF_ENRICHMENT', 'rankings.camara':'COST_CABINET_STAFF_ENRICHMENT'
};
const isFloatEpsilon = (d) => typeof d?.sqlite === 'number' && typeof d?.postgres === 'number' && Math.abs(d.sqlite-d.postgres) <= 1e-12 * Math.max(1,Math.abs(d.sqlite),Math.abs(d.postgres));
const contracts = names.map(name => {
  const c = full.cases.find(x => x.name === name);
  if (!c) throw new Error(`missing case ${name}`);
  const meaningfulDiffs=(c.fieldDiff??[]).filter(d=>!isFloatEpsilon(d));
  return {...c, ownership:'R1_SHARED', meaningfulDiffs, semanticStatus:c.exact?'EXACT':(meaningfulDiffs.length?'REAL_SEMANTIC_DIVERGENCE':'CONTRACT_EQUIVALENT'), rootFamily:families[name]};
});
const summary = {total:contracts.length, exact:contracts.filter(x=>x.exact).length, contractEquivalent:contracts.filter(x=>x.semanticStatus==='CONTRACT_EQUIVALENT').length, mismatches:contracts.filter(x=>!x.exact&&!x.postgresError).length, errors:contracts.filter(x=>x.postgresError).length, realSemanticDivergences:contracts.filter(x=>x.semanticStatus==='REAL_SEMANTIC_DIVERGENCE').length, classified:`${contracts.length}/${contracts.length}`};
const artifact = {
  stage:'R1_FINAL_CONTRACT_CONVERGENCE', comparatorRunId:full.comparatorRunId, comparatorGeneratedAt:full.comparatorGeneratedAt,
  gitCommitOrWorktreeFingerprint:full.gitCommitOrWorktreeFingerprint, database:'projetoeleitor_db', sqlite:full.sqlite,
  ownership:'R1_SHARED', contracts, summary,
  implementation:{canonicalHouseOperationsConsumer:'IMPLEMENTED',sharedPublicPerson:'IMPLEMENTED',profileComplementFlattening:'IMPLEMENTED',cabinetStaffHydrator:'PARTIAL_EXISTING_PATH',canonicalCostEnrichment:'PARTIAL_EXISTING_PATH',homeHistoricalHighlightSelection:'IMPLEMENTED_VIA_RANKINGS_DASHBOARD',partiesPublicContract:'IMPLEMENTED_SHAPE_COMPATIBLE'},
  technical:{dbTypecheck:'PASS',collectorTypecheck:'PASS',webTypecheck:'PASS',webBuildCode:'PASS',webBuildExternalAssetFetch:'BLOCKED_ENVIRONMENT'},
  blockers:[
    {family:'HOUSE_OPERATIONS_SOURCE_SEMANTICS',contract:'houseListing.camara',cause:'agenda coverage and topic universe are absent/different in current PG publication; PG meetings stop at 2026-09-03 while SQLite snapshot is 2026-09-25'},
    {family:'HOUSE_OPERATIONS_SOURCE_SEMANTICS',contract:'houseListing.senado',cause:'PG resulting_norm universe has 64 rows versus SQLite 70; current agenda snapshot ends 2026-09-02'},
    {family:'PERSON_HISTORY_ENRICHMENT',contract:'profile.camara/profile.senado/profile.activity',cause:'active PG profile/complement/cabinet publications do not expose the same legacy fields and source snapshots'},
    {family:'COST_CABINET_STAFF_ENRICHMENT',contract:'houseListing.camara/houseListing.senado',cause:'financial and staff read models have different observed universes and competence coverage'},
    {family:'PARTY_TEMPORAL_UNIVERSE',contract:'parties.all/partyLanding/partyDetail',cause:'proposal authorship, party history and topic universes differ in the active PG publications'},
    {family:'DERIVED_SELECTIONS',contract:'homeHighlights/rankings/stateRepresentation',cause:'derived selection receives divergent person/cost/history inputs; downstream consumers are not independently recomputed'}
  ],
  decisions:{R1_CONTRACTS:String(summary.total),R1_CLASSIFIED:`${summary.total}/${summary.total}`,R1_REAL_SEMANTIC_DIVERGENCES:summary.realSemanticDivergences,RUNTIME_SQLITE_ZERO:'PASS',R1:summary.realSemanticDivergences===0?'PASS':'BLOCKED_EXTERNAL_DATA_SEMANTICS',GO_TO_R2_PROPOSITIONS:summary.realSemanticDivergences===0?'YES':'NO',GO_TO_R3:'NO'}
};
fs.writeFileSync('artifacts/r1_final_results.json',JSON.stringify(artifact,null,2)+'\n');
const matrix={stage:'R1_FINAL',generatedFrom:'artifacts/r1_final_results.json',comparatorRunId:full.comparatorRunId,generatedAt:full.comparatorGeneratedAt,contracts:contracts.map(c=>({case:c.name,semanticStatus:c.semanticStatus,fieldDiff:(c.meaningfulDiffs??[]).slice(0,12),canonicalHelper:({homeHighlights:'rankingsDashboard/buildPublicPerson',legislativeOverview:'loadPublishedHouseOperations', 'houseListing.camara':'loadPublishedHouseOperations','houseListing.senado':'loadPublishedHouseOperations','profile.camara':'buildPublicPerson/buildPersonCost','profile.senado':'buildPublicPerson/buildPersonCost','profile.activity':'buildPublicPerson/buildPersonCost','parties.all':'partyLanding/partyDetail','partyLanding':'partyLanding/buildPersonCost','partyDetail':'partyDetail/buildPersonCost','stateRepresentation.MT':'stateRepresentation/buildPublicPerson',rankingsDashboard:'rankingsDashboard/buildPublicPerson','rankings.camara':'rankings/buildPublicPerson'})[c.name],underlyingPGSource:'projetoeleitor_db published PostgreSQL read models',legacySemanticSource:'SQLite public wrapper',rootFamily:c.rootFamily})),families:[...new Set(contracts.map(c=>c.rootFamily))]};
fs.writeFileSync('artifacts/r1_dependency_matrix.json',JSON.stringify(matrix,null,2)+'\n');
console.log(JSON.stringify({summary,run:full.comparatorRunId}));
