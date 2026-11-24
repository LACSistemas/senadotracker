import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, BarChart3, Building2, FileText, Landmark, ReceiptText, Scale, Users, Vote } from 'lucide-react';
import { ufs, type DataCoverage, type Source } from '@senadotracker/domain';
import type { HousePanorama as HousePanoramaData } from '@senadotracker/db';
import { legislativeOverview, voteMatchDataset, houseMetricSummary, type LegislativeOverviewSort } from '@/lib/data';
import { getStateLegislativeNumbers, type StateLegislativeNumbers } from '@/lib/state-legislative-numbers';
import { VoteMatch, type VoteMatchDataset } from '@/components/legislative/vote-match';
import { OfficialPortrait } from '@/components/app-image';
import { SearchBar, FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { ComparisonBar } from '@/components/comparison-bar';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { memo } from '@/lib/security/load';
import { stateChoropleth } from '../../../../packages/db/src/benchmarks.ts';
import { mapMarkup } from '@/components/brazil-map-markup';
import { paintStateMap, markupUfs, type StatePaint } from '@/components/state-map-paint';
import { mapRamps, emptyFill, darkFrom } from '@/lib/scale';

export const dynamic = 'force-dynamic';
type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;
const int = new Intl.NumberFormat('pt-BR');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 1 });
const moneyFull = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const ratio = (value: number | null) => value === null ? '—' : percent.format(value);
const UF_NAMES: Record<string, string> = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };

function pageUrl(params: Record<string, string | undefined>, page: number, anchor?: string) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  if (page > 1) query.set('pagina', String(page));
  return `/legislativo?${query}${anchor ? `#${anchor}` : ''}`;
}

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
  // Hero: mapa coroplético de custo total mediano por UF — Casa segue o filtro `casa` já existente na
  // página; sem filtro, usa a Câmara (8 a 70 deputados por UF, mais variação que os 3 senadores fixos).
  const mapHouse: Source = source ?? 'camara';
  const [voteMatchSenado, voteMatchCamara, metricSummary] = await Promise.all([voteMatchDataset('senado'), voteMatchDataset('camara'), houseMetricSummary(mapHouse)]);
  const voteMatchDatasets: Record<'senado' | 'camara', VoteMatchDataset | null> = {
    senado: voteMatchSenado.status === 'available' ? voteMatchSenado.data : null,
    camara: voteMatchCamara.status === 'available' ? voteMatchCamara.data : null,
  };
  const selected = { casa: source, uf, partido: party, busca: search, ordenacao: sort };

  // Mesma leitura certificada já usada em /quem-me-representa (houseMetricSummary + stateChoropleth) —
  // nenhuma consulta nova, só reaproveitada aqui pro mapa do hero.
  const choropleth = metricSummary.status === 'available' ? stateChoropleth(metricSummary.data, 'totalCostCents') : null;
  const choroYear = metricSummary.status === 'available' ? metricSummary.data.year : null;
  const choroByUf = new Map((choropleth?.items ?? []).map(item => [item.uf, item] as const));
  const heroMapPaints = new Map<string, StatePaint>(markupUfs(mapMarkup).map(mapUf => {
    const item = choroByUf.get(mapUf);
    const band = item?.bucket ?? -1;
    const label = item?.value != null ? moneyFull.format(item.value / 100) : 'sem dado suficiente';
    return [mapUf, {
      fill: band < 0 ? emptyFill : mapRamps.rose[band]!,
      ...(band >= darkFrom ? { ink: '#fff' } : {}),
      href: pageUrl({ ...selected, uf: mapUf }, 1, 'explore-dados'),
      title: `${UF_NAMES[mapUf] ?? mapUf}: ${label}`,
      ariaLabel: label,
    }];
  }));
  const heroMap = paintStateMap(mapMarkup, heroMapPaints, {
    variant: 'legislativo-cost-map', emptyFill,
    description: `Custo total identificado (mediana por UF), ${mapHouse === 'senado' ? 'senadores' : 'deputados federais'}${choroYear ? `, ${choroYear}` : ''}; selecione um estado para ver o valor e filtrar a tabela.`,
    href: mapUf => pageUrl({ ...selected, uf: mapUf }, 1, 'explore-dados'),
  });
  const selectedChoroItem = uf ? choroByUf.get(uf) : undefined;

  // "O Congresso em 5 números" (pedido do usuário, mesmo padrão de "O Brasil em 5 números" em /executivo):
  // nenhuma consulta nova — tudo já vem do próprio legislativeOverview carregado acima.
  const totalParlamentares = panoramas.senado.roster.parliamentarians + panoramas.camara.roster.parliamentarians;
  const monthlyCostTotal = (monthlyCosts.senado.totalCents ?? 0) + (monthlyCosts.camara.totalCents ?? 0);
  const monthlyCostAvailable = monthlyCosts.senado.totalCents != null || monthlyCosts.camara.totalCents != null;
  const topParty = [...facets.parties].sort((a, b) => b.count - a.count)[0] ?? null;
  const totalProposals = (panoramas.senado.activity.proposals ?? 0) + (panoramas.camara.activity.proposals ?? 0);
  const congressKpis = [
    { id: 'parlamentares', label: 'Parlamentares', icon: Users, value: int.format(totalParlamentares), sub: `${int.format(panoramas.senado.roster.parliamentarians)} senadores · ${int.format(panoramas.camara.roster.parliamentarians)} deputados federais` },
    { id: 'custo-mensal', label: 'Custo mensal total', icon: ReceiptText, value: monthlyCostAvailable ? moneyCompact.format(monthlyCostTotal / 100) : '—', sub: 'Cota + gabinete + subsídio, Senado + Câmara' },
    { id: 'maior-bancada', label: 'Maior bancada', icon: Building2, value: topParty ? topParty.value : '—', sub: topParty ? `${int.format(topParty.count)} parlamentares` : 'sem cadastro' },
    { id: 'proposicoes', label: 'Proposições apresentadas', icon: FileText, value: int.format(totalProposals), sub: `Senado ${years.senado} + Câmara ${years.camara}` },
    { id: 'partidos', label: 'Partidos representados', icon: BarChart3, value: int.format(facets.parties.length), sub: 'Senado + Câmara, cadastro ativo' },
  ];
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
      <section className="page-shell py-4 sm:py-6">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] text-white">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0a2f26] via-[#0e4939] to-[#123f33]" />
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1fr] lg:gap-8 lg:p-8">
            <div className="flex flex-col justify-center">
              <p className="eyebrow text-white/70">Legislativo · Congresso Nacional</p>
              <h1 className="display-title text-balance mt-2 text-xl leading-[1.1] sm:text-3xl lg:text-[1.95rem]">Entenda quem te representa, pelos dados.</h1>
              <p className="mt-2 max-w-lg text-xs leading-5 text-white/80 sm:text-sm sm:leading-6">Acompanhe gastos, presença, votações, atuação legislativa, gabinete e histórico eleitoral de senadores e deputados federais, com base em fontes oficiais e dados atualizados.</p>
              <div className="mt-3 max-w-md rounded-xl bg-white p-1.5 text-foreground"><SearchBar action="/legislativo#explore-dados" defaultValue={search ?? ''} placeholder="Buscar senador, deputado, partido ou estado..." /></div>
              <div className="mt-2 flex flex-wrap gap-x-2 text-[0.7rem] text-white/75"><span>Exemplos:</span><Link href="/legislativo?busca=Flávio+Bolsonaro" className="underline">Flávio Bolsonaro</Link><span>•</span><Link href="/legislativo?busca=Gleisi+Hoffmann" className="underline">Gleisi Hoffmann</Link><span>•</span><Link href="/legislativo?partido=PL" className="underline">PL</Link><span>•</span><Link href="/legislativo?uf=SP" className="underline">São Paulo</Link></div>
              <nav aria-label="Atalhos do Legislativo" className="mt-2 flex flex-wrap gap-1.5">
                {([['#legislativo-em-numeros', 'Panorama por Casa'], ['#como-voto', 'Vote Match'], ['/legislativo/rankings', 'Rankings'], ['/legislativo/proposicoes', 'Proposições']] as const).map(([href, label]) => (
                  <Link key={href} href={href} className="rounded-full border border-white/25 px-2.5 py-0.5 text-[0.68rem] font-bold text-white/85 hover:bg-white/10">{label}</Link>
                ))}
              </nav>
            </div>

            <div className="flex h-full flex-col rounded-2xl bg-white/[0.05] p-4 ring-1 ring-inset ring-white/10 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[0.68rem] font-bold uppercase tracking-wider text-white/60">Custo total identificado (mediana), por UF</p>
                <p className="text-[0.68rem] text-white/45">{mapHouse === 'senado' ? 'Senado' : 'Câmara'} · {choroYear ?? '—'}</p>
              </div>
              <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-4 sm:flex-row">
                <div className="w-full max-w-[210px] shrink-0 sm:max-w-[230px]">
                  <div dangerouslySetInnerHTML={{ __html: heroMap }} />
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[0.6rem] text-white/55">
                    {mapRamps.rose.map((c, i) => <span key={i} className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm" style={{ background: c }} /> {['menor', '', '', '', 'maior'][i] || `faixa ${i + 1}`}</span>)}
                  </div>
                </div>
                <div className="w-full min-w-0 rounded-xl border border-white/10 bg-black/10 p-4 sm:max-w-xs">
                  {uf && selectedChoroItem?.value != null ? (
                    <>
                      <p className="text-[0.68rem] font-bold uppercase text-white/55">{UF_NAMES[uf] ?? uf}</p>
                      <p className="mt-1 text-2xl font-black">{moneyCompact.format(selectedChoroItem.value / 100)}</p>
                      <p className="mt-0.5 text-[0.68rem] text-white/55">custo total mediano · {mapHouse === 'senado' ? 'Senado' : 'Câmara'}{choroYear ? ` · ${choroYear}` : ''}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.68rem]"><Link href={pageUrl({ ...selected, uf }, 1, 'explore-dados')} className="font-bold text-white underline">Ver parlamentares</Link></div>
                    </>
                  ) : uf ? (
                    <p className="text-[0.7rem] leading-4 text-white/65">Sem dado suficiente de custo para {UF_NAMES[uf] ?? uf} nesta Casa.</p>
                  ) : (
                    <p className="text-[0.7rem] leading-4 text-white/65">Selecione um estado no mapa para ver o custo total mediano exato.</p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[0.6rem] leading-4 text-white/50">Mediana de custo total identificado (cota + gabinete + subsídio) por UF, só entre {mapHouse === 'senado' ? 'senadores' : 'deputados federais'} com as três parcelas publicadas no mesmo mês — Casas nunca são somadas.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-10">
        <div className="page-shell">
          <div className="flex items-start gap-3">
            <Users className="mt-1 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-3xl font-black tracking-tight">O Congresso em 5 números</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Um retrato rápido do Senado e da Câmara juntos — representação, custo e produção legislativa, direto dos cadastros oficiais.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {congressKpis.map(k => (
              <div key={k.id} className="rounded-2xl border bg-background p-4">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><k.icon size={13} aria-hidden /> {k.label}</span>
                <strong className="display-title mt-1.5 block text-2xl leading-none">{k.value}</strong>
                <span className="mt-1.5 block text-xs text-muted-foreground">{k.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell py-6">
        <Link href="#como-voto" className="focus-ring group flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 transition hover:border-primary sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Vote size={20} aria-hidden /></span>
            <div>
              <strong className="display-title block text-xl">Descubra quem vota como você</strong>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">Responda a votações nominais reais do Senado ou da Câmara e veja o parlamentar — e o partido — mais parecido e mais oposto a você.</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition group-hover:gap-2.5">Jogar agora <ArrowRight size={15} /></span>
        </Link>
      </section>

      <section id="legislativo-em-numeros" className="scroll-mt-20 border-y bg-card"><div className="page-shell py-10">
        <SectionTitle title="Legislativo em Números" subtitle={`Um panorama do Senado Federal, da Câmara dos Deputados e das Assembleias Legislativas, com os períodos publicados mais recentes (${years.senado}/${years.camara}).`} />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <HouseCard source="senado" year={years.senado} data={panoramas.senado} monthlyCost={monthlyCosts.senado} processingTime={processingTimes.senado} />
          <HouseCard source="camara" year={years.camara} data={panoramas.camara} monthlyCost={monthlyCosts.camara} processingTime={processingTimes.camara} />
          {stateNumbers && <StateAssemblyCard numbers={stateNumbers} />}
        </div>
      </div></section>


      <section id="como-voto" className="scroll-mt-20 page-shell py-10">
        <SectionTitle title="Qual parlamentar vota como você?" subtitle="Responda a votações nominais reais do Senado ou da Câmara e descubra com quais parlamentares você mais — e menos — concorda, a partir do voto de verdade de cada um." />
        <div className="mt-6"><VoteMatch datasets={voteMatchDatasets} /></div>
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
