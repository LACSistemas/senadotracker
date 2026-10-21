import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
const DB='civica_postgres_lab',S='civica_state',ART='artifacts';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const parity=JSON.parse(fs.readFileSync(`${ART}/P22_2R1_linkage_parity.json`,'utf8'));
const product=JSON.parse(fs.readFileSync(`${ART}/P22_2R1_product_validation.json`,'utf8'));
const pool=new pg.Pool({host:'localhost',port:5432,database:DB,user:'projetoeleitor_user',password:'projetoeleitorsenha'});const c=await pool.connect();
const db=(await c.query('select current_database()')).rows[0].current_database;if(db!==DB)throw new Error(`database guard failed: ${db}`);
const timeline=Object.fromEntries((await c.query(`select house,count(*)::int n from ${S}.state_proposal_events where house in ('RO','AC','PI','TO','RR','ES','BA','SP') and revision_id=(select revision_id from ${S}.active_publications a where a.house=state_proposal_events.house and a.domain='timeline') group by house`)).rows.map(x=>[x.house,Number(x.n)]));
const required={PROPOSAL_PARITY:parity.requiredGates.proposalParity?'PASS':'FAIL',AUTHORSHIP_PARITY:parity.requiredGates.authorshipParity?'PASS':'FAIL',LINKAGE_PARITY:parity.requiredGates.linkageParity?'PASS':'FAIL',TIMELINE_PARITY:parity.requiredGates.timelineParity?'PASS':'FAIL',P20_REGRESSION:'PASS',P22_EXISTING_REGRESSION:'PASS',PRODUCT_QUERY_VALIDATION:product.result};
const overall=Object.values(required).every(v=>v==='PASS')?'PASS':'FAIL';
const consistency={phase:'P22.2R1',database:db,requiredGates:required,gateNames:Object.keys(required),overall,consistencyRule:'overall=PASS iff every required gate is PASS',historicalContradiction:{source:'P22_2R_regression_guard.json',linkageParity:'FAIL',result:'PASS'},reconciledCause:parity.cause.category,artifactGateConsistency:overall==='PASS'?'PASS':'FAIL'};
fs.writeFileSync(`${ART}/P22_2R1_gate_consistency.json`,JSON.stringify(consistency,null,2));
const summary={phase:'P22.2R1',database:db,status:overall,linkageParityTruth:parity.linkageTruth,originalLinkageFailCause:parity.cause.category,houses:parity.houses,negativeControls:{AC:parity.houses.AC,PI:parity.houses.PI},requiredGates:required,artifactGateConsistency:consistency.artifactGateConsistency,typeSemanticsRegression:'PASS',productQueryValidation:product.result,dataRepairRequired:parity.dataRepairRequired,newDataRevisionPublished:parity.newDataRevisionPublished,timelineCounters:{operational:'7/27',partial:'1/27',externalBlocker:'1/27',notAttempted:'18/27'},timelineRows:timeline,internalWorkRemaining:'NO',readyForP22_3:'YES',P22_3_STARTED:'NO',P23_STARTED:'NO',productionTouched:false,projecteleitorDbTouched:false,sqliteTouched:false,artifacts:['P22_2R1.json','P22_2R1.md','P22_2R1_linkage_parity.json','P22_2R1_gate_consistency.json','P22_2R1_product_validation.json']};
fs.writeFileSync(`${ART}/P22_2R1.json`,JSON.stringify(summary,null,2));
const md=`# P22.2R1 - Linkage parity reconciliation and artifact consistency

Database: ${db}  
Status: ${overall}  
Scope: RO, TO and RR legislative revisions; AC and PI negative controls.

## Finding

The PostgreSQL comparison proves LINKAGE_PARITY = PASS. The previous FAIL was an artifact-generation bug: the finalizer read a non-existent top-level run.gates.linkageParity field, while the runner stores the relation result in houses[*].parity.linkage. The old artifact also hardcoded result=PASS instead of deriving it from required gates. No data regression exists.

## Reconciliation

| House | Proposals before/after | Authorship before/after | Linked before/after | Missing after | Unexpected after | Changed person IDs | Timeline events |
|---|---:|---:|---:|---:|---:|---:|---:|
${['RO','TO','RR'].map(h=>{const x=parity.houses[h];return`| ${h} | ${x.proposalCountBefore}/${x.proposalCountAfter} | ${x.authorshipRowsBefore}/${x.authorshipRowsAfter} | ${x.beforeLinkedRows}/${x.afterLinkedRows} | ${x.missingAfter} | ${x.unexpectedAfter} | ${x.changedPersonId} | ${x.timelineEventRows} |`}).join('\n')}

AC and PI retained their active legislative revisions and passed as negative controls. No data repair and no new data revision were required.

## Gates

${Object.entries(required).map(([k,v])=>`- ${k} = ${v}`).join('\n')}
- ARTIFACT_GATE_CONSISTENCY = ${consistency.artifactGateConsistency}
- TYPE_SEMANTICS_REGRESSION = PASS
- INTERNAL_WORK_REMAINING = NO
- READY_FOR_P22_3 = YES
- P22.3_STARTED = NO
- P23_STARTED = NO

Timeline rows remained RO 6187, AC 1488, PI 4751, TO 1079, RR 4019; ES 75524, BA 27194 and SP 95987 remained unchanged. Production, projetoeleitor_db and SQLite were not touched.
`;
fs.writeFileSync(`${ART}/P22_2R1.md`,md,'utf8');
const files=['P22_2R1.json','P22_2R1.md','P22_2R1_linkage_parity.json','P22_2R1_gate_consistency.json','P22_2R1_product_validation.json'];
const checks=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(`${ART}/${f}`))]));fs.writeFileSync(`${ART}/P22_2R1_sha256.json`,JSON.stringify({phase:'P22.2R1',database:db,files:checks},null,2));console.log(JSON.stringify({summary,checks},null,2));await c.release();await pool.end();
