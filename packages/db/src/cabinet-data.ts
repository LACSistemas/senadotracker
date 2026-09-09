import type { DatabaseSync } from 'node:sqlite';
import type { Availability, CabinetMonthlyBudget, DataCoverage, FunctionalStaffAssignment, Source } from '@senadotracker/domain';

type PublishableAvailability=Extract<Availability,'available'|'partial'|'unavailable'>;
const atomic=<T>(db:DatabaseSync,work:()=>T)=>{db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}};
const validInstant=(value:string)=>Number.isFinite(Date.parse(value));
const rawBelongs=(db:DatabaseSync,rawId:string,runId:string)=>Boolean(db.prepare('SELECT 1 FROM raw_objects WHERE id=? AND run_id=?').get(rawId,runId));

export function snapshotAvailability(observedAt:string,base:PublishableAvailability,asOf=new Date(),staleAfterDays=2):Availability{
  if(base==='unavailable')return base;
  const observed=Date.parse(observedAt);
  if(!Number.isFinite(observed)||!Number.isFinite(asOf.getTime())||!Number.isInteger(staleAfterDays)||staleAfterDays<0)throw new Error('Parâmetros de validade do snapshot inválidos');
  return asOf.getTime()-observed>staleAfterDays*86_400_000?'stale':base;
}

export function publishStaffSnapshot(db:DatabaseSync,runId:string,source:Source,observedAt:string,availability:PublishableAvailability,note:string,rows:FunctionalStaffAssignment[]){
  if(!validInstant(observedAt)||rows.some(row=>row.source!==source||row.observedAt!==observedAt))throw new Error('Snapshot de pessoal inconsistente');
  return atomic(db,()=>{
    const run=db.prepare('SELECT status FROM ingestion_runs WHERE id=? AND source=?').get(runId,source);
    if(!run||run.status!=='running')throw new Error('Publicação de pessoal exige execução ativa');
    const keys=new Set<string>();
    for(const row of rows){
      if(!row.staffKey||!row.name.trim()||!row.relationship.trim()||!row.unitLabel.trim()||keys.has(row.staffKey))throw new Error('Pessoa funcional inválida ou duplicada');
      keys.add(row.staffKey);
      if(!rawBelongs(db,row.rawId,runId))throw new Error('Pessoa funcional sem origem no lote');
      if(row.matchStatus==='confirmed'){
        if(!row.externalId||!db.prepare('SELECT 1 FROM external_identifiers WHERE source=? AND external_id=?').get(source,row.externalId))throw new Error('Vínculo funcional confirmado sem parlamentar publicado');
      }else if(row.externalId!==null)throw new Error('Vínculo funcional não confirmado não pode atribuir gabinete');
      if(row.startedAt&&row.endedAt&&row.endedAt<row.startedAt)throw new Error('Intervalo funcional invertido');
    }
    const now=new Date().toISOString();
    db.prepare('INSERT INTO staff_snapshot_batches VALUES (?,?,?,?,?,?,?)').run(runId,source,observedAt,now,availability,note,rows.length);
    const insert=db.prepare('INSERT INTO functional_staff_assignments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for(const row of rows)insert.run(runId,row.source,row.staffKey,row.functionalId,row.name,row.relationship,row.position,row.role,row.unitId,row.unitLabel,row.appointedAt,row.startedAt,row.endedAt,row.observedAt,row.externalId,row.matchStatus,row.rawId,JSON.stringify(row));
    db.prepare('INSERT INTO active_staff_snapshot_publications VALUES (?,?) ON CONFLICT(source) DO UPDATE SET batch_id=excluded.batch_id').run(source,runId);
    db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,rows.length,JSON.stringify({observedAt,availability,records:rows.length}),runId);
    db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
    return runId;
  });
}

export function publishedStaffSnapshot(db:DatabaseSync,source:Source,externalId?:string,asOf=new Date(),staleAfterDays=2){
  const batch=db.prepare(`SELECT b.* FROM staff_snapshot_batches b JOIN active_staff_snapshot_publications a ON a.batch_id=b.id WHERE a.source=?`).get(source);
  if(!batch){const coverage:DataCoverage={availability:'unavailable',source,period:{from:null,to:null,grain:'snapshot'},batchId:null,note:'Não há snapshot de pessoal publicado.',sampleSize:0};return{coverage,items:[] as Array<FunctionalStaffAssignment&{origin:{url:string;fetchedAt:string;sha256:string}}>} }
  const values:string[]=[source];let filter='';if(externalId){filter=' AND s.external_id=?';values.push(externalId)}
  const items=db.prepare(`SELECT s.payload,r.url,r.fetched_at,r.sha256 FROM functional_staff_assignments s JOIN active_staff_snapshot_publications a ON a.batch_id=s.batch_id JOIN raw_objects r ON r.id=s.raw_id WHERE a.source=?${filter} ORDER BY s.name,s.staff_key`).all(...values).map(row=>({...JSON.parse(String(row.payload)) as FunctionalStaffAssignment,origin:{url:String(row.url),fetchedAt:String(row.fetched_at),sha256:String(row.sha256)}}));
  const availability=snapshotAvailability(String(batch.observed_at),String(batch.availability) as PublishableAvailability,asOf,staleAfterDays);
  const staleNote=availability==='stale'?` Snapshot excedeu ${staleAfterDays} dias em ${asOf.toISOString()}.`:'';
  const coverage:DataCoverage={availability,source,period:{from:String(batch.observed_at),to:String(batch.observed_at),grain:'snapshot'},batchId:String(batch.id),note:String(batch.note)+staleNote,sampleSize:items.length};
  return{coverage,items};
}

export function publishCabinetBudgets(db:DatabaseSync,runId:string,year:number,availability:PublishableAvailability,note:string,rows:CabinetMonthlyBudget[]){
  if(!Number.isInteger(year)||year<2008||year>2100)throw new Error('Ano de verba inválido');
  return atomic(db,()=>{
    const run=db.prepare("SELECT status FROM ingestion_runs WHERE id=? AND source='camara'").get(runId);
    if(!run||run.status!=='running')throw new Error('Publicação de verba exige execução ativa da Câmara');
    const keys=new Set<string>();
    for(const row of rows){
      const key=`${row.externalId}:${row.month}`;
      if(row.source!=='camara'||row.year!==year||!Number.isInteger(row.month)||row.month<1||row.month>12||keys.has(key))throw new Error('Verba mensal inconsistente ou duplicada');
      keys.add(key);
      if(row.availableCents!==null&&(!Number.isSafeInteger(row.availableCents)||row.availableCents<0))throw new Error('Limite de verba inválido');
      if(row.spentCents!==null&&(!Number.isSafeInteger(row.spentCents)||row.spentCents<0))throw new Error('Gasto de verba inválido');
      if(!db.prepare("SELECT 1 FROM external_identifiers WHERE source='camara' AND external_id=?").get(row.externalId))throw new Error('Verba sem deputado publicado');
      if(!rawBelongs(db,row.rawId,runId))throw new Error('Verba sem origem no lote');
    }
    const now=new Date().toISOString();
    db.prepare('INSERT INTO cabinet_budget_batches VALUES (?,?,?,?,?,?,?)').run(runId,'camara',year,now,availability,note,rows.length);
    const insert=db.prepare('INSERT INTO cabinet_monthly_budgets VALUES (?,?,?,?,?,?,?,?,?)');
    for(const row of rows)insert.run(runId,row.source,row.externalId,row.year,row.month,row.availableCents,row.spentCents,row.rawId,JSON.stringify(row));
    db.prepare("INSERT INTO active_cabinet_budget_publications VALUES ('camara',?,?) ON CONFLICT(source,year) DO UPDATE SET batch_id=excluded.batch_id").run(year,runId);
    db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,rows.length,JSON.stringify({year,availability,records:rows.length}),runId);
    db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
    return runId;
  });
}

export function publishedCabinetBudgets(db:DatabaseSync,externalId:string,year:number){
  const batch=db.prepare(`SELECT b.* FROM cabinet_budget_batches b JOIN active_cabinet_budget_publications a ON a.batch_id=b.id WHERE a.source='camara' AND a.year=?`).get(year);
  if(!batch){const coverage:DataCoverage={availability:'unavailable',source:'camara',period:{from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'},batchId:null,note:'Não há verba de gabinete publicada para o ano.',sampleSize:0};return{coverage,items:[] as Array<CabinetMonthlyBudget&{utilization:number|null}>}}
  const items=db.prepare(`SELECT payload FROM cabinet_monthly_budgets WHERE batch_id=? AND external_id=? ORDER BY month`).all(String(batch.id),externalId).map(row=>{const item=JSON.parse(String(row.payload)) as CabinetMonthlyBudget;return{...item,utilization:item.availableCents&&item.spentCents!==null?item.spentCents/item.availableCents:null}});
  const coverage:DataCoverage={availability:String(batch.availability) as PublishableAvailability,source:'camara',period:{from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'},batchId:String(batch.id),note:String(batch.note),sampleSize:items.length};
  return{coverage,items};
}
