import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { CoverageBadge } from '@/components/metrics';
import type { DataCoverage } from '@senadotracker/domain';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const rampVars=['var(--map-5)','var(--map-4)','var(--map-3)','var(--map-2)'];

export function TierBPlaceholder({icon:Icon,title,description}:{icon:ComponentType<{size?:number}>;title:string;description:string}){
  return <section className="rounded-3xl border border-dashed border-border bg-card/50 p-6"><div className="flex items-start gap-3"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Icon size={17}/></span><div className="min-w-0"><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p><span className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Clock size={12}/>Em construção — cobertura ainda não publicada para este bloco</span></div></div></section>;
}

export interface RelationSourceSide { cents:number; label:string; sub?:string }
export function RelationSourceBar({narrative,parliamentary,institutional,coverage}:{narrative:string;parliamentary:RelationSourceSide|null;institutional:{contracted:RelationSourceSide;paid:RelationSourceSide;chamberPartial:boolean}|null;coverage:DataCoverage}){
  const instMax=institutional?Math.max(institutional.contracted.cents,institutional.paid.cents,1):1;
  return <section className="card-elevated rounded-3xl border bg-card p-6 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-xl font-black">De onde vem essa relação?</h2><CoverageBadge coverage={coverage}/></div><p className="text-balance mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{narrative}</p>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div><span className="eyebrow">Atividade parlamentar</span>{parliamentary?<><strong className="display-title mt-2 block text-3xl">{money.format(parliamentary.cents/100)}</strong><div className="mt-3 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{width:'100%',background:'var(--chart-1)'}}/></div>{parliamentary.sub&&<p className="mt-2 text-xs text-muted-foreground">{parliamentary.sub}</p>}</>:<p className="mt-3 text-sm text-muted-foreground">Sem despesa de gabinete publicada para este fornecedor.</p>}</div>
      <div><span className="eyebrow">Institucional{institutional?.chamberPartial?' · Câmara em reconciliação':''}</span>{institutional?<div className="mt-2 space-y-3">{[institutional.contracted,institutional.paid].map(side=><div key={side.label}><div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold text-muted-foreground">{side.label}</span><strong className="tabular-nums">{money.format(side.cents/100)}</strong></div><div className="mt-1 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{width:`${100*side.cents/instMax}%`,background:'var(--chart-2)'}}/></div></div>)}</div>:<p className="mt-3 text-sm text-muted-foreground">Sem contrato institucional publicado para este fornecedor.</p>}</div>
    </div>
  </section>;
}

export interface LadderRung { label:string; valueCents:number|null; primary?:boolean }
export function FinancialLadder({title,institution,rungs,coverage,note}:{title:string;institution:string;rungs:LadderRung[];coverage:DataCoverage;note?:string}){
  const max=Math.max(...rungs.map(r=>r.valueCents??0),1);
  return <div className="rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-2"><div><span className="eyebrow">{institution}</span><h3 className="mt-1 font-black">{title}</h3></div><CoverageBadge coverage={coverage}/></div>
    <div className="mt-4 space-y-2.5">{rungs.map((rung,index)=>{const width=rung.valueCents===null?0:Math.max(6,100*rung.valueCents/max);return <div key={rung.label}><div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold">{rung.label}</span><strong className="tabular-nums">{rung.valueCents===null?'—':money.format(rung.valueCents/100)}</strong></div><div className="mt-1 h-2.5 rounded-full bg-muted"><div className="h-2.5 rounded-full" style={{width:`${width}%`,background:rung.primary?'var(--primary)':rampVars[index%rampVars.length]}}/></div></div>})}</div>
    {note&&<p className="mt-4 text-xs leading-5 text-muted-foreground">{note}</p>}
  </div>;
}

export interface FingerprintChip { icon:ComponentType<{size?:number}>; label:string; value:string|number }
export function RelationshipFingerprint({sentence,chips,coverage,concentrationNote}:{sentence:string;chips:FingerprintChip[];coverage:DataCoverage;concentrationNote?:string}){
  return <section className="card-elevated rounded-3xl border bg-card p-6 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><span className="eyebrow">O perfil dessa relação</span><CoverageBadge coverage={coverage}/></div><p className="display-title text-balance mt-3 max-w-3xl text-2xl leading-snug sm:text-3xl">{sentence}</p>
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{chips.map(chip=><div key={chip.label} className="rounded-2xl bg-secondary p-4 text-secondary-foreground"><chip.icon size={17}/><strong className="display-title mt-2 block text-2xl">{chip.value}</strong><span className="mt-1 block text-xs font-semibold leading-4">{chip.label}</span></div>)}</div>
    {concentrationNote&&<p className="mt-4 text-xs leading-5 text-muted-foreground">{concentrationNote}</p>}
  </section>;
}

export interface ContractCardData { id:string; institution:string; number:string; object:string; originalCents:number|null; currentCents:number|null; semantics:string|null; signedAt:string|null; href?:string }
export function ContractCard({contract}:{contract:ContractCardData}){
  const delta=contract.originalCents&&contract.currentCents?(contract.currentCents/contract.originalCents-1)*100:null;
  return <div className="rounded-2xl border bg-card p-5"><div className="flex items-start justify-between gap-2"><span className="eyebrow">{contract.institution}</span>{contract.signedAt&&<span className="text-xs text-muted-foreground">assinado {contract.signedAt}</span>}</div><h3 className="mt-1.5 font-black">{contract.number}</h3><p className="mt-1.5 min-w-0 text-sm leading-5 text-muted-foreground" title={contract.object}>{contract.object||'Objeto não publicado'}</p>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Valor original</dt><dd className="font-bold tabular-nums">{contract.originalCents===null?'—':money.format(contract.originalCents/100)}</dd></div><div><dt className="text-xs text-muted-foreground">Valor atual publicado</dt><dd className="font-bold tabular-nums">{contract.currentCents===null?'—':money.format(contract.currentCents/100)}{delta!==null&&<span className="ml-1 text-xs font-semibold text-muted-foreground">({delta>=0?'+':''}{delta.toFixed(1)}%)</span>}</dd></div></dl>
    {contract.semantics&&<p className="mt-3 text-xs leading-5 text-muted-foreground">Semântica do valor atual: {contract.semantics}. Valor atual publicado não é valor pago.</p>}
    {contract.href&&<Link className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary underline-offset-2 hover:underline" href={contract.href}>Ver contrato e execução →</Link>}
  </div>;
}

export function TwoRelationsPanel({parliamentary,institutional}:{parliamentary:ReactNode;institutional:ReactNode}){
  return <section className="card-elevated rounded-3xl border bg-card p-6 lg:p-7"><h2 className="text-xl font-black">Duas relações com o Congresso</h2><p className="mt-1 text-sm text-muted-foreground">Este fornecedor aparece nos dois universos observados. Coexistência não sugere, por si só, irregularidade.</p><div className="mt-5 grid gap-6 lg:grid-cols-2"><div><h3 className="font-bold">Nos gabinetes</h3>{parliamentary}</div><div><h3 className="font-bold">Nas instituições</h3>{institutional}</div></div></section>;
}
