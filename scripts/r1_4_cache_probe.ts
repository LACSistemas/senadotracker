import { readFile } from 'node:fs/promises';
import { parseSenateCommissionAgenda } from '../apps/collector/src/senate-agenda.ts';
const all:any[]=[];
for(let m=1;m<=12;m++){
 const f=`data/cache/senate-agenda/2026${String(m).padStart(2,'0')}.json`;
 try{const d=JSON.parse(await readFile(f,'utf8'));all.push(...parseSenateCommissionAgenda(d,`cache:${m}`,'2026-01-01','2026-12-31'));}catch{}
}
const u=[...new Map(all.map(x=>[x.externalKey,x])).values()];
console.log({items:u.length,matters:new Set(u.map(x=>x.proposalId)).size,max:u.reduce((v,x)=>v>x.occurredAt?v:x.occurredAt,'')});
