import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadSecurityPageCached, scopeOf } from '@/lib/security/load';
import { KpiHeadline, KpiStat, KpiStatStrip } from '@/components/territory/editorial-kpi';

/** Vitrine de Segurança na visão geral do território (P8: 1 gráfico de tendência protagonista — o indicador
 * com a série mais longa — seguido de lista compacta; nunca 4 KPIs com o mesmo peso visual, mandato §5.3). */
export async function SecuritySummary({ kind, code }: { kind: 'uf' | 'municipio'; code: string }) {
  const scope = await scopeOf(kind, code); if (!scope) return null;
  const data = await loadSecurityPageCached(scope); const base = kind === 'uf' ? `/estados/${scope.uf}/seguranca` : `/municipios/${scope.entityId}/seguranca`;
  const kpis = [...data.hero.kpis].sort((a, b) => b.spark.length - a.spark.length);
  const [lead, ...rest] = kpis;
  if (!lead) return null;
  const leadCompare = lead.compare?.valid ? lead.compare.text : lead.secondary;
  return (
    <section aria-labelledby="seg-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Segurança Pública</p><h2 id="seg-resumo" className="display-title mt-1 text-2xl sm:text-3xl">Como evoluiu a Segurança em {scope.name}</h2></div>
        <Link href={base} aria-label="Ler a história completa de Segurança Pública" className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ler a história completa<ArrowRight size={14} aria-hidden /></Link></div>
      <div className="mt-5"><KpiHeadline eyebrow={`${lead.label} · ${lead.basis}`} value={lead.value} unit={lead.unit} delta={lead.delta} spark={lead.spark} sparkLabel={lead.sparkLabel}
        caption={leadCompare ?? lead.plain} /></div>
      {rest.length > 0 && <KpiStatStrip>{rest.map(k => <KpiStat key={k.id} label={k.label} value={k.value} unit={k.unit} />)}</KpiStatStrip>}
      <p className="mt-4 text-xs text-muted-foreground">Registros oficiais; a página completa mostra de onde vêm, como mudaram, as comparações válidas e o que as fontes não permitem concluir.</p>
    </section>
  );
}
