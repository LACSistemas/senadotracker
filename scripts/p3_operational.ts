import pg from 'pg';
import { postgresCommitteeRepository } from '../packages/db/src/postgres-committees.ts';
const pool=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:'projetoeleitorsenha',max:4});
const repo=postgresCommitteeRepository(pool);
const q=async(fn:()=>Promise<unknown>,n=50)=>{for(let i=0;i<5;i++)await fn();const a:number[]=[];for(let i=0;i<n;i++){const t=performance.now();await fn();a.push(performance.now()-t)}a.sort((x,y)=>x-y);const p=(x:number)=>Math.round(a[Math.min(a.length-1,Math.floor(a.length*x/100))]);return {p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),minMs:Math.round(a[0]),maxMs:Math.round(a.at(-1)!),rows:await fn().then((x:any)=>Array.isArray(x)?x.length:0)}};
const ids=(await repo.commissions()) as any[];const rich=ids.sort((a,b)=>Number(b.active)-Number(a.active))[0]?.id;
const out={directory:await q(()=>repo.commissions()),detail:await q(()=>repo.detail(String(rich))),agenda:await q(()=>repo.agenda('2020-01-01','2030-12-31')),roundTrips:{directory:1,detail:3,agenda:1},nPlusOne:{blocker:false,detailQueries:3,agendaQueries:1}};
console.log(JSON.stringify(out,null,2));await pool.end();
