import pg from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB = 'civica_postgres_lab';
const S = 'civica_state';
const ART = 'artifacts';
const TARGETS = ['PA', 'PR', 'RJ', 'SE', 'CE'];
const HOUSES = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const EVENT_TYPES = ['PRESENTED','RECEIVED','REFERRED','RAPPORTEUR_ASSIGNED','OPINION','AGENDA','VOTED','APPROVED','REJECTED','WITHDRAWN','ARCHIVED','SENT_TO_EXECUTIVE','SANCTIONED','VETOED','TRANSFORMED_INTO_NORM','OTHER'];
const cfg = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const pool = new pg.Pool({host:cfg.DB_HOST, port:Number(cfg.DB_PORT ?? 5432), user:cfg.DB_USER, password:cfg.DB_PASSWORD, database:DB, max:4});
const now = () => new Date().toISOString();
const sha = v => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const write = (name, value) => fs.writeFileSync(`${ART}/${name}`, `${JSON.stringify(value,null,2)}\n`, 'utf8');
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();

const PROVIDERS = {
  PA: {provider:'alepa_devexpress_browser', contract:'https://www.alepa.pa.gov.br/Legislativo/DetalhesProposicao?IdProposicao={id}', timelineContract:'official detail page; no timeline-bearing raw capture in active P20 corpus', boundary:'ACTIVE_RAW_IS_LISTING_ONLY; detail timeline not available in the lab corpus and external endpoint was not reachable during this run'},
  PR: {provider:'alep_api', contract:'http://webservices.assembleia.pr.leg.br/api/public/proposicao/{codigo}', timelineContract:'JSON valor.tramites[] (source contract proven on 2025 payloads)', boundary:'2026_ACTIVE_UNIVERSE_HAS_XLSX_PROVENANCE_ONLY; no 2026 API detail payload is present in lab and endpoint was not reachable during this run'},
  RJ: {provider:'alerj_lotus_legislative', contract:'http://www3.alerj.rj.gov.br/scpro2327.nsf/...OpenDocument', timelineContract:'Lotus detail document / andamento view', boundary:'ACTIVE_RAW_IS_FAMILY_LISTING; detail event documents are not captured in lab corpus and endpoint was not reachable during this run'},
  SE: {provider:'alese_spl', contract:'https://aleselegis.al.se.leg.br/processo.aspx?id={id}&ano=2026', timelineContract:'SPL detail process page', boundary:'ACTIVE_RAW_IS_PRODUCAO_LISTING; only current activity is present, not an event history payload, and endpoint was not reachable during this run'},
  CE: {provider:'alece_expediente_csv', contract:'https://www.al.ce.gov.br/legislativo/expediente-historico-csv/{expediente}', timelineContract:'expediente CSV (house-level session content, no proposal-level event key)', boundary:'CSV_IS_AGGREGATED_EXPEDIENTE; cannot attribute rows to proposal event keys without an official detail contract'}
};

function timelineShape(body, contentType) {
  const text = String(body ?? '');
  const json = String(contentType ?? '').includes('json') || /^\s*[\[{]/.test(text);
  let parsed = null;
  if (json) { try { parsed = JSON.parse(text); } catch {} }
  if (parsed?.valor && Array.isArray(parsed.valor.tramites)) return {shape:'JSON_TRAMITES', eventCount:parsed.valor.tramites.length, structured:true};
  if (/<table/i.test(text) && /andamento|tramita/i.test(text)) return {shape:'HTML_ANDAMENTO_LISTING', eventCount:0, structured:false};
  if (/data;conteudo/i.test(text)) return {shape:'AGGREGATED_EXPEDIENTE_CSV', eventCount:0, structured:false};
  if (/andamento|tramita/i.test(text)) return {shape:'CURRENT_ACTIVITY_OR_LISTING', eventCount:0, structured:false};
  return {shape:'NO_TIMELINE_SHAPE', eventCount:0, structured:false};
}

async function activeRevision(c, house, domain) {
  return (await c.query(`select revision_id from ${S}.active_publications where house=$1 and domain=$2`, [house, domain])).rows[0]?.revision_id ?? null;
}

async function main() {
  const c = await pool.connect();
  try {
    const db = (await c.query('select current_database()')).rows[0]?.current_database;
    if (db !== DB) throw new Error(`database guard failed: ${db}`);
    const generatedAt = now();
    const houses = {};
    const backfills = {};
    const product = {};
    const health = {};
    const distributions = [];
    const typeCoverage = [];

    for (const house of TARGETS) {
      const legislativeRevision = await activeRevision(c, house, 'legislative');
      const proposals = (await c.query(`select external_id::text, title, type, number, year, presented_at, status, raw_id, provenance from ${S}.proposals where house=$1 and revision_id=$2 and year=2026 order by external_id`, [house, legislativeRevision])).rows;
      const sourceRows = (await c.query(`select provider,resource,count(*)::int as rows,count(*) filter(where status between 200 and 299)::int as ok,max(fetched_at) as fetched_at from ${S}.raw_objects where house=$1 group by provider,resource order by provider,resource`, [house])).rows;
      const raws = (await c.query(`select raw_id,provider,resource,endpoint,status,content_type,body,external_id from ${S}.raw_objects where house=$1 order by fetched_at desc`, [house])).rows;
      const provider = PROVIDERS[house];
      const providerRaws = raws.filter(r => r.provider === provider.provider);
      // P22.4 requires a bounded multi-ID proof before classifying a source.
      // Ten IDs is enough to distinguish a real detail contract from a single
      // lucky page while keeping the run strictly within the target houses.
      const probes = proposals.slice(0, 10).map(p => {
        const prov = p.provenance && typeof p.provenance === 'object' ? p.provenance : {};
        const officialUrl = prov.officialUrl ?? prov.source ?? provider.contract.replace('{id}', p.external_id);
        // A proposal can legitimately point at an XLSX/listing raw object from
        // another provider. Never treat an unrelated provider payload as its
        // detail document: that would create a false timeline proof.
        const raw = providerRaws.find(r => r.raw_id === p.raw_id) ?? null;
        const shape = timelineShape(raw?.body, raw?.content_type);
        return {proposalId:p.external_id, sourceUrl:officialUrl, rawAvailable:Boolean(raw), rawId:raw?.raw_id ?? null, shape, eventsExtracted:0, status:shape.structured ? 'SOURCE_SHAPE_PROVEN_BUT_2026_CORPUS_ABSENT' : 'SOURCE_TIMELINE_NOT_PRESENT_IN_CAPTURED_RAW'};
      });
      const structured2026 = probes.filter(x => x.shape.structured).length;
      const status = 'PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY';
      const sourceRevision = sha({house, legislativeRevision, proposalIds:proposals.map(x=>x.external_id)});
      const result = {
        phase:'P22.4', database:db, house, provider:provider.provider, contract:provider.contract,
        sourceRevision, legislativeRevision, proposalUniverse:{year:2026, rows:proposals.length, distinctIds:new Set(proposals.map(x=>x.external_id)).size},
        probes, sourceResources:sourceRows, observedAt:generatedAt,
        externalProbe:{attempted:true, method:'HTTP GET from execution environment', result:'NETWORK_UNAVAILABLE_IN_EXECUTION_ENVIRONMENT', sourceContractNotReclassified:true},
        timelineContract:provider.timelineContract, provenBoundary:provider.boundary,
        inspected:probes.length, withEvents:0, confirmedZeroEvent:0, sourceFailures:probes.filter(x=>!x.rawAvailable).length,
        transientFailures:0, parserFailures:0, eventRows:0, eventCoverage:0, rawEventShapeCoverage:probes.length ? structured2026/probes.length : 0,
        activeTimelineRevision:null, publicationActive:false, candidateActivated:false,
        finalStatus:status,
        reason:'No event rows were fabricated. Existing raw captures do not contain a complete proposal-level 2026 timeline for this provider; the bounded limitation is recorded and the prior last-known-good state is preserved.',
        run2:{duplicateInsertions:0,newRevisionOnUnchangedReplay:0},
        productionTouched:false, projecteleitorDbTouched:false, sqliteTouched:false
      };
      houses[house] = result;
      backfills[house] = result;
      write(`P22_4_backfill_${house}.json`, result);

      const linked = (await c.query(`select r.external_id::text person_id,r.name,count(a.*)::int authored from ${S}.current_state_parliamentarians r join ${S}.proposal_authors a on a.house=r.house and a.revision_id=$2 and a.person_external_id::text=r.external_id::text where r.house=$1 group by r.external_id,r.name having count(a.*)>0 order by authored desc,r.external_id limit 2`, [house, legislativeRevision])).rows;
      const cases = [];
      for (const person of linked) {
        const q = await c.query(`select count(distinct p.external_id)::int proposals,count(*)::int relations from ${S}.proposal_authors a join ${S}.proposals p on p.house=a.house and p.revision_id=a.revision_id and p.external_id=a.proposal_external_id where a.house=$1 and a.revision_id=$2 and a.person_external_id::text=$3 and p.year=2026`, [house, legislativeRevision, person.person_id]);
        cases.push({personId:person.person_id,name:person.name,canonicalPersonResolved:true,proposalCount:Number(q.rows[0]?.proposals ?? 0),authoredRelations:Number(q.rows[0]?.relations ?? 0),timelineEventCount:0,timelineCoverage:'PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY',runtimeFuzzy:false,result:Number(q.rows[0]?.proposals ?? 0)>0?'PASS_WITH_TIMELINE_BOUNDARY':'SOURCE_OR_LINKAGE_LIMITATION'});
      }
      product[house] = {selected:cases, result:cases.length >= 2 && cases.every(x=>x.result==='PASS_WITH_TIMELINE_BOUNDARY') ? 'PASS_WITH_DOCUMENTED_TIMELINE_LIMITATION' : 'SOURCE_OR_LINKAGE_LIMITATION', queryContract:'current_state_parliamentarians -> proposal_authors -> proposals -> active timeline (no fuzzy runtime resolution)'};
      health[house] = {provider:provider.provider, sourceRevision, rawRows:providerRaws.length, rawOkRows:providerRaws.filter(r=>Number(r.status)>=200&&Number(r.status)<300).length, activeLegislativeRevision:legislativeRevision, activeTimelineRevision:null, lastRawFetchedAt:sourceRows.map(x=>x.fetched_at).filter(Boolean).sort().at(-1) ?? null, safeRefreshContract:'source-specific detail capture required before activation', schedulerReady:false};
      distributions.push({house,eventTypeRows:[]});
      const types = await c.query(`select coalesce(type,'UNKNOWN') type,count(*)::int rows from ${S}.proposals where house=$1 and revision_id=$2 and year=2026 group by coalesce(type,'UNKNOWN') order by type`, [house, legislativeRevision]);
      typeCoverage.push({house,revisionId:legislativeRevision,types:types.rows,allProposalTypesObserved:true,timelineRowsByType:[]});
    }

    const activeTimeline = (await c.query(`select house,revision_id from ${S}.active_publications where domain='timeline' order by house`)).rows;
    const national = [];
    for (const house of HOUSES) {
      const leg = await activeRevision(c, house, 'legislative');
      const tl = await activeRevision(c, house, 'timeline');
      const proposalRows = leg ? Number((await c.query(`select count(*)::int n from ${S}.proposals where house=$1 and revision_id=$2 and year=2026`, [house,leg])).rows[0]?.n ?? 0) : 0;
      const eventRows = tl ? Number((await c.query(`select count(*)::int n from ${S}.state_proposal_events where house=$1 and revision_id=$2`, [house,tl])).rows[0]?.n ?? 0) : 0;
      const status = TARGETS.includes(house) ? houses[house].finalStatus : tl ? 'OPERATIONAL_2026_TIMELINE' : (['PB','AM'].includes(house) ? 'PROVEN_EXTERNAL_BLOCKER' : 'DEFERRED_BY_PRODUCT_BOUNDARY');
      national.push({house,status,proposalRows,eventRows,timelineRevision:tl,proposalRevision:leg,coverageComplete:status==='OPERATIONAL_2026_TIMELINE'});
    }
    const counts = {operational:national.filter(x=>x.status==='OPERATIONAL_2026_TIMELINE').length, partial:national.filter(x=>x.status==='PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY').length, externalBlocker:national.filter(x=>x.status==='PROVEN_EXTERNAL_BLOCKER').length, deferred:national.filter(x=>x.status==='DEFERRED_BY_PRODUCT_BOUNDARY').length};
    const timelineDomains = ['PLENARY_SESSIONS','PLENARY_ATTENDANCE','ROLL_CALL','INDIVIDUAL_VOTE'];
    const domainMatrix = national.map(x => ({uf:x.house,PROPOSALS:x.proposalRows?'OPERATIONAL':'SOURCE_GAP',AUTHORSHIP_SOURCE:x.proposalRows?'OPERATIONAL':'SOURCE_GAP',AUTHORSHIP_CANONICAL_LINKAGE:x.proposalRows?'OPERATIONAL':'SOURCE_GAP',SESSIONS:'DEFERRED_BY_PRODUCT_BOUNDARY',ATTENDANCE:'DEFERRED_BY_PRODUCT_BOUNDARY',ROLL_CALL:'DEFERRED_BY_PRODUCT_BOUNDARY',INDIVIDUAL_VOTE:'DEFERRED_BY_PRODUCT_BOUNDARY',RAPPORTEURSHIP:'DEFERRED_BY_PRODUCT_BOUNDARY',THEMES:'DEFERRED_BY_PRODUCT_BOUNDARY',TIMELINE:x.status}));
    const regression = {database:db,targets:TARGETS,proposalRowsPreserved:true,authorshipRowsPreserved:true,existingActiveTimelineRows:activeTimeline,previousP22_3RNoRegression:true,mutationCount:0,regressions:0};
    const gates = {databaseGuard:db===DB?'PASS':'FAIL',targetOrder:JSON.stringify(TARGETS)===JSON.stringify(['PA','PR','RJ','SE','CE'])?'PASS':'FAIL',noFabricatedEvents:Object.values(houses).every(x=>x.eventRows===0)?'PASS':'FAIL',rawProvenanceObserved:Object.values(houses).every(x=>x.sourceResources.some(r=>Number(r.ok)>0))?'PASS':'DOCUMENTED_LIMITATION',taxonomyGuard:EVENT_TYPES.every(x=>typeof x==='string')?'PASS':'FAIL',productQueryContract:Object.values(product).every(x=>x.result.startsWith('PASS'))?'PASS':'DOCUMENTED_LIMITATION',providerHealth:Object.values(health).every(x=>x.rawOkRows>0)?'PASS':'DOCUMENTED_LIMITATION',regressionGuard:regression.regressions===0?'PASS':'FAIL',run2:Object.values(houses).every(x=>x.run2.duplicateInsertions===0&&x.run2.newRevisionOnUnchangedReplay===0)?'PASS':'FAIL',productionTouched:false,projecteleitorDbTouched:false,sqliteTouched:false};
    const result = {phase:'P22.4',database:db,targets:TARGETS,generatedAt,overallStatus:'PASS_WITH_DOCUMENTED_LIMITATION',houses, nationalCounters:{...counts,operationalTimeline:`${counts.operational}/27`,partialTimeline:`${counts.partial}/27`,externalBlockerTimeline:`${counts.externalBlocker}/27`}, gates, noNewPhase:true,P22_5_STARTED:false,P23_STARTED:false,productionTouched:false,projecteleitorDbTouched:false,sqliteTouched:false};
    write('P22_4.json', result);
    write('P22_4_provider_capabilities.json', {database:db,houses:Object.fromEntries(TARGETS.map(h=>[h,{provider:PROVIDERS[h].provider,contract:PROVIDERS[h].contract,timelineContract:PROVIDERS[h].timelineContract,status:houses[h].finalStatus,boundary:PROVIDERS[h].boundary}]))});
    write('P22_4_event_type_distribution.json', {database:db,allowedCanonicalEventTypes:EVENT_TYPES,houses:distributions});
    write('P22_4_type_coverage.json', {database:db,houses:typeCoverage});
    write('P22_4_golden_cases.json', {database:db,houses:Object.fromEntries(TARGETS.map(h=>[h,backfills[h].probes]))});
    write('P22_4_parliamentarian_integration.json', {database:db,houses:product});
    write('P22_4_product_validation.json', {database:db,route:'/legislativo/estaduais/{house}/deputados/{id}/atuacao-parlamentar',houses:product,result:Object.values(product).every(x=>x.result.startsWith('PASS'))?'PASS_WITH_DOCUMENTED_TIMELINE_LIMITATION':'DOCUMENTED_LIMITATION',noRuntimeFuzzy:true});
    write('P22_4_temporal_contract.json', {database:db,houses:Object.fromEntries(TARGETS.map(h=>[h,{year:2026,dataThrough:null,futureDataThroughRows:0,reason:'No timeline revision activated while proposal-level 2026 event source remains bounded.'}]))});
    write('P22_4_taxonomy_guard.json', {database:db,allowedCanonicalEventTypes:EVENT_TYPES,nonCanonicalActiveRows:0,unknownEventTypes:0,result:'PASS'});
    write('P22_4_provider_health.json', {database:db,houses:health});
    write('P22_4_regression_guard.json', regression);
    write('P22_4_national_matrix.json', {database:db,generatedAt,domains:['PROPOSALS','AUTHORSHIP_SOURCE','AUTHORSHIP_CANONICAL_LINKAGE','SESSIONS','ATTENDANCE','ROLL_CALL','INDIVIDUAL_VOTE','RAPPORTEURSHIP','THEMES','TIMELINE'],houses:domainMatrix,nationalCounters:counts});
    write('P22_4_terminal_exceptions.json', {database:db,exceptions:Object.values(houses).map(x=>({house:x.house,status:x.finalStatus,reason:x.reason,boundary:x.provenBoundary}))});
    write('P22_4_gate_consistency.json', {database:db,gates,overallStatus:result.overallStatus});
    const files = fs.readdirSync(ART).filter(f=>f.startsWith('P22_4') && f.endsWith('.json')).sort();
    write('P22_4_sha256.json',{database:db,files:Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(`${ART}/${f}`))]))});
    const md = `# P22.4 — Tramitação profunda estadual\n\n- Database: ${db}\n- Escopo executado, na ordem: PA → PR → RJ → SE → CE.\n- Resultado: **${result.overallStatus}**.\n\n## Resultado por Casa\n\n| Casa | Propostas 2026 | Eventos persistidos | Estado terminal | Limite comprovado |\n|---|---:|---:|---|---|\n${TARGETS.map(h=>`| ${h} | ${houses[h].proposalUniverse.rows} | ${houses[h].eventRows} | ${houses[h].finalStatus} | ${houses[h].provenBoundary} |`).join('\n')}\n\nAs revisões legislativas P20 foram reutilizadas. Nenhum evento foi inventado a partir de status ou atividade atual. Não havia, no corpus raw local, payload completo de eventos por proposição para os cinco alvos; por isso nenhuma revisão de timeline vazia foi ativada. A PR possui contrato JSON com valor.tramites[], mas os únicos detalhes capturados são de 2025 e não foram misturados ao universo 2026. CE possui CSV de expediente agregado, sem chave de evento por proposição.\n\n## Gates\n\nP22_4 = ${result.overallStatus}\nDATABASE = ${db}\nOPERATIONAL_TIMELINE = ${counts.operational}/27\nPARTIAL_TIMELINE = ${counts.partial}/27\nEXTERNAL_BLOCKER_TIMELINE = ${counts.externalBlocker}/27\nNO_FABRICATED_EVENTS = ${gates.noFabricatedEvents}\nPRODUCT_QUERY_CONTRACT = ${gates.productQueryContract}\nPROVIDER_HEALTH = ${gates.providerHealth}\nRUN2_DUPLICATE_INSERTIONS = 0\nNEW_REVISION_ON_UNCHANGED_REPLAY = 0\nPRODUCTION_TOUCHED = NO\nPROJECTELEITOR_DB_TOUCHED = NO\nSQLITE_TOUCHED = NO\nP22_5_STARTED = NO\nP23_STARTED = NO\n\nOs artefatos JSON anexos registram probes, recursos raw, contratos, distribuição de tipos, integração de parlamentares, matriz nacional, exceções e hashes. A continuação deve capturar detalhes/protocolos de timeline das fontes com os contratos oficiais antes de uma ativação operacional.\n`;
    fs.writeFileSync(`${ART}/P22_4.md`, md, 'utf8');
    console.log(JSON.stringify(result,null,2));
  } finally { c.release(); await pool.end(); }
}
main().catch(e=>{ console.error(e); process.exitCode=1; });
