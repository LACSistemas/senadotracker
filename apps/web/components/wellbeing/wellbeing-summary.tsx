import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadWellbeingPageCached, scopeOf } from '@/lib/wellbeing/load';

/** Vitrine de Bem-estar na visão geral do território (P8: retrato em duas colunas, sem caixa por fato —
 * o read model não calcula delta/série por fato, então a diferenciação aqui é de leitura (fatos paralelos
 * de fontes/períodos distintos), não de gráfico — mandato §5.4: "cada dimensão pode usar composição própria"). */
export async function WellbeingSummary({ kind, code }: { kind: 'uf' | 'municipio'; code: string }) {
  const scope = await scopeOf(kind, code); if (!scope) return null;
  const data = await loadWellbeingPageCached(scope); const base = kind === 'uf' ? `/estados/${scope.uf}/bem-estar` : `/municipios/${scope.entityId}/bem-estar`;
  if (!data.portrait.facts.length) return null;
  return (
    <section aria-labelledby="bem-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Bem-estar</p><h2 id="bem-resumo" className="display-title mt-1 text-2xl sm:text-3xl">O retrato de {scope.name}</h2></div>
        <Link href={base} aria-label="Ler a história completa de Bem-estar" className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ler a história completa<ArrowRight size={14} aria-hidden /></Link></div>
      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">{data.portrait.facts.map(f => (
        <div key={f.label} className="border-t pt-3 first:border-t-0 first:pt-0 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(-n+2)]:pt-0">
          <dt className="text-xs font-semibold text-muted-foreground">{f.label}</dt>
          <dd className="hero-figure tnum mt-0.5 text-2xl text-[#14304f]">{f.value}<span className="ml-1 text-sm font-normal text-muted-foreground">{f.unit}</span></dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">{f.source} · {f.period}</dd>
        </div>
      ))}</dl>
      <p className="mt-4 text-xs text-muted-foreground">Fontes oficiais de anos diferentes; a página completa mostra cobertura, universo e o que cada número não permite concluir.</p>
    </section>
  );
}
