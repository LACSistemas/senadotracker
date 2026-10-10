import {chromium} from '@playwright/test';
const b=await chromium.launch({headless:true});const p=await b.newPage();p.on('request',r=>{if(r.url().includes('CardView'))console.log('REQ',r.postData()?.match(/__DXCallbackArgument=([^&]+)/)?.[1]?.slice(0,250))});
await p.goto('https://www.alepa.pa.gov.br/Legislativo/Proposicoes?ano=2026',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForTimeout(10000);
async function clickText(t:string){const l=p.locator('#cardViewProposicoes_DXPagerTop a').filter({hasText:new RegExp('^'+t+'$')}).first();console.log('click',t,await l.count());if(await l.count()){await l.click();await p.waitForTimeout(6000);console.log('current',await p.locator('#cardViewProposicoes_DXPagerTop .dxp-current').innerText().catch(()=>''),'links',await p.locator('#cardViewProposicoes_DXPagerTop a.dxp-num').allTextContents());}}
await clickText('7');await clickText('10');await b.close();

