import type { Availability,MetricDirection,MetricUnit } from '@senadotracker/domain';
import { evalArrow,evalFillClass,evalLabel,evalTextClass,evalTone,type EvalScale } from '@/lib/eval-color';
import { metricValue,multiple,percent } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Régua de um número contra o universo que o produziu. Substitui o "comparação" em texto livre,
    que não carregava direção e por isso não podia carregar cor. */
export interface KpiBenchmark {
  value:number|null; unit:MetricUnit; direction:MetricDirection;
  median:number|null; p10:number|null; p90:number|null;
  percentile:number|null; sampleSize:number|null; minSample?:number; availability:Availability;
  universeLabel:string; note?:string;
}

const scaleOf=(benchmark:KpiBenchmark):EvalScale=>({median:benchmark.median,p10:benchmark.p10,p90:benchmark.p90,direction:benchmark.direction,availability:benchmark.availability,sampleSize:benchmark.sampleSize,...(benchmark.minSample===undefined?{}:{minSample:benchmark.minSample})});
// Escala em percentil: monótona e imune a outlier. Sem percentil, cai no espaço de valor com teto no p90.
const position=(benchmark:KpiBenchmark)=>{
  if(benchmark.percentile!==null)return benchmark.percentile*100;
  if(benchmark.value===null)return 0;
  const ceiling=benchmark.p90??benchmark.median;
  return ceiling?Math.min(100,100*benchmark.value/ceiling):0;
};
const marker=(benchmark:KpiBenchmark)=>{
  if(benchmark.percentile!==null)return 50;
  const ceiling=benchmark.p90??benchmark.median;
  return ceiling&&benchmark.median!==null?Math.min(100,100*benchmark.median/ceiling):null;
};
// Contagens pequenas leem melhor como múltiplo da mediana; dinheiro e razões leem melhor como percentil.
const phrase=(benchmark:KpiBenchmark)=>{
  const preferMultiple=benchmark.unit==='count'&&benchmark.median!==null&&benchmark.median<=5;
  if(!preferMultiple&&benchmark.percentile!==null)return `maior que ${percent(benchmark.percentile,0)} dos ${benchmark.universeLabel}`;
  if(benchmark.median)return `${multiple(benchmark.value===null?null:benchmark.value/benchmark.median)} a mediana dos ${benchmark.universeLabel}`;
  if(benchmark.percentile!==null)return `maior que ${percent(benchmark.percentile,0)} dos ${benchmark.universeLabel}`;
  return null;
};

export function BenchmarkRuler({benchmark,className}:{benchmark:KpiBenchmark;className?:string}){
  const tone=evalTone(benchmark.value,scaleOf(benchmark)),label=evalLabel(tone,benchmark.direction),arrow=evalArrow(tone,benchmark.direction);
  const sample=benchmark.sampleSize===null?'universo não informado':`n=${benchmark.sampleSize}`;
  const median=benchmark.median===null?null:`mediana ${metricValue(benchmark.median,benchmark.unit)}`;
  const detail=[median,sample,benchmark.note].filter(Boolean).join(' · ');
  if(tone==='unknown')return <p className={cn('mt-2 text-xs font-semibold text-muted-foreground',className)} title={detail}>{label} · {sample}</p>;
  const text=phrase(benchmark),reference=marker(benchmark);
  return <div className={cn('mt-2',className)}>
    <p className={cn('text-xs font-semibold',evalTextClass(tone))}>{arrow&&<span aria-hidden="true">{arrow} </span>}{text??label}</p>
    <div className="relative mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden="true" title={`${label} · ${detail}`}>
      <div className={cn('h-full rounded-full',evalFillClass(tone))} style={{width:`${Math.max(1,Math.min(100,position(benchmark)))}%`}}/>
      {reference!==null&&<i className="absolute inset-y-[-3px] w-0.5 bg-foreground" style={{left:`${reference}%`}}/>}
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{label} · {detail}</p>
  </div>;
}
