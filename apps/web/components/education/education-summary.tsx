import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadEducationPageCached, scopeOf } from '@/lib/education/load';
import { DeltaChip, Sparkline } from '@/components/security/security-ui';

/** Vitrine de Educação na visão geral do território: os mesmos indicadores-chave do panorama, em versão compacta.
 * Mesmo padrão de `components/security/security-summary.tsx` — reaproveita o loader completo (cacheado 60s). */
export async function EducationSummary({ kind, code }: { kind: 'uf' | 'municipio'; code: string }) {
  const scope = await scopeOf(kind, code); if (!scope) return null;
  const data = await loadEducationPageCached(scope); const base = kind === 'uf' ? `/estados/${scope.uf}/educacao` : `/municipios/${scope.entityId}/educacao`;
  if (!data.hero.kpis.length) return null;
  return (
    <section aria-labelledby="edu-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Educação</p><h2 id="edu-resumo" className="display-title mt-1 text-2xl sm:text-3xl">Como está a Educação em {scope.name}</h2></div>
        <Link href={base} aria-label="Ler a história completa de Educação" className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ler a história completa<ArrowRight size={14} aria-hidden /></Link></div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.hero.kpis.map(k => <li key={k.id} className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-muted-foreground">{k.label} · {k.basis}</p>
        <div className="mt-1 flex items-end justify-between gap-2"><p className="hero-figure tnum text-3xl text-[#14304f]">{k.value}</p><Sparkline values={k.spark} label={k.sparkLabel} width={72} height={26} /></div><p className="text-xs text-muted-foreground">{k.unit}</p><div className="mt-2"><DeltaChip delta={k.delta} /></div></li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Registros oficiais; a página completa mostra de onde vêm, como mudaram, as comparações válidas e o que as fontes não permitem concluir.</p>
    </section>
  );
}
