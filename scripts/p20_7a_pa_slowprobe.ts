import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
const sleep=(x:number)=>new Promise(r=>setTimeout(r,x));let n=0;
const f:typeof fetch=async(input,init)=>{await sleep(900);for(let i=0;i<4;i++){const r=await fetch(input,init);n++;if(r.status<500)return r;await sleep(2000)}return fetch(input,init)};
try{const r=await runAlepaDevexpress({limit:1,pages:Array.from({length:21},(_,i)=>i),year:2026,fetchImpl:f});console.log('OK',r.pages.length)}catch(e){console.log('ERR',n,String(e))}

