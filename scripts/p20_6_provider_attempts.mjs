import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';

const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const configs = [
  ['SE','alese_legis','https://aleselegis.al.se.leg.br/legislacao/consulta.aspx','ASP.NET ViewState / form postback'],
  ['PA','alepa_callback','https://www.alepa.pa.gov.br/Legislativo/Proposicoes','DevExpress CallbackPanelProposicoes'],
  ['PR','alep_activity','https://consultas.assembleia.pr.leg.br/','SPA XLSX/API consultation'],
  ['RJ','alerj_lotus_legislative','https://www.alerj.rj.gov.br/ResultadoPesquisa/MontaTelaPesquisa','Lotus HTML research'],
  ['BA','alba_spl','https://www.al.ba.gov.br/atividade-legislativa/proposicoes','SPL/Nopaper filters'],
  ['ES','ales_legislative','https://www.al.es.gov.br/Proposicao','legacy ASP.NET redirect'],
  ['MT','almt_legislative','https://www.al.mt.gov.br/proposicao','ALMT HTML/API'],
  ['MS','sgpl_ms','https://sgpl.consulta.al.ms.gov.br/sgpl-publico/','SGPL SPA'],
  ['GO','alego_legislative','https://portal.al.go.leg.br/poderlegislativo','ALEGO process query'],
  ['RS','alrs_legislative','https://www.al.rs.gov.br','ALRS legislative service'],
  ['MA','alemalegis','https://alemalegis.al.ma.leg.br/','ALEMALEGIS Angular migration'],
];
const sha = v => createHash('sha256').update(v).digest('hex');
const out=[]; const pool=new pg.Pool({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:'civica_postgres_lab',max:3}); const c=await pool.connect();
try {
  if((await c.query('select current_database() db')).rows[0].db!=='civica_postgres_lab') throw Error('wrong DB');
  for(const [house,provider,url,contract] of configs){
    const started=new Date().toISOString(); let status=0,finalUrl=url,contentType=null,body='',error=null,redirect=null;
    try { const r=await fetch(url,{redirect:'manual',headers:{'user-agent':'Civica-P20.6-provider/1.0'}}); status=r.status; finalUrl=r.headers.get('location')||url; redirect=r.headers.get('location'); contentType=r.headers.get('content-type'); body=await r.text();
      if(status>=300&&status<400&&redirect){ const rr=await fetch(new URL(redirect,url),{headers:{'user-agent':'Civica-P20.6-provider/1.0'}}); finalUrl=rr.url; status=rr.status; contentType=rr.headers.get('content-type'); body=await rr.text(); }
    } catch(e){ error=String(e); }
    const bodySha=sha(body); const rawId=`raw:sha256:${bodySha}`; const runId=`p20.6:${house}:${sha(provider).slice(0,16)}`;
    if(body){ await c.query(`insert into civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body) values($1,$2,$3,'legislative-contract',$4,$5,now(),now(),$6,$7,$8,$9) on conflict(raw_id) do nothing`,[rawId,house,provider,url,JSON.stringify({year:2026,contract}),status,contentType,bodySha,body]); }
    await c.query(`insert into civica_state.checkpoints(house,provider,domain,resource,shard,cursor,page,year,last_external_id,updated_at,run_id,status) values($1,$2,'legislative','provider-contract','2026',$3,null,2026,null,now(),$4,$5) on conflict(house,provider,domain,resource,shard) do update set cursor=excluded.cursor,updated_at=excluded.updated_at,run_id=excluded.run_id,status=excluded.status`,[house,provider,status?`HTTP_${status}`:'ERROR',runId,status>=200&&status<500?'failed':'failed']);
    out.push({house,provider,contract,url,status,finalUrl,redirect,contentType,bytes:body.length,rawId,sha256:bodySha,attemptedAt:started,enumeration:'NOT_EXECUTED',finalStatus:'IMPLEMENTATION_NOT_COMPLETED',failureClass:error?'EXTERNAL_HTTP_BLOCKER':'IMPLEMENTATION_NOT_COMPLETED',internalWorkRemaining:true,error});
  }
} finally { c.release(); await pool.end(); }
writeFileSync('artifacts/P20_6_provider_attempts.json',JSON.stringify(out,null,2)); console.log(JSON.stringify(out.map(x=>({house:x.house,status:x.status,bytes:x.bytes,provider:x.provider})),null,2));
