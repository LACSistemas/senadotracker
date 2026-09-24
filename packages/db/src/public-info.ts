import type {DatabaseSync} from 'node:sqlite';
import type {Availability,Source} from '@senadotracker/domain';

export interface NormativeValue{valueCents:number;unit:string;validFrom:string;validTo:string|null;legalBasis:string;officialUrl:string;publishedAt:string;note:string}

/** Valor normativo vigente numa data, ou `null`. Nunca cai no valor mais recente: séries não são
    completadas com o valor corrente, e um valor fora de vigência seria indistinguível de um vigente. */
export function publishedNormativeValue(db:DatabaseSync,kind:string,appliesTo:string,at=new Date().toISOString().slice(0,10)):NormativeValue|null{
  const row=db.prepare(`SELECT * FROM normative_values WHERE kind=? AND applies_to=? AND valid_from<=? AND (valid_to IS NULL OR valid_to>=?) ORDER BY valid_from DESC LIMIT 1`).get(kind,appliesTo,at,at);
  return row?{valueCents:Number(row.value_cents),unit:String(row.unit),validFrom:String(row.valid_from),validTo:row.valid_to?String(row.valid_to):null,legalBasis:String(row.legal_basis),officialUrl:String(row.official_url),publishedAt:String(row.published_at),note:String(row.note)}:null;
}
export const publishedParliamentarySubsidy=(db:DatabaseSync,at?:string)=>publishedNormativeValue(db,'parliamentary_subsidy','congress',at);
export const publishedMinimumWage=(db:DatabaseSync,at?:string)=>publishedNormativeValue(db,'minimum_wage','brasil',at);

export function publishedExpenseCoverage(db:DatabaseSync,source:Source){return db.prepare(`SELECT a.year,a.batch_id,b.published_at,b.record_count,min(e.month) first_month,max(e.month) last_month,count(DISTINCT e.month) months FROM active_expense_publications a JOIN expense_batches b ON b.id=a.batch_id LEFT JOIN expenses e ON e.batch_id=a.batch_id WHERE a.source=? GROUP BY a.year,a.batch_id,b.published_at,b.record_count ORDER BY a.year DESC`).all(source).map(row=>{const year=Number(row.year),months=Number(row.months),currentYear=new Date().getFullYear(),lastMonth=row.last_month===null?null:Number(row.last_month);return{year,batchId:String(row.batch_id),publishedAt:String(row.published_at),recordCount:Number(row.record_count),firstMonth:row.first_month===null?null:Number(row.first_month),lastMonth,months,complete:months===12}})}

export function publishedSourceFreshness(db:DatabaseSync,now=new Date()){
  return(['senado','camara'] as Source[]).map(source=>{const row=db.prepare(`SELECT a.batch_id,b.published_at FROM active_publications a JOIN publication_batches b ON b.id=a.batch_id WHERE a.source=?`).get(source),updatedAt=row?String(row.published_at):null,ageDays=updatedAt?Math.max(0,(now.getTime()-Date.parse(updatedAt))/86400000):null,availability:Availability=!updatedAt?'unavailable':ageDays!==null&&ageDays>7?'stale':'available';return{source,updatedAt,batchId:row?String(row.batch_id):null,availability,ageDays,note:availability==='stale'?`Cadastro ativo publicado há ${Math.floor(ageDays!)} dias.`:availability==='available'?'Cadastro oficial ativo atualizado nos últimos 7 dias.':'Não há cadastro oficial ativo.'}});
}
