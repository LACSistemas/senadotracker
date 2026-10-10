import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
let n=0;const f:typeof fetch=async(input,init)=>{n++;if(n>=3)console.log('BODY',n,String(init?.body));const r=await fetch(input,init);console.log('STATUS',n,r.status);return r};
try{await runAlepaDevexpress({limit:1,pages:[0,1,2],year:2026,fetchImpl:f})}catch(e){console.log(String(e))}

