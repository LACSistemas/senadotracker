import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Source } from '@senadotracker/domain';
import { propositionDetail } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { EmptyState } from '@/components/empty-state';
import { ProposalStory } from '@/components/proposition-story';

export const dynamic = 'force-dynamic';
const house = (source: Source) => source === 'senado' ? 'Senado Federal' : 'Câmara dos Deputados';
const day = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'data não informada';
const humanType: Record<string, string> = { PL: 'Projeto de lei', PEC: 'Proposta de emenda à Constituição', RIC: 'Requerimento de informação', REQ: 'Requerimento', EMC: 'Emenda', SBT: 'Substitutivo', PRL: 'Parecer do relator', PAR: 'Parecer da comissão', DTQ: 'Destaque', INC: 'Indicação', SUG: 'Sugestão', DOC: 'Documento', OF: 'Ofício', REC: 'Recurso' };

export default async function PropositionPage({ params }: { params: Promise<{ source: string; id: string }> }) {
  const route = await params;
  if (!['senado', 'camara'].includes(route.source)) notFound();
  const source = route.source as Source;
  const result = propositionDetail(source, decodeURIComponent(route.id));
  if (result.status === 'unavailable') return <><LegislativeSubnav /><main className="page-shell py-12"><EmptyState title="Proposição indisponível" description={result.message} /></main></>;
  if (!result.data) notFound();
  const item = result.data as any;
  const proposal = item.proposal;
  const typeLabel = humanType[proposal.type] ?? proposal.type;
  const code = `${proposal.type} ${proposal.number ?? ''}${proposal.year ? `/${proposal.year}` : ''}`.trim();
  const rawTitle = String(proposal.summary ?? proposal.label);
  const normalizedTitle = rawTitle.replace(/\bSr\.\s+(?=Ministro)/gi, '').replace(/\bSra\.\s+(?=Ministra)/gi, '');
  const firstSentence = normalizedTitle.match(/^.*?(?:[!?]|\.(?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]))(?:\s|$)/)?.[0]?.trim() ?? normalizedTitle;
  const headline = /^(PRL|PAR|PARF|PPP|PEP|PES|PPR|CVO)/i.test(proposal.type) ? rawTitle.replace(/,?\s*Dep\..*?(?=, pela| pela|$)/i, '').replace(/\s*·.*$/, '').trim() : firstSentence;
  return <><LegislativeSubnav /><main id="conteudo" tabIndex={-1} className="page-shell py-8">
    <Link href="/legislativo/proposicoes" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={16} />Voltar às proposições</Link>
    <header className="border-b pb-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">{house(source)} · {typeLabel}</p><h1 className="mt-3 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">{headline || code}</h1><p className="mt-4 text-sm font-semibold text-muted-foreground">{code}</p>{rawTitle !== headline ? <details className="mt-3 max-w-3xl text-sm"><summary className="cursor-pointer font-semibold text-primary underline underline-offset-4">Ver ementa completa</summary><p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{rawTitle}</p></details> : null}<div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span>Apresentada em {day(proposal.presentedAt)}</span><span>Estado atual: <strong className="text-foreground">{proposal.status ?? 'não publicado'}</strong></span></div><a className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary underline" href={proposal.officialUrl}>Fonte oficial <ExternalLink size={14} /></a></header>
    <div className="mt-10"><ProposalStory item={item} source={source} /></div>
  </main></>;
}
