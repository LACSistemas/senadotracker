import { groupDistribution, houseMetrics, type GroupMetrics, type HouseMetricKey, type HouseMetricSummary } from '@senadotracker/db';
import type { DataCoverage, Distribution, Source } from '@senadotracker/domain';
import { houseMetricSummary, type DataResult } from '@/lib/data';

/** Ranking de bancada e de unidade federativa a partir do MESMO resumo de Casa que já alimenta régua,
    coroplético e home — nenhuma consulta nova, nem uma por grupo. Serve a página e o CSV, para os dois
    nunca divergirem em piso de amostra, ordenação ou arredondamento. */
export type GroupMode='partidos'|'estados';
export const groupMetricKeys=['proposals','monthlyCostCents','staff','presence'] as const satisfies readonly HouseMetricKey[];
export type GroupMetricKey=typeof groupMetricKeys[number];
/** Colunas da tabela; `presence` fica fora porque alimenta um destaque, não uma coluna. */
export const groupColumnKeys=['proposals','monthlyCostCents','staff'] as const satisfies readonly GroupMetricKey[];

export interface GroupRow{key:string;label:string;
  /** Cadeiras somam as duas Casas — contagem é comparável entre elas; mediana de dinheiro não é. */
  senators:number;deputies:number;seats:number;
  /** Parlamentares do grupo na Casa selecionada, o universo de todas as medianas da linha. */
  observed:number;
  /** Composição partidária da bancada local, só no modo Estados. */
  parties:number|null;concentration:number|null;
  values:Record<GroupMetricKey,number|null>;samples:Record<GroupMetricKey,number>}
export interface GroupRankings{mode:GroupMode;house:Source;year:number;updatedAt:string|null;roster:number;coverage:DataCoverage;
  /** Distribuição ENTRE grupos, a régua certa para colorir uma linha-bancada. */
  scale:Record<GroupMetricKey,Distribution>;
  rows:GroupRow[];houses:Partial<Record<Source,number>>}

const floorFor=(mode:GroupMode,key:GroupMetricKey)=>mode==='partidos'?houseMetrics[key].partyMinSample:houseMetrics[key].stateMinSample;
/** Abaixo do piso a mediana existe mas não sustenta comparação: vira ausência, não número. */
const eligible=(group:GroupMetrics|undefined,key:GroupMetricKey,floor:number)=>{
  const observed=group?.metrics[key];if(!observed)return{value:null,sample:0};
  const {count,median}=observed.distribution;
  return{value:count>=floor&&median!==null?median:null,sample:count};
};
const groupsOf=(mode:GroupMode,summary:HouseMetricSummary|undefined):Record<string,GroupMetrics>|undefined=>mode==='partidos'?summary?.parties:summary?.states;

export function groupRankings(mode:GroupMode,house:Source,year?:number):DataResult<GroupRankings>{
  const sources:Source[]=['senado','camara'],results=sources.map(source=>[source,houseMetricSummary(source,year)] as const);
  const selected=results.find(([source])=>source===house)![1];
  if(selected.status==='unavailable')return selected;
  const summaries=Object.fromEntries(results.flatMap(([source,result])=>result.status==='available'?[[source,result.data] as const]:[])) as Partial<Record<Source,HouseMetricSummary>>;
  const current=selected.data,here:Record<string,GroupMetrics>=mode==='partidos'?current.parties:current.states;
  // Estados sempre traz as 27 unidades federativas; bancada só existe onde há cadeira, e a união das duas
  // Casas é o que faz o pódio de maior bancada do Congresso ser do Congresso.
  const keys=mode==='estados'?Object.keys(current.states)
    :[...new Set(sources.flatMap(source=>Object.keys(groupsOf(mode,summaries[source])??{})))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const rows:GroupRow[]=keys.map(key=>{
    const group=here[key],senators=groupsOf(mode,summaries.senado)?.[key]?.representatives??0,deputies=groupsOf(mode,summaries.camara)?.[key]?.representatives??0;
    const state=mode==='estados'?current.states[key]:undefined;
    const observed=groupMetricKeys.map(metric=>[metric,eligible(group,metric,floorFor(mode,metric))] as const);
    return{key,label:key,senators,deputies,seats:senators+deputies,observed:group?.representatives??0,
      parties:state?.parties??null,concentration:state?.concentration??null,
      values:Object.fromEntries(observed.map(([metric,{value}])=>[metric,value])) as Record<GroupMetricKey,number|null>,
      samples:Object.fromEntries(observed.map(([metric,{sample}])=>[metric,sample])) as Record<GroupMetricKey,number>};
  });
  // Uma ordenação só, do pódio à tabela ao CSV: bancada ordena por cadeiras (contagem, sem empate no topo);
  // UF ordena pela métrica do pódio. Sem mediana elegível a linha vai para o fim, nunca para o meio.
  const primary=(row:GroupRow)=>mode==='partidos'?row.seats:row.values.proposals;
  rows.sort((a,b)=>{const left=primary(a),right=primary(b);
    if(left===right)return a.label.localeCompare(b.label,'pt-BR');
    if(left===null)return 1;if(right===null)return -1;
    return right-left||a.label.localeCompare(b.label,'pt-BR')});
  const groups=keys.flatMap(key=>{const group=here[key];return group?[group]:[]});
  return{status:'available',data:{mode,house:current.source,year:current.year,updatedAt:current.updatedAt,roster:current.roster,
    coverage:current.metrics.proposals.coverage,
    scale:Object.fromEntries(groupMetricKeys.map(metric=>[metric,groupDistribution(groups,metric,floorFor(mode,metric)).distribution])) as Record<GroupMetricKey,Distribution>,
    rows,houses:Object.fromEntries(sources.flatMap(source=>{const summary=summaries[source];return summary?[[source,summary.roster] as const]:[]}))}};
}
