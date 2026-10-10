import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
const sleep=(n:number)=>new Promise(r=>setTimeout(r,n));
const fetchRetry: typeof fetch = async (input,init) => { for(let i=0;i<6;i++){ const r=await fetch(input,init); if(r.status<500) return r; await sleep(1000*(i+1)); } return fetch(input,init); };
for(const end of [2,10]){try{const r=await runAlepaDevexpress({limit:1,pages:Array.from({length:end},(_,i)=>i),year:2026,fetchImpl:fetchRetry});console.log('END',end,'OK',r.pages.length,r.pages.at(-1)?.keys.length)}catch(e){console.log('END',end,'ERR',String(e))}}

