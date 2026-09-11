import type { DatabaseSync } from 'node:sqlite';
import { annualReportingPeriod } from './reporting-period.ts';
import { distribution, type DataCoverage, type Profile, type Source } from '@senadotracker/domain';
import { publishedExpenseYears, publishedParticipationRows } from './panorama.ts';
import { publishedCabinetPanorama, publishedCabinetProfile } from './frontend-data.ts';

export const comparisonDimensions = ['expenses','presence','votes','production','cabinet'] as const;
export type ComparisonDimension = typeof comparisonDimensions[number];
export interface PersonComparison { profile: Profile; value: number | null; cabinet?: { staff: number | null; financialCents: number | null } }

const metadata:Record<ComparisonDimension,{label:string;unit:'cents'|'ratio'|'count';note:string}>={
  expenses:{label:'Cota parlamentar líquida identificada',unit:'cents',note:'Soma anual da cota líquida identificada; não representa o custo integral do mandato.'},
  presence:{label:'Presença em sessões elegíveis',unit:'ratio',note:'Presenças registradas sobre sessões elegíveis durante o exercício.'},
  votes:{label:'Participação em votações nominais',unit:'ratio',note:'Votos registrados sobre deliberações plenárias elegíveis; não mede presença.'},
  production:{label:'Propostas apresentadas',unit:'count',note:'Propostas com autoria oficial no ano; relatorias e leis não são somadas a esta métrica.'},
  cabinet:{label:'Folha bruta de gabinete identificada',unit:'cents',note:'Rubrica administrativa publicada no ano; cobertura pode ser parcial e não equivale ao custo total.'},
};
const annualPeriod=annualReportingPeriod;

function profiles(db:DatabaseSync,source:Source){return db.prepare(`SELECT p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=? ORDER BY p.search_name,p.external_id`).all(source).map(row=>JSON.parse(String(row.payload)) as Profile)}

function valuesFor(db:DatabaseSync,source:Source,year:number,dimension:ComparisonDimension,people:Profile[]){
  const values=new Map<string,number>();
  if(dimension==='expenses')for(const row of db.prepare(`SELECT e.external_id,sum(e.net_cents-e.refund_cents) value FROM expenses e JOIN active_expense_publications a ON a.batch_id=e.batch_id WHERE e.source=? AND e.year=? GROUP BY e.external_id`).all(source,year))values.set(String(row.external_id),Number(row.value));
  if(dimension==='presence'||dimension==='votes'){
    const metrics=publishedParticipationRows(db,source,year,people.map(item=>item.externalId));
    for(const person of people){const metric=dimension==='presence'?metrics[person.externalId]?.presence:metrics[person.externalId]?.participation;if(metric?.numerator!==null&&metric?.denominator)values.set(person.externalId,metric.numerator/metric.denominator)}
  }
  if(dimension==='production')for(const row of db.prepare(`SELECT x.person_external_id external_id,count(DISTINCT x.proposal_id) value FROM proposal_authors x JOIN proposals p ON p.batch_id=x.batch_id AND p.external_id=x.proposal_id JOIN active_activity_publications a ON a.batch_id=x.batch_id WHERE a.source=? AND x.person_external_id IS NOT NULL AND COALESCE(json_extract(p.payload,'$.year'),CAST(substr(json_extract(p.payload,'$.presentedAt'),1,4) AS INTEGER))=? GROUP BY x.person_external_id`).all(source,year))values.set(String(row.external_id),Number(row.value));
  if(dimension==='cabinet')for(const row of db.prepare(`SELECT c.external_id,sum(c.value_cents) value FROM expanded_costs c JOIN active_expanded_cost_publications a ON a.batch_id=c.batch_id WHERE c.source=? AND a.year=? AND c.rubric='cabinet_payroll_gross' AND c.value_cents IS NOT NULL GROUP BY c.external_id`).all(source,year))values.set(String(row.external_id),Number(row.value));
  return values;
}

export function publishedPersonComparison(db:DatabaseSync,source:Source,year:number,externalIds:string[],dimension:ComparisonDimension){
  if(!comparisonDimensions.includes(dimension))throw new Error('Dimensão inválida');
  if(!Number.isInteger(year)||year<2008||year>2100)throw new Error('Ano inválido');
  if(externalIds.length<2||externalIds.length>4||new Set(externalIds).size!==externalIds.length)throw new Error('Selecione de duas a quatro pessoas diferentes');
  const population=profiles(db,source),byId=new Map(population.map(item=>[item.externalId,item]));
  const selected=externalIds.map(id=>byId.get(id));
  if(selected.some(item=>!item))throw new Error('Parlamentar incompatível com a Casa selecionada');
  if(dimension==='cabinet'){
    const panorama=publishedCabinetPanorama(db,source);
    const people=selected.map(profile=>{
      const cabinet=publishedCabinetProfile(db,source,profile!.externalId);
      const staff=cabinet.staff.items.length||cabinet.staff.coverage.availability!=='unavailable'?cabinet.staff.items.length:null;
      const financialCents=cabinet.financial.kind==='budget'?cabinet.financial.totalSpentCents:(cabinet.financial.coverage.availability==='unavailable'?null:cabinet.financial.totalCents);
      return{profile:profile!,value:financialCents,cabinet:{staff,financialCents}};
    });
    const coverage:DataCoverage={availability:panorama.financial.count?'available':'unavailable',source,period:{from:panorama.period,to:panorama.period,grain:source==='camara'?'year':'month'},batchId:null,note:source==='camara'?'Verba de gabinete utilizada no ano; remuneração individual e benefícios não são somados.':'Parcelas identificadas da folha na competência; não inclui encargos patronais nem custos externos.',sampleSize:panorama.financial.count};
    return{source,year,dimension,label:source==='camara'?'Equipe e verba de gabinete utilizada':'Equipe e folha identificada do gabinete',unit:'cents' as const,people,benchmark:{mean:panorama.financialMean,distribution:panorama.financial,staffDistribution:panorama.staff,coverage,population:`Parlamentares ${source==='senado'?'do Senado Federal':'da Câmara dos Deputados'} observados no mesmo ${source==='senado'?'snapshot e competência':'snapshot e ano'}.`},cabinet:{kind:panorama.kind,period:panorama.period}};
  }
  const values=valuesFor(db,source,year,dimension,population),stats=distribution([...values.values()]),meta=metadata[dimension];
  const batch=dimension==='expenses'?db.prepare('SELECT batch_id FROM active_expense_publications WHERE source=? AND year=?').get(source,year):dimension==='presence'?db.prepare('SELECT batch_id FROM active_presence_publications WHERE source=? AND year=?').get(source,year):dimension==='votes'?db.prepare('SELECT batch_id FROM active_legislative_publications WHERE source=? AND year=?').get(source,year):db.prepare('SELECT group_concat(batch_id) batch_id FROM active_activity_publications WHERE source=?').get(source);
  const coverage:DataCoverage={availability:stats.count?'available':'unavailable',source,period:annualPeriod(year),batchId:batch?.batch_id?String(batch.batch_id):null,note:meta.note,sampleSize:stats.count};
  const observed=[...values.values()];
  return{source,year,dimension,label:meta.label,unit:meta.unit,people:selected.map((profile,index)=>({profile:profile!,value:values.get(externalIds[index]!)??null})),benchmark:{mean:observed.length?observed.reduce((sum,value)=>sum+value,0)/observed.length:null,distribution:stats,coverage,population:`Parlamentares ${source==='senado'?'do Senado Federal':'da Câmara dos Deputados'} com observação compatível em ${year}.`}};
}

export function publishedComparisonOptions(db:DatabaseSync,source:Source){return profiles(db,source)}
export function publishedComparisonYears(db:DatabaseSync,source:Source){const years=new Set(publishedExpenseYears(db,source));for(const table of ['active_presence_publications','active_legislative_publications','active_expanded_cost_publications'])for(const row of db.prepare(`SELECT year FROM ${table} WHERE source=?`).all(source))years.add(Number(row.year));return[...years].sort((a,b)=>b-a)}

