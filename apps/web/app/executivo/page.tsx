import Link from 'next/link';
import { GraduationCap, HeartHandshake, HeartPulse, Route, ShieldAlert, Users } from 'lucide-react';
import { mapMarkup } from '@/components/brazil-map-markup';
import { paintStateMap, markupUfs, type StatePaint } from '@/components/state-map-paint';
import { sequentialRamp, emptyFill } from '@/lib/scale';
import { THEMES, formatInt } from '@/components/territory/territory-ui';
import { loadStates, loadNationalHealthSummary, isUf } from '@/lib/exec-territory';
import { loadHdiComparison, loadHdiAllStates } from '@/lib/territory-idhm';
import { loadWellbeingOverview } from '@/lib/wellbeing';
import {
  getInfrastructureWorksOverview, getInfrastructureWorksBySituation, getOrganizedCrimeNational, getIdebTerritory,
  getHealthBedsHistory, getHospitalizationsHistory, getFlowTerritory, getWellbeingSeries,
  getInfrastructureWorksRegisteredByYear, getInfrastructureWorksCommittedByYear,
} from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { loadBrasilIndicatorsCached } from '@/lib/infrastructure/load';
import { toChartCoverage, JudiciaryAvailabilityNote } from '@/components/judiciary/availability';
import { FederativeExplorer, type FederativeArea } from '@/components/executivo/federative-explorer';
import { LineChart, AreaTrend } from '@/components/charts';
import { memo } from '@/lib/security/load';

/** Todo o Promise.all da página não depende de searchParams (uf/indicador só pintam o mapa com dado já
 * carregado) — cacheado como uma unidade só (60s, mesmo TTL já usado em `loadInfrastructurePageCached`)
 * pra não repetir as consultas nacionais (obras, segurança, bem-estar, Ideb, leitos) a cada carga da página. */
async function loadExecutivoHubData() {
  return Promise.all([
    loadStates(),
    loadNationalHealthSummary(),
    loadHdiComparison({ level: 'BRASIL' }),
    loadHdiAllStates(),
    loadWellbeingOverview({ entityId: 76 }),
    loadBrasilIndicatorsCached(),
    getOrganizedCrimeNational(webPostgresPool()),
    getIdebTerritory(webPostgresPool(), { stage: 1 }),
    getInfrastructureWorksOverview(webPostgresPool(), { level: 'BRASIL' }),
    getInfrastructureWorksBySituation(webPostgresPool(), { level: 'BRASIL' }),
    // "As cinco áreas" (E-exec, pedido do usuário): 2 séries históricas reais por setor — as 7 abaixo são
    // as que faltavam; Educação (Ideb) e Segurança (tráfico) reaproveitam dado já carregado acima.
    getHealthBedsHistory(webPostgresPool()),
    getHospitalizationsHistory(webPostgresPool()),
    getFlowTerritory(webPostgresPool(), {}),
    getWellbeingSeries(webPostgresPool(), { entityId: 76 }, 'WB-LABOR-CAGED-BAL'),
    getWellbeingSeries(webPostgresPool(), { entityId: 76 }, 'WB-LABOR-RAIS-STOCK'),
    getInfrastructureWorksRegisteredByYear(webPostgresPool()),
    getInfrastructureWorksCommittedByYear(webPostgresPool()),
  ] as const);
}
const loadExecutivoHubDataCached = () => memo('executivo:hub', loadExecutivoHubData, 5 * 60_000);

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Executivo · Cívica', description: 'O Brasil que as políticas públicas revelam — saúde, educação, segurança, bem-estar e infraestrutura, estado por estado, com fontes oficiais.' };

const int = new Intl.NumberFormat('pt-BR');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const THEME_META: Record<string, { label: string; question: string; icon: typeof HeartPulse; anchor: string }> = {
  saude: { label: 'Saúde', question: 'Como o Brasil cuida de sua população?', icon: HeartPulse, anchor: 'saude' },
  educacao: { label: 'Educação', question: 'O que os alunos brasileiros estão aprendendo?', icon: GraduationCap, anchor: 'educacao' },
  seguranca: { label: 'Segurança', question: 'O que os registros revelam sobre a segurança pública?', icon: ShieldAlert, anchor: 'seguranca' },
  'bem-estar': { label: 'Bem-estar', question: 'Como vivem os brasileiros?', icon: HeartHandshake, anchor: 'bem-estar' },
  infraestrutura: { label: 'Infraestrutura', question: 'Que Brasil estamos construindo?', icon: Route, anchor: 'infraestrutura' },
};
const QUESTIONS = [
  ['Como está a cobertura de saúde na minha região?', '/estados', HeartPulse],
  ['Como evoluiu a aprendizagem nos últimos anos?', '/estados', GraduationCap],
  ['Quais são os desafios da segurança pública?', '/estados', ShieldAlert],
  ['Como está a renda e o trabalho no meu estado?', '/estados', HeartHandshake],
  ['Quais obras e serviços de infraestrutura estão em andamento?', '#recursos', Route],
] as const;

// "Quem cuida de quê" (E7-B): texto institucional validado por área de política pública — não há base
// estruturada de competências no banco, então o mandato (§12.2) autoriza texto cuidadosamente verificado
// em vez de uma funcionalidade de dado inexistente. Nenhuma competência é exclusiva quando a lei prevê
// cooperação; nenhuma hierarquia entre esferas é insinuada (§12.3).
const FEDERATIVE_AREAS: FederativeArea[] = [
  { key: 'saude', label: 'Saúde', icon: 'saude', question: 'Quem participa da oferta de serviços de saúde?',
    uniao: 'Define as políticas nacionais do SUS, regula e fiscaliza (Anvisa, ANS), e cofinancia o sistema por transferências a estados e municípios — além de manter hospitais federais e universitários.',
    estados: 'Organizam a rede regional entre municípios, mantêm hospitais e policlínicas estaduais, e cofinanciam o SUS — sempre em cooperação com a União e os municípios, nunca isoladamente.',
    municipios: 'Executam a atenção básica (UBS), a vigilância sanitária local e grande parte do atendimento direto à população — a porta de entrada do SUS para a maioria dos brasileiros.',
    shared: 'O SUS (Lei 8.080/1990) é um sistema único de gestão tripartite: comissões intergestores (CIT, nacional; CIB, estadual) decidem em conjunto como as responsabilidades se dividem em cada região.',
    href: '/estados#saude' },
  { key: 'educacao', label: 'Educação', icon: 'educacao', question: 'Como as responsabilidades educacionais se distribuem entre União, estados e municípios?',
    uniao: 'Define diretrizes nacionais (como a BNCC), complementa o financiamento das redes mais pobres pelo Fundeb, e mantém universidades e institutos federais.',
    estados: 'Respondem prioritariamente pelo ensino médio e por parte do ensino fundamental, mantendo as redes estaduais de escolas.',
    municipios: 'Respondem prioritariamente pela educação infantil e pelo ensino fundamental — a maior parte das matrículas do país está em redes municipais.',
    shared: 'O regime de colaboração entre as três esferas é previsto na Constituição (art. 211); o Fundeb redistribui recursos entre redes de diferentes municípios e estados conforme o número de matrículas, não por decisão isolada de uma esfera.',
    href: '/estados#educacao' },
  { key: 'seguranca', label: 'Segurança', icon: 'seguranca', question: 'Quem é responsável pela segurança pública no dia a dia?',
    uniao: 'Mantém a Polícia Federal e a Polícia Rodoviária Federal, e coordena nacionalmente o Sistema Único de Segurança Pública (SUSP, Lei 13.675/2018).',
    estados: 'Mantêm a Polícia Civil e a Polícia Militar — o policiamento ostensivo e a investigação criminal cotidianos no Brasil são, em grande parte, responsabilidade estadual.',
    municipios: 'Podem manter guardas municipais, de atuação mais limitada (sem polícia judiciária), voltadas sobretudo à proteção de bens, serviços e instalações municipais.',
    shared: 'O SUSP criou instâncias de cooperação entre as três esferas desde 2018, mas a espinha dorsal da segurança pública no Brasil continua sendo estadual — não há uma força nacional única.',
    href: '/estados#seguranca' },
  { key: 'assistencia', label: 'Assistência social', icon: 'assistencia', question: 'Quem sustenta a rede de proteção social no Brasil?',
    uniao: 'Coordena o Sistema Único de Assistência Social (SUAS) nacionalmente, cofinancia via Fundo Nacional de Assistência Social, e define benefícios como o BPC.',
    estados: 'Oferecem apoio técnico e cofinanciamento regional, com papel mais limitado de execução direta frente aos municípios.',
    municipios: 'Operam os CRAS e CREAS — a porta de entrada da proteção social básica e especializada, atendendo diretamente famílias em situação de vulnerabilidade.',
    shared: 'O cofinanciamento tripartite (União, estados e municípios) é regra no SUAS (Lei 8.742/1993, a LOAS) — nenhuma esfera sustenta a rede sozinha.',
    href: '/estados' },
  { key: 'infraestrutura', label: 'Infraestrutura', icon: 'infraestrutura', question: 'Quem decide e quem presta os serviços de saneamento?',
    uniao: 'Define o marco regulatório nacional do saneamento (Lei 14.026/2020), financia obras estruturantes, e estabelece metas de universalização até 2033.',
    estados: 'Companhias estaduais de saneamento prestam o serviço, por concessão, em grande parte dos municípios brasileiros.',
    municipios: 'São os titulares constitucionais do serviço de saneamento — decidem se operam diretamente, concedem à companhia estadual ou contratam outro operador.',
    shared: 'A titularidade do saneamento é municipal, mas a prestação é frequentemente estadual (ou por consórcio) — por delegação escolhida pelo titular, não por subordinação administrativa.',
    href: '/estados#infraestrutura' },
];

type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
const INDICATORS = [['populacao', 'População residente'], ['idhm', 'IDHM (2010)']] as const;

export default async function ExecutivoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const ufParam = scalar(sp.uf);
  const selectedUf = ufParam && isUf(ufParam) ? ufParam.toUpperCase() : undefined;
  const indicator = scalar(sp.indicador) === 'idhm' ? 'idhm' as const : 'populacao' as const;

  const [states, health, hdiBrasil, hdiStates, wellbeing, infraIndicators, orgCrime, idebBrasil, worksOverview, worksBySituation,
    bedsHistory, hospitalizationsHistory, flowTerritory, cagedBalSeries, raisStockSeries, worksRegisteredByYear, worksCommittedByYear,
  ] = await loadExecutivoHubDataCached();

  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const municipalityCount = 5571;
  // Achado real: `loadHdiComparison({level:'BRASIL'})` devolve o próprio Brasil em `.territory` (não em
  // `.brasil`, que fica null quando o território pedido já é o Brasil — ver territory-idhm.ts) — a
  // referência nacional nunca aparecia (bug pré-existente, não desta sessão; corrigido ao descobrir a
  // mesma causa reaparecendo na nova página /executivo/federal).
  const idhmBrasil2010 = hdiBrasil.territory?.points.find(p => p.year === 2010)?.idhm ?? null;
  const rendaBrasil = ((wellbeing?.observations ?? []) as any[]).find(o => o.indicatorCode === 'WB-INC-RDPC-MEAN');
  const esgotoBrasil = infraIndicators.find(i => i.code === 'IES0001');
  const trafficSeries = orgCrime.series.find(s => s.family === 'OC.DRUG.TRAFFICKING_RECORDS');
  const trafficLatest = trafficSeries?.years.filter(y => y.complete).at(-1) ?? null;
  const idebRows = ((idebBrasil?.rows ?? []) as any[]).filter(r => r.dep === 0).sort((a, b) => a.year - b.year);
  const idebRow = idebRows.find(r => r.year === Math.max(...(idebBrasil?.editions ?? [0])));
  const idebYear = idebBrasil ? Math.max(...idebBrasil.editions) : null;

  // EDUCAÇÃO — evolução do Ideb (anos iniciais, todas as redes) por edição; nunca a mesma série do hero.
  const idebChartData = idebRows.map(r => ({ label: String(r.year), value: r.values?.ideb ?? null }));

  // SEGURANÇA — evolução anual dos registros de tráfico (VDE, abrangência Estadual, 27 UFs); anos
  // incompletos (nem todas as 27 UFs × 12 meses) viram lacuna, nunca um valor parcial disfarçado de total.
  const trafficYears = trafficSeries?.years ?? [];
  const trafficTrend = trafficYears.map(y => ({ label: String(y.year), value: y.complete ? y.value : null }));

  // "AS CINCO ÁREAS" — 2 séries históricas reais por setor (pedido do usuário), cada setor com sua cor de
  // assinatura (mesmas rampas já validadas do produto, reaproveitadas — nunca uma paleta nova): Saúde=verde
  // (`--primary`), Educação=azul, Segurança=vermelho/rose, Desenvolvimento Social=roxo/violet,
  // Infraestrutura=amarelo/amber. Todos os 10 gráficos usam o mesmo `LineChart`/`AreaTrend` compartilhados —
  // os cartões agora são de largura cheia (não a grade de 2 colunas da E7 antiga), então o `min-w-[620px]`
  // desses componentes não corta mais o último ponto como cortava nos cartões estreitos.
  const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const yearCoverage = (source: string, data: Array<{ label: string }>) => toChartCoverage('AVAILABLE', source, { from: data[0] ? `${data[0].label}-01-01` : null, to: data.length ? `${data.at(-1)!.label}-12-31` : null, grain: 'year' });

  const SAUDE_COLOR = 'var(--primary)';
  const bedsChartData = bedsHistory.map(r => ({ label: String(r.year), value: r.bedsExisting || null }));
  const bedsCoverage = yearCoverage('CNES/DataSUS · vigente em dezembro de cada ano', bedsChartData);
  const aihChartData = hospitalizationsHistory.map(r => ({ label: String(r.year), value: r.aih || null }));
  const aihCoverage = yearCoverage('SIH/DataSUS · internações custeadas pelo SUS', aihChartData);

  const EDUCACAO_COLOR = 'var(--map-blue-4)';
  const abandonoChartData = (flowTerritory?.series ?? []).map(r => ({ label: String(r.year), value: r.values.ab_fun ?? null }));
  const abandonoCoverage = yearCoverage('INEP · Indicadores Educacionais, ensino fundamental total', abandonoChartData);

  const SEGURANCA_COLOR = 'var(--map-rose-4)';
  const warrantsSeries = orgCrime.series.find(s => s.family === 'OC.ENFORCEMENT.ARREST_WARRANTS_SERVED' && s.source === 'VDE' && s.abrangencia === 'Estadual');
  const warrantsChartData = (warrantsSeries?.years ?? []).map(y => ({ label: String(y.year), value: y.complete ? y.value : null }));
  const warrantsCoverage = yearCoverage('Sinesp VDE · 27 UFs', warrantsChartData);

  const DEV_SOCIAL_COLOR = 'var(--map-violet-4)';
  const cagedBalChartData = (cagedBalSeries ?? []).map(o => ({ label: o.periodStart ? `${MONTH_ABBR[Number(o.periodStart.slice(5, 7)) - 1]}/${o.periodStart.slice(2, 4)}` : '—', value: o.value }));
  const cagedCoverage = toChartCoverage('AVAILABLE', 'Novo Caged (MTE) · saldo = admissões − desligamentos', { from: (cagedBalSeries ?? [])[0]?.periodStart ?? null, to: (cagedBalSeries ?? []).at(-1)?.periodStart ?? null, grain: 'month' });
  const raisChartData = (raisStockSeries ?? []).map(o => ({ label: o.periodStart?.slice(0, 4) ?? '—', value: o.value }));
  const raisCoverage = yearCoverage('RAIS (MTE) · estoque em 31/12', raisChartData);

  const INFRA_COLOR = 'var(--map-amber-4)';
  const worksRegisteredChartData = worksRegisteredByYear.map(r => ({ label: String(r.year), value: r.count }));
  const worksRegisteredCoverage = yearCoverage('Obrasgov · ano de cadastro', worksRegisteredChartData);
  const worksCommittedChartData = worksCommittedByYear.map(r => ({ label: String(r.year), value: r.committedCents / 100 }));
  const worksCommittedCoverage = yearCoverage('Obrasgov · valor empenhado', worksCommittedChartData);

  // Mapa único do hero: analítico desde a abertura — colorido pelo indicador selecionado, com legenda real
  // (mandato §14/§15). A versão anterior tinha 2 mapas (um neutro no hero, outro analítico numa seção
  // separada abaixo) — repetição cartográfica sem diferenciação (mandato §16). Agora é um só: a descoberta
  // territorial É o hero, não uma seção depois dele.
  const ufHdi = new Map(hdiStates.map(h => [h.entityId, h.idhm]));
  const stateByUfCode = new Map(states.map(s => [s.ufCode, s.uf]));

  const indicatorValueByUf = new Map<string, number>();
  if (indicator === 'populacao') {
    for (const s of states) if (s.population != null) indicatorValueByUf.set(s.uf, s.population);
  } else {
    for (const [ufCode, idhm] of ufHdi) { const uf = stateByUfCode.get(ufCode); if (uf) indicatorValueByUf.set(uf, idhm); }
  }
  const sortedValues = [...indicatorValueByUf.values()].sort((a, b) => a - b);
  const edges = [0.2, 0.4, 0.6, 0.8].map(q => sortedValues[Math.floor(q * sortedValues.length)] ?? 0);
  const paints = new Map<string, StatePaint>(markupUfs(mapMarkup).map(uf => {
    const value = indicatorValueByUf.get(uf);
    const band = value == null ? -1 : edges.filter(e => value >= e).length;
    const label = indicator === 'populacao' ? `${formatInt(value ?? null)} habitantes` : value != null ? value.toFixed(3) : 's/d';
    return [uf, { fill: band < 0 ? emptyFill : sequentialRamp[band]!, ...(band >= 3 ? { ink: '#fff' } : {}), href: `/executivo?indicador=${indicator}&uf=${uf}#explorar`, title: `${states.find(s => s.uf === uf)?.name ?? uf}: ${label}`, ariaLabel: label }];
  }));
  const analyticalMap = paintStateMap(mapMarkup, paints, { variant: 'exec-analytical-map', emptyFill, description: `Estados coloridos por ${indicator === 'populacao' ? 'população residente' : 'IDHM 2010'}; selecione um estado para ver o valor e abrir o perfil.`, href: uf => `/executivo?indicador=${indicator}&uf=${uf}#explorar` });
  const selectedState = selectedUf ? states.find(s => s.uf === selectedUf) : null;
  const selectedValue = selectedUf ? indicatorValueByUf.get(selectedUf) : undefined;

  const popYear = Math.max(...states.map(s => s.year ?? 0));
  const popCoverage = toChartCoverage('AVAILABLE', 'IBGE · soma das 27 UFs, ano mais recente publicado por UF', { from: `${popYear}-01-01`, to: `${popYear}-12-31`, grain: 'year' });
  const structureCoverage = toChartCoverage('AVAILABLE', 'Catálogo institucional civica_exec', { grain: 'snapshot' });
  const healthCompYear = health.competence != null ? Math.floor(health.competence / 100) : null;
  const healthCompMonth = health.competence != null ? health.competence % 100 : null;
  const healthCoverage = toChartCoverage('AVAILABLE', 'CNES/DataSUS', healthCompYear && healthCompMonth ? { from: `${healthCompYear}-${String(healthCompMonth).padStart(2, '0')}-01`, to: `${healthCompYear}-${String(healthCompMonth).padStart(2, '0')}-28`, grain: 'month' } : { grain: 'snapshot' });

  // "Recursos e entregas": situação das obras (Obrasgov) são categorias mutuamente exclusivas — cada obra
  // cadastrada tem exatamente 1 situação — diferente dos estágios financeiros (planejado/contratado/
  // empenhado/liquidado/pago, que são etapas do MESMO valor avançando, não categorias somáveis entre si;
  // por isso não construímos um funil com eles aqui — a mandato §19 veda somar estágios financeiros
  // distintos, e os valores reais não seguem uma progressão monotônica limpa nesta base).
  const SITUATION_COLOR: Record<string, string> = { Concluída: '#115b45', 'Em execução': '#2d7f93', Cadastrada: '#9fb8ad', Paralisada: '#d39a3c', Inacabada: '#c3656e', Cancelada: '#8a8578' };
  const situationRows = (worksBySituation as any[]).map(s => ({ label: String(s.label), count: Number(s.count) })).sort((a, b) => b.count - a.count);
  const situationMax = Math.max(...situationRows.map(s => s.count), 1);
  const situationTotal = situationRows.reduce((s, r) => s + r.count, 0);
  const concludedCount = situationRows.find(s => s.label === 'Concluída')?.count ?? 0;
  const concludedShare = situationTotal ? (concludedCount / situationTotal) * 100 : null;

  return (
    <main id="conteudo" tabIndex={-1}>
      <section id="explorar" className="page-shell py-6 sm:py-8">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] text-white">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0a2f26] via-[#0e4939] to-[#123f33]" />
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10 lg:p-14">
            <div className="flex flex-col justify-center">
              <p className="eyebrow text-white/70">Executivo · Atlas do Brasil</p>
              <h1 className="display-title text-balance mt-4 text-[2.4rem] leading-[1.05] sm:text-6xl lg:text-[3rem]">O Brasil que as políticas públicas revelam.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/80">Da escola do seu bairro aos serviços de saúde, da segurança às obras públicas. Selecione um indicador, explore o mapa e compare territórios.</p>
              <form action="/executivo/buscar" method="get" className="mt-7 flex w-full max-w-lg gap-2"><label className="sr-only" htmlFor="exec-q">Buscar município ou estado</label><input id="exec-q" name="q" placeholder="Buscar município ou estado" autoComplete="off" className="h-12 min-w-0 flex-1 rounded-full border-0 bg-white px-5 text-sm text-foreground" /><button type="submit" className="h-12 shrink-0 rounded-full bg-white px-6 text-sm font-bold text-primary">Buscar</button></form>
              <form action="/executivo" className="mt-4 flex flex-wrap items-center gap-2">
                {selectedUf && <input type="hidden" name="uf" value={selectedUf} />}
                <label htmlFor="indicador" className="text-xs font-bold text-white/70">Indicador do mapa</label>
                <select id="indicador" name="indicador" defaultValue={indicator} className="h-9 rounded-full border border-white/25 bg-white/10 px-3 text-sm text-white [color-scheme:dark]">
                  {INDICATORS.map(([v, l]) => <option key={v} value={v} className="text-foreground">{l}</option>)}
                </select>
                <button type="submit" className="h-9 rounded-full border border-white/35 px-4 text-sm font-bold text-white hover:bg-white/10">Aplicar</button>
              </form>
              <div className="mt-5 flex flex-wrap gap-2">{THEMES.map(t => { const m = THEME_META[t.slug]!; return <Link key={t.slug} href={`#${m.anchor}`} className="rounded-full border border-white/25 px-3 py-1 text-xs font-bold text-white/85 hover:bg-white/10">{m.label}</Link>; })}</div>
              <Link href="/executivo/federal" className="focus-ring mt-5 inline-flex items-center gap-1 text-sm font-bold text-white underline underline-offset-2">Ver o perfil do Governo Federal (presidente, IDH Global, PISA) →</Link>
            </div>

            <div className="flex flex-col rounded-2xl bg-white/[0.05] p-5 ring-1 ring-inset ring-white/10 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">{indicator === 'populacao' ? 'População residente' : 'IDHM 2010'}</p>
                <p className="text-xs text-white/45">{indicator === 'populacao' ? `IBGE · ${popYear}` : 'PNUD/IPEA/FJP · 2010'}</p>
              </div>
              <div className="mx-auto mt-2 w-full max-w-[340px]" dangerouslySetInnerHTML={{ __html: analyticalMap }} />
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.65rem] text-white/55">
                {sequentialRamp.map((c, i) => <span key={i} className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ background: c }} /> {['menor', '', '', '', 'maior'][i] || `faixa ${i + 1}`}</span>)}
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4">
                {selectedState ? (
                  <>
                    <p className="text-xs font-bold uppercase text-white/55">{selectedState.name}</p>
                    <p className="mt-1 text-2xl font-black">{indicator === 'populacao' ? formatInt(selectedValue ?? null) : selectedValue != null ? selectedValue.toFixed(3) : '—'}</p>
                    <p className="mt-0.5 text-xs text-white/55">{indicator === 'populacao' ? `habitantes · ${selectedState.year}` : 'IDHM · 2010'}{indicator === 'idhm' && idhmBrasil2010 != null ? ` · Brasil ${idhmBrasil2010.toFixed(3)}` : ''}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <Link href={`/estados/${selectedState.uf}`} className="font-bold text-white underline">Ver perfil</Link>
                      <Link href={`/estados/${selectedState.uf}#atlas`} className="font-bold text-white underline">Abrir Atlas Vivo</Link>
                    </div>
                  </>
                ) : (
                  <p className="text-xs leading-5 text-white/65">Selecione um estado no mapa para ver o valor exato{indicator === 'idhm' && idhmBrasil2010 != null ? <> — Brasil: <strong className="text-white">{idhmBrasil2010.toFixed(3)}</strong> (2010, último ano desta base)</> : '.'}</p>
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-white/10 pt-4">
                <div className="min-w-0"><span className="text-[0.62rem] font-bold uppercase tracking-wide text-white/55">Habitantes</span><strong className="display-title mt-1 block text-[clamp(0.95rem,1.4vw,1.2rem)] leading-none">{int.format(totalPop)}</strong></div>
                <div className="min-w-0"><span className="text-[0.62rem] font-bold uppercase tracking-wide text-white/55">Municípios</span><strong className="display-title mt-1 block text-[clamp(0.95rem,1.4vw,1.2rem)] leading-none">{int.format(municipalityCount)}</strong></div>
                <div className="min-w-0"><span className="text-[0.62rem] font-bold uppercase tracking-wide text-white/55">UFs</span><strong className="display-title mt-1 block text-[clamp(0.95rem,1.4vw,1.2rem)] leading-none">27</strong></div>
              </div>
            </div>
          </div>
          <details className="border-t border-white/10 bg-black/15 px-6 py-3.5 text-sm text-white/80 sm:px-10">
            <summary className="cursor-pointer font-bold text-white">Ver todos os estados em tabela</summary>
            <div className="mt-3 overflow-x-auto rounded-xl bg-white/5">
              <table className="w-full min-w-[480px] text-left text-sm"><thead><tr><th className="px-4 py-2">UF</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2 text-right">Perfil</th></tr></thead>
                <tbody>{states.map(s => { const v = indicatorValueByUf.get(s.uf); return <tr key={s.uf} className="border-t border-white/10"><td className="px-4 py-2 font-bold">{s.uf}</td><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2 text-right tabular-nums">{v == null ? '—' : indicator === 'populacao' ? formatInt(v) : v.toFixed(3)}</td><td className="px-4 py-2 text-right"><Link href={`/estados/${s.uf}`} className="font-bold text-white underline">Abrir</Link></td></tr>; })}</tbody>
              </table>
            </div>
          </details>
        </div>
      </section>

      <section className="page-shell py-12">
        <p className="eyebrow">Políticas públicas na prática</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">Quem cuida de quê no Brasil?</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Escolha uma área de política pública e veja como União, estados e municípios participam dela — a maioria das políticas é execução compartilhada, não de uma única esfera isolada.</p>
        <div className="mt-6"><FederativeExplorer areas={FEDERATIVE_AREAS} /></div>
      </section>

      <section className="border-t bg-card py-12">
        <div className="page-shell">
          <p className="eyebrow">Políticas públicas na prática</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">As cinco áreas da gestão pública</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Cinco maneiras diferentes de compreender a realidade brasileira — cada área com sua cor, sua pergunta e sua própria história ao longo do tempo, nunca cinco números intercambiáveis com ícones diferentes.</p>
          <div className="mt-8 space-y-6">
            <div id="saude" className="scroll-mt-24 rounded-3xl border bg-background p-6 sm:p-8" style={{ borderTopColor: SAUDE_COLOR, borderTopWidth: 4 }}>
              <div className="flex items-center gap-2" style={{ color: SAUDE_COLOR }}><HeartPulse size={20} aria-hidden /><p className="eyebrow" style={{ color: SAUDE_COLOR }}>Saúde</p></div>
              <h3 className="mt-1 text-2xl font-black">{THEME_META.saude!.question}</h3>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <div><strong className="display-title text-3xl tabular-nums">{(health.bedsExisting / totalPop * 1000).toFixed(2)}</strong><span className="ml-1.5 text-sm text-muted-foreground">leitos por mil hab.</span></div>
                <div><strong className="display-title text-3xl tabular-nums">{int.format(health.hospitals)}</strong><span className="ml-1.5 text-sm text-muted-foreground">hospitais no cadastro</span></div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">CNES/DataSUS, competência {health.competence}</p>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <LineChart title="Leitos existentes no país, por ano" data={bedsChartData} coverage={bedsCoverage} color={SAUDE_COLOR} />
                <LineChart title="Internações custeadas pelo SUS, por ano" data={aihChartData} coverage={aihCoverage} color={SAUDE_COLOR} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Leitos: soma nacional vigente em dezembro de cada ano (cadastro CNES; leitos de hospital-dia excluídos). Internações: SIH/AIH, só procedimentos custeados pelo SUS — não inclui atendimento particular nem de planos de saúde; o ano corrente aparece parcial.</p>
              <Link href={selectedUf ? `/estados/${selectedUf}#saude` : '/estados'} className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: SAUDE_COLOR }}>Explorar Saúde →</Link>
            </div>

            <div id="educacao" className="scroll-mt-24 rounded-3xl border bg-background p-6 sm:p-8" style={{ borderTopColor: EDUCACAO_COLOR, borderTopWidth: 4 }}>
              <div className="flex items-center gap-2" style={{ color: EDUCACAO_COLOR }}><GraduationCap size={20} aria-hidden /><p className="eyebrow" style={{ color: EDUCACAO_COLOR }}>Educação</p></div>
              <h3 className="mt-1 text-2xl font-black">{THEME_META.educacao!.question}</h3>
              <div className="mt-3"><strong className="display-title text-3xl tabular-nums">{idebRow ? String(idebRow.values.ideb) : '—'}</strong><span className="ml-1.5 text-sm text-muted-foreground">Ideb, anos iniciais{idebYear ? ` (${idebYear})` : ''}</span></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <LineChart title="Ideb, anos iniciais, por edição (todas as redes)" data={idebChartData} coverage={toChartCoverage('AVAILABLE', 'INEP · Ideb, todas as redes', { from: '2005-01-01', to: `${idebYear ?? 2025}-12-31`, grain: 'year' })} color={EDUCACAO_COLOR} min={0} max={10} />
                <LineChart title="Taxa de abandono, ensino fundamental, por ano" data={abandonoChartData} coverage={abandonoCoverage} color={EDUCACAO_COLOR} suffix="%" />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">O Ideb de uma rede não é a média dos Idebs das escolas; a meta oficial só existe até a edição de 2021 — 2023 e 2025 são comparáveis às anteriores, mas sem meta própria. Abandono é uma taxa de rendimento (diferente de distorção idade-série), do ensino fundamental total (anos iniciais + finais).</p>
              <Link href={selectedUf ? `/estados/${selectedUf}#educacao` : '/estados'} className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: EDUCACAO_COLOR }}>Explorar Educação →</Link>
            </div>

            <div id="seguranca" className="scroll-mt-24 rounded-3xl border bg-background p-6 sm:p-8" style={{ borderTopColor: SEGURANCA_COLOR, borderTopWidth: 4 }}>
              <div className="flex items-center gap-2" style={{ color: SEGURANCA_COLOR }}><ShieldAlert size={20} aria-hidden /><p className="eyebrow" style={{ color: SEGURANCA_COLOR }}>Segurança</p></div>
              <h3 className="mt-1 text-2xl font-black">{THEME_META.seguranca!.question}</h3>
              <div className="mt-3"><strong className="display-title text-3xl tabular-nums">{trafficLatest ? int.format(trafficLatest.value) : '—'}</strong><span className="ml-1.5 text-sm text-muted-foreground">registros de tráfico{trafficLatest ? ` (${trafficLatest.year})` : ''}</span></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <AreaTrend title="Registros de tráfico de drogas, por ano" data={trafficTrend} coverage={toChartCoverage('AVAILABLE', 'Sinesp VDE · 27 UFs', { from: trafficYears[0] ? `${trafficYears[0].year}-01-01` : null, to: trafficYears.length ? `${trafficYears.at(-1)!.year}-12-31` : null, grain: 'year' })} color={SEGURANCA_COLOR} badge="Atividade policial registrada, não extensão real do tráfico" />
                <AreaTrend title="Mandados de prisão cumpridos, por ano" data={warrantsChartData} coverage={warrantsCoverage} color={SEGURANCA_COLOR} badge="Ato processual cumprido, não prova de organização criminosa" />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Fonte estadual (Sinesp VDE, 27 UFs) — Polícia Federal/PRF têm séries próprias, não somadas aqui. Mais registros pode refletir mais notificação ou mais policiamento, não necessariamente mais crime.</p>
              <Link href={selectedUf ? `/estados/${selectedUf}#seguranca` : '/estados'} className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: SEGURANCA_COLOR }}>Explorar Segurança →</Link>
            </div>

            <div id="bem-estar" className="scroll-mt-24 rounded-3xl border bg-background p-6 sm:p-8" style={{ borderTopColor: DEV_SOCIAL_COLOR, borderTopWidth: 4 }}>
              <div className="flex items-center gap-2" style={{ color: DEV_SOCIAL_COLOR }}><HeartHandshake size={20} aria-hidden /><p className="eyebrow" style={{ color: DEV_SOCIAL_COLOR }}>Desenvolvimento Social</p></div>
              <h3 className="mt-1 text-2xl font-black">{THEME_META['bem-estar']!.question}</h3>
              {rendaBrasil && <div className="mt-3"><strong className="display-title text-3xl tabular-nums">{money.format(rendaBrasil.value)}</strong><span className="ml-1.5 text-sm text-muted-foreground">renda domiciliar per capita{rendaBrasil.periodStart ? ` (${String(rendaBrasil.periodStart).slice(0, 4)})` : ''}</span></div>}
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <LineChart title="Saldo do mercado de trabalho formal, por mês" data={cagedBalChartData} coverage={cagedCoverage} color={DEV_SOCIAL_COLOR} />
                <LineChart title="Vínculos formais ativos (RAIS), por ano" data={raisChartData} coverage={raisCoverage} color={DEV_SOCIAL_COLOR} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Saldo do Novo Caged (admissões menos desligamentos) e estoque anual da RAIS são medidas diferentes, nunca somadas entre si. CadÚnico, Bolsa Família e BPC ainda não têm fonte agregada publicável nesta base.</p>
              <Link href={selectedUf ? `/estados/${selectedUf}#bem-estar` : '/estados'} className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: DEV_SOCIAL_COLOR }}>Explorar Desenvolvimento Social →</Link>
            </div>

            <div id="infraestrutura" className="scroll-mt-24 rounded-3xl border bg-background p-6 sm:p-8" style={{ borderTopColor: INFRA_COLOR, borderTopWidth: 4 }}>
              <div className="flex items-center gap-2" style={{ color: INFRA_COLOR }}><Route size={20} aria-hidden /><p className="eyebrow" style={{ color: INFRA_COLOR }}>Infraestrutura</p></div>
              <h3 className="mt-1 text-2xl font-black">{THEME_META.infraestrutura!.question}</h3>
              <div className="mt-3"><strong className="display-title text-3xl tabular-nums">{esgotoBrasil ? `${Number(esgotoBrasil.value).toFixed(1)}%` : '—'}</strong><span className="ml-1.5 text-sm text-muted-foreground">domicílios com rede coletora de esgoto{esgotoBrasil ? ` (SNIS, ${esgotoBrasil.referenceYear})` : ''}</span></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <LineChart title="Obras públicas cadastradas, por ano" data={worksRegisteredChartData} coverage={worksRegisteredCoverage} color={INFRA_COLOR} />
                <LineChart title="Valor empenhado em obras públicas, por ano (R$)" data={worksCommittedChartData} coverage={worksCommittedCoverage} color={INFRA_COLOR} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Água, esgoto e resíduos (SNIS/SINISA) têm só 1 período publicado no nível Brasil — por isso a história aqui é das obras públicas (Obrasgov). Obra cadastrada não é obra concluída; valor empenhado é o 1º de 5 estágios (planejado, contratado, empenhado, liquidado, pago) — nunca despesa já realizada.</p>
              <Link href={selectedUf ? `/estados/${selectedUf}#infraestrutura` : '/estados'} className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: INFRA_COLOR }}>Explorar Infraestrutura →</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="scroll-mt-24 page-shell py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Gestão e gasto público</p>
            <h2 className="mt-2 text-2xl font-black">Obras públicas: onde estão, em que situação</h2>
            {concludedShare != null && (
              <div className="mt-3"><strong className="display-title text-3xl tabular-nums">{concludedShare.toFixed(1)}%</strong><span className="ml-1.5 text-sm text-muted-foreground">das {int.format(situationTotal)} obras registradas no Obrasgov estão concluídas</span></div>
            )}
            <p className="mt-2 max-w-md text-sm text-muted-foreground">O Cívica ainda não publica um total nacional único de despesas do Executivo — somar competências e esferas diferentes sem metodologia própria produziria um número sem significado. O que existe de real e verificável é a situação declarada de cada obra:</p>
            <div className="mt-5 space-y-2.5">
              {situationRows.map(s => (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between text-xs font-bold"><span>{s.label}</span><span className="tabular-nums text-muted-foreground">{int.format(s.count)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (s.count / situationMax) * 100)}%`, background: SITUATION_COLOR[s.label] ?? '#115b45' }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">Valores financeiros (planejado, contratado, pago) são estágios distintos do mesmo recurso avançando — não somados aqui, nunca tratados como despesa realizada até a etapa de pagamento confirmada.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/estados" className="font-bold text-primary underline">Obras por estado e município</Link></li>
              <li><Link href="/estados" className="font-bold text-primary underline">Finanças de saúde, educação e segurança, por estado</Link></li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <p className="eyebrow">Comece a investigar</p>
            <h2 className="mt-2 text-xl font-black">Perguntas para explorar os dados</h2>
            <p className="mt-2 text-sm text-muted-foreground">Escolha um tema e aprofunde o que mais te interessa.</p>
            <ul className="mt-4 divide-y">
              {QUESTIONS.map(([q, href, Icon]) => (
                <li key={q}><Link href={selectedUf ? `/estados/${selectedUf}` : href} className="focus-ring flex items-center gap-3 py-3 hover:text-primary"><Icon size={18} className="shrink-0 text-primary" aria-hidden /><span className="flex-1 text-sm font-semibold">{q}</span></Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-10">
        <div className="page-shell">
          <h2 className="text-xl font-black">Fontes, cobertura e transparência</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Cada número desta página tem fonte, período e cobertura declarados — nenhum total nacional é calculado sem metodologia verificável.</p>
          <div className="mt-4"><JudiciaryAvailabilityNote availability="AVAILABLE" source="IBGE · INEP · DataSUS/CNES · SNIS · Sinesp VDE · PNUD/IPEA/FJP" limitations={['População: soma das 27 UFs, ano mais recente publicado por UF, não necessariamente o mesmo ano em todas', 'IDHM: decenal (1991/2000/2010); não há edição 2021 nesta base', 'Renda domiciliar per capita: média, não mediana — valores de mediana nacional exigiriam microdados que esta leitura não recalcula', 'Segurança: Sinesp VDE é estadual, com partições e cobertura que variam por UF e ano']} /></div>
          <Link href="/metodologia" className="mt-4 inline-block text-sm font-bold text-primary underline">Ver metodologia e fontes completas</Link>
        </div>
      </section>
    </main>
  );
}
