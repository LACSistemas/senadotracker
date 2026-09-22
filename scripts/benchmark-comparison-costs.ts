import {performance} from 'node:perf_hooks';
import {openDatabase,publishedPersonComparisonDashboard} from '@senadotracker/db';

const db=openDatabase(process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite',true);
try{
  const names=['Cid Gomes','Carlos Viana','Damares Alves'];
  const rows=names.map(name=>db.prepare(`SELECT p.external_id,p.name FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source='senado' AND p.name LIKE ? LIMIT 1`).get(`%${name}%`));
  if(rows.some(row=>!row))throw new Error('Perfis de referência não encontrados');
  const ids=rows.map(row=>String(row!.external_id));
  const start=performance.now(),result=publishedPersonComparisonDashboard(db,'senado',2026,ids);
  console.log(JSON.stringify({milliseconds:Math.round(performance.now()-start),period:result.coverage.costs.period,coverage:result.coverage.costs.availability,people:result.people.map((person,index)=>({name:person.profile.name,cotaCents:result.expenses[index]?.totalCents,records:result.expenses[index]?.recordCount,largest:result.expenses[index]?.largestCategory,cost:result.costs[index]}))},null,2));
  const chamberIds=['204560','204379'];const chamberStart=performance.now(),chamber=publishedPersonComparisonDashboard(db,'camara',2026,chamberIds);
  console.log(JSON.stringify({source:'camara',milliseconds:Math.round(performance.now()-chamberStart),period:chamber.coverage.costs.period,coverage:chamber.coverage.costs.availability,people:chamber.people.map((person,index)=>({name:person.profile.name,records:chamber.expenses[index]?.recordCount,largest:chamber.expenses[index]?.largestCategory,cost:chamber.costs[index]}))},null,2));
}finally{db.close()}
