import type {DatabaseSync} from 'node:sqlite';
import type {DataCoverage,Profile,Source} from '@senadotracker/domain';

export interface SupplierRadarQuery {source?:Source;year?:number;search?:string;page?:number;pageSize?:number}
const validCnpj=(value:string)=>{const digits=value.replace(/\D/g,'');if(!/^\d{14}$/.test(digits)||/^(\d)\1+$/.test(digits))return false;const digit=(base:string,weights:number[])=>{const sum=[...base].reduce((total,n,index)=>total+Number(n)*weights[index]!,0),rest=sum%11;return rest<2?0:11-rest};return digit(digits.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])===Number(digits[12])&&digit(digits.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(digits[13])};

export function publishedSupplierRadar(db:DatabaseSync,query:SupplierRadarQuery={}){
  const page=query.page??1,pageSize=query.pageSize??25;
  if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new Error('Paginação inválida');
  const years=db.prepare('SELECT DISTINCT year FROM active_expense_publications ORDER BY year DESC').all().map(row=>Number(row.year));
  const selectedYear=query.year&&years.includes(query.year)?query.year:years[0]??null;
  if(selectedYear===null)return{items:[],total:0,page,pageSize,years,year:null,coverage:{availability:'unavailable',source:'multiple',period:{from:null,to:null,grain:'year'},batchId:null,note:'Não há lotes anuais ativos de despesas.',sampleSize:0} satisfies DataCoverage};
  const filters=['e.year=?',"e.supplier_document IS NOT NULL","trim(e.supplier_document)<>''"],values:(string|number)[]=[selectedYear];
  if(query.source){filters.push('e.source=?');values.push(query.source)}
  if(query.search){filters.push("(lower(e.supplier) LIKE ? OR replace(replace(replace(e.supplier_document,'.',''),'/',''),'-','') LIKE ?)");values.push(`%${query.search.toLocaleLowerCase('pt-BR')}%`,`%${query.search.replace(/\D/g,'')}%`)}
  const normalized="replace(replace(replace(replace(e.supplier_document,'.',''),'/',''),'-',''),' ','')";
  const rows=db.prepare(`SELECT ${normalized} document,max(coalesce(nullif(trim(e.supplier),''),'Fornecedor sem nome')) supplier,count(DISTINCT e.source||':'||e.external_id) parliamentarians,count(*) records,sum(e.net_cents-e.refund_cents) value_cents,count(DISTINCT e.source) houses FROM expenses e JOIN active_expense_publications a ON a.batch_id=e.batch_id WHERE ${filters.join(' AND ')} GROUP BY ${normalized} ORDER BY parliamentarians DESC,value_cents DESC,document`).all(...values);
  const batches=db.prepare(`SELECT group_concat(batch_id) ids FROM active_expense_publications WHERE year=?${query.source?' AND source=?':''}`).get(selectedYear,...(query.source?[query.source]:[]));
  const items=rows.filter(row=>validCnpj(String(row.document))).map(row=>({document:String(row.document),supplier:String(row.supplier),parliamentarians:Number(row.parliamentarians),records:Number(row.records),valueCents:Number(row.value_cents),houses:Number(row.houses)}));
  const coverage:DataCoverage={availability:items.length?'available':'partial',source:query.source??'multiple',period:{from:`${selectedYear}-01-01`,to:`${selectedYear}-12-31`,grain:'year'},batchId:batches?.ids?String(batches.ids):null,note:'Agrupamento por documento do fornecedor nos lotes anuais ativos. Um vínculo indica pagamento identificado, não irregularidade.',sampleSize:items.length};
  const start=(page-1)*pageSize;return{items:items.slice(start,start+pageSize),leader:items[0]??null,total:items.length,page,pageSize,years,year:selectedYear,coverage};
}

export function publishedPatrimonyRanking(db:DatabaseSync,fromYear=2018,toYear=2022){
  const profiles=new Map<string,{source:Source;externalId:string;profile:Profile}>();
  for(const row of db.prepare(`SELECT a.source,p.person_id,p.external_id,p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id`).all())profiles.set(String(row.person_id),{source:String(row.source) as Source,externalId:String(row.external_id),profile:JSON.parse(String(row.payload)) as Profile});
  const totals=new Map<string,Map<number,number>>();
  for(const row of db.prepare(`SELECT c.person_id,c.year,a.asset_id,count(*) versions,sum(a.value_cents) value FROM candidacies c JOIN active_electoral_publications x ON x.batch_id=c.batch_id JOIN electoral_assets a ON a.batch_id=c.batch_id AND a.sequence_id=c.sequence_id WHERE c.match_status='confirmed' AND c.person_id IS NOT NULL AND c.year IN (?,?) GROUP BY c.person_id,c.year,a.asset_id HAVING count(*)=1`).all(fromYear,toYear)){
    const byYear=totals.get(String(row.person_id))??new Map<number,number>();byYear.set(Number(row.year),(byYear.get(Number(row.year))??0)+Number(row.value));totals.set(String(row.person_id),byYear);
  }
  const items=[...totals].flatMap(([personId,byYear])=>{const profile=profiles.get(personId),from=byYear.get(fromYear),to=byYear.get(toYear);if(!profile||from===undefined||to===undefined)return[];return[{...profile,fromCents:from,toCents:to,changeCents:to-from,changeRate:from?to/from-1:null}]}).sort((a,b)=>(b.changeRate??-Infinity)-(a.changeRate??-Infinity)||b.changeCents-a.changeCents);
  const coverage:DataCoverage={availability:items.length?'available':'partial',source:'tse',period:{from:String(fromYear),to:String(toYear),grain:'year'},batchId:null,note:'Compara valores nominais declarados em eleições distintas e apenas vínculos confirmados. Não mede enriquecimento, valorização, renda ou patrimônio atual.',sampleSize:items.length};
  return{fromYear,toYear,items:items.map((item,index)=>({...item,rank:index+1})),coverage};
}
