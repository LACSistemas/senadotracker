import { toChartCoverage } from '@/components/judiciary/availability';
import { MultiLineChart, RankedBars, StackedBarChart, CompactTrend } from '@/components/charts';
import { formatInt } from '@/components/territory/territory-ui';
import type { FederalFinancas, FederalFinancasHistory, PublicDebtSeries } from '@senadotracker/db';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moneyCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

/**
 * P14.49 — extraído de `/executivo/federal/page.tsx` (que ficava com todo o aprofundamento de finanças
 * dentro da aba "Visão geral", a única das 6 áreas sem sua própria sub-rota — achado real do feedback
 * do usuário). Agora é o conteúdo de `/executivo/federal/financas`, a 6ª aba de `FEDERAL_THEMES`, no
 * mesmo padrão das outras 5 (`HealthFederalPage`, `EducationFederalPage`...): um componente puro que só
 * recebe dado já carregado pela página-rota.
 */
export function FinancasFederalPage({ financas, financasHistory, publicDebt, totalPop, popYear }: {
  financas: FederalFinancas; financasHistory: FederalFinancasHistory; publicDebt: PublicDebtSeries; totalPop: number; popYear: number;
}) {
  // "Como o Governo Federal gasta e arrecada" (P14.46) — DCA I-E/I-C/I-D, só União, lista COMPLETA de
  // funções (não top-6) e todas as 6 categorias econômicas. Nunca combina função com categoria
  // econômica — ver nota em getFederalFinancas (packages/db/src/exec/financas-read.ts).
  const finDespesa = financas.despesa; const finReceita = financas.receita; const finCategoria = financas.despesaPorCategoria;
  const todasFuncoesBars = (finDespesa?.porFuncao ?? []).map(f => ({ key: f.code, label: f.label === f.code ? 'Outras funções' : f.label, value: f.value, meta: `${f.percent.toFixed(1).replace('.', ',')}% do total` }));
  const categoriaBars = (finCategoria?.itens ?? []).map(g => ({ key: g.code, label: g.label, value: g.value, meta: `${g.percent.toFixed(1).replace('.', ',')}% do total`, chip: g.code === 'GND1' ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-primary">Pessoal</span> : undefined }));
  const receitaRows = finReceita ? [
    { label: 'Receita total (bruta)', value: finReceita.total },
    ...(finReceita.correnteCents != null ? [{ label: 'Receita corrente', value: Number(finReceita.correnteCents) / 100 }] : []),
    ...(finReceita.capitalCents != null ? [{ label: 'Receita de capital', value: Number(finReceita.capitalCents) / 100 }] : []),
  ] : [];

  // --- Série 2014–2026 (P14.48), não só o ano mais recente ---
  const histYears = financasHistory.years;
  const yl = (y: number) => String(y);
  const firstHistYear = histYears[0]?.year; const lastHistYear = histYears.at(-1)?.year;
  const histCoverage = (label: string) => firstHistYear != null && lastHistYear != null ? toChartCoverage('AVAILABLE', label, { from: `${firstHistYear}-01-01`, to: `${lastHistYear}-12-31`, grain: 'year' }) : toChartCoverage('NOT_PUBLISHED', label);

  const despesaReceitaSeries = histYears.map(y => ({
    label: yl(y.year),
    values: [
      { label: 'Despesa total', value: y.despesaTotal?.value ?? null, color: '#b45309' },
      { label: 'Despesa primária', value: y.despesaPrimaria?.value ?? null, color: '#ea580c' },
      { label: 'Receita total', value: y.receitaTotal?.value ?? null, color: '#115b45' },
      { label: 'Receita primária (aprox.)', value: y.receitaPrimaria?.value ?? null, color: '#2d7f93' },
    ],
  }));

  const resultadoPrimarioTrend = histYears.map(y => ({ label: yl(y.year), value: y.resultadoPrimario?.value ?? null }));
  const anosComResultado = histYears.filter(y => y.resultadoPrimario != null);
  const ultimoResultado = anosComResultado.at(-1) ?? null;

  const GND_COLOR: Record<string, string> = { GND1: 'bg-chart-1', GND2: 'bg-chart-2', GND3: 'bg-chart-3', GND4: 'bg-chart-4', GND5: 'bg-chart-1', GND6: 'bg-chart-2' };
  const gndByYear = histYears.filter(y => y.gnd.length > 0).map(y => ({ label: yl(y.year), segments: y.gnd.map(g => ({ label: g.label, value: g.value, ...(GND_COLOR[g.code] ? { color: GND_COLOR[g.code]! } : {}) })) }));

  const FUNC_COLOR = ['#115b45', '#2d7f93', '#b45309', '#7c3aed', '#be123c'];
  const funcaoShareSeries = histYears.map(y => ({
    label: yl(y.year),
    values: financasHistory.funcaoSeries.map((f, i) => ({ label: f.label, value: f.points.find(p => p.year === y.year)?.percent ?? null, color: FUNC_COLOR[i % FUNC_COLOR.length]! })),
  }));

  const receitaCorrenteCapitalByYear = histYears.filter(y => y.receitaCorrente || y.receitaCapital).map(y => ({
    label: yl(y.year),
    segments: [
      ...(y.receitaCorrente ? [{ label: 'Receita Corrente', value: y.receitaCorrente.value, color: 'bg-chart-1' }] : []),
      ...(y.receitaCapital ? [{ label: 'Receita de Capital', value: y.receitaCapital.value, color: 'bg-chart-3' }] : []),
    ],
  }));
  const latestReceitaYear = [...histYears].reverse().find(y => y.receitaComposicao.length > 0) ?? null;
  const receitaComposicaoBars = (latestReceitaYear?.receitaComposicao ?? []).map(r => ({ key: r.code, label: r.label, value: r.value, meta: `${r.percent.toFixed(1).replace('.', ',')}% da receita total`, chip: r.code === 'REC-CAP-CREDITO' ? <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-700">Empréstimo novo</span> : undefined }));

  const jurosTrend = histYears.map(y => ({ label: yl(y.year), value: y.gnd.find(g => g.code === 'GND2')?.value ?? null }));
  const debtByYear = new Map<number, number>();
  for (const p of publicDebt.points) debtByYear.set(Number(p.periodStart.slice(0, 4)), p.value);   // ordenado por data: o último ponto de cada ano sobrescreve os anteriores
  const dividaTrend = histYears.map(y => ({ label: yl(y.year), value: debtByYear.get(y.year) ?? null }));

  const latestPerCapita = [...histYears].reverse().find(y => y.despesaTotalPerCapita != null) ?? null;

  // Narrativas determinísticas: regra fixa sobre o dado já carregado, nunca texto gerado por modelo.
  const maxDespesaPrimariaYear = histYears.filter(y => y.despesaPrimaria != null).reduce<typeof histYears[number] | null>((max, y) => !max || y.despesaPrimaria!.value > max.despesaPrimaria!.value ? y : max, null);
  const firstJuros = histYears.find(y => y.gnd.some(g => g.code === 'GND2')) ?? null;
  const lastJuros = [...histYears].reverse().find(y => y.gnd.some(g => g.code === 'GND2')) ?? null;
  let jurosVsPessoalNarrative: string | null = null;
  if (firstJuros && lastJuros && firstJuros.year !== lastJuros.year) {
    const j0 = firstJuros.gnd.find(g => g.code === 'GND2')!.value, j1 = lastJuros.gnd.find(g => g.code === 'GND2')!.value;
    const p0 = firstJuros.gnd.find(g => g.code === 'GND1')?.value, p1 = lastJuros.gnd.find(g => g.code === 'GND1')?.value;
    if (p0 != null && p1 != null && j0 > 0 && p0 > 0) {
      const jGrowth = (j1 / j0 - 1) * 100, pGrowth = (p1 / p0 - 1) * 100;
      jurosVsPessoalNarrative = `Entre ${firstJuros.year} e ${lastJuros.year} (valores nominais, sem deflacionar), a despesa com Juros e Encargos da Dívida ${jGrowth >= pGrowth ? 'cresceu mais' : 'cresceu menos'} que a despesa com Pessoal e Encargos Sociais: ${jGrowth >= 0 ? '+' : ''}${jGrowth.toFixed(0)}% contra ${pGrowth >= 0 ? '+' : ''}${pGrowth.toFixed(0)}%.`;
    }
  }

  return <>
    <section className="page-shell">
      <p className="eyebrow">De onde vem e para onde vai o dinheiro</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight">Como o Governo Federal gasta e arrecada</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Despesa empenhada do exercício{finDespesa ? ` de ${finDespesa.year}` : ''}, por função orçamentária (o que o dinheiro financia) e por categoria econômica (que tipo de gasto é). Siconfi/DCA, declaração anual.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Despesa total empenhada</p><p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">{finDespesa ? moneyCompact.format(finDespesa.total) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">{finDespesa ? `DCA I-E · ${finDespesa.year}` : 'sem dado publicado'}</p></div>
        <div className="min-w-0 rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Despesa primária</p><p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">{finCategoria?.despesaPrimaria != null ? moneyCompact.format(finCategoria.despesaPrimaria) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">{finCategoria ? 'Total − Juros − Amortização da Dívida' : 'sem dado publicado'}</p></div>
        <div className="min-w-0 rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receita total (bruta)</p><p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">{finReceita ? moneyCompact.format(finReceita.total) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">{finReceita ? `DCA I-C · ${finReceita.year}` : 'sem dado publicado'}</p></div>
      </div>

      {receitaRows.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {receitaRows.slice(1).map(r => <span key={r.label} className="text-muted-foreground">{r.label}: <strong className="text-foreground">{moneyCompact.format(r.value)}</strong></span>)}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RankedBars title={`Despesa por função orçamentária${finDespesa ? ` — todas as ${finDespesa.porFuncao.length}` : ''}`} items={todasFuncoesBars} formatValue={moneyCompact.format} coverage={finDespesa ? toChartCoverage('AVAILABLE', 'Siconfi · DCA Anexo I-E, empenhada', { from: `${finDespesa.year}-01-01`, to: `${finDespesa.year}-12-31`, grain: 'year' }) : toChartCoverage('NOT_PUBLISHED', 'Siconfi · DCA Anexo I-E')} />
        <RankedBars title={`Despesa por categoria econômica${finCategoria ? ` (${finCategoria.year})` : ''}`} items={categoriaBars} formatValue={moneyCompact.format} coverage={finCategoria ? toChartCoverage('AVAILABLE', 'Siconfi · DCA Anexo I-D, empenhada', { from: `${finCategoria.year}-01-01`, to: `${finCategoria.year}-12-31`, grain: 'year' }) : toChartCoverage('NOT_PUBLISHED', 'Siconfi · DCA Anexo I-D')} />
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Função e categoria econômica são classificações DIFERENTES da mesma despesa — nunca somam uma na outra ("Pessoal e Encargos Sociais" atravessa Previdência, Saúde e todas as demais funções). "Despesa primária" é derivada aqui (Total − Juros e Encargos da Dívida − Amortização da Dívida): a União toma empréstimo novo (receita de capital) e amortiza dívida velha (despesa) no mesmo exercício, o que infla os totais brutos muito além do que costuma ser chamado de "tamanho do governo". Estágio empenhado, não pago; valores nominais, sem deflacionar.</p>
    </section>

    {histYears.length > 0 && (
      <section className="border-t pt-12">
        <div className="page-shell">
          <p className="eyebrow">A série completa, não só a fotografia de um ano</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">As contas públicas federais ao longo do tempo ({firstHistYear}–{lastHistYear})</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Mesma fonte (Siconfi/DCA, declaração anual da União), agora em série — empenhado, valores nominais, sem deflacionar.</p>

          <div className="mt-6"><MultiLineChart title="Despesa × Receita, total e primária" data={despesaReceitaSeries} coverage={histCoverage('Siconfi · DCA Anexo I-E/I-C/I-D, empenhada')} /></div>

          <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900">Resultado primário — aproximado, não é o número oficial do governo</p>
            <p className="mt-2 text-sm leading-6 text-amber-950/80">{financasHistory.resultadoPrimarioMethodologyNote}</p>
            <div className="mt-4"><CompactTrend title={`Resultado primário aproximado${ultimoResultado ? ` — ${ultimoResultado.year}: ${moneyCompact.format(ultimoResultado.resultadoPrimario!.value)}` : ''}`} data={resultadoPrimarioTrend} area color={ultimoResultado && ultimoResultado.resultadoPrimario!.value < 0 ? '#be123c' : '#115b45'} coverage={anosComResultado.length ? toChartCoverage('AVAILABLE', 'Receita Primária − Despesa Primária, aproximado (DCA)', { from: `${anosComResultado[0]!.year}-01-01`, to: `${anosComResultado.at(-1)!.year}-12-31`, grain: 'year' }) : toChartCoverage('NOT_PUBLISHED', 'Resultado primário aproximado')} /></div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <StackedBarChart title="Despesa por categoria econômica, ano a ano" data={gndByYear} coverage={histCoverage('Siconfi · DCA Anexo I-D, empenhada')} />
            <MultiLineChart title={`Participação das ${financasHistory.funcaoSeries.length} maiores funções na despesa total`} data={funcaoShareSeries} coverage={histCoverage('Siconfi · DCA Anexo I-E, empenhada')} />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">A participação por função usa as funções mais relevantes de {lastHistYear}; se uma função não estava entre as maiores num ano anterior, o ponto daquele ano fica ausente (lacuna honesta, não interpolada nem zero).</p>

          <div className="mt-10">
            <h3 className="text-lg font-black">De onde vem a receita</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <StackedBarChart title="Receita corrente × receita de capital, ano a ano" data={receitaCorrenteCapitalByYear} coverage={histCoverage('Siconfi · DCA Anexo I-C, bruta')} />
              <RankedBars title={`Receita por origem${latestReceitaYear ? ` (${latestReceitaYear.year})` : ''}`} items={receitaComposicaoBars} formatValue={moneyCompact.format} coverage={latestReceitaYear ? toChartCoverage('AVAILABLE', 'Siconfi · DCA Anexo I-C, bruta', { from: `${latestReceitaYear.year}-01-01`, to: `${latestReceitaYear.year}-12-31`, grain: 'year' }) : toChartCoverage('NOT_PUBLISHED', 'Siconfi · DCA Anexo I-C')} />
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">"Operações de Crédito" é empréstimo novo tomado pela União no próprio exercício — é a mesma distorção documentada acima (vira receita de capital aqui e amortização de dívida do lado da despesa); por isso é excluída do cálculo de Receita Primária, não excluída deste gráfico de origem.</p>
          </div>

          <div className="mt-10">
            <h3 className="text-lg font-black">Juros pagos x dívida pública</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Duas métricas de natureza diferente — nunca no mesmo eixo: Juros e Encargos da Dívida é um FLUXO anual (quanto a União pagou de juros naquele ano); Dívida Bruta do Governo Geral é um ESTOQUE (quanto o governo deve, em % do PIB, inclui União + estados + municípios).</p>
            {jurosVsPessoalNarrative && <p className="mt-2 text-sm font-medium text-foreground">{jurosVsPessoalNarrative}</p>}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <CompactTrend title="Juros e Encargos da Dívida (União, por ano)" data={jurosTrend} color="#be123c" coverage={histCoverage('Siconfi · DCA Anexo I-D, empenhada')} />
              <CompactTrend title="Dívida Bruta do Governo Geral (% do PIB, fim de ano)" data={dividaTrend} color="#7c3aed" suffix="%" coverage={toChartCoverage('AVAILABLE', 'Banco Central · SGS série 13762', { from: `${publicDebt.points[0]?.periodStart.slice(0, 4) ?? ''}-01-01`, to: `${publicDebt.latest?.periodStart.slice(0, 4) ?? ''}-12-31`, grain: 'year' })} />
            </div>
          </div>

          {latestPerCapita && (
            <div className="mt-10">
              <h3 className="text-lg font-black">Por habitante ({latestPerCapita.year})</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Despesa total por habitante</p><p className="hero-figure tnum mt-2 truncate text-2xl text-[#14304f]">{latestPerCapita.despesaTotalPerCapita != null ? money.format(latestPerCapita.despesaTotalPerCapita) : '—'}</p></div>
                <div className="min-w-0 rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Despesa primária por habitante</p><p className="hero-figure tnum mt-2 truncate text-2xl text-[#14304f]">{latestPerCapita.despesaPrimariaPerCapita != null ? money.format(latestPerCapita.despesaPrimariaPerCapita) : '—'}</p></div>
                <div className="min-w-0 rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receita total por habitante</p><p className="hero-figure tnum mt-2 truncate text-2xl text-[#14304f]">{latestPerCapita.receitaTotalPerCapita != null ? money.format(latestPerCapita.receitaTotalPerCapita) : '—'}</p></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Divide o valor nacional da União pela população total do Brasil ({formatInt(totalPop)}, {popYear}) — não é um cálculo "por contribuinte" nem considera isenções.</p>
            </div>
          )}

          {maxDespesaPrimariaYear && <p className="mt-10 text-sm text-muted-foreground">No período coberto ({firstHistYear}–{lastHistYear}), o ano de maior despesa primária da União foi <strong className="text-foreground">{maxDespesaPrimariaYear.year}</strong>, com {moneyCompact.format(maxDespesaPrimariaYear.despesaPrimaria!.value)}.</p>}
        </div>
      </section>
    )}
  </>;
}
