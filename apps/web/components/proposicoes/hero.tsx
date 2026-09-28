'use client';
import type { EditorialFact, FunctionalOverview } from '@senadotracker/db';
import { GROUPS, HOUSES, OTHER_COLOR, OTHER_LABEL, SCOPE_LABEL, formatDate, nf, pf } from '@/lib/proposicoes/taxonomy';
import { AnimatedBarStrip } from './animated-bar-strip';
import { HeroSentence } from './editorial-line';
import { housesFor, useScope } from './scope-toggle';

const PRINCIPAL = GROUPS[0]!;

/** Micro-faixa da abertura: quanto do registrado é proposição legislativa principal e quanto são as outras formas. */
function SplitStrip({ house, overview }: { house: 'congresso' | 'camara' | 'senado'; overview: FunctionalOverview }) {
  const view = house === 'congresso' ? null : overview.houses[house];
  const groups = house === 'congresso' ? overview.congress.groups ?? [] : view?.groups ?? [];
  const total = house === 'congresso' ? overview.congress.total ?? 0 : view?.total ?? 0;
  const principal = groups.find(group => group.group === PRINCIPAL.key)?.count ?? 0;
  if (!total) return <div><p className="text-sm font-semibold">{house === 'congresso' ? 'Congresso' : HOUSES[house]}</p><p className="mt-1 text-sm text-muted-foreground">Sem proposições publicadas para {overview.year}.</p></div>;
  const share = principal / total, name = house === 'congresso' ? 'Congresso Nacional' : HOUSES[house];
  return <div className="min-w-0">
    <p className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm font-semibold"><span>{name}</span><span className="text-xs font-normal text-muted-foreground">{nf.format(total)} proposições em {overview.year}</span></p>
    <AnimatedBarStrip className="mt-2" size="md" showTable={false} inlineLabels segments={[
      { key: 'principais', label: PRINCIPAL.label, value: principal, share, color: PRINCIPAL.color },
      { key: 'outras', label: OTHER_LABEL, value: total - principal, share: 1 - share, color: OTHER_COLOR },
    ]} ariaLabel={`${pf.format(share)} das proposições de ${name} são proposições legislativas principais e ${pf.format(1 - share)} são outras formas`} tableCaption="Principais e outras formas" />
    <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: PRINCIPAL.color }} />Proposições legislativas principais <b className="tabular-nums text-foreground">{pf.format(share)}</b></span>
      <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: OTHER_COLOR }} />{OTHER_LABEL} <b className="tabular-nums text-foreground">{pf.format(1 - share)}</b></span>
    </p>
  </div>;
}

export function Hero({ facts, overview }: { facts: EditorialFact[]; overview: FunctionalOverview }) {
  const { scope, comparable } = useScope();
  const houses = housesFor(scope, comparable);
  return <header className="hero-wash relative overflow-hidden border-b">
    <div className="surface-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
    <div className="page-shell relative py-14 sm:py-20 lg:py-24">
      <p className="eyebrow">Atividade legislativa · {SCOPE_LABEL[scope]} · {overview.year}</p>
      <h1 className="prop-thesis mt-5 max-w-5xl text-[clamp(2.3rem,5.8vw,5rem)]"><HeroSentence facts={facts} /></h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Projeto de lei é só uma parte do que o Legislativo registra. Proposições também são requerimentos, pareceres, emendas e instrumentos de tramitação. Esta página mostra a composição publicada e os rastros observáveis, sem transformar registros diferentes em um funil.</p>
      <div className={`mt-10 grid gap-8 ${houses.length > 1 ? 'md:grid-cols-2' : 'max-w-3xl'}`}>{houses.map(house => <SplitStrip key={house} house={house} overview={overview} />)}</div>
      <p className="mt-8 max-w-3xl text-xs leading-5 text-muted-foreground">
        {houses.includes('camara') || houses.includes('congresso') ? (overview.houses.camara?.total ? `Câmara: ${overview.houses.camara.coverage.note} ` : '') : ''}
        {houses.includes('senado') || houses.includes('congresso') ? (overview.houses.senado?.total ? `Senado: ${overview.houses.senado.coverage.note} ` : '') : ''}
        Atualizado em {formatDate(overview.updatedThrough)}.
      </p>
    </div>
  </header>;
}
