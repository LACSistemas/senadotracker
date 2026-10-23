'use client';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import type { QuotaExplorerData } from '@/lib/quota-explorer';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const reais=(cents:number)=>money.format(cents/100);
const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MONTH_NAMES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function Bars({items,empty}:{items:Array<{label:string;cents:number}>;empty:string}){
  if(!items.length)return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max=Math.max(...items.map(item=>item.cents));
  return <ul className="space-y-1">{items.slice(0,8).map(item=><li key={item.label} className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_7.5rem]">
    <span className="font-semibold">{item.label}</span>
    <span aria-hidden="true" className="order-last col-span-2 h-2.5 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-primary" style={{width:`${Math.max(3,item.cents/max*100)}%`}}/></span>
    <span className="text-right font-bold tabular-nums">{reais(item.cents)}</span>
  </li>)}</ul>;
}

// Cota por mês, tocável: escolher o ano, tocar num mês e ver categorias e maiores notas daquele mês.
export function QuotaExplorer({data}:{data:QuotaExplorerData}){
  const [year,setYear]=useState(data.years[0]?.year??0),[month,setMonth]=useState<number|null>(null);
  const current=data.years.find(item=>item.year===year);
  if(!current)return null;
  const peak=Math.max(1,...current.months.map(item=>item?.cents??0)),detail=month===null?null:current.months[month];
  return <section aria-labelledby="cota-mes" className="mt-8 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 id="cota-mes" className="text-xl font-bold">Cota parlamentar mês a mês</h3><p className="text-sm text-muted-foreground">Toque num mês para ver com o que foi gasto. Mês sem barra = sem registro publicado (não é zero). Os meses são competências da cota.</p></div>
      <label className="text-sm font-bold">Ano<NativeSelect className="mt-1 min-h-11" value={year} onChange={event=>{setYear(Number(event.target.value));setMonth(null)}}>{data.years.map(item=><option key={item.year} value={item.year}>{item.year}</option>)}</NativeSelect></label></div>
    <div role="group" aria-label={`Gasto da cota por mês em ${year}`} className="mt-5 grid grid-cols-[repeat(12,minmax(24px,1fr))] items-end gap-0.5 sm:gap-2" style={{height:'11rem'}}>{current.months.map((item,index)=>{
      const label=`${MONTHS[index]}, ${MONTH_NAMES[index]} de ${year}: ${item?reais(item.cents):'sem registro publicado'}`;
      return <button key={index} type="button" disabled={!item} aria-pressed={month===index} aria-label={label} title={label} onClick={()=>setMonth(month===index?null:index)} className="focus-ring group flex h-full min-h-11 flex-col justify-end gap-1 rounded-md disabled:cursor-default">
        <span aria-hidden="true" className={cn('block w-full rounded-t-md transition-[height] motion-reduce:transition-none',item?(month===index?'bg-primary':'bg-primary/55 group-hover:bg-primary/80'):'border border-dashed bg-transparent')} style={{height:item?`${Math.max(4,item.cents/peak*100)}%`:'4%'}}/>
        <span aria-hidden="true" className="text-center text-[0.68rem] font-semibold text-muted-foreground sm:text-xs">{MONTHS[index]}</span>
      </button>;})}</div>
    <div className="mt-5 border-t pt-4" aria-live="polite">
      {detail?<>
        <h4 className="font-bold">Em {MONTH_NAMES[month!]} de {year}: {reais(detail.cents)} <span className="text-sm font-normal text-muted-foreground">({detail.records} {detail.records===1?'registro':'registros'})</span></h4>
        <div className="mt-3"><Bars items={detail.categories} empty="Sem despesas positivas no mês."/></div>
        {detail.items.length>0&&<div className="mt-4"><p className="text-sm font-semibold text-muted-foreground">Maiores notas da competência <span className="font-normal">(a data é a da emissão e pode cair em outro mês)</span></p><ul className="mt-2 divide-y text-sm">{detail.items.map((item,index)=><li key={index} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="min-w-0">{item.supplier}{item.date&&<span className="text-muted-foreground"> · {new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(`${item.date.slice(0,10)}T00:00:00Z`))}</span>}</span><span className="flex items-center gap-3"><strong className="tabular-nums">{reais(item.cents)}</strong>{item.url&&<a href={item.url} className="focus-ring inline-flex min-h-11 items-center font-bold text-primary underline">nota ↗</a>}</span></li>)}</ul></div>}
      </>:<>
        <h4 className="font-bold">Com o que gastou em {year}: {reais(current.totalCents)}</h4>
        <div className="mt-3"><Bars items={current.categories} empty="Sem despesas publicadas neste ano."/></div>
      </>}
    </div>
  </section>;
}
