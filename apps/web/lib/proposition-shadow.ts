import pg from 'pg';
import { postgresPropositionRepository, type PropositionSearchQuery } from '../../../packages/db/src/postgres-propositions.ts';

type ShadowQuery = PropositionSearchQuery & { pageSize?: number };
type ShadowItem = { source?: string; external_id?: string; proposal?: { source?: string; externalId?: string; label?: string; summary?: string; type?: string; number?: string|number|null; year?: number|null } };
type Result = { items: ShadowItem[]; hasNextPage: boolean };
type Mismatch = 'MATCH'|'SET_MISMATCH'|'ORDER_MISMATCH'|'PAGE_WINDOW_MISMATCH'|'VALUE_MISMATCH'|'PAGINATION_MISMATCH';
const state = globalThis as typeof globalThis & { senadoTrackerPgShadowPool?: pg.Pool; senadoTrackerPgShadowInFlight?: number; senadoTrackerPgShadowStats?: Record<string,number> };
const stats=()=>state.senadoTrackerPgShadowStats??=Object.create(null);
const bump=(key:string)=>{const s=stats();s[key]=(s[key]??0)+1};
function enabled(){return process.env.PROPOSITIONS_PG_SHADOW_ENABLED==='true'}
function rate(){return Math.max(0,Math.min(1,Number(process.env.PROPOSITIONS_PG_SHADOW_SAMPLE_RATE??0)))}
function sampled(){return rate()>0&&Math.random()<rate()}
function timeoutMs(){return Math.max(1,Number(process.env.PROPOSITIONS_PG_SHADOW_TIMEOUT_MS??250))}
function pool(){return state.senadoTrackerPgShadowPool??=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT??5432),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,max:2,idleTimeoutMillis:10_000,connectionTimeoutMillis:Math.min(5_000,timeoutMs()),statement_timeout:timeoutMs()})}
const key=(item:ShadowItem)=>item.source&&item.external_id?`${item.source}:${item.external_id}`:item.proposal?.source&&item.proposal.externalId?`${item.proposal.source}:${item.proposal.externalId}`:null;
const value=(item:ShadowItem)=>{const p:any=item.proposal??item;return {label:p.label??null,summary:p.summary??null,type:p.type??null,number:p.number==null?null:String(p.number),year:p.year??null}}
export function comparePropositionResults(input:ShadowQuery,sqlite:Result,postgres:Result){
 const a=sqlite.items.map(key).filter(Boolean) as string[],b=postgres.items.map(key).filter(Boolean) as string[],sa=new Set(a),sb=new Set(b);
 const onlyA=a.filter(x=>!sb.has(x)),onlyB=b.filter(x=>!sa.has(x));
 let diffType:Mismatch='MATCH'; let fields:any[]=[];
 if(onlyA.length||onlyB.length) diffType=a.length===b.length?'PAGE_WINDOW_MISMATCH':'SET_MISMATCH';
 else if(a.join('|')!==b.join('|')) diffType='ORDER_MISMATCH';
 else {const byA=new Map(sqlite.items.map(x=>[key(x),x]));for(const item of postgres.items){const id=key(item);if(!id)continue;const before=byA.get(id);if(before&&JSON.stringify(value(before))!==JSON.stringify(value(item))){fields.push({identity:id,sqlite:value(before),postgres:value(item)});}}if(fields.length)diffType='VALUE_MISMATCH';else if(sqlite.hasNextPage!==postgres.hasNextPage)diffType='PAGINATION_MISMATCH'}
 bump(diffType.toLowerCase());
 return {input,sqliteCount:a.length,postgresCount:b.length,diffType,diffCount:onlyA.length+onlyB.length,sqliteOnly:onlyA.slice(0,5),postgresOnly:onlyB.slice(0,5),fields:fields.slice(0,5),hasNextPageMismatch:sqlite.hasNextPage!==postgres.hasNextPage};
}
export function propositionShadowMetrics(){return {...stats()}}
export function resetPropositionShadowMetrics(){state.senadoTrackerPgShadowStats=Object.create(null)}
export function runPropositionShadow(input:ShadowQuery,sqlite:Result){
 if(!enabled()||!sampled())return; bump('shadow_requests_total');
 const inFlight=state.senadoTrackerPgShadowInFlight??0;if(inFlight>=Math.max(1,Number(process.env.PROPOSITIONS_PG_SHADOW_MAX_IN_FLIGHT??4))){bump('shadow_dropped_total');return}
 state.senadoTrackerPgShadowInFlight=inFlight+1;const started=performance.now(),limit=timeoutMs();
 void Promise.race([postgresPropositionRepository(pool()).search(input),new Promise<never>((_,reject)=>setTimeout(()=>reject(Object.assign(new Error('shadow timeout'),{code:'SHADOW_TIMEOUT'})),limit))]).then(result=>{
   const postgresMs=performance.now()-started; bump('shadow_postgres_duration_ms_total'); const comparison=comparePropositionResults(input,sqlite,result as Result); bump(comparison.diffType==='MATCH'?'shadow_matches_total':'shadow_mismatches_total');
   if(process.env.PROPOSITIONS_PG_SHADOW_LOG_MATCHES==='true'||comparison.diffType!=='MATCH')console.info(JSON.stringify({type:'proposition_pg_shadow',operation:'search',postgresMs:+postgresMs.toFixed(2),comparisonMs:0,...comparison}));
 }).catch(error=>{const timeout=error?.code==='57014'||error?.code==='SHADOW_TIMEOUT';bump(timeout?'shadow_postgres_timeouts_total':'shadow_postgres_errors_total');console.warn(JSON.stringify({type:'proposition_pg_shadow',operation:'search',diffType:timeout?'POSTGRES_TIMEOUT':'POSTGRES_ERROR',postgresMs:+(performance.now()-started).toFixed(2),error:timeout?'timeout':error instanceof Error?error.message:'unavailable'}));
 }).finally(()=>{state.senadoTrackerPgShadowInFlight=Math.max(0,(state.senadoTrackerPgShadowInFlight??1)-1)})
}


