'use client';

import { useState } from 'react';
import type { DataCoverage } from '@senadotracker/domain';
import { LineChart, type ChartDatum } from '@/components/charts';

export function ParticipationEvolutionChart({ title, annual, monthly, coverage, monthlyAvailable = true }: { title: string; annual: ChartDatum[]; monthly: ChartDatum[]; coverage: DataCoverage; monthlyAvailable?: boolean }) {
  const [period, setPeriod] = useState<'month' | 'year'>(monthlyAvailable ? 'month' : 'year');
  const data = period === 'month' ? monthly : annual;
  return <div>
    <div className="mb-3 flex justify-end">
      <div className="inline-flex rounded-full border bg-card p-1" role="group" aria-label="Periodicidade do gráfico">
        <button type="button" disabled={!monthlyAvailable} aria-pressed={period === 'month'} onClick={() => setPeriod('month')} className="focus-ring rounded-full px-4 py-2 text-sm font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45">Mês a mês</button>
        <button type="button" aria-pressed={period === 'year'} onClick={() => setPeriod('year')} className="focus-ring rounded-full px-4 py-2 text-sm font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground">Ano a ano</button>
      </div>
    </div>
    <LineChart title={`${title} · ${period === 'month' ? 'mês a mês' : 'ano a ano'}`} data={data} coverage={coverage} min={0} max={100} suffix="%"/>
    {!monthlyAvailable && <p className="mt-2 text-xs text-muted-foreground">A série mensal de presença depende de registros estruturados de comparecimento, ainda indisponíveis para o Senado.</p>}
  </div>;
}
