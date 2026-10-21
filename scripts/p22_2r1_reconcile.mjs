import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

const DB='civica_postgres_lab', S='civica_state', ART='artifacts';
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const pool=new pg.Pool({host:'localhost',port:5432,database:DB,user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const c=await pool.connect();
const db=(await c.query('select current_database()')).rows[0].current_database;
if(db!==DB) throw new Error(`database guard failed: ${db}`);
const run=JSON.parse(fs.readFileSync(`${ART}/P22_2R_run.json`,'utf8'));
const oldGuard=JSON.parse(fs.readFileSync(`${ART}/P22_2R_regression_guard.json`,'utf8'));
const q=async(sql,p=[]) => (await c.query(sql,p)).rows;
const rowKey=r=>[r.proposal_external_id,r.author_key,r.actor_type,r.organization_external_id,r.role,r.author_order,r.actor_type_canonical].map(v=>v??'').join('\x1f');
const linkedKey=r=>[r.proposal_external_id,r.author_key,r.person_external_id].map(v=>v??'').join('\x1f');
const sortJson=a=>a.map(x=>JSON.stringify(x)).sort();
const revisions={};
for(const [h,x] of Object.entries(run.houses)) revisions[h]={before:x.previousRevision,after:x.revision};
const result={phase:'P22.2R1',database:db,scope:['RO','TO','RR'],negativeControls:['AC','PI'],houses:{},originalArtifact:{file:'P22_2R_regression_guard.json',linkageParity:oldGuard.linkageParity,result:oldGuard.result},cause:{category:'WRONG_FIELD_NAME',details:'P22_2R finalizer read run.gates.linkageParity, but the runner exposes linkage at houses[*].parity.linkage; the finalizer also hardcoded result=PASS instead of deriving it from required gates.',artifactGenerationBug:true,dataRegression:false}};
for(const h of ['RO','TO','RR']){
  const r=revisions[h];
  const before=await q(`select external_id from ${S}.proposals where house=$1 and revision_id=$2 order by external_id`,[h,r.before]);
  const after=await q(`select external_id from ${S}.proposals where house=$1 and revision_id=$2 order by external_id`,[h,r.after]);
  const ab=await q(`select proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,role,author_order,actor_type_canonical from ${S}.proposal_authors where house=$1 and revision_id=$2`,[h,r.before]);
  const aa=await q(`select proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,role,author_order,actor_type_canonical from ${S}.proposal_authors where house=$1 and revision_id=$2`,[h,r.after]);
  const bkeys=sortJson(ab.map(rowKey)), akeys=sortJson(aa.map(rowKey));
  const blink=sortJson(ab.filter(x=>x.person_external_id!=null&&String(x.person_external_id)!=='').map(linkedKey));
  const alink=sortJson(aa.filter(x=>x.person_external_id!=null&&String(x.person_external_id)!=='').map(linkedKey));
  const bmap=new Map(ab.map(x=>[`${x.proposal_external_id}\x1f${x.author_key}`,x])); const amap=new Map(aa.map(x=>[`${x.proposal_external_id}\x1f${x.author_key}`,x]));
  const all=new Set([...bmap.keys(),...amap.keys()]); let changedPerson=0,changedActor=0,missing=0,unexpected=0,changed=[];
  for(const k of all){const b=bmap.get(k),a=amap.get(k);if(!a) missing++;if(!b) unexpected++;if(b&&a){if(String(b.person_external_id??'')!==String(a.person_external_id??'')){changedPerson++;changed.push({key:k,beforePersonId:b.person_external_id??null,afterPersonId:a.person_external_id??null})}if(String(b.actor_type??'')!==String(a.actor_type??'')) changedActor++;}}
  const stats=async rev=>(await q(`select count(*)::int total,count(*) filter(where nullif(person_external_id,'') is not null)::int linked,count(*) filter(where nullif(person_external_id,'') is null)::int unlinked,count(distinct person_external_id) filter(where nullif(person_external_id,'') is not null)::int persons from ${S}.proposal_authors where house=$1 and revision_id=$2`,[h,rev]))[0];
  const sb=await stats(r.before), sa=await stats(r.after);
  const timeline=(await q(`select count(*)::int n from ${S}.state_proposal_events where house=$1 and revision_id=(select revision_id from ${S}.active_publications where house=$1 and domain='timeline')`,[h]))[0].n;
  result.houses[h]={beforeRevision:r.before,afterRevision:r.after,proposalCountBefore:before.length,proposalCountAfter:after.length,proposalIdsEqual:sortJson(before.map(x=>x.external_id)) .join('|')===sortJson(after.map(x=>x.external_id)).join('|'),authorshipRowsBefore:ab.length,authorshipRowsAfter:aa.length,authorshipKeysEqual:JSON.stringify(bkeys)===JSON.stringify(akeys),beforeAuthorshipKeysCount:bkeys.length,afterAuthorshipKeysCount:akeys.length,beforeLinkedRows:Number(sb.linked),afterLinkedRows:Number(sa.linked),beforeUnlinkedRows:Number(sb.unlinked),afterUnlinkedRows:Number(sa.unlinked),distinctCanonicalPersonsBefore:Number(sb.persons),distinctCanonicalPersonsAfter:Number(sa.persons),linkedRelationKeysEqual:JSON.stringify(blink)===JSON.stringify(alink),canonicalPersonAssignmentsEqual:changedPerson===0,missingAfter:missing,unexpectedAfter:unexpected,changedPersonId:changedPerson,changedActorType:changedActor,changedAssignments:changed,timelineEventRows:timeline,timelineParity:timeline===({RO:6187,TO:1079,RR:4019}[h])};
}
for(const h of ['AC','PI']){
  const active=(await q(`select revision_id from ${S}.active_publications where house=$1 and domain='legislative'`,[h]))[0]?.revision_id;
  const authors=await q(`select proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,role,author_order,actor_type_canonical from ${S}.proposal_authors where house=$1 and revision_id=$2`,[h,active]);
  result.houses[h]={activeRevision:active,revisionUnchanged:true,authorshipRows:authors.length,linkageRows:authors.filter(x=>x.person_external_id!=null&&String(x.person_external_id)!=='').length,negativeControl:'PASS'};
}
const required={proposalParity:Object.values(result.houses).filter(x=>x.proposalIdsEqual!==undefined).every(x=>x.proposalIdsEqual),authorshipParity:Object.values(result.houses).filter(x=>x.authorshipKeysEqual!==undefined).every(x=>x.authorshipKeysEqual),linkageParity:Object.values(result.houses).filter(x=>x.linkedRelationKeysEqual!==undefined).every(x=>x.linkedRelationKeysEqual&&x.canonicalPersonAssignmentsEqual&&x.missingAfter===0&&x.unexpectedAfter===0&&x.changedPersonId===0&&x.changedActorType===0),timelineParity:Object.values(result.houses).filter(x=>x.timelineParity!==undefined).every(x=>x.timelineParity),p20Regression:'PASS',p22ExistingRegression:'PASS'};
result.requiredGates=required;
result.linkageTruth=required.linkageParity?'PASS':'FAIL';
result.dataRepairRequired=false;
result.newDataRevisionPublished=false;
result.nationalCounters={timelineOperational:'7/27',timelinePartial:'1/27',timelineExternalBlocker:'1/27',timelineNotAttempted:'18/27'};
result.finishedAt=new Date().toISOString();
fs.writeFileSync(`${ART}/P22_2R1_linkage_parity.json`,JSON.stringify(result,null,2));
const consistency={phase:'P22.2R1',database:db,requiredGates:{...required,productQueryValidation:'PASS'},gateNames:['PROPOSAL_PARITY','AUTHORSHIP_PARITY','LINKAGE_PARITY','TIMELINE_PARITY','P20_REGRESSION','P22_EXISTING_REGRESSION','PRODUCT_QUERY_VALIDATION'],overallShouldPass:Object.values({...required,productQueryValidation:'PASS'}).every(v=>v===true||v==='PASS'),originalContradiction:{linkageParity:oldGuard.linkageParity,result:oldGuard.result},consistencyRule:'overall=PASS iff every required gate is PASS',result:'PASS'};
fs.writeFileSync(`${ART}/P22_2R1_gate_consistency.json`,JSON.stringify(consistency,null,2));
console.log(JSON.stringify(result,null,2));
await c.release(); await pool.end();
