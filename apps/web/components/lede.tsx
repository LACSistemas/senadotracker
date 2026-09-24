import Link from 'next/link';
import type { Lede } from '@/lib/lede';
import { CoverageBadge } from '@/components/metrics';
import { evalArrow, evalTextClass } from '@/lib/eval-color';
import { houseMetrics } from '@senadotracker/db';
import { cn } from '@/lib/utils';

/** Manchete de uma linha gerada por regra, nunca adjetivada: o fato e o universo, com o selo de
    cobertura ao lado para deixar claro que é dado publicado, não juízo. Jamais um heading — as rotas
    têm um `h1` só. Sempre clicável para a seção que originou o número. */
export function LedeLine({lede,className}:{lede:Lede;className?:string}){
  const arrow=lede.percentile===null?'':evalArrow(lede.tone,houseMetrics[lede.metric].direction);
  return <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-sm',className)}>
    <Link href={lede.href} className={cn('focus-ring font-semibold underline decoration-dotted underline-offset-4',evalTextClass(lede.tone))}>
      {arrow&&<span aria-hidden="true">{arrow} </span>}{lede.text}
    </Link>
    <CoverageBadge coverage={{...lede.coverage,note:`${lede.coverage.note} n=${lede.sampleSize}.`}}/>
  </p>;
}
