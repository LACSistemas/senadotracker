import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
const s=new DatabaseSync('data/senadotracker.sqlite',{readOnly:true});
const p=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const a=s.prepare(`SELECT e.source,e.external_id,e.year,e.month FROM expenses e JOIN active_expense_publications x ON x.source=e.source AND x.year=e.year AND x.batch_id=e.batch_id`).all() as any[];
const b=(await p.query(`SELECT e.source,e.external_id,e.year,e.month FROM civica.expenses e JOIN civica.active_expense_publications x ON x.source=e.source AND x.year=e.year AND x.batch_id=e.batch_id`)).rows as any[];
const key=(r:any)=>[r.source,r.external_id,r.year,r.month].map(String).join('|'); const sa=new Set(a.map(key)),sb=new Set(b.map(key)); const ca=new Map<string,number>(),cb=new Map<string,number>(); for(const r of a)ca.set(key(r),(ca.get(key(r))??0)+1); for(const r of b)cb.set(key(r),(cb.get(key(r))??0)+1); const mult=[...new Set([...sa,...sb])].filter(k=>(ca.get(k)??0)!==(cb.get(k)??0));
console.log(JSON.stringify({a:a.length,b:b.length,aOnly:[...sa].filter(x=>!sb.has(x)).slice(0,20),bOnly:[...sb].filter(x=>!sa.has(x)).slice(0,20),aOnlyCount:[...sa].filter(x=>!sb.has(x)).length,bOnlyCount:[...sb].filter(x=>!sa.has(x)).length,multiplicityDiff:mult.slice(0,20).map(k=>({key:k,sqlite:ca.get(k),postgres:cb.get(k)})),multiplicityDiffCount:mult.length},null,2)); await p.end();s.close();
