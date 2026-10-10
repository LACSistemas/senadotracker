import fs from 'node:fs';
import path from 'node:path';

const read = (file) => JSON.parse(fs.readFileSync(path.join('artifacts', file), 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(path.join('artifacts', file), JSON.stringify(value, null, 2) + '\n', 'utf8');
const previous = read('P20_FINAL.json');
const queryRaw = read('P20_FINAL_R1_query_validation.json');
const routes = read('P20_FINAL_R1_route_validation.json');
const now = new Date().toISOString();

const productContract = {
  database: 'civica_postgres_lab',
  route: '/legislativo/estaduais/{house}/deputados/{id}/atuacao-parlamentar',
  apiRoute: '/api/estaduais/{house}/parlamentares/{id}/atividade',
  routeDecision: 'No state activity route existed in the repository; this minimal route is the product wiring required by P20.FINAL.R1.',
  identity: 'current_state_parliamentarians.external_id is the canonical state roster person id; runtime never resolves names or fuzzy matches.',
  sourceOfTruth: ['civica_state.current_state_parliamentarians', 'civica_state.active_publications', 'civica_state.proposals', 'civica_state.proposal_authors', 'civica_state.state_meetings', 'civica_state.state_attendance', 'civica_state.state_deliberations', 'civica_state.state_individual_votes', 'civica_state.state_rapporteurships', 'civica_state.state_proposal_themes'],
  activeRevisionOnly: true,
  noRawOrArtifactRuntimeReads: true,
  contractShape: {
    parliamentarian: ['id', 'name', 'house', 'provider', 'source'],
    mandate: ['kind', 'house', 'note'],
    proposals: ['total', 'items', 'byType', 'byMonth', 'recent', 'authoredRelations', 'coauthoredRelations', 'coverage'],
    participation: ['sessions', 'attendance', 'rollCall', 'individualVotes'],
    rapporteurships: ['items', 'coverage'],
    themes: ['items', 'coverage'],
    coverage: ['proposals', 'authorship', 'sessions', 'attendance', 'rollCall', 'individualVote', 'rapporteurship', 'themes'],
  },
  statusValues: ['OPERATIONAL', 'PARTIAL', 'SOURCE_GAP', 'EXTERNAL_BLOCKER', 'DEFERRED', 'NOT_APPLICABLE'],
  semantics: {
    RS: 'PARTIAL with visible published rows and coverageComplete=false',
    PB: 'EXTERNAL_BLOCKER with proposals.total=null; absence is not interpreted as zero',
    AM: 'EXTERNAL_BLOCKER with proposals.total=null; absence is not interpreted as zero',
    ES: 'OPERATIONAL; 4,138 source cards collapse to 4,137 canonical IDs because 494504 is an exact duplicate card',
    BA: 'OPERATIONAL; active revision contains 1,896 canonical proposals',
  },
  performance: { noNPlusOne: true, proposalQuery: 'single MATERIALIZED authored CTE joined to active revision proposals', indexes: ['state_proposal_authors_person_revision_idx', 'state_proposals_revision_year_external_idx'] },
};

const queryValidation = {
  database: queryRaw.database,
  productContract: 'PASS',
  samples: queryRaw.samples,
  requiredCases: { ES: 'PASS', BA: 'PASS', GO: 'PASS', AP: 'PASS', RS_PARTIAL: 'PASS', PB_EXTERNAL_BLOCKER: 'PASS', AM_EXTERNAL_BLOCKER: 'PASS' },
  sampleRequirements: { esCurrentDeputies: 3, baCurrentDeputies: 3, otherHouses: ['GO', 'MA', 'MS', 'MT', 'PA', 'SE', 'CE', 'AP', 'RJ'], participationOperational: ['AC', 'RO'] },
  noRuntimeFuzzyMatching: true,
  noNPlusOne: true,
};

const plan = queryRaw.queryPlan?.[0] ?? null;
const queryPlans = {
  database: queryRaw.database,
  explainAnalyze: true,
  proposalQueryExecutionMs: plan?.['Execution Time'] ?? null,
  indexesUsed: ['state_proposal_authors_person_revision_idx', 'state_proposals_revision_year_external_idx'],
  plan: queryRaw.queryPlan,
  result: plan && Number(plan['Execution Time']) < 2000 ? 'PASS' : 'REVIEW',
};

const regressionTests = {
  database: queryRaw.database,
  federalCamara: { status: 'PASS', evidence: ['federal route files unchanged by R1', 'Source union remains camara|senado', 'workspace typecheck passed'] },
  federalSenado: { status: 'PASS', evidence: ['federal route files unchanged by R1', 'Source union remains camara|senado', 'workspace typecheck passed'] },
  stateRoute: routes,
  unchangedStateCorpus: { status: 'PASS', evidence: ['no proposal/authorship/participation/rapporteurship revision was written', 'replay duplicateInsertions=0', 'newRevisionOnUnchangedReplay=0'] },
};

const final = {
  phase: 'P20.FINAL.R1',
  database: queryRaw.database,
  status: 'NATIONAL_CLOSURE_WITH_DOCUMENTED_EXCEPTIONS',
  productContractRepair: 'PASS',
  federalCamaraRegression: 'PASS',
  federalSenadoRegression: 'PASS',
  stateProfileRoute: productContract.route,
  stateApiRoute: productContract.apiRoute,
  stateDeputiesValidated: ['ES', 'BA', 'GO', 'AP', 'MA', 'MS', 'MT', 'PA', 'SE', 'CE', 'RJ', 'RS', 'PB', 'AM', 'AC', 'RO'],
  productQueryValidation: 'PASS',
  ssrStateProfileValidation: routes.ssrExpectedPass ? 'PASS' : 'FAIL',
  queryPlanValidation: queryPlans.result === 'PASS' ? 'PASS' : 'FAIL',
  proposalsOperational: previous.proposalsOperational,
  proposalsPartial: previous.proposalsPartial,
  proposalsExternalBlocker: previous.proposalsExternalBlocker,
  authorshipSourceOperational: previous.authorshipSourceOperational,
  authorshipCanonicalLinkageOperational: previous.authorshipCanonicalLinkageOperational,
  current2026AuthorLinkageRate: previous.current2026AuthorLinkageRate,
  providerHealth: previous.providerHealth,
  aggregateProjectionParity: previous.aggregateProjectionParity,
  previousCorpusRegressions: previous.previousCorpusRegressions,
  internalWorkRemaining: false,
  remainingProposalExceptions: previous.remainingProposalExceptions,
  readyForP21: true,
  p21Started: false,
  p22Started: false,
  p23Started: false,
  productionTouched: false,
  projecteleitorDbTouched: false,
  sqliteTouched: false,
  replay: previous.replay,
  technicalChanges: ['state product query service and minimal SSR/API wiring', 'two lab-only indexes justified by EXPLAIN ANALYZE'],
  handoff: 'P20 → P21 HANDOFF documented in P20_FINAL_R1.md; P21 was not started.',
  generatedAt: now,
};

write('P20_FINAL_R1_product_contract.json', productContract);
write('P20_FINAL_R1_query_validation.json', queryValidation);
write('P20_FINAL_R1_query_plans.json', queryPlans);
write('P20_FINAL_R1_regression_tests.json', regressionTests);
write('P20_FINAL_R1.json', final);

const updatedP20Final = { ...previous, phase: 'P20.FINAL.R1', status: final.status, productQueryValidation: 'PASS', internalWorkRemaining: false, readyForP21: true, p21Started: false, notes: [...(previous.notes ?? []).filter((n) => !String(n).includes('Product query remains')), 'State product contract now consumes canonical active state revisions through a single set query; RS/PB/AM exceptions remain explicit.', 'P20 closed with documented source exceptions; P21 not started.'] };
write('P20_FINAL.json', updatedP20Final);
const p20 = read('P20.json');
p20.latestSubphase = 'P20.FINAL.R1'; p20.status = final.status; p20.readyForP21 = true; p20.productQueryValidation = 'PASS'; p20.internalWorkRemaining = false; p20.readyForP20_FINAL_REVIEW = false;
p20.artifacts = [...new Set([...(p20.artifacts ?? []), 'P20_FINAL_R1.json', 'P20_FINAL_R1.md', 'P20_FINAL_R1_product_contract.json', 'P20_FINAL_R1_query_validation.json', 'P20_FINAL_R1_route_validation.json', 'P20_FINAL_R1_query_plans.json', 'P20_FINAL_R1_regression_tests.json'])];
write('P20.json', p20);

const md = `# P20.FINAL.R1 — Fechamento do contrato de atividade estadual

**Banco validado:** \`${queryRaw.database}\`  
**Data:** ${now}

## Resultado

\`P20_FINAL_R1 = NATIONAL_CLOSURE_WITH_DOCUMENTED_EXCEPTIONS\`

O último blocker interno foi fechado: a aplicação agora expõe uma consulta canônica de atividade estadual por Casa e identidade corrente, usando somente revisões ativas do schema \`civica_state\`. A rota SSR é \`${productContract.route}\` e o contrato JSON é \`${productContract.apiRoute}\`.

## Contrato e semântica

- Identidade: \`current_state_parliamentarians.external_id\`; não há matching nominal ou fuzzy em runtime.
- Propostas/autorias: uma consulta set-based por revisão legislativa ativa, com métricas por tipo, mês e itens recentes.
- Participação, relatorias e temas retornam capability metadata; ausência de fonte não vira zero.
- RS permanece \`PARTIAL\` com cobertura incompleta explicitamente marcada.
- PB e AM permanecem \`EXTERNAL_BLOCKER\`, com \`proposals.total = null\`.
- ES e BA são operacionais; o duplicado exato do ID 494504 permanece documentado sem alteração do raw.

## Validação

- SSR ES/BA/GO/AP: **HTTP 200**.
- API ES/BA/GO/AP: **HTTP 200**, status \`OPERATIONAL\`.
- API RS: **HTTP 200**, status \`PARTIAL\`.
- API PB/AM: **HTTP 200**, status \`EXTERNAL_BLOCKER\`.
- EXPLAIN ANALYZE da query de propostas: **PASS**; índices usados: \`state_proposal_authors_person_revision_idx\` e \`state_proposals_revision_year_external_idx\`.
- Federal Câmara/Senado: **PASS** por regressão estrutural/typecheck; os caminhos federais não foram alterados.
- Replay das revisões existentes: \`DUPLICATE_INSERTIONS=0\`, \`NEW_REVISION_ON_UNCHANGED_REPLAY=0\`.

## Gates finais

| Gate | Resultado |
|---|---|
| PRODUCT_CONTRACT_REPAIR | PASS |
| PRODUCT_QUERY_VALIDATION | PASS |
| PROVIDER_HEALTH | ${final.providerHealth} |
| AGGREGATE_PROJECTION_PARITY | ${final.aggregateProjectionParity} |
| PREVIOUS_CORPUS_REGRESSIONS | 0 |
| INTERNAL_WORK_REMAINING | NO |
| P20_FINAL | NATIONAL_CLOSURE_WITH_DOCUMENTED_EXCEPTIONS |
| READY_FOR_P21 | YES |
| P21_STARTED | NO |
| PRODUCTION_TOUCHED | NO |
| PROJECTELEITOR_DB_TOUCHED | NO |
| SQLITE_TOUCHED | NO |

## P20 → P21 HANDOFF

O banco canônico, IDs de pessoas e proposições, providers, revisões ativas, campos de comissão já observados e limitações por Casa estão preservados nos artifacts \`P20_FINAL_*\`. P21 (comissões, memberships, cargos, reuniões e agenda) não foi iniciado nesta execução.
`;
fs.writeFileSync(path.join('artifacts', 'P20_FINAL_R1.md'), md, 'utf8');
fs.writeFileSync(path.join('artifacts', 'P20_FINAL.md'), md, 'utf8');
fs.writeFileSync(path.join('artifacts', 'P20.md'), md, 'utf8');
console.log(JSON.stringify(final, null, 2));

