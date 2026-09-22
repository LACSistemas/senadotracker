import { readFile } from 'node:fs/promises';
import type { DatabaseSync } from 'node:sqlite';
import { failRun, publishComplement, startRun } from '@senadotracker/db';
import type { LegislativeComplement } from '@senadotracker/domain';
import { saveRaw, saveRawFile } from './raw.ts';

type ThemeInput={uriProposicao?:unknown;idProposicao?:unknown;codTema?:unknown;tema?:unknown;relevancia?:unknown};
const archiveUrl=(year:number)=>`https://dadosabertos.camara.leg.br/arquivos/proposicoesTemas/json/proposicoesTemas-${year}.json`;
const proposalId=(row:ThemeInput)=>{const direct=String(row.idProposicao??'').trim();if(/^\d+$/.test(direct))return direct;const match=/\/proposicoes\/(\d+)\/?$/.exec(String(row.uriProposicao??''));return match?.[1]??null};

export function parseCamaraThemes(bytes:Uint8Array,rawId:string,year:number,allowed:Set<string>):LegislativeComplement[]{
  const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
  const document=JSON.parse(decoded) as {dados?:ThemeInput[]};
  if(!Array.isArray(document.dados))throw new Error('Arquivo anual de temas sem coleção dados');
  const records:LegislativeComplement[]=[];const keys=new Set<string>();
  for(const row of document.dados){const id=proposalId(row),code=String(row.codTema??'').trim(),label=String(row.tema??'').trim();if(!id||!allowed.has(id))continue;if(!/^\d+$/.test(code)||!label)throw new Error(`Tema inválido para a proposição ${id}`);const key=`theme:${id}:${code}`;if(keys.has(key))continue;keys.add(key);records.push({source:'camara',externalKey:key,kind:'theme',personExternalId:null,proposalId:id,deliberationId:null,bodyId:null,occurredAt:null,label,value:null,officialUrl:`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}/temas`,rawId})}
  return records;
}

async function download(year:number){const url=archiveUrl(year),response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Cívica/0.1 (official-data-research)'}}),bytes=new Uint8Array(await response.arrayBuffer());if(response.status!==200)throw new Error(`HTTP ${response.status} ao coletar temas de ${year}`);return{url,bytes,fetchedAt:new Date().toISOString(),contentType:response.headers.get('content-type')??'application/json'}}

export async function collectCamaraThemes(db:DatabaseSync,options:{year:number;rawDirectory:string;file?:string;dryRun?:boolean}){
  if(!Number.isInteger(options.year)||options.year<2001||options.year>2100)throw new Error('Ano de temas inv\u00e1lido');
  const url=archiveUrl(options.year),source=options.file?{url,bytes:new Uint8Array(await readFile(options.file)),fetchedAt:new Date().toISOString(),contentType:'application/json'}:await download(options.year);let runId:string|null=null;
  try{
    if(!options.dryRun)runId=startRun(db,'camara');
    const rawId=options.dryRun?'dry:camara-themes':options.file?await saveRawFile(db,runId!,options.rawDirectory,options.file,{url,fetchedAt:source.fetchedAt,status:200,contentType:source.contentType}):await saveRaw(db,runId!,options.rawDirectory,{url,fetchedAt:source.fetchedAt,status:200,contentType:source.contentType,bytes:source.bytes});
    const active=db.prepare(`SELECT DISTINCT p.external_id,json_extract(p.payload,'$.year') proposal_year FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE p.source='camara'`).all(),allowed=new Set(active.filter(row=>Number(row.proposal_year)===options.year).map(row=>String(row.external_id))),excludedWithoutYear=active.filter(row=>row.proposal_year===null).length;
    if(!allowed.size)throw new Error(`Nenhuma proposi\u00e7\u00e3o ativa da C\u00e2mara em ${options.year}`);
    const records=parseCamaraThemes(source.bytes,rawId,options.year,allowed),covered=new Set(records.map(row=>row.proposalId)).size,missing=allowed.size-covered,coverage=covered/allowed.size,result={year:options.year,universe:'proposi\u00e7\u00f5es com ano legislativo publicado',proposals:allowed.size,proposalsWithThemes:covered,proposalsWithoutThemes:missing,excludedWithoutYear,coverage,themes:records.length,published:false};
    if(!options.dryRun){publishComplement(db,runId!,'camara',`themes-${options.year}`,records,{...result,published:undefined,source:url});result.published=true}
    return result;
  }catch(error){if(runId)failRun(db,runId,error instanceof Error?error.message:String(error));throw error}
}
