import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadWellbeingPageCached, scopeOf } from '@/lib/wellbeing/load';

/** Vitrine de Bem-estar na visão geral do território — mesmo padrão de `security-summary.tsx`, mas usando o
 * retrato (fatos simples, sem delta/sparkline: o read model de Bem-estar não calcula série por fato). */
export async function WellbeingSummary({ kind, code }: { kind: 'uf' | 'municipio'; code: string }) {
  const scope = await scopeOf(kind, code); if (!scope) return null;
  const data = await loadWellbeingPageCached(scope); const base = kind === 'uf' ? `/estados/${scope.uf}/bem-estar` : `/municipios/${scope.entityId}/bem-estar`;
  if (!data.portrait.facts.length) return null;
  return (
    <section aria-labelledby="bem-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Bem-estar</p><h2 id="bem-resumo" className="display-title mt-1 text-2xl sm:text-3xl">Como se vive em {scope.name}</h2></div>
        <Link href={base} aria-label="Ler a história completa de Bem-estar" className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ler a história completa<ArrowRight size={14} aria-hidden /></Link></div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.portrait.facts.map(f => <li key={f.label} className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-muted-foreground">{f.label}</p>
        <p className="hero-figure tnum mt-1 text-3xl text-[#14304f]">{f.value}<span className="ml-1 text-sm font-normal text-muted-foreground">{f.unit}</span></p>
        <p className="mt-1 text-xs text-muted-foreground">{f.source} · {f.period}</p></li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Fontes oficiais de anos diferentes; a página completa mostra cobertura, universo e o que cada número não permite concluir.</p>
    </section>
  );
}
