'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type { DataCoverage } from '@senadotracker/domain';
import { LineChart, type ChartDatum } from '@/components/charts';

export interface HistoricalMetric {
  id: string;
  label: string;
  data: ChartDatum[];
  coverage: DataCoverage;
}

export function HistoricalMetricTabs({ metrics }: { metrics: HistoricalMetric[] }) {
  const [active, setActive] = useState(metrics[0]?.id ?? '');
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const metric = metrics.find((item) => item.id === active) ?? metrics[0];
  if (!metric) return null;

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % metrics.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + metrics.length) % metrics.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = metrics.length - 1;
    else return;
    event.preventDefault();
    setActive(metrics[next]!.id);
    tabs.current[next]?.focus();
  }

  return <div>
    <div role="tablist" aria-label="Métrica histórica" className="mb-4 flex flex-wrap gap-2">
      {metrics.map((item, index) => <button
        key={item.id}
        ref={(node) => { tabs.current[index] = node; }}
        id={`historico-tab-${item.id}`}
        role="tab"
        type="button"
        aria-controls={`historico-painel-${item.id}`}
        aria-selected={item.id === active}
        tabIndex={item.id === active ? 0 : -1}
        onClick={() => setActive(item.id)}
        onKeyDown={(event) => selectFromKeyboard(event, index)}
        className="focus-ring rounded-full border px-4 py-2 text-sm font-semibold aria-selected:bg-primary aria-selected:text-primary-foreground"
      >{item.label}</button>)}
    </div>
    <div
      id={`historico-painel-${metric.id}`}
      role="tabpanel"
      aria-labelledby={`historico-tab-${metric.id}`}
      tabIndex={0}
      className="focus-ring"
    >
      <LineChart title={metric.label} data={metric.data} coverage={metric.coverage} {...(metric.label.includes('(%)') ? { min: 0, max: 100, suffix: '%' } : {})}/>
    </div>
  </div>;
}
