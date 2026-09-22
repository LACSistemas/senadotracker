import {performance} from 'node:perf_hooks';
import {openDatabase,publishedRankingsDashboard} from '@senadotracker/db';

const db=openDatabase(process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite',true);
try{
  for(const query of [{},{source:'senado' as const},{source:'camara' as const},{source:'camara' as const,uf:'SP'}]){
    const start=performance.now(),result=publishedRankingsDashboard(db,query);
    console.log(JSON.stringify({query,ms:Math.round(performance.now()-start),total:result.total,coverage:result.coverage,highlights:Object.fromEntries(Object.entries(result.highlights).map(([key,row])=>[key,row?.name??null]))}));
  }
}finally{db.close()}
