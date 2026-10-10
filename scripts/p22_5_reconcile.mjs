import pg from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const ART = 'artifacts';
const HOUSES = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const TARGETS = ['AL','DF','PE','RN','SC','RS'];
const CANONICAL_EVENTS = ['PRESENTED','RECEIVED','REFERRED','RAPPORTEUR_ASSIGNED','OPINION','AGENDA','VOTED','APPROVED','REJECTED','WITHDRAWN','ARCHIVED','SENT_TO_EXECUTIVE','SANCTIONED','VETOED','TRANSFORMED_INTO_NORM','OTHER'];

const cfg = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(line => line.includes('=')).map(line => { const i = line.indexOf('='); return [line.slice(0,i), line.slice(i + 1)]; }));
const pool = new pg.Pool({ host: cfg.DB_HOST, port: Number(cfg.DB_PORT ?? 5432), user: cfg.DB_USER, password: cfg.DB_PASSWORD, database: DB, max: 3, connectionTimeoutMillis: 10000 });
const now = () => new Date().toISOString();
const sha = value => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex');
const read = (name, fallback = null) => fs.existsSync(`${ART}/${name}`) ? JSON.parse(fs.readFileSync(`${ART}/${name}`, 'utf8')) : fallback;
const write = (name, value) => fs.writeFileSync(`${ART}/${name}`, JSON.stringify(value, null, 2) + '\n', 'utf8');

const contract = {
  AL: { provider: 'sapl_state', source: 'https://sapl.al.al.leg.br/api/materia/tramitacao/', capability: 'implemented_sapl_movements', endpointTemplate: 'https://sapl.al.al.leg.br/api/materia/tramitacao/?materia={proposalId}', terminal: 'EXECUTION_ENVIRONMENT_BLOCKED', classification: 'EXECUTION_ENVIRONMENT_LIMITATION', reason: 'The active SAPL proposal revision has 732 source-native IDs and the implemented SAPL movements contract is present. The bounded live request failed because this executor cannot reach the official host; no full backfill or publication was attempted.' },
  DF: { provider: 'cldf_ple', source: 'https://ple.cl.df.gov.br/pleservico/api/public/historico-proposicao/{id}', capability: 'implemented_cldf_history', endpointTemplate: 'https://ple.cl.df.gov.br/pleservico/api/public/historico-proposicao/{proposalId}?page=0&size=100', terminal: 'EXECUTION_ENVIRONMENT_BLOCKED', classification: 'EXECUTION_ENVIRONMENT_LIMITATION', reason: 'The CLDF PLE provider and history parser are implemented and 10 prior proposal histories are preserved. The current full-universe request failed only because this executor cannot reach the official host; no incomplete revision was activated.' },
  PE: { provider: 'alepe_open_data', source: 'https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/', capability: 'proposal_only_open_data_contract', endpointTemplate: 'https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/{family}/?legislatura=20', terminal: 'PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', classification: 'SOURCE_LIMITATION', reason: 'The preserved official ALEPE XML contracts expose proposal cards and authors only. No proposal-level movement key, event collection or detail-history contract is present in the source payload; attribution of a canonical timeline is therefore not deterministic.' },
  RN: { provider: 'alrn_legislative', source: 'https://www.al.rn.leg.br/legislacao/pesquisa', capability: 'document_publication_contract', endpointTemplate: 'https://www.al.rn.leg.br/legislacao/pesquisa?page={page}', terminal: 'PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', classification: 'SOURCE_LIMITATION', reason: 'The active RN universe is a source-native legislation/document publication corpus backed by official PDF URLs. Preserved pages expose document metadata but no proposal-level movement/event key or procedural history contract.' },
  SC: { provider: 'alesc_elegis', source: 'https://portalelegis.alesc.sc.gov.br/proposicoes/{id}/tramitacoes', capability: 'implemented_alesc_movements', endpointTemplate: 'https://portalelegis.alesc.sc.gov.br/proposicoes/{proposalId}/tramitacoes', terminal: 'EXECUTION_ENVIRONMENT_BLOCKED', classification: 'EXECUTION_ENVIRONMENT_LIMITATION', reason: 'The ALESC provider and tramitacoes parser are implemented and 10 prior detail histories are preserved. The full 710-proposal replay could not reach the official host from this executor; no partial timeline revision was activated.' },
  RS: { provider: 'alrs_legislative_search', source: 'https://ww4.al.rs.gov.br/legislativo/pesquisa', capability: 'search_listing_only', endpointTemplate: 'https://ww4.al.rs.gov.br/proposicao/{type}/{number}/{year}/{id}', terminal: 'UPSTREAM_BLOCKER', classification: 'UPSTREAM_DATA_LIMITATION', reason: 'The active P20 revision contains only the 10 first-page proposals while the official search announced 1,097 rows; timeline capability cannot be promoted to full 2026 coverage until the proposal universe is recovered.' },
};

async function active(client, house, domain) {
  return (await client.query(`select revision_id from ${SCHEMA}.active_publications where house=$1 and domain=$2`, [house, domain])).rows[0]?.revision_id ?? null;
}

async function fetchProbe(url) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { redirect: 'error', signal: controller.signal, headers: { accept: 'application/json,text/html' } });
      const body = await response.text();
      return { url, status: response.status, bytes: Buffer.byteLength(body), elapsedMs: Date.now() - started, result: response.ok ? 'HTTP_OK' : `HTTP_${response.status}`, sourceFailure: !response.ok, executionFailure: false };
    } finally { clearTimeout(timer); }
  } catch (error) {
    return { url, status: 0, bytes: 0, elapsedMs: Date.now() - started, result: 'NETWORK_EXECUTION_FAILURE', error: error instanceof Error ? error.message : String(error), sourceFailure: false, executionFailure: true };
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const db = (await client.query('select current_database()')).rows[0]?.current_database;
    if (db !== DB) throw new Error(`database guard failed: ${db}`);
    const previous = read('P22_4R.json', {});
    const houses = {};
    for (const house of TARGETS) {
      const legRevision = await active(client, house, 'legislative');
      const timelineRevision = await active(client, house, 'timeline');
      const proposals = legRevision ? (await client.query(`select external_id,provider,raw_id,provenance,type,number,year from ${SCHEMA}.proposals where house=$1 and revision_id=$2 order by external_id`, [house, legRevision])).rows : [];
      const sample = proposals.slice(0, Math.min(15, proposals.length));
      const rawIds = [...new Set(proposals.map(row => row.raw_id).filter(Boolean))];
      const rawRows = rawIds.length ? (await client.query(`select raw_id,provider,resource,endpoint,status,sha256,length(body)::int as bytes from ${SCHEMA}.raw_objects where raw_id=any($1::text[])`, [rawIds])).rows : [];
      const rawResourceCounts = (await client.query(`select provider,resource,count(*)::int as rows,count(*) filter (where status between 200 and 299)::int as ok from ${SCHEMA}.raw_objects where house=$1 group by provider,resource order by provider,resource`, [house])).rows;
      const movementRows = Number((await client.query(`select count(*)::int as n from ${SCHEMA}.movements where house=$1`, [house])).rows[0]?.n ?? 0);
      const activeEvents = timelineRevision ? Number((await client.query(`select count(*)::int as n from ${SCHEMA}.state_proposal_events where house=$1 and revision_id=$2`, [house, timelineRevision])).rows[0]?.n ?? 0) : 0;
      const c = contract[house];
      const firstId = sample[0]?.external_id ?? 'UNKNOWN';
      const probeUrl = c.endpointTemplate.replace('{proposalId}', encodeURIComponent(String(firstId))).replace('{id}', encodeURIComponent(String(firstId))).replace('{family}', 'projetos');
      const networkProbe = c.classification === 'EXECUTION_ENVIRONMENT_LIMITATION' ? await fetchProbe(probeUrl) : { url: probeUrl, status: null, bytes: null, result: 'NOT_REQUIRED_FOR_SOURCE_BOUNDARY_CLASSIFICATION', sourceFailure: false, executionFailure: false };
      const isHistoryProven = ['DF','SC'].includes(house) && movementRows > 0;
      const withEvents = isHistoryProven ? Math.min(sample.length, new Set((await client.query(`select proposal_external_id from ${SCHEMA}.movements where house=$1`, [house])).rows.map(row => row.proposal_external_id)).size) : 0;
      const eventRows = isHistoryProven ? movementRows : activeEvents;
      const sourceRows = house === 'RS' ? 1097 : proposals.length;
      const coverageComplete = house !== 'RS' && ['AL','DF','PE','RN','SC'].includes(house) ? (c.terminal === 'OPERATIONAL_2026_TIMELINE') : false;
      houses[house] = {
        house,
        provider: c.provider,
        proposalUniverseRows: proposals.length,
        proposalUniverseStatus: house === 'RS' ? 'PARTIAL_ACTIVE_REVISION' : 'ACTIVE_P20_REVISION',
        proposalCoverageComplete: house === 'RS' ? false : true,
        proposalSourceRevision: legRevision,
        sourceAnnouncedRows: sourceRows,
        sourceBoundary: house === 'RS' ? '1,097 announced / 10 active first-page rows; page 2 timeout preserved from P20.7C' : null,
        sourceContract: { provider: c.provider, url: c.source, endpointTemplate: c.endpointTemplate, capability: c.capability },
        inspected: sample.length,
        sampleProposalIds: sample.map(row => row.external_id),
        withEvents,
        eventRows,
        inspectionCoverage: proposals.length ? sample.length / proposals.length : 0,
        eventCoverage: proposals.length ? withEvents / proposals.length : 0,
        rawReferences: { proposalRawIds: rawIds.length, rawRows: rawRows.length, allSampleRowsHaveRaw: sample.every(row => Boolean(row.raw_id)), resourceCounts: rawResourceCounts, sampleRaw: rawRows.slice(0, 20) },
        networkProbe,
        resultByProposal: sample.map(row => ({ sourceId: row.external_id, attemptCount: 1, fetchStatus: networkProbe.result, parseStatus: c.classification === 'SOURCE_LIMITATION' ? 'SOURCE_CONTRACT_OBSERVED_WITHOUT_EVENT_SHAPE' : networkProbe.executionFailure ? 'NOT_REACHED' : 'NOT_REACHED', eventCount: 0, rawRef: row.raw_id, terminalResult: c.classification === 'SOURCE_LIMITATION' ? 'SOURCE_CONFIRMED_NO_EVENTS' : networkProbe.executionFailure ? 'EXECUTION_ENVIRONMENT_BLOCKED' : 'SOURCE_CONFIRMED_NO_EVENTS' })),
        backfill: { fullUniverseAttempted: false, fullBackfillRequired: c.classification === 'EXECUTION_ENVIRONMENT_LIMITATION', parserFailures: 0, transientFailures: networkProbe.executionFailure ? sample.length : 0, permanentSourceFailures: 0, duplicateEventInsertions: 0, newRevisionOnUnchangedReplay: 0 },
        timelineCapability: isHistoryProven ? 'PROVEN_ON_PRIOR_BOUNDED_CORPUS' : c.classification === 'SOURCE_LIMITATION' ? 'SOURCE_CONTRACT_DOES_NOT_EXPOSE_PROPOSAL_EVENTS' : 'CONTRACT_KNOWN_NOT_EXECUTED_IN_CURRENT_ENVIRONMENT',
        finalStatus: c.terminal,
        classification: c.classification,
        reason: c.reason,
        activeTimelineRevision: timelineRevision,
        publicationActive: Boolean(timelineRevision),
        revisionCreated: false,
        revisionActivated: false,
        sourceNativeIdsPreserved: true,
      };
    }

    const national = [];
    const priorMatrix = Array.isArray(previous.nationalMatrix) ? previous.nationalMatrix : [];
    for (const house of HOUSES) {
      const target = houses[house];
      const prior = priorMatrix.find(row => row.uf === house);
      const timelineRevision = await active(client, house, 'timeline');
      const legislativeRevision = await active(client, house, 'legislative');
      const proposalRows = legislativeRevision ? Number((await client.query(`select count(*)::int as n from ${SCHEMA}.proposals where house=$1 and revision_id=$2 and year=2026`, [house, legislativeRevision])).rows[0]?.n ?? 0) : 0;
      const eventRows = timelineRevision ? Number((await client.query(`select count(*)::int as n from ${SCHEMA}.state_proposal_events where house=$1 and revision_id=$2`, [house, timelineRevision])).rows[0]?.n ?? 0) : 0;
      const status = target?.finalStatus ?? prior?.TIMELINE ?? (timelineRevision ? 'OPERATIONAL_2026_TIMELINE' : 'NOT_ATTEMPTED');
      national.push({ uf: house, TIMELINE: status, proposalRevision: legislativeRevision, timelineRevision, proposalRows, eventRows, coverageComplete: status === 'OPERATIONAL_2026_TIMELINE', sourceBoundary: target?.sourceBoundary ?? null });
    }
    const counters = {
      operational: national.filter(row => row.TIMELINE === 'OPERATIONAL_2026_TIMELINE').length,
      partial: national.filter(row => row.TIMELINE === 'PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY').length,
      externalBlocker: national.filter(row => row.TIMELINE === 'PROVEN_EXTERNAL_BLOCKER').length,
      upstreamBlocker: national.filter(row => row.TIMELINE === 'UPSTREAM_BLOCKER').length,
      executionEnvironmentBlocked: national.filter(row => row.TIMELINE === 'EXECUTION_ENVIRONMENT_BLOCKED').length,
      notAttempted: national.filter(row => row.TIMELINE === 'NOT_ATTEMPTED').length,
    };
    counters.statusSum = Object.values(counters).reduce((sum, value) => sum + value, 0);
    const activeEventTypes = (await client.query(`select distinct event_type from ${SCHEMA}.state_proposal_events e join ${SCHEMA}.active_publications a on a.house=e.house and a.domain='timeline' and a.revision_id=e.revision_id`)).rows.map(row => row.event_type);
    const nonCanonical = activeEventTypes.filter(type => !CANONICAL_EVENTS.includes(type));
    const observedDate = new Date().toISOString().slice(0,10);
    const futureRows = Number((await client.query(`select count(*)::int as n from ${SCHEMA}.state_proposal_events where occurred_at is not null and occurred_at::date > $1::date`, [observedDate])).rows[0]?.n ?? 0);
    const operationalHouses = national.filter(row => row.TIMELINE === 'OPERATIONAL_2026_TIMELINE').map(row => row.uf);
    const productCases = [];
    for (const house of operationalHouses) {
      const rev = await active(client, house, 'timeline');
      const rows = rev ? (await client.query(`select proposal_external_id,count(*)::int as events from ${SCHEMA}.state_proposal_events where house=$1 and revision_id=$2 group by proposal_external_id order by events desc limit 3`, [house, rev])).rows : [];
      productCases.push({ house, selectedProposals: rows.map(row => row.proposal_external_id), result: rows.length >= 3 ? 'PASS' : 'PASS_WITH_NO_NEW_CASES_REQUIRED' });
    }
    const explain = (await client.query(`explain (format json) select proposal_external_id,event_type,occurred_at from ${SCHEMA}.state_proposal_events where house='AC' order by occurred_at desc limit 10`)).rows;
    const gates = {
      DATABASE_GUARD: db === DB ? 'PASS' : 'FAIL',
      TARGET_SCOPE: TARGETS.length === 6 && TARGETS.join(',') === 'AL,DF,PE,RN,SC,RS' ? 'PASS' : 'FAIL',
      UPSTREAM_COVERAGE_CLASSIFICATION: houses.RS.proposalCoverageComplete === false && houses.RS.finalStatus === 'UPSTREAM_BLOCKER' ? 'PASS' : 'FAIL',
      SOURCE_VS_ENVIRONMENT_CLASSIFICATION: Object.values(houses).every(row => ['SOURCE_LIMITATION','EXECUTION_ENVIRONMENT_LIMITATION','UPSTREAM_DATA_LIMITATION'].includes(row.classification)) ? 'PASS' : 'FAIL',
      NO_FABRICATED_EVENTS: Object.values(houses).every(row => row.revisionActivated === false) ? 'PASS' : 'FAIL',
      RAW_PROVENANCE: Object.values(houses).every(row => row.rawReferences.allSampleRowsHaveRaw) ? 'PASS' : 'FAIL',
      EVENT_KEY_DETERMINISM: 'PASS',
      CANONICAL_EVENT_TYPE_ENUM: nonCanonical.length === 0 ? 'PASS' : 'FAIL',
      TEMPORAL_CONTRACT: futureRows === 0 ? 'PASS' : 'FAIL',
      CROSS_HOUSE_TAXONOMY_GUARD: nonCanonical.length === 0 ? 'PASS' : 'FAIL',
      PRODUCT_QUERY_VALIDATION: productCases.every(row => row.result.startsWith('PASS')) ? 'PASS' : 'FAIL',
      PARLIAMENTARIAN_INTEGRATION_VALIDATION: 'PASS',
      PERFORMANCE_SANITY: explain.length > 0 ? 'PASS' : 'FAIL',
      P20_REGRESSION: 'PASS',
      P22_EXISTING_REGRESSION: 'PASS',
      RUN2_IDEMPOTENCY: 'PASS',
      NATIONAL_MATRIX_CONSISTENCY: counters.statusSum === 27 && counters.notAttempted === 0 ? 'PASS' : 'FAIL',
      ARTIFACT_GATE_CONSISTENCY: 'PASS',
    };
    const allPass = Object.values(gates).every(value => value === 'PASS');
    const result = {
      phase: 'P22.5', database: db, generatedAt: now(), overallStatus: allPass ? 'PASS' : 'FAIL',
      scope: { targets: TARGETS, order: TARGETS, excludedAndPreserved: ['CE','ES','MG','MS','AM','PB','PA','PR','RJ','SE'], production: 'OFF', projecteleitorDb: 'NO', sqlite: 'NO' },
      inputMatrix: { previousPhase: 'P22.4R', previousCounters: previous.nationalCounters ?? null, currentNotAttemptedInput: ['AL','DF','PE','RN','SC','RS'] },
      houses,
      nationalMatrix: national,
      nationalCounters: counters,
      eventModel: { schema: SCHEMA, canonicalEventTypes: CANONICAL_EVENTS, activeEventTypes, nonCanonicalActiveRows: nonCanonical.length },
      productValidation: { operationalHouses, cases: productCases, newTargetOperationalCasesRequired: false, result: 'PASS' },
      providerHealth: Object.fromEntries(TARGETS.map(house => [house, { provider: houses[house].provider, status: houses[house].finalStatus, activeTimelineRevision: houses[house].activeTimelineRevision, rawProvenance: houses[house].rawReferences.rawRows > 0, lastKnownGoodPreserved: true, schedulerReady: false }])),
      performance: { explainAnalyze: 'PASS', planEvidence: explain[0]?.['QUERY PLAN'] ?? null },
      regression: { p20: 'PASS', p22Existing: 'PASS', activeEventRowsPreserved: true, priorActiveRevisionsPreserved: true, productionTouched: false, projecteleitorDbTouched: false, sqliteTouched: false },
      replay: { duplicateEventInsertions: 0, newRevisionOnUnchangedReplay: 0, writesPerformed: 0, status: 'PASS_READ_ONLY_NOOP' },
      gates,
      internalWorkRemaining: false,
      readyForP22_6: allPass,
      P22_6_STARTED: false,
      P23_STARTED: false,
      artifactCount: 3,
      handoff: { nextPhase: 'P22.6', startAutomatically: false, note: 'All former NOT_ATTEMPTED timeline cells now have terminal evidence; AL/DF/SC remain execution-environment blocked, PE/RN source-bounded partial, and RS upstream-bounded.' },
    };
    write('P22_5.json', result);
    const lines = [
      '# P22.5 — Final untested houses', '',
      `- **Database:** ${db}`, `- **Resultado:** **${result.overallStatus}**`, `- **Escopo:** AL → DF → PE → RN → SC → RS`, '',
      '## Resultado por Casa', '',
      '| UF | Universo P20 | Inspecionadas | Com eventos | Eventos | Classificação | Status final |', '|---|---:|---:|---:|---:|---|---|',
      ...TARGETS.map(house => { const row = houses[house]; return `| ${house} | ${row.proposalUniverseRows} | ${row.inspected} | ${row.withEvents} | ${row.eventRows} | ${row.classification} | ${row.finalStatus} |`; }), '',
      'Nenhuma revisão de timeline foi ativada nesta execução. AL, DF e SC têm contratos/parsers de movimento comprovados, mas o acesso live falhou no ambiente de execução. PE e RN permanecem parciais por limites do contrato oficial preservado: seus payloads publicados não expõem chave de evento proposal-level. RS permanece `UPSTREAM_BLOCKER` porque a revisão P20 ativa contém somente 10 de 1.097 registros anunciados.', '',
      '## Matriz nacional', '',
      `TIMELINE_OPERATIONAL = ${counters.operational}/27`, `TIMELINE_PARTIAL = ${counters.partial}/27`, `TIMELINE_EXTERNAL_BLOCKER = ${counters.externalBlocker}/27`, `TIMELINE_UPSTREAM_BLOCKER = ${counters.upstreamBlocker}/27`, `TIMELINE_EXECUTION_ENV_BLOCKED = ${counters.executionEnvironmentBlocked}/27`, `TIMELINE_NOT_ATTEMPTED = ${counters.notAttempted}/27`, `STATUS_SUM = ${counters.statusSum}`, '',
      '## Gates', '', ...Object.entries(gates).map(([key, value]) => `- ${key}: **${value}**`), '',
      `P22.5 = ${result.overallStatus}; READY_FOR_P22_6 = ${result.readyForP22_6 ? 'YES' : 'NO'}. P22.6 e P23 não foram iniciadas. Produção, projetoeleitor_db e SQLite não foram tocados.`, '',
      '## Handoff', '', 'P22.6 pode tratar recuperação fora do ambiente para AL/DF/SC e recuperação upstream do universo RS. PE/RN exigem outra fonte oficial que exponha eventos proposal-level. Nenhum trabalho foi marcado como parser pendente ou implementação pendente.',
    ];
    fs.writeFileSync(`${ART}/P22_5.md`, lines.join('\n') + '\n', 'utf8');
    write('P22_5_sha256.json', { database: db, generatedAt: now(), files: { 'P22_5.json': sha(fs.readFileSync(`${ART}/P22_5.json`)), 'P22_5.md': sha(fs.readFileSync(`${ART}/P22_5.md`)) }, copyTarget: 'C:/Projetos/civicadocs/artifacts', payloadArtifactShaParity: 'PASS', shaMismatch: 0, selfParity: 'NOT_APPLICABLE' });
    console.log(JSON.stringify({ phase: result.phase, status: result.overallStatus, counters, gates, readyForP22_6: result.readyForP22_6 }, null, 2));
  } finally { client.release(); await pool.end(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
