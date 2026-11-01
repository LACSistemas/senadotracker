import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadInfrastructurePageCached, scopeOf } from '@/lib/infrastructure/load';

/** Vitrine de Infraestrutura na visão geral do território — mesmo padrão de `security-summary.tsx`; usa os KPIs
 * já priorizados por dimensão do hero de Infraestrutura (água, ruas, habitação, energia, mobilidade, obras). */
export async function InfrastructureSummary({ kind, code }: { kind: 'uf' | 'municipio'; code: string }) {
  const scope = await scopeOf(kind, code); if (!scope) return null;
  const data = await loadInfrastructurePageCached(scope); const base = kind === 'uf' ? `/estados/${scope.uf}/infraestrutura` : `/municipios/${scope.entityId}/infraestrutura`;
  if (!data.hero.kpis.length) return null;
  return (
    <section aria-labelledby="infra-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Infraestrutura</p><h2 id="infra-resumo" className="display-title mt-1 text-2xl sm:text-3xl">O que existe em {scope.name}</h2></div>
        <Link href={base} aria-label="Ler a história completa de Infraestrutura" className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ler a história completa<ArrowRight size={14} aria-hidden /></Link></div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.hero.kpis.slice(0, 4).map(k => <li key={k.code} className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-muted-foreground">{k.label}</p>
        <p className="hero-figure tnum mt-1 text-3xl text-[#14304f]">{k.value}<span className="ml-1 text-sm font-normal text-muted-foreground">{k.unit}</span></p>
        {k.note && <p className="mt-1 text-xs text-muted-foreground">{k.note}</p>}</li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Água, ruas, habitação, energia, mobilidade e obras públicas registradas; a página completa mostra fonte, período e o que ainda não está publicado.</p>
    </section>
  );
}
