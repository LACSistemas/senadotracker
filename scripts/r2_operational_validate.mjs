import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]})); for(const [k,v] of Object.entries(env)) if(process.env[k]===undefined) process.env[k]=v;
const m=await import('../apps/web/lib/data-postgres.ts');
const run=async()=>{const out=await m.propositionOperationalBundle(2026); if(out.status!=='available') throw new Error('operational bundle unavailable'); return out.data;};
const a=await run(); const b=await run();
const same=JSON.stringify(a)===JSON.stringify(b);
const required=['year','years','updatedThrough','overview','flow','staleness','dna','rhythm','calendar','recent','facts','themes','relation'];
const missing=required.filter(k=>!(k in a));
const houses=['camara','senado']; const checks=[];
for(const source of houses){const h=a.overview?.houses?.[source],flow=a.flow?.[source],stale=a.staleness?.[source],cal=a.calendar?.[source],recent=a.recent?.[source]; checks.push({source,overviewTotal:Number(h?.total??0),overviewAvailable:h?.coverage?.availability,flowStages:Array.isArray(flow?.stages)?flow.stages.length:0,flowUniverse:Number(flow?.universe??0),stalenessUniverse:Number(stale?.universe??0),calendarShape:Array.isArray(cal?.days),recentShape:Array.isArray(recent?.types)});}
console.log(JSON.stringify({status:'PASS',deterministic:same,missing,checks,requiredBlocks:required.length},null,2));
process.exitCode=(same&&missing.length===0&&checks.every(x=>x.overviewTotal>0&&x.flowStages>0&&x.flowUniverse>0&&x.calendarShape&&x.recentShape))?0:1;

