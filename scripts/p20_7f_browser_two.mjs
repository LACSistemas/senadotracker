import fs from 'node:fs'; import crypto from 'node:crypto';
import { chromium } from '@playwright/test';
const out={house:process.argv[2],events:[],pages:[]};
const base=out.house==='ES'?'https://www3.al.es.gov.br/spl/consulta-producao.aspx?tipo=18&ano_proposicao=2026':'https://albalegis.nopapercloud.com.br/spl/consulta-producao.aspx?tipo=3&ano_proposicao=2026';
const b=await chromium.launch({headless:true});const p=await b.newPage();p.on('request',r=>{if(['document','xhr','fetch'].includes(r.resourceType()))out.events.push({kind:'request',url:r.url(),method:r.method(),resourceType:r.resourceType(),headers:{referer:r.headers()['referer'],origin:r.headers()['origin'],xRequestedWith:r.headers()['x-requested-with']},postData:r.postData()?.slice(0,500)})});p.on('response',r=>{if(['document','xhr','fetch'].includes(r.request().resourceType()))out.events.push({kind:'response',url:r.url(),status:r.status(),resourceType:r.request().resourceType()})});
await p.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
for(let i=1;i<=2;i++){const ids=await p.locator('a[href*="processo.aspx?id="]').evaluateAll(as=>[...new Set(as.map(a=>(a.getAttribute('href').match(/[?&]id=(\d+)/)||[])[1]).filter(Boolean))]);out.pages.push({page:i,ids,url:p.url(),htmlSha:crypto.createHash('sha256').update(await p.content()).digest('hex')});const next=p.locator('#ContentPlaceHolder1_lbNext');if(!await next.count())break;await next.click({timeout:30000});await p.waitForTimeout(5000);}
await b.close();fs.writeFileSync(`artifacts/P20_7F_pagination_${out.house}.json`,JSON.stringify(out,null,2));console.log(JSON.stringify({house:out.house,pages:out.pages.map(x=>({page:x.page,count:x.ids.length,first:x.ids[0],last:x.ids.at(-1)})),events:out.events.length},null,2));


