import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeTabs, THEMES, formatInt } from '@/components/territory/territory-ui';

export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return <nav aria-label="Você está em" className="mb-4 text-sm text-muted-foreground"><ol className="flex flex-wrap items-center gap-1.5">
    {items.map((it, i) => <li key={`${i}-${it.label}`} className="flex items-center gap-1.5">{i > 0 && <span aria-hidden>/</span>}{it.href ? <Link href={it.href} className="hover:text-primary hover:underline">{it.label}</Link> : <span aria-current="page" className="font-semibold text-foreground">{it.label}</span>}</li>)}
  </ol></nav>;
}

export function TerritoryFrame({ crumbs, kicker, title, lede, population, populationYear, base, active, actions, children }: {
  crumbs: Array<{ href?: string; label: string }>; kicker: string; title: string; lede: ReactNode; population: number | null; populationYear: number | null;
  base: string; active: string; actions?: ReactNode; children: ReactNode;
}) {
  return <main className="page-shell py-6 sm:py-10">
    <Crumbs items={crumbs} />
    <header className="hero-wash rounded-[1.5rem] border p-6 sm:p-10">
      <p className="eyebrow">{kicker}</p>
      <h1 className="display-title text-balance mt-2 text-4xl sm:text-6xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{lede}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {population !== null && <span className="rounded-full border bg-card px-3 py-1 text-sm"><strong>{formatInt(population)}</strong> habitantes <span className="text-muted-foreground">({populationYear}, estimativa IBGE)</span></span>}
        {actions}
      </div>
    </header>
    <div className="mt-6"><ThemeTabs base={base} active={active} themes={[...THEMES]} /></div>
    <div className="mt-6 space-y-10">{children}</div>
  </main>;
}
