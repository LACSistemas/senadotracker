import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts/proposicoes-flagship',{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:3214/legislativo/proposicoes',{waitUntil:'networkidle'});
await page.screenshot({path:'artifacts/proposicoes-flagship/desktop-v4.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.reload({waitUntil:'networkidle'});
await page.screenshot({path:'artifacts/proposicoes-flagship/mobile-v4.png',fullPage:true});
console.log(JSON.stringify({h1:await page.locator('h1').allInnerTexts(),h2:await page.locator('h2').allInnerTexts(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)}));
await browser.close();




