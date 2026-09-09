import type { DatabaseSync } from 'node:sqlite';
import type { Source } from '@senadotracker/domain';
import { failRun,heartbeat,listPublished,publishExpenses,startRun } from '@senadotracker/db';
import { saveRaw } from './raw.ts';
import { parseChamberExpenses,parseSenateExpenses } from './parsers/expenses.ts';

const urls=(source:Source,year:number)=>source==='senado'?`https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_${year}.csv`:`https://www.camara.leg.br/cotas/Ano-${year}.json.zip`;
export async function collectExpenses(db:DatabaseSync,source:Source,year:number,rawDirectory:string,progress:((s:string)=>void)=console.log){
  const runId=startRun(db,source,Date.now(),300_000);try{const url=urls(source,year);progress(`${source}/${year}: baixando arquivo oficial`);const response=await fetch(url,{headers:{'User-Agent':'SenadoTracker/0.1 (official-data-research)'},redirect:'error',signal:AbortSignal.timeout(120_000)});const bytes=new Uint8Array(await response.arrayBuffer());if(response.status!==200||bytes.length===0)throw new Error(`HTTP ${response.status} ou arquivo vazio`);heartbeat(db,runId,Date.now(),300_000);const rawId=await saveRaw(db,runId,rawDirectory,{url,fetchedAt:new Date().toISOString(),status:response.status,contentType:response.headers.get('content-type')??'',bytes});const profiles=listPublished(db,{source,pageSize:100});let offset=2;while(profiles.items.length+(offset-2)*100<profiles.total){profiles.items.push(...listPublished(db,{source,page:offset++,pageSize:100}).items);}
    const identityByName=new Map(profiles.items.flatMap(p=>[[String(p.name).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').trim(),p.externalId],...(p.fullName?[[String(p.fullName).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').trim(),p.externalId] as [string,string]]:[])]));
    const parsed=source==='senado'?parseSenateExpenses(bytes,rawId,identityByName,year):parseChamberExpenses(bytes,rawId,identityByName,year);
    const skipped='unmatched' in parsed?parsed.unmatched.length:parsed.ignored.length;progress(`${source}/${year}: ${parsed.expenses.length} registros vinculados; ${skipped} identidades fora do cadastro atual`);publishExpenses(db,runId,source,year,parsed.expenses);return{runId,count:parsed.expenses.length,totalCents:parsed.expenses.reduce((s,e)=>s+e.netCents-e.refundCents,0)};
  }catch(error){failRun(db,runId,error instanceof Error?error.message:'Falha financeira');throw error;}}
