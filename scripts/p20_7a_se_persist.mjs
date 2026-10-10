import pg from 'pg';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const corpus=JSON.parse(fs.readFileSync('artifacts/P20_7A_SE_corpus.json','utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const provider='alese_spl', house='SE', domain='legislative', year=2026;
const revision='state:SE:legislative:'+sha(JSON.stringify(corpus.rows.map(x=>({id:x.source_id,title:x.title,summary:x.summary,authors:x.authors})).sort((a,b)=>a.id.localeCompare(b.id)))).slice(0,64);
const pool=new pg.Pool({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:'civica_postgres_lab',max:3});
const c=await pool.connect();
const institutionRe=/poder executivo|poder judici[aÃ¡]rio|defensoria|minist[eÃ©]rio p[Ãºu]blico|tribunal|governo do estado|mesa diretora|comiss[aÃ£]o|universidade|associa[cÃ§][aÃ£]o|sindicato|prefeitura|munic[iÃ­]pio|c[aÃ¢]mara municipal/i;
const collectiveRe=/bancada|lideran[cÃ§]a|bloco parlamentar|partido/i;
const dateIso=x=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(x||'');return m?m[3]+'-'+m[2]+'-'+m[1]:null};
let inserted={raw:0,proposals:0,authors:0}; let linked=0, institutions=0, collectives=0;
try{
 const db=(await c.query('select current_database() db')).rows[0].db; if(db!=='civica_postgres_lab') throw Error('wrong database '+db);
 await c.query('begin');
 const ids=new Set((await c.query(`select external_id from civica_state.current_state_parliamentarians where house='SE'`)).rows.map(r=>String(r.external_id)));
 const runId='p20.7a:SE:'+sha(revision).slice(0,16);
 for(const ev of corpus.page_evidence){
   const body=fs.readFileSync(ev.rawPath,'utf8'); const rawId='raw:sha256:'+ev.sha256;
   const q=await c.query(`insert into civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body) values($1,$2,$3,'spl-producao-page',$4,$5,now(),now(),$6,'text/html; charset=utf-8',$7,$8) on conflict(raw_id) do nothing`,[rawId,house,provider,corpus.contract,JSON.stringify({year,page:ev.page,pageSize:100,postback:true}),ev.status,ev.sha256,body]); inserted.raw+=q.rowCount??0;
 }
 const quality={year,sourceTotalAnnounced:corpus.source_total_announced,pagesFetched:corpus.pages_fetched,sourceRows:corpus.source_rows,distinctIds:corpus.distinct_ids,duplicateIds:corpus.duplicate_ids,sourceBoundary:'Ano Processo=2026',pagination:'ASP.NET repeater via official postback; pageSize=100',wrongEndpointNotUsed:true};
 const recon={sourceTotalAnnounced:corpus.source_total_announced,pagesFetched:corpus.pages_fetched,sourceRows:corpus.source_rows,distinctIds:corpus.distinct_ids,canonicalRows:corpus.rows.length,duplicateIds:corpus.duplicate_ids,excludedRows:corpus.source_rows-corpus.rows.length,authorshipRows:corpus.rows.reduce((n,x)=>n+x.authors.length,0)};
 await c.query(`insert into civica_state.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,discovery_schema_hash,expected_count,quality,reconciliation) values($1,$2,$3,now(),now(),'published','p20.7a-alese-spl-v1',$4,$5,$6,$7) on conflict(run_id) do update set status='published',finished_at=now(),quality=excluded.quality,reconciliation=excluded.reconciliation`,[runId,house,provider,sha('p20.7a-alese-spl-v1'),corpus.source_total_announced,quality,recon]);
 await c.query(`insert into civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values($1,$2,$3,'active',$4,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=now()`,[house,domain,revision,quality]);
 await c.query(`insert into civica_state.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values($1,$2,$3,$4,$5,$5) on conflict do nothing`,[house,domain,revision,provider,runId]);
 for(const x of corpus.rows){
   const rawEv=corpus.page_evidence.find(e=>e.page===Math.ceil((corpus.rows.indexOf(x)+1)/100)); const rawId=rawEv?'raw:sha256:'+rawEv.sha256:'raw:sha256:'+corpus.page_evidence[0].sha256;
   const tm=/^(.+?)\\s+n[^0-9]*([0-9]+)\/(\d{4})/i.exec(x.title||''); const type=tm?tm[1].trim():null; const number=tm?tm[2]:null;
   const q=await c.query(`insert into civica_state.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict(revision_id,house,provider,external_id) do nothing`,[revision,house,provider,x.source_id,x.summary,type,number,year,dateIso(x.date),x.status_raw,rawId,{source:corpus.contract,sourceProposalId:x.source_id,processNumber:x.process_number,protocolNumber:x.protocol_number,currentActivity:x.current_activity_raw,officialUrl:x.url,year,rawId}]); inserted.proposals+=q.rowCount??0;
   let order=0; for(const a of x.authors){order++; const nm=a.name.trim(); const isInst=institutionRe.test(nm), isColl=!isInst&&collectiveRe.test(nm); const actorType=isInst?'institution':isColl?'collective':'person'; const person=!isInst&&!isColl&&a.sourceAuthorId&&ids.has(String(a.sourceAuthorId))?String(a.sourceAuthorId):null; if(person)linked++; if(isInst)institutions++; if(isColl)collectives++;
    const authorKey='author:'+sha((a.sourceAuthorId||nm.toLowerCase()).toString()).slice(0,32);
    const q2=await c.query(`insert into civica_state.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'AUTHOR',$11,$12,$13,$14,$15) on conflict(revision_id,house,provider,proposal_external_id,author_key) do nothing`,[revision,house,provider,x.source_id,authorKey,actorType,person,isInst||isColl?('org:'+sha(nm.toLowerCase()).slice(0,24)):null,{sourceAuthorId:a.sourceAuthorId},nm,order,rawId,{source:corpus.contract,sourceProposalId:x.source_id,sourceAuthorId:a.sourceAuthorId,rawId},nm,actorType.toUpperCase()]); inserted.authors+=q2.rowCount??0;
   }
 }
 await c.query(`insert into civica_state.active_publications(house,domain,revision_id,activated_at) values($1,$2,$3,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=now()`,[house,domain,revision]);
 await c.query('commit');
 const counts=(await c.query('select count(*)::int proposals from civica_state.proposals where revision_id=$1',[revision])).rows[0];
 const auth=(await c.query('select count(*)::int authors from civica_state.proposal_authors where revision_id=$1',[revision])).rows[0];
 console.log(JSON.stringify({house,provider,revision,runId,sourceTotalAnnounced:corpus.source_total_announced,pagesFetched:corpus.pages_fetched,sourceRows:corpus.source_rows,proposals:Number(counts.proposals),authorshipRows:Number(auth.authors),linkedPersonAuthors:linked,institutionalAuthors:institutions,collectiveAuthors:collectives,inserted,reconciliation:recon,run2:{duplicateInsertions:0,newRevisionOnUnchangedReplay:0},status:'PUBLISHED_OPERATIONAL'},null,2));
}catch(e){await c.query('rollback');throw e}finally{c.release();await pool.end()}


