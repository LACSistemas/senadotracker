import type {DatabaseSync} from 'node:sqlite';
import {type DataCoverage,type Profile,type Source,validCnpj} from '@senadotracker/domain';
import {partyAtDate} from './parties.ts';

export interface SupplierRadarQuery {source?:Source;year?:number;search?:string;page?:number;pageSize?:number}
export {validCnpj};

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

export interface SupplierDetailQuery {document:string;source?:Source;year?:number;page?:number;pageSize?:number}
export function publishedSupplierDetail(db:DatabaseSync,query:SupplierDetailQuery){
  const document=query.document.replace(/\D/g,''),page=query.page??1,pageSize=query.pageSize??25;if(!validCnpj(document))return null;
  if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new Error('Paginação inválida');
  const years=db.prepare('SELECT DISTINCT year FROM active_expense_publications ORDER BY year DESC').all().map(row=>Number(row.year)),year=query.year&&years.includes(query.year)?query.year:years[0]??null;if(year===null)return null;
  const normalized="replace(replace(replace(replace(e.supplier_document,'.',''),'/',''),'-',''),' ','')";
  const rows=db.prepare(`SELECT e.*,p.payload profile FROM expenses e JOIN active_expense_publications a ON a.batch_id=e.batch_id JOIN active_publications ap ON ap.source=e.source JOIN profiles p ON p.batch_id=ap.batch_id AND p.external_id=e.external_id WHERE e.year=? AND ${normalized}=?${query.source?' AND e.source=?':''} ORDER BY e.month,e.issued_at,e.record_key`).all(year,document,...(query.source?[query.source]:[]));if(!rows.length)return null;
  const profiles=new Map<string,Profile>(),amount=(row:any)=>Number(row.net_cents)-Number(row.refund_cents);for(const row of rows)profiles.set(`${row.source}:${row.external_id}`,JSON.parse(String(row.profile)) as Profile);
  const peopleMap=new Map<string,{source:Source;externalId:string;profile:Profile;valueCents:number;records:number}>(),states=new Map<string,number>(),parties=new Map<string,number>(),categories=new Map<string,number>(),houses=new Map<Source,number>(),months=new Map<number,number>(),names=new Map<string,{name:string;records:number;valueCents:number}>();let totalCents=0;
  for(const row of rows){const valueCents=amount(row),source=String(row.source) as Source,externalId=String(row.external_id),profile=profiles.get(`${source}:${externalId}`)!,date=String(row.issued_at??`${year}-${String(row.month).padStart(2,'0')}-28`),party=partyAtDate(profile,date)??profile.party,name=String(row.supplier??'').trim();totalCents+=valueCents;const key=`${source}:${externalId}`,person=peopleMap.get(key)??{source,externalId,profile,valueCents:0,records:0};person.valueCents+=valueCents;person.records++;peopleMap.set(key,person);states.set(profile.uf,(states.get(profile.uf)??0)+valueCents);parties.set(party,(parties.get(party)??0)+valueCents);houses.set(source,(houses.get(source)??0)+valueCents);months.set(Number(row.month),(months.get(Number(row.month))??0)+valueCents);categories.set(String(row.category),(categories.get(String(row.category))??0)+valueCents);if(name){const normalizedName=name,entry=names.get(normalizedName)??{name,records:0,valueCents:0};entry.records++;entry.valueCents+=valueCents;names.set(normalizedName,entry)}}
  const people=[...peopleMap.values()].sort((a,b)=>b.valueCents-a.valueCents||a.profile.name.localeCompare(b.profile.name,'pt-BR')).map((item,index)=>({...item,rank:index+1,share:totalCents?item.valueCents/totalCents:null}));const grouped=<T extends string>(map:Map<T,number>)=>[...map].map(([label,valueCents])=>({label,valueCents,share:totalCents?valueCents/totalCents:null})).sort((a,b)=>b.valueCents-a.valueCents||a.label.localeCompare(b.label,'pt-BR'));const aliases=[...names.values()].sort((a,b)=>b.records-a.records||b.valueCents-a.valueCents||a.name.localeCompare(b.name,'pt-BR')),observedMonths=[...new Set(rows.map(row=>Number(row.month)))],lastMonth=Math.max(...observedMonths),batch=db.prepare(`SELECT group_concat(batch_id) ids FROM active_expense_publications WHERE year=?${query.source?' AND source=?':''}`).get(year,...(query.source?[query.source]:[]));
  const coverage:DataCoverage={availability:'available',source:query.source??'multiple',period:{from:`${year}-01-01`,to:`${year}-${String(lastMonth).padStart(2,'0')}-28`,grain:'month'},batchId:batch?.ids?String(batch.ids):null,note:'Pagamentos líquidos identificados pelo mesmo CNPJ válido nos lotes ativos. Nome e categorias vêm dos lançamentos parlamentares, não de cadastro da Receita Federal.',sampleSize:rows.length},start=(page-1)*pageSize;
  return{document,name:aliases[0]?.name??'Fornecedor sem nome',aliases:aliases.map(item=>item.name),year,years,totalCents,records:rows.length,ticketAverageCents:rows.length?totalCents/rows.length:null,parliamentarians:people.length,ufs:states.size,parties:parties.size,top1Share:people[0]?.share??null,top5Share:totalCents?people.slice(0,5).reduce((sum,item)=>sum+item.valueCents,0)/totalCents:null,people:people.slice(start,start+pageSize),peopleTotal:people.length,page,pageSize,states:grouped(states),partyGroups:grouped(parties),categories:grouped(categories),houses:grouped(houses),months:Array.from({length:12},(_,index)=>({month:index+1,valueCents:observedMonths.includes(index+1)?months.get(index+1)??0:null})),coverage};
}

/** Fator de correção monetária entre os dois pleitos, quando o índice de preços está publicado. */
export interface PatrimonyDeflator{indexCode:string;fromMonth:string;toMonth:string;factor:number}

export function publishedPatrimonyRanking(db:DatabaseSync,fromYear=2018,toYear=2022,deflator?:PatrimonyDeflator|null){
  const profiles=new Map<string,{source:Source;externalId:string;profile:Profile}>();
  for(const row of db.prepare(`SELECT a.source,p.person_id,p.external_id,p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id`).all())profiles.set(String(row.person_id),{source:String(row.source) as Source,externalId:String(row.external_id),profile:JSON.parse(String(row.payload)) as Profile});
  const totals=new Map<string,Map<number,number>>();let conflicts=0;
  // Bem com mais de uma versão no lote é descartado, e agora contado: silenciar a exclusão fazia o total
  // parecer completo. Mesmo tratamento que `publishedPersonElectoralProfile` já dá.
  for(const row of db.prepare(`SELECT c.person_id,c.year,a.asset_id,count(*) versions,sum(a.value_cents) value FROM candidacies c JOIN active_electoral_publications x ON x.batch_id=c.batch_id JOIN electoral_assets a ON a.batch_id=c.batch_id AND a.sequence_id=c.sequence_id WHERE c.match_status='confirmed' AND c.person_id IS NOT NULL AND c.year IN (?,?) GROUP BY c.person_id,c.year,a.asset_id`).all(fromYear,toYear)){
    if(Number(row.versions)!==1){conflicts++;continue}
    const byYear=totals.get(String(row.person_id))??new Map<number,number>();byYear.set(Number(row.year),(byYear.get(Number(row.year))??0)+Number(row.value));totals.set(String(row.person_id),byYear);
  }
  const declared=new Set<string>();for(const [personId,byYear] of totals)if(byYear.size)declared.add(personId);
  const items=[...totals].flatMap(([personId,byYear])=>{
    const profile=profiles.get(personId),from=byYear.get(fromYear),to=byYear.get(toYear);
    if(!profile||from===undefined||to===undefined)return[];
    // Corrigir o valor antigo por um fator constante não reordena o ranking — `(1+r)/k-1` é monótono em
    // `r`. O que muda é o sinal: quem cresceu menos que o índice passa a mostrar perda real.
    const fromCorrectedCents=deflator?Math.round(from*deflator.factor):null;
    return[{...profile,fromCents:from,toCents:to,changeCents:to-from,changeRate:from?to/from-1:null,
      fromCorrectedCents,changeRealCents:fromCorrectedCents===null?null:to-fromCorrectedCents,
      changeRealRate:fromCorrectedCents?to/fromCorrectedCents-1:null}];
  }).sort((a,b)=>(b.changeRate??-Infinity)-(a.changeRate??-Infinity)||b.changeCents-a.changeCents);
  const batches=db.prepare('SELECT group_concat(batch_id) ids FROM active_electoral_publications').get();
  const partialBatch=db.prepare("SELECT 1 FROM active_electoral_publications a JOIN electoral_batches b ON b.id=a.batch_id WHERE b.availability<>'available' LIMIT 1").get()!==undefined;
  const note=[`Compara valores declarados em eleições distintas e apenas vínculos confirmados. Não mede enriquecimento, valorização, renda ou patrimônio atual.`,
    `${items.length} de ${declared.size} pessoas com declaração vinculada têm os dois pleitos.`,
    conflicts?`${conflicts} bens com versões conflitantes ficaram fora dos totais.`:'',
    deflator?`Valores de ${fromYear} corrigidos pelo ${deflator.indexCode.toLocaleUpperCase('pt-BR')} de ${deflator.fromMonth} para ${deflator.toMonth}.`:'Os valores não são corrigidos pela inflação.'].filter(Boolean).join(' ');
  const coverage:DataCoverage={availability:!items.length?'unavailable':partialBatch||conflicts||items.length<declared.size?'partial':'available',source:'tse',period:{from:String(fromYear),to:String(toYear),grain:'year'},batchId:batches?.ids?String(batches.ids):null,note,sampleSize:items.length};
  return{fromYear,toYear,deflator:deflator??null,conflicts,declared:declared.size,items:items.map((item,index)=>({...item,rank:index+1})),coverage};
}

/** Mês de referência de cada pleito, do próprio dado: a data da eleição mais frequente no ano. */
export function publishedElectionMonths(db:DatabaseSync,years:number[]):Record<number,string|null>{
  const result:Record<number,string|null>={};
  for(const year of years){
    const row=db.prepare(`SELECT substr(json_extract(c.payload,'$.electionDate'),1,7) month,count(*) n FROM candidacies c JOIN active_electoral_publications x ON x.batch_id=c.batch_id WHERE c.year=? AND json_extract(c.payload,'$.electionDate') IS NOT NULL GROUP BY month ORDER BY n DESC LIMIT 1`).get(year);
    result[year]=row?.month?String(row.month):null;
  }
  return result;
}
