import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)process.env[line.slice(0,i)]=line.slice(i+1)}
const m=await import(pathToFileURL(process.cwd()+'/apps/web/lib/data-postgres-wave4.ts').href);
const d=await import(pathToFileURL(process.cwd()+'/apps/web/lib/data-postgres.ts').href);
for(const p of ['partyLanding','partyDetail']){const x=await m[p](p==='partyLanding'?2026:'PL',2026); console.log(p,JSON.stringify(p==='partyLanding'?x.data.operations:x.data.financial,null,2));}
console.log('ops',JSON.stringify(await m.loadPublishedHouseOperations('camara',2026),null,2));
console.log('listing',JSON.stringify((await d.propositionListing({year:2026,page:1,pageSize:20})).data.dashboard.houses.map(x=>({source:x.source,to:x.stages.agendaCoverage?.to})),null,2));
