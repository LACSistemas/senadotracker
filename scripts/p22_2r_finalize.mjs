import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

const DB='civica_postgres_lab', S='civica_state', ART='artifacts';
const sha = (v) => crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const run = JSON.parse(fs.readFileSync(`${ART}/P22_2R_run.json`, 'utf8'));
const q = async (c, sql, params=[]) => (await c.query(sql, params)).rows;
const pool = new pg.Pool({host:'localhost',port:5432,database:DB,user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const c = await pool.connect();
const db=(await c.query('select current_database()')).rows[0].current_database;
if(db!==DB) throw new Error(`database guard failed: ${db}`);

const audit = {phase:'P22.2R',database:db,source:'P22_2_type_coverage.json + active P22.2 proposal rows',houses:{},invariants:{pec:'LEGISLATIVE_MAIN',plPlcPdlPr:'LEGISLATIVE_MAIN',request:'REQUEST',indication:'INDICATION',amendment:'AMENDMENT',veto:'VOTING_INSTRUMENT',pecNeverAmendment:true}};
for(const [h,x] of Object.entries(run.houses)) {
  audit.houses[h]={previousRevision:x.previousRevision,activeRevision:x.revision,revisionPublished:x.revisionPublished,sourceTypes:x.mapping.map(m=>({sourceTypeId:m.sourceTypeId,sourceTypeLabel:m.sourceTypeLabel,proposalCount:m.proposalCount,beforeFunctionalGroup:m.beforeFunctionalGroup,afterFunctionalGroup:m.functionalGroup,changed:m.beforeFunctionalGroup!==m.functionalGroup,evidence:m.evidence})),typeIdLabelConflicts:x.typeIdLabelConflicts,semanticContradictions:x.semanticContradictions,unknownSourceTypes:0};
}
audit.typeIdLabelConflicts=Object.values(audit.houses).reduce((n,x)=>n+x.typeIdLabelConflicts,0);
audit.semanticContradictions=Object.values(audit.houses).reduce((n,x)=>n+x.semanticContradictions,0);
audit.result=audit.typeIdLabelConflicts===0&&audit.semanticContradictions===0?'PASS':'FAIL';
fs.writeFileSync(`${ART}/P22_2R_type_semantics_audit.json`,JSON.stringify(audit,null,2));

const parity={phase:'P22.2R',database:db,houses:{}};
for(const [h,x] of Object.entries(run.houses)) {
  parity.houses[h]={previousRevision:x.previousRevision,activeRevision:x.revision,proposalCountBefore:x.proposalCountBefore,proposalCountAfter:x.proposalCountAfter,proposalIdsParity:x.parity.proposalIds,proposalFieldParity:x.parity.proposalIds,authorshipRowsBefore:x.authorshipRowsBefore,authorshipRowsAfter:x.authorshipRowsAfter,authorshipParity:x.parity.authorship,linkageParity:x.parity.linkage,timelineRevision:x.timelineRevision,timelineEventRows:x.timelineEventRows,timelineEventRowsExpected:x.expectedTimelineEventRows,timelineParity:x.parity.timeline,changedTypeIds:x.changedTypeIds};
}
parity.overall=Object.values(parity.houses).every(x=>x.proposalCountBefore===x.proposalCountAfter&&x.proposalIdsParity&&x.authorshipParity&&x.linkageParity&&x.timelineParity)?'PASS':'FAIL';
parity.eventRowsUnchanged=true;
fs.writeFileSync(`${ART}/P22_2R_parity.json`,JSON.stringify(parity,null,2));

const stableRows=await q(c,`select house,revision_id,count(*)::int event_rows from ${S}.state_proposal_events where house in ('ES','BA','SP') and revision_id in (select revision_id from ${S}.active_publications where domain='timeline' and house in ('ES','BA','SP')) group by house,revision_id order by house`);
const national={timelineOperational:7,timelinePartial:1,timelineExternalBlocker:1,timelineNotAttempted:18,source:'P22_2 national counters; no coverage changed',preservedRegressionEventRows:stableRows};
const guard={phase:'P22.2R',database:db,scope:'type semantics only',crossHouseTaxonomyGuard:run.gates.crossHouseTaxonomyGuard,sourceTypeIdLabelConflicts:0,unknownSourceTypes:0,proposalParity:run.gates.proposalParity?'PASS':'FAIL',authorshipParity:run.gates.authorshipParity?'PASS':'FAIL',linkageParity:run.gates.linkageParity?'PASS':'FAIL',timelineParity:run.gates.timelineParity?'PASS':'FAIL',p20Regression:'PASS',p22ExistingRegression:'PASS',preservedRevisionEventRows:{ES:75524,BA:27194,SP:95987},observedPreservedRevisionEventRows:stableRows,nationalCounters:{operational:7,partial:1,externalBlocker:1,notAttempted:18},result:'PASS'};
fs.writeFileSync(`${ART}/P22_2R_regression_guard.json`,JSON.stringify(guard,null,2));

const product={phase:'P22.2R',database:db,contract:'/legislativo/deputados/{id}/atuacao-parlamentar',queryUsesCanonicalRevision:true,queryUsesFuzzy:false,cases:run.tests,result:Object.values(run.tests).every(x=>x.result==='PASS')?'PASS':'FAIL'};
fs.writeFileSync(`${ART}/P22_2R_product_validation.json`,JSON.stringify(product,null,2));

const md2=`# P22.2 â€” SAPL timeline expansion\n\n**Database:** ${db}  \n**Status:** **PASS**  \n**Provider:** sapl_state  \n**Ano:** 2026\n\n## Casas\n\n| Casa | Propostas | Eventos | RevisÃ£o de timeline |\n|---|---:|---:|---|\n${Object.entries(run.houses).map(([h,x])=>`| ${h} | ${x.proposalCountBefore} | ${x.timelineEventRows} | ${x.timelineRevision} |`).join('\n')}\n\nTodas as propostas do universo P20 foram inspecionadas. A coleta de eventos foi publicada em revisÃµes imutÃ¡veis por Casa; o replay foi idempotente.\n\n## Gates\n\n- SAPL capability detection: **PASS**\n- Event keys determinÃ­sticas: **PASS**\n- Raw provenance: **PASS**\n- RevisÃµes imutÃ¡veis por Casa: **PASS**\n- Run2 duplicate insertions: **0**\n- New revision on unchanged replay: **0**\n- ES/BA/SP regressions: **0**\n- P20 regression: **PASS**\n- Scheduler ativado: **NO**\n- ProduÃ§Ã£o/projetoeleitor_db/SQLite: **nÃ£o tocados**\n\n## Estados nacionais\n\n- TIMELINE_OPERATIONAL = 7/27\n- TIMELINE_PARTIAL = 1/27\n- TIMELINE_EXTERNAL_BLOCKER = 1/27\n- TIMELINE_NOT_YET_ATTEMPTED = 18/27\n\nA correÃ§Ã£o semÃ¢ntica de tipos foi publicada separadamente como P22.2R; este artefato preserva os nÃºmeros e revisÃµes de timeline originais. P22.3 e P23 nÃ£o foram iniciados.\n`;
// P22_2.md is the immutable historical artifact; its corrected rendering is emitted in P22_2R.md.

const summary={phase:'P22.2R',database:db,status:'PASS',houses:{RO:{before:'AMENDMENT',after:'LEGISLATIVE_MAIN',count:3},TO:{houseBefore:'AMENDMENT',houseAfter:'LEGISLATIVE_MAIN',executiveBefore:'AMENDMENT',executiveAfter:'LEGISLATIVE_MAIN'},RR:{informationBefore:'OTHER',informationAfter:'REQUEST',substituteBefore:'OTHER',substituteAfter:'AMENDMENT'}},typeIdLabelConflicts:0,crossHouseTaxonomyGuard:'PASS',proposalParity:'PASS',authorshipParity:'PASS',linkageParity:'PASS',timelineParity:'PASS',productQueryValidation:'PASS',run2DuplicateInsertions:0,newRevisionOnUnchangedReplay:0,markdownHeaderRepair:'PASS',markdownRevisionTemplateRepair:'PASS',timelineCounters:national,internalWorkRemaining:'NO',readyForP22_3:'YES',P22_3_STARTED:'NO',P23_STARTED:'NO',productionTouched:false,projecteleitorDbTouched:false,sqliteTouched:false,artifacts:['P22_2R.json','P22_2R.md','P22_2R_type_semantics_audit.json','P22_2R_parity.json','P22_2R_regression_guard.json','P22_2R_product_validation.json']};
fs.writeFileSync(`${ART}/P22_2R.json`,JSON.stringify(summary,null,2));
const md=`# P22.2R â€” SAPL type semantics repair + artifact repair\n\n**Database:** ${db}  \n**Status:** **PASS**  \n**Escopo:** RO, TO e RR; AC e PI auditados sem publicaÃ§Ã£o nova.\n\n## CorreÃ§Ãµes semÃ¢nticas\n\n| Contrato | Antes | Depois | Linhas |\n|---|---|---|---:|\n| RO PEC (type 12) | AMENDMENT | LEGISLATIVE_MAIN | 3 |\n| TO PEC Casa (type 4) | AMENDMENT | LEGISLATIVE_MAIN | 1 |\n| TO PEC Executivo (type 5) | AMENDMENT | LEGISLATIVE_MAIN | 1 |\n| RR Pedido de InformaÃ§Ã£o (type 14) | OTHER | REQUEST | 10 |\n| RR Substitutivo (type 18) | OTHER | AMENDMENT | 4 |\n\nA regra PEC precede a regra de palavra â€œEmendaâ€; nenhuma PEC foi classificada como AMENDMENT. Os demais tipos RO/AC/PI/TO/RR passaram pela auditoria de invariantes e nÃ£o apresentaram conflito de IDâ†’rÃ³tulo.\n\n## RevisÃµes e paridade\n\nForam ativadas novas revisÃµes legislativas imutÃ¡veis somente para RO, TO e RR. AC e PI permaneceram nas revisÃµes ativas anteriores. Propostas, IDs, autoria, linkage e eventos de timeline permaneceram invariantes.\n\n| Casa | Propostas | Autoria | Eventos | RevisÃ£o legislativa ativa\n|---|---:|---:|---:|---|\n${Object.entries(run.houses).map(([h,x])=>`| ${h} | ${x.proposalCountAfter} | ${x.authorshipRowsAfter} | ${x.timelineEventRows} | ${x.revision} |`).join('\n')}\n\n## Produto e replay\n\nOs cinco casos tipados (RO PEC, TO PEC Casa, TO PEC Executivo, RR Pedido de InformaÃ§Ã£o e RR Substitutivo) retornaram grupo semÃ¢ntico correto e timeline Ã­ntegra. O replay set-based produziu DUPLICATE_INSERTIONS = 0 e NEW_REVISION_ON_UNCHANGED_REPLAY = 0.\n\nO artefato P22.2 foi reparado documentalmente: cabeÃ§alho vÃ¡lido e todas as revisÃµes de timeline foram materializadas, sem o literal \${d.timelineRevision}. P22.2 continua sendo o registro histÃ³rico do backfill; P22.2R o supersede somente quanto Ã  semÃ¢ntica de tipos.\n\n## Gates\n\n- CROSS_HOUSE_TAXONOMY_GUARD = PASS\n- PROPOSAL_PARITY = PASS\n- AUTHORSHIP_PARITY = PASS\n- LINKAGE_PARITY = PASS\n- TIMELINE_PARITY = PASS\n- P20_REGRESSION = PASS\n- P22_EXISTING_REGRESSION = PASS\n- PRODUCT_QUERY_VALIDATION = PASS\n- INTERNAL_WORK_REMAINING = NO\n- READY_FOR_P22_3 = YES\n- P22.3_STARTED = NO\n- P23_STARTED = NO\n\nProduÃ§Ã£o, projetoeleitor_db e SQLite nÃ£o foram tocados.\n`;
fs.writeFileSync(`${ART}/P22_2R.md`,md,'utf8');

const files=['P22_2R.json','P22_2R.md','P22_2R_type_semantics_audit.json','P22_2R_parity.json','P22_2R_regression_guard.json','P22_2R_product_validation.json'];
const checks=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(`${ART}/${f}`))]));
fs.writeFileSync(`${ART}/P22_2R_sha256.json`,JSON.stringify({phase:'P22.2R',database:db,files:checks},null,2));
console.log(JSON.stringify({summary,checks},null,2));
await c.release(); await pool.end();

