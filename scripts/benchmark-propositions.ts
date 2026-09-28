import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { openDatabase, publishedPropositions, type PropositionQuery } from '@senadotracker/db';

const db=openDatabase(process.env.SENADOTRACKER_DB_PATH??resolve('data/senadotracker.sqlite'),true);
const cases:Array<{name:string;query:PropositionQuery}>=[{name:'vazia',query:{}},{name:'PL 179/2026',query:{search:'PL 179/2026'}},{name:'PL 179',query:{search:'PL 179'}},{name:'saude',query:{search:'saúde'}},{name:'educacao-basica',query:{search:'educação básica'}},{name:'autor',query:{author:'da Silva'}},{name:'filtros',query:{source:'camara',type:'PL',year:2026,group:'proposicoes_legislativas_principais'}},{name:'autocomplete',query:{author:'da'}}];
const runs=10,results=[];
for(const item of cases){const coldStart=performance.now(),cold=publishedPropositions(db,{...item.query,page:1,pageSize:20}),coldMs=performance.now()-coldStart;const times:number[]=[];let result=cold;for(let index=0;index<runs;index++){const start=performance.now();result=publishedPropositions(db,{...item.query,page:1,pageSize:20});times.push(performance.now()-start)}times.sort((a,b)=>a-b);results.push({case:item.name,total:result.total,coldMs:Number(coldMs.toFixed(1)),warmMedianMs:Number(times[Math.floor(runs/2)]!.toFixed(1)),warmP95Ms:Number(times[Math.ceil(runs*.95)-1]!.toFixed(1))})}
const plan=db.prepare(`EXPLAIN QUERY PLAN SELECT p.external_id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id ORDER BY CAST(COALESCE(json_extract(p.payload,'$.year'),0) AS INTEGER) DESC LIMIT 20`).all();
console.log(JSON.stringify({database:process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite',results,plan},null,2));
db.close();
