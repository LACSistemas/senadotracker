import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
let n=0;const sleep=(x:number)=>new Promise(r=>setTimeout(r,x));
const f:typeof fetch=async(input,init)=>{n++;const r=await fetch(input,init);if(r.status>=500)console.log('ERR_REQ',n,String(input));return r};
try{const r=await runAlepaDevexpress({limit:1,pages:Array.from({length:12},(_,i)=>i),year:2026,fetchImpl:f});console.log('OK',r.pages.length)}catch(e){console.log('ERR',n,String(e))}

