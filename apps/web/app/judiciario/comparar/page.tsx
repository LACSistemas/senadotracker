import Link from 'next/link';
import { Scale } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { EmptyState } from '@/components/empty-state';
import { NativeSelect } from '@/components/ui/native-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RankedBars } from '@/components/charts';
import { JudiciaryAvailabilityNote, toChartCoverage } from '@/components/judiciary/availability';
import { TribunalMultiSelect } from '@/components/judiciary/tribunal-multi-select';
import { loadJudiciaryOverview, loadJudiciaryComparison, loadJudiciaryTribunalDirectory } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comparar tribunais · Judiciário · Cívica', description: 'Compare tribunais num mesmo indicador oficial, com metodologia e cobertura lado a lado — sem nota geral.' };

type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
const list = (v: string | undefined) => [...new Set((v ?? '').split(',').map(s => s.trim()).filter(Boolean))];
const int = new Intl.NumberFormat('pt-BR');

export default async function JudiciaryComparePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const indicatorId = scalar(params.indicador) ?? 'JN_CONGESTION_RATE';
  const year = Number(scalar(params.ano) ?? 2025);
  const tribunalIds = list(scalar(params.tribunais));

  const [overview, directory] = await Promise.all([loadJudiciaryOverview(year), loadJudiciaryTribunalDirectory({ pageSize: 100 })]);
  const indicatorOptions = (overview.data.metrics as Array<{ indicator_id: string; public_name: string }>).map(m => ({ value: m.indicator_id, label: m.public_name }));
  const tribunalOptions = (directory.items as Array<{ tribunal_id: string; sigla: string; official_name: string }>).filter(t => t.tribunal_id !== 'JUD:TRIBUNAL:CNJ');

  const result = tribunalIds.length >= 2 && tribunalIds.length <= 50 ? await loadJudiciaryComparison(indicatorId, tribunalIds, year) : null;

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="Comparador" title="Compare tribunais" description="Escolha um indicador oficial e dois ou mais tribunais. Cada painel mantém unidade, universo e cobertura próprios — nenhuma nota geral é calculada." />
      </section>

      <section className="page-shell py-8">
        <Card><CardContent className="p-6">
          <form action="/judiciario/comparar" method="get" className="grid gap-4 lg:grid-cols-3">
            <label className="text-sm font-bold">Indicador<NativeSelect name="indicador" defaultValue={indicatorId} className="mt-2 w-full">{indicatorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></label>
            <label className="text-sm font-bold">Ano<NativeSelect name="ano" defaultValue={String(year)} className="mt-2 w-full">{[2025, 2024, 2023, 2022, 2021, 2020].map(y => <option key={y}>{y}</option>)}</NativeSelect></label>
            <div className="lg:col-span-3"><TribunalMultiSelect name="tribunais" label="Tribunais (2 a 10)" options={tribunalOptions.map(t => ({ value: t.tribunal_id, sigla: t.sigla, name: t.official_name }))} initialValues={tribunalIds} /></div>
            <Button className="lg:col-span-3">Comparar</Button>
          </form>
        </CardContent></Card>
      </section>

      <section className="page-shell pb-16">
        {!result && <EmptyState title="Escolha pelo menos dois tribunais" description="A seleção fica registrada na URL e pode ser compartilhada." />}
        {result && result.availability === 'METHOD_INCOMPATIBLE' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="font-bold text-amber-800">Esses indicadores não são diretamente comparáveis.</p>
            <p className="mt-2 text-sm text-amber-900">Este indicador está marcado pela fonte oficial como não elegível para comparação — tribunais com universos estatísticos diferentes produziriam uma comparação enganosa.</p>
          </div>
        )}
        {result && result.availability === 'NOT_REPORTED' && <EmptyState title="Sem dado publicado para este recorte" description="Nenhum dos tribunais selecionados tem este indicador publicado para o ano escolhido." />}
        {result && result.availability === 'AVAILABLE' && (() => {
          const items = (result.data as any).items as Array<{ canonical_tribunal_id: string; sigla: string; official_name: string; value_numeric: string | null; unit: string; coverage_status: string }>;
          const meta = (result.data as any).indicator;
          const coverage = toChartCoverage('AVAILABLE', `${meta.public_name} · CNJ Justiça em Números · ${year}`, { from: `${year}-01-01`, to: `${year}-12-31`, grain: 'year' });
          return (
            <div>
              <h2 className="text-2xl font-black">{meta.public_name}</h2>
              <div className="mt-4"><RankedBars title={`${meta.public_name} · ${year}`} coverage={coverage}
                items={items.filter(i => i.value_numeric != null).map(i => ({ key: i.canonical_tribunal_id, label: i.sigla, value: Number(i.value_numeric), meta: i.official_name, href: `/judiciario/tribunais/${encodeURIComponent(i.canonical_tribunal_id)}` }))}
                formatValue={v => meta.aggregation_allowed === 'SUM' ? int.format(v) : v.toFixed(3)} /></div>
              {items.some(i => i.value_numeric == null) && <p className="mt-3 text-xs text-muted-foreground">{items.filter(i => i.value_numeric == null).length} tribunal(is) sem dado publicado para este recorte — não entram no gráfico, não viram zero.</p>}
              <div className="mt-6"><JudiciaryAvailabilityNote availability="AVAILABLE" source="CNJ Justiça em Números" limitations={result.provenance.limitations} /></div>
            </div>
          );
        })()}
      </section>

      <section className="border-t bg-card py-10">
        <div className="page-shell rounded-2xl border border-dashed p-6 text-sm text-muted-foreground"><Scale className="mb-2" /><strong className="text-foreground">Sem nota geral.</strong><p className="mt-2">O comparador mostra o valor de cada tribunal no indicador escolhido, com a metodologia oficial sempre visível — não existe aqui um "melhor" ou "pior" tribunal.</p><p className="mt-2"><Link href="/judiciario/tribunais" className="font-bold text-primary underline">Ver diretório completo de tribunais</Link></p></div>
      </section>
    </main>
  );
}
