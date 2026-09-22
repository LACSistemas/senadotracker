import {performance} from 'node:perf_hooks';
import {openDatabase,publishedPersonComparisonDashboard} from '@senadotracker/db';

const db=openDatabase(process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite',true);
const measurements:{ms:number;sql:string}[]=[];
const proxy=new Proxy(db,{
  get(target,key){
    if(key!=='prepare')return Reflect.get(target,key,target);
    return (sql:string)=>{
      const stmt=target.prepare(sql);
      return new Proxy(stmt,{
        get(statement,method){
          if(method!=='all'&&method!=='get')return Reflect.get(statement,method,statement);
          return (...args:unknown[])=>{
            const start=performance.now();
            const result=(Reflect.get(statement,method,statement) as (...args:unknown[])=>unknown).apply(statement,args);
            measurements.push({ms:performance.now()-start,sql:sql.replace(/\s+/g,' ').slice(0,160)});
            return result;
          };
        }
      });
    };
  }
});
try{
  const start=performance.now();
  const result=publishedPersonComparisonDashboard(proxy,'senado',2026,['5672','6336','6335']);
  console.log(JSON.stringify({totalMs:Math.round(performance.now()-start),people:result.people.map(item=>item.profile.name),slowest:measurements.sort((a,b)=>b.ms-a.ms).slice(0,15).map(item=>({...item,ms:Math.round(item.ms)}))},null,2));
}finally{db.close()}
