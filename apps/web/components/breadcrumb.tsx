import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export interface Crumb{label:string;href?:string}

// Trilha deep-linkável: "‹ Pará". O último item é a página atual (sem link, aria-current).
export function Breadcrumb({items}:{items:Crumb[]}){
  const parents=items.slice(0,-1),current=items.at(-1);
  return <nav aria-label="Você está em" className="text-sm">
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">{parents.map(item=><li key={item.label} className="flex items-center gap-1">
      {item.href?<Link href={item.href} className="focus-ring inline-flex min-h-11 items-center gap-1 font-semibold text-primary no-underline hover:underline"><ChevronLeft size={14} aria-hidden="true"/>{item.label}</Link>:<span>{item.label}</span>}
    </li>)}
    {current&&<li aria-current="page" className="font-bold text-foreground">{current.label}</li>}</ol>
  </nav>;
}
