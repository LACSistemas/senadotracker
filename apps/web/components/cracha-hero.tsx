import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import { TermoExplicado } from '@/components/termo-explicado';
import type { TermoChave } from '@/lib/glossario';
import { cn } from '@/lib/utils';

export interface CrachaGap{label:string;note:string}

// Pílulas do topo do perfil: fatos de carreira + a pílula de honestidade ("Faltam N dados").
export function CrachaPills({status,active,careerFacts,gaps}:{status:string;active:boolean;careerFacts:string[];gaps:CrachaGap[]}){
  return <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/15 px-3"><span aria-hidden="true" className={cn("size-2 rounded-full",active?"bg-emerald-300":"bg-white/50")}/>{status}</span>
    {careerFacts.map(fact=><span key={fact} className="inline-flex min-h-8 items-center rounded-full bg-white/15 px-3">{fact}</span>)}
    {gaps.length>0&&<a href="#faltam-dados" className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/40 px-3 hover:bg-white/10"><Info size={14} aria-hidden="true"/>Faltam {gaps.length} {gaps.length===1?'dado':'dados'} neste crachá · por quê?</a>}
  </div>;
}

export function MissingDataNote({gaps}:{gaps:CrachaGap[]}){
  if(!gaps.length)return null;
  return <details id="faltam-dados" className="mt-4 rounded-2xl border bg-card p-4 text-sm scroll-mt-28">
    <summary className="focus-ring min-h-11 cursor-pointer font-bold">Por que {gaps.length===1?'falta 1 dado':`faltam ${gaps.length} dados`} aqui?</summary>
    <p className="mt-2 text-muted-foreground">Mostramos “—” quando a fonte oficial não publicou o número. Nunca preenchemos com zero nem estimamos.</p>
    <ul className="mt-3 space-y-2">{gaps.map(gap=><li key={gap.label}><strong>{gap.label}</strong><span className="block text-muted-foreground">{gap.note}</span></li>)}</ul>
  </details>;
}

export interface CrachaTile{chave:TermoChave;value:string|null;context:string;href:string;coverage:DataCoverage;second?:ReactNode;label?:string}

// Fileira de tiles escaneáveis. Régua de benchmark e cobertura ficam no segundo nível (<details>), não na primeira leitura.
export function KpiStripCracha({tiles,className}:{tiles:CrachaTile[];className?:string}){
  return <ul className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4',className)}>{tiles.map(tile=>{
    const missing=tile.value===null||tile.coverage.availability==='unavailable';
    return <li key={tile.chave} className="card-elevated min-w-0 rounded-2xl border bg-card p-4">
      <p className="text-xs font-bold text-muted-foreground"><TermoExplicado chave={tile.chave} label={tile.label}/></p>
      <Link href={tile.href} className="focus-ring group mt-2 flex min-h-11 items-end justify-between gap-2 no-underline">
        <strong className={cn('block min-w-0 whitespace-nowrap text-[clamp(1rem,4.4vw,1.5rem)] lg:text-[clamp(1.15rem,1.7vw,1.5rem)] leading-tight tabular-nums',missing&&'text-muted-foreground')} aria-label={missing?'Não publicado':undefined}>{missing?'—':tile.value}</strong>
        <ArrowRight size={16} aria-hidden="true" className="mb-1 shrink-0 text-primary transition group-hover:translate-x-0.5"/><span className="sr-only">Ver detalhes</span>
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">{missing?'Não publicado pela fonte oficial.':tile.context}</p>
      <details className="mt-2 text-xs"><summary className="focus-ring inline-flex min-h-8 cursor-pointer items-center font-bold text-primary">Como foi medido</summary>
        <p className="mt-1 text-muted-foreground">{tile.coverage.note}</p>
        <p className="mt-1 text-muted-foreground">{tile.coverage.period.from&&tile.coverage.period.to?`Período: ${tile.coverage.period.from} a ${tile.coverage.period.to}.`:'Período não informado.'}</p>
        {tile.second}
      </details>
    </li>;})}</ul>;
}
