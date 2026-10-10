import type { ReactNode } from 'react';
import { Building2, ClipboardList, FileText, MapPin } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import { DataTable, type DataColumn } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { CoverageBadge } from '@/components/metrics';
import { GroupedBarChart, RankedBars, StackedBarChart } from '@/components/charts';
import { SectionHeader } from '@/components/section-navigation';
import { FinancialLadder } from '@/components/supplier-dossier';
import { PIX_EMPTY_COPY, PIX_PERIOD, beneficiaryLabel, brlCompact, brlFull, buildPixStory, percent, plural, type PixProfileData } from '@/lib/pix-profile-model';

type Amendment = Extract<PixProfileData, { status: 'available' }>['summary']['amendments'][number];
const date = (iso: string | null) => iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso)) : null;

function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="mt-12"><h3 className="text-xl font-black">{title}</h3>{description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}<div className="mt-5">{children}</div></div>;
}

/**
 * Emendas Pix (transferências especiais) dentro de "Atuação parlamentar".
 * Roteiro: quanto destinou → quanto foi pago → para onde → para quê → custeio × investimento → evolução → emendas e planos concretos.
 * Todos os números vêm de `parliamentarianPixSummary` (somente autoria revisada); nada aqui decide identidade.
 */
export function PixProfileSection({ data, root, page = 1, votePage = 1 }: { data: PixProfileData; root: string; page?: number; votePage?: number }) {
  const header = <SectionHeader number={5} id="emendas-pix" title="Emendas Pix" description="Veja quanto o parlamentar destinou por transferências especiais, para onde os recursos foram e quanto já foi pago."/>;
  if (data.status === 'unavailable') return <section>{header}<div className="mt-6"><EmptyState title="Emendas Pix indisponíveis no momento" description="Não foi possível consultar a coleta publicada. O restante do perfil não é afetado."/></div></section>;
  if (data.status === 'empty') { const copy = PIX_EMPTY_COPY[data.reason]; return <section>{header}<div className="mt-6"><EmptyState title={copy.title} description={copy.description}/></div></section>; }

  const { summary } = data, f = summary.financials;
  const story = buildPixStory(summary, { page });
  const updated = date(summary.run?.finishedAt ?? null);
  const coverage = (note: string, sampleSize: number | null): DataCoverage => ({ availability: 'available', source: 'multiple', period: { from: `${PIX_PERIOD.from}-01-01`, to: `${PIX_PERIOD.to}-12-31`, grain: 'year' }, batchId: summary.run?.runId ?? null, note, sampleSize });
  const chips = [{ icon: FileText, label: 'Emendas', value: summary.counts.amendments }, { icon: ClipboardList, label: 'Planos de ação', value: summary.counts.plans }, { icon: Building2, label: 'Beneficiários', value: summary.counts.beneficiaries }, { icon: MapPin, label: summary.counts.ufs === 1 ? 'Estado' : 'Estados', value: summary.counts.ufs }];
  const paidRatio = f.paidAmount !== null && f.destinedAmount > 0 ? Math.min(100, 100 * f.paidAmount / f.destinedAmount) : null;

  const beneficiaryItems = summary.topBeneficiaries.slice(0, 8).map((b, index) => { const label = beneficiaryLabel(b.name, b.enteType, b.municipalityName); return { key: `${b.cnpj ?? 'sem-cnpj'}:${index}`, label: label.title, value: b.destinedAmount, meta: `${label.kind}${b.uf ? ` · ${b.uf}` : ''} · ${plural(b.plans, 'plano', 'planos')}`, }; });
  const ufItems = summary.byUf.filter(u => u.uf !== '—').slice(0, 6).map(u => ({ key: u.uf, label: u.uf, value: u.destinedAmount, meta: `${plural(u.beneficiaries, 'beneficiário', 'beneficiários')} · ${plural(u.plans, 'plano', 'planos')}` }));
  const hasTerritorialSplit = ufItems.length > 1;

  const columns: DataColumn<Amendment>[] = [
    { key: 'amendment', header: 'Emenda', render: item => <div><strong className="tabular-nums" title="Código da emenda: ano + código do autor + sequencial">{item.amendmentCode}</strong><small className="block text-muted-foreground">{item.year}{item.year >= new Date().getFullYear() ? ' · em andamento' : ''}</small></div> },
    { key: 'destined', header: 'Destinado', align: 'right', render: item => <span className="tabular-nums">{brlFull(item.destinedAmount)}</span> },
    { key: 'paid', header: 'Pago', align: 'right', render: item => item.paidAmount === null ? <span className="text-muted-foreground">—</span> : <div className="tabular-nums">{brlFull(item.paidAmount)}{percent(item.paidAmount, item.destinedAmount) && <small className="block text-muted-foreground">{percent(item.paidAmount, item.destinedAmount)} do destinado</small>}</div> },
    { key: 'plans', header: 'Divisão', render: item => <span>{plural(item.plans, 'plano', 'planos')}<small className="block text-muted-foreground">{plural(item.beneficiaries, 'beneficiário', 'beneficiários')}</small></span> },
    { key: 'top', header: 'Principal destino', render: item => { if (!item.topBeneficiary) return <span className="text-muted-foreground">—</span>; const label = beneficiaryLabel(item.topBeneficiary.name, item.topBeneficiary.enteType, item.topBeneficiary.municipalityName); return <span className="min-w-0"><strong className="block truncate" title={label.original}>{label.title}</strong><small className="block text-muted-foreground">{label.kind}{item.topBeneficiary.uf ? ` · ${item.topBeneficiary.uf}` : ''}</small></span>; } },
    { key: 'situation', header: 'Situação', render: item => item.impededPlans > 0 ? <span className="text-xs font-bold text-warning">{plural(item.impededPlans, 'plano impedido', 'planos impedidos')}</span> : <span className="text-xs text-muted-foreground">Sem planos impedidos</span> },
  ];
  const pageHref = (next: number) => `${root}/atuacao-parlamentar?paginaEmendas=${next}${votePage > 1 ? `&paginaVotos=${votePage}` : ''}#emendas-pix-lista`;
  const sourceNote = `Fontes: Transferegov (Transferências Especiais) e Portal da Transparência (Emendas parlamentares)${updated ? `, coleta de ${updated}` : ''}.`;

  return <section>{header}

    <div className="card-elevated mt-6 rounded-3xl border bg-card p-6 lg:p-7"><div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><span className="eyebrow">Transferências especiais · {PIX_PERIOD.from}–{PIX_PERIOD.to}</span><CoverageBadge coverage={coverage('Valor destinado = soma dos planos de ação; pago vem do Portal da Transparência por emenda.', summary.counts.plans)}/></div>
        <strong className="display-title mt-3 block break-words text-5xl sm:text-6xl">{brlCompact(f.destinedAmount)}</strong>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">destinados em planos de ação</p>
        <p className="mt-5 text-lg font-bold">{f.paidAmount === null ? 'Pagamento oficial não informado para estas emendas.' : <>{brlCompact(f.paidAmount)} pagos/transferidos{story.paidShare && <span className="text-muted-foreground"> · {story.paidShare} do destinado</span>}</>}</p>
        {paidRatio !== null && <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${story.paidShare} do valor destinado consta como pago/transferido`}><div className="h-full rounded-full" style={{ width: `${Math.max(1, paidRatio)}%`, background: 'var(--chart-1)' }}/></div>}
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{story.headline}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{chips.map(chip => <div key={chip.label} className="rounded-2xl bg-secondary p-4 text-secondary-foreground"><chip.icon size={17}/><strong className="display-title mt-2 block text-2xl">{chip.value.toLocaleString('pt-BR')}</strong><span className="mt-1 block text-xs font-semibold leading-4">{chip.label}</span></div>)}</div>
      </div>
      <FinancialLadder title="Do destinado ao pago" institution="Valor em cada etapa" rungs={story.ladder.map(r => ({ label: r.label, valueCents: r.amount === null ? null : Math.round(r.amount * 100), ...(r.primary ? { primary: true } : {}) }))} coverage={coverage('Etapas distintas; largura decrescente não prova um funil causal.', null)} note="Empenhado, liquidado e pago vêm do Portal da Transparência por emenda; o destinado soma os planos de ação do Transferegov."/>
    </div></div>

    <Block title="Para onde foi o dinheiro?" description={[story.reach, story.concentration.sentence].filter(Boolean).join(' ')}>
      <div className={hasTerritorialSplit ? 'grid gap-5 lg:grid-cols-[1.45fr_1fr]' : ''}>
        <RankedBars title="Maiores destinos (R$ destinado)" items={beneficiaryItems} coverage={coverage('Beneficiário é o ente que recebe o plano de ação (município, estado ou outra instituição); o código IBGE ainda não está disponível.', summary.counts.beneficiaries)} formatValue={brlCompact}/>
        {hasTerritorialSplit && <RankedBars title="Por estado do beneficiário (R$)" items={ufItems} coverage={coverage('UF informada para o beneficiário do plano.', summary.counts.ufs)} formatValue={brlCompact}/>}
      </div>
      {summary.counts.beneficiaries > beneficiaryItems.length && <p className="mt-3 text-sm text-muted-foreground">Mostrando os {beneficiaryItems.length} maiores de {summary.counts.beneficiaries.toLocaleString('pt-BR')} beneficiários.</p>}
    </Block>

    <Block title="Para quê?" description={story.functions.sentence}>
      {story.functions.items.length ? <RankedBars title="Áreas de política pública (R$ destinado, planos de área única)" items={story.functions.items.slice(0, 8).map(item => ({ key: String(item.code), label: item.name, value: item.amount, meta: `${plural(item.exclusivePlans, 'plano', 'planos')} de área única${item.plans > item.exclusivePlans ? ` · ${plural(item.plans - item.exclusivePlans, 'outro plano', 'outros planos')} também a incluem` : ''}` }))} coverage={coverage('Função orçamentária informada no plano de ação. Planos com mais de uma área não têm o valor repartido.', story.functions.items.length)} formatValue={brlCompact}/> : <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Nenhum plano deste parlamentar tem uma única área de política pública publicada, então não há valor a atribuir a cada área.</p>}
    </Block>

    <Block title="Custeio ou investimento?" description={story.expense.sentence}>
      <StackedBarChart title="Natureza do valor destinado (R$)" data={[{ label: 'Valor destinado nos planos', segments: [{ label: 'Investimento', value: story.expense.investimento }, { label: 'Custeio', value: story.expense.custeio }] }]} coverage={coverage('Custeio mantém a máquina e serviços; investimento cria ou amplia bens duráveis. Classificação do plano de ação.', summary.counts.plans)}/>
    </Block>

    <Block title="Como isso evoluiu?" description={`${story.years.sentence}${story.years.hasOngoing ? ' O ano corrente está em andamento.' : ''} Pago é o acumulado até hoje das emendas de cada ano, não o pago naquele ano.`}>
      <GroupedBarChart title="Destinado e pago por ano da emenda (R$)" data={story.years.points.map(p => ({ label: p.ongoing ? `${p.year} (em andamento)` : String(p.year), values: [{ label: 'Destinado', value: p.destined, color: 'var(--chart-1)' }, { label: 'Pago', value: p.paid, color: 'var(--chart-2)' }] }))} coverage={coverage('Ano da emenda orçamentária. Os anos sem emendas atribuídas não aparecem.', story.years.points.length)}/>
    </Block>

    <div id="emendas-pix-lista"><Block title="Quais emendas formam esse total?" description={`${story.split ? `${story.split} ` : ''}${plural(story.amendments.total, 'emenda', 'emendas')}, da mais recente para a mais antiga.`}>
      <DataTable caption="Emendas Pix do parlamentar" columns={columns} rows={story.amendments.rows} rowKey={item => item.amendmentCode} coverage={coverage('Emendas com autoria vinculada ao parlamentar.', story.amendments.total)} page={story.amendments.page} pageCount={story.amendments.pageCount} pageHref={pageHref}/>
    </Block></div>

    <aside className="mt-10 space-y-2 rounded-2xl border bg-card p-5 text-xs leading-5 text-muted-foreground">
      <p><strong className="text-foreground">Como ler estes números.</strong> Destinado é o valor dos planos de ação. {summary.notes.paid} {summary.notes.executedByEnte}{f.executedByEnteAmount !== null ? ` Relatórios de gestão informam ${brlCompact(f.executedByEnteAmount)} executados pelos entes, de forma parcial.` : ''}</p>
      <p>{summary.notes.paid2020to2022}</p>
      <p>{story.authorship}</p>
      <p>{sourceNote} <a className="font-bold text-primary underline" href="https://www.transferegov.sistema.gov.br/" target="_blank" rel="noreferrer">Transferegov ↗</a> · <a className="font-bold text-primary underline" href="https://portaldatransparencia.gov.br/emendas" target="_blank" rel="noreferrer">Portal da Transparência ↗</a></p>
    </aside>
  </section>;
}
