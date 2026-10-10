import { writeFileSync } from 'node:fs';
const urls = [
 ['MG-docs','https://dadosabertos.almg.gov.br/documentacao/index'],
 ['MG-api-root','https://dadosabertos.almg.gov.br/api/v2/'],
 ['MG-proposicoes','https://dadosabertos.almg.gov.br/api/v2/proposicoes?ano=2026'],
 ['MG-processo','https://dadosabertos.almg.gov.br/api/v2/processos?ano=2026'],
 ['PE-api-root','https://dadosabertos.alepe.pe.gov.br/api/v1/'],
 ['PE-projetos','https://dadosabertos.alepe.pe.gov.br/api/v1/projetos?ano=2026'],
 ['PE-indicacoes','https://dadosabertos.alepe.pe.gov.br/api/v1/indicacoes?ano=2026'],
 ['PE-requerimentos','https://dadosabertos.alepe.pe.gov.br/api/v1/requerimentos?ano=2026'],
 ['SC-list','https://portalelegis.alesc.sc.gov.br/proposicoes/processo-legislativo?ano=2026&page=1'],
 ['SC-list-alt','https://elegis.alesc.sc.gov.br/proposicoes/processo-legislativo?ano=2026&page=1']
];
const out=[];
for(const [name,url] of urls){const started=Date.now(); try {const r=await fetch(url,{redirect:'follow',headers:{accept:'application/json,text/html,application/xml','user-agent':'civica-p20-2/1.0'}}); const b=await r.text(); out.push({name,url,status:r.status,contentType:r.headers.get('content-type'),bytes:b.length,elapsedMs:Date.now()-started,signature:b.slice(0,500),location:r.url});} catch(e){out.push({name,url,error:String(e),elapsedMs:Date.now()-started});}}
writeFileSync('artifacts/p20_2_source_probe.json',JSON.stringify({generatedAt:new Date().toISOString(),out},null,2)); console.log(JSON.stringify(out,null,2));
