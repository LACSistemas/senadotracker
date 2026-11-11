import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { MultiLineChart, RankedBars } from '@/components/charts';
import { JudiciaryAvailabilityNote, toChartCoverage } from '@/components/judiciary/availability';
import { MethodologyPanel, type IndicatorMethodology } from '@/components/judiciary/methodology-panel';
import { loadJudiciaryThemeOverview, loadJudiciaryThemeIndicators, loadJudiciaryThemeHistoricalSeries, loadJudiciaryThemeComparators, loadJudiciaryThemeSources } from '@/lib/judiciary-themes';
import { loadJudiciaryNationalSeries } from '@/lib/judiciary';
import type { JudiciaryThemeId } from '@senadotracker/db';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ tema: string }>; searchParams: Promise<{ tribunal?: string }> };
const VALID_THEMES = new Set(['TAX_EXECUTION', 'GENERAL_EXECUTION', 'CRIMINAL_EXECUTION', 'DOMESTIC_VIOLENCE', 'CRIMINAL', 'CONCILIATION']);
const int = new Intl.NumberFormat('pt-BR');

export async function generateMetadata({ params }: Props) {
  const { tema } = await params; const id = tema.toUpperCase();
  return { title: VALID_THEMES.has(id) ? `${id.replaceAll('_', ' ')} · Judiciário · Cívica` : 'Tema · Cívica' };
}

export default async function JudiciaryThemePage({ params, searchParams }: Props) {
  const { tema } = await params; const sp = await searchParams;
  const themeId = tema.toUpperCase() as JudiciaryThemeId;
  if (!VALID_THEMES.has(themeId)) notFound();

  const overview = await loadJudiciaryThemeOverview(themeId, { year: 2025 });
  const metrics = (overview.data as any).metrics as Array<{ indicator_id: string; public_name: string; unit: string; aggregation_allowed: string; value: string | null; observations: number; available_values: number; metric_availability: string }>;
  const meta = (overview.data as any).meta as { title: string; description: string; status: string; officialSource: string; notes: string[] };
  if (!metrics?.length) {
    return <main id="conteudo" tabIndex={-1} className="page-shell py-12">
      <h1 className="text-3xl font-black">{meta?.title ?? themeId}</h1>
      <div className="mt-4"><JudiciaryAvailabilityNote availability={overview.availability} source={meta?.officialSource} limitations={meta?.notes} /></div>
    </main>;
  }

  const headline = metrics.find(m => m.aggregation_allowed === 'SUM' && m.value != null) ?? metrics[0]!;
  const isSumHeadline = headline.aggregation_allowed === 'SUM';
  const [series, nationalSeries, comparators, sources, indicators] = await Promise.all([
    sp.tribunal ? loadJudiciaryThemeHistoricalSeries(themeId, headline.indicator_id, sp.tribunal) : Promise.resolve(null),
    !sp.tribunal && isSumHeadline ? loadJudiciaryNationalSeries([headline.indicator_id]) : Promise.resolve(null),
    loadJudiciaryThemeComparators(themeId, headline.indicator_id, 2025),
    loadJudiciaryThemeSources(themeId),
    loadJudiciaryThemeIndicators(themeId, { pageSize: 50 }),
  ]);
  // Por tribunal: série bruta do próprio tribunal (já no grão certo). Nacional: soma por ano — nunca a
  // série bruta por tribunal/ano, que tem uma linha por tribunal e viraria uma "evolução" sem sentido.
  const seriesAvailability = sp.tribunal ? series!.availability : (nationalSeries?.availability ?? 'NOT_REPORTED');
  const seriesItems = sp.tribunal
    ? (series!.data as any).items as Array<{ reference_year: number; value_numeric: string | null }>
    : ((nationalSeries?.data.items ?? []) as Array<{ reference_year: number; value: string | null }>).map(i => ({ reference_year: i.reference_year, value_numeric: i.value }));
  const comparatorItems = ((comparators.data as any).items as Array<{ canonical_tribunal_id: string; sigla: string; value_numeric: string | null }>).filter(c => c.value_numeric != null).sort((a, b) => Number(b.value_numeric) - Number(a.value_numeric)).slice(0, 15);
  const indicatorItems = (indicators.data as any).items as IndicatorMethodology[];
  const otherMetrics = metrics.filter(m => m.indicator_id !== headline.indicator_id);

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="Tema" title={meta.title} description={meta.description} />
      </section>

      <section className="page-shell py-8">
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm font-semibold text-muted-foreground">{headline.public_name}</p>
          <p className="hero-figure tnum mt-2 text-4xl text-[#14304f]">{headline.value != null ? int.format(Number(headline.value)) : '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{headline.observations} observações · {headline.available_values} com valor · 2025</p>
        </div>
      </section>

      {seriesItems.length > 0 && (
        <section className="page-shell py-6">
          <h2 className="text-2xl font-black">Evolução histórica</h2>
          <div className="mt-4"><MultiLineChart title={sp.tribunal ? `${headline.public_name} · ${sp.tribunal}` : `${headline.public_name} · soma nacional`} data={seriesItems.map(i => ({ label: String(i.reference_year), values: [{ label: headline.public_name, value: i.value_numeric != null ? Number(i.value_numeric) : null, color: '#115b45' }] }))} coverage={toChartCoverage(seriesAvailability, meta.officialSource, { from: `${seriesItems[0]!.reference_year}-01-01`, to: `${seriesItems.at(-1)!.reference_year}-12-31`, grain: 'year' })} /></div>
        </section>
      )}

      {otherMetrics.length > 0 && (
        <section className="page-shell py-6">
          <h2 className="text-2xl font-black">Outros indicadores</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherMetrics.map(m => (
              <div key={m.indicator_id} className="rounded-xl border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground">{m.public_name}</p>
                <p className="mt-1 text-xl font-black">{m.value != null ? int.format(Number(m.value)) : '—'}</p>
                {m.metric_availability === 'METHOD_INCOMPATIBLE' && <p className="mt-1 text-[0.68rem] text-amber-700">não agregável nacionalmente</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {comparatorItems.length > 0 && (
        <section className="border-t bg-card py-10">
          <div className="page-shell">
            <h2 className="text-2xl font-black">Por tribunal</h2>
            <div className="mt-4"><RankedBars title={`${headline.public_name} · 15 maiores · 2025`} items={comparatorItems.map(c => ({ key: c.canonical_tribunal_id, label: c.sigla, value: Number(c.value_numeric), href: `/judiciario/tribunais/${encodeURIComponent(c.canonical_tribunal_id)}` }))} coverage={toChartCoverage('AVAILABLE', meta.officialSource, { grain: 'year' })} formatValue={v => int.format(v)} /></div>
          </div>
        </section>
      )}

      <section className="page-shell py-10">
        <h2 className="text-2xl font-black">Indicadores deste tema</h2>
        <div className="mt-4 space-y-2">{indicatorItems.map(i => <MethodologyPanel key={i.indicator_id} indicator={i} summary={i.public_name!} />)}</div>
      </section>

      <section className="border-t py-10">
        <div className="page-shell">
          <h2 className="text-2xl font-black">Fonte e limitações</h2>
          <div className="mt-4"><JudiciaryAvailabilityNote availability={overview.availability} source={meta.officialSource} limitations={meta.notes} /></div>
          <Link href="/judiciario/temas" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Ver todos os temas <ArrowRight size={14} /></Link>
        </div>
      </section>
    </main>
  );
}
