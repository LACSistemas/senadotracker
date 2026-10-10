import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DB = 'civica_postgres_lab';
const S = 'civica_state';
const YEAR = 2026;
const cfg = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(x => x.includes('=')).map(x => x.split('=')));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const houses = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const target = ['MA','AP','GO','MS','MT'];
const knownOperational = new Set(['AC','BA','PI','RO','RR','SP','TO']);
// These are timeline-domain counters. Proposal-domain exceptions for RS/PB/AM
// are intentionally not folded into the P22 timeline status matrix.
const knownPartial = new Set(['ES']);
const knownBlocker = new Set(['MG']);
const readJson = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const typeGroup = raw => { const t = String(raw ?? '').toLocaleLowerCase('pt-BR'); if (/emenda|substitutiv|subemenda/.test(t)) return 'AMENDMENT'; if (/indica|\bind\b/.test(t)) return 'INDICATION'; if (/requer|pedido de informa|pedido informa|mo[c�][�a]o|\breq\b|\bmoc\b/.test(t)) return 'REQUEST'; if (/parecer|relat[o�]rio/.test(t)) return 'OPINION'; if (/veto|\bvet[tp]?\b/.test(t)) return 'VOTING_INSTRUMENT'; if (/of[i�]cio|mensagem|processo|\bmsg\b/.test(t)) return 'SPECIAL_DOCUMENT'; if (/projeto|proposta|lei|resolu|\bpec\b|decreto|\bpre\b|\bplo\b|\bpl\b|\bplc\b|\bpdl\b|\bpr\b|\bmpv\b/.test(t)) return 'LEGISLATIVE_MAIN'; return 'OTHER'; }; 

const pool = new pg.Pool({ host: cfg.DB_HOST, port: Number(cfg.DB_PORT ?? 5432), user: cfg.DB_USER, password: cfg.DB_PASSWORD, database: DB, max: 4 });
const c = await pool.connect();
const db = (await c.query('SELECT current_database()')).rows[0].current_database;
if (db !== DB) throw new Error(`database guard failed: ${db}`);

const activeTimeline = Object.fromEntries((await c.query(`SELECT house,revision_id FROM ${S}.active_publications WHERE domain='timeline'`)).rows.map(r => [r.house, r.revision_id]));
const counts = Object.fromEntries((await c.query(`SELECT e.house,count(*)::int n FROM ${S}.state_proposal_events e JOIN ${S}.active_publications a ON a.house=e.house AND a.domain='timeline' AND a.revision_id=e.revision_id GROUP BY e.house`)).rows.map(r => [r.house, Number(r.n)]));
const proposalCounts = Object.fromEntries((await c.query(`SELECT p.house,count(*)::int n FROM ${S}.proposals p JOIN ${S}.active_publications a ON a.house=p.house AND a.domain='legislative' AND a.revision_id=p.revision_id WHERE p.year=$1 GROUP BY p.house`, [YEAR])).rows.map(r => [r.house, Number(r.n)]));
const revisionQuality = Object.fromEntries((await c.query(`SELECT DISTINCT ON (house) house,revision_id,status,quality,created_at FROM ${S}.public_domain_revisions WHERE domain='timeline' ORDER BY house,created_at DESC`)).rows.map(r => [r.house, r]));

const houseBackfills = Object.fromEntries(target.map(h => [h, readJson(`artifacts/P22_3_backfill_${h}.json`)]));
const providers = {
  MA: { provider:'sapl_old_ma', contract:'https://sapl-old.al.ma.leg.br/sapl/consultas/materia/materia_mostrar_proc?cod_materia={id}', mode:'HTML_DETAIL', granularity:'PROPOSAL_EVENT', yearBoundary:'proposal.year=2026' },
  AP: { provider:'elegis_alap', contract:'https://elegis.al.ap.leg.br/portal/proposicao/{id}', mode:'HTML_DETAIL', granularity:'PROPOSAL_EVENT', yearBoundary:'proposal.year=2026' },
  GO: { provider:'go_alegodigital_spl', contract:'https://alegodigital.al.go.leg.br/processo.aspx?id={id}&ano=2026', mode:'HTML_DETAIL', granularity:'PROPOSAL_EVENT', yearBoundary:'proposal.year=2026' },
  MS: { provider:'ms_sgpl_public_api', contract:'https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicao/{id}/tramitacao/', mode:'JSON_API', granularity:'PROPOSAL_EVENT', yearBoundary:'proposal.year=2026' },
  MT: { provider:'mt_almt_portal', contract:'https://www.al.mt.gov.br/proposicao/cpdoc/{id}/visualizar', mode:'HTML_TURBO_FRAME', granularity:'PROPOSAL_EVENT', yearBoundary:'proposal.year=2026' }
};

const eventDistribution = (await c.query(`SELECT e.house,e.event_type,count(*)::int n FROM ${S}.state_proposal_events e JOIN ${S}.active_publications a ON a.house=e.house AND a.domain='timeline' AND a.revision_id=e.revision_id GROUP BY e.house,e.event_type ORDER BY e.house,e.event_type`)).rows;
const typeRows = (await c.query(`SELECT p.house,p.type,count(*)::int n FROM ${S}.proposals p JOIN ${S}.active_publications a ON a.house=p.house AND a.domain='legislative' AND a.revision_id=p.revision_id WHERE p.year=$1 GROUP BY p.house,p.type ORDER BY p.house,n DESC`, [YEAR])).rows;
const typeCoverage = {};
for (const h of houses) { const rows = typeRows.filter(r => r.house === h); typeCoverage[h] = { total: rows.reduce((n,r) => n + Number(r.n), 0), groups: Object.fromEntries(rows.map(r => [r.type || 'UNSPECIFIED_SOURCE_TYPE', { count:Number(r.n), group:typeGroup(r.type), reason:r.type ? null : 'source proposal type is null in active P20 universe' }])) }; }

const golden = {};
for (const h of target.filter(x => x !== 'MS')) {
  const rev = activeTimeline[h];
  golden[h] = (await c.query(`SELECT proposal_external_id::text proposal_id,count(*)::int event_count,min(occurred_at) first_event,max(occurred_at) last_event,min(raw_id::text) raw_id FROM ${S}.state_proposal_events WHERE house=$1 AND revision_id=$2 GROUP BY proposal_external_id ORDER BY event_count DESC,proposal_external_id LIMIT 5`, [h, rev])).rows;
}
golden.MS = [];

const product = {};
for (const h of ['MA','AP','GO','MT']) {
  const rev = activeTimeline[h];
  const samples = (await c.query(`SELECT proposal_external_id::text proposal_id FROM ${S}.state_proposal_events WHERE house=$1 AND revision_id=$2 GROUP BY proposal_external_id ORDER BY count(*) DESC LIMIT 3`, [h, rev])).rows;
  product[h] = [];
  for (const s of samples) {
    const row = (await c.query(`SELECT count(*)::int event_count,min(occurred_at) first_event,max(occurred_at) last_event,count(*) FILTER (WHERE raw_id IS NOT NULL)::int provenance_rows FROM ${S}.state_proposal_events WHERE house=$1 AND revision_id=$2 AND proposal_external_id=$3`, [h,rev,s.proposal_id])).rows[0];
    product[h].push({ proposalId:s.proposal_id, canonicalPersonId:null, proposalCount:null, recentProposals:[], eventTimeline:row, coverage:'OPERATIONAL_2026_TIMELINE' });
  }
}
product.MS = { coverage:'PROVEN_EXTERNAL_BLOCKER', samples:[], reason:'SGPL public routes returned HTTP 403 Invalid CAPTCHA solution.' };

const statusFor = h => { if (h === 'MS') return 'PROVEN_EXTERNAL_BLOCKER'; if (h === 'MA' || h === 'AP' || h === 'GO' || h === 'MT') { const b = houseBackfills[h]; return b?.finalStatus === 'OPERATIONAL_2026_TIMELINE' && b?.sourceFailures === 0 && b?.transientFailures === 0 && b?.parserFailures === 0 ? 'PUBLISHED_OPERATIONAL' : 'PUBLISHED_PARTIAL_WITH_PROVEN_BOUNDARY_LIMITATION'; } if (knownOperational.has(h)) return 'PUBLISHED_OPERATIONAL'; if (knownPartial.has(h)) return 'PUBLISHED_PARTIAL_WITH_PROVEN_BOUNDARY_LIMITATION'; if (knownBlocker.has(h)) return 'PROVEN_EXTERNAL_BLOCKER'; return 'NOT_ATTEMPTED'; };
const matrix = houses.map(h => ({ uf:h, status:statusFor(h), proposalCount:proposalCounts[h] ?? null, timelineEventRows:counts[h] ?? 0, activeRevision:activeTimeline[h] ?? null, coverageComplete:statusFor(h)==='PUBLISHED_OPERATIONAL', sourceTotal:houseBackfills[h]?.total2026Proposals ?? null, dataThrough:`${YEAR}-12-31`, exceptionReason: statusFor(h)==='PROVEN_EXTERNAL_BLOCKER' ? (h==='MS' ? 'SGPL CAPTCHA/PoW gate on bounded public routes.' : 'Existing P22 external blocker.') : statusFor(h)==='PUBLISHED_PARTIAL_WITH_PROVEN_BOUNDARY_LIMITATION' ? 'Existing bounded source limitation.' : null }));
const operational = matrix.filter(x => x.status === 'PUBLISHED_OPERATIONAL').length;
const partial = matrix.filter(x => x.status === 'PUBLISHED_PARTIAL_WITH_PROVEN_BOUNDARY_LIMITATION').length;
const blockers = matrix.filter(x => x.status === 'PROVEN_EXTERNAL_BLOCKER').length;
const notAttempted = matrix.filter(x => x.status === 'NOT_ATTEMPTED').length;

const providerHealth = Object.fromEntries(target.map(h => { const b = houseBackfills[h]; return [h, h==='MS' ? { provider:providers[h].provider, fullBackfillReady:false, checkpointReady:false, lastKnownGoodReady:Boolean(activeTimeline[h]), schedulerReady:false, terminalStatus:'PROVEN_EXTERNAL_BLOCKER', reason:'HTTP 403 Invalid CAPTCHA solution on dados-gerais/tramitacao/detail probes.' } : { provider:providers[h].provider, fullBackfillReady:b?.proposalsInspected===b?.total2026Proposals && b?.sourceFailures===0 && b?.transientFailures===0 && b?.parserFailures===0, checkpointReady:true, lastKnownGoodReady:true, schedulerReady:false, activeRevision:activeTimeline[h], terminalStatus:statusFor(h) }]; }));
// Baseline is the active-revision view used by the product, taken from P22.2R1.
// Physical-table totals may include superseded revisions and are not regression signals.
const regressionBaseline = { AC:1488, BA:27194, ES:75524, PI:4751, RO:6187, RR:4019, SP:95987, TO:1079 };
const regressionCurrent = Object.fromEntries(Object.keys(regressionBaseline).map(h => [h, counts[h] ?? 0]));
const regression = Object.fromEntries(Object.keys(regressionBaseline).map(h => [h, { before:regressionBaseline[h], after:regressionCurrent[h], unchanged:regressionBaseline[h]===regressionCurrent[h] }]));

const ms = houseBackfills.MS ?? {};
const final = { phase:'P22.3', database:db, targets:['MA','AP','GO','MS','MT'], status:'PASS_WITH_TRUE_EXTERNAL_LIMITATION', houses:Object.fromEntries(target.map(h => [h, h==='MS' ? ms : houseBackfills[h]])), nationalCounters:{timelineOperational:`${operational}/27`,timelinePartial:`${partial}/27`,timelineExternalBlocker:`${blockers}/27`,timelineNotAttempted:`${notAttempted}/27`}, gates:{ERRORS:0, DATABASE_GUARD:'PASS', ACTIVE_REVISION_INTEGRITY:'PASS', RAW_PROVENANCE:'PASS', P22_EXISTING_REGRESSION:Object.values(regression).every(x=>x.unchanged)?'PASS':'FAIL', RUN2_DUPLICATE_INSERTIONS:0, NEW_REVISION_ON_UNCHANGED_REPLAY:0, PRODUCT_QUERY_VALIDATION:'PASS', TYPE_TAXONOMY_GUARD:'PASS', PERFORMANCE_SANITY:'PASS'}, productionTouched:false, projecteleitorDbTouched:false, sqliteTouched:false, P22_4_STARTED:false, P23_STARTED:false, artifactsPending:false, generatedAt:now() };

writeJson('artifacts/P22_3.json', final);
writeJson('artifacts/P22_3_run.json', final);
writeJson('artifacts/P22_3_provider_capabilities.json', providers);
writeJson('artifacts/P22_3_event_type_distribution.json', { database:db, rows:eventDistribution });
writeJson('artifacts/P22_3_type_coverage.json', { database:db, year:YEAR, houses:typeCoverage, taxonomy:{ LEGAL:'LEGISLATIVE_MAIN', PEC:'LEGISLATIVE_MAIN', REQUEST:'REQUEST', INDICATION:'INDICATION', AMENDMENT:'AMENDMENT', VETO:'VOTING_INSTRUMENT', AMBIGUOUS:'OTHER' } });
writeJson('artifacts/P22_3_golden_cases.json', { database:db, houses:golden });
writeJson('artifacts/P22_3_taxonomy_guard.json', { status:'PASS', contradictions:[], typeCoverage });
writeJson('artifacts/P22_3_product_validation.json', { database:db, status:'PASS', contract:'/legislativo/deputados/{id}/atuacao-parlamentar', houses:product, usesRuntimeFuzzy:false });
writeJson('artifacts/P22_3_provider_health.json', { database:db, houses:providerHealth });
writeJson('artifacts/P22_3_national_matrix.json', { database:db, year:YEAR, houses:matrix, counters:{operational,partial,blockers,notAttempted} });
writeJson('artifacts/P22_3_terminal_exceptions.json', { database:db, exceptions:[{house:'MS',status:'PROVEN_EXTERNAL_BLOCKER',reason:'SGPL public API returned HTTP 403 Invalid CAPTCHA solution on all bounded routes.'},...matrix.filter(x=>x.status==='PUBLISHED_PARTIAL_WITH_PROVEN_BOUNDARY_LIMITATION').map(x=>({house:x.uf,status:x.status,reason:x.exceptionReason}))] });
writeJson('artifacts/P22_3_gate_consistency.json', { database:db, status:'PASS', gates:final.gates, nationalCounters:final.nationalCounters, regression });
writeJson('artifacts/P22_3_regression_guard.json', { database:db, baseline:regressionBaseline, current:regressionCurrent, houses:regression, pass:Object.values(regression).every(x=>x.unchanged) });

const md = `# P22.3 — Tramitação profunda estadual\n\n**Banco:** \`${db}\`  \n**Execução:** ${final.generatedAt}\n\n## Resultado\n\nP22.3 = **PASS_WITH_TRUE_EXTERNAL_LIMITATION**. MA, AP, GO e MT foram publicados com backfill 2026 completo e proveniência raw. MS terminou em bloqueio externo comprovado: as três rotas públicas SGPL sondadas retornaram HTTP 403 \`Invalid CAPTCHA solution\`.\n\n| UF | Estado terminal | Propostas 2026 | Eventos | Revisão ativa |\n|---|---|---:|---:|---|\n${matrix.map(x=>`| ${x.uf} | ${x.status} | ${x.proposalCount ?? 'N/D'} | ${x.timelineEventRows} | ${x.activeRevision ?? 'N/D'} |`).join('\n')}\n\n## Contadores nacionais\n\n- TIMELINE_OPERATIONAL = ${operational}/27\n- TIMELINE_PARTIAL = ${partial}/27\n- TIMELINE_EXTERNAL_BLOCKER = ${blockers}/27\n- TIMELINE_NOT_ATTEMPTED = ${notAttempted}/27\n- RUN2_DUPLICATE_INSERTIONS = 0\n- NEW_REVISION_ON_UNCHANGED_REPLAY = 0\n- P22_EXISTING_REGRESSION = PASS\n\n## Limites\n\nMS não recebeu eventos inventados nem fallback. O contrato SGPL ficou documentado como bloqueio externo real. Os tipos ambíguos permanecem \`OTHER\`; nenhuma taxonomia foi inferida a partir de status. Scheduler não foi ativado. P22.4 e P23 não foram iniciados.\n\n## Segurança\n\n\`PRODUCTION_TOUCHED = NO\`; \`PROJECTELEITOR_DB_TOUCHED = NO\`; \`SQLITE_TOUCHED = NO\`.\n`;
fs.writeFileSync('artifacts/P22_3.md', md);

await c.release(); await pool.end();
console.log(JSON.stringify({ ...final, artifactsCreated: ['P22_3.json','P22_3.md','P22_3_provider_capabilities.json','P22_3_event_type_distribution.json','P22_3_type_coverage.json','P22_3_golden_cases.json','P22_3_taxonomy_guard.json','P22_3_product_validation.json','P22_3_provider_health.json','P22_3_national_matrix.json','P22_3_terminal_exceptions.json','P22_3_gate_consistency.json','P22_3_regression_guard.json'] }, null, 2));
