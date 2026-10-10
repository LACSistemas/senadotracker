'use client';
import { useMemo, useState } from 'react';
import type { EditorialFact, FunctionalOverview } from '@senadotracker/db';
import { CoverageBadge } from '@/components/metrics';
import { HOUSES, formatDate, nf, temporalPhrase } from '@/lib/proposicoes/taxonomy';
import { composeEntries } from '@/lib/proposicoes/composition';
import { AnimatedBarStrip, type StripSegment } from './animated-bar-strip';
import { FunctionalGroupLegend } from './functional-group-legend';
import { EditorialLine } from './editorial-line';
import { housesFor, useScope } from './scope-toggle';
import { StatFigure } from './stat-figure';

function HousePanel({ overview, house, compact }: { overview: FunctionalOverview; house: 'congresso' | 'camara' | 'senado'; compact: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const view = house === 'congresso' ? null : overview.houses[house];
  const groups = house === 'congresso' ? overview.congress.groups ?? [] : view?.groups ?? [];
  const total = house === 'congresso' ? overview.congress.total ?? 0 : view?.total ?? 0;
  const entries = useMemo(() => composeEntries(groups, total), [groups, total]);
  const segments: StripSegment[] = entries.map(entry => ({ key: entry.key, label: entry.label, value: entry.count, share: entry.share, color: entry.color, ...(entry.children ? { note: entry.children.map(child => child.verb).join(' · ') } : {}) }));
  const title = house === 'congresso' ? 'Congresso Nacional' : HOUSES[house];
  return <article className="min-w-0 rounded-3xl border bg-card p-6 card-elevated sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div>
        <h3 className="font-display text-2xl font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{view ? (view.partial ? 'Recorte publicado: matérias de autoria dos parlamentares em exercício' : `Proposições ${temporalPhrase(overview.temporalBasis ?? 'presented_at', overview.year)}, por função`) : `Câmara e Senado somados · proposições ${temporalPhrase(overview.temporalBasis ?? 'presented_at', overview.year)}`}</p>
        {view ? <div className="mt-2"><CoverageBadge coverage={view.coverage} /></div> : null}
      </div>
    </header>
    {total > 0
      ? <>
        <div className={compact ? 'mt-6' : 'mt-6 grid items-end gap-6 sm:grid-cols-[minmax(0,14rem)_1fr]'}>
          <StatFigure label="proposições registradas" value={total} note={view ? `Publicação de ${formatDate(view.publishedAt)}` : overview.congress.reason} size={compact ? 'lg' : 'xl'} />
        </div>
        <div className="mt-8">
          <AnimatedBarStrip size="lg" segments={segments} selectedKey={selected} onSelect={setSelected} ariaLabel={`Composição das ${nf.format(total)} proposições de ${title} em ${overview.year}, por função`} tableCaption={`Proposições de ${title} por grupo funcional em ${overview.year}`} valueHeader="Proposições" />
        </div>
        <div className="mt-6"><FunctionalGroupLegend entries={entries} selectedKey={selected} onSelect={setSelected} compact={compact} /></div>
      </>
      : <div className="mt-8 rounded-2xl border border-dashed p-8 text-center"><p className="font-bold">Sem proposições publicadas para {overview.year}</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{view?.coverage.note ?? 'Nenhum dado publicado para este recorte.'} Escolha outro ano para ver a composição.</p></div>}
  </article>;
}

export function CompositionSection({ overview, facts }: { overview: FunctionalOverview; facts: EditorialFact[] }) {
  const { scope, comparable } = useScope();
  const houses = housesFor(scope, comparable);
  return <section id="composicao" className="section-hairline bg-background" style={{ ['--hairline' as string]: 'var(--group-1)' }} aria-labelledby="composicao-titulo">
    <div className="page-shell py-16 lg:py-20">
      <p className="eyebrow">01 · composição</p>
      <h2 id="composicao-titulo" className="prop-h2 mt-3 max-w-3xl text-4xl sm:text-5xl">O Congresso está fazendo o quê?</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Proposição é mais do que projeto de lei. A faixa abaixo mostra o que foi registrado, do pedido ao parecer, agrupado pela função de cada tipo, e não pela sigla.</p>
      <EditorialLine facts={facts} ids={['group_share']} className="mt-8" />
      <div className={houses.length > 1 ? 'mt-10 grid gap-8 lg:grid-cols-2' : 'mt-10'}>{houses.map(house => <HousePanel key={house} overview={overview} house={house} compact={houses.length > 1} />)}</div>
      {scope === 'congresso' && !comparable ? <p className="mt-6 max-w-3xl text-sm leading-6 text-muted-foreground"><b className="text-foreground">Por que não somamos?</b> {overview.congress.reason} A comparação é descritiva e não aponta vencedores nem produtividade.</p> : null}
    </div>
  </section>;
}
