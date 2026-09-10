import type {DatabaseSync} from 'node:sqlite';
import {type DataCoverage,type Profile,type Source,ufs} from '@senadotracker/domain';
import {publishedParticipationRows} from './panorama.ts';

export type RankingDimension='expense_desc'|'expense_asc'|'absences_desc'|'proposals_desc'|'rapporteurships_desc';
export interface RankingQuery{source:Source;dimension:RankingDimension;year?:number;uf?:string;party?:string;page?:number;pageSize?:number}

const annual=(year:number)=>({from:`${year}-01-01`,to:`${year}-12-31`,grain:'year' as const});

export function publishedRankings(db:DatabaseSync,query:RankingQuery){
  const page=query.page??1,pageSize=query.pageSize??25;if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new Error('Paginação inválida');if(query.uf&&!ufs.has(query.uf))throw new Error('UF inválida');
  const profileRows=db.prepare(`SELECT p.external_id,p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=?`).all(query.source).map(row=>({externalId:String(row.external_id),profile:JSON.parse(String(row.payload)) as Profile}));
  const facets={ufs:[...new Set(profileRows.map(row=>row.profile.uf))].sort(),parties:[...new Set(profileRows.map(row=>row.profile.party))].sort()};
  const profiles=profileRows.filter(row=>(!query.uf||row.profile.uf===query.uf)&&(!query.party||row.profile.party===query.party));
  const availableYears=(query.dimension.startsWith('expense')?db.prepare('SELECT year FROM active_expense_publications WHERE source=? ORDER BY year DESC'):query.dimension==='absences_desc'?db.prepare('SELECT year FROM active_presence_publications WHERE source=? ORDER BY year DESC'):null)?.all(query.source).map(row=>Number(row.year))??[];
  const year=query.year&&availableYears.includes(query.year)?query.year:availableYears[0]??null,values=new Map<string,number>();let coverage:DataCoverage;
  if(query.dimension.startsWith('expense')){
    const batch=year===null?null:db.prepare(`SELECT b.id,b.published_at FROM expense_batches b JOIN active_expense_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(query.source,year);
    if(batch)for(const row of db.prepare(`SELECT external_id,sum(net_cents-refund_cents) value FROM expenses WHERE batch_id=? GROUP BY external_id`).all(String(batch.id)))values.set(String(row.external_id),Number(row.value));
    coverage=batch&&year!==null?{availability:values.size?'available':'partial',source:query.source,period:annual(year),batchId:String(batch.id),note:'Cota líquida identificada no lote anual ativo; parlamentares sem lançamento não entram como gasto zero.',sampleSize:0}:{availability:'unavailable',source:query.source,period:{from:null,to:null,grain:'year'},batchId:null,note:'Não há lote anual de cota para este recorte.',sampleSize:0};
  }else if(query.dimension==='absences_desc'){
    const batch=year===null?null:db.prepare(`SELECT b.id,b.availability,b.note FROM presence_batches b JOIN active_presence_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(query.source,year);
    if(batch&&String(batch.availability)==='available'){const metrics=publishedParticipationRows(db,query.source,year!,profiles.map(row=>row.externalId));for(const [id,item] of Object.entries(metrics))if(item.presence.numerator!==null&&item.presence.denominator!==null)values.set(id,item.presence.denominator-item.presence.numerator)}
    coverage=batch&&year!==null?{availability:String(batch.availability) as DataCoverage['availability'],source:query.source,period:annual(year),batchId:String(batch.id),note:`${String(batch.note)} Ranking usa faltas entre sessões elegíveis no período de exercício.`,sampleSize:0}:{availability:'unavailable',source:query.source,period:{from:null,to:null,grain:'year'},batchId:null,note:'Não há lote anual de presença para este recorte.',sampleSize:0};
  }else{
    const batches=db.prepare('SELECT a.batch_id FROM active_activity_publications a WHERE a.source=?').all(query.source).map(row=>String(row.batch_id)),marks=batches.map(()=>'?').join(',');
    if(batches.length){const sql=query.dimension==='proposals_desc'?`SELECT person_external_id external_id,count(DISTINCT batch_id||':'||proposal_id) value FROM proposal_authors WHERE batch_id IN (${marks}) AND person_external_id IS NOT NULL GROUP BY person_external_id`:`SELECT person_external_id external_id,count(*) value FROM legislative_appointments WHERE batch_id IN (${marks}) AND kind='rapporteurship' GROUP BY person_external_id`;for(const row of db.prepare(sql).all(...batches))values.set(String(row.external_id),Number(row.value))}
    coverage=batches.length?{availability:'available',source:query.source,period:{from:null,to:null,grain:'unknown'},batchId:batches.join(','),note:query.dimension==='proposals_desc'?'Autoria publicada nos escopos ativos; coautoria conta para cada autor.':'Relatorias explicitamente publicadas nos escopos ativos.',sampleSize:0}:{availability:'unavailable',source:query.source,period:{from:null,to:null,grain:'unknown'},batchId:null,note:'Não há lote de atividade legislativa publicado.',sampleSize:0};
  }
  const ascending=query.dimension==='expense_asc';const ranked=profiles.flatMap(({externalId,profile})=>values.has(externalId)?[{externalId,profile,value:values.get(externalId)!}]:[]).sort((a,b)=>(ascending?a.value-b.value:b.value-a.value)||a.profile.name.localeCompare(b.profile.name,'pt-BR')||a.externalId.localeCompare(b.externalId));
  const items=ranked.map((item,index)=>({...item,rank:index+1})),sampleSize=items.length,start=(page-1)*pageSize;coverage={...coverage,sampleSize};
  return{dimension:query.dimension,source:query.source,year,availableYears,facets,total:items.length,page,pageSize,items:items.slice(start,start+pageSize),coverage};
}
