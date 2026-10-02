import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { OperationalBundle } from '@/lib/proposicoes/compose-types';
import { composeEntries } from '@/lib/proposicoes/composition';
import { nf, pf, typeName } from '@/lib/proposicoes/taxonomy';
import { AnimatedBarStrip } from './animated-bar-strip';
import { GroupChips } from './mini-strip';
import { Reveal } from './reveal';
import { StatFigure } from './stat-figure';

const EVENT_NAMES: Record<string, string> = { movement: 'Movimentação', vote_effect: 'Efeito de votação', agenda_item: 'Registro em pauta', situation: 'Situação publicada', document: 'Documento', proposal_detail: 'Detalhe da proposição' };

/**
 * O caso excepcional e didático: uma medida provisória e o universo de objetos que se formou ao redor dela. A faixa
 * agrupa por função (ordem e cores fixas do sistema) e a lista abaixo abre as siglas.
 */
export function CaseSection({ relation, href }: { relation: OperationalBundle['relation']; href: string }) {
  const total = relation.relatedCount;
  if (!total) return null;
  const label = relation.parentLabel ?? 'esta matéria';
  const entries = composeEntries(relation.countByGroup.map((item: any) => ({ group: item.group, count: item.count, share: item.count / total, topTypes: [] })), total);
  const types = [...relation.countByType].sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  const lead = types[0]!;
  return <section id="caso" className="section-hairline border-y bg-card" style={{ ['--hairline' as string]: 'var(--group-6)' }} aria-labelledby="caso-titulo">
    <div className="page-shell py-16 lg:py-20">
      <p className="eyebrow">06 · caso excepcional</p>
      <h2 id="caso-titulo" className="prop-h2 mt-3 max-w-4xl text-4xl sm:text-5xl">Ao redor da {label}, a Cívica identifica {nf.format(total)} proposições relacionadas.</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Este é um caso didático e excepcional. São objetos relacionados à matéria principal, não uma afirmação de que ela gerou todos esses atos.</p>
      <Reveal className="mt-10 grid items-end gap-8 lg:grid-cols-[minmax(0,16rem)_1fr]">
        <StatFigure label={`${lead.type} · ${typeName(lead.type) ?? 'sigla publicada'}`} value={lead.count / total} kind="percent" size="xl" note={`${nf.format(lead.count)} de ${nf.format(total)} objetos relacionados`} />
        <div>
          <AnimatedBarStrip size="lg" segments={entries.map(entry => ({ key: entry.key, label: entry.label, value: entry.count, share: entry.share, color: entry.color }))} ariaLabel={`Objetos relacionados a ${label}, por função`} tableCaption={`Objetos relacionados a ${label} por grupo funcional`} valueHeader="Objetos" />
          <div className="mt-4"><GroupChips entries={entries} /></div>
        </div>
      </Reveal>
      <p className="mt-8 max-w-2xl text-sm font-semibold text-primary">A maior parte dessa rede é formada por {typeName(lead.type)?.toLocaleLowerCase('pt-BR') ?? lead.type}; os demais tipos aparecem em uma cauda bem menor.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{types.slice(0, 8).map((item: any) => <li key={item.type} className="rounded-2xl border bg-background p-4">
        <p className="hero-figure text-2xl">{nf.format(item.count)}</p><p className="mt-1 font-bold">{item.type}</p><p className="text-xs text-muted-foreground">{typeName(item.type) ?? 'sigla publicada'} · {pf.format(item.count / total)}</p></li>)}</ul>
      {relation.events.length ? <div className="mt-10 border-t pt-6"><h3 className="font-bold">Eventos observados nesta matéria</h3>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">{relation.events.slice(0, 6).map((event: any) => <span key={event.kind}><b className="tabular-nums text-foreground">{nf.format(event.count)}</b> {EVENT_NAMES[event.kind] ?? event.kind}</span>)}</p></div> : null}
      <Link className="focus-ring mt-8 inline-flex items-center gap-2 font-bold text-primary underline underline-offset-4" href={href}>Abrir {label} <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
  </section>;
}



