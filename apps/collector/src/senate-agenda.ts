import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { failRun, publishComplement, startRun } from '@senadotracker/db';
import type { LegislativeComplement } from '@senadotracker/domain';
import { saveRaw } from './raw.ts';
import { persistCommissionAgendaRecords, rangeYears } from './commission-canonical.ts';

type Json=Record<string,unknown>;
const object=(value:unknown):Json=>value&&typeof value==='object'&&!Array.isArray(value)?value as Json:{};
const list=(value:unknown):Json[]=>Array.isArray(value)?value.filter((item):item is Json=>Boolean(item)&&typeof item==='object'):(value&&typeof value==='object'?[value as Json]:[]);
const text=(value:unknown)=>value===null||value===undefined?'':String(value).trim();
const day=(value:unknown)=>/^\d{4}-\d{2}-\d{2}/.test(text(value))?text(value).slice(0,10):null;
const monthUrl=(year:number,month:number)=>`https://legis.senado.leg.br/dadosabertos/agendareuniao/mes/${year}${String(month).padStart(2,'0')}.json`;

async function load(url:string,file:string){
  try{return{bytes:new Uint8Array(await readFile(file)),url,fetchedAt:new Date().toISOString(),status:200,contentType:'application/json'}}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  const response=await fetch(url,{signal:AbortSignal.timeout(30_000),headers:{Accept:'application/json','User-Agent':'Civica/0.1 (dados publicos legislativos)'}}),bytes=new Uint8Array(await response.arrayBuffer());
  if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);JSON.parse(new TextDecoder().decode(bytes));await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,bytes);return{bytes,url,fetchedAt:new Date().toISOString(),status:response.status,contentType:response.headers.get('content-type')??'application/json'};
}

export function parseSenateCommissionAgenda(document:unknown,rawId:string,from:string,to:string):LegislativeComplement[]{
  const root=object(object(document).AgendaReuniao),records:LegislativeComplement[]=[];
  for(const meeting of list(object(root.reunioes).reuniao)){
    const occurredAt=day(meeting.dataInicio);if(!occurredAt||occurredAt<from||occurredAt>to)continue;
    const meetingId=text(meeting.codigo);for(const part of list(meeting.partes))for(const item of list(part.itens)){
      const matter=object(item.doma),proposalId=text(matter.codigoMateria);if(!/^\d+$/.test(proposalId))continue;
      const itemId=text(item.codigo)||`${text(part.codigo)}:${text(item.ordem)}`,body=object(meeting.colegiadoCriador),bodyId=text(body.codigo),label=text(matter.identificacao)||text(item.nome)||`Matéria ${proposalId}`;
      records.push({source:'senado',externalKey:`commission-agenda:${meetingId}:${itemId}:${proposalId}`,kind:'agenda_item',personExternalId:null,proposalId,deliberationId:null,bodyId:bodyId||null,occurredAt,label,value:JSON.stringify({meetingId,scheduledDate:occurredAt,itemId,order:text(item.ordem)||null,agendaType:text(item.tipoPauta)||null,result:text(item.descricaoResultado)||null,committee:text(body.sigla)||text(body.nome)||null,bodyId,bodySigla:text(body.sigla),bodyName:text(body.nome),startAt:text(meeting.dataInicio),endAt:text(meeting.dataFim),title:text(meeting.titulo),description:text(meeting.descricao),location:text(meeting.local)}),officialUrl:meetingId?`https://legis.senado.leg.br/atividade/comissoes/comissao/${bodyId||'reuniao'}/reuniao/${meetingId}`:'https://www12.senado.leg.br/dados-abertos/legislativo/comissoes/reuniao-de-comissoes',rawId});
    }
  }
  return records;
}

export async function collectSenateCommissionAgenda(db:DatabaseSync,options:{year:number;rawDirectory:string;cacheDirectory:string;dryRun?:boolean;progress?:(message:string)=>void;from?:string;to?:string;futureDays?:number}){
  if(options.from&&options.to&&rangeYears(options.from,options.to).length>1){const years=rangeYears(options.from,options.to),out:any[]=[];for(const year of years){const from=year===years[0]?options.from:`${year}-01-01`,to=year===years[years.length-1]?options.to:`${year}-12-31`;out.push(await collectSenateCommissionAgenda(db,{...options,year,from,to}))}return Object.assign({},out[0],{year:options.year,from:options.from,to:options.to,years:out});}
  if(!Number.isInteger(options.year)||options.year<2001||options.year>2100)throw new Error('Ano de pauta inválido');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()),from=options.from??`${options.year}-01-01`,to=options.to??(options.futureDays?new Date(Date.now()+options.futureDays*86400000).toISOString().slice(0,10):(today<`${options.year}-12-31`?today:`${options.year}-12-31`)),lastMonth=12;let runId:string|null=null;const records:LegislativeComplement[]=[];
  try{if(!options.dryRun)runId=startRun(db,'senado');for(let month=1;month<=lastMonth;month++){options.progress?.(`Senado pautas de comissão: ${String(month).padStart(2,'0')}/${options.year}`);const url=monthUrl(options.year,month),response=await load(url,resolve(options.cacheDirectory,`${options.year}${String(month).padStart(2,'0')}.json`)),rawId=options.dryRun?`dry:agenda:${options.year}:${month}`:await saveRaw(db,runId!,options.rawDirectory,response);records.push(...parseSenateCommissionAgenda(JSON.parse(new TextDecoder().decode(response.bytes)),rawId,from,to))}const unique=[...new Map(records.map(record=>[record.externalKey,record])).values()],matters=new Set(unique.map(record=>record.proposalId)).size,result={year:options.year,from,to,items:unique.length,matters,published:false};if(!options.dryRun){publishComplement(db,runId!,'senado',`senate-commission-agenda-${options.year}`,unique,{...result,source:'https://legis.senado.leg.br/dadosabertos/agendareuniao/mes/{AAAAMM}.json'});persistCommissionAgendaRecords(db,unique);result.published=true}return result}catch(error){if(runId)failRun(db,runId,error instanceof Error?error.message:String(error));throw error}
}
