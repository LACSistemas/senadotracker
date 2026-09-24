import type { Availability, MetricDirection } from '@senadotracker/domain';
/** Tom de avaliação: relação do valor com o referencial, nunca identidade da série.
    `unknown` é o estado honesto — cobertura insuficiente jamais recebe verde nem vermelho. */
export type EvalTone='good'|'typical'|'watch'|'alert'|'unknown';
export interface EvalScale{median:number|null;p10:number|null;p90:number|null;direction:MetricDirection;availability:Availability;sampleSize:number|null;minSample?:number}
export const defaultMinSample=10;
export function evalTone(value:number|null,scale:EvalScale):EvalTone{
  if(value===null||!Number.isFinite(value)||scale.median===null)return 'unknown';
  if(scale.availability!=='available'&&scale.availability!=='partial')return 'unknown';
  if((scale.sampleSize??0)<(scale.minSample??defaultMinSample))return 'unknown';
  const {p10,p90}=scale;
  if(scale.direction==='higher-is-worse'){if(p90===null)return value>scale.median?'watch':'typical';return value>=p90?'alert':value>scale.median?'watch':'good'}
  if(p10===null)return value<scale.median?'watch':'typical';
  return value<=p10?'alert':value<scale.median?'watch':'good';
}
const fills={good:'bg-eval-good',typical:'bg-eval-typical',watch:'bg-eval-watch',alert:'bg-eval-alert',unknown:'bg-eval-unknown'} as const;
const texts={good:'text-eval-good',typical:'text-eval-typical',watch:'text-eval-watch',alert:'text-eval-alert',unknown:'text-muted-foreground'} as const;
const vars={good:'var(--eval-good)',typical:'var(--eval-typical)',watch:'var(--eval-watch)',alert:'var(--eval-alert)',unknown:'var(--eval-unknown)'} as const;
export const evalFillClass=(tone:EvalTone)=>fills[tone];
export const evalTextClass=(tone:EvalTone)=>texts[tone];
export const evalVar=(tone:EvalTone)=>vars[tone];
/** A cor nunca viaja sozinha: todo call site acompanha rótulo e seta, para leitura sem percepção de cor. */
export const evalLabel=(tone:EvalTone,direction:MetricDirection)=>{
  if(tone==='unknown')return 'sem referencial compatível';
  if(tone==='typical')return 'universo pequeno demais para faixas';
  if(direction==='higher-is-worse')return tone==='alert'?'entre os 10% mais altos':tone==='watch'?'acima da mediana':'até a mediana';
  return tone==='alert'?'entre os 10% mais baixos':tone==='watch'?'abaixo da mediana':'na mediana ou acima';
};
export const evalArrow=(tone:EvalTone,direction:MetricDirection)=>{
  if(tone==='unknown'||tone==='typical')return '';
  if(direction==='higher-is-worse')return tone==='good'?'↓':'↑';
  return tone==='good'?'↑':'↓';
};
/** Legenda obrigatória quando a cor codifica avaliação — sem ela a cor vira ruído. */
export const toneLegend=(direction:MetricDirection):{label:string;color:string}[]=>(['good','watch','alert','unknown'] as const).map(tone=>({label:evalLabel(tone,direction),color:evalVar(tone)}));
