import type { DatabaseSync } from 'node:sqlite';
import { distribution, type CampaignTransaction, type Candidacy, type DataCoverage, type ElectoralAsset, type ExpandedCost, type Source } from '@senadotracker/domain';
import { publishedStaffSnapshot, publishedCabinetBudgets } from './cabinet-data.ts';
import { publishedExpandedCosts } from './costs.ts';

const sum=(values:Array<{valueCents:number}>)=>values.reduce((total,item)=>total+item.valueCents,0);

export function publishedPersonElectoralProfile(db:DatabaseSync,personId:string){
  const rows=db.prepare(`SELECT c.payload,b.availability,b.note,b.published_at,b.id batch_id FROM candidacies c JOIN active_electoral_publications a ON a.batch_id=c.batch_id JOIN electoral_batches b ON b.id=c.batch_id WHERE c.person_id=? AND c.match_status='confirmed' ORDER BY c.year,c.sequence_id`).all(personId);
  const elections=rows.map(row=>{
    const candidacy={...JSON.parse(String(row.payload)) as Candidacy,availability:String(row.availability),note:String(row.note),publishedAt:String(row.published_at)},batchId=String(row.batch_id);
    const rawAssets=db.prepare('SELECT payload FROM electoral_assets WHERE batch_id=? AND sequence_id=? ORDER BY asset_id,version').all(batchId,candidacy.sequenceId).map(value=>JSON.parse(String(value.payload)) as ElectoralAsset);
    const rawTransactions=db.prepare('SELECT payload FROM campaign_transactions WHERE batch_id=? AND sequence_id=? ORDER BY kind,transaction_id,version').all(batchId,candidacy.sequenceId).map(value=>JSON.parse(String(value.payload)) as CampaignTransaction);
    const assetCounts=new Map<string,number>(),transactionCounts=new Map<string,number>();
    for(const item of rawAssets)assetCounts.set(item.assetId,(assetCounts.get(item.assetId)??0)+1);
    for(const item of rawTransactions){const key=`${item.kind}:${item.transactionId}`;transactionCounts.set(key,(transactionCounts.get(key)??0)+1)}
    const assets=rawAssets.filter(item=>assetCounts.get(item.assetId)===1),transactions=rawTransactions.filter(item=>transactionCounts.get(`${item.kind}:${item.transactionId}`)===1),assetVersionConflicts=rawAssets.length-assets.length,transactionVersionConflicts=rawTransactions.length-transactions.length;
    const revenues=transactions.filter(item=>item.kind==='revenue'),expenses=transactions.filter(item=>item.kind==='expense');
    return{candidacy,assets,revenues,expenses,assetVersionConflicts,transactionVersionConflicts,assetTotalCents:sum(assets),revenueTotalCents:sum(revenues),expenseTotalCents:sum(expenses),coverage:{
      election:{availability:candidacy.availability,source:'tse',period:{from:String(candidacy.year),to:String(candidacy.year),grain:'year'},batchId,note:candidacy.note,sampleSize:1},
      assets:{availability:assets.length&&assetVersionConflicts===0?'available':'partial',source:'tse',period:{from:String(candidacy.year),to:String(candidacy.year),grain:'year'},batchId,note:assetVersionConflicts?`${assetVersionConflicts} versões conflitantes foram excluídas do total declarado.`:assets.length?'Bens declarados pelo candidato neste pleito.':'Nenhum bem foi localizado no lote vinculado; isso não prova patrimônio zero.',sampleSize:assets.length},
      campaign:{availability:transactions.length&&transactionVersionConflicts===0?'available':'partial',source:'tse',period:{from:String(candidacy.year),to:String(candidacy.year),grain:'year'},batchId,note:transactionVersionConflicts?`${transactionVersionConflicts} versões conflitantes foram excluídas dos totais de campanha.`:transactions.length?'Receitas e despesas de campanha vinculadas à candidatura.':'Contas de campanha não disponíveis para esta candidatura no lote ativo.',sampleSize:transactions.length},
    }} as const;
  });
  const patrimony=elections.filter(item=>item.assets.length&&item.assetVersionConflicts===0).map(item=>({year:item.candidacy.year,electionId:item.candidacy.electionId,office:item.candidacy.office,valueCents:item.assetTotalCents,assetCount:item.assets.length}));
  const changes=patrimony.slice(1).map((item,index)=>{const previous=patrimony[index]!;return{fromYear:previous.year,toYear:item.year,fromCents:previous.valueCents,toCents:item.valueCents,changeCents:item.valueCents-previous.valueCents,changeRate:previous.valueCents?item.valueCents/previous.valueCents-1:null,note:'Variação entre valores declarados em eleições distintas; não mede enriquecimento nem patrimônio atual.'}});
  const coverage:DataCoverage=elections.length?{availability:elections.some(item=>item.candidacy.availability!=='available')?'partial':'available',source:'tse',period:{from:String(elections[0]!.candidacy.year),to:String(elections.at(-1)!.candidacy.year),grain:'year'},batchId:[...new Set(elections.map(item=>item.coverage.election.batchId))].join(','),note:'Somente candidaturas com vínculo confirmado por múltiplas evidências.',sampleSize:elections.length}:{availability:'unavailable',source:'tse',period:{from:null,to:null,grain:'unknown'},batchId:null,note:'Nenhuma candidatura com vínculo confirmado nos lotes eleitorais ativos.',sampleSize:0};
  return{coverage,elections:[...elections].reverse(),patrimony,changes};
}

export function publishedCabinetProfile(db:DatabaseSync,source:Source,externalId:string){
  const rawStaff=publishedStaffSnapshot(db,source,externalId);
  const staff={coverage:rawStaff.coverage,items:rawStaff.items.map((item,index)=>({key:`staff-${index+1}`,name:item.name,relationship:item.relationship,position:item.position,role:item.role,appointedAt:item.appointedAt,startedAt:item.startedAt,endedAt:item.endedAt,observedAt:item.observedAt,origin:item.origin}))};
  const categories=Object.entries(staff.items.reduce<Record<string,number>>((acc,item)=>{acc[item.relationship]=(acc[item.relationship]??0)+1;return acc},{})).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'pt-BR'));
  if(source==='camara'){
    const years=db.prepare("SELECT year FROM active_cabinet_budget_publications WHERE source='camara' ORDER BY year").all().map(row=>Number(row.year)),year=years.at(-1)??new Date().getFullYear(),budget=publishedCabinetBudgets(db,externalId,year);
    const availableValues=budget.items.flatMap(item=>item.availableCents===null?[]:[item.availableCents]),spentValues=budget.items.flatMap(item=>item.spentCents===null?[]:[item.spentCents]),availableCents=availableValues.length?availableValues.reduce((a,b)=>a+b,0):null,spentCents=spentValues.length?spentValues.reduce((a,b)=>a+b,0):null;
    return{source,staff:{...staff,categories},financial:{kind:'budget' as const,year,coverage:budget.coverage,items:budget.items,totalAvailableCents:availableCents,totalSpentCents:spentCents,utilization:availableCents&&spentCents!==null?spentCents/availableCents:null}};
  }
  const costs=publishedExpandedCosts(db,source,externalId),competence=costs[0]?.competence??null,items=competence?costs.filter(item=>item.competence===competence):[],components=items.filter(item=>item.nature==='expense'),totalCents=components.reduce((total,item)=>total+(item.valueCents??0),0);
  const coverage:DataCoverage=items.length?{availability:items.some(item=>item.availability!=='available')?'partial':'available',source,period:{from:competence,to:competence,grain:'month'},batchId:null,note:'Parcela identificada da folha por lotação; não inclui encargos patronais nem custos externos.',sampleSize:items.find(item=>item.nature==='headcount')?.count??null}:{availability:'unavailable',source,period:{from:null,to:null,grain:'month'},batchId:null,note:'Nenhuma folha vinculada com segurança a este gabinete.',sampleSize:0};
  return{source,staff:{...staff,categories},financial:{kind:'payroll' as const,competence,coverage,items,totalCents}};
}

export interface CabinetSummary {
  staff:number|null;
  financialCents:number|null;
  period:string|null;
  kind:'budget_spent'|'identified_payroll';
}

/** Returns the listing-level cabinet metrics with three grouped queries at most. */
export function publishedCabinetSummaries(db:DatabaseSync,source:Source,externalIds:string[]){
  const result:Record<string,CabinetSummary>={};
  if(!externalIds.length)return result;
  const marks=externalIds.map(()=>'?').join(',');
  const kind=source==='camara'?'budget_spent' as const:'identified_payroll' as const;
  for(const externalId of externalIds)result[externalId]={staff:null,financialCents:null,period:null,kind};
  const staffBatch=db.prepare('SELECT batch_id FROM active_staff_snapshot_publications WHERE source=?').get(source);
  if(staffBatch){
    for(const row of db.prepare(`SELECT external_id,count(*) value FROM functional_staff_assignments WHERE batch_id=? AND source=? AND match_status='confirmed' AND external_id IN (${marks}) GROUP BY external_id`).all(String(staffBatch.batch_id),source,...externalIds)){
      result[String(row.external_id)]!.staff=Number(row.value);
    }
    // An active, available snapshot means a missing row is a measured zero.
    const availability=db.prepare('SELECT availability FROM staff_snapshot_batches WHERE id=?').get(String(staffBatch.batch_id));
    if(availability&&String(availability.availability)!=='unavailable')for(const item of Object.values(result))item.staff??=0;
  }
  if(source==='camara'){
    const active=db.prepare("SELECT year,batch_id FROM active_cabinet_budget_publications WHERE source='camara' ORDER BY year DESC LIMIT 1").get();
    if(active)for(const row of db.prepare(`SELECT external_id,sum(spent_cents) value FROM cabinet_monthly_budgets WHERE batch_id=? AND external_id IN (${marks}) GROUP BY external_id`).all(String(active.batch_id),...externalIds)){
      const item=result[String(row.external_id)];if(item){item.financialCents=row.value===null?null:Number(row.value);item.period=String(active.year)}
    }
  }else{
    const active=db.prepare("SELECT batch_id FROM active_expanded_cost_publications WHERE source='senado' ORDER BY year DESC LIMIT 1").get();
    if(active){
      const latest=db.prepare(`SELECT max(competence) competence FROM expanded_costs WHERE batch_id=? AND external_id IN (${marks})`).get(String(active.batch_id),...externalIds);
      const competence=latest?.competence?String(latest.competence):null;
      if(competence)for(const row of db.prepare(`SELECT external_id,sum(value_cents) value FROM expanded_costs WHERE batch_id=? AND competence=? AND nature='expense' AND external_id IN (${marks}) GROUP BY external_id`).all(String(active.batch_id),competence,...externalIds)){
        const item=result[String(row.external_id)];if(item){item.financialCents=row.value===null?null:Number(row.value);item.period=competence}
      }
    }
  }
  return result;
}

export function publishedCabinetPanorama(db:DatabaseSync,source:Source){
  const staff=publishedStaffSnapshot(db,source),staffCounts=new Map<string,number>();for(const item of staff.items)if(item.externalId)staffCounts.set(item.externalId,(staffCounts.get(item.externalId)??0)+1);
  if(source==='camara'){
    const year=Number(db.prepare("SELECT max(year) year FROM active_cabinet_budget_publications WHERE source='camara'").get()?.year??new Date().getFullYear()),batch=db.prepare("SELECT batch_id FROM active_cabinet_budget_publications WHERE source='camara' AND year=?").get(year);
    const totals=batch?db.prepare('SELECT external_id,sum(spent_cents) value FROM cabinet_monthly_budgets WHERE batch_id=? GROUP BY external_id').all(String(batch.batch_id)).map(row=>({externalId:String(row.external_id),value:Number(row.value)})):[];
    return{source,period:String(year),staff:distribution([...staffCounts.values()]),financial:distribution(totals.map(item=>item.value)),financialMean:totals.length?totals.reduce((sum,item)=>sum+item.value,0)/totals.length:null,sampleSize:totals.length,kind:'budget_spent' as const};
  }
  const batch=db.prepare("SELECT batch_id FROM active_expanded_cost_publications WHERE source='senado' ORDER BY year DESC LIMIT 1").get(),rows=batch?db.prepare("SELECT external_id,payload FROM expanded_costs WHERE batch_id=?").all(String(batch.batch_id)).map(row=>JSON.parse(String(row.payload)) as ExpandedCost):[],competence=rows.map(item=>item.competence).sort().at(-1)??null,totals=new Map<string,number>();
  for(const item of rows)if(item.competence===competence&&item.nature==='expense')totals.set(item.externalId,(totals.get(item.externalId)??0)+(item.valueCents??0));
  return{source,period:competence,staff:distribution([...staffCounts.values()]),financial:distribution([...totals.values()]),financialMean:totals.size?[...totals.values()].reduce((sum,value)=>sum+value,0)/totals.size:null,sampleSize:totals.size,kind:'identified_payroll' as const};
}
