import {chromium} from '@playwright/test';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try{
  for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.goto('http://127.0.0.1:3107/legislativo/rankings?casa=camara&uf=SP',{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent,bodyWidth:document.body.scrollWidth,viewport:window.innerWidth,tableWidth:document.querySelector('table')?.scrollWidth,tableViewport:document.querySelector('table')?.parentElement?.clientWidth,rows:document.querySelectorAll('tbody tr').length}));
    console.log(JSON.stringify({width,...result}));
    if(result.bodyWidth>width+2||result.rows!==10)throw new Error(`Layout inesperado em ${width}px`);
    await page.close();
  }
}finally{await browser.close()}
