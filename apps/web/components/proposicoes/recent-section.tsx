'use client';
import Link from 'next/link';
import { FilePenLine, FilePlus2, Gavel, Landmark, Milestone, ScrollText, type LucideIcon } from 'lucide-react';
import type { PropositionHouse, RecentEventType, RecentEvents } from '@senadotracker/db';
import { HOUSES, formatDate, nf } from '@/lib/proposicoes/taxonomy';
import { Reveal } from './reveal';
import { housesFor, useScope } from './scope-toggle';

const TYPES: Record<RecentEventType, { label: string; hint: string; Icon: LucideIcon }> = {
  new_principal: { label: 'Nova matéria principal', hint: 'apresentada na janela', Icon: FilePlus2 },
  stage_change: { label: 'Mudança de estágio', hint: 'nova situação ou item de pauta', Icon: Milestone },
  text_change: { label: 'Alteração de texto', hint: 'substitutivo apresentado', Icon: FilePenLine },
  decision: { label: 'Decisão', hint: 'deliberação ou efeito de votação', Icon: Gavel },
  new_norm: { label: 'Nova norma', hint: 'norma resultante registrada', Icon: ScrollText },
  institutional: { label: 'Comunicação institucional', hint: 'mensagem apresentada', Icon: Landmark },
};
const ORDER: RecentEventType[] = ['new_principal', 'stage_change', 'text_change', 'decision', 'new_norm', 'institutional'];

function HouseEvents({ house, recent }: { house: PropositionHouse; recent: RecentEvents }) {
  const range = recent.windowFrom && recent.windowTo ? `${formatDate(recent.windowFrom)} a ${formatDate(recent.windowTo)}` : null;
  return <div>
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"><h3 className="font-display text-2xl font-medium">{HOUSES[house]}</h3>
      <p className="text-sm text-muted-foreground">{range ? `Janela de ${recent.days} dias: ${range}` : 'Sem registros datados publicados'}</p></div>
    {range ? <div className="-mx-[14px] mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[14px] pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
      {ORDER.map((type, index) => {
        const entry = recent.types.find(item => item.type === type)!, { label, hint, Icon } = TYPES[type];
        return <Reveal as="article" key={type} delay={index * 60} className="card-lift min-w-[17rem] shrink-0 snap-start rounded-2xl border bg-card p-5 sm:min-w-0">
          <div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><Icon size={19} aria-hidden="true" /></span>
            <p className="hero-figure text-3xl" aria-label={`${nf.format(entry.total)} registros`}>{nf.format(entry.total)}</p></div>
          <h4 className="mt-3 font-bold">{label}</h4><p className="text-xs text-muted-foreground">{hint}</p>
          {entry.items.length
            ? <ul className="mt-4 space-y-3">{entry.items.slice(0, 3).map(item => <li key={item.proposalId} className="border-t pt-3 first:border-0 first:pt-0">
              <Link href={`/legislativo/proposicoes/${item.source}/${encodeURIComponent(item.proposalId)}`} className="focus-ring text-sm font-bold text-primary underline decoration-primary/30 underline-offset-4">{item.label}</Link>
              {item.summary ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</p> : null}
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatDate(item.date)}</p>{item.detail ? <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}</li>)}</ul>
            : <p className="mt-4 text-sm text-muted-foreground">Nenhum registro publicado na janela.</p>}
          {entry.total > 3 ? <p className="mt-3 text-xs text-muted-foreground">e mais {nf.format(entry.total - 3)} na janela</p> : null}
        </Reveal>;
      })}
    </div> : <p className="mt-5 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{recent.coverage.note}</p>}
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{recent.coverage.note}</p>
  </div>;
}

export function RecentSection({ recent }: { recent: Record<PropositionHouse, RecentEvents> }) {
  const { scope, comparable } = useScope();
  const houses = housesFor(scope, comparable).flatMap(house => house === 'congresso' ? (['camara', 'senado'] as const) : [house]);
  return <section id="recente" className="section-hairline bg-background" style={{ ['--hairline' as string]: 'var(--group-5)' }} aria-labelledby="recente-titulo">
    <div className="page-shell py-16 lg:py-20">
      <p className="eyebrow">05 · agora</p>
      <h2 id="recente-titulo" className="prop-h2 mt-3 max-w-3xl text-4xl sm:text-5xl">O que acabou de mudar?</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Eventos tipados dos últimos dias publicados: uma matéria nova, uma mudança de estágio, um substitutivo, uma decisão, uma norma. Não é a lista dos últimos cadastros.</p>
      <div className="mt-10 space-y-14">{houses.map(house => <HouseEvents key={house} house={house} recent={recent[house]} />)}</div>
    </div>
  </section>;
}
