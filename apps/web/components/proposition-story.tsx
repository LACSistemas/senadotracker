import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Source } from '@senadotracker/domain';
import { PropositionTimeline } from '@/components/proposition-timeline';

type Detail = any;
const labels: Record<string, { role: string; kind: string; title: string }> = {
  proposicoes_legislativas_principais: { role: 'Esta matéria possui tramitação legislativa própria e pode produzir uma norma ou outro desfecho legislativo.', kind: 'timeline', title: 'Tramitação desta matéria' },
  requerimentos: { role: 'Este pedido busca uma providência, informação ou decisão dentro do processo legislativo.', kind: 'fulfillment_flow', title: 'Percurso do pedido' },
  emendas_substitutivos: { role: 'Esta proposta tenta modificar o texto ou o encaminhamento de uma matéria em tramitação.', kind: 'procedural_effect', title: 'Efeito na matéria principal' },
  pareceres_relatorios: { role: 'Este documento analisa outra matéria; ele não é uma nova proposta de lei.', kind: 'decision_formation', title: 'Formação do parecer' },
  instrumentos_votacao_tramitacao: { role: 'Este ato interfere na forma como outra matéria ou parte dela é apreciada.', kind: 'procedural_effect', title: 'Efeito procedural' },
  indicacoes_sugestoes: { role: 'Esta indicação ou sugestão encaminha uma recomendação a um destinatário ou processo.', kind: 'fulfillment_flow', title: 'Encaminhamento e transformação' },
  mensagens_comunicacoes_institucionais: { role: 'Esta comunicação registra uma finalidade institucional e o processamento que foi publicado.', kind: 'document_flow', title: 'Processamento institucional' },
  oficios_documentos: { role: 'Este documento registra uma comunicação ou etapa documental ligada a outro processo.', kind: 'document_flow', title: 'Fluxo documental' },
  recursos_representacoes_peticoes: { role: 'Este procedimento contesta, provoca ou registra uma decisão dentro de um processo.', kind: 'decision_record', title: 'Registro processual' },
  atos_documentos_especiais: { role: 'Este ato cumpre uma função específica no processo; sua história depende da evidência publicada.', kind: 'historical_card', title: 'Histórico do ato' },
};

export function resolveProposalPresentationModel(item: Detail): any {
  const group = item.proposal.functionalGroup as string;
  const base = labels[group] ?? labels.atos_documentos_especiais;
  const type = String(item.proposal.type).toUpperCase();
  if (group === 'atos_documentos_especiais' && ['PPP', 'PEP', 'PES', 'PPR', 'CVO'].includes(type)) return { ...base, kind: 'decision_formation', title: 'Formação da decisão' };
  if (group === 'atos_documentos_especiais' && type === 'RDF') return { ...base, kind: 'document_flow', title: 'Consolidação textual' };
  if (group === 'atos_documentos_especiais' && type === 'SSP') return { ...base, kind: 'procedural_effect', title: 'Efeito procedural' };
  return { ...base, group, subtype: type, density: item.movements.length + item.relationships.length + item.documents.length > 5 ? 'rich' : item.movements.length ? 'medium' : 'minimum' };
}

function DateLabel({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return <time dateTime={value}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))}</time>;
}

function Context({ item }: { item: Detail }) {
  const principal = item.principal;
  if (!principal && item.proposal.principalProposalId) return <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Contexto relacionado</p><h2 className="mt-2 text-2xl font-bold">Matéria principal identificada</h2><p className="mt-2 text-sm text-muted-foreground">Contexto aguardando carregamento para a matéria {item.proposal.principalProposalId}.</p></section>;
  if (!principal) return null;
  const wording = item.proposal.type === 'EMC' || item.proposal.type.startsWith('SBT') ? 'Esta emenda modifica' : item.proposal.type === 'PRL' || item.proposal.type === 'PAR' ? 'Este parecer analisa' : item.proposal.type === 'DTQ' || item.proposal.type === 'RPD' ? 'Este destaque atua sobre' : item.proposal.type === 'REC' ? 'Este recurso contesta decisão relacionada a' : 'Este objeto está relacionado a';
  return <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Contexto relacionado</p><h2 className="mt-2 text-2xl font-bold">{wording}</h2><p className="mt-3 font-semibold">{principal.label}</p>{principal.themes?.length ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{principal.themes[0].label}</p> : null}<Link className="mt-4 inline-block font-bold text-primary underline" href={`/legislativo/proposicoes/${item.proposal.source}/${encodeURIComponent(principal.id)}`}>Abrir matéria principal →</Link></section>;
}

function Historical({ item, model }: { item: Detail; model: ReturnType<typeof resolveProposalPresentationModel> }) {
  const events = item.movements ?? [];
  const labelsByKind: Record<string, string[]> = { fulfillment_flow: ['Apresentado', 'Processamento', 'Cumprimento / resposta'], procedural_effect: ['Instrumento', 'Alvo', 'Decisão', 'Efeito'], document_flow: ['Documento registrado', 'Relação documental', 'Resposta / documento posterior'], decision_record: ['Protocolo', 'Eventos próprios', 'Julgamento / efeito'], decision_formation: ['Apresentação', 'Arena / versão', 'Decisão documental'], historical_card: ['Primeiro registro', 'Eventos próprios', 'Estado atual'] };
  if (model.kind === 'timeline') return <section><h2 className="text-3xl font-bold">{model.title}</h2><p className="mt-2 text-muted-foreground">Os marcos publicados aparecem por data; a situação atual fica separada quando não possui data própria.</p>{events.length ? <PropositionTimeline events={events} /> : <Fallback text="Nenhum evento próprio foi publicado no lote ativo." />}</section>;
  if (model.group === 'requerimentos' && item.proposal.type !== 'RIC') return <section><h2 className="text-3xl font-bold">O que aconteceu com o pedido</h2>{events.length ? <PropositionTimeline events={[...events].sort((a: any, b: any) => String(a.occurredAt ?? '').localeCompare(String(b.occurredAt ?? '')))} /> : <p className="mt-3 text-sm text-muted-foreground">Nenhum evento próprio foi publicado para este pedido.</p>}</section>;
  if (model.group === 'requerimentos' && item.proposal.type === 'RIC' && !events.length) return <section><h2 className="text-3xl font-bold">Percurso do pedido</h2><p className="mt-3 text-sm text-muted-foreground">Resposta ainda não identificada nos dados disponíveis.</p></section>;
  if (model.group === 'emendas_substitutivos') return <section><h2 className="text-3xl font-bold">O que esta emenda propõe mudar</h2><p className="mt-4 max-w-3xl rounded-2xl border bg-card p-5 leading-relaxed">{item.proposal.summary ?? item.proposal.label}</p><p className="mt-5 text-sm text-muted-foreground">Resultado da emenda: {events[0]?.label ?? 'resultado individual ainda não identificado.'}</p></section>;
  if (model.kind === 'decision_formation') {
    const raw = String(item.proposal.label ?? '');
    const recommendations = raw.split(/•|\n/).map((part: string) => part.trim()).filter(Boolean).slice(0, 4);
    return <section><h2 className="text-3xl font-bold">Formação da decisão</h2><div className="mt-6 grid gap-4 md:grid-cols-2"><article className="rounded-2xl border-l-4 border-primary bg-primary/5 p-5"><p className="text-xs font-bold uppercase tracking-widest text-primary">O relator recomendou</p><p className="mt-3 text-xl font-bold">{recommendations.length ? recommendations[0] : 'Conclusão publicada no documento'}</p>{item.authors[0] ? <p className="mt-2 text-sm text-muted-foreground">Relator: {item.authors[0].name}</p> : null}</article><article className="rounded-2xl border p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Decisão do colegiado</p><p className="mt-3 text-sm text-muted-foreground">Resultado próprio do colegiado ainda não identificado.</p></article></div>{recommendations.length > 1 ? <ul className="mt-5 space-y-2 text-sm">{recommendations.slice(1).map((value: string) => <li className="border-l-2 border-primary/25 pl-4" key={value}>{value}</li>)}</ul> : null}</section>;
  }
  if (model.kind === 'procedural_effect') { const nodes = [['Instrumento', item.proposal.label], ...(item.principal ? [['Alvo', item.principal.label]] : []), ...(events[0] ? [['Decisão', events[0].label]] : [])]; return <section><h2 className="text-3xl font-bold">Efeito procedural</h2><div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">{nodes.map(([title, value], index) => <div className="flex items-center gap-3" key={title}><article className="min-w-0 flex-1 rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase tracking-widest text-primary">{title}</p><p className="mt-2 font-semibold">{value}</p></article>{index < nodes.length - 1 ? <span className="text-2xl text-primary md:block">→</span> : null}</div>)}</div></section>; }
  if (model.kind === 'document_flow') { const nodes = [['Documento', item.proposal.label], ...(item.principal ? [['Matéria relacionada', item.principal.label]] : []), ...(events[0] ? [['Resposta ou documento posterior', events[0].label]] : [])]; return <section><h2 className="text-3xl font-bold">Fluxo documental</h2><div className="mt-6 flex max-w-2xl flex-col gap-0">{nodes.map(([title, value], index) => <div className="flex gap-4" key={title}><div className="flex w-5 flex-col items-center"><span className="mt-1 size-3 rounded-full bg-primary" />{index < nodes.length - 1 ? <span className="w-px flex-1 bg-primary/25" /> : null}</div><div className="pb-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">{title}</p><p className="mt-1 font-semibold">{value}</p></div></div>)}</div></section>; }
  if (!events.length) return <section><h2 className="text-3xl font-bold">{model.title}</h2><p className="mt-2 text-sm text-muted-foreground">O histórico próprio ainda não foi identificado nos dados disponíveis.</p></section>;
  const steps: string[] = labelsByKind[model.kind ?? 'historical_card'] ?? labelsByKind.historical_card ?? [];
  const shown = events.slice(0, steps.length);
  return <section><h2 className="text-3xl font-bold">{model.title}</h2><div className="mt-6 flex flex-col gap-0">{shown.map((event: any, index: number) => <div className="flex gap-4" key={`${event.source}:${event.externalKey}`}><div className="flex w-6 flex-col items-center"><span className="mt-1 size-3 rounded-full bg-primary" />{index < shown.length - 1 ? <span className="w-px flex-1 bg-primary/25" /> : null}</div><div className="pb-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">{steps[index] ?? 'Evento próprio'}</p><p className="mt-1 font-semibold">{event.label}</p><p className="mt-1 text-xs text-muted-foreground"><DateLabel value={event.occurredAt} /></p></div></div>)}</div>{events.length > shown.length ? <PropositionTimeline events={events.slice(shown.length)} /> : null}</section>;
}

function Fallback({ text }: { text: string }) { return <div className="mt-5 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">{text}</div>; }

function Decision({ item, source }: { item: Detail; source: Source }) {
  const own = item.deliberations.filter((entry: any) => source === 'camara' ? entry.deliberation.actualVotedProposalId === item.proposal.externalId : entry.deliberation.proposalId === item.proposal.externalId);
  const context = item.deliberations.filter((entry: any) => !own.includes(entry));
  if (!own.length) return context.length ? <p className="text-xs text-muted-foreground">Há deliberações na matéria relacionada; nenhuma decisão própria foi identificada.</p> : null;
  return <section><h2 className="text-3xl font-bold">Decisão / resultado</h2><div className="mt-6 grid gap-4 lg:grid-cols-2">{own.map((entry: any) => <article className="rounded-2xl border bg-card p-6" key={`${entry.coverage.source}:${entry.deliberation.externalId}`}><p className="text-xs font-bold uppercase tracking-widest text-primary">A decisão · {entry.deliberation.chamberBody}</p><h3 className="mt-3 text-xl font-bold">{entry.deliberation.result ?? entry.deliberation.description}</h3><p className="mt-2 text-sm text-muted-foreground"><DateLabel value={entry.deliberation.date} /> · {entry.total} votos registrados</p><div className="mt-5 flex flex-wrap gap-3">{entry.general.map((vote: any) => <span className="rounded-full bg-secondary px-3 py-2 text-sm font-semibold" key={vote.label}>{vote.label}: {vote.value}</span>)}</div><a className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary underline" href={entry.deliberation.officialUrl}>Fonte oficial <ExternalLink size={14} /></a></article>)}</div></section>;
}

export function ProposalStory({ item, source }: { item: Detail; source: Source }) {
  const model = resolveProposalPresentationModel(item);
  const authors = item.authors ?? [];
  const products = [...(item.documents ?? []), ...(item.resultingNorms ?? [])];
  const shownAuthors = authors.slice(0, 9);
  const participantTitle = model.group === 'pareceres_relatorios' || (model.group === 'atos_documentos_especiais' && ['PPP', 'PEP'].includes(model.subtype)) ? 'Relatoria' : model.group === 'requerimentos' ? 'Autores do pedido' : model.group === 'emendas_substitutivos' ? 'Autoria da emenda' : model.group === 'recursos_representacoes_peticoes' ? 'Autores do recurso' : model.group === 'oficios_documentos' ? 'Origem institucional' : 'Autoria';
  return <div className="space-y-14"><section className="rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-base leading-relaxed">{model.role}</section><Context item={item} /><Historical item={item} model={model} />{model.group === 'proposicoes_legislativas_principais' ? <ActivityAround item={item} /> : null}<Decision item={item} source={source} />{authors.length ? <section><h2 className="text-3xl font-bold">{participantTitle}</h2><div className="mt-5 flex flex-wrap gap-3">{shownAuthors.map((author: any) => <div className="rounded-xl border p-4" key={`${author.name}:${author.order}`}><p className="font-bold">{author.name}</p><p className="mt-1 text-sm text-muted-foreground">{author.kind}{author.party ? ` · ${author.party}/${author.uf ?? 'UF não informada'}` : ''}</p></div>)}</div>{authors.length > shownAuthors.length ? <p className="mt-3 text-sm text-muted-foreground">Mostrando 9 de {authors.length} participantes.</p> : null}</section> : null}{products.length ? <section><h2 className="text-3xl font-bold">O que este objeto produziu</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{products.map((entry: any) => <a className="rounded-xl border p-4 hover:border-primary" href={entry.officialUrl} key={entry.externalKey}><p className="font-bold">{entry.label}</p><p className="mt-1 text-xs text-muted-foreground"><DateLabel value={entry.occurredAt} /> · Fonte oficial →</p></a>)}</div></section> : null}</div>;
}

function ActivityAround({ item }: { item: Detail }) {
  const groups = [{ label: 'Emendas e substitutivos', count: item.amendments?.length ?? 0, items: item.amendments ?? [] }, { label: 'Documentos', count: item.documents?.length ?? 0, items: item.documents ?? [] }, { label: 'Normas ou produtos', count: item.resultingNorms?.length ?? 0, items: item.resultingNorms ?? [] }].filter(group => group.count);
  if (!groups.length) return null;
  return <section><h2 className="text-3xl font-bold">Atividade em torno desta matéria</h2><div className="mt-5 grid gap-3 md:grid-cols-3">{groups.map(group => <details className="rounded-2xl border bg-card p-5" key={group.label}><summary className="cursor-pointer font-bold">{group.count} {group.label.toLocaleLowerCase('pt-BR')}</summary><ul className="mt-4 space-y-2 text-sm">{group.items.slice(0, 8).map((entry: any) => <li key={entry.externalKey}><a className="text-primary underline" href={entry.officialUrl}>{entry.label}</a></li>)}</ul></details>)}</div></section>;
}
