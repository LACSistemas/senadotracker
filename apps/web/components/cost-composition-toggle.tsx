'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type Entry={label:string;value:number|null;tone:string};
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});

export function CostCompositionToggle({entries,total,roster,cabinetStaffTotal,cabinetStaffMean}:{entries:Entry[];total:number|null;roster:number;cabinetStaffTotal:number;cabinetStaffMean:number|null}){
  const [mode,setMode]=useState<'total'|'average'>('total');
  const divisor=mode==='average'&&roster>0?roster:1;
  return <div className="mt-8">
    <div className="flex justify-end">
      <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label="Forma de exibição da composição do custo mensal">
        <button type="button" onClick={()=>setMode('total')} aria-pressed={mode==='total'} className={cn('rounded-lg px-3 py-1.5 text-xs font-bold transition',mode==='total'?'bg-primary text-primary-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>Total</button>
        <button type="button" onClick={()=>setMode('average')} aria-pressed={mode==='average'} className={cn('rounded-lg px-3 py-1.5 text-xs font-bold transition',mode==='average'?'bg-primary text-primary-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>Média</button>
      </div>
    </div>
    <div className="mt-4 grid gap-5 lg:grid-cols-[.27fr_.55fr_.18fr]">
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground">
        <p className="text-sm font-bold">{mode==='total'?'Custo mensal identificado da Casa':'Custo médio mensal por parlamentar'}</p>
        <strong className="mt-2 block text-3xl">{total===null?'—':money.format(total/divisor/100)}</strong>
        <small className="mt-2 block opacity-75">{mode==='total'?'média mensal no período publicado':`total mensal ÷ ${roster} parlamentares`}</small>
      </div>
      <div className="rounded-2xl border bg-background p-5">
        <div><h3 className="font-black">Composição do custo mensal</h3><p className="mt-1 text-xs text-muted-foreground">{mode==='total'?`Total identificado da Casa · ${roster} parlamentares`:'Média por parlamentar do cadastro publicado'}</p></div>
        {total?<div className="mt-5 flex h-9 overflow-hidden rounded-xl">{entries.map(({label,value,tone})=>value?<span key={label} className={tone} style={{width:`${value/total*100}%`}} title={`${label}: ${percent.format(value/total)}`}/>:null)}</div>:null}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{entries.map(({label,value,tone})=><div className="rounded-xl border p-4" key={label}><span className={`inline-block size-2.5 rounded-full ${tone}`}/><p className="mt-2 text-xs font-bold text-muted-foreground">{label}</p><strong className="mt-1 block text-lg">{value===null?'—':money.format(value/divisor/100)}</strong><small>{value!==null&&total?percent.format(value/total):'cobertura indisponível'}</small></div>)}</div>
      </div>
      <div className="flex min-h-40 flex-col justify-center rounded-2xl border bg-background p-5">
        <p className="text-xs font-bold text-muted-foreground">{mode==='total'?'Pessoas nos gabinetes':'Média de pessoas por gabinete'}</p>
        <strong className="mt-2 block text-2xl text-primary">{mode==='total'?cabinetStaffTotal.toLocaleString('pt-BR'):cabinetStaffMean===null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(cabinetStaffMean)}</strong>
        <small className="mt-1 text-muted-foreground">vínculos confirmados</small>
      </div>
    </div>
  </div>;
}
