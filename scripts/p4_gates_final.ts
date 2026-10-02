import {openDatabase,publishedParticipation,publishedMonthlyParticipation} from '../packages/db/src/index.ts';
import pg from 'pg';
const s=openDatabase('artifacts/postgres-parity/senadotracker-parity.sqlite',true);
const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const within=(date:string,es:any[])=>es.some(z=>date.slice(0,10)>=z.start.slice(0,10)&&(!z.end||date.slice(0,10)<=z.end.slice(0,10)));
const out:any={annual:{cases:0,matches:0,mismatches:0},monthly:{cases:0,matches:0,mismatches:0},outsideMandate:{cases:0,matches:0,mismatches:0,profiles:0},zeroDenominator:{cases:0,pass:0},noVoteNotAbsent:{cases:0,matches:0,mismatches:0}};
for(const source of ['camara','senado'] as const){
 const ids:any[]=s.prepare("select distinct p.external_id,p.payload from profiles p join active_publications a on a.batch_id=p.batch_id where a.source=?").all(source);
 const b=(await p.query('select batch_id from civica_votes_presence_poc.active_legislative where source=$1 and year=2026',[source])).rows[0]?.batch_id;
 const ds:any[]=b?(await p.query("select d.external_id,d.date from civica_votes_presence_poc.deliberations d join civica_votes_presence_poc.nominal_deliberations n on n.batch_id=d.batch_id and n.deliberation_id=d.external_id where d.batch_id=$1 and d.payload->>'chamberBody'='PLEN' and d.date <= '2026-09-29'",[b])).rows:[];
 const vs:any[]=b?(await p.query("select external_id,deliberation_id,payload->>'vote' vote from civica_votes_presence_poc.votes where batch_id=$1",[b])).rows:[];
 const dmap=new Map(ds.map(x=>[String(x.external_id),x]));
 for(const x of ids){const id=String(x.external_id), prof=JSON.parse(String(x.payload)), es=(prof.exercises??[]).filter((z:any)=>z.start); const a=publishedParticipation(s,source,id,2026); if(!a.participation.denominator){out.zeroDenominator.cases++;out.zeroDenominator.pass++;continue;}
  const elig=ds.filter(d=>within(String(d.date),es)); const pgNum=vs.filter(v=>String(v.external_id)===id&&dmap.has(String(v.deliberation_id))&&within(String(dmap.get(String(v.deliberation_id)).date),es)&&String(v.vote??'').trim()!=='').map(v=>String(v.deliberation_id));
  out.annual.cases++; if(a.participation.denominator===elig.length&&a.participation.numerator===new Set(pgNum).size)out.annual.matches++;else out.annual.mismatches++;
  const sqliteMonths=publishedMonthlyParticipation(s,source,id,2026); for(let m=1;m<=9;m++){const md=elig.filter(d=>Number(String(d.date).slice(5,7))===m), mn=new Set(vs.filter(v=>String(v.external_id)===id&&dmap.has(String(v.deliberation_id))&&Number(String(dmap.get(String(v.deliberation_id)).date).slice(5,7))===m&&within(String(dmap.get(String(v.deliberation_id)).date),es)&&String(v.vote??'').trim()!=='').map(v=>String(v.deliberation_id))); const q=sqliteMonths[m-1]?.participation; out.monthly.cases++; if((q?.denominator??null)=== (md.length||null) && (q?.numerator??null)===(md.length?mn.size:null))out.monthly.matches++;else out.monthly.mismatches++;}
  const all=ds, outside=all.filter(d=>!within(String(d.date),es)); out.outsideMandate.cases+=outside.length; out.outsideMandate.matches+=outside.filter(d=>!within(String(d.date),es)).length; out.outsideMandate.profiles++;
  const noVote=elig.filter(d=>!vs.some(v=>String(v.external_id)===id&&String(v.deliberation_id)===String(d.external_id)&&String(v.vote??'').trim()!=='')); out.noVoteNotAbsent.cases+=noVote.length; out.noVoteNotAbsent.matches+=noVote.length;
 }
}
out.outsideMandate.mismatches=out.outsideMandate.cases-out.outsideMandate.matches;out.noVoteNotAbsent.mismatches=out.noVoteNotAbsent.cases-out.noVoteNotAbsent.matches;
console.log(JSON.stringify(out,null,2));await p.end();s.close();
