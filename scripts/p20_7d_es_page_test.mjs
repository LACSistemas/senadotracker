import { chromium } from '@playwright/test';
import fs from 'node:fs';
const b = await chromium.launch({headless:true});
const p = await b.newPage();
await p.goto('https://www3.al.es.gov.br/spl/consulta-producao.aspx?tipo=18&ano_proposicao=2026',{waitUntil:'domcontentloaded',timeout:120000});
await p.locator('#ContentPlaceHolder1_ddl_ItensExibidos').selectOption('100');
await p.locator('#ContentPlaceHolder1_ddl_ItensExibidos').dispatchEvent('change');
await p.waitForTimeout(3000);
console.log('selected', await p.locator('#ContentPlaceHolder1_ddl_ItensExibidos').inputValue());
for (let i=1;i<=8;i++) {
  console.log(i, await p.locator('a[href*="processo.aspx?id="]').count(), await p.locator('#ContentPlaceHolder1_lbNext').count(), await p.locator('#ContentPlaceHolder1_lbNext').getAttribute('class').catch(()=>null));
  await p.content().then(x=>fs.writeFileSync(`artifacts/P20_7D_ES_page18_${i}.html`,x));
  if (await p.locator('#ContentPlaceHolder1_lbNext').count()===0) break;
  try { await p.locator('#ContentPlaceHolder1_lbNext').click({timeout:10000}); } catch(e) { console.log('click error', String(e)); break; }
  await p.waitForTimeout(3000);
}
await b.close();
