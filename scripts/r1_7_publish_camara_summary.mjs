import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const c=await p.connect();
try {
  const run=(await c.query("select reconciliation_json from civica.ingestion_runs where id='pg-house-operations:camara:2026' and source='camara'")).rows[0];
  if(!run) throw new Error('camara house operations run missing');
  const raw=(await c.query("select id from civica.raw_objects order by fetched_at desc limit 1")).rows[0]?.id;
  const summary=run.reconciliation_json?.summary ?? run.reconciliation_json;
  const id=`pg-r1-7-house-summary:camara:${Date.now()}`; const now=new Date().toISOString();
  const payload={source:'camara',externalKey:'house-operations:2026',kind:'reconciliation',personExternalId:null,proposalId:null,deliberationId:null,bodyId:null,occurredAt:now.slice(0,10),label:'Indicadores institucionais da Casa',value:JSON.stringify(summary),officialUrl:'https://dadosabertos.camara.leg.br/api/v2/proposicoes',rawId:raw};
  await c.query('begin');
  await c.query("insert into civica.ingestion_runs(id,source,started_at,finished_at,status,parser_version,roster_complete,expected_count,reconciliation_json) values($1,'camara',$2,$2,'published','r1-7-house-summary',1,$3,$4)",[id,now,summary?.received??summary?.backlog??null,JSON.stringify(summary)]);
  await c.query("insert into civica.complement_batches(id,source,scope,published_at,record_count,reconciliation_json) values($1,'camara','house-operations-2026',$2,1,$3)",[id,now,JSON.stringify(summary)]);
  await c.query("insert into civica.legislative_complements(batch_id,source,external_key,kind,person_external_id,proposal_id,deliberation_id,body_id,occurred_at,raw_id,payload) values($1,'camara','house-operations:2026','reconciliation',null,null,null,null,$2,$3,$4)",[id,now.slice(0,10),raw,JSON.stringify(payload)]);
  await c.query("insert into civica.active_complement_publications(source,scope,batch_id) values('camara','house-operations-2026',$1) on conflict(source,scope) do update set batch_id=excluded.batch_id",[id]);
  await c.query('commit'); console.log(JSON.stringify({id,summary},null,2));
} catch(e) { await c.query('rollback'); throw e; } finally {c.release();await p.end();}
