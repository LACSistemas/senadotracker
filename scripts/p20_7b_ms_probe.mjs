import {chromium} from '@playwright/test';
const b=await chromium.launch({headless:true});const p=await b.newPage();
p.on('request',r=>{if(r.url().includes('sgpl-api')) console.log('REQ',r.method(),r.url(),r.postData()?.slice(0,1200)??'')});
p.on('response',r=>{if(r.url().includes('sgpl-api')) console.log('RESP',r.status(),r.url())});
await p.goto('https://sgpl.consulta.al.ms.gov.br/sgpl-publico/#/busca-proposicoes',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(15000);console.log('title',await p.title(),'url',p.url());await b.close();
