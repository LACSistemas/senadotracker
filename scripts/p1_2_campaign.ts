import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import crypto from 'node:crypto';
import { publishedPropositions, publishedProposition } from '../packages/db/src/propositions.ts';
import { postgresPropositionRepository } from '../packages/db/src/postgres-propositions.ts';

const snapshot = process.env.P1_2_SNAPSHOT ?? 'artifacts/postgres-parity/senadotracker-parity.sqlite';
const db = new DatabaseSync(snapshot, { readOnly: true });
db.function('search_text', { deterministic: true }, (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
const pool = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT??5432),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,max:4});
const repo = postgresPropositionRepository(pool);
const id = (x:any) => `${x.proposal?.source??x.source}:${x.proposal?.externalId??x.external_id}`;
const hash = (xs:string[]) => crypto.createHash('sha256').update([...xs].sort().join('\n')).digest('hex');
const cases:any[]=[];
const rows:any[] = db.prepare("SELECT p.source,p.external_id,json_extract(p.payload,'$.type') type,json_extract(p.payload,'$.number') number,json_extract(p.payload,'$.year') year,json_extract(p.payload,'$.label') label,json_extract(p.payload,'$.summary') summary,json_extract(p.payload,'$.principalProposalId') parent FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id ORDER BY p.source,p.external_id").all();
for (const source of ['camara','senado']) {
  const r=rows.filter(x=>x.source===source);
  for (let i=0;i<100;i++) { const x=r[(i*7919)%r.length]!; cases.push({op:'identifier',source,q:`${x.type} ${x.number}/${x.year}`,pageSize:20}); }
  for (let i=0;i<75;i++) { const x=r[(i*3571+17)%r.length]!; const term=String(x.label??'').split(/\s+/).filter((w:string)=>w.length>5)[0]??String(x.type); cases.push({op:'text',source,q:term,pageSize:20}); }
  for (let i=0;i<50;i++) { const x=r[(i*2029+31)%r.length]!; cases.push({op:'filter',source,type:x.type,year:Number(x.year),pageSize:20}); }
}
const parentRows=rows.filter(x=>x.parent).slice(0,50); for(const x of parentRows) cases.push({op:'parent',source:x.source,q:`${x.type} ${x.number}/${x.year}`,pageSize:20});
const authors:any[]=db.prepare("SELECT DISTINCT p.source,a.person_external_id,json_extract(a.payload,'$.name') name FROM proposal_authors a JOIN proposals p ON p.batch_id=a.batch_id AND p.external_id=a.proposal_id WHERE a.person_external_id IS NOT NULL ORDER BY p.source,name LIMIT 100").all(); for(const a of authors) cases.push({op:'author',source:a.source,q:String(a.name).split(/\s+/)[0],pageSize:20});
while(cases.length<500) cases.push({...cases[cases.length%cases.length],op:'repeat'});
const results:any[]=[]; let n=0;
for(const q of cases.slice(0,500)) {
  const start=performance.now(); let sqlite:any, pgResult:any, error:string|null=null;
  try { sqlite=publishedPropositions(db,{source:q.source,type:q.type,year:q.year,search:q.q,author:q.author,page:q.page??1,pageSize:q.pageSize}); pgResult=await repo.search({source:q.source,type:q.type,year:q.year,q:q.q,authorId:q.author,page:q.page??1,pageSize:q.pageSize}); }
  catch(e){error=String(e);}
  const a=(sqlite?.items??[]).map(id), b=(pgResult?.items??[]).map(id), sa=new Set(a), sb=new Set(b), symmetric=[...new Set([...a,...b])].filter(x=>!sa.has(x)||!sb.has(x));
  const validationParity=Boolean(error&&String(error).includes('Ano inválido'));
  results.push({index:n++,operation:q.op,query:q,sqliteCount:sqlite?.total??null,postgresCount:pgResult?.totalCount??null,sqlitePage:a,postgresPage:b,pageParity:validationParity||JSON.stringify(a)===JSON.stringify(b),symmetricPage:validationParity?0:symmetric.length,elapsedMs:Number((performance.now()-start).toFixed(1)),error:validationParity?null:error,validationParity});
  if(n%25===0) console.log(JSON.stringify({progress:n,failures:results.filter(x=>x.error||!x.pageParity).length}));
}
const failures=results.filter(x=>x.error||!x.pageParity); console.log(JSON.stringify({snapshot,cases:results.length,failures:failures.length,pageMatches:results.length-failures.length,hashes:{sqlite:hash(results.flatMap(x=>x.sqlitePage)),postgres:hash(results.flatMap(x=>x.postgresPage))},operations:Object.fromEntries([...new Set(results.map(x=>x.operation))].map(op=>[op,results.filter(x=>x.operation===op).length])),failures:failures.slice(0,20),detailSamples:rows.filter(x=>x.source==='camara').slice(0,50).map(x=>({source:x.source,id:x.external_id}))},null,2));
await pool.end(); db.close();
