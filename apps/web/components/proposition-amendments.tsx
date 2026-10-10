import Link from 'next/link';
import type { AmendmentGraph, AmendmentItem } from '../../../packages/db/src/postgres-proposition-graph.ts';
import { formatDate, groupMeta, nf, typeName } from '@/lib/proposicoes/taxonomy';

type Detail = any;
const meta = groupMeta('emendas_substitutivos');

const authorsLine = (authors: AmendmentItem['authors']) => {
  if (!authors.length) return 'Autoria não publicada';
  const shown = authors.slice(0, 2).map(a => a.party ? `${a.name} (${a.party}${a.uf ? `/${a.uf}` : ''})` : a.name).join(', ');
  return authors.length > 2 ? `${shown} e mais ${authors.length - 2}` : shown;
};

/** Ligação por apensação só é afirmada quando a matéria citada existe na base e aponta para esta principal. */
function Evidence({ item, parentLabel }: { item: AmendmentItem; parentLabel: string }) {
  const evidence = item.relation.evidence; if (!evidence) return null;
  return <p className="mt-1 text-xs text-muted-foreground">{evidence.status === 'confirmada'
    ? <>Atua sobre o {evidence.citedLabel}, apensado a {parentLabel}.</>
    : <>A ementa cita o {evidence.citedLabel}; a principal oficial da tramitação é {parentLabel}.</>}</p>;
}

function Row({ item, parentLabel, nested = false }: { item: AmendmentItem; parentLabel: string; nested?: boolean }) {
  return <li className={`rounded-xl border bg-card ${nested ? 'p-3' : 'p-4'}`}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-md px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: meta.color }} title={typeName(item.type) ?? 'sigla publicada'}>{item.type}</span>
        <Link className="focus-ring font-bold text-primary underline decoration-primary/30 underline-offset-4" href={item.href}>{item.label}</Link>
      </p>
      <span className="text-xs tabular-nums text-muted-foreground">{item.presentedAt ? formatDate(item.presentedAt) : 'Data não publicada'}</span>
    </div>
    <p className="mt-2 line-clamp-2 text-sm leading-relaxed">{item.summary ?? <span className="text-muted-foreground">Ementa não publicada.</span>}</p>
    <p className="mt-1 text-xs text-muted-foreground">{authorsLine(item.authors)} · ID {item.id}</p>
    <Evidence item={item} parentLabel={parentLabel} />
    {item.childrenTotal ? <details className="mt-3">
      <summary className="focus-ring w-fit cursor-pointer text-xs font-bold text-primary">{nf.format(item.childrenTotal)} {item.childrenTotal === 1 ? 'emenda atua' : 'emendas atuam'} sobre {item.label}</summary>
      <ul className="mt-2 space-y-2 border-l-2 border-primary/25 pl-4">{item.children.map(child => <Row key={child.id} item={child} parentLabel={item.label} nested />)}</ul>
      {item.childrenTotal > item.children.length ? <p className="mt-2 text-xs text-muted-foreground">Mostrando {item.children.length} de {item.childrenTotal}.</p> : null}
    </details> : null}
  </li>;
}

/**
 * Emendas e substitutivos oficialmente ligados à matéria (pai → filhos por `principal_id`). Reaproveita o vocabulário visual do
 * grupo "Emendas e substitutivos" e a paginação por Link do /explorar; o volume (até centenas) fica na paginação, não no HTML.
 */
export function AmendmentsSection({ item }: { item: Detail }) {
  const graph: AmendmentGraph | null = item.amendmentGraph ?? null; if (!graph) return null;
  const base = `/legislativo/proposicoes/${item.proposal.source}/${encodeURIComponent(item.proposal.externalId)}`;
  const href = (type: string | null, page = 1) => { const q = new URLSearchParams(); if (type) q.set('emendas', type); if (page > 1) q.set('pagina_emendas', String(page)); const text = q.toString(); return `${base}${text ? `?${text}` : ''}#emendas`; };
  const parentLabel = String(item.proposal.label);
  const filteredTotal = graph.typeFilter ? graph.bySigla.find(s => s.type === graph.typeFilter)?.count ?? 0 : graph.total;
  const from = (graph.page - 1) * graph.pageSize + 1, to = Math.min(filteredTotal, graph.page * graph.pageSize);
  return <section id="emendas" aria-labelledby="emendas-titulo" className="scroll-mt-24">
    <h2 id="emendas-titulo" className="prop-h2 text-3xl sm:text-4xl">Emendas e substitutivos ligados a esta matéria</h2>
    <p className="mt-2 max-w-3xl text-muted-foreground">{nf.format(graph.total)} {graph.total === 1 ? 'proposição está oficialmente ligada' : 'proposições estão oficialmente ligadas'} a {parentLabel} como matéria principal. A ligação indica a tramitação à qual pertencem; não significa que cada uma altere diretamente o texto original.</p>
    {graph.bySigla.length > 1 || graph.typeFilter ? <nav aria-label="Filtrar por sigla" className="mt-5"><ul className="flex flex-wrap gap-2">
      <li><Link href={href(null)} aria-current={graph.typeFilter ? undefined : 'true'} className={`focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted ${graph.typeFilter ? '' : 'bg-muted ring-1 ring-primary/40'}`}>Todas<span className="tabular-nums text-muted-foreground">{nf.format(graph.total)}</span></Link></li>
      {graph.bySigla.map(entry => <li key={entry.type}><Link href={href(entry.type)} aria-current={graph.typeFilter === entry.type ? 'true' : undefined} title={typeName(entry.type) ?? 'sigla publicada'} className={`focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted ${graph.typeFilter === entry.type ? 'bg-muted ring-1 ring-primary/40' : ''}`}><i className="size-2.5 rounded-sm" style={{ background: meta.color }} aria-hidden="true" />{entry.type}<span className="tabular-nums text-muted-foreground">{nf.format(entry.count)}</span></Link></li>)}
    </ul></nav> : null}
    <ul className="mt-6 space-y-3">{graph.items.map(entry => <Row key={entry.id} item={entry} parentLabel={parentLabel} />)}</ul>
    <p className="mt-4 text-sm text-muted-foreground">Mostrando {nf.format(from)}–{nf.format(to)} de {nf.format(filteredTotal)}{graph.typeFilter ? ` (${graph.typeFilter})` : ''}.</p>
    {graph.pageCount > 1 ? <nav className="mt-4 flex items-center justify-between gap-4" aria-label="Paginação das emendas">
      {graph.page > 1 ? <Link className="focus-ring rounded-full border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-muted" href={href(graph.typeFilter, graph.page - 1)}>← Anterior</Link> : <span className="rounded-full border px-4 py-2 text-sm font-bold text-muted-foreground/60" aria-disabled="true">← Anterior</span>}
      <span className="text-sm text-muted-foreground">Página {graph.page} de {graph.pageCount}</span>
      {graph.page < graph.pageCount ? <Link className="focus-ring rounded-full border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-muted" href={href(graph.typeFilter, graph.page + 1)}>Próxima →</Link> : <span className="rounded-full border px-4 py-2 text-sm font-bold text-muted-foreground/60" aria-disabled="true">Próxima →</span>}
    </nav> : null}
  </section>;
}
