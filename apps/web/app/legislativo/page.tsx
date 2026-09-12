import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, FileText, Landmark, MapPin, ReceiptText, Scale, Store, TrendingUp, Users, Vote } from 'lucide-react';
import { ufs, type DataCoverage, type Source } from '@senadotracker/domain';
import type { HousePanorama as HousePanoramaData } from '@senadotracker/db';
import { legislativeOverview } from '@/lib/data';
import { OfficialPortrait } from '@/components/app-image';
import { SearchBar, FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { ComparisonBar } from '@/components/comparison-bar';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const ratio = (value: number | null) => value === null ? '—' : percent.format(value);

function pageUrl(params: Record<string, string | undefined>, page: number, anchor?: string) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  if (page > 1) query.set('pagina', String(page));
  return `/legislativo?${query}${anchor ? `#${anchor}` : ''}`;
}

const discovery: Array<[string, string, string, LucideIcon, string]> = [
  ['Quanto custa um mandato?', 'Cotas e recursos públicos por parlamentar e período.', '/legislativo/rankings?dimensao=expenses', ReceiptText, 'text-emerald-700 bg-emerald-50'],
  ['Ele participa?', 'Presença em Plenário e participação em votações nominais.', '/legislativo/rankings?dimensao=absence', Vote, 'text-blue-700 bg-blue-50'],
  ['O que ele fez?', 'Propostas, relatorias e atuação legislativa.', '/legislativo/proposicoes', FileText, 'text-violet-700 bg-violet-50'],
  ['Quem trabalha no gabinete?', 'Vínculos e custos publicados de cada gabinete.', '/legislativo/senadores', Users, 'text-orange-700 bg-orange-50'],
  ['Proposições', 'Busque projetos, PECs e outras matérias legislativas.', '/legislativo/proposicoes', FileText, 'text-sky-700 bg-sky-50'],
  ['Rankings', 'Compare gastos, faltas, propostas e relatorias.', '/legislativo/rankings', BarChart3, 'text-indigo-700 bg-indigo-50'],
  ['Fornecedores', 'Veja CNPJs pagos por vários parlamentares.', '/legislativo/fornecedores', Store, 'text-rose-700 bg-rose-50'],
  ['Patrimônio', 'Compare declarações eleitorais de 2018 e 2022.', '/legislativo/patrimonio', TrendingUp, 'text-amber-700 bg-amber-50'],
  ['Comparações', 'Compare parlamentares, partidos ou estados em dimensões equivalentes.', '/comparar', Scale, 'text-cyan-700 bg-cyan-50'],
];

export default async function LegislativePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const requested = scalar(params.casa);
  const source: Source | undefined = requested === 'senado' || requested === 'camara' ? requested : undefined;
  const ufValue = scalar(params.uf)?.toUpperCase();
  const uf = ufValue && ufs.has(ufValue) ? ufValue : undefined;
  const party = scalar(params.partido);
  const search = scalar(params.busca)?.trim();
  const rawPage = Number(scalar(params.pagina) ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const data = legislativeOverview({ page, pageSize: 5, ...(source ? { source } : {}), ...(uf ? { uf } : {}), ...(party ? { party } : {}), ...(search ? { search } : {}) });
  if (data.status === 'unavailable') return <main id="conteudo" tabIndex={-1} className="page-shell py-12"><EmptyState title="Entrada legislativa indisponível" description={data.message} /></main>;

  const { panoramas, years, result, facets, monthlyCosts } = data.data;
  const selected = { casa: source, uf, partido: party, busca: search };
  const mixedCoverage: DataCoverage = { availability: 'available', source: 'multiple', period: { from: null, to: null, grain: 'snapshot' }, batchId: null, note: 'Cadastro ativo; cada métrica conserva período e cobertura próprios.', sampleSize: result.items.length };
  type Item = (typeof result.items)[number];
  const columns: DataColumn<Item>[] = [
    { key: 'name', header: 'Representante', render: item => <div className="flex items-center gap-3"><div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted"><OfficialPortrait src={item.photoUrl} name={item.name} sizes="40px" /></div><strong>{item.name}</strong></div> },
    { key: 'role', header: 'Cargo', render: item => item.source === 'senado' ? 'Senador' : 'Deputado federal' },
    { key: 'uf', header: 'Estado', render: item => item.uf },
    { key: 'party', header: 'Partido', render: item => <Badge>{item.party}</Badge> },
    { key: 'cost', header: `Custo total (${itemYear(years)})`, align: 'right', render: item => item.totalCostCents === null ? <span className="text-muted-foreground" title="Uma ou mais parcelas não estão publicadas">—<small className="block">cobertura incompleta</small></span> : <span title={`Cota: ${money.format(item.expenseCents! / 100)} · Gabinete: ${money.format(item.cabinetCents! / 100)} · Subsídio: ${money.format(item.salaryCents! / 100)} (${item.salaryMonths} meses)`}><strong>{money.format(item.totalCostCents / 100)}</strong><small className="block whitespace-nowrap text-muted-foreground">cota + gabinete + subsídio</small></span> },
    { key: 'presence', header: 'Presença', align: 'right', render: item => item.presence.numerator === null || !item.presence.denominator ? <span className="text-muted-foreground">—</span> : percent.format(item.presence.numerator / item.presence.denominator) },
    { key: 'profile', header: '', align: 'right', render: item => <Link className={cn(buttonVariants({ size: 'sm' }), 'whitespace-nowrap')} href={`/legislativo/${item.source === 'senado' ? 'senadores' : 'deputados'}/${item.externalId}`}>Ver perfil <ArrowRight size={13} /></Link> },
  ];

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <div className="relative isolate min-h-[310px] overflow-hidden rounded-[1.75rem] bg-primary text-white">
          <div className="absolute inset-0 -z-20 bg-[url('/congresso.svg')] bg-cover bg-center" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#082f27]/95 via-[#0b4035]/83 to-[#123e36]/30" />
          <div className="grid min-h-[310px] gap-8 p-7 md:grid-cols-[1.15fr_.85fr] md:items-center md:p-10">
            <div>
              <h1 className="display-title max-w-xl text-4xl leading-[.98] sm:text-6xl">Entenda quem te representa.<br />Pelos dados.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80">Acompanhe gastos, presença, votações, atuação legislativa, gabinete e histórico eleitoral de senadores e deputados federais, com base em fontes oficiais e dados atualizados.</p>
              <div className="mt-5 max-w-xl rounded-xl bg-white p-2 text-foreground"><SearchBar action="/legislativo" defaultValue={search ?? ''} placeholder="Buscar senador, deputado, partido ou estado..." /></div>
              <div className="mt-3 flex flex-wrap gap-x-2 text-xs text-white/75"><span>Exemplos:</span><Link href="/legislativo?busca=Flávio+Bolsonaro" className="underline">Flávio Bolsonaro</Link><span>•</span><Link href="/legislativo?busca=Gleisi+Hoffmann" className="underline">Gleisi Hoffmann</Link><span>•</span><Link href="/legislativo?partido=PL" className="underline">PL</Link><span>•</span><Link href="/legislativo?uf=SP" className="underline">São Paulo</Link></div>
            </div>
            <div className="hidden h-full flex-col items-end justify-between text-right md:flex"><p className="max-w-xs rotate-[-2deg] font-serif text-3xl italic leading-tight text-white/90">Mais transparência para um Brasil mais forte.</p><div className="rounded-xl border border-white/20 bg-black/25 px-4 py-3 text-left text-xs"><strong className="block text-sm">Congresso Nacional</strong>Brasília · DF</div></div>
          </div>
        </div>
      </section>

      <section className="page-shell py-10">
        <SectionTitle title="Comece por aqui" subtitle="Escolha um caminho para explorar os dados." />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickPath title="Senadores" text={`Conheça os ${panoramas.senado.roster.parliamentarians} senadores, seus gastos, votações e mais.`} href="/legislativo/senadores" icon={Landmark} tone="bg-blue-50 text-blue-700" />
          <QuickPath title="Deputados Federais" text={`Explore os ${panoramas.camara.roster.parliamentarians} deputados federais e sua atuação na Câmara.`} href="/legislativo/deputados" icon={Users} tone="bg-emerald-50 text-emerald-700" />
          <QuickPath title="Partidos" text="Veja a atuação dos partidos no Congresso Nacional." href="/legislativo/partidos" icon={Building2} tone="bg-violet-50 text-violet-700" />
          <QuickPath title="Estados" text="Compare a representatividade e os dados por estado." href="/quem-me-representa" icon={MapPin} tone="bg-amber-50 text-amber-700" />
        </div>
      </section>

      <section className="border-y bg-card"><div className="page-shell py-10">
        <SectionTitle title="Congresso em números" subtitle={`Um panorama do Senado Federal e da Câmara dos Deputados, com os períodos publicados mais recentes (${years.senado}/${years.camara}).`} />
        <div className="mt-5 space-y-3">
          <HousePanorama source="senado" year={years.senado} data={panoramas.senado} monthlyCost={monthlyCosts.senado} />
          <HousePanorama source="camara" year={years.camara} data={panoramas.camara} monthlyCost={monthlyCosts.camara} />
        </div>
      </div></section>

      <section className="page-shell py-12">
        <SectionTitle title="O que você pode descobrir?" subtitle="Explore diferentes aspectos da atuação dos parlamentares." />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{discovery.slice(0,4).map(([title, text, href, Icon, tone]) => <QuickPath key={title} title={title} text={text} href={href} icon={Icon} tone={tone} compact />)}</div>
        <div className="mt-10 flex items-end justify-between gap-4 border-t pt-8"><div><h3 className="text-xl font-black">Ferramentas para explorar</h3><p className="mt-1 text-sm text-muted-foreground">Buscas, cruzamentos e comparações com páginas próprias.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{discovery.slice(4).map(([title, text, href, Icon, tone]) => <QuickPath key={title} title={title} text={text} href={href} icon={Icon} tone={tone} compact />)}</div>
      </section>

      <section id="explore-dados" className="scroll-mt-6 border-y bg-card"><div className="page-shell py-12">
        <div className="flex flex-wrap items-end justify-between gap-4"><SectionTitle title="Explore os dados" subtitle="Acesse perfis completos de parlamentares do Congresso." /><div className="flex rounded-xl bg-muted p-1">{[[undefined, 'Todos'], ['senado', 'Senado'], ['camara', 'Câmara']].map(([value, label]) => <Link key={label} href={pageUrl({ ...selected, casa: value }, 1, 'explore-dados')} className={cn('rounded-lg px-4 py-2 text-sm font-bold', source === value || (!source && !value) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>{label}</Link>)}</div></div>
        <div className="mt-6"><FilterBar action="/legislativo" fields={[{ name: 'uf', label: 'Estado', value: uf ?? '', options: [{ value: '', label: 'Todos' }, ...facets.ufs.map(item => ({ value: item.value, label: `${item.value} · ${item.count}` }))] }, { name: 'partido', label: 'Partido', value: party ?? '', options: [{ value: '', label: 'Todos' }, ...facets.parties.map(item => ({ value: item.value, label: `${item.value} · ${item.count}` }))] }]}><input type="hidden" name="casa" value={source ?? ''} /><input type="hidden" name="busca" value={search ?? ''} /></FilterBar></div>
        <div className="mt-5"><DataTable caption="Parlamentares do Congresso" columns={columns} rows={result.items} rowKey={item => `${item.source}:${item.externalId}`} coverage={mixedCoverage} page={page} pageCount={Math.max(1, Math.ceil(result.total / 5))} pageHref={next => pageUrl(selected, next)} /></div>
        <Link href={source === 'camara' ? '/legislativo/deputados' : source === 'senado' ? '/legislativo/senadores' : '/legislativo/senadores'} className="mt-5 inline-flex items-center gap-2 font-bold text-primary underline">Ver mais parlamentares <ArrowRight size={15} /></Link>
      </div></section>

      <section className="page-shell py-12"><div className="grid gap-5 rounded-2xl border bg-card p-6 lg:grid-cols-[.8fr_2.2fr] lg:items-center"><div><Scale className="text-primary" /><h2 className="mt-3 text-xl font-bold">Compare parlamentares</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Escolha pessoas da mesma Casa e compare dimensões lado a lado, sem nota geral.</p></div><ComparisonBar source={source ?? 'senado'} count={2} options={result.items.map(item => ({ id: item.externalId, label: `${item.name} · ${item.party}/${item.uf}`, source: item.source }))} /></div></section>

      <section className="border-t bg-card"><div className="page-shell py-12"><SectionTitle title="De onde vêm os dados?" subtitle="Todas as informações são de fontes oficiais e públicas." /><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SourceCard name="Senado Federal" text="Parlamentares, votações, comissões e despesas." href="https://www12.senado.leg.br/dados-abertos/" logo="/source-logos/senado.png" /><SourceCard name="Câmara dos Deputados" text="Parlamentares, proposições e atividade legislativa." href="https://dadosabertos.camara.leg.br/" logo="/source-logos/camara.png" wide /><SourceCard name="TSE" text="Dados eleitorais, partidos, candidaturas e bens." href="https://dadosabertos.tse.jus.br/" logo="/source-logos/tse.png" /><SourceCard name="Portal da Transparência" text="Referências públicas sobre gastos e execução orçamentária." href="https://portaldatransparencia.gov.br/" icon={Landmark} /></div></div></section>
    </main>
  );
}

const itemYear = (years: Record<Source, number>) => years.senado === years.camara ? years.senado : 'ano publicado';

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-3xl font-black tracking-tight">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{subtitle}</p></div>; }

function QuickPath({ title, text, href, icon: Icon, tone, compact = false }: { title: string; text: string; href: string; icon: LucideIcon; tone: string; compact?: boolean }) { return <Link href={href} className={cn('focus-ring group flex rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm', compact ? 'min-h-32 flex-col' : 'min-h-28 items-start gap-3')}><span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone)}><Icon size={19} /></span><span className="min-w-0 flex-1"><strong className="block leading-tight">{title}</strong><small className="mt-1.5 block leading-5 text-muted-foreground">{text}</small></span><ArrowRight size={16} className={cn('shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary', compact && 'mt-auto self-end')} /></Link>; }

function HousePanorama({ source, year, data, monthlyCost }: { source: Source; year: number; data: HousePanoramaData; monthlyCost: { meanCents: number | null; sampleSize: number } }) {
  const senate = source === 'senado';
  const cells = [
    { icon: Users, value: data.roster.parliamentarians.toLocaleString('pt-BR'), label: senate ? 'senadores' : 'deputados federais', detail: senate ? 'representação dos estados e do DF' : 'representando todo o país' },
    { icon: MapPin, value: data.roster.states.toLocaleString('pt-BR'), label: 'UFs representadas', detail: 'estados e Distrito Federal' },
    { icon: ReceiptText, value: monthlyCost.meanCents === null ? '—' : money.format(monthlyCost.meanCents / 100), label: 'custo médio mensal', detail: `subsídio + cota + gabinete · n=${monthlyCost.sampleSize}` },
    { icon: BarChart3, value: ratio(senate ? data.participation.meanRatio : data.presence.distributionRatio.median), label: senate ? 'participação média em votações nominais' : 'presença mediana', detail: `universo publicado de ${year}` },
  ];
  return <article className="overflow-x-auto rounded-2xl border bg-background p-2 shadow-sm"><div className="grid min-w-[860px] grid-cols-[230px_repeat(4,minmax(135px,1fr))] gap-2"><div className={cn('flex min-h-28 flex-col justify-between rounded-xl p-4 text-white', senate ? 'bg-[#1554a2]' : 'bg-[#08783e]')}><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15"><Landmark size={20} /></span><div><h3 className="font-black leading-tight">{senate ? 'Senado Federal' : 'Câmara dos Deputados'}</h3><p className="mt-0.5 text-xs text-white/70">{senate ? 'A Casa da Federação' : 'A voz do povo brasileiro'}</p></div></div><Link className="inline-flex items-center gap-1 text-xs font-bold underline" href={senate ? '/legislativo/senadores' : '/legislativo/deputados'}>Ver {senate ? 'senadores' : 'deputados'} <ArrowRight size={12} /></Link></div>{cells.map(({ icon: Icon, value, label, detail }) => <div key={label} className={cn('flex min-h-28 flex-col justify-center rounded-xl border px-4 py-3', senate ? 'border-blue-100 bg-blue-50/65' : 'border-emerald-100 bg-emerald-50/65')}><div className="flex items-center gap-2"><Icon size={16} className={senate ? 'text-blue-700' : 'text-emerald-700'} /><span className="text-xs font-bold text-muted-foreground">{label}</span></div><strong className="mt-2 block text-xl leading-none tracking-tight">{value}</strong><small className="mt-2 block leading-4 text-muted-foreground">{detail}</small></div>)}</div></article>;
}

function SourceCard({ name, text, href, logo, wide = false, icon: Icon }: { name: string; text: string; href: string; logo?: string; wide?: boolean; icon?: LucideIcon }) { return <a href={href} className="focus-ring rounded-2xl border bg-background p-4 transition hover:border-primary"><div className="flex h-10 items-center">{logo ? <img src={logo} alt="" className={cn('object-contain object-left', wide ? 'h-7 w-36' : 'size-10')} /> : Icon ? <Icon className="text-primary" size={30} /> : null}</div><strong className="mt-3 block">{name}</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Acessar fonte <ArrowRight size={12} /></span></a>; }
