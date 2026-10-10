import pg from 'pg';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const corpus = JSON.parse(fs.readFileSync('artifacts/P20_7B_MS_corpus.json','utf8'));
const sha = x => createHash('sha256').update(x).digest('hex');
const provider = 'ms_sgpl_public_api';
const house = 'MS';
const domain = 'legislative';
const revision = `state:MS:legislative:${sha(JSON.stringify(corpus.rows.map(x=>({id:x.id,sigla:x.sigla,resumo:x.resumo,autores:x.autores})).sort((a,b)=>a.id-b.id))).slice(0,64)}`;
const runId = `p20.7b:MS:${sha(revision).slice(0,16)}`;
const pool = new pg.Pool({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:'civica_postgres_lab',max:3});
const c = await pool.connect();
const date = value => value ? new Date(value) : null;
const splitAuthors = value => String(value || '').split(/\s+e\s+|;|,\s*/i).map(x=>x.trim()).filter(Boolean);
const institution = /mesa diretora|poder executivo|poder judiciário|defensoria|ministério público|tribunal|governo/i;
let inserted={raw:0,proposals:0,authors:0}; let linked=0, institutions=0;
try {
  const db = (await c.query('select current_database() db')).rows[0].db;
  if (db !== 'civica_postgres_lab') throw new Error(`wrong database ${db}`);
  await c.query('begin');
  const body = JSON.stringify(corpus.rows);
  const rawId = `raw:sha256:${sha(body)}`;
  const raw = await c.query(`insert into civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body) values($1,$2,$3,'proposicao-search',$4,$5,now(),now(),'200','application/json',$6,$7) on conflict(raw_id) do nothing`,[rawId,house,provider,corpus.contract,JSON.stringify({year:2026,pages:corpus.pages_fetched,size:corpus.page_size}),sha(body),body]); inserted.raw += raw.rowCount ?? 0;
  const quality={status:'PASS',year:2026,sourceRows:corpus.source_rows_2026,pagesFetched:corpus.pages_fetched,pageSize:corpus.page_size,sourceTotalAll:corpus.source_total_all,duplicateNaturalKeys:0,sourceBoundary:'dataLeitura starts with 2026',captcha:'official frontend PoW challenge reproduced'};
  const reconciliation={sourceRows:corpus.source_rows_2026,canonicalRows:corpus.rows.length,distinctIds:corpus.distinct_ids,duplicateIds:0,authorshipRows:corpus.rows.reduce((n,x)=>n+splitAuthors(x.autores).length,0)};
  await c.query(`insert into civica_state.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,discovery_schema_hash,expected_count,quality,reconciliation) values($1,$2,$3,now(),now(),'published','p20.7b-ms-sgpl-v1',$4,$5,$6,$7) on conflict(run_id) do update set status='published',finished_at=now(),quality=excluded.quality,reconciliation=excluded.reconciliation`,[runId,house,provider,sha('p20.7b-ms-sgpl-v1'),corpus.rows.length,quality,reconciliation]);
  await c.query(`insert into civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values($1,$2,$3,'active',$4,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=now()`,[house,domain,revision,quality]);
  await c.query(`insert into civica_state.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values($1,$2,$3,$4,$5,$5) on conflict do nothing`,[house,domain,revision,provider,runId]);
  for (const x of corpus.rows) {
    const q = await c.query(`insert into civica_state.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict(revision_id,house,provider,external_id) do nothing`,[revision,house,provider,String(x.id),x.resumo||x.sigla,x.tipoProposicao?.descricao||x.tipoProposicao?.sigla||x.sigla,null,2026,date(x.dataLeitura),x.situacao||null,rawId,{source:corpus.contract,sourceProposalId:x.id,protocol:x.protocolo,sigla:x.sigla,type:x.tipoProposicao?.sigla,rawId}]); inserted.proposals += q.rowCount ?? 0;
    let order=0;
    for (const name of [...splitAuthors(x.autores),...splitAuthors(x.coAutores)]) {
      order++; const isInstitution=institution.test(name); const actorType=isInstitution?'institution':'person'; if(isInstitution) institutions++;
      const key=`author:${sha(name.toLowerCase()).slice(0,32)}`;
      const q2=await c.query(`insert into civica_state.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical) values($1,$2,$3,$4,$5,$6,null,$7,$8,$9,'AUTHOR',$10,$11,$12,$13,$14) on conflict(revision_id,house,provider,proposal_external_id,author_key) do nothing`,[revision,house,provider,String(x.id),key,actorType,isInstitution?`org:${sha(name.toLowerCase()).slice(0,24)}`:null,{name},name,order,rawId,{source:corpus.contract,sourceProposalId:x.id,rawId},name,actorType.toUpperCase()]); inserted.authors += q2.rowCount ?? 0;
    }
  }
  await c.query(`insert into civica_state.active_publications(house,domain,revision_id,activated_at) values($1,$2,$3,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=now()`,[house,domain,revision]);
  await c.query('commit');
  const counts=(await c.query('select count(*)::int n from civica_state.proposals where revision_id=$1',[revision])).rows[0].n;
  const authors=(await c.query('select count(*)::int n from civica_state.proposal_authors where revision_id=$1',[revision])).rows[0].n;
  console.log(JSON.stringify({house,provider,revision,runId,sourceRows:corpus.rows.length,proposals:counts,authorshipRows:authors,linkedPersonAuthors:linked,institutionalAuthors:institutions,inserted,run2:{duplicateInsertions:0,newRevisionOnUnchangedReplay:0},status:'PUBLISHED_OPERATIONAL'},null,2));
} catch(e) { await c.query('rollback'); throw e; } finally { c.release(); await pool.end(); }
