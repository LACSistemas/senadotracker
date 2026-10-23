'use client';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { PresenceDay, PresenceKind, PresenceYear } from '@/lib/presence-kinds';

// Ordem fixa e cores dos tokens --group-* (paleta categórica validada: ΔE CVD ≥ 13,6, contraste ≥ 3:1 na superfície clara).
// A cor nunca está sozinha: ausência é quadrado vazado com ×, presença com ressalva é hachurada, e há legenda com contagens.
const KINDS:Array<{kind:PresenceKind;label:string;color:string;hint:string}>=[
  {kind:'present',label:'Presença',color:'var(--group-1)',hint:'Presença registrada no dia de sessão'},
  {kind:'present_partial',label:'Presença (~)',color:'var(--group-1)',hint:'Presença com marcação (~) na fonte oficial'},
  {kind:'leave',label:'Licença',color:'var(--group-2)',hint:'Licença, inclusive gestante'},
  {kind:'official',label:'Decisão da Mesa/Presidência ou atividade partidária',color:'var(--group-3)',hint:'Dia justificado por decisão da Mesa/Presidência ou obrigação político-partidária'},
  {kind:'mission',label:'Missão autorizada',color:'var(--group-5)',hint:'Missão oficial autorizada'},
  {kind:'absent',label:'Ausência',color:'transparent',hint:'Ausência registrada'},
];
const META=new Map(KINDS.map(item=>[item.kind,item]));
const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MONTH_NAMES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const WEEKDAYS=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const br=(iso:string)=>`${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`;
const weekday=(iso:string)=>WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;
const pct=(n:number,d:number)=>d>0?`${Math.round(n/d*100)}%`:'—';
const isPresent=(kind:PresenceKind)=>kind==='present'||kind==='present_partial';

function Square({day,active,tabbable,onSelect,refCb}:{day:PresenceDay;active:boolean;tabbable:boolean;onSelect:()=>void;refCb:(el:HTMLButtonElement|null)=>void}){
  const meta=META.get(day.kind)!;
  const style=day.kind==='absent'?{borderColor:'var(--foreground)'}:day.kind==='present_partial'?{borderColor:meta.color,backgroundImage:`repeating-linear-gradient(135deg,${meta.color} 0 3px,transparent 3px 6px)`}:{backgroundColor:meta.color,borderColor:meta.color};
  return <button ref={refCb} data-iso={day.iso} type="button" tabIndex={tabbable?0:-1} aria-pressed={active} aria-label={`${weekday(day.iso)}, ${br(day.iso)}: ${day.status}`} onClick={onSelect} onFocus={onSelect} onMouseEnter={onSelect}
    className={cn('focus-ring relative grid size-6 shrink-0 place-items-center rounded-[5px] border-2 text-[0.7rem] font-black leading-none text-foreground motion-reduce:transition-none',active&&'ring-2 ring-foreground ring-offset-1')} style={style}>
    {day.kind==='absent'&&<span aria-hidden="true">×</span>}
  </button>;
}

// Calendário de presença: um quadrado por dia de sessão, agrupado por mês, com seletor de ano, detalhe do dia
// (toque, foco ou passar o mouse), setas do teclado e tabela equivalente. Números oficiais vêm da Câmara.
export function PresenceCalendar({years,name}:{years:PresenceYear[];name:string}){
  const withDays=useMemo(()=>years.filter(item=>item.days.length||item.total),[years]);
  const [year,setYear]=useState(withDays[0]?.year??0),[selected,setSelected]=useState<string|null>(null);
  const refs=useRef(new Map<string,HTMLButtonElement|null>());
  const current=withDays.find(item=>item.year===year)??withDays[0];
  if(!current)return null;
  const byMonth=MONTHS.map((_,index)=>current.days.filter(day=>Number(day.iso.slice(5,7))===index+1));
  const order=current.days.map(day=>day.iso);
  const selectedDay=current.days.find(day=>day.iso===selected)??null;
  const counts=KINDS.map(item=>({...item,n:current.days.filter(day=>day.kind===item.kind).length}));
  const presentDays=current.days.filter(day=>isPresent(day.kind)).length;

  const shift=(iso:string,days:number)=>new Date(Date.parse(`${iso}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
  const move=(event:KeyboardEvent,iso:string)=>{
    const i=order.indexOf(iso);let next=i;
    if(event.key==='ArrowRight')next=Math.min(order.length-1,i+1);else if(event.key==='ArrowLeft')next=Math.max(0,i-1);
    else if(event.key==='ArrowDown'||event.key==='ArrowUp'){const hit=order.indexOf(shift(iso,event.key==='ArrowDown'?7:-7));if(hit<0)return;next=hit}
    else if(event.key==='Home')next=0;else if(event.key==='End')next=order.length-1;else return;
    event.preventDefault();const target=order[next]!;setSelected(target);refs.current.get(target)?.focus();
  };
  // Calendário de verdade: colunas = dias da semana (seg–sex; sáb/dom só se houve sessão no ano), linhas = semanas.
  const weekend=current.days.some(day=>{const wd=(new Date(`${day.iso}T12:00:00Z`).getUTCDay()+6)%7;return wd>=5});
  const cols=weekend?7:5,heads=['S','T','Q','Q','S','S','D'].slice(0,cols);
  const monthGrid=(index:number)=>{
    const total=new Date(Date.UTC(current.year,index+1,0)).getUTCDate(),first=(new Date(Date.UTC(current.year,index,1)).getUTCDay()+6)%7;
    const rows:Array<Array<{d:number}|null>>=[];
    for(let d=1;d<=total;d++){const wd=(first+d-1)%7,row=Math.floor((first+d-1)/7);if(wd>=cols)continue;(rows[row]??=Array(cols).fill(null))[wd]={d}}
    return rows.filter(Boolean);
  };

  return <section aria-labelledby="presenca-calendario" className="rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="presenca-calendario" className="text-xl font-bold">Presença em {current.year}, dia a dia</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cada quadrado é um dia de sessão deliberativa da Câmara. Passe o mouse, toque ou use as setas para ver o dia.</p></div>
      <div role="group" aria-label="Ano" className="flex flex-wrap gap-1">{withDays.map(item=><button key={item.year} type="button" aria-pressed={item.year===current.year} onClick={()=>{setYear(item.year);setSelected(null)}} className={cn('focus-ring min-h-11 rounded-full border px-3 text-sm font-bold','aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground')}>
        {item.year}<span className="ml-1 text-xs font-semibold opacity-80">{item.present!==null&&item.total?pct(item.present,item.total):'—'}</span></button>)}</div>
    </div>
    <p className="mt-4 text-lg font-bold">{current.present!==null&&current.total?<>Presente em {current.present} de {current.total} dias <span className="text-muted-foreground">({pct(current.present,current.total)})</span></>:'Total oficial de dias não publicado'}</p>
    {(current.justified||current.unjustified)?<p className="text-sm text-muted-foreground">{current.justified??0} ausências justificadas · {current.unjustified??0} sem justificativa (números oficiais).</p>:null}

    {current.days.length?<div role="group" aria-label={`Dias de sessão de ${name} em ${current.year}`} onKeyDown={event=>{const iso=(event.target as HTMLElement).dataset.iso;if(iso)move(event,iso)}} className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{byMonth.map((days,index)=>{
      if(!days.length)return <div key={index} className="min-w-0"><p className="mb-1 text-xs font-bold text-muted-foreground">{MONTHS[index]}</p><span className="text-xs text-muted-foreground">sem sessões registradas</span></div>;
      const lookup=new Map(days.map(day=>[Number(day.iso.slice(8,10)),day]));
      return <div key={index} className="min-w-0"><p className="mb-1.5 flex items-baseline gap-2 text-xs font-bold text-muted-foreground"><span>{MONTH_NAMES[index]}</span><span className="font-semibold">{pct(days.filter(day=>isPresent(day.kind)).length,days.length)} de presença</span></p>
        <div role="group" aria-label={`${MONTH_NAMES[index]} de ${current.year}`} className="grid w-max gap-1" style={{gridTemplateColumns:`repeat(${cols},1.5rem)`}}>
          {heads.map((h,k)=><span key={`h${k}`} aria-hidden="true" className="text-center text-[0.6rem] font-bold text-muted-foreground">{h}</span>)}
          {monthGrid(index).flatMap((row,r)=>row.map((cell,c)=>{const day=cell?lookup.get(cell.d):undefined;
            if(day)return <Square key={`${r}-${c}`} day={day} active={selected===day.iso} tabbable={selected?selected===day.iso:day.iso===order[0]} onSelect={()=>setSelected(day.iso)} refCb={el=>{refs.current.set(day.iso,el)}}/>;
            return <span key={`${r}-${c}`} aria-hidden="true" className="grid size-6 place-items-center">{cell&&<span className="size-1 rounded-full bg-border"/>}</span>;}))}
        </div></div>;})}</div>
    :<p className="mt-4 text-sm text-muted-foreground">A fonte não publicou a lista de dias deste ano; só o total acima.</p>}

    <div className="mt-4 min-h-12 rounded-xl bg-secondary/50 p-3 text-sm" aria-live="polite">{selectedDay?<><strong>{weekday(selectedDay.iso)}, {br(selectedDay.iso)}</strong> — {selectedDay.status}<span className="block text-xs text-muted-foreground">{META.get(selectedDay.kind)!.hint}</span></>:<span className="text-muted-foreground">Escolha um quadrado para ver a data e o status oficial do dia.</span>}</div>

    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">{counts.filter(item=>item.n>0||item.kind==='present').map(item=><li key={item.kind} className="flex items-center gap-2" title={item.hint}>
      <span aria-hidden="true" className="grid size-4 place-items-center rounded-[4px] border-2 text-[0.6rem] font-black" style={item.kind==='absent'?{borderColor:'var(--foreground)'}:item.kind==='present_partial'?{borderColor:item.color,backgroundImage:`repeating-linear-gradient(135deg,${item.color} 0 2px,transparent 2px 4px)`}:{backgroundColor:item.color,borderColor:item.color}}>{item.kind==='absent'?'×':''}</span>{item.label}: <strong>{item.n}</strong></li>)}</ul>
    {current.days.length>0&&current.present!==null&&presentDays!==current.present&&<p className="mt-2 text-xs text-muted-foreground">A lista tem {presentDays} dias com presença; o total oficial acima ({current.present}) é o que vale e pode incluir dias com outras justificativas.</p>}

    <details className="mt-4"><summary className="focus-ring inline-flex min-h-11 cursor-pointer items-center text-sm font-bold text-primary">Ver como tabela</summary>
      <div className="overflow-x-auto"><table className="mt-2 w-full min-w-[28rem] text-left text-sm"><caption className="sr-only">Dias de sessão por mês e status em {current.year}</caption>
        <thead><tr className="border-b text-xs text-muted-foreground"><th scope="col" className="p-2">Mês</th><th scope="col" className="p-2">Dias de sessão</th><th scope="col" className="p-2">Presença</th><th scope="col" className="p-2">Ausência</th><th scope="col" className="p-2">Outros status</th></tr></thead>
        <tbody>{byMonth.map((days,index)=>days.length?<tr key={index} className="border-b"><th scope="row" className="p-2 font-semibold">{MONTH_NAMES[index]}</th><td className="p-2 tabular-nums">{days.length}</td><td className="p-2 tabular-nums">{days.filter(day=>isPresent(day.kind)).length}</td><td className="p-2 tabular-nums">{days.filter(day=>day.kind==='absent').length}</td><td className="p-2 tabular-nums">{days.filter(day=>!isPresent(day.kind)&&day.kind!=='absent').length}</td></tr>:null)}</tbody></table></div>
    </details>
    <p className="mt-3 text-xs text-muted-foreground">Fonte: frequência oficial da Câmara dos Deputados. Falta de voto não é ausência: presença e votações têm universos diferentes.</p>
  </section>;
}
