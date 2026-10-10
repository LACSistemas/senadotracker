'use client';
import { temporalPhrase } from '@/lib/proposicoes/taxonomy';
import type { EditorialFact, PrincipalStaleness, PropositionHouse, StageFlow } from '@senadotracker/db';
import { CoverageBadge } from '@/components/metrics';
import { HOUSES, nf } from '@/lib/proposicoes/taxonomy';
import { EditorialLine } from './editorial-line';
import { housesFor, useScope } from './scope-toggle';
import { StageRiver } from './stage-river';
import { StageScatter } from './stage-scatter';
import { StalenessBars } from './staleness-bars';

const PHRASES: Record<string, string> = { instruction: 'com relatoria ou órgão registrado', agenda: 'com item de pauta', deliberation: 'com deliberação registrada', post: 'com deliberação aprovada', outcome: 'com norma resultante' };

function HousePanel({ house, flow, staleness }: { house: PropositionHouse; flow: StageFlow; staleness: PrincipalStaleness }) {
  const phrases = flow.stages.filter(stage => stage.available && PHRASES[stage.key]).map(stage => `${nf.format(stage.count ?? 0)} ${PHRASES[stage.key]}`);
  return <article className="min-w-0 rounded-3xl border bg-card p-6 card-elevated sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div><h3 className="font-display text-2xl font-medium">{HOUSES[house]}</h3><p className="mt-1 text-sm text-muted-foreground">Matérias principais {temporalPhrase(flow.temporalBasis ?? 'identifier_year', flow.year)}</p></div>
      <CoverageBadge coverage={flow.coverage} />
    </header>
    {flow.universe
      ? <>
        <p className="mt-5 max-w-3xl text-base leading-7"><strong className="hero-figure text-3xl">{nf.format(flow.universe)}</strong> <span className="text-muted-foreground">matérias principais {temporalPhrase(flow.temporalBasis ?? 'identifier_year', flow.year)}{phrases.length ? ' · ' : ''}{phrases.join(' · ')}.</span></p>
        <div className="mt-6 max-w-[880px]"><StageRiver flow={flow} /></div>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="min-w-0"><h4 className="text-sm font-bold uppercase tracking-[.12em] text-muted-foreground">Há quanto tempo sem movimentação observada</h4><div className="mt-4"><StalenessBars staleness={staleness} /></div></div>
          <div className="min-w-0"><h4 className="text-sm font-bold uppercase tracking-[.12em] text-muted-foreground">Cada ponto, uma matéria</h4><p className="mb-3 mt-1 text-xs text-muted-foreground">Passe o ponteiro para ver a matéria; clique para abri-la.</p><StageScatter staleness={staleness} /></div>
        </div>
      </>
      : <p className="mt-8 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{flow.coverage.note}</p>}
  </article>;
}

export function StageSection({ flow, staleness, facts }: { flow: Record<PropositionHouse, StageFlow>; staleness: Record<PropositionHouse, PrincipalStaleness>; facts: EditorialFact[] }) {
  const { scope, comparable } = useScope();
  const houses = housesFor(scope, comparable).flatMap(house => house === 'congresso' ? (['camara', 'senado'] as const) : [house]);
  return <section id="tramitacao" className="section-hairline border-y bg-card" style={{ ['--hairline' as string]: 'var(--group-2)' }} aria-labelledby="tramitacao-titulo">
    <div className="page-shell py-16 lg:py-20">
      <p className="eyebrow">02 · tramitação</p>
      <h2 id="tramitacao-titulo" className="prop-h2 mt-3 max-w-3xl text-4xl sm:text-5xl">Onde estão as matérias legislativas principais?</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Só as matérias principais têm um caminho de tramitação para acompanhar. Requerimentos, pareceres e emendas têm a sua própria história e ficam de fora deste retrato.</p>
      <EditorialLine facts={facts} ids={houses.length > 1 ? ['recent_movement'] : ['recent_movement', 'history_coverage']} className="mt-8" />
      <div className="mt-10 space-y-8">{houses.map(house => <HousePanel key={house} house={house} flow={flow[house]} staleness={staleness[house]} />)}</div>
      <p className="mt-6 max-w-3xl text-xs leading-5 text-muted-foreground">As etapas mostram o que foi <b>registrado</b>. Uma matéria pode ter etapas sem registro publicado, e o "rito" (urgência, prioridade) ainda não é publicado como dado estruturado. Descrever o que não foi observado não é afirmar que a matéria esteja parada.</p>
    </div>
  </section>;
}
