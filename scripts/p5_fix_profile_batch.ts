import {openDatabase} from '../packages/db/src/index.ts'; import pg from 'pg';
const s=openDatabase('artifacts/postgres-parity/senadotracker-parity.sqlite',true); const p=new pg.Client({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:'projetoeleitorsenha'}); await p.connect();
await p.query('alter table civica_finance_poc.active_profile_publications add column if not exists batch_id text');
const rows=s.prepare('select a.source,a.batch_id,p.external_id from profiles p join active_publications a on a.batch_id=p.batch_id').all() as any[];
await p.query('update civica_finance_poc.active_profile_publications set batch_id=null');
for(let i=0;i<rows.length;i+=500){const c=rows.slice(i,i+500),m=c.map((_,j)=>`($${j*3+1},$${j*3+2},$${j*3+3})`).join(','),v:any[]=[];for(const r of c)v.push(r.source,r.external_id,r.batch_id);await p.query(`update civica_finance_poc.active_profile_publications x set batch_id=v.batch_id from (values ${m}) v(source,external_id,batch_id) where x.source=v.source and x.external_id=v.external_id`,v)}
console.log((await p.query('select source,count(*) filter (where batch_id is not null) linked,count(*) total from civica_finance_poc.active_profile_publications group by source')).rows); await p.end();s.close();
