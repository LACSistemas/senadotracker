import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
const run=await runAlepaDevexpress({limit:10,pages:[0,1],year:2026});console.log(JSON.stringify({pages:run.pages,proposals:run.proposals.length,authors:run.proposals.reduce((n,p)=>n+p.authors.length,0),requests:run.metrics.requests},null,2));
