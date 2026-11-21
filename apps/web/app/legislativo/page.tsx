import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, BarChart3, Building2, FileText, Landmark, MapPin, ReceiptText, Scale, Store, TrendingUp, Users, Vote } from 'lucide-react';
import { ufs, type DataCoverage, type Source } from '@senadotracker/domain';
import type { HousePanorama as HousePanoramaData } from '@senadotracker/db';
import { legislativeOverview, type LegislativeOverviewSort } from '@/lib/data';
import { getStateLegislativeNumbers, type StateLegislativeNumbers } from '@/lib/state-legislative-numbers';
import { OfficialPortrait } from '@/components/app-image';
import { SearchBar, FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { ComparisonBar } from '@/components/comparison-bar';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { memo } from '@/lib/security/load';

export const dynamic = 'force-dynamic';
type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;
const int = new Intl.NumberFormat('pt-BR');
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
  ['Fornecedores', 'Veja quem recebe recursos públicos do Congresso, em contratos e em gabinetes.', '/legislativo/fornecedores', Store, 'text-rose-700 bg-rose-50'],
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
  const sortValue=scalar(params.ordenacao);
  const validSorts=new Set<LegislativeOverviewSort>(['uf_asc','uf_desc','party_asc','party_desc','cost_asc','cost_desc','presence_asc','presence_desc']);
  const sort=sortValue&&validSorts.has(sortValue as LegislativeOverviewSort)?sortValue as LegislativeOverviewSort:undefined;
  const rawPage = Number(scalar(params.pagina) ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const overviewQuery = { page, pageSize: 5, ...(source ? { source } : {}), ...(uf ? { uf } : {}), ...(party ? { party } : {}), ...(search ? { search } : {}), ...(sort?{sort}:{}) };
  // Cacheado por combinação de filtros (2 min, mesmo padrão de `/executivo`): a esmagadora maioria das
  // visitas usa a mesma combinação (sem filtro, página 1) — sem isso, `legislativeOverview` reconstrói
  // o roster + métricas das 2 casas do zero a cada carga (medido: ~3,4s sozinho).
  const data = await memo(`legislativo:overview:${JSON.stringify(overviewQuery)}`, () => Promise.resolve(legislativeOverview(overviewQuery)), 2 * 60_000);
  if (data.status === 'unavailable') return <main id="conteudo" tabIndex={-1} className="page-shell py-12"><EmptyState page title="Entrada legislativa indisponível" description={data.message} /></main>;

  const { panoramas, processingTimes, years, result, facets, monthlyCosts } = data.data;
  const stateNumbers = await memo('legislativo:state-numbers', getStateLegislativeNumbers, 2 * 60_000);
  const selected = { casa: source, uf, partido: party, busca: search, ordenacao: sort };
  const mixedCoverage: DataCoverage = { availability: 'available', source: 'multiple', period: { from: null, to: null, grain: 'snapshot' }, batchId: null, note: 'Cadastro ativo; cada métrica conserva período e cobertura próprios.', sampleSize: result.items.length };
  type Item = (typeof result.items)[number];
  const sortableHeader=(label:string,key:'uf'|'party'|'cost'|'presence',align:'left'|'right'='left')=>{const active=sort?.startsWith(`${key}_`),next:LegislativeOverviewSort=active&&sort?.endsWith('_asc')?`${key}_desc`:`${key}_asc`,Icon=!active?ArrowUpDown:sort?.endsWith('_asc')?ArrowUp:ArrowDown;return <Link prefetch={false} href={pageUrl({...selected,ordenacao:next},1,'explore-dados')} className={cn('focus-ring inline-flex items-center gap-1.5 rounded-md font-bold hover:text-primary',align==='right'&&'justify-end')} aria-label={`${label}: ${active&&sort?.endsWith('_asc')?'ordem crescente; mudar para decrescente':active?'ordem decrescente; mudar para crescente':'ordenar em ordem crescente'}`} aria-current={active?'true':undefined}>{label}<Icon size={14}/></Link>};
  const columns: DataColumn<Item>[] = [
    { key: 'name', header: 'Nome', render: item => <div className="flex items-center gap-3"><div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted"><OfficialPortrait src={item.photoUrl} name={item.name} sizes="40px" /></div><div><Link prefetch={false} className="font-bold text-primary underline" href={`/legislativo/${item.source==='senado'?'senadores':'deputados'}/${item.externalId}`}>{item.name}</Link><small className="mt-1 flex items-center gap-1.5 text-muted-foreground"><Badge>{item.party}</Badge></small></div></div> },
    { key: 'uf', header: sortableHeader('Estado','uf'), render: item => item.uf },
    { key: 'role', header: 'Cargo', render: item => item.source === 'senado' ? 'Senador' : 'Deputado federal' },
    { key: 'cost', header: sortableHeader(`Custo total (${itemYear(years)})`,'cost','right'), align: 'right', render: item => item.totalCostCents === null ? <span className="text-muted-foreground" title="Uma ou mais parcelas não estão publicadas">—<small className="block">cobertura incompleta</small></span> : <span title={`Cota: ${money.format(item.expenseCents! / 100)} · Gabinete: ${money.format(item.cabinetCents! / 100)} · Subsídio: ${money.format(item.salaryCents! / 100)} (${item.salaryMonths} meses)`}><strong>{money.format(item.totalCostCents / 100)}</strong><small className="block whitespace-nowrap text-muted-foreground">cota + gabinete + subsídio</small></span> },
    { key: 'votes', header: 'Votação nominal (%)', align: 'right', render: item => item.participation.numerator === null || !item.participation.denominator ? <span className="text-muted-foreground">—</span> : percent.format(item.participation.numerator / item.participation.denominator) },
    { key: 'proposals', header: 'Proposições', align: 'right', render: item => <Link prefetch={false} className="font-bold text-primary underline" href={`/legislativo/${item.source==='senado'?'senadores':'deputados'}/${item.externalId}/atuacao-parlamentar#producao`}>{item.proposalCount}</Link> },
    { key: 'cabinet', header: 'Gabinete', align: 'right', render: item => <div>{item.staff===null?<span className="text-muted-foreground">—</span>:<strong>{item.staff} vínculos</strong>}<small className="block whitespace-nowrap text-muted-foreground">{item.cabinetFinancialCents===null?'financeiro indisponível':`${money.format(item.cabinetFinancialCents/100)} · ${item.cabinetPeriod}`}</small></div> },
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
              <div className="mt-5 max-w-xl rounded-xl bg-white p-2 text-foreground"><SearchBar action="/legislativo#explore-dados" defaultValue={search ?? ''} placeholder="Buscar senador, deputado, partido ou estado..." /></div>
              <div className="mt-3 flex flex-wrap gap-x-2 text-xs text-white/75"><span>Exemplos:</span><Link href="/legislativo?busca=Flávio+Bolsonaro" className="underline">Flávio Bolsonaro</Link><span>•</span><Link href="/legislativo?busca=Gleisi+Hoffmann" className="underline">Gleisi Hoffmann</Link><span>•</span><Link href="/legislativo?partido=PL" className="underline">PL</Link><span>•</span><Link href="/legislativo?uf=SP" className="underline">São Paulo</Link></div>
            </div>
            <div className="hidden h-full flex-col items-end justify-between text-right md:flex"><p className="max-w-xs rotate-[-2deg] font-serif text-3xl italic leading-tight text-white/90">Mais transparência para um Brasil mais forte.</p><div className="rounded-xl border border-white/20 bg-black/25 px-4 py-3 text-left text-xs"><strong className="block text-sm">Congresso Nacional</strong>Brasília · DF</div></div>
          </div>
        </div>
      </section>

      <section className="border-y bg-card"><div className="page-shell py-10">
        <SectionTitle title="Legislativo em Números" subtitle={`Um panorama do Senado Federal, da Câmara dos Deputados e das Assembleias Legislativas, com os períodos publicados mais recentes (${years.senado}/${years.camara}).`} />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <HouseCard source="senado" year={years.senado} data={panoramas.senado} monthlyCost={monthlyCosts.senado} processingTime={processingTimes.senado} />
          <HouseCard source="camara" year={years.camara} data={panoramas.camara} monthlyCost={monthlyCosts.camara} processingTime={processingTimes.camara} />
          {stateNumbers && <StateAssemblyCard numbers={stateNumbers} />}
        </div>
      </div></section>


      <section className="page-shell py-10">
        <SectionTitle title="Comece por aqui" subtitle="Escolha um caminho para explorar os dados." />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <QuickPath title="Senadores" text={`Conheça os ${panoramas.senado.roster.parliamentarians} senadores, seus gastos, votações e mais.`} href="/legislativo/senadores" icon={Landmark} tone="bg-blue-50 text-blue-700" compact />
          <QuickPath title="Deputados Federais" text={`Explore os ${panoramas.camara.roster.parliamentarians} deputados federais e sua atuação na Câmara.`} href="/legislativo/deputados" icon={Users} tone="bg-emerald-50 text-emerald-700" compact />
          <QuickPath title="Deputados Estaduais" text="Explore deputados estaduais e distritais, suas Assembleias, atuação, gastos e dados disponíveis em cada estado." href="/legislativo/estaduais" icon={Landmark} tone="bg-teal-50 text-teal-700" compact />
          <QuickPath title="Partidos" text="Veja a atuação dos partidos no Congresso Nacional." href="/legislativo/partidos" icon={Building2} tone="bg-violet-50 text-violet-700" compact />
          <QuickPath title="Estados" text="Compare a representatividade e os dados por estado." href="/quem-me-representa" icon={MapPin} tone="bg-amber-50 text-amber-700" compact />
          <QuickPath title="Proposições" text="Acompanhe projetos, PECs e outras matérias legislativas." href="/legislativo/proposicoes" icon={FileText} tone="bg-sky-50 text-sky-700" compact />
        </div>
      </section>

      <section className="page-shell py-12">
        <SectionTitle title="O que você pode descobrir?" subtitle="Explore diferentes aspectos da atuação dos parlamentares." />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{discovery.slice(0,4).map(([title, text, href, Icon, tone]) => <QuickPath key={title} title={title} text={text} href={href} icon={Icon} tone={tone} compact />)}</div>
        <div className="mt-10 flex items-end justify-between gap-4 border-t pt-8"><div><h3 className="text-xl font-black">Ferramentas para explorar</h3><p className="mt-1 text-sm text-muted-foreground">Buscas, cruzamentos e comparações com páginas próprias.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{discovery.slice(4).map(([title, text, href, Icon, tone]) => <QuickPath key={title} title={title} text={text} href={href} icon={Icon} tone={tone} compact />)}</div>
      </section>

      <section id="explore-dados" className="scroll-mt-6 border-y bg-card"><div className="page-shell py-12">
        <div className="flex flex-wrap items-end justify-between gap-4"><SectionTitle title="Explore os dados" subtitle="Acesse perfis completos de parlamentares do Congresso." /><div className="flex rounded-xl bg-muted p-1">{[[undefined, 'Todos'], ['senado', 'Senado'], ['camara', 'Câmara']].map(([value, label]) => <Link key={label} href={pageUrl({ ...selected, casa: value }, 1, 'explore-dados')} className={cn('rounded-lg px-4 py-2 text-sm font-bold', source === value || (!source && !value) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>{label}</Link>)}</div></div>
        <div className="mt-6"><FilterBar action="/legislativo#explore-dados" fields={[{ name: 'uf', label: 'Estado', value: uf ?? '', options: [{ value: '', label: 'Todos' }, ...facets.ufs.map(item => ({ value: item.value, label: `${item.value} · ${item.count}` }))] }, { name: 'partido', label: 'Partido', value: party ?? '', options: [{ value: '', label: 'Todos' }, ...facets.parties.map(item => ({ value: item.value, label: `${item.value} · ${item.count}` }))] }]}><input type="hidden" name="casa" value={source ?? ''} /><input type="hidden" name="busca" value={search ?? ''} /><input type="hidden" name="ordenacao" value={sort??''}/></FilterBar></div>
        <div className="mt-5"><DataTable caption="Parlamentares do Congresso" columns={columns} rows={result.items} rowKey={item => `${item.source}:${item.externalId}`} coverage={mixedCoverage} page={page} pageCount={Math.max(1, Math.ceil(result.total / 5))} pageHref={next => pageUrl(selected, next,'explore-dados')} /></div>
        <Link href={source === 'camara' ? '/legislativo/deputados' : source === 'senado' ? '/legislativo/senadores' : '/legislativo/senadores'} className="mt-5 inline-flex items-center gap-2 font-bold text-primary underline">Ver mais parlamentares <ArrowRight size={15} /></Link>
      </div></section>

      <section className="page-shell py-12"><div className="grid gap-5 rounded-2xl border bg-card p-6 lg:grid-cols-[.8fr_2.2fr] lg:items-center"><div><Scale className="text-primary" /><h2 className="mt-3 text-xl font-bold">Compare parlamentares</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Escolha pessoas da mesma Casa e compare dimensões lado a lado, sem nota geral.</p></div><ComparisonBar source={source ?? 'senado'} count={2} options={result.items.map(item => ({ id: item.externalId, label: `${item.name} · ${item.party}/${item.uf}`, source: item.source }))} /></div></section>

      <section className="border-t bg-card"><div className="page-shell py-12"><SectionTitle title="De onde vêm os dados?" subtitle="Todas as informações são de fontes oficiais e públicas." /><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SourceCard name="Senado Federal" text="Parlamentares, votações, comissões e despesas." href="https://www12.senado.leg.br/dados-abertos/" logo="/source-logos/senado.png" /><SourceCard name="Câmara dos Deputados" text="Parlamentares, proposições e atividade legislativa." href="https://dadosabertos.camara.leg.br/" logo="/source-logos/camara.png" wide /><SourceCard name="TSE" text="Dados eleitorais, partidos, candidaturas e bens." href="https://dadosabertos.tse.jus.br/" logo="/source-logos/tse.png" /><SourceCard name="Portal da Transparência" text="Referências públicas sobre gastos e execução orçamentária." href="https://portaldatransparencia.gov.br/" icon={Landmark} /></div></div></section>
    </main>
  );
}

const itemYear = (years: Record<Source, number>) => years.senado === years.camara ? years.senado : 'ano publicado';

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-3xl font-black tracking-tight">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{subtitle}</p></div>; }

function QuickPath({ title, text, href, icon: Icon, tone, compact = false }: { title: string; text: string; href: string; icon: LucideIcon; tone: string; compact?: boolean }) { return <Link prefetch={false} href={href} className={cn('focus-ring group flex rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm', compact ? 'min-h-32 flex-col' : 'min-h-28 items-start gap-3')}><span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone)}><Icon size={19} /></span><span className="min-w-0 flex-1"><strong className="block leading-tight">{title}</strong><small className="mt-1.5 block leading-5 text-muted-foreground">{text}</small></span><ArrowRight size={16} className={cn('shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary', compact && 'mt-auto self-end')} /></Link>; }

/** Card no mesmo padrão visual de "Como a Justiça está organizada" (/judiciario) e "A federação em
 * números" (/executivo): foto da fachada, selo com o tamanho do grupo, grade 2x2 de métricas e 1
 * estatística em destaque na faixa inferior. Conteúdo idêntico ao da antiga `HousePanorama`/`StatePanorama`
 * (tabela larga com rolagem horizontal) — só a forma muda. */
function LegislativeCard({ photo, photoAlt, credit, label, badge, subtitle, stats, headline, caveats, href, hrefLabel }: {
  photo: string; photoAlt: string; credit: string; label: string; badge: string; subtitle: string;
  stats: Array<{ icon: LucideIcon; label: string; value: string; detail: string }>;
  headline: { icon: LucideIcon; label: string; value: string };
  caveats: string[]; href: string; hrefLabel: string;
}) {
  return <div className="flex flex-col overflow-hidden rounded-2xl border bg-background">
    <div className="relative h-36 w-full bg-muted">
      <Image src={photo} alt={photoAlt} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
      <span className="absolute bottom-1 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[0.55rem] leading-none text-white/85">Foto: {credit}</span>
    </div>
    <div className="flex flex-1 flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="display-title text-xl leading-tight">{label}</h3>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">{badge}</span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{subtitle}</p>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t pt-4">
        {stats.map(s => <div key={s.label} className="min-w-0">
          <span className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground"><s.icon size={13} aria-hidden /> {s.label}</span>
          <strong className="display-title mt-1 block text-xl leading-none">{s.value}</strong>
          <span className="mt-1 block text-[0.65rem] text-muted-foreground">{s.detail}</span>
        </div>)}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3">
        <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><headline.icon size={14} aria-hidden /> {headline.label}</span>
        <strong className="display-title text-lg leading-none">{headline.value}</strong>
      </div>

      {caveats.map(c => <p key={c} className="mt-3 text-[0.65rem] leading-4 text-muted-foreground">{c}</p>)}
      <Link href={href} className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary underline">{hrefLabel} <ArrowRight size={12} /></Link>
    </div>
  </div>;
}

const LEGISLATIVE_HOUSE_META = {
  senado: { label: 'Senado Federal', subtitle: 'A Casa da Federação.', photo: '/legislativo/senado.jpg', photoAlt: 'Fachada do Palácio do Congresso Nacional, sede do Senado Federal', credit: 'Pedro França/Agência Senado · CC BY 2.0' },
  camara: { label: 'Câmara dos Deputados', subtitle: 'A voz do povo brasileiro.', photo: '/legislativo/camara.jpg', photoAlt: 'Fachada do Palácio do Congresso Nacional, sede da Câmara dos Deputados', credit: 'Luciano Raguzzoni · CC BY-SA 4.0' },
} as const;

function HouseCard({ source, year, data, monthlyCost, processingTime }: { source: Source; year: number; data: HousePanoramaData; monthlyCost: { meanCents: number | null; totalCents: number | null; sampleSize: number }; processingTime: { meanDays: number | null; medianDays: number | null; sampleSize: number; note: string } }) {
  const senate = source === 'senado';
  const meta = LEGISLATIVE_HOUSE_META[source];
  const stats = [
    { icon: Users, label: senate ? 'senadores' : 'deputados federais', value: int.format(data.roster.parliamentarians), detail: senate ? 'representação dos estados e do DF' : 'representando todo o país' },
    { icon: ReceiptText, label: 'custo por mês', value: monthlyCost.totalCents === null ? '—' : money.format(monthlyCost.totalCents / 100), detail: 'salário do cargo + cota + gabinete no período comum' },
    { icon: ReceiptText, label: 'custo médio mensal', value: monthlyCost.meanCents === null ? '—' : money.format(monthlyCost.meanCents / 100), detail: `subsídio + cota + gabinete · n=${monthlyCost.sampleSize}` },
    { icon: FileText, label: 'tempo médio de tramitação', value: processingTime.meanDays === null ? 'N/D' : `${int.format(Math.round(processingTime.meanDays))} dias`, detail: processingTime.meanDays === null ? processingTime.note : `até decisão final · n=${processingTime.sampleSize}` },
  ];
  return <LegislativeCard photo={meta.photo} photoAlt={meta.photoAlt} credit={meta.credit} label={meta.label} subtitle={meta.subtitle} badge="1 Casa" stats={stats}
    headline={{ icon: BarChart3, label: 'participação em votações nominais', value: ratio(data.participation.meanRatio) }}
    caveats={[`Média entre parlamentares observáveis em votações nominais · ${year} · n=${data.participation.coverage.sampleSize ?? 0}.`]}
    href={senate ? '/legislativo/senadores' : '/legislativo/deputados'} hrefLabel={`Ver ${senate ? 'senadores' : 'deputados'}`} />;
}

const monthLabel = (month: string) => { const [year, mm] = month.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1] ?? mm}/${year}`; };

function StateAssemblyCard({ numbers }: { numbers: StateLegislativeNumbers }) {
  const { cost, proposals } = numbers;
  const stats = [
    { icon: Users, label: 'deputados estaduais', value: int.format(numbers.deputies), detail: `${numbers.houses} Casas · inclui ${numbers.districtDeputies} distritais (CLDF)` },
    { icon: ReceiptText, label: 'custo por mês', value: cost ? money.format(cost.totalCents / 100) : '—', detail: cost ? `salário do cargo + cota · ${cost.houses.length} de ${numbers.houses} Casas · ${monthLabel(cost.month)}` : 'sem mês comum utilizável' },
    { icon: ReceiptText, label: 'custo médio mensal', value: cost ? money.format(cost.meanCents / 100) : '—', detail: cost ? `salário + cota · n=${int.format(cost.deputies)}` : '—' },
    { icon: Building2, label: 'partidos nas Assembleias', value: int.format(numbers.parties), detail: `partidos distintos nas ${numbers.houses} Casas` },
  ];
  const caveats = [
    proposals ? `Proposições: média de ${int.format(proposals.total)} em ${proposals.houses} Assembleias · ${proposals.year}.` : 'Sem proposições publicadas.',
    ...(cost ? [`Custo desconsiderando gabinete: subsídio bruto + cotas e verbas indenizatórias publicadas, em ${monthLabel(cost.month)}, nas ${cost.houses.length} de ${numbers.houses} Assembleias com dados comparáveis. Cada Assembleia tem regras próprias.`] : []),
  ];
  return <LegislativeCard photo="/legislativo/alesp.jpg" photoAlt="Fachada do Palácio 9 de Julho, sede da Assembleia Legislativa de São Paulo" credit="LiaC · CC BY-SA 3.0"
    label="Assembleias Legislativas" subtitle="27 Casas, 27 realidades." badge={`${numbers.houses} Casas`} stats={stats}
    headline={{ icon: FileText, label: 'proposições por Assembleia', value: proposals ? int.format(proposals.perHouse) : 'N/D' }}
    caveats={caveats} href="/legislativo/estaduais" hrefLabel="Ver deputados estaduais" />;
}

function SourceCard({ name, text, href, logo, wide = false, icon: Icon }: { name: string; text: string; href: string; logo?: string; wide?: boolean; icon?: LucideIcon }) { return <a href={href} className="focus-ring rounded-2xl border bg-background p-4 transition hover:border-primary"><div className="flex h-10 items-center">{logo ? <img src={logo} alt="" className={cn('object-contain object-left', wide ? 'h-7 w-36' : 'size-10')} /> : Icon ? <Icon className="text-primary" size={30} /> : null}</div><strong className="mt-3 block">{name}</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Acessar fonte <ArrowRight size={12} /></span></a>; }
