import Link from 'next/link';
import type { PersonThemes } from '@/lib/person-themes';

const explore=(name:string,theme:string)=>`/legislativo/proposicoes/explorar?${new URLSearchParams({autor:name,tema:theme})}`;

// "Em resumo, em {ano}": barras de tema tocáveis. Cada barra leva às proposições daquele tema e autor.
export function PersonThemesSummary({data,name}:{data:PersonThemes|null;name:string}){
  if(!data)return null;
  const max=Math.max(1,...data.themes.map(item=>item.count)),shown=data.themes.slice(0,8);
  return <div className="mt-8 rounded-2xl border bg-card p-5">
    <h3 className="text-xl font-bold">Em resumo, em {data.year}</h3>
    {data.proposals===0?<p className="mt-3 text-sm text-muted-foreground">Nenhuma proposta de autoria registrada em {data.year} nos lotes publicados.</p>:<>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">Do que mais tratou</p>
      {shown.length?<ul className="mt-3 space-y-1">{shown.map(item=><li key={item.label}>
        <Link href={explore(name,item.label)} className="focus-ring group grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-1 no-underline hover:bg-muted/60 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_6.5rem]">
          <span className="text-sm font-semibold">{item.label}</span>
          <span aria-hidden="true" className="order-last col-span-2 h-2.5 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1"><span className="block h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{width:`${Math.max(4,item.count/max*100)}%`}}/></span>
          <span className="text-right text-sm font-bold tabular-nums">{item.count} {item.count===1?'proposta':'propostas'}</span>
        </Link></li>)}</ul>:<p className="mt-2 text-sm text-muted-foreground">As propostas do ano não têm tema atribuído pela Casa.</p>}
      <p className="mt-3 text-xs text-muted-foreground">{data.withTheme} de {data.proposals} {data.proposals===1?'proposta tem':'propostas têm'} tema atribuído pela própria Casa; uma proposta pode ter mais de um tema. Toque numa barra para ver as propostas.</p>
      {data.absent.length>0&&shown.length>0&&<div className="mt-4 border-t pt-3"><p className="text-sm font-semibold text-muted-foreground">Sem nenhuma proposta em {data.year} nestes temas frequentes</p><p className="mt-1 text-sm">{data.absent.join(' · ')}</p></div>}
    </>}
  </div>;
}
