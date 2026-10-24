import Link from 'next/link';
import type { ReactNode } from 'react';
import { DatabaseZap, SearchX, TriangleAlert } from 'lucide-react';
import { Card,CardContent } from '@/components/ui/card';

// Três situações, três tons — todos honestos e sem culpar o leitor:
//  · unavailable: os dados existem, mas não conseguimos carregar agora (não é "sem dados");
//  · notfound: o endereço ou o filtro não leva a nada;
//  · empty: a fonte oficial não publicou (ou não há registros no recorte).
// O tom sai do título (…indispon…, …não encontrad…) para não mudar os ~30 usos existentes.
type Tone='unavailable'|'notfound'|'empty';
const toneOf=(title:string):Tone=>/indispon/i.test(title)?'unavailable':/não encontrad|inválid|não informad|nenhuma correspond/i.test(title)?'notfound':'empty';
const ICON={unavailable:TriangleAlert,notfound:SearchX,empty:DatabaseZap} as const;
const NOTE:Record<Tone,string|null>={
  unavailable:'Isso não quer dizer que os dados não existam: não conseguimos carregá-los agora. Tente de novo em instantes.',
  notfound:null,
  empty:null,
};

export function EmptyState({title,description,page=false,children}:{title:string;description:string;page?:boolean;children?:ReactNode}){
  const tone=toneOf(title),Icon=ICON[tone],Heading=page?'h1':'h2',note=NOTE[tone];
  return <Card role={tone==='unavailable'?'alert':'status'}><CardContent className="grid min-h-56 place-items-center py-12 text-center"><div>
    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-primary"><Icon aria-hidden="true"/></span>
    <Heading className="mt-4 text-lg font-bold">{title}</Heading>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    {note&&<p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{note}</p>}
    {children?<div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>:page&&<div className="mt-5 flex flex-wrap justify-center gap-3 text-sm font-bold">
      <Link href="/" className="focus-ring inline-flex min-h-11 items-center rounded-full border px-4 no-underline hover:bg-muted">Ir para o início</Link>
      <Link href="/legislativo/parlamentares" className="focus-ring inline-flex min-h-11 items-center rounded-full border px-4 no-underline hover:bg-muted">Ver parlamentares</Link>
    </div>}
  </div></CardContent></Card>}
