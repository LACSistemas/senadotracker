'use client';

import {useState} from 'react';
import Link from 'next/link';
import {PartyLogo} from '@/components/party-logo';

type Row={party:string;senators:number;deputies:number};
type House='all'|'camara'|'senado';
const number=new Intl.NumberFormat('pt-BR');
const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
const count=(row:Row,house:House)=>house==='senado'?row.senators:house==='camara'?row.deputies:row.senators+row.deputies;
const colors=['#115b45','#2d7f93','#8b6aa8','#b0744c','#478273','#9d755d','#657b4c','#5c7194','#9b637a','#99854b'];

export function PartySeats({rows}:{rows:Row[]}){
  const [house,setHouse]=useState<House>('all');
  const ranked=rows.map(row=>({...row,seats:count(row,house)})).filter(row=>row.seats>0).sort((a,b)=>b.seats-a.seats||a.party.localeCompare(b.party,'pt-BR'));
  const total=ranked.reduce((sum,row)=>sum+row.seats,0),head=ranked.slice(0,10),others=ranked.slice(10),otherSeats=others.reduce((sum,row)=>sum+row.seats,0),max=head[0]?.seats??1;
  return <div>
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Casa para distribuição de cadeiras">{([['all','Congresso'],['camara','Câmara'],['senado','Senado']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>setHouse(value)} aria-pressed={house===value} className={`focus-ring rounded-full border px-4 py-2 text-sm font-bold ${house===value?'border-primary bg-primary text-primary-foreground':'bg-card text-muted-foreground hover:text-foreground'}`}>{label}</button>)}</div>
    <div className="grid grid-cols-[minmax(115px,1fr)_minmax(90px,2fr)_auto_auto] items-center gap-x-3 gap-y-3 text-sm sm:gap-x-5">
      <span className="text-xs font-bold text-muted-foreground">Partido</span><span aria-hidden="true"/><span className="text-right text-xs font-bold text-muted-foreground">Cadeiras</span><span className="text-right text-xs font-bold text-muted-foreground">% do total</span>
      {head.map((row,index)=><div key={row.party} className="contents"><Link prefetch={false} href={`/legislativo/partidos/${encodeURIComponent(row.party)}`} className="focus-ring flex min-w-0 items-center gap-2 font-bold hover:text-primary"><PartyLogo party={row.party} size={30}/><span className="truncate">{row.party}</span></Link><div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full" style={{width:`${row.seats/max*100}%`,backgroundColor:colors[index]}}/></div><strong className="text-right tabular-nums">{number.format(row.seats)}</strong><span className="text-right tabular-nums text-muted-foreground">{percent.format(row.seats/total)}</span></div>)}
      {otherSeats>0&&<div className="contents"><a href="#todos-partidos" className="focus-ring font-bold hover:text-primary">Outros ({others.length})</a><div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary/45" style={{width:`${Math.min(100,otherSeats/max*100)}%`}}/></div><strong className="text-right tabular-nums">{number.format(otherSeats)}</strong><span className="text-right tabular-nums text-muted-foreground">{percent.format(otherSeats/total)}</span></div>}
    </div>
    <p className="mt-5 text-xs text-muted-foreground">{number.format(total)} cadeiras no cadastro em exercício. Cada parlamentar entra uma vez em sua Casa.</p>
  </div>;
}
