import type { DataCoverage } from '@senadotracker/domain';
import type { HdiTerritory } from '@senadotracker/db';
import { MultiLineChart, type MultiLineDatum } from '@/components/charts';
import { loadHdiComparison } from '@/lib/territory-idhm';

const number = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const TERRITORY_COLOR = 'var(--chart-1)'; const BRASIL_COLOR = '#64748b';

/** IDHM (PNUD/IPEA/FJP) do território comparado a Brasil. Só 1991/2000/2010 — decenal, ligado ao Censo —
 * por isso o gráfico liga só esses 3 pontos reais, nunca insinua uma série anual entre eles. */
export async function IdhmSummary({ territory, territoryName }: { territory: HdiTerritory; territoryName: string }) {
  const { territory: series, brasil } = await loadHdiComparison(territory);
  if (!series) return null;

  const data: MultiLineDatum[] = series.points.map(point => ({
    label: String(point.year),
    values: [
      { label: territoryName, value: point.idhm, color: TERRITORY_COLOR },
      { label: 'Brasil', value: brasil?.points.find(b => b.year === point.year)?.idhm ?? null, color: BRASIL_COLOR },
    ],
  }));
  const latest = series.points.at(-1)!;
  const coverage: DataCoverage = {
    availability: 'available', source: 'multiple', sampleSize: null, batchId: null,
    period: { from: '1991-01-01', to: '2010-12-31', grain: 'year' },
    note: 'IDHM é calculado só em anos de Censo (1991, 2000 e 2010) — não existe um valor anual. A linha liga os 3 pontos reais; não há dado entre eles.',
  };

  return (
    <section aria-labelledby="idhm-resumo" className="rounded-3xl border bg-card p-5 sm:p-7">
      <p className="eyebrow">Desenvolvimento humano</p>
      <h2 id="idhm-resumo" className="display-title mt-1 text-2xl sm:text-3xl">IDHM de {territoryName}</h2>
      <div className="mt-4">
        <MultiLineChart title={`IDHM, ${territoryName} x Brasil (1991–2010)`} data={data} coverage={coverage} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-2xl bg-secondary p-3"><dt className="text-xs font-semibold text-secondary-foreground/80">Renda ({latest.year})</dt><dd className="hero-figure tnum text-xl text-secondary-foreground">{latest.idhmRenda != null ? number.format(latest.idhmRenda) : '—'}</dd></div>
        <div className="rounded-2xl bg-secondary p-3"><dt className="text-xs font-semibold text-secondary-foreground/80">Longevidade ({latest.year})</dt><dd className="hero-figure tnum text-xl text-secondary-foreground">{latest.idhmLongevidade != null ? number.format(latest.idhmLongevidade) : '—'}</dd></div>
        <div className="rounded-2xl bg-secondary p-3"><dt className="text-xs font-semibold text-secondary-foreground/80">Educação ({latest.year})</dt><dd className="hero-figure tnum text-xl text-secondary-foreground">{latest.idhmEducacao != null ? number.format(latest.idhmEducacao) : '—'}</dd></div>
      </dl>
    </section>
  );
}
