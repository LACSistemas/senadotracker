'use client';

import { useState } from 'react';
import type { Explorer } from '@/lib/education/types';
import { TrendChart } from '@/components/security/trend-chart';
import { Histogram } from './education-ui';
import { cn } from '@/lib/utils';

/**
 * Explorador de um capítulo: o leitor escolhe (disciplina, etapa, rede…) e vê, na hora, a frase com o número, a série contra a referência e,
 * quando existe, a distribuição. Todas as combinações já vêm calculadas do servidor; aqui só se troca a vista.
 */
export function ChartExplorer({ explorer }: { explorer: Explorer }) {
  const [sel, setSel] = useState<Record<string, string>>(explorer.defaults);
  const key = explorer.dims.map(d => sel[d.id]).join('|'); const view = explorer.views[key];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-3" role="group" aria-label="Escolha o que ver">
        {explorer.dims.map(d => (
          <div key={d.id}><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" id={`${explorer.id}-${d.id}`}>{d.label}</p>
            <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={`${explorer.id}-${d.id}`}>
              {d.options.map(o => { const on = sel[d.id] === o.value; return <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => setSel(s => ({ ...s, [d.id]: o.value }))}
                className={cn('focus-ring min-h-9 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors', on ? 'border-[#115b45] bg-[#115b45] text-white' : 'bg-white text-[#14304f] hover:bg-[#e8f3ee]')}>{o.label}</button>; })}
            </div></div>))}
      </div>
      {view?.chart ? (
        <div className="space-y-4" aria-live="polite">
          {view.headline && <p className="max-w-3xl font-display text-lg leading-snug text-[#14304f] sm:text-xl">{view.headline}</p>}
          <TrendChart chart={view.chart} hideControls title />
          {view.dist && <Histogram title={view.dist.title} caption={view.dist.caption} bars={view.dist.bars} refLabel={view.dist.refLabel} />}
          {view.note && <p className="text-xs text-muted-foreground">{view.note}</p>}
        </div>
      ) : <p className="rounded-xl border border-dashed bg-white/60 p-5 text-sm text-muted-foreground" aria-live="polite">{explorer.emptyText}</p>}
    </div>
  );
}
