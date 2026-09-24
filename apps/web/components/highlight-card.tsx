import Link from 'next/link';
import type { ComponentType } from 'react';
import { OfficialPortrait } from '@/components/app-image';
import { cn } from '@/lib/utils';

export interface HighlightPerson{name:string;uf:string;party?:string;photoUrl:string|null;href:string;source:'senado'|'camara'}
/** Sujeito sem rosto — bancada ou unidade federativa. Não é `HighlightPerson` com foto nula: `origin`
    também muda, porque "Senado Federal" descreve a pessoa, e o agregado precisa dizer o próprio universo. */
export interface HighlightSubject{label:string;href?:string;origin:string}

/** Cartão de destaque, em dois papéis: no pódio dos rankings e nos destaques da home. Com `person` tem
    rosto; com `subject`, o sujeito é bancada ou unidade federativa e não há foto a mostrar.
    Com `rank`, é posição real da MESMA métrica — só vale onde não há empate no topo (custo serve;
    presença não, porque vários marcam 100%). Sem `rank`, é o extremo de uma dimensão, e aí a direção
    é que conta a história (menor presença, maior gabinete).

    Um layout só, que `large` apenas amplia. Uma variante horizontal de três colunas parecia boa em
    largura total e se desmontava dentro de uma coluna estreita de pódio, quebrando o número caractere
    a caractere. `OfficialPortrait` usa `fill`, então todo wrapper de foto tem tamanho fixo: sem isso o
    CLS estoura. */
export function HighlightCard({label,value,person,subject,note,sample,icon:Icon,size='small',rank,className}:{
  label:string;value:string;person:HighlightPerson|null;subject?:HighlightSubject|null;note:string;sample:number;
  icon?:ComponentType<{size?:number}>;size?:'small'|'large';rank?:number;className?:string}){
  const large=size==='large';
  const origin=person?person.source==='senado'?'Senado Federal':'Câmara dos Deputados':subject?subject.origin:'Cobertura insuficiente';
  const name=person?`${person.name} (${person.uf})`:subject?.label,href=person?person.href:subject?.href;
  return <article className={cn('card-elevated flex min-w-0 flex-col rounded-2xl border bg-card p-5',large&&'border-primary/40 bg-secondary/25 sm:p-6',className)}>
    <div className="flex items-center gap-2">
      {rank!==undefined
        ? <span className={cn('grid shrink-0 place-items-center rounded-full font-black tabular-nums',large?'size-10 bg-primary text-base text-primary-foreground':'size-8 bg-secondary text-sm text-primary')}>{rank}º</span>
        : Icon&&<span className={cn('grid shrink-0 place-items-center rounded-xl',large?'size-10 bg-primary text-primary-foreground':'size-9 bg-secondary text-primary')}><Icon size={large?19:17}/></span>}
      <p className="min-w-0 text-xs font-semibold leading-4 text-muted-foreground">{label}</p>
    </div>
    <div className={cn('mt-4 flex min-w-0 items-center gap-4',large&&'gap-5')}>
      {person&&<div className={cn('relative shrink-0 overflow-hidden rounded-2xl bg-muted',large?'size-16 sm:size-20':'size-14')}>
        <OfficialPortrait src={person.photoUrl} name={person.name} sizes={large?'80px':'56px'} priority={large}/>
      </div>}
      <div className="min-w-0 flex-1">
        {/* Número nunca quebra: sem `break-words`, um valor como "R$ 834.146" era partido caractere a
            caractere quando a coluna apertava. */}
        <strong className={cn('block whitespace-nowrap tabular-nums leading-none tracking-tight',large?'text-2xl lg:text-3xl':'text-xl sm:text-2xl')}>{value}</strong>
        {name===undefined
          ? <span className="mt-2 block text-sm text-muted-foreground">Sem dados comparáveis</span>
          : href
            ? <Link prefetch={false} href={href} className={cn('focus-ring mt-2 block truncate font-semibold text-primary underline',large&&'text-lg')}>{name}</Link>
            : <span className={cn('mt-2 block truncate font-semibold',large&&'text-lg')}>{name}</span>}
      </div>
    </div>
    <p className="mt-4 text-xs text-muted-foreground">{origin} · n={sample}</p>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
  </article>;
}
