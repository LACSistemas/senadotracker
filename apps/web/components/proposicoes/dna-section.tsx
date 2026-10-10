'use client';
import { useMemo, useState } from 'react';
import type { ActivityDna, DnaRow, PropositionHouse } from '@senadotracker/db';
import { PartyLogo } from '@/components/party-logo';
import { entriesFromCounts } from '@/lib/proposicoes/composition';
import { nf } from '@/lib/proposicoes/taxonomy';
import { AnimatedBarStrip } from './animated-bar-strip';
import { GroupChips, MiniStrip } from './mini-strip';
import { housesFor, useScope } from './scope-toggle';
import { Segmented } from './segmented';

const PAGE = 40;
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LEGEND = entriesFromCounts([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
const WHO: Record<PropositionHouse, { plural: string; person: string }> = { camara: { plural: 'Deputados', person: 'deputados' }, senado: { plural: 'Senadores', person: 'senadores' } };

function Row({ row, dimension }: { row: DnaRow; dimension: 'party' | 'member' }) {
  const entries = useMemo(() => entriesFromCounts(row.counts), [row.counts]);
  return <li className="border-b py-3 last:border-0">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {dimension === 'party' ? <PartyLogo party={row.name} size={24} /> : null}
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{row.name}</p>{dimension === 'member' ? <p className="text-xs text-muted-foreground">{row.party}{row.uf ? `/${row.uf}` : ''}</p> : null}</div>
      </div>
      <p className="shrink-0 text-right text-sm"><b className="tabular-nums">{nf.format(row.distinctProposals)}</b> <span className="text-xs text-muted-foreground">proposições distintas</span></p>
    </div>
    <div className="mt-2"><MiniStrip entries={entries} total={row.distinctProposals} subject={row.name} /></div>
    <p className="mt-1.5 text-xs text-muted-foreground">
      {row.primaryAuthored === null ? <>autoria principal e coautoria: <i>sem dado publicado</i></> : <>autoria principal <b className="tabular-nums text-foreground">{nf.format(row.primaryAuthored)}</b> · coautoria <b className="tabular-nums text-foreground">{nf.format(row.coauthored ?? 0)}</b></>}
      {' · '}vínculos <b className="tabular-nums text-foreground">{nf.format(row.links)}</b>
    </p>
  </li>;
}

function HouseColumn({ house, data, member, dimension }: { house: PropositionHouse; data: ActivityDna; member: ActivityDna; dimension: 'party' | 'member' }) {
  const [query, setQuery] = useState(''), [shown, setShown] = useState(PAGE);
  const rows = data.rows.filter(row => row.source === house), needle = fold(query.trim());
  const filtered = needle ? rows.filter(row => fold(`${row.name} ${row.party ?? ''}`).includes(needle)) : rows;
  const median = member.medians[house], medianEntries = median ? entriesFromCounts(median.shares) : [];
  const who = WHO[house];
  return <article className="min-w-0 rounded-3xl border bg-card p-6 card-elevated sm:p-8">
    <h3 className="font-display text-2xl font-medium">{who.plural}</h3>
    {median && medianEntries.length
      ? <div className="mt-5"><p className="text-sm font-semibold">{who.plural}, em mediana, distribuem a atividade assim <span className="font-normal text-muted-foreground">({nf.format(median.members)} {who.person})</span></p>
        <AnimatedBarStrip className="mt-3" size="md" segments={medianEntries.map(entry => ({ key: entry.key, label: entry.label, value: entry.share, share: entry.share, color: entry.color }))} formatValue={value => `${Math.round(value * 1000) / 10}%`.replace('.', ',')} valueHeader="Mediana da participação" ariaLabel={`Mediana da distribuição da atividade de ${who.person} entre os grupos funcionais`} tableCaption={`Mediana da participação de cada grupo na atividade de ${who.person}`} />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Mediana de cada grupo entre os {who.person} incluídos, reescalada só para caber na faixa; os valores exatos estão em "Ver dados do gráfico".</p></div>
      : null}
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
      <label className="flex-1 text-sm font-semibold text-muted-foreground"><span className="sr-only">Buscar {dimension === 'party' ? 'partido' : 'parlamentar'}</span>
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setShown(PAGE); }} placeholder={dimension === 'party' ? 'Buscar partido' : 'Buscar parlamentar ou partido'} className="focus-ring w-full min-w-[12rem] rounded-full border bg-background px-4 py-2 text-sm font-normal" /></label>
      <p className="text-xs text-muted-foreground">{nf.format(filtered.length)} {dimension === 'party' ? 'partidos' : who.person} · ordem alfabética</p>
    </div>
    {filtered.length
      ? <ul className="mt-2 max-h-[38rem] overflow-y-auto pr-1" aria-label={`Distribuição da atividade por ${dimension === 'party' ? 'partido' : 'parlamentar'}, ${who.person}`}>{filtered.slice(0, shown).map(row => <Row key={row.key} row={row} dimension={dimension} />)}
        {filtered.length > shown ? <li className="pt-3"><button type="button" onClick={() => setShown(value => value + PAGE)} className="focus-ring rounded-full border px-4 py-1.5 text-sm font-bold text-primary">Mostrar mais {Math.min(PAGE, filtered.length - shown)}</button></li> : null}</ul>
      : <p className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{rows.length ? 'Nenhum resultado para essa busca.' : `Sem autorias com partido publicadas para ${data.year}.`}</p>}
    <p className="mt-4 text-xs leading-5 text-muted-foreground">
      {data.primaryPublished[house] ? null : <>Neste lote a {house === 'camara' ? 'Câmara' : 'Casa'} não publica quem é o autor principal, então autoria principal e coautoria ficam <b>sem dado publicado</b>. </>}
      {dimension === 'member' && data.excludedMembers[house] ? <>{nf.format(data.excludedMembers[house])} {who.person} com menos de {data.minProposals} proposições distintas ficam fora, para não distorcer proporções. </> : null}
    </p>
  </article>;
}

export function DnaSection({ party, member }: { party: ActivityDna; member: ActivityDna }) {
  const { scope, comparable } = useScope();
  const [dimension, setDimension] = useState<'party' | 'member'>('party');
  const houses = housesFor(scope, comparable).flatMap(house => house === 'congresso' ? (['camara', 'senado'] as const) : [house]);
  const data = dimension === 'party' ? party : member;
  return <section id="dna" className="section-hairline bg-background" style={{ ['--hairline' as string]: 'var(--group-3)' }} aria-labelledby="dna-titulo">
    <div className="page-shell py-16 lg:py-20">
      <p className="eyebrow">03 · DNA da atividade</p>
      <h2 id="dna-titulo" className="prop-h2 mt-3 max-w-3xl text-4xl sm:text-5xl">Quem está fazendo o quê?</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Cada faixa mostra como um partido ou parlamentar distribui a autoria entre as funções. É um retrato de composição, não uma classificação: nenhuma ordem aqui indica mais ou menos trabalho.</p>
      <div className="mt-8 flex flex-wrap items-center gap-4"><Segmented label="Ver por" value={dimension} onChange={setDimension} options={[{ value: 'party', label: 'Partido' }, { value: 'member', label: 'Parlamentar' }]} /><GroupChips entries={LEGEND} /></div>
      <dl className="mt-6 grid max-w-4xl gap-x-8 gap-y-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
        <div><dt className="inline font-bold text-foreground">Proposições distintas: </dt><dd className="inline">quantas proposições diferentes têm ao menos um autor do {dimension === 'party' ? 'partido' : 'parlamentar'}.</dd></div>
        <div><dt className="inline font-bold text-foreground">Vínculos: </dt><dd className="inline">autorias individuais; uma proposição com três deputados do mesmo partido gera três vínculos.</dd></div>
        <div><dt className="inline font-bold text-foreground">Autoria principal: </dt><dd className="inline">proposições em que aparece como autor principal, quando a Casa publica essa marca.</dd></div>
        <div><dt className="inline font-bold text-foreground">Coautoria: </dt><dd className="inline">proposições em que aparece apenas como coautor.</dd></div>
      </dl>
      <div className={houses.length > 1 ? 'mt-8 grid gap-8 lg:grid-cols-2' : 'mt-8'}>{houses.map(house => <HouseColumn key={`${dimension}-${house}`} house={house} data={data} member={member} dimension={dimension} />)}</div>
      <p className="mt-6 max-w-3xl text-xs leading-5 text-muted-foreground">{data.coverage.note}</p>
    </div>
  </section>;
}
