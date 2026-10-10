import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
for(const end of [10,25,50,100,150,187]){try{const r=await runAlepaDevexpress({limit:1,pages:Array.from({length:end},(_,i)=>i),year:2026});console.log('END',end,'OK',r.pages.length)}catch(e){console.log('END',end,'ERR',String(e))}}

