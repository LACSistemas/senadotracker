import type { DatabaseSync } from 'node:sqlite';
import type { DataCoverage, Source } from '@senadotracker/domain';
import { reportingCutoff } from './reporting-period.ts';

export interface AxisPoint{externalId:string;name:string;party:string;uf:string;position:number;votes:number}
export interface VoteAxis{
  source:Source; years:number[]; legislature:number|null; deliberations:number;
  /** Fração da variância das votações no primeiro eixo. Baixa significa que a Casa não se reduz a uma reta. */
  explained:number|null;
  points:AxisPoint[]; omitted:number;
  /** Partidos que ocupam cada extremo, derivados do dado. O eixo NÃO é rotulado esquerda/direita. */
  poles:{negative:string[];positive:string[]};
  coverage:DataCoverage;
}

// Pisos: abaixo deles a reta é ruído. O universo precisa de deliberações e a pessoa precisa de votos.
const minDeliberations=30,minVotesPerPerson=10,poleSize=3,iterations=80;
const directionalLiterals=(source:Source)=>source==='camara'?['sim','nao','abstencao','obstrucao']:['sim','nao','abstencao'];
const scoreOf=(vote:string)=>vote==='sim'?1:vote==='nao'?-1:0;

/** Anos publicados da legislatura corrente. A legislatura é a unidade do eixo: misturar legislaturas
    juntaria pessoas que nunca votaram nas mesmas matérias. O mandato do Senado dura duas legislaturas,
    então o fim vem do número da legislatura (4 anos), não da data final do mandato. */
export function legislatureYears(db:DatabaseSync,source:Source):{legislature:number|null;years:number[]}{
  const published=db.prepare('SELECT year FROM active_legislative_publications WHERE source=? ORDER BY year').all(source).map(row=>Number(row.year));
  const current=db.prepare(`SELECT max(CAST(json_extract(m.value,'$.legislature') AS INTEGER)) legislature FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id, json_each(p.payload,'$.mandates') m WHERE a.source=?`).get(source);
  const legislature=current?.legislature===null||current?.legislature===undefined?null:Number(current.legislature);
  if(legislature===null)return{legislature:null,years:published};
  const start=db.prepare(`SELECT min(json_extract(m.value,'$.start')) start FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id, json_each(p.payload,'$.mandates') m WHERE a.source=? AND CAST(json_extract(m.value,'$.legislature') AS INTEGER)=?`).get(source,legislature);
  if(!start?.start)return{legislature,years:published};
  const first=Number(String(start.start).slice(0,4));
  return{legislature,years:published.filter(year=>year>=first&&year<=first+3)};
}

/** Primeiro eixo das votações nominais de plenário, por iteração de potência sobre a matriz centrada.
    Custa 2 consultas por ano e nenhum JSON.parse: a varredura de votos usa o índice de cobertura
    `legislative_votes_choice`, e nome/partido vêm das colunas do cadastro. */
export function publishedVoteAxis(db:DatabaseSync,source:Source,years:number[],legislature:number|null=null):VoteAxis{
  const roster=db.prepare(`SELECT p.external_id,p.name,p.party,p.uf FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=?`).all(source)
    .map(row=>({externalId:String(row.external_id),name:String(row.name),party:String(row.party),uf:String(row.uf)}));
  const index=new Map(roster.map((person,position)=>[person.externalId,position]));
  const literals=directionalLiterals(source),marks=literals.map(()=>'?').join(',');
  // columns[col] = votos daquela deliberação; rows esparsas por pessoa.
  const columns:Array<Map<number,number>>=[];
  for(const year of years){
    const batch=db.prepare('SELECT batch_id FROM active_legislative_publications WHERE source=? AND year=?').get(source,year);
    if(!batch)continue;
    const batchId=String(batch.batch_id),cutoff=reportingCutoff(year);
    const plenary=new Set(db.prepare(`SELECT n.deliberation_id FROM nominal_deliberations n JOIN deliberations d ON d.batch_id=n.batch_id AND d.external_id=n.deliberation_id WHERE n.batch_id=? AND json_extract(d.payload,'$.chamberBody')='PLEN' AND substr(d.date,1,10)<=?`).all(batchId,cutoff).map(row=>String(row.deliberation_id)));
    if(!plenary.size)continue;
    const byDeliberation=new Map<string,Map<number,number>>();
    for(const row of db.prepare(`SELECT deliberation_id,external_id,search_text(json_extract(payload,'$.vote')) vote FROM legislative_votes WHERE batch_id=? AND search_text(json_extract(payload,'$.vote')) IN (${marks})`).all(batchId,...literals)){
      const deliberationId=String(row.deliberation_id);if(!plenary.has(deliberationId))continue;
      const position=index.get(String(row.external_id));if(position===undefined)continue;
      const column=byDeliberation.get(deliberationId)??new Map<number,number>();column.set(position,scoreOf(String(row.vote)));byDeliberation.set(deliberationId,column);
    }
    // Uma deliberação unânime não separa ninguém: sem variância, não entra na matriz.
    for(const column of byDeliberation.values())if(column.size>1&&new Set(column.values()).size>1)columns.push(column);
  }
  const votesPerPerson=new Array<number>(roster.length).fill(0);
  for(const column of columns)for(const position of column.keys())votesPerPerson[position]!++;
  const eligible=roster.map((_,position)=>position).filter(position=>votesPerPerson[position]!>=minVotesPerPerson);
  const period={from:years.length?`${years[0]}-01-01`:null,to:years.length?`${years.at(-1)}-12-31`:null,grain:'year' as const};
  const unavailable=(text:string):VoteAxis=>({source,years,legislature,deliberations:columns.length,explained:null,points:[],omitted:roster.length,poles:{negative:[],positive:[]},coverage:{availability:'unavailable',source,period,batchId:null,note:text,sampleSize:0}});
  if(columns.length<minDeliberations)return unavailable(`São necessárias ao menos ${minDeliberations} votações nominais de plenário com divergência para posicionar a Casa; o recorte tem ${columns.length}.`);
  if(eligible.length<2)return unavailable(`Nenhum conjunto de parlamentares reúne ${minVotesPerPerson} votos direcionais no recorte.`);

  // Centragem por coluna sobre quem votou; ausência vira zero DEPOIS de centrar (imputação pela média).
  const centered=columns.map(column=>{let sum=0;for(const value of column.values())sum+=value;const mean=sum/column.size;
    const deviations=new Map<number,number>();for(const [position,value] of column)deviations.set(position,value-mean);return deviations});
  let frobenius=0;for(const column of centered)for(const value of column.values())frobenius+=value*value;
  if(!frobenius)return unavailable('As votações do recorte não apresentam divergência mensurável.');

  // Iteração de potência sobre X·Xᵀ, com semente determinística: o eixo não pode mudar entre execuções.
  let vector=new Float64Array(roster.length);let seed=2463534242;
  for(const position of eligible){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;vector[position]=(seed>>>0)/4294967296-.5}
  const projection=new Float64Array(centered.length);
  for(let step=0;step<iterations;step++){
    projection.fill(0);
    for(let column=0;column<centered.length;column++){let sum=0;for(const [position,value] of centered[column]!)sum+=value*vector[position]!;projection[column]=sum}
    const next=new Float64Array(roster.length);
    for(let column=0;column<centered.length;column++){const weight=projection[column]!;if(!weight)continue;for(const [position,value] of centered[column]!)next[position]!+=value*weight}
    let norm=0;for(const position of eligible)norm+=next[position]!*next[position]!;
    norm=Math.sqrt(norm);if(!norm)break;
    for(let position=0;position<next.length;position++)next[position]=next[position]!/norm;
    vector=next;
  }
  // A variância no eixo é ||Xᵀv||², recalculada sobre o vetor já convergido.
  projection.fill(0);
  for(let column=0;column<centered.length;column++){let sum=0;for(const [position,value] of centered[column]!)sum+=value*vector[position]!;projection[column]=sum}
  let axisVariance=0;for(const value of projection)axisVariance+=value*value;
  const explained=frobenius?Math.min(1,axisVariance/frobenius):null;

  // Orientação determinística e declaradamente arbitrária: o partido alfabeticamente primeiro entre os
  // posicionados fica no lado negativo. Só as distâncias relativas significam algo.
  const parties=[...new Set(eligible.map(position=>roster[position]!.party))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const anchor=parties[0]!,anchored=eligible.filter(position=>roster[position]!.party===anchor);
  const anchorMean=anchored.reduce((sum,position)=>sum+vector[position]!,0)/anchored.length;
  const sign=anchorMean>0?-1:1;
  const scale=Math.max(...eligible.map(position=>Math.abs(vector[position]!)),Number.EPSILON);
  const points=eligible.map(position=>({...roster[position]!,position:sign*vector[position]!/scale,votes:votesPerPerson[position]!}))
    .sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name,'pt-BR'));
  // O polo é o decil extremo, nunca uma contagem fixa: com poucas pessoas uma janela fixa cobriria a
  // Casa inteira e os dois polos sairiam com os mesmos partidos.
  const window=Math.max(1,Math.round(points.length*.1));
  const pole=(items:AxisPoint[])=>[...new Set(items.slice(0,window).map(item=>item.party))].slice(0,poleSize);
  const omitted=roster.length-points.length;
  const weak=explained!==null&&explained<.4;
  return{source,years,legislature,deliberations:columns.length,explained,points,omitted,
    poles:{negative:pole(points),positive:pole([...points].reverse())},
    coverage:{availability:weak||omitted?'partial':'available',source,period,batchId:null,
      note:(`Primeiro eixo de ${columns.length} votações nominais de plenário com divergência, entre ${points.length} parlamentares com ao menos ${minVotesPerPerson} votos direcionais.${omitted?` ${omitted} ficaram fora por falta de votos no recorte.`:''}${weak?' O eixo explica menos de 40% da variância: a Casa não se reduz bem a uma dimensão.':''}`),
      sampleSize:points.length}};
}

/** Entrada única para o frontend: resolve a legislatura corrente e devolve o eixo dela. */
export function publishedCurrentVoteAxis(db:DatabaseSync,source:Source):VoteAxis{
  const {legislature,years}=legislatureYears(db,source);
  return publishedVoteAxis(db,source,years,legislature);
}
