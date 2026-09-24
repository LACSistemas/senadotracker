import type { DatabaseSync } from 'node:sqlite';
import type { DataCoverage } from '@senadotracker/domain';
import { transaction } from './index.ts';

/** Índices são guardados escalados por 10.000 para não usar ponto flutuante em dado publicado. */
export const indexScale=10_000;
export interface PriceIndexPoint{referenceMonth:string;indexScaled:number}
const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;

export function publishPriceIndex(db:DatabaseSync,runId:string,indexCode:string,officialUrl:string,note:string,availability:'available'|'partial'|'unavailable',points:PriceIndexPoint[],rawId:string){
  transaction(db,()=>{
    const run=db.prepare("SELECT status FROM ingestion_runs WHERE id=? AND source='ibge'").get(runId);
    if(!run||run.status!=='running')throw new Error('Lote de índice exige execução IBGE ativa');
    if(!points.length)throw new Error('Lote de índice vazio');
    if(points.some(point=>!monthPattern.test(point.referenceMonth)))throw new Error('Mês de referência inválido');
    if(points.some(point=>!Number.isSafeInteger(point.indexScaled)||point.indexScaled<=0))throw new Error('Número-índice inválido');
    if(new Set(points.map(point=>point.referenceMonth)).size!==points.length)throw new Error('Mês de referência duplicado');
    const months=points.map(point=>point.referenceMonth).sort(),now=new Date().toISOString();
    db.prepare('INSERT INTO price_index_batches VALUES (?,?,?,?,?,?,?,?,?)').run(runId,indexCode,now,availability,months[0]!,months.at(-1)!,points.length,officialUrl,note);
    const insert=db.prepare('INSERT INTO price_index_values VALUES (?,?,?,?,?)');
    for(const point of points)insert.run(runId,indexCode,point.referenceMonth,point.indexScaled,rawId);
    db.prepare('INSERT INTO active_price_index_publications VALUES (?,?) ON CONFLICT(index_code) DO UPDATE SET batch_id=excluded.batch_id').run(indexCode,runId);
  });
}

const coverageOf=(indexCode:string,batch:{id:string;availability:string;note:string;official_url:string},from:string,to:string,sampleSize:number):DataCoverage=>
  ({availability:String(batch.availability) as DataCoverage['availability'],source:'ibge',period:{from,to,grain:'month'},batchId:batch.id,note:`${indexCode.toLocaleUpperCase('pt-BR')}: ${batch.note}`,sampleSize});

/** Um mês, um índice — ou `null`. Nunca cai no valor mais recente: a metodologia proíbe completar
    série com valor corrente, e um deflator estimado seria indistinguível de um medido. */
export function publishedPriceIndex(db:DatabaseSync,indexCode:string,month:string){
  if(!monthPattern.test(month))return null;
  const row=db.prepare(`SELECT v.index_scaled,b.id,b.availability,b.note,b.official_url FROM price_index_values v JOIN active_price_index_publications a ON a.batch_id=v.batch_id AND a.index_code=v.index_code JOIN price_index_batches b ON b.id=v.batch_id WHERE v.index_code=? AND v.reference_month=?`).get(indexCode,month);
  if(!row)return null;
  return{indexScaled:Number(row.index_scaled),referenceMonth:month,coverage:coverageOf(indexCode,{id:String(row.id),availability:String(row.availability),note:String(row.note),official_url:String(row.official_url)},month,month,1)};
}

/** Fator para trazer valores do mês inicial ao mês final. `null` se qualquer um dos dois faltar. */
export function publishedDeflator(db:DatabaseSync,indexCode:string,fromMonth:string,toMonth:string){
  const from=publishedPriceIndex(db,indexCode,fromMonth),to=publishedPriceIndex(db,indexCode,toMonth);
  if(!from||!to)return null;
  return{indexCode,fromMonth,toMonth,factor:to.indexScaled/from.indexScaled,
    coverage:{...to.coverage,period:{from:fromMonth,to:toMonth,grain:'month' as const},
      note:`${to.coverage.note} Fator de ${fromMonth} para ${toMonth} calculado sobre o número-índice publicado.`,sampleSize:2}};
}
