import Link from 'next/link';
import { ArrowRight, Building2, Clock, Gavel, Scale, Users, Wallet } from 'lucide-react';
import { MultiLineChart, ConcentrationCurve, RankedBars, type MultiLineDatum, type RankedBarItem } from '@/components/charts';
import { JudiciaryAvailabilityNote, toChartCoverage } from '@/components/judiciary/availability';
import { loadJudiciaryOverview, loadJudiciaryNationalSeries, loadJudiciaryIndicatorDistribution } from '@/lib/judiciary';
import { loadJudiciaryThemesCatalog, loadJudiciaryThemeOverview } from '@/lib/judiciary-themes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Judiciário · Cívica', description: 'A Justiça brasileira, além dos processos: demanda, acervo, tempo, estrutura, temas e tribunais, com fontes oficiais do CNJ.' };

const int = new Intl.NumberFormat('pt-BR');
const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, signDisplay: 'always' });
const moneyCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const moneyFull = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const GENERAL_SUM = ['JN_CASES_NEW_G1', 'JN_CASES_NEW_G2', 'JN_DISPOSED', 'JN_CASES_PENDING'] as const;
// Variáveis-fonte distintas (DMag/DServ/DBen/ODC vs. Dpj) — CNJ documenta explicitamente que não devem ser
// somadas sem necessidade declarada (ver jud_jn_indicator.method_breaks); por isso a composição abaixo é
// rotulada como soma dos 4 componentes, nunca como igual à "Despesa total" oficial (Dpj).
const EXPENSE_SUM = ['JN_EXPENSE_TOTAL', 'JN_EXPENSE_MAGISTRATES', 'JN_EXPENSE_SERVERS', 'JN_EXPENSE_BENEFITS', 'JN_EXPENSE_OTHER_CURRENT', 'JN_REVENUE_TOTAL'] as const;
type Metric = { indicator_id: string; public_name: string; unit: string; value: string | null; availability: string; observations: number; available_values: number; institutions: number };
const RAMOS = [
  { code: 'TJ', label: 'Justiça Estadual', hint: '27 tribunais — 1ª e 2ª instância nos estados' },
  { code: 'TRF', label: 'Justiça Federal', hint: '6 tribunais regionais federais' },
  { code: 'TRT', label: 'Justiça do Trabalho', hint: '24 tribunais regionais do trabalho' },
  { code: 'TRE', label: 'Justiça Eleitoral', hint: '27 tribunais regionais eleitorais' },
  { code: 'TJM', label: 'Justiça Militar Estadual', hint: '3 tribunais de justiça militar' },
  { code: 'SUPERIOR', label: 'Tribunais Superiores', hint: 'STJ, TST, TSE, STM' },
] as const;

/** Beeswarm sem simulação física: ordena por valor, posiciona cada ponto na 1ª linha (y=0) livre de
    colisão com quem já foi colocado, alternando acima/abaixo em anéis de `markerSize*0.88` — a mesma
    técnica (clustering sequencial, nunca bucket fixo) já validada nesta sessão pra geometria de PDF
    (P14.31 TJAC), aqui aplicada a posicionamento de marca, não extração de texto. */
function layoutBeeswarm<T extends { value: number }>(points: T[], { chartWidth, markerSize }: { chartWidth: number; markerSize: number }): Array<T & { x: number; y: number }> {
  if (!points.length) return [];
  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const pad = markerSize * 0.6;
  const xScale = (v: number) => pad + (chartWidth - 2 * pad) * (max > min ? (v - min) / (max - min) : 0.5);
  const placed: { x: number; y: number }[] = [];
  return [...points].sort((a, b) => a.value - b.value).map(p => {
    const x = xScale(p.value);
    let y = 0, tries = 0;
    while (placed.some(q => Math.hypot(q.x - x, q.y - y) < markerSize - 0.5)) {
      tries++;
      const ring = Math.ceil(tries / 2);
      y = (tries % 2 === 0 ? -1 : 1) * ring * (markerSize * 0.88);
    }
    placed.push({ x, y });
    return { ...p, x, y };
  });
}

export default async function JudiciaryPanoramaPage() {
  const [overview, series, themes, congestion, featuredTheme, expenseSeries, expensePerMagistrate] = await Promise.all([
    loadJudiciaryOverview(2025),
    loadJudiciaryNationalSeries([...GENERAL_SUM]),
    loadJudiciaryThemesCatalog(),
    loadJudiciaryIndicatorDistribution('JN_CONGESTION_RATE', 2025),
    loadJudiciaryThemeOverview('DOMESTIC_VIOLENCE' as any, {}),
    loadJudiciaryNationalSeries([...EXPENSE_SUM]),
    loadJudiciaryIndicatorDistribution('JN_EXPENSE_PER_MAGISTRATE', 2025),
  ]);

  if (overview.availability !== 'AVAILABLE') {
    return (
      <main id="conteudo" tabIndex={-1} className="page-shell py-12">
        <JudiciaryAvailabilityNote availability={overview.availability} source="CNJ Justiça em Números" limitations={overview.provenance.limitations} />
      </main>
    );
  }

  const metrics = overview.data.metrics as Metric[];
  const byId = new Map(metrics.map(m => [m.indicator_id, m]));
  const newCases = (Number(byId.get('JN_CASES_NEW_G1')?.value ?? 0) + Number(byId.get('JN_CASES_NEW_G2')?.value ?? 0)) || null;
  const disposed = byId.get('JN_DISPOSED');
  const pending = byId.get('JN_CASES_PENDING');
  const magistrates = byId.get('JN_ACTIVE_MAGISTRATES');

  const kpiCoverage = toChartCoverage('AVAILABLE', `CNJ Justiça em Números, edição 2026 · ano-base ${overview.data.year}`, { from: `${overview.data.year}-01-01`, to: `${overview.data.year}-12-31`, grain: 'year' });

  const seriesItems = series.data.items as Array<{ indicator_id: string; reference_year: number; value: string | number | null }>;
  const years = [...new Set(seriesItems.map(i => i.reference_year))].sort((a, b) => a - b);
  const val = (indicatorId: string, year: number) => { const row = seriesItems.find(i => i.indicator_id === indicatorId && i.reference_year === year); return row?.value != null ? Number(row.value) : null; };
  const seriesChart: MultiLineDatum[] = years.map(y => ({
    label: String(y),
    values: [
      { label: 'Casos novos', value: (val('JN_CASES_NEW_G1', y) ?? 0) + (val('JN_CASES_NEW_G2', y) ?? 0) || null, color: '#115b45' },
      { label: 'Processos baixados', value: val('JN_DISPOSED', y), color: '#2d7f93' },
      { label: 'Processos pendentes', value: val('JN_CASES_PENDING', y), color: '#d39a3c' },
    ],
  }));
  const seriesCoverage = toChartCoverage(series.availability, 'CNJ Justiça em Números · soma nacional anual, exclui tribunais de controle (CNJ)', { from: `${years[0] ?? ''}-01-01`, to: `${years.at(-1) ?? ''}-12-31`, grain: 'year' });

  // Delta ano-a-ano real: últimos dois anos da própria série (nunca "vs. um ano fixo") — só quando os dois pontos existem.
  const lastYear = years.at(-1), prevYear = years.at(-2);
  const yoy = (curr: number | null, prev: number | null) => curr != null && prev != null && prev !== 0 ? `${pct.format(((curr - prev) / prev) * 100)}% vs ${prevYear}` : null;
  const newCasesPrev = lastYear != null && prevYear != null ? (val('JN_CASES_NEW_G1', prevYear) ?? 0) + (val('JN_CASES_NEW_G2', prevYear) ?? 0) || null : null;
  const disposedPrev = prevYear != null ? val('JN_DISPOSED', prevYear) : null;
  const pendingPrev = prevYear != null ? val('JN_CASES_PENDING', prevYear) : null;

  const realThemes = (themes.data as any[]).filter(t => (t.status === 'AVAILABLE' || t.status === 'PARTIAL_COVERAGE') && t.indicatorCount > 0);

  // Hero: prévia da "Justiça em movimento" — só os últimos 6 anos (não duplica a série completa 2009-2025
  // da seção principal), com os valores mais recentes como números integrados ao gráfico, não em cards à parte.
  const heroYears = years.slice(-6);
  const heroMaxVal = Math.max(...heroYears.flatMap(y => [val('JN_CASES_NEW_G1', y) ?? 0, val('JN_DISPOSED', y) ?? 0]), 1);
  const HERO_W = 480, HERO_H = 180, HERO_PAD_B = 20;
  const heroX = (i: number) => (i * (HERO_W - 4)) / Math.max(1, heroYears.length - 1);
  const heroY = (v: number) => HERO_H - HERO_PAD_B - (v / heroMaxVal) * (HERO_H - HERO_PAD_B - 8);
  const heroNewPts = heroYears.map((y, i) => ({ x: heroX(i), y: heroY((val('JN_CASES_NEW_G1', y) ?? 0) + (val('JN_CASES_NEW_G2', y) ?? 0)), year: y }));
  const heroDispPts = heroYears.map((y, i) => ({ x: heroX(i), y: heroY(Number(val('JN_DISPOSED', y) ?? 0)), year: y }));

  // Estrutura da Justiça: barras por ramo, usando a contagem REAL de tribunais já carregada (não os hints
  // hardcoded da versão anterior) — `judOverview.data.branches` já vem na mesma chamada que alimenta a página.
  const BRANCH_ORDER: Record<string, string> = { ESTADUAL: 'Justiça Estadual', FEDERAL: 'Justiça Federal', TRABALHO: 'Justiça do Trabalho', ELEITORAL: 'Justiça Eleitoral', MILITAR: 'Justiça Militar Estadual', SUPERIOR: 'Tribunais Superiores', STF: 'Supremo Tribunal Federal', CNJ: 'Conselho Nacional de Justiça' };
  const branchRows = ((overview.data as any).branches as any[] ?? [])
    .filter(b => b.code !== 'CNJ')
    .map(b => ({ code: String(b.code), name: BRANCH_LABEL_OR(String(b.code)), institutions: Number(b.institutions ?? 0), disposed: Number((b.metrics as any[] | undefined)?.find(m => m.indicatorId === 'JN_DISPOSED')?.value ?? NaN) }))
    .sort((a, b) => b.institutions - a.institutions);
  function BRANCH_LABEL_OR(code: string) { return BRANCH_ORDER[code] ?? code; }
  const branchMaxInst = Math.max(...branchRows.map(b => b.institutions), 1);

  // Congestionamento: a distribuição completa (CNJ) cobre 91 instituições de todos os ramos — mas
  // "bandeira do estado" só faz sentido pra quem tem uma UF só, então este gráfico fica restrito à
  // Justiça Estadual (27 TJs, todos com sigla "TJ"+UF, exceto TJDFT→DF). Não existe "a taxa nacional" —
  // ver `getJudiciaryIndicatorDistribution` —, ordenada, com min/mediana/max identificados.
  const congestionPoints = ((congestion.data as any)?.points as any[] | undefined ?? [])
    .filter(p => p.branch_code === 'ESTADUAL')
    .map(p => ({ sigla: p.sigla as string, name: p.official_name as string, value: Number(p.value), uf: p.sigla === 'TJDFT' ? 'DF' : String(p.sigla).replace(/^TJ/, '') }));
  const congestionMin = congestionPoints[0] ?? null;
  const congestionMax = congestionPoints.at(-1) ?? null;
  const congestionMedian = congestionPoints[Math.floor(congestionPoints.length / 2)] ?? null;
  const congestionSwarm = layoutBeeswarm(congestionPoints, { chartWidth: 900, markerSize: 34 });

  // Despesas: soma nacional por categoria de despesa (CNJ Justiça em Números), com série multi-ano própria
  // (cada indicador SUM tem seu próprio alcance de anos: Despesa total/Benefícios/Outras despesas/Receita
  // vão de 2009 a 2025; Magistrados/Servidores só têm variável separada do CNJ a partir de 2015).
  const expenseItems = expenseSeries.data.items as Array<{ indicator_id: string; reference_year: number; value: string | number | null; institutions: number }>;
  const valE = (indicatorId: string, year: number) => { const row = expenseItems.find(i => i.indicator_id === indicatorId && i.reference_year === year); return row?.value != null ? Number(row.value) : null; };
  const expenseYears = [...new Set(expenseItems.map(i => i.reference_year))].sort((a, b) => a - b);
  const expenseLastYear = expenseYears.at(-1), expensePrevYear = expenseYears.at(-2);
  const expenseInstitutions = expenseItems.find(i => i.indicator_id === 'JN_EXPENSE_TOTAL' && i.reference_year === expenseLastYear)?.institutions ?? 0;
  const yoyExpense = (id: string) => {
    const curr = expenseLastYear != null ? valE(id, expenseLastYear) : null, prev = expensePrevYear != null ? valE(id, expensePrevYear) : null;
    return curr != null && prev != null && prev !== 0 ? `${pct.format(((curr - prev) / prev) * 100)}% vs ${expensePrevYear}` : null;
  };
  const expenseKpis = [
    { id: 'JN_EXPENSE_TOTAL', label: 'Despesa total', href: '/judiciario/comparar?indicador=JN_EXPENSE_TOTAL' },
    { id: 'JN_EXPENSE_MAGISTRATES', label: 'Despesa com magistrados', href: '/judiciario/comparar?indicador=JN_EXPENSE_MAGISTRATES' },
    { id: 'JN_EXPENSE_SERVERS', label: 'Despesa com servidores', href: '/judiciario/comparar?indicador=JN_EXPENSE_SERVERS' },
    { id: 'JN_EXPENSE_BENEFITS', label: 'Despesa com benefícios', href: '/judiciario/comparar?indicador=JN_EXPENSE_BENEFITS' },
    { id: 'JN_REVENUE_TOTAL', label: 'Receita total', href: '/judiciario/comparar?indicador=JN_REVENUE_TOTAL' },
  ].map(k => ({ ...k, value: valE(k.id, expenseLastYear ?? 0), deltaLabel: yoyExpense(k.id) }));

  // Composição da despesa corrente por natureza (DMag+DServ+DBen+ODC), ano mais recente — rotulada como
  // soma dos 4 componentes, nunca como "Despesa total" (ver nota acima: são variáveis-fonte distintas, com
  // uma diferença real de ~4% entre a soma dos 4 e o Dpj oficial, documentada no próprio catálogo do CNJ).
  const expenseComposition = [
    { label: 'Magistrados', value: valE('JN_EXPENSE_MAGISTRATES', expenseLastYear ?? 0) ?? 0 },
    { label: 'Servidores', value: valE('JN_EXPENSE_SERVERS', expenseLastYear ?? 0) ?? 0 },
    { label: 'Benefícios (inativos/pensionistas)', value: valE('JN_EXPENSE_BENEFITS', expenseLastYear ?? 0) ?? 0 },
    { label: 'Outras despesas correntes', value: valE('JN_EXPENSE_OTHER_CURRENT', expenseLastYear ?? 0) ?? 0 },
  ];

  // Corrida de crescimento: as 3 categorias de folha, indexadas a 100 em 2015 (1º ano com variável própria
  // para Magistrados/Servidores) — nunca em valor nominal junto de "Despesa total" no mesmo eixo (escalas
  // muito diferentes: 34bi vs 108bi vs 15bi em 2025), indexar é a forma honesta de comparar ritmo de crescimento.
  const growthYears = expenseYears.filter(y => y >= 2015);
  const growthBase = { mag: valE('JN_EXPENSE_MAGISTRATES', 2015), srv: valE('JN_EXPENSE_SERVERS', 2015), ben: valE('JN_EXPENSE_BENEFITS', 2015) };
  const indexTo100 = (value: number | null, base: number | null) => value != null && base ? (value / base) * 100 : null;
  const growthChart: MultiLineDatum[] = growthYears.map(y => ({
    label: String(y),
    values: [
      { label: 'Magistrados', value: indexTo100(valE('JN_EXPENSE_MAGISTRATES', y), growthBase.mag), color: '#115b45' },
      { label: 'Servidores', value: indexTo100(valE('JN_EXPENSE_SERVERS', y), growthBase.srv), color: '#2d7f93' },
      { label: 'Benefícios', value: indexTo100(valE('JN_EXPENSE_BENEFITS', y), growthBase.ben), color: '#d39a3c' },
    ],
  }));

  // Despesa total vs. receita total: mesma unidade (BRL nominal), mesma ordem de grandeza — um eixo só é
  // honesto aqui (ao contrário do índice acima). A Justiça não é, nem precisa ser, autofinanciada por custas
  // e emolumentos — é majoritariamente orçamento público —, então o gráfico não insinua déficit, só mostra
  // os dois números reais lado a lado.
  const revenueChart: MultiLineDatum[] = expenseYears.map(y => ({
    label: String(y),
    values: [
      { label: 'Despesa total', value: valE('JN_EXPENSE_TOTAL', y), color: '#115b45' },
      { label: 'Receita total', value: valE('JN_REVENUE_TOTAL', y), color: '#9fd8c3' },
    ],
  }));

  // Despesa por magistrado entre tribunais estaduais: mesmo recorte institucional do congestionamento (27
  // TJs, full-time) — nunca misturado com TREs (magistrados cedidos, mandato temporário, remuneração
  // majoritariamente contabilizada na origem) nem tribunais superiores (universo minúsculo, outlier natural).
  const magistrateExpensePoints = ((expensePerMagistrate.data as any)?.points as any[] | undefined ?? [])
    .filter(p => p.branch_code === 'ESTADUAL')
    .map(p => ({ sigla: p.sigla as string, name: p.official_name as string, value: Number(p.value), uf: p.sigla === 'TJDFT' ? 'DF' : String(p.sigla).replace(/^TJ/, '') }))
    .sort((a, b) => b.value - a.value);
  // Vista padrão compacta: 8 maiores + 8 menores, lado a lado, com a bandeira do estado junto ao nome.
  // Cada item carrega `rank` (posição real na lista de 27) em vez de deixar o componente numerar pelo índice
  // do recorte — é a mesma lição de antes (um recorte sem marcação faria o 20º colocado parecer o 9º), só que
  // agora resolvida com rótulo de posição real em vez de mostrar sempre a lista inteira. O ranking completo
  // continua disponível (ver `magistrateExpenseRankedAll`) atrás de um "ver mais".
  const magistrateExpenseRankedAll: RankedBarItem[] = magistrateExpensePoints.map((p, i) => ({
    key: p.sigla,
    label: `${p.sigla} — ${p.name}`,
    value: p.value,
    rank: i + 1,
    chip: <img src={`/flags/${p.uf}.svg`} alt="" className="h-3.5 w-5 shrink-0 rounded-[2px] border border-border/50 object-cover" />,
  }));
  const magistrateExpenseTop = magistrateExpenseRankedAll.slice(0, 8);
  const magistrateExpenseBottom = magistrateExpenseRankedAll.slice(-8);
  const magistrateExpenseCoverage = toChartCoverage('AVAILABLE', 'CNJ Justiça em Números · os 27 tribunais de Justiça estaduais — restrito à Justiça Estadual (magistrados de carreira em tempo integral); TREs e tribunais superiores não entram por universo e desenho de remuneração diferentes', { from: `${expenseLastYear}-01-01`, to: `${expenseLastYear}-12-31`, grain: 'year' });

  // Tema em destaque: Violência doméstica — critério explícito (não "o de mais indicadores"): é o tema
  // com série SUM elegível mais completa (338-340 observações nos indicadores principais) E de relevância
  // social direta, documentado em docs/judiciario-redesign/j7/J7_3_TEMAS_E_STORYTELLING.md.
  const featuredMetrics = new Map(((featuredTheme.data as any)?.metrics as any[] | undefined ?? []).map(m => [m.indicator_id, m]));
  const featuredNew = Number(featuredMetrics.get('P146_DOMESTIC_VIOLENCE_DOMESTIC_NEW')?.value ?? NaN);
  const featuredDisposed = Number(featuredMetrics.get('P146_DOMESTIC_VIOLENCE_DOMESTIC_DISPOSED')?.value ?? NaN);
  const featuredMax = Math.max(featuredNew || 0, featuredDisposed || 0, 1);
  const otherThemes = realThemes.filter(t => t.themeId !== 'DOMESTIC_VIOLENCE');

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-6 sm:py-8">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] text-white">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0a2f26] via-[#0e4939] to-[#123f33]" />
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:p-14">
            <div className="flex flex-col justify-center">
              <p className="eyebrow text-white/70">Justiça brasileira · Panorama nacional</p>
              <h1 className="display-title text-balance mt-4 text-[2.4rem] leading-[1.05] sm:text-6xl lg:text-[3rem]">A Justiça brasileira, além dos processos.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/80">Entenda o que chega aos tribunais, quanto tempo leva, o que é resolvido e como cada instituição funciona — {int.format(metrics.filter(m => m.availability === 'AVAILABLE' || m.value !== null).length)} indicadores, 93 instituições, {years[0]}–{years.at(-1)}.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="#fila" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-primary">Explorar os dados</Link>
                <Link href="/judiciario/tribunais" className="rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Encontrar tribunal</Link>
              </div>
              <nav aria-label="Atalhos do Judiciário" className="mt-6 flex flex-wrap gap-2">
                {[['#despesas', 'Como gastam o dinheiro'], ['#congestionamento', 'Tempo e congestionamento'], ['/judiciario/temas', 'Temas'], ['/judiciario/comparar', 'Recursos']].map(([href, label]) => (
                  <Link key={href} href={href!} className="rounded-full border border-white/25 px-3 py-1 text-xs font-bold text-white/85 hover:bg-white/10">{label}</Link>
                ))}
              </nav>
            </div>

            <div className="flex flex-col rounded-2xl bg-white/[0.05] p-5 ring-1 ring-inset ring-white/10 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">Casos novos × processos baixados</p>
                <p className="text-xs text-white/45">CNJ · {heroYears[0]}–{heroYears.at(-1)}</p>
              </div>
              <svg viewBox={`0 0 ${HERO_W} ${HERO_H}`} className="mt-3 h-auto w-full" role="img" aria-label={`Casos novos e processos baixados, ${heroYears[0]} a ${heroYears.at(-1)}`}>
                <polyline points={heroNewPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#9fd8c3" strokeWidth={2.5} />
                <polyline points={heroDispPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#d39a3c" strokeWidth={2.5} />
                {heroNewPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#9fd8c3" />)}
                {heroDispPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#d39a3c" />)}
                {heroYears.map((y, i) => (i === 0 || i === heroYears.length - 1) && <text key={y} x={heroX(i)} y={HERO_H - 4} textAnchor={i === 0 ? 'start' : 'end'} className="fill-white/50 text-[9px]">{y}</text>)}
              </svg>
              <div className="mt-2 flex gap-3 text-xs text-white/70"><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-[#9fd8c3]" /> Casos novos</span><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-[#d39a3c]" /> Processos baixados</span></div>
              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/10 pt-5 sm:grid-cols-4">
                <div className="min-w-0"><span className="text-[0.68rem] font-bold uppercase tracking-wide text-white/55">Casos novos</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.4rem)] leading-none">{newCases !== null ? int.format(newCases) : '—'}</strong><span className="mt-1 block text-[0.65rem] text-white/45">{yoy(newCases, newCasesPrev) ?? overview.data.year}</span></div>
                <div className="min-w-0"><span className="text-[0.68rem] font-bold uppercase tracking-wide text-white/55">Baixados</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.4rem)] leading-none">{disposed?.value != null ? int.format(Number(disposed.value)) : '—'}</strong><span className="mt-1 block text-[0.65rem] text-white/45">{yoy(disposed?.value != null ? Number(disposed.value) : null, disposedPrev) ?? overview.data.year}</span></div>
                <div className="min-w-0"><span className="text-[0.68rem] font-bold uppercase tracking-wide text-white/55">Pendentes</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.4rem)] leading-none">{pending?.value != null ? int.format(Number(pending.value)) : '—'}</strong><span className="mt-1 block text-[0.65rem] text-white/45">acervo ao fim do ano</span></div>
                <div className="min-w-0"><span className="text-[0.68rem] font-bold uppercase tracking-wide text-white/55">Magistrados</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.4rem)] leading-none">{magistrates?.value != null ? int.format(Number(magistrates.value)) : '—'}</strong><span className="mt-1 block text-[0.65rem] text-white/45">{magistrates?.institutions ?? 0} instituições</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="despesas" className="border-t bg-card py-10">
        <div className="page-shell">
          <div className="flex items-start gap-3">
            <Wallet className="mt-1 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-3xl font-black tracking-tight">Como a Justiça gasta o dinheiro</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Soma nacional declarada por {expenseInstitutions} instituições ao CNJ, por categoria de despesa — folha de magistrados e servidores, benefícios a inativos e pensionistas, e o que cada tribunal arrecada de volta em custas e emolumentos.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {expenseKpis.map(k => (
              <Link key={k.id} href={k.href} className="focus-ring group rounded-2xl border bg-background p-4 hover:border-primary">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{k.label}</span>
                <strong className="display-title mt-1.5 block text-2xl leading-none">{k.value != null ? moneyCompact.format(k.value) : '—'}</strong>
                <span className="mt-1.5 block text-xs text-muted-foreground">{k.deltaLabel ?? `ano-base ${expenseLastYear}`}</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">A despesa com magistrados é a que mais cresceu entre as 3 categorias de folha desde 2015 (ver gráfico abaixo) — <Link href="/judiciario/comparar?indicador=JN_EXPENSE_MAGISTRATES" className="font-bold text-primary underline">compare por tribunal</Link>.</p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <ConcentrationCurve
              title={`Despesa corrente por natureza, soma nacional (R$) · ${expenseLastYear}`}
              buckets={expenseComposition}
              coverage={toChartCoverage('AVAILABLE', 'CNJ Justiça em Números · soma das 4 variáveis de despesa corrente por natureza (DMag/DServ/DBen/ODC)', { from: `${expenseLastYear}-01-01`, to: `${expenseLastYear}-12-31`, grain: 'year' })}
              note="Magistrados, servidores, benefícios e outras despesas correntes são 4 variáveis-fonte distintas do CNJ — a soma delas não é idêntica à 'Despesa total' oficial (a diferença real é de alguns pontos percentuais; o CNJ documenta que essas categorias não devem ser somadas e comparadas com Dpj sem ressalva)."
            />
            <MultiLineChart
              title={`Despesa total × receita total, soma nacional · ${expenseYears[0]}–${expenseLastYear}`}
              data={revenueChart}
              coverage={toChartCoverage('AVAILABLE', 'CNJ Justiça em Números · soma nacional anual, exclui tribunais de controle', { from: `${expenseYears[0]}-01-01`, to: `${expenseLastYear}-12-31`, grain: 'year' })}
            />
          </div>

          <div className="mt-6">
            <MultiLineChart
              title={`Crescimento da folha desde 2015, índice (2015=100)`}
              data={growthChart}
              coverage={toChartCoverage('AVAILABLE', 'CNJ Justiça em Números · cada categoria indexada ao seu próprio valor de 2015 (não comparável em R$ nominal — escalas muito diferentes)', { from: `${growthYears[0] ?? ''}-01-01`, to: `${expenseLastYear}-12-31`, grain: 'year' })}
            />
          </div>

          {magistrateExpenseRankedAll.length > 0 && (
            <div className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <RankedBars
                  title={`Maiores despesas anuais por magistrado, tribunais estaduais · ${expenseLastYear}`}
                  items={magistrateExpenseTop}
                  formatValue={(v) => moneyFull.format(v)}
                  coverage={magistrateExpenseCoverage}
                />
                <RankedBars
                  title={`Menores despesas anuais por magistrado, tribunais estaduais · ${expenseLastYear}`}
                  items={magistrateExpenseBottom}
                  formatValue={(v) => moneyFull.format(v)}
                  coverage={magistrateExpenseCoverage}
                />
              </div>
              <details className="mt-4 text-sm">
                <summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver o ranking completo (27 tribunais)</summary>
                <div className="mt-4">
                  <RankedBars
                    title={`Despesa anual por magistrado, tribunais estaduais · ${expenseLastYear}`}
                    items={magistrateExpenseRankedAll}
                    formatValue={(v) => moneyFull.format(v)}
                    coverage={magistrateExpenseCoverage}
                  />
                </div>
              </details>
            </div>
          )}
        </div>
      </section>

      <section id="fila" className="page-shell py-10">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <h2 className="text-3xl font-black tracking-tight">A Justiça em movimento</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">O que acontece com os processos que chegam, ano a ano: quantos entram, quantos saem e quantos ficam. Casos novos e baixados não se compensam automaticamente — pendentes é o acervo publicado pelo CNJ, não uma conta derivada destes dois números.</p>
            <div className="mt-6"><MultiLineChart title={`Casos novos, baixados e pendentes · ${years[0]}–${years.at(-1)}`} data={seriesChart} coverage={seriesCoverage} /></div>
          </div>
          <aside className="rounded-2xl border bg-card p-5">
            <Building2 className="text-primary" aria-hidden />
            <h3 className="mt-3 text-lg font-black">Como a Justiça se organiza?</h3>
            <p className="mt-2 text-sm text-muted-foreground">Tribunais reais por ramo — quem julga o quê, e quantas instituições cada um tem.</p>
            <div className="mt-4 space-y-2.5 border-t pt-4">
              {branchRows.map(b => (
                <Link key={b.code} href={`/judiciario/tribunais?ramo=${b.code}`} className="focus-ring block rounded-lg hover:bg-muted">
                  <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-bold">{b.name}</span><span className="tabular-nums text-muted-foreground">{b.institutions}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (b.institutions / branchMaxInst) * 100)}%` }} /></div>
                </Link>
              ))}
            </div>
            <Link href="/judiciario/tribunais" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Ver a organização da Justiça <ArrowRight size={14} /></Link>
          </aside>
        </div>
      </section>

      <section id="congestionamento" className="border-t bg-card py-10">
        <div className="page-shell">
          <h2 className="text-3xl font-black tracking-tight">Congestionamento e tempo</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">A taxa de congestionamento mede, para cada tribunal, a proporção de processos que ficou represada no ano — não existe uma única taxa nacional válida, porque tribunais com acervos e universos muito diferentes não podem ser somados numa média simples. O que existe, de verdade, é variação: alguns tribunais represam uma fração pequena do que recebem; outros, a maior parte.</p>
          {congestionPoints.length > 0 && congestionMin && congestionMax && congestionMedian && (
            <div className="mt-6 rounded-2xl border bg-background p-6">
              <p className="text-xs font-bold uppercase text-muted-foreground">Taxa de congestionamento · {congestionPoints.length} tribunais estaduais · {overview.data.year}</p>
              <div tabIndex={0} role="region" aria-label="Congestionamento por tribunal estadual, com rolagem horizontal" className="overflow-x-auto focus-ring">
                <svg role="img" aria-label={`Distribuição da taxa de congestionamento entre ${congestionPoints.length} tribunais estaduais`} viewBox="0 0 900 190" className="mt-6 h-auto min-w-[760px] w-full">
                  <line x1="0" x2="900" y1="95" y2="95" stroke="var(--border)" strokeWidth="1" />
                  {(() => {
                    const medianX = congestionSwarm.find(p => p.sigla === congestionMedian.sigla)?.x ?? 0;
                    return <line x1={medianX} x2={medianX} y1="8" y2="182" stroke="#d39a3c" strokeWidth="2" strokeDasharray="4 3" />;
                  })()}
                  {congestionSwarm.map(p => (
                    <g key={p.sigla}>
                      <title>{`${p.sigla} — ${p.name}: ${(p.value * 100).toFixed(1)}%`}</title>
                      <circle cx={p.x} cy={95 + p.y} r="18" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
                      <image href={`/flags/${p.uf}.svg`} x={p.x - 15} y={95 + p.y - 15} width="30" height="30" preserveAspectRatio="xMidYMid slice" style={{ clipPath: 'circle(50%)' }} />
                      <circle cx={p.x} cy={95 + p.y} r="16" fill="none" stroke="var(--card)" strokeWidth="2" />
                    </g>
                  ))}
                </svg>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span><strong className="text-foreground">{congestionMin.sigla}</strong> — menor, {(congestionMin.value * 100).toFixed(1)}%</span>
                <span className="flex items-center gap-1 font-semibold text-foreground"><i className="inline-block h-2.5 w-0.5 bg-[#d39a3c]" aria-hidden="true" /> mediana {(congestionMedian.value * 100).toFixed(1)}%</span>
                <span><strong className="text-foreground">{congestionMax.sigla}</strong> — maior, {(congestionMax.value * 100).toFixed(1)}%</span>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">Cada bandeira é um tribunal estadual real, posicionado pela sua taxa de congestionamento (passe o mouse para ver qual e o valor exato). A distância entre o menor e o maior mostra o quanto a Justiça brasileira varia internamente — uma única taxa nacional esconderia essa diferença.</p>
              <details className="mt-4 text-sm">
                <summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver dados do gráfico</summary>
                <div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Taxa de congestionamento por tribunal estadual</caption><thead><tr className="border-b"><th className="p-2">Tribunal</th><th className="p-2 text-right">Taxa de congestionamento</th></tr></thead><tbody>{congestionPoints.map(p => (
                  <tr className="border-b" key={p.sigla}><th className="p-2 font-normal">{p.sigla} — {p.name}</th><td className="p-2 text-right tabular-nums">{(p.value * 100).toFixed(1)}%</td></tr>
                ))}</tbody></table></div>
              </details>
            </div>
          )}
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Compare o congestionamento (ou o tempo médio dos processos baixados) entre tribunais específicos, com a metodologia oficial sempre junto — tempo médio dos já baixados não é previsão de duração para um processo novo.</p>
          <Link href="/judiciario/comparar?indicador=JN_CONGESTION_RATE" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Abrir o comparador <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className="page-shell py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-3xl font-black tracking-tight">Temas que mobilizam o sistema</h2><p className="mt-2 text-sm text-muted-foreground">Execução fiscal, violência doméstica, justiça criminal e outros recortes com dado oficial real.</p></div>
          <Link href="/judiciario/temas" className="inline-flex items-center gap-1 text-sm font-bold text-primary underline">Ver todos os temas <ArrowRight size={14} /></Link>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          {/* Tema em destaque: critério explícito (não "o de mais indicadores"), documentado em
              docs/judiciario-redesign/j7/J7_3_TEMAS_E_STORYTELLING.md — Violência doméstica tem a série
              SUM mais completa (338-340 observações) entre os temas reais e relevância social direta. */}
          <Link href="/judiciario/temas/domestic_violence" className="focus-ring group rounded-2xl border bg-[#123f33] p-6 text-white transition hover:border-white/40">
            <p className="text-xs font-bold uppercase tracking-wide text-white/60">Tema em destaque</p>
            <strong className="mt-2 block text-xl font-black leading-tight">Violência doméstica</strong>
            <p className="mt-2 text-sm leading-6 text-white/75">Casos e execuções de violência doméstica contra a mulher, conforme variáveis oficiais do CNJ — não representa número de vítimas nem prova de crime.</p>
            {Number.isFinite(featuredNew) && Number.isFinite(featuredDisposed) && (
              <div className="mt-5 flex items-end gap-6">
                <div className="flex flex-col items-start gap-1.5"><span className="text-xs font-bold tabular-nums">{int.format(featuredNew)}</span><div className="h-16 w-9 rounded-t-sm bg-[#9fd8c3]" style={{ height: `${Math.max(8, (featuredNew / featuredMax) * 64)}px` }} /><span className="text-[0.65rem] text-white/60">Casos novos</span></div>
                <div className="flex flex-col items-start gap-1.5"><span className="text-xs font-bold tabular-nums">{int.format(featuredDisposed)}</span><div className="w-9 rounded-t-sm bg-[#d39a3c]" style={{ height: `${Math.max(8, (featuredDisposed / featuredMax) * 64)}px` }} /><span className="text-[0.65rem] text-white/60">Baixados</span></div>
              </div>
            )}
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-white">Explorar o tema completo <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
          </Link>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {otherThemes.map(t => (
              <Link key={t.themeId} href={`/judiciario/temas/${t.themeId.toLowerCase()}`} className="focus-ring group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition hover:border-primary">
                <span className="min-w-0"><strong className="block truncate text-sm">{t.title}</strong><span className="block truncate text-xs text-muted-foreground">{t.indicatorCount} indicadores</span></span>
                <ArrowRight size={14} className="shrink-0 text-muted-foreground transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-12">
        <div className="page-shell grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/judiciario/tribunais" className="focus-ring rounded-2xl border bg-background p-5 hover:border-primary"><Building2 className="text-primary" /><strong className="mt-3 block">93 instituições</strong><p className="mt-1 text-xs text-muted-foreground">Diretório completo de tribunais, com cobertura declarada em cada um.</p></Link>
          <Link href="/judiciario/comparar" className="focus-ring rounded-2xl border bg-background p-5 hover:border-primary"><Scale className="text-primary" /><strong className="mt-3 block">Comparador</strong><p className="mt-1 text-xs text-muted-foreground">Compare tribunais num indicador, com metodologia e cobertura lado a lado.</p></Link>
          <Link href="/judiciario/stj/precedentes" className="focus-ring rounded-2xl border bg-background p-5 hover:border-primary"><Gavel className="text-primary" /><strong className="mt-3 block">2.369 precedentes do STJ</strong><p className="mt-1 text-xs text-muted-foreground">Precedentes qualificados, processos vinculados e decisões — recorte parcial, sempre identificado.</p></Link>
          <Link href="/judiciario/stf/temas" className="focus-ring rounded-2xl border bg-background p-5 hover:border-primary"><Gavel className="text-primary" /><strong className="mt-3 block">1.498 temas de Repercussão Geral do STF</strong><p className="mt-1 text-xs text-muted-foreground">Teses fixadas pelo Supremo em questões constitucionais com repercussão para todo o país.</p></Link>
        </div>
      </section>
    </main>
  );
}
