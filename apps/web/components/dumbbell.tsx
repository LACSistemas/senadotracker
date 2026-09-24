import { brl } from '@/lib/format';

/** Dois pontos e a distância entre eles: a haste é a história, não a cor.
    Crescer patrimônio não é mérito nem demérito, então nada aqui usa a escala de avaliação — o que se
    codifica é direção (vazado = antes, cheio = depois), com a escala compartilhada por todas as linhas
    para que os comprimentos sejam comparáveis entre si. */
export function DumbbellCell({fromCents,toCents,max,fromLabel,toLabel}:{fromCents:number;toCents:number;max:number;fromLabel:string;toLabel:string}){
  const ceiling=Math.max(max,1),at=(value:number)=>Math.min(100,Math.max(0,100*value/ceiling));
  const start=at(Math.min(fromCents,toCents)),end=at(Math.max(fromCents,toCents)),grew=toCents>=fromCents;
  const title=`${fromLabel}: ${brl(fromCents)} · ${toLabel}: ${brl(toCents)} · ${grew?'aumento':'redução'} de ${brl(Math.abs(toCents-fromCents))}`;
  return <div className="min-w-[10rem]" title={title}>
    <div className="relative h-5" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"/>
      <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted-foreground/45" style={{left:`${start}%`,width:`${Math.max(end-start,.4)}%`}}/>
      {/* Vazado é o ponto de partida; cheio é o mais recente. A ordem visual carrega o sentido do tempo. */}
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-foreground bg-card" style={{left:`${at(fromCents)}%`}}/>
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" style={{left:`${at(toCents)}%`}}/>
    </div>
    <p className="mt-0.5 flex flex-wrap justify-between gap-x-2 text-xs tabular-nums text-muted-foreground"><span>{brl(fromCents)}</span><span aria-hidden="true">{grew?'→':'←'}</span><span className="font-semibold text-foreground">{brl(toCents)}</span></p>
  </div>;
}

export function DumbbellLegend({fromLabel,toLabel}:{fromLabel:string;toLabel:string}){
  return <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full border-2 border-muted-foreground bg-card"/>{fromLabel}</span>
    <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full bg-foreground"/>{toLabel}</span>
    <span>A haste mede a distância entre as duas declarações, na mesma escala para todas as linhas.</span>
  </p>;
}
