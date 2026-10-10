'use client';
import { temporalPhrase } from '@/lib/proposicoes/taxonomy';
import { useState } from 'react';
import type { ActivityCalendar, ActivityRhythm, PropositionHouse } from '@senadotracker/db';
import { HOUSES } from '@/lib/proposicoes/taxonomy';
import { CalendarHeatmap } from './calendar-heatmap';
import { RhythmChart } from './rhythm-chart';
import { housesFor, useScope } from './scope-toggle';
import { Segmented } from './segmented';

export function RhythmSection({ rhythm, calendar }: { rhythm: { presented: ActivityRhythm; events: ActivityRhythm }; calendar: Record<PropositionHouse, ActivityCalendar> }) {
  const { scope, comparable } = useScope();
  const [mode, setMode] = useState<'presented' | 'events'>('presented');
  const houses = housesFor(scope, comparable).flatMap(house => house === 'congresso' ? (['camara', 'senado'] as const) : [house]);
  const data = rhythm[mode], year = data.year;
  return <section id="ritmo" className="section-hairline border-y bg-card" style={{ ['--hairline' as string]: 'var(--group-4)' }} aria-labelledby="ritmo-titulo">
    <div className="page-shell py-16 lg:py-20">
      <p className="eyebrow">04 · ritmo</p>
      <h2 id="ritmo-titulo" className="prop-h2 mt-3 max-w-3xl text-4xl sm:text-5xl">O ritmo do Legislativo</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Quando as coisas acontecem. As colunas mostram o mês; cada cor é a função da proposição. Alterne entre o que foi apresentado e o que foi registrado na tramitação.</p>
      <div className="mt-8"><Segmented label="O que mostrar" value={mode} onChange={setMode} options={[{ value: 'presented', label: 'Novas proposições' }, { value: 'events', label: 'Eventos de tramitação' }]} /></div>
      <div className="mt-8 space-y-8">
        {houses.map(house => <article key={`${mode}-${house}`} className="min-w-0 rounded-3xl border bg-background p-6 sm:p-8">
          <h3 className="font-display text-2xl font-medium">{HOUSES[house]}</h3>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{mode === 'presented' ? `Proposições ${temporalPhrase(data.temporalBasis ?? 'identifier_year', year)}, por mês de apresentação` : `Registros de tramitação coletados, por mês de ocorrência, ${year}`}</p>
          <div className="max-w-[920px]"><RhythmChart rhythm={data.houses[house]} year={year} mode={mode} /></div>
        </article>)}
      </div>
      <div className="mt-14">
        <h3 className="prop-h2 text-3xl">Um calendário do que foi registrado</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Cada quadrado é um dia. Clique em um dia com registros para ver o que aconteceu nele. Dias fora da cobertura publicada aparecem apagados: não são dias sem atividade, são dias sem dado.</p>
        <div className="mt-6 space-y-8">
          {houses.map(house => <article key={house} className="min-w-0 rounded-3xl border bg-background p-6 sm:p-8"><h4 className="font-display text-xl font-medium">{HOUSES[house]} · {calendar[house].year}</h4><div className="mt-4"><CalendarHeatmap calendar={calendar[house]} /></div></article>)}
        </div>
      </div>
    </div>
  </section>;
}
