import {DatabaseSync} from 'node:sqlite';
const d=new DatabaseSync('artifacts/postgres-parity/senadotracker-parity.sqlite',{readOnly:true});
const qs:any[]=[];
for(const t of ['deliberations','legislative_votes','legislative_sessions','attendance']){
 const date=t==='deliberations'?'date':t==='legislative_sessions'?'date':null;
 const source=d.prepare('select source,count(*) n from '+t+' group by source').all();
 const years=date?d.prepare('select substr('+date+',1,4) year,count(*) n from '+t+' group by year order by year').all():[];
 qs.push({table:t,source,years});
}
for(const t of ['deliberations','legislative_votes','legislative_sessions','attendance']){const p=d.prepare('select payload from '+t+' limit 200').all().map((x:any)=>{try{return JSON.parse(x.payload)}catch{return {}}});const keys=[...new Set(p.flatMap(x=>Object.keys(x)))];qs.push({table:t,payloadKeys:keys});}
console.log(JSON.stringify(qs,null,2));
