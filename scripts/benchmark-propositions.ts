import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { openDatabase, publishedPropositions, type PropositionQuery } from '@senadotracker/db';

const db=openDatabase(process.env.SENADOTRACKER_DB_PATH??resolve('data/senadotracker.sqlite'),true);
const cases:Array<{name:string;query:PropositionQuery}>=[{name:'todas',query:{}},{name:'senado-pec',query:{source:'senado',type:'PEC'}},{name:'camara',query:{source:'camara'}}];
const runs=10,results=[];
for(const item of cases){const times:number[]=[];let total=0;for(let index=0;index<runs;index++){const start=performance.now(),result=publishedPropositions(db,{...item.query,page:1,pageSize:20});times.push(performance.now()-start);total=result.total}times.sort((a,b)=>a-b);results.push({case:item.name,total,runs,medianMs:Number(times[Math.floor(runs/2)-1]!.toFixed(1)),p95Ms:Number(times[Math.ceil(runs*.95)-1]!.toFixed(1)),timesMs:times.map(value=>Number(value.toFixed(1)))})}
const plan=db.prepare(`EXPLAIN QUERY PLAN SELECT p.external_id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id ORDER BY CAST(COALESCE(json_extract(p.payload,'$.year'),0) AS INTEGER) DESC LIMIT 20`).all();
console.log(JSON.stringify({database:process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite',results,plan},null,2));
db.close();
