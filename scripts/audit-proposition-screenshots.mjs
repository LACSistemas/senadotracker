import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.AUDIT_BASE ?? 'http://127.0.0.1:3004', out='artifacts/proposicoes-id-audit-after';
const cases=[['PL-rico','camara','2599885'],['RIC','camara','2599966'],['REQ','camara','2599941'],['EMC','camara','2602063'],['PRL','camara','2599931'],['DTQ','camara','2600217'],['DOC','camara','2599899'],['REC','camara','2600339'],['PPP','camara','2600456'],['PL-rico-real','camara','2600426']];
await mkdir(out,{recursive:true}); const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:1000}}); const rows=[];
for(const [label,source,id] of cases){await p.goto(`${base}/legislativo/proposicoes/${source}/${id}`,{waitUntil:'networkidle'}); await p.screenshot({path:`${out}/${label}-desktop.png`,fullPage:true}); const main=await p.locator('main').innerText(); rows.push({label,source,id,title:await p.locator('h1').first().innerText(),headings:await p.locator('h2').allInnerTexts(),text:main.slice(0,3000)});}
for(const [label,source,id] of cases.filter(([x])=>['PL-rico-real','RIC','PRL','DTQ','DOC'].includes(x))){await p.setViewportSize({width:390,height:844});await p.goto(`${base}/legislativo/proposicoes/${source}/${id}`,{waitUntil:'networkidle'});await p.screenshot({path:`${out}/${label}-mobile.png`,fullPage:true});}
await b.close();await writeFile(`${out}/index.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(x=>({label:x.label,id:x.id,title:x.title,headings:x.headings})),null,2));
