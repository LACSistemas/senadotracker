'use client';

import { useState } from 'react';
import type { Source } from '@senadotracker/domain';
import { cn } from '@/lib/utils';

type Entry={label:string;value:number|null;tone:string};
type Mode='annual'|'monthly'|'average';
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});

export function CostCompositionToggle({source,annualEntries,annualTotal,annualPeriod,monthlyEntries,monthlyTotal,monthlyPeriod,comparableEntries,comparableTotal,roster,eligible,partial,noInfo,cabinetStaffTotal,cabinetStaffMean}:{source:Source;annualEntries:Entry[];annualTotal:number|null;annualPeriod?:string|null;monthlyEntries:Entry[];monthlyTotal:number|null;monthlyPeriod?:string|null;comparableEntries?:Entry[];comparableTotal?:number|null;roster:number;eligible?:number;partial?:number;noInfo?:number;cabinetStaffTotal:number;cabinetStaffMean:number|null}){
  const [mode,setMode]=useState<Mode>('annual');
  const isAverage=mode==='average';
  const entries=isAverage?(comparableEntries??monthlyEntries):mode==='annual'?annualEntries:monthlyEntries;
  const total=isAverage?(comparableTotal??null):mode==='annual'?annualTotal:monthlyTotal;
  const period=isAverage?(monthlyPeriod??null):mode==='annual'?annualPeriod:monthlyPeriod;
  const divisor=isAverage?(eligible??0):1;
  const display=(value:number|null)=>value===null||isAverage&&divisor===0?'—':money.format((isAverage?value!/divisor:value!)/100);
  const personLabel=source==='senado'?'senador':'deputado';
  const title=mode==='annual'?'Total anual identificado':mode==='monthly'?'Média mensal identificada':`Média por ${personLabel} elegível`;
  const subtitle=mode==='annual'?`Soma das parcelas publicadas nas competências ${period??'observadas'}.`:mode==='monthly'?`Média das parcelas por competência na janela ${period??'observada'}.`:`Média do total comparável entre ${divisor} parlamentares elegíveis.`;
  const segmentTotal=total??0;
  return <div className="mt-8">
    <div className="flex flex-wrap justify-end gap-2" role="group" aria-label="Forma de exibição da composição do custo">
      {([['annual','Ano'],['monthly','Média/mês'],['average',`Por ${personLabel}`]] as const).map(([value,label])=><button key={value} type="button" onClick={()=>setMode(value)} aria-pressed={mode===value} className={cn('rounded-lg px-3 py-1.5 text-xs font-bold transition',mode===value?'bg-primary text-primary-foreground shadow-sm':'bg-muted text-muted-foreground hover:text-foreground')}>{label}</button>)}
    </div>
    <div className="mt-4 grid gap-5 lg:grid-cols-[.27fr_.55fr_.18fr]">
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground"><p className="text-sm font-bold">{title}</p><strong className="mt-2 block text-3xl">{display(total)}</strong><small className="mt-2 block opacity-75">{subtitle}</small></div>
      <div className="rounded-2xl border bg-background p-5"><div><h3 className="font-black">Composição do custo</h3><p className="mt-1 text-xs text-muted-foreground">{mode==='annual'?`Casa com ${roster} parlamentares no cadastro; a cobertura varia por competência.`:mode==='monthly'?`Média por competência na janela ${period??'indisponível'}; ausência de parcela não vira zero.`:`Mesma janela e mesma população elegível.`}</p></div>{segmentTotal>0&&<div className="mt-5 flex h-9 overflow-hidden rounded-xl">{entries.map(({label,value,tone})=>value?<span key={label} className={tone} style={{width:`${value/segmentTotal*100}%`}} title={`${label}: ${percent.format(value/segmentTotal)}`}/>:null)}</div>}<div className="mt-5 grid gap-3 sm:grid-cols-3">{entries.map(({label,value,tone})=><div className="rounded-xl border p-4" key={label}><span className={`inline-block size-2.5 rounded-full ${tone}`}/><p className="mt-2 text-xs font-bold text-muted-foreground">{label}</p><strong className="mt-1 block text-lg">{display(value)}</strong><small>{value!==null&&segmentTotal?percent.format(value/segmentTotal):'cobertura indisponível'}</small></div>)}</div></div>
      <div className="flex min-h-40 flex-col justify-center rounded-2xl border bg-background p-5"><p className="text-xs font-bold text-muted-foreground">{isAverage?'Média de membros por gabinete':'Membros dos gabinetes'}</p><strong className="mt-2 block text-2xl text-primary">{isAverage?(cabinetStaffMean===null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(cabinetStaffMean)):cabinetStaffTotal.toLocaleString('pt-BR')}</strong><small className="mt-1 text-muted-foreground">{roster} no cadastro · {eligible??'—'} elegíveis · {partial??'—'} parciais · {noInfo??'—'} sem informação</small></div>
    </div>
  </div>;
}
