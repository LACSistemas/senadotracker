import type { DatabaseSync } from 'node:sqlite';
import { distribution, quantile, ufs, type DataCoverage, type Distribution, type MetricDirection, type MetricUnit, type Source } from '@senadotracker/domain';
import { publishedParticipationRows } from './panorama.ts';
import { publishedRankingsDashboard, type DashboardRow, type HouseBatches } from './rankings-dashboard.ts';

export type HouseMetricKey='expenseCents'|'cabinetCents'|'totalCostCents'|'monthlyCostCents'|'presence'|'participation'|'proposals'|'rapporteurships'|'staff';
/** Metadados da métrica em um só lugar: nenhum call site declara direção, unidade ou piso de amostra. */
export interface MetricMeta{key:HouseMetricKey;label:string;unit:MetricUnit;direction:MetricDirection;houseMinSample:number;stateMinSample:number;partyMinSample:number;note:string}
// Piso da Casa em 10 (universo de 81 ou 513, nunca morde na prática); piso por UF em 3, igual ao único
// precedente do repositório, porque o Senado tem exatamente 3 cadeiras por unidade federativa; piso por
// bancada também em 3, mas por outro motivo: o Senado tem 12 partidos e só dois com dez ou mais cadeiras,
// então o piso da Casa apagaria quase todas as bancadas.
const houseFloor=10,stateFloor=3,partyFloor=3;
const meta=(key:HouseMetricKey,label:string,unit:MetricUnit,direction:MetricDirection,note:string):MetricMeta=>({key,label,unit,direction,houseMinSample:houseFloor,stateMinSample:stateFloor,partyMinSample:partyFloor,note});
export const houseMetrics:Readonly<Record<HouseMetricKey,MetricMeta>>={
  expenseCents:meta('expenseCents','Cota parlamentar','cents','higher-is-worse','Cota líquida anual identificada; estornos preservados e ausências não viram zero.'),
  cabinetCents:meta('cabinetCents','Gabinete','cents','higher-is-worse','Folha identificada no Senado e verba utilizada na Câmara; conceitos distintos entre Casas.'),
  totalCostCents:meta('totalCostCents','Custo total identificado','cents','higher-is-worse','Cota, gabinete e subsídio nos meses com as três parcelas observadas e mandato em exercício.'),
  monthlyCostCents:meta('monthlyCostCents','Custo mensal identificado','cents','higher-is-worse','Custo total dividido pelos meses comuns observados.'),
  presence:meta('presence','Presença','ratio','higher-is-better','Presença em sessões elegíveis do lote de assiduidade da Casa.'),
  participation:meta('participation','Participação em votações','ratio','higher-is-better','Votações nominais plenárias em períodos de exercício; não mede presença.'),
  proposals:meta('proposals','Proposições','count','higher-is-better','Autoria distinta nos escopos de atividade publicados.'),
  rapporteurships:meta('rapporteurships','Relatorias','count','higher-is-better','Designações de relatoria nos escopos de atividade publicados.'),
  staff:meta('staff','Vínculos de gabinete','count','higher-is-worse','Vínculos administrativos com pareamento seguro no snapshot ativo.'),
} as const;
export const houseMetricKeys=Object.keys(houseMetrics) as HouseMetricKey[];

export interface MetricBenchmark{meta:MetricMeta;distribution:Distribution;values:number[];coverage:DataCoverage}
export interface StateMetric{distribution:Distribution;coverage:DataCoverage}
export interface GroupMetrics{key:string;representatives:number;metrics:Record<HouseMetricKey,StateMetric>}
export interface StateMetrics extends GroupMetrics{uf:string;
  /** Partidos distintos na bancada da UF e a concentração dela. */
  parties:number;
  /** Índice de Herfindahl (0..1): soma dos quadrados das frações de cada partido. Contagem de partidos
      empata demais — 23 das 27 UFs têm 3 no Senado —, e não distingue 5+1+1+1 de 2+2+2+2. O HHI sim. */
  concentration:number|null;
}
export interface PartyMetrics extends GroupMetrics{party:string}
export interface HouseMetricSummary{source:Source;year:number;updatedAt:string|null;roster:number;metrics:Record<HouseMetricKey,MetricBenchmark>;states:Record<string,StateMetrics>;parties:Record<string,PartyMetrics>;
  /** Linha da própria pessoa, para a régua comparar o mesmo número que alimentou a distribuição. */
  rows:Record<string,DashboardRow>}

const annual=(year:number)=>({from:`${year}-01-01`,to:`${year}-12-31`,grain:'year' as const});
const batchFor=(key:HouseMetricKey,batches:HouseBatches|undefined)=>{
  if(!batches)return null;
  if(key==='expenseCents'||key==='totalCostCents'||key==='monthlyCostCents')return batches.expenses;
  if(key==='cabinetCents')return batches.cabinet;
  if(key==='staff')return batches.staff;
  if(key==='proposals'||key==='rapporteurships')return batches.activity.length?batches.activity.join(','):null;
  return batches.roster;
};
/** Cobertura por métrica: lote ausente ou sem observação é `unavailable`; universo incompleto (ou escopo
    de amostra) é `partial`. O piso de amostra não omite a distribuição — ele governa tom e lede na UI. */
function coverageFor(key:HouseMetricKey,source:Source,year:number,observed:number,roster:number,batches:HouseBatches|undefined,scope:string):DataCoverage{
  const batchId=batchFor(key,batches),sample=houseMetrics[key],partialScope=(key==='proposals'||key==='rapporteurships')&&Boolean(batches?.activityPartial);
  const availability=!observed?'unavailable' as const:partialScope||observed<roster?'partial' as const:'available' as const;
  const note=observed?`${sample.note} Mediana sobre ${observed} de ${roster} ${scope}.`:`${sample.note} Nenhuma observação compatível publicada.`;
  return {availability,source,period:annual(year),batchId:observed?batchId:null,note,sampleSize:observed};
}
const scopeLabel=(source:Source)=>source==='senado'?'senadores':'deputados';
const numbers=(rows:DashboardRow[],key:HouseMetricKey)=>rows.flatMap(row=>{const value=row[key];return typeof value==='number'&&Number.isFinite(value)?[value]:[]});

/** Uma computação da Casa serve régua e coroplético: as distribuições saem da mesma matriz
    pessoa×métrica que o painel de rankings já monta, sem uma consulta nova.
    Nunca aceita `uf`/`party`/`search`: estreitar o universo em silêncio faria o percentil mentir. */
export function publishedHouseMetricSummary(db:DatabaseSync,source:Source,year:number,participation?:ReturnType<typeof publishedParticipationRows>):HouseMetricSummary{
  const dashboard=publishedRankingsDashboard(db,{source,year,includeAssets:false});
  const batches=dashboard.batches[source],roster=batches?.rosterSize??dashboard.allItems.length,scope=scopeLabel(source);
  // O painel de rankings só observa presença da Câmara; a fonte canônica das duas Casas é a de participação.
  const metrics=participation??publishedParticipationRows(db,source,year,dashboard.allItems.map(row=>row.externalId));
  const ratio=(value:{numerator:number|null;denominator:number|null}|undefined)=>value&&value.numerator!==null&&value.denominator?value.numerator/value.denominator:null;
  const rows=dashboard.allItems.map(row=>{const observed=metrics[row.externalId];return {...row,presence:ratio(observed?.presence)}});
  const benchmark=(key:HouseMetricKey,subset:DashboardRow[]):MetricBenchmark=>{const values=numbers(subset,key);return {meta:houseMetrics[key],distribution:distribution(values),values,coverage:coverageFor(key,source,year,values.length,roster,batches,scope)}};
  // Um agrupamento serve UF e bancada: a diferença é só a chave. Tudo em memória sobre as linhas que já
  // estão carregadas — nenhuma consulta nova, nem por grupo.
  const groupMetrics=(key:string,subset:DashboardRow[]):GroupMetrics=>
    ({key,representatives:subset.length,metrics:Object.fromEntries(houseMetricKeys.map(metric=>{const values=numbers(subset,metric);return [metric,{distribution:distribution(values),coverage:coverageFor(metric,source,year,values.length,subset.length,batches,scope)}]})) as Record<HouseMetricKey,StateMetric>});
  const byUf=new Map<string,DashboardRow[]>(),byParty=new Map<string,DashboardRow[]>();
  for(const row of rows){
    byUf.set(row.uf,[...(byUf.get(row.uf)??[]),row]);
    byParty.set(row.party,[...(byParty.get(row.party)??[]),row]);
  }
  const stateMetrics=(uf:string):StateMetrics=>{
    const subset=byUf.get(uf)??[],seats=new Map<string,number>();
    for(const row of subset)seats.set(row.party,(seats.get(row.party)??0)+1);
    const concentration=subset.length?[...seats.values()].reduce((sum,count)=>sum+(count/subset.length)**2,0):null;
    return {...groupMetrics(uf,subset),uf,parties:seats.size,concentration};
  };
  return {
    source,year,updatedAt:dashboard.updatedAt??null,roster,
    metrics:Object.fromEntries(houseMetricKeys.map(key=>[key,benchmark(key,rows)])) as Record<HouseMetricKey,MetricBenchmark>,
    // Todas as 27 unidades federativas entram, mesmo sem observação: o mapa precisa pintá-las de cinza.
    states:Object.fromEntries([...ufs].sort().map(uf=>[uf,stateMetrics(uf)])),
    // Bancadas só existem onde há cadeira: ao contrário das UFs, não há conjunto canônico a preencher.
    parties:Object.fromEntries([...byParty.keys()].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(party=>[party,{...groupMetrics(party,byParty.get(party)!),party}])),
    rows:Object.fromEntries(rows.map(row=>[row.externalId,row])),
  };
}

/** Distribuição ENTRE grupos de uma métrica — a régua certa para colorir uma linha-UF ou linha-bancada.
    A distribuição da Casa é entre pessoas; comparar a mediana de um grupo contra ela mediria outra coisa. */
export function groupDistribution(groups:GroupMetrics[],metric:HouseMetricKey,floor:number){
  const values=groups.flatMap(group=>{const observed=group.metrics[metric];return observed.distribution.count>=floor&&observed.distribution.median!==null?[observed.distribution.median]:[]});
  return {distribution:distribution(values),values};
}

/** Distribuição da folha de gabinete numa competência específica. Existe porque o perfil publica um mês
    isolado, e compará-lo com a soma anual da Casa daria um percentil falso: a régua exige o mesmo recorte. */
export function publishedCabinetCompetenceBenchmark(db:DatabaseSync,source:Source,competence:string):MetricBenchmark|null{
  if(!/^\d{4}-\d{2}$/.test(competence))return null;
  const year=Number(competence.slice(0,4));
  const batch=db.prepare(`SELECT b.id,b.availability,b.note FROM expanded_cost_batches b JOIN active_expanded_cost_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(source,year);
  if(!batch)return null;
  const values=db.prepare(`SELECT sum(c.value_cents) value FROM expanded_costs c
    JOIN active_expanded_cost_publications a ON a.batch_id=c.batch_id
    JOIN active_publications ap ON ap.source=c.source JOIN profiles p ON p.batch_id=ap.batch_id AND p.external_id=c.external_id
    WHERE c.source=? AND a.year=? AND c.rubric='cabinet_payroll_gross' AND c.competence=? AND c.value_cents IS NOT NULL GROUP BY p.person_id`).all(source,year,competence).map(row=>Number(row.value));
  const metricMeta:MetricMeta={...houseMetrics.cabinetCents,label:'Folha bruta do gabinete',note:`Folha bruta identificada na competência ${competence}, sem encargos patronais.`};
  return {meta:metricMeta,distribution:distribution(values),values,coverage:{availability:values.length?String(batch.availability) as DataCoverage['availability']:'unavailable',source,period:{from:competence,to:competence,grain:'month'},batchId:values.length?String(batch.id):null,note:values.length?`${metricMeta.note} Mediana sobre ${values.length} gabinetes na mesma competência.`:'Nenhum gabinete publicado nesta competência.',sampleSize:values.length}};
}

export interface ChoroplethBucket{index:number;from:number;to:number;count:number}
export interface ChoroplethItem{uf:string;value:number|null;sampleSize:number;bucket:number|null;coverage:DataCoverage}
/** Derivação pura sobre o resumo já calculado: trocar métrica no seletor não custa consulta alguma.
    Escala por quantis, não linear no máximo — um único outlier não achata os demais tons. */
export function stateChoropleth(summary:HouseMetricSummary,metric:HouseMetricKey):{meta:MetricMeta;buckets:ChoroplethBucket[];items:ChoroplethItem[];coverage:DataCoverage}{
  const meta=houseMetrics[metric];
  const entries=Object.values(summary.states).map(state=>{const observed=state.metrics[metric];
    // Mediana de UF só conta como observação quando o universo local atinge o piso da métrica.
    const eligible=observed.distribution.count>=meta.stateMinSample&&observed.distribution.median!==null;
    return {uf:state.uf,value:eligible?observed.distribution.median:null,sampleSize:observed.distribution.count,coverage:observed.coverage}});
  const values=entries.flatMap(item=>item.value===null?[]:[item.value]);
  // Cortes repetidos não viram tons distintos: com poucos valores distintos a escala encurta sozinha.
  const bounds=values.length?[...new Set([Math.min(...values),...[.2,.4,.6,.8].map(probability=>quantile(values,probability)!),Math.max(...values)])].sort((a,b)=>a-b):[];
  const buckets:ChoroplethBucket[]=bounds.length>1?bounds.slice(0,-1).map((from,index)=>({index,from,to:bounds[index+1]!,count:0})):bounds.length?[{index:0,from:bounds[0]!,to:bounds[0]!,count:0}]:[];
  const bucketOf=(value:number)=>{for(let index=buckets.length-1;index>0;index--)if(value>=buckets[index]!.from)return index;return 0};
  const items=entries.map(item=>{if(item.value===null||!buckets.length)return {...item,bucket:null};const index=bucketOf(item.value);buckets[index]!.count++;return {...item,bucket:index}});
  const observed=items.filter(item=>item.bucket!==null).length;
  return {meta,buckets,items,coverage:{availability:!observed?'unavailable':observed<items.length?'partial':'available',source:summary.source,period:annual(summary.year),batchId:summary.metrics[metric].coverage.batchId,note:observed?`Mediana por unidade federativa entre ${scopeLabel(summary.source)}, com ao menos ${meta.stateMinSample} observações compatíveis. ${items.length-observed} UFs sem universo suficiente.`:`Nenhuma unidade federativa reúne ${meta.stateMinSample} observações compatíveis desta métrica.`,sampleSize:observed}};
}
