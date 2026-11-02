import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadEducationPageCached, scopeOf } from '@/lib/education/load';
import { KpiHeadline, KpiRow, KpiRowList } from '@/components/territory/editorial-kpi';

/** Vitrine de Educação na visão geral do território (P8: composição em "jornada" — 1 indicador protagonista
 * com a comparação já validada, o restante como lista compacta, nunca uma grade de 4 caixas iguais). */
export async function EducationSummary({ kind, code }: { kind: 'uf' | 'municipio'; code: string }) {
  const scope = await scopeOf(kind, code); if (!scope) return null;
  const data = await loadEducationPageCached(scope); const base = kind === 'uf' ? `/estados/${scope.uf}/educacao` : `/municipios/${scope.entityId}/educacao`;
  const [lead, ...rest] = data.hero.kpis;
  if (!lead) return null;
  const leadCompare = lead.compare?.valid ? lead.compare.text : lead.secondary;
  return (
    <section aria-labelledby="edu-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Educação</p><h2 id="edu-resumo" className="display-title mt-1 text-2xl sm:text-3xl">A jornada escolar em {scope.name}</h2></div>
        <Link href={base} aria-label="Ler a história completa de Educação" className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ler a história completa<ArrowRight size={14} aria-hidden /></Link></div>
      <div className="mt-5"><KpiHeadline eyebrow={`${lead.label} · ${lead.basis}`} value={lead.value} unit={lead.unit} delta={lead.delta} spark={lead.spark} sparkLabel={lead.sparkLabel}
        caption={leadCompare ?? lead.plain} /></div>
      {rest.length > 0 && <KpiRowList>{rest.map(k => <KpiRow key={k.id} label={k.label} value={k.value} unit={k.unit} meta={k.basis} delta={k.delta} />)}</KpiRowList>}
      <p className="mt-4 text-xs text-muted-foreground">Registros oficiais; a página completa mostra de onde vêm, como mudaram, as comparações válidas e o que as fontes não permitem concluir.</p>
    </section>
  );
}
