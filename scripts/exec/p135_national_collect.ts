import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE='https://api-publica.obrasgov.gestao.gov.br/obras';
const ROOT='D:/Civica/staging/infraestrutura/obras/obrasgov/national-2026-10-30';
const CP='D:/Civica/staging/infraestrutura/obras/checkpoints';
const SIZE=200;
const CONCURRENCY=24;
const UA='civica-p135r/1.0 (dados abertos; coleta read-only)';
const resources=[['projetos','/projeto-investimento'],['geometrias','/geometria'],['execucao_fisica','/execucao-fisica'],['contratos','/contrato'],['empenhos','/empenho'],['historico_situacao','/historico-situacao-cancelada-paralisada'],['estudos','/estudo-viabilidade']] as const;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function atomic(file:string, body:string){const tmp=file+'.tmp-'+process.pid; await writeFile(tmp,body,'utf8'); await rename(tmp,file);}
async function json(url:string){let last='';for(let a=1;a<=5;a++){try{const r=await fetch(url,{headers:{'User-Agent':UA,'Referer':BASE+'/docs'},signal:AbortSignal.timeout(90000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return {status:r.status,body:await r.json() as any};}catch(e){last=String(e);if(a<5)await sleep(700*a);}}throw new Error(`${url}: ${last}`);}
async function exists(f:string){try{await access(f);return true}catch{return false}}
async function main(){await mkdir(ROOT,{recursive:true});await mkdir(CP,{recursive:true});const upd=await json(BASE+'/data-atualizacao');const updateVersion=String(upd.body.data_ultima_atualizacao);await atomic(path.join(ROOT,'data-atualizacao.json'),JSON.stringify({url:BASE+'/data-atualizacao',httpStatus:upd.status,fetchedAt:new Date().toISOString(),...upd.body},null,2));
 const summary:any={provider:'Obrasgov',base:BASE,openapi:'https://api-publica.obrasgov.gestao.gov.br/obras/openapi.json',sourceUpdatedAtStart:updateVersion,pageSize:SIZE,startedAt:new Date().toISOString(),resources:[]};
 for(const [name,endpoint] of resources){const dir=path.join(ROOT,'pages',name);await mkdir(dir,{recursive:true});const cpFile=path.join(CP,`p135r-${name}.json`);let cp:any=null;if(await exists(cpFile)){try{cp=JSON.parse(await readFile(cpFile,'utf8'))}catch{cp=null}}
  let first:any; if(cp?.totalPages){first=cp.firstPayload}else{first=(await json(`${BASE}${endpoint}?pagina=1&tamanho_da_pagina=${SIZE}`)).body; if(!Array.isArray(first.data))throw new Error(`${name}: envelope data inválido`);cp={resource:name,endpoint,openapiVersion:'1.0',sourceUpdatedAt:updateVersion,parameters:{pagina:'1..N',tamanho_da_pagina:SIZE},totalPages:Number(first.total_pages),sourceTotal:Number(first.total_items),lastCompletedPage:0,pagesDownloaded:0,pagesValidated:0,rowsDownloaded:0,rowsValidated:0,retries:0,errors:[],state:'DOWNLOADING',firstPayload:first};await atomic(cpFile,JSON.stringify(cp,null,2));}
  const total=Number(cp.totalPages);if(!Number.isFinite(total)||total<1)throw new Error(`${name}: total_pages inválido`);
  const pending:number[]=[];for(let p=1;p<=total;p++){const f=path.join(dir,`page-${String(p).padStart(6,'0')}.json`);if(!(await exists(f)))pending.push(p)}
  let done=total-pending.length;for(let i=0;i<pending.length;i+=CONCURRENCY){const chunk=pending.slice(i,i+CONCURRENCY);const got=await Promise.all(chunk.map(async p=>{const f=path.join(dir,`page-${String(p).padStart(6,'0')}.json`);const out=await json(`${BASE}${endpoint}?pagina=${p}&tamanho_da_pagina=${SIZE}`);const b=out.body;if(!Array.isArray(b.data)||Number(b.page_number)!==p||Number(b.page_size)<1||Number(b.page_size)>SIZE||Number(b.data.length)>SIZE)throw new Error(`${name} page ${p}: envelope inconsistente`);await atomic(f,JSON.stringify(b));return {p,rows:b.data.length,sha256:createHash('sha256').update(JSON.stringify(b)).digest('hex')};}));for(const x of got){done++;cp.lastCompletedPage=Math.max(cp.lastCompletedPage,x.p);cp.pagesDownloaded++;cp.pagesValidated++;cp.rowsDownloaded+=x.rows;cp.rowsValidated+=x.rows;}cp.state='PAGE_VALIDATED';await atomic(cpFile,JSON.stringify(cp,null,2));if(done%40===0||done===total)console.log(`${name}: ${done}/${total}`)}
  cp.state='RESOURCE_COMPLETE';cp.finishedAt=new Date().toISOString();await atomic(cpFile,JSON.stringify(cp,null,2));summary.resources.push({name,endpoint,sourceTotal:cp.sourceTotal,pagesExpected:total,pagesDownloaded:total,pagesValidated:total,rowsDownloaded:cp.rowsDownloaded,checkpoint:cpFile});
 }
 const end=await json(BASE+'/data-atualizacao');summary.sourceUpdatedAtEnd=String(end.body.data_ultima_atualizacao);summary.finishedAt=new Date().toISOString();await atomic(path.join(ROOT,'collection-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
