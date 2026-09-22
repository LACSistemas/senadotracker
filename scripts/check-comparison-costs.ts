import {chromium} from '@playwright/test';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try{
  const url='http://127.0.0.1:3107/comparar?modo=parlamentares&casa=senado&ano=2026&pessoas=5973%2C5990%2C6335';
  for(const width of [390,1280,780]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.route('**/_next/image*',route=>route.abort());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    if(width===780)await page.evaluate(()=>{document.documentElement.style.zoom='2'});
    const result=await page.evaluate(()=>({bodyWidth:document.body.scrollWidth,viewport:window.innerWidth,heading:document.body.innerText.includes('Gasto parlamentar total'),composition:document.body.innerText.includes('Composição dos gastos'),oldHeading:document.body.innerText.includes('Composição da cota por categoria'),count:document.body.innerText.includes('149'),month:document.body.innerText.includes('2026-08'),overflow:[...document.querySelectorAll('body *')].filter(element=>element.getBoundingClientRect().right>window.innerWidth+2).slice(-15).map(element=>({tag:element.tagName,cls:element.className.toString().slice(0,90),right:Math.round(element.getBoundingClientRect().right)}))}));
    console.log(JSON.stringify({width,...result}));
    if(!result.heading||!result.composition||result.oldHeading||!result.count||!result.month||result.bodyWidth>width+2)throw new Error(`Comparação inválida em ${width}px`);
    await page.close();
  }
}finally{await browser.close()}
