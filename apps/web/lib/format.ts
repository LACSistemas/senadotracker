import type { MetricUnit } from '@senadotracker/domain';
const money0=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}),money2=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),integer=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}),compacted=new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}),times=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const ratios=new Map<number,Intl.NumberFormat>();
const ratioFormat=(digits:number)=>{let format=ratios.get(digits);if(!format){format=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:digits});ratios.set(digits,format)}return format};
export const absent='—';
export const brl=(cents:number|null,digits:0|2=0)=>cents===null?absent:(digits?money2:money0).format(cents/100);
export const percent=(ratio:number|null,digits=1)=>ratio===null?absent:ratioFormat(digits).format(ratio);
export const count=(value:number|null)=>value===null?absent:integer.format(value);
export const compact=(value:number|null)=>value===null?absent:Math.abs(value)>=10_000?compacted.format(value):integer.format(value);
export const multiple=(value:number|null)=>value===null?absent:`${times.format(value)}×`;
/** Formata um valor conforme a unidade declarada pela métrica, para a régua não conhecer centavos nem razões. */
export const metricValue=(value:number|null,unit:MetricUnit)=>unit==='cents'?brl(value):unit==='ratio'?percent(value):count(value);
