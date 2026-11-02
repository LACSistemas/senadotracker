import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { loadInfrastructurePageCached, scopeOf } from '@/lib/infrastructure/load';
import { KpiHeadline, KpiRow, KpiRowList } from '@/components/territory/editorial-kpi';

/** Vitrine de Infraestrutura na visão geral do território (P8: 1 serviço prioritário em destaque — já
 * decidido por `HERO_KPI_PRIORITY`, P5 — seguido dos demais como lista de serviços, não uma grade de
 * caixas idênticas de "água/ruas/energia/mobilidade" sem hierarquia entre si). */
export async function InfrastructureSummary({ kind, code }: { kind: 'uf' | 'municipio'; code: string }) {
  const scope = await scopeOf(kind, code); if (!scope) return null;
  const data = await loadInfrastructurePageCached(scope); const base = kind === 'uf' ? `/estados/${scope.uf}/infraestrutura` : `/municipios/${scope.entityId}/infraestrutura`;
  const [lead, ...rest] = data.hero.kpis;
  if (!lead) return null;
  return (
    <section aria-labelledby="infra-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Infraestrutura</p><h2 id="infra-resumo" className="display-title mt-1 text-2xl sm:text-3xl">O que existe em {scope.name}</h2></div>
        <Link href={base} aria-label="Ler a história completa de Infraestrutura" className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Ler a história completa<ArrowRight size={14} aria-hidden /></Link></div>
      <div className="mt-5"><KpiHeadline eyebrow={lead.label} value={lead.value} unit={lead.unit} caption={lead.note} /></div>
      {rest.length > 0 && <KpiRowList>{rest.slice(0, 3).map(k => <KpiRow key={k.code} label={k.label} value={k.value} unit={k.unit} meta={k.note} />)}</KpiRowList>}
      <p className="mt-4 text-xs text-muted-foreground">Água, ruas, habitação, energia, mobilidade e obras públicas registradas; a página completa mostra fonte, período e o que ainda não está publicado.</p>
    </section>
  );
}
