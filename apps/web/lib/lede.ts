import { houseMetricKeys, type HouseMetricKey, type HouseMetricSummary } from '@senadotracker/db';
import { percentileOf, type DataCoverage } from '@senadotracker/domain';
// Relativo e com extensão de propósito: o alias `@/` não resolve fora do bundler do Next, e este
// módulo é função pura testada direto por tsx, como `eval-color.ts`.
import { evalTone, type EvalTone } from './eval-color.ts';
import { count, metricValue, percent } from './format.ts';

export interface Lede{metric:HouseMetricKey;value:number;percentile:number|null;tone:EvalTone;text:string;href:string;coverage:DataCoverage;sampleSize:number}

// Cada métrica aponta para a seção que a originou. O link carrega sempre a ROTA da seção, nunca só o
// hash: o CSS de perfil esconde as seções fora da rota, então `#custos` sozinho não rolaria para nada.
const anchors:Record<HouseMetricKey,[section:string,hash:string]>={
  expenseCents:['gastos-equipe','custos'],totalCostCents:['gastos-equipe','custos'],monthlyCostCents:['gastos-equipe','custos'],
  cabinetCents:['gastos-equipe','gabinete'],staff:['gastos-equipe','gabinete'],
  presence:['atuacao-parlamentar','participacao'],participation:['atuacao-parlamentar','participacao'],
  proposals:['atuacao-parlamentar','producao'],rapporteurships:['atuacao-parlamentar','producao'],
};

/** Frações estritamente abaixo, estritamente acima e empatadas, numa passada. `below` é a mesma
    definição de `percentileOf` (o teste garante), e `above` evita a armadilha de tratar `1-percentil`
    como "abaixo de X%" — com empates isso seria falso. */
const spread=(values:number[],value:number)=>{
  let below=0,above=0;
  for(const item of values){if(item<value)below++;else if(item>value)above++}
  const total=values.length;
  return{below:below/total,above:above/total,tied:(total-below-above)/total};
};

/** A frase usa o enquadramento "maior que X%", que é exatamente o que a contagem mede. Nos extremos
    o percentual não diz nada ("maior que 0%" é tautologia), então o fato vira a ausência de quem
    supere — verdadeiro mesmo com empates. */
const phrase=(label:string,value:number,unit:Parameters<typeof metricValue>[1],year:number,at:ReturnType<typeof spread>,total:number,universeLabel:string)=>{
  const head=`${label} de ${metricValue(value,unit)} em ${year} —`;
  if(!at.above)return `${head} nenhum dos ${count(total)} ${universeLabel} registra mais.`;
  if(!at.below)return `${head} nenhum dos ${count(total)} ${universeLabel} registra menos.`;
  // Arredondar uma fração não nula para "0%" (ou para "100%") devolveria a mesma tautologia que os
  // extremos: a faixa é enunciada como limite, não como zero.
  if(at.below<.005)return `${head} maior que menos de 1% dos ${universeLabel}.`;
  if(at.below>.995)return `${head} maior que mais de 99% dos ${universeLabel}.`;
  return `${head} maior que ${at.below<.25?'apenas ':''}${percent(at.below,0)} dos ${universeLabel}.`;
};

/** Fato mais desviante da pessoa dentro da Casa, ou `null` quando nenhuma métrica tem referencial.
    Determinística: percorre `houseMetricKeys` em ordem fixa e o empate fica com a primeira. */
export function profileLede(summary:HouseMetricSummary,externalId:string,context:{root:string;universeLabel:string}):Lede|null{
  const row=summary.rows[externalId];
  if(!row)return null;
  let best:Lede|null=null,bestScore=-1;
  for(const key of houseMetricKeys){
    const value=row[key];
    if(typeof value!=='number'||!Number.isFinite(value))continue;
    const {meta,distribution,values,coverage}=summary.metrics[key];
    // O piso de cobertura já vive em `evalTone`: exige availability compatível E sampleSize >= minSample.
    // `typical` significa universo sem caudas — não sustenta uma manchete.
    const tone=evalTone(value,{median:distribution.median,p10:distribution.p10,p90:distribution.p90,direction:meta.direction,availability:coverage.availability,sampleSize:distribution.count,minSample:meta.houseMinSample});
    if(tone==='unknown'||tone==='typical')continue;
    const percentile=percentileOf(values,value);
    if(percentile===null)continue;
    const at=spread(values,value);
    // Desvio descontado pelo empate: um zero compartilhado por 200 deputados está no extremo, mas não
    // distingue ninguém. Sem o desconto, a métrica com mais empates venceria quase sempre a manchete.
    const score=Math.abs(percentile-.5)*(1-at.tied);
    if(score<=bestScore)continue;
    const [section,hash]=anchors[key];
    bestScore=score;
    best={metric:key,value,percentile,tone,coverage,sampleSize:distribution.count,
      href:`${context.root}/${section}#${hash}`,
      text:phrase(meta.label,value,meta.unit,summary.year,at,distribution.count,context.universeLabel)};
  }
  return best;
}

/** Fato da Casa: uma mediana não se compara consigo mesma, então não recebe tom — sai neutra. */
export function houseLede(summary:HouseMetricSummary,metric:HouseMetricKey,context:{href:string;universeLabel:string}):Lede|null{
  const {meta,distribution,coverage}=summary.metrics[metric];
  if(distribution.median===null||distribution.count<meta.houseMinSample)return null;
  if(coverage.availability!=='available'&&coverage.availability!=='partial')return null;
  return{metric,value:distribution.median,percentile:null,tone:'unknown',coverage,sampleSize:distribution.count,href:context.href,
    text:`${meta.label} mediano de ${metricValue(distribution.median,meta.unit)} entre ${count(distribution.count)} ${context.universeLabel} em ${summary.year}.`};
}

/** Traduz centavos em múltiplos de um valor normativo (salário mínimo), para o número ter escala humana.
    Sem o valor vigente publicado, devolve `null` — a âncora some em vez de ser estimada. */
export const humanAnchor=(cents:number|null,referenceCents:number|null|undefined,label:string)=>
  cents===null||!referenceCents?null:`${count(Math.round(cents/referenceCents))} ${label}`;
