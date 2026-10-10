import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';import fs from 'node:fs';
const r=await runAlepaDevexpress({limit:1,pages:[0,1],year:2026});for(const x of r.raw){console.log(x.envelope.resource,x.envelope.endpoint,x.body.slice(0,100));if(x.envelope.resource==='proposal-page')fs.writeFileSync('artifacts/p20_7a_pa_page1_callback.txt',x.body)};
