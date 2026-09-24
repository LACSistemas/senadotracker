import type { DatabaseSync } from 'node:sqlite';
import { failRun, indexScale, publishPriceIndex, startRun, type PriceIndexPoint } from '@senadotracker/db';
import { saveRaw } from './raw.ts';

/** IPCA número-índice (base dez/1993=100), agregado 1737 / variável 2266 do SIDRA.
    O número-índice, e não a variação mensal, é o que permite deflacionar entre dois meses quaisquer
    sem acumular arredondamento de doze taxas por ano. */
const series={ipca:{aggregate:'1737',variable:'2266',label:'IPCA — número-índice (dez/1993=100)'}} as const;
export type PriceIndexCode=keyof typeof series;
export const priceIndexCodes=Object.keys(series) as PriceIndexCode[];
const sourceUrl=(code:PriceIndexCode)=>`https://servicodados.ibge.gov.br/api/v3/agregados/${series[code].aggregate}/periodos/all/variaveis/${series[code].variable}?localidades=N1[all]`;

interface SidraCell{serie?:Record<string,unknown>}
interface SidraVariable{resultados?:Array<{series?:SidraCell[]}>}

/** O SIDRA devolve `{resultados:[{series:[{serie:{"199401":"14.32",…}}]}]}`; períodos vêm como AAAAMM
    e valores ausentes aparecem como `"..."` ou `"-"`, que são descartados em vez de virarem zero. */
export function parsePriceIndex(bytes:Uint8Array):PriceIndexPoint[]{
  const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^﻿/,'')) as unknown;
  if(!Array.isArray(payload)||!payload.length)throw new Error('Resposta do IBGE sem variável');
  const points=new Map<string,number>();
  for(const variable of payload as SidraVariable[])for(const result of variable.resultados??[])for(const cell of result.series??[]){
    for(const [period,raw] of Object.entries(cell.serie??{})){
      if(!/^\d{6}$/.test(period))continue;
      const text=String(raw).trim().replace(',','.');
      if(!/^\d+(\.\d+)?$/.test(text))continue;
      const scaled=Math.round(Number(text)*indexScale);
      if(!Number.isSafeInteger(scaled)||scaled<=0)continue;
      points.set(`${period.slice(0,4)}-${period.slice(4,6)}`,scaled);
    }
  }
  if(!points.size)throw new Error('Nenhum número-índice reconhecido na resposta do IBGE');
  return [...points].sort(([a],[b])=>a.localeCompare(b)).map(([referenceMonth,indexScaled])=>({referenceMonth,indexScaled}));
}

export async function collectPriceIndex(db:DatabaseSync,options:{code:PriceIndexCode;rawDirectory:string;dryRun?:boolean}){
  const {code,rawDirectory,dryRun=false}=options,url=sourceUrl(code);
  const response=await fetch(url,{headers:{accept:'application/json'}});
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!response.ok)throw new Error(`IBGE respondeu ${response.status} para ${code}`);
  const points=parsePriceIndex(bytes);
  const report={code,url,months:points.length,first:points[0]!.referenceMonth,last:points.at(-1)!.referenceMonth,published:false};
  if(dryRun)return report;
  const runId=startRun(db,'ibge');
  try{
    const rawId=await saveRaw(db,runId,rawDirectory,{url,fetchedAt:new Date().toISOString(),status:response.status,contentType:response.headers.get('content-type')??'application/json',bytes});
    publishPriceIndex(db,runId,code,url,`${series[code].label}. Série mensal publicada pelo IBGE de ${points[0]!.referenceMonth} a ${points.at(-1)!.referenceMonth}.`,'available',points,rawId);
    db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=? WHERE id=?").run(new Date().toISOString(),points.length,runId);
    db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
  }catch(error){failRun(db,runId,error instanceof Error?error.message:String(error));throw error}
  return{...report,published:true};
}
