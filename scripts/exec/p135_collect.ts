import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE = 'https://api-publica.obrasgov.gestao.gov.br/obras';
const OUT = 'D:\\Civica\\raw\\infraestrutura\\obras\\obrasgov\\2026-10-30';
const UA = 'civica-p135/1.0 (dados abertos; coleta read-only)';
const PAGE_SIZE = 200;
const CONCURRENCY = 6;
const configs = [
  ['projetos','/projeto-investimento'],
  ['execucao_fisica','/execucao-fisica'],
  ['contratos','/contrato'],
  ['geometrias','/geometria'],
  ['historico_situacao','/historico-situacao-cancelada-paralisada'],
  ['empenhos','/empenho'],
] as const;

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function getJson(path:string){
  let last='';
  for(let attempt=0;attempt<3;attempt++){
    try { const r=await fetch(BASE+path,{headers:{'User-Agent':UA,'Referer':BASE+'/docs'},signal:AbortSignal.timeout(60000)}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json() as any; }
    catch(e){last=String(e); if(attempt<2) await sleep(500*(attempt+1));}
  }
  throw new Error(last);
}
async function main(){
  await mkdir(OUT,{recursive:true});
  const updated=await getJson('/data-atualizacao');
  await writeFile(`${OUT}\\data-atualizacao.json`,JSON.stringify({url:BASE+'/data-atualizacao',httpStatus:200,fetchedAt:new Date().toISOString(),...updated},null,2));
  const result:any={provider:'Obrasgov',base:BASE,sourceUpdatedAt:updated.data_ultima_atualizacao,pageSize:PAGE_SIZE,startedAt:new Date().toISOString(),endpoints:[]};
  for(const [name,path] of configs){
    const first=await getJson(`${path}?pagina=1&tamanho_da_pagina=${PAGE_SIZE}`);
    const totalPages=Number(first.total_pages), totalItems=Number(first.total_items);
    const lines:string[]=[]; for(const x of first.data??[]) lines.push(JSON.stringify(x));
    let next=2; let completed=1;
    while(next<=totalPages){
      const pages:number[]=[]; for(let i=0;i<CONCURRENCY && next<=totalPages;i++,next++) pages.push(next);
      const payloads=await Promise.all(pages.map(p=>getJson(`${path}?pagina=${p}&tamanho_da_pagina=${PAGE_SIZE}`)));
      for(const payload of payloads) for(const x of payload.data??[]) lines.push(JSON.stringify(x));
      completed+=pages.length; if(completed%60===0) console.log(`${name}: ${completed}/${totalPages}`);
    }
    const body=lines.join('\n')+'\n'; const file=`${OUT}\\${name}.jsonl`; await writeFile(file,body,'utf8');
    const hash=createHash('sha256').update(body).digest('hex');
    const meta={provider:'Obrasgov',endpoint:path,url:BASE+path,httpStatus:200,contentType:'application/x-ndjson',fetchedAt:new Date().toISOString(),sourceUpdatedAt:updated.data_ultima_atualizacao,pageSize:PAGE_SIZE,pages:totalPages,sourceItems:totalItems,rows:lines.length,bytes:Buffer.byteLength(body),sha256:hash,rawPath:file};
    await writeFile(`${OUT}\\${name}.meta.json`,JSON.stringify(meta,null,2)); result.endpoints.push(meta); console.log(JSON.stringify(meta));
  }
  result.finishedAt=new Date().toISOString(); await writeFile(`${OUT}\\collection-summary.json`,JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
