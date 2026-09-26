import type { DatabaseSync } from 'node:sqlite';
import { failRun, startRun, transaction } from '@senadotracker/db';
import { InstitutionalHttp } from './institutional-http.ts';
import { persistInstitutionalRaw, stageInstitutionalSourceRecord } from './institutional-storage.ts';
import { checkpoint, emptyInstitutionalMetrics, finishInstitutionalMetrics, startInstitutionalMetrics } from './institutional-run.ts';
import { stableInstitutionalId } from './institutional-normalize.ts';
import { aggregateSenateExecutionRows, parseSenateContractualExpenses, parseSenateExecutionDetail } from './senate-financial-execution.ts';

export interface SenateFinancialYearOptions { year:number; rawDirectory:string; limit?:number|null; ids?:string[]; dryRun?:boolean; force?:boolean; resume?:boolean; http?:InstitutionalHttp; progress?:(message:string)=>void }
const base='https://www6g.senado.leg.br/transparencia/orcfin/despesas-contratuais';
const absolute=(href:string)=>new URL(href.replace(/^detalhe_documento\.asp/i,'detalhaDocumento.asp'),'https://www.senado.gov.br/transparencia/gestgov/recdesp/despesas/').href;
const normalizeNe=(value:string)=>{const m=/(\d{4})NE0*(\d+)/i.exec(value.replace(/\s|\//g,''));return m?`${m[1]}NE${m[2]!.padStart(6,'0')}`:null};

/** Coleta o exercício financeiro por favorecido, sem exigir que o contrato seja do mesmo ano. */
export async function collectSenateFinancialYear(db:DatabaseSync,options:SenateFinancialYearOptions){
  const scope=`${options.year}`, prior=db.prepare('SELECT status FROM institutional_collector_checkpoints WHERE collector=? AND scope=?').get('senate-financial-year',scope) as {status?:string}|undefined;
  if(options.resume&&!options.force&&prior?.status==='complete')return{skipped:true,reason:'up-to-date',year:options.year};
  const runId=startRun(db,'senado'),metrics=emptyInstitutionalMetrics(),http=options.http??new InstitutionalHttp({delayMs:150,maxAttempts:4});startInstitutionalMetrics(db,runId,'senate-financial-year',scope);checkpoint(db,'senate-financial-year',scope,{status:'running'});
  try{
    const docs=db.prepare(`SELECT DISTINCT si.normalized_value document,s.canonical_name name FROM supplier_identifiers si JOIN suppliers s ON s.id=si.supplier_id JOIN supplier_roles r ON r.supplier_id=s.id WHERE si.identifier_type='cnpj' AND si.validation_status='valid' AND si.is_masked=0 AND r.institution='SENADO' ORDER BY si.normalized_value`).all() as Record<string,unknown>[];
    const selectedBase=options.ids?.length?docs.filter(row=>options.ids!.includes(String(row.document))):docs, selected=options.limit?selectedBase.slice(0,options.limit):selectedBase, collected:Array<{doc:string;rows:ReturnType<typeof aggregateSenateExecutionRows>;rawId:string;url:string;fetchedAt:string;details:{ne:string;movements:ReturnType<typeof parseSenateExecutionDetail>}[]}>=[];
    const concurrency=Math.max(1,Math.min(options.limit?options.limit:6,6));
    let cursor=0;
    const worker=async()=>{while(cursor<selected.length){const item=selected[cursor++]!,doc=String(item.document),url=`${base}/${options.year}/favorecido/${doc}`;try{const response=await http.bytes(url,{Accept:'text/html'}),raw=persistInstitutionalRaw(db,runId,options.rawDirectory,response),rows=aggregateSenateExecutionRows(parseSenateContractualExpenses(new TextDecoder().decode(response.bytes)));metrics.requests++;metrics.bytes+=response.bytes.length;const details:{ne:string;movements:ReturnType<typeof parseSenateExecutionDetail> }[]=[];for(const row of rows){if(row.paidScaled===0||!row.detailUrl)continue;try{const detailUrl=absolute(row.detailUrl),detailResponse=await http.bytes(detailUrl,{Accept:'text/html'}),detailRaw=persistInstitutionalRaw(db,runId,options.rawDirectory,detailResponse),movements=parseSenateExecutionDetail(new TextDecoder().decode(detailResponse.bytes),options.year).filter(m=>m.phase==='payment'&&m.movementYear===options.year);if(movements.length){details.push({ne:row.commitmentNumber,movements});metrics.requests++;metrics.bytes+=detailResponse.bytes.length;void detailRaw}}catch{metrics.apiEmptyResponses++}}collected.push({doc,rows,rawId:raw.rawId,url,fetchedAt:response.fetchedAt,details});options.progress?.(`${doc}: ${rows.length} NEs, ${details.reduce((n,x)=>n+x.movements.length,0)} pagamentos datados em ${options.year}`)}catch{metrics.apiEmptyResponses++}}};
    await Promise.all(Array.from({length:concurrency},()=>worker()));
    const dated=collected.flatMap(item=>item.details.flat());metrics.recordsFetched=dated.length;
    if(metrics.requests===0) throw new Error('Fonte financeira anual do Senado indisponivel; lote nao publicado');
    if(options.dryRun){finishInstitutionalMetrics(db,runId,'senate-financial-year',scope,metrics,'complete');failRun(db,runId,'dry-run');checkpoint(db,'senate-financial-year',scope,{status:'pending',metadata:{dryRun:true,documents:selected.length,datedPayments:dated.length}});return{dryRun:true,documents:selected.length,datedPayments:dated.length,metrics}}
    transaction(db,()=>{const now=new Date().toISOString();db.prepare('INSERT INTO institutional_collection_batches VALUES (?,?,?,?,?,?,?,?,?,?)').run(runId,'SENADO','senado_siafi','financial_year',`${options.year}-01-01`,`${options.year}-12-31`,now,metrics.apiEmptyResponses?'partial':'available',metrics.recordsFetched,JSON.stringify(metrics));
      for (const item of collected) {
        for (const detail of item.details) {
          const ne=normalizeNe(detail.ne);
          for (const movement of detail.movements) {
            if (!ne) continue;
            const supplier=db.prepare("SELECT supplier_id FROM supplier_identifiers WHERE identifier_type='cnpj' AND normalized_value=? AND validation_status='valid' AND is_masked=0 LIMIT 1").get(item.doc) as {supplier_id?:string}|undefined;
            const commitmentYear=Number(ne.slice(0,4))||options.year;
            const commitmentKey=`${options.year}:annual:${ne}`;
            const existing=db.prepare("SELECT id FROM commitments WHERE source_system='senado_siafi' AND source_commitment_id=?").get(commitmentKey) as {id?:string}|undefined;
            const commitmentId=existing?.id??stableInstitutionalId('commitment','senado_siafi',options.year,ne);
            const record=stageInstitutionalSourceRecord(db,{batchId:runId,sourceSystem:'senado_siafi',entityType:'financial_payment_year',externalKey:`${item.doc}:${movement.sourceId}`,payload:{document:item.doc,ne,movement},fetchedAt:item.fetchedAt,rawId:item.rawId});
            if(!existing) db.prepare(`INSERT INTO commitments(id,institution,source_system,source_commitment_id,contract_id,supplier_id,commitment_number,commitment_year,issued_at,currency,committed_value_scaled,value_scale,status,link_evidence,source_record_id) VALUES (?,'SENADO','senado_siafi',?,NULL,?,?,?,NULL,'BRL',NULL,2,'direct_financial_year',?,?)`).run(commitmentId,commitmentKey,supplier?.supplier_id??null,ne,commitmentYear,item.url,record.id);
            else if(supplier?.supplier_id) db.prepare('UPDATE commitments SET supplier_id=?,source_record_id=? WHERE id=?').run(supplier.supplier_id,record.id,commitmentId);
            db.prepare(`INSERT INTO financial_movements(id,commitment_id,source_system,source_movement_id,phase,movement_kind,movement_year,occurred_at,currency,amount_signed_scaled,value_scale,restos_a_pagar,source_record_id) VALUES (?,?,'senado_siafi',?,'payment',?,?,?,?,?,2,?,?) ON CONFLICT(source_system,source_movement_id) DO UPDATE SET occurred_at=excluded.occurred_at,movement_year=excluded.movement_year,amount_signed_scaled=excluded.amount_signed_scaled,source_record_id=excluded.source_record_id`).run(stableInstitutionalId('movement','senado_siafi','year',options.year,movement.sourceId),commitmentId,movement.sourceId,movement.kind,movement.movementYear,movement.occurredAt,'BRL',movement.amountSignedScaled,movement.restosAPagar?1:0,record.id);
            metrics.recordsInserted++;
          }
        }
      }
      db.prepare(`INSERT INTO active_institutional_publications VALUES ('SENADO','senado_siafi','financial_year',?) ON CONFLICT(institution,source_system,dataset) DO UPDATE SET batch_id=excluded.batch_id`).run(runId);db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,metrics.recordsFetched,JSON.stringify(metrics),runId);db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId)});
    finishInstitutionalMetrics(db,runId,'senate-financial-year',scope,metrics,'complete');checkpoint(db,'senate-financial-year',scope,{status:'complete',metadata:{runId,documents:selected.length,datedPayments:dated.length}});return{runId,documents:selected.length,datedPayments:dated.length,metrics};
  }catch(error){const message=error instanceof Error?error.message:String(error);try{finishInstitutionalMetrics(db,runId,'senate-financial-year',scope,metrics,'failed',message)}catch{}failRun(db,runId,message);checkpoint(db,'senate-financial-year',scope,{status:'failed',error:message});throw error}
}

