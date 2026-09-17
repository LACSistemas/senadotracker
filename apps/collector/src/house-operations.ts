import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { LegislativeComplement, Source } from '@senadotracker/domain';
import { failRun, publishComplement, startRun } from '@senadotracker/db';
import { saveRaw } from './raw.ts';

export type ProcessingMatter = { id:string; presentedAt:string|null; status:string|null };
export type ProcessingSummary={meanDays:number|null;medianDays:number|null;sampleSize:number;eligible:number;coverage:number;terminalDefinition:string};
const terminal=/(transformad[ao].*norma|transforma[cç][aã]o.*norma|convertid[ao].*norma|promulgad[ao]|sancionad[ao]|vetad[ao]|veto (?:total|parcial))/i;
const day=(value:string|null|undefined)=>{if(!value)return null;const match=value.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!match)return null;const time=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));return Number.isFinite(time)?time:null};
type ProcessingEvent={proposalId:string;date:string|null;label:string;value:string|null;kind?:string};
const isTerminalEvent=(event:ProcessingEvent)=>event.kind==='resulting_norm'||terminal.test(event.label);
export function processingObservations(matters:ProcessingMatter[],events:ProcessingEvent[],year?:number){
  const starts=new Map(matters.flatMap(item=>day(item.presentedAt)===null?[]:[[item.id,day(item.presentedAt)!] as const])),ends=new Map<string,number>();
  // Câmara repeats the current situation in historical rows. Only the event
  // description itself can establish when the terminal transition occurred.
  for(const event of events){if(!isTerminalEvent(event)||year&&event.date?.slice(0,4)!==String(year))continue;const value=day(event.date);if(value===null)continue;const current=ends.get(event.proposalId);if(current===undefined||value<current)ends.set(event.proposalId,value)}
  for(const item of matters){if(!terminal.test(item.status??''))continue;/* Status sem data terminal não entra na amostra. */}
  const eligible=new Set(ends.keys());
  return[...ends].flatMap(([id,end])=>{const start=starts.get(id);return start!==undefined&&end>=start?[{proposalId:id,start:new Date(start).toISOString().slice(0,10),end:new Date(end).toISOString().slice(0,10),days:(end-start)/86_400_000}]:[]}).sort((a,b)=>a.days-b.days||a.proposalId.localeCompare(b.proposalId));
}
export function summarizeProcessing(matters:ProcessingMatter[],events:ProcessingEvent[],year?:number):ProcessingSummary{
  const values=processingObservations(matters,events,year).map(item=>item.days),eligible=new Set(events.filter(event=>isTerminalEvent(event)&&(!year||event.date?.slice(0,4)===String(year))).map(event=>event.proposalId));
  const mean=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,index=Math.floor(values.length/2),median=values.length?(values.length%2?values[index]!:(values[index-1]!+values[index]!)/2):null;
  return{meanDays:mean,medianDays:median,sampleSize:values.length,eligible:eligible.size,coverage:eligible.size?values.length/eligible.size:0,terminalDefinition:'Primeiro evento datado de sanção, promulgação, transformação/conversão em norma ou veto após a apresentação.'};
}

function activeSenate(data:unknown):ProcessingMatter[]{const root=data as {PesquisaBasicaMateria?:{Materias?:{Materia?:unknown}}},raw=root.PesquisaBasicaMateria?.Materias?.Materia,list=Array.isArray(raw)?raw:raw?[raw]:[];return list.flatMap(value=>{const x=value as Record<string,unknown>,id=String(x.Codigo??'').trim();return id?[{id,presentedAt:typeof x.Data==='string'?x.Data:null,status:'Em tramitação'}]:[]})}
function publishedMatters(db:DatabaseSync,source:Source):ProcessingMatter[]{
  const values=new Map<string,ProcessingMatter>();
  for(const row of db.prepare(`SELECT p.external_id,json_extract(p.payload,'$.presentedAt') presented_at,json_extract(p.payload,'$.status') status FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE a.source=?`).all(source)){const id=String(row.external_id);values.set(id,{id,presentedAt:row.presented_at?String(row.presented_at):null,status:row.status?String(row.status):null})}
  for(const row of db.prepare(`SELECT c.proposal_id,json_extract(c.payload,'$.value') value FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source=? AND c.kind IN ('matter_detail','proposal_detail') AND c.proposal_id IS NOT NULL`).all(source)){let detail:Record<string,unknown>={};try{detail=JSON.parse(String(row.value??'{}')) as Record<string,unknown>}catch{}const id=String(row.proposal_id),current=values.get(id),presentedAt=typeof detail.presentedAt==='string'?detail.presentedAt:null,status=typeof detail.status==='string'?detail.status:null;values.set(id,{id,presentedAt:current?.presentedAt??presentedAt,status:current?.status??status})}
  return[...values.values()]
}
function publishedEvents(db:DatabaseSync,source:Source){return db.prepare(`SELECT c.kind,c.proposal_id,c.occurred_at,json_extract(c.payload,'$.label') label,json_extract(c.payload,'$.value') value FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source=? AND c.proposal_id IS NOT NULL AND c.kind IN ('movement','situation','resulting_norm')`).all(source).map(row=>({kind:String(row.kind),proposalId:String(row.proposal_id),date:row.occurred_at?String(row.occurred_at):null,label:String(row.label??''),value:row.value?String(row.value):null}))}
export function publishedProcessingObservations(db:DatabaseSync,source:Source,year:number){return processingObservations(publishedMatters(db,source),publishedEvents(db,source),year)}

export async function collectHouseOperations(db:DatabaseSync,options:{source:Source;year:number;rawDirectory:string;cacheDirectory:string;dryRun?:boolean;progress?:(message:string)=>void}){
  let runId:string|null=null;
  try{
    if(!options.dryRun)runId=startRun(db,options.source);
    let raw:{url:string;fetchedAt:string;status:number;contentType:string;bytes:Uint8Array},backlog:number|null=null,backlogUniverse:string;
    if(options.source==='senado'){
      const url='https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista.json?tramitando=S',file=resolve(options.cacheDirectory,'senate-active-matters.json');let bytes:Uint8Array;
      try{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Cívica/0.1 (official-data-research)'}});if(!response.ok)throw new Error(`HTTP ${response.status}`);bytes=new Uint8Array(await response.arrayBuffer())}catch{bytes=new Uint8Array(await readFile(file))}
      const data=JSON.parse(new TextDecoder('utf-8').decode(bytes)),active=activeSenate(data);backlog=new Set(active.map(item=>item.id)).size;backlogUniverse='Matérias distintas que a pesquisa institucional do Senado marcou como em tramitação no snapshot.';raw={url,fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',bytes};
    }else{
      const matters=publishedMatters(db,'camara');backlog=new Set(matters.filter(item=>/tramit/i.test(item.status??'')).map(item=>item.id)).size;backlogUniverse='Proposições distintas com situação de tramitação no catálogo ativo publicado da Câmara.';const bytes=new TextEncoder().encode(JSON.stringify({derivedFrom:'active_activity_publications',year:options.year,backlog}));raw={url:'https://dadosabertos.camara.leg.br/api/v2/proposicoes',fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',bytes};
    }
    const matters=publishedMatters(db,options.source),processing=summarizeProcessing(matters,publishedEvents(db,options.source),options.year),summary={source:options.source,year:options.year,observedAt:raw.fetchedAt,backlog,backlogUniverse,processing};
    if(options.dryRun)return{...summary,published:false};
    const rawId=await saveRaw(db,runId!,options.rawDirectory,raw),record:LegislativeComplement={source:options.source,externalKey:`house-operations:${options.year}`,kind:'reconciliation',personExternalId:null,proposalId:null,deliberationId:null,bodyId:null,occurredAt:raw.fetchedAt.slice(0,10),label:'Indicadores institucionais da Casa',value:JSON.stringify(summary),officialUrl:raw.url,rawId};
    publishComplement(db,runId!,options.source,`house-operations-${options.year}`,[record],summary);options.progress?.(`${options.source}: backlog=${backlog}; tramitação n=${processing.sampleSize}`);return{...summary,published:true};
  }catch(error){if(runId)failRun(db,runId,error instanceof Error?error.message:String(error));throw error}
}
