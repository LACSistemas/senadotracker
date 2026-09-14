'use client';
import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { LegislativeComplement, Source } from '@senadotracker/domain';
import { Badge } from '@/components/ui/badge';

const formatDay=(value:string|null)=>{
  const civilDate=value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if(!civilDate)return 'Data não informada';
  const parsed=new Date(`${civilDate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())?'Data não informada':new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(parsed);
};
const house=(source:Source)=>source==='senado'?'Senado Federal':'Câmara dos Deputados';
const short=(value:string)=>{const first=value.split(/(?<=[.!?])\s|\n/,1)[0]?.trim()??value;return first.length>150?`${first.slice(0,147).trim()}…`:first};

export function PropositionTimeline({events}:{events:LegislativeComplement[]}){
  const [expanded,setExpanded]=useState(false);
  const groups=new Map<string,LegislativeComplement[]>();
  for(const event of events){const key=event.occurredAt??'unknown',items=groups.get(key)??[];items.push(event);groups.set(key,items)}
  const timeline=[...groups].sort(([a],[b])=>a==='unknown'?1:b==='unknown'?-1:a.localeCompare(b)).map(([date,items])=>{
    const ordered=[...items].sort((a,b)=>(a.kind==='situation'?0:1)-(b.kind==='situation'?0:1)||a.label.localeCompare(b.label));
    const milestone=ordered.find(item=>item.kind==='situation')??ordered[0]!;
    return{date:date==='unknown'?null:date,items:ordered,milestone,sources:[...new Set(ordered.map(item=>item.source))]};
  });
  const visible=expanded?timeline:timeline.slice(-20);
  return <><ol className="relative mt-7 space-y-5 before:absolute before:bottom-6 before:left-[11px] before:top-3 before:w-px before:bg-border sm:before:left-[99px]">
    {visible.map((group,index)=><li className="relative grid gap-3 pl-9 sm:grid-cols-[76px_1fr] sm:gap-6 sm:pl-0" key={group.date??'unknown'}>
      <time className="pt-1 text-sm font-bold tabular-nums text-muted-foreground">{formatDay(group.date)}</time>
      <span aria-hidden="true" className={`absolute left-1 top-1.5 size-4 rounded-full border-4 border-background sm:left-[91px] ${index===timeline.length-1?'bg-primary':'bg-muted-foreground'}`}/>
      <details className="group rounded-2xl border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span>
            <span className="flex flex-wrap gap-2">{group.sources.map(source=><Badge key={source}>{house(source)}</Badge>)}{group.milestone.kind==='situation'?<Badge className="bg-primary/10 text-primary">Marco oficial</Badge>:null}</span>
            <strong className="mt-3 block text-base leading-snug">{short(group.milestone.label)}</strong>
            <small className="mt-2 block text-muted-foreground">{group.items.length} {group.items.length===1?'registro oficial':'registros oficiais'} nesta data · clique para ver detalhes</small>
          </span>
          <ChevronDown className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" size={20}/>
        </summary>
        <div className="border-t px-5 pb-5 pt-4">
          <ul className="space-y-4">{group.items.map(item=><li className="border-l-2 border-primary/25 pl-4" key={`${item.source}:${item.externalKey}`}>
            <div className="flex flex-wrap items-center gap-2"><Badge>{house(item.source)}</Badge>{item.kind==='situation'?<span className="text-xs font-bold uppercase tracking-wide text-primary">Situação</span>:null}</div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{item.label}</p>
            {item.value?<p className="mt-1 text-xs text-muted-foreground">{item.value}</p>:null}
            <a className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary underline" href={item.officialUrl}>Registro oficial <ExternalLink size={12}/></a>
          </li>)}</ul>
        </div>
      </details>
    </li>)}
  </ol>{timeline.length>20?<button type="button" className="mt-6 rounded-xl border px-4 py-2 text-sm font-bold text-primary" onClick={()=>setExpanded(value=>!value)}>{expanded?'Mostrar somente os 20 marcos mais recentes':`Ver histórico completo (${timeline.length} datas)`}</button>:null}</>;
}
