import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Flag } from 'lucide-react';
import type { Source } from '@senadotracker/domain';
import { propositionDetail, propositionObservedState } from '@/lib/data';
import { formatDate, nf, stageLabel } from '@/lib/proposicoes/taxonomy';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { EmptyState } from '@/components/empty-state';
import { ProposalStory } from '@/components/proposition-story';

export const dynamic = 'force-dynamic';
const house = (source: Source) => source === 'senado' ? 'Senado Federal' : 'Câmara dos Deputados';
const day = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'data não informada';
const humanType: Record<string, string> = { PL: 'Projeto de lei', PEC: 'Proposta de emenda à Constituição', RIC: 'Requerimento de informação', REQ: 'Requerimento', EMC: 'Emenda', SBT: 'Substitutivo', PRL: 'Parecer do relator', PAR: 'Parecer da comissão', DTQ: 'Destaque', INC: 'Indicação', SUG: 'Sugestão', DOC: 'Documento', OF: 'Ofício', REC: 'Recurso' };

export async function generateMetadata({ params }: { params: Promise<{ source: string; id: string }> }): Promise<Metadata> {
  const route = await params;
  if (!['senado', 'camara'].includes(route.source)) return { title: 'Proposição' };
  const result = await propositionDetail(route.source as Source, decodeURIComponent(route.id));
  const proposal = result.status === 'available' ? (result.data as { proposal?: { label?: string; summary?: string | null } } | null)?.proposal : null;
  return { title: proposal?.label ?? 'Proposição', ...(proposal?.summary ? { description: proposal.summary.slice(0, 200) } : {}) };
}

export default async function PropositionPage({ params }: { params: Promise<{ source: string; id: string }> }) {
  const route = await params;
  if (!['senado', 'camara'].includes(route.source)) notFound();
  const source = route.source as Source, id = decodeURIComponent(route.id);
  const result = await propositionDetail(source, id);
  if (result.status === 'unavailable') return <><LegislativeSubnav /><main className="page-shell py-12"><EmptyState title="Proposição indisponível" description={result.message} /></main></>;
  if (!result.data) notFound();
  const item = result.data as any;
  const proposal = item.proposal;
  const observedResult = await propositionObservedState(source, id), observed = observedResult.status === 'available' ? observedResult.data : null;
  const typeLabel = humanType[proposal.type] ?? proposal.type;
  const code = `${proposal.type} ${proposal.number ?? ''}${proposal.year ? `/${proposal.year}` : ''}`.trim();
  const rawTitle = String(proposal.summary ?? proposal.label);
  const normalizedTitle = rawTitle.replace(/\bSr\.\s+(?=Ministro)/gi, '').replace(/\bSra\.\s+(?=Ministra)/gi, '');
  const firstSentence = normalizedTitle.match(/^.*?(?:[!?]|\.(?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]))(?:\s|$)/)?.[0]?.trim() ?? normalizedTitle;
  const headline = /^(PRL|PAR|PARF|PPP|PEP|PES|PPR|CVO)/i.test(proposal.type) ? rawTitle.replace(/,?\s*Dep\..*?(?=, pela| pela|$)/i, '').replace(/\s*·.*$/, '').trim() : firstSentence;
  const title = headline || code;
  // Ementas longas em corpo gigante ocupam a tela inteira: o tamanho acompanha o comprimento.
  const titleSize = title.length <= 80 ? 'text-[clamp(2rem,4.6vw,3.9rem)]' : title.length <= 160 ? 'text-[clamp(1.8rem,3.5vw,2.9rem)]' : 'text-[clamp(1.55rem,2.7vw,2.25rem)]';
  return <><LegislativeSubnav /><main id="conteudo" tabIndex={-1} className="page-shell py-8">
    <Link href="/legislativo/proposicoes" className="focus-ring mb-6 inline-flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={16} aria-hidden="true" />Voltar às proposições</Link>
    <header className="border-b pb-10">
      <p className="eyebrow">{house(source)} · {typeLabel}</p>
      <h1 className={`prop-thesis mt-4 max-w-5xl ${titleSize}`}>{title}</h1>
      <p className="mt-4 text-sm font-semibold text-muted-foreground">{code}</p>
      {rawTitle !== headline ? <details className="mt-3 max-w-3xl text-sm"><summary className="focus-ring cursor-pointer font-semibold text-primary underline underline-offset-4">Ver ementa completa</summary><p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{rawTitle}</p></details> : null}
      <ul className="mt-6 flex flex-wrap items-center gap-2.5" aria-label="Situação observada">
        {observed?.stage ? <li className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-semibold" title="Estágio mais avançado com registro estruturado publicado (relatoria, pauta, deliberação, norma). Não é a situação oficial atual."><Flag size={14} className="text-primary" aria-hidden="true" />Estágio mais avançado registrado: <b>{stageLabel(observed.stage)}</b></li> : null}
        {observed?.closed ? <li className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3.5 py-1.5 text-sm font-semibold text-secondary-foreground" title="A última movimentação publicada é um encerramento oficial (norma, arquivamento, retirada ou prejudicialidade)."><CheckCircle2 size={14} aria-hidden="true" />Tramitação encerrada</li> : null}
        {observed ? <li className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm" title={`Contado até ${formatDate(observed.asOf)}, o último registro publicado desta Casa.`}><CalendarClock size={14} className="text-primary" aria-hidden="true" />
          {observed.daysSinceLastEvent === null ? <span className="text-muted-foreground">Sem evento datado publicado</span> : observed.closed ? <span>Último evento observado em <b>{formatDate(observed.lastEventDay)}</b></span> : <span><b>{nf.format(observed.daysSinceLastEvent)} {observed.daysSinceLastEvent === 1 ? 'dia' : 'dias'}</b> sem movimentação observada <span className="text-muted-foreground">· último evento em {formatDate(observed.lastEventDay)}</span></span>}</li> : null}
      </ul>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span>Apresentada em {day(proposal.presentedAt)}</span><span>Estado atual: <strong className="text-foreground">{proposal.status ?? 'não publicado'}</strong></span></div>
      <a className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-4" href={proposal.officialUrl}>Fonte oficial <ExternalLink size={14} aria-hidden="true" /></a>
    </header>
    <div className="mt-10"><ProposalStory item={item} source={source} /></div>
  </main></>;
}
