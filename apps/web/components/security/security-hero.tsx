import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Kpi, SecurityPageData } from '@/lib/security/types';
import { BenchRuler } from './bench-ruler';
import { DeltaChip, Sparkline } from './security-ui';
import { cn } from '@/lib/utils';

function KpiCard({ k, lead, who }: { k: Kpi; lead: boolean; who: string }) {
  return (
    <article className={cn('flex h-full flex-col rounded-2xl border p-5 card-elevated sm:p-6', lead ? 'bg-[#e8f3ee]' : 'bg-card')} aria-labelledby={`kpi-${k.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="eyebrow">{k.label}</p><h3 id={`kpi-${k.id}`} className="mt-1 text-sm font-semibold leading-snug text-[#14304f]">{k.plain}</h3></div>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold', k.state === 'prelim' ? 'border-[#a65d08]/40 bg-[#fdf3e3] text-[#a65d08]' : 'bg-white text-muted-foreground')}>{k.basis}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0"><p className={cn('hero-figure tnum text-[#14304f]', lead ? 'text-6xl sm:text-7xl' : 'text-5xl')}>{k.value}</p><p className="mt-1 text-sm text-muted-foreground">{k.unit}</p></div>
        <div className="text-right"><Sparkline values={k.spark} label={k.sparkLabel} width={lead ? 140 : 112} height={lead ? 46 : 38} />{k.spark.length > 1 && <p className="mt-0.5 text-[0.62rem] text-muted-foreground">{k.sparkLabel}</p>}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><DeltaChip delta={k.delta} />{k.secondary && <span className="text-xs text-muted-foreground">{k.secondary}</span>}</div>
      <div className="mt-4">
        {k.ruler ? <BenchRuler r={k.ruler} who={who} />
          : k.compare && !k.compare.valid ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">Sem comparação válida para este indicador</summary><p className="mt-1 leading-5">{k.compare.text}</p></details> : null}
        {k.ruler && k.compare?.valid && <details className="mt-1.5 text-xs text-muted-foreground"><summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">Como a comparação foi feita</summary><p className="mt-1 leading-5">{k.compare.text}</p></details>}
      </div>
      {k.caveat && <p className="mt-2 text-[0.7rem] leading-snug text-muted-foreground">{k.caveat}</p>}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4"><p className="text-[0.7rem] text-muted-foreground">Fonte: {k.source}</p>
        <Link href={`#${k.chapter}`} className="focus-ring inline-flex min-h-6 shrink-0 items-center gap-1 py-1 text-sm font-semibold text-primary hover:underline">Explorar<ArrowRight size={14} aria-hidden /></Link></div>
    </article>
  );
}

/** Panorama: 3–4 indicadores escolhidos por relevância pública, cobertura e dimensões diferentes. O primeiro tem destaque; nenhum é colorido como bom/ruim. */
export function SecurityHero({ data }: { data: SecurityPageData }) {
  const { hero, scope } = data; const k = hero.kpis; const n = k.length;
  if (!n) return <section aria-labelledby="panorama" className="rounded-3xl border border-dashed bg-card p-6"><h2 id="panorama" className="font-display text-2xl">Panorama de {scope.name}</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">{hero.lede}</p></section>;
  return (
    <section aria-labelledby="panorama" className="space-y-4">
      <header><p className="eyebrow">Panorama</p><h2 id="panorama" className="display-title mt-1 text-2xl sm:text-4xl">Como está a Segurança Pública em {scope.name}?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{hero.lede}</p></header>
      <div className={cn('grid gap-4', n === 1 ? '' : 'md:grid-cols-2', n === 3 && 'lg:grid-cols-6')}>
        {k.map((x, i) => <div key={x.id} className={cn(n === 3 && 'lg:col-span-2', n === 3 && i === 0 && 'lg:col-span-2')}><KpiCard k={x} lead={i === 0} who={scope.name} /></div>)}
      </div>
      {hero.facts.length > 0 && <p className="sr-only">Resumo em texto: {hero.facts.join(' ')}</p>}
    </section>
  );
}
