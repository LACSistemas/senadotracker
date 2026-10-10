import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
let n=0;const f:typeof fetch=async(input,init)=>{n++;const r=await fetch(input,init);console.log(n,init?.method??'GET',String(input),r.status);return r};
try{const r=await runAlepaDevexpress({limit:1,pages:Array.from({length:12},(_,i)=>i),year:2026,fetchImpl:f});console.log('OK',r.pages.length)}catch(e){console.log('ERR',n,String(e))}

