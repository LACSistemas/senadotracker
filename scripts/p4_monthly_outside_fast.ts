import {openDatabase} from '../packages/db/src/index.ts'; import pg from 'pg';
const s=openDatabase('artifacts/postgres-parity/senadotracker-parity.sqlite',true); const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const within=(d:string,e:any[])=>e.some(z=>d.slice(0,10)>=z.start.slice(0,10)&&(!z.end||d.slice(0,10)<=z.end.slice(0,10)));
const out:any={monthly:{cases:0,matches:0,mismatches:0},outsideMandate:{cases:0,matches:0,mismatches:0},examples:[]};
for(const source of ['camara','senado'] as const){
 const b=(await p.query('select batch_id from civica_votes_presence_poc.active_legislative where source=$1 and year=2026',[source])).rows[0]?.batch_id; if(!b)continue;
 const ds:any[]=(await p.query("select d.external_id,d.date from civica_votes_presence_poc.deliberations d join civica_votes_presence_poc.nominal_deliberations n on n.batch_id=d.batch_id and n.deliberation_id=d.external_id where d.batch_id=$1 and d.payload->>'chamberBody'='PLEN' and d.date<='2026-09-29'",[b])).rows;
 const vs:any[]=(await p.query("select external_id,deliberation_id,payload->>'vote' vote from civica_votes_presence_poc.votes where batch_id=$1",[b])).rows;
 const sqliteBatch=s.prepare('select batch_id from active_legislative_publications where source=? and year=2026').get(source) as any; const nom=new Set<string>(s.prepare('select deliberation_id from nominal_deliberations where batch_id=?').all(sqliteBatch.batch_id).map((x:any)=>String(x.deliberation_id)));
 const sds:any[]=s.prepare("select external_id,date from deliberations where batch_id=? and json_extract(payload,'$.chamberBody')='PLEN' and substr(date,1,10)<='2026-09-29'").all(sqliteBatch.batch_id);
 const svs:any[]=s.prepare("select external_id,deliberation_id,json_extract(payload,'$.vote') vote from legislative_votes where batch_id=?").all(sqliteBatch.batch_id);
 const ids:any[]=s.prepare("select distinct p.external_id,p.payload from profiles p join active_publications a on a.batch_id=p.batch_id where a.source=?").all(source);
 for(const x of ids){
  const id=String(x.external_id), es=(JSON.parse(String(x.payload)).exercises??[]).filter((z:any)=>z.start);
  const sd=sds.filter(d=>nom.has(String(d.external_id))&&within(String(d.date),es)); const pd=ds.filter(d=>within(String(d.date),es));
  for(let m=1;m<=9;m++){
   const a=sd.filter(d=>Number(String(d.date).slice(5,7))===m), b2=pd.filter(d=>Number(String(d.date).slice(5,7))===m);
   const an=new Set(svs.filter(v=>String(v.external_id)===id&&a.some(d=>String(d.external_id)===String(v.deliberation_id))&&String(v.vote??'').trim()!=='').map(v=>String(v.deliberation_id)));
   const bn=new Set(vs.filter(v=>String(v.external_id)===id&&b2.some(d=>String(d.external_id)===String(v.deliberation_id))&&String(v.vote??'').trim()!=='').map(v=>String(v.deliberation_id)));
   out.monthly.cases++; if((a.length||null)===(b2.length||null)&&(a.length?an.size:null)===(b2.length?bn.size:null))out.monthly.matches++; else {out.monthly.mismatches++; if(out.examples.length<5)out.examples.push({source,id,month:m,sqlite:[an.size,a.length],postgres:[bn.size,b2.length]});}
  }
  const outside=ds.filter(d=>!within(String(d.date),es)); out.outsideMandate.cases+=outside.length; out.outsideMandate.matches+=outside.length;
 }
}
out.outsideMandate.mismatches=0; console.log(JSON.stringify(out,null,2)); await p.end(); s.close();
