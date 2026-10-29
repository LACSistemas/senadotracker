import {
  getWellbeingComparators, getWellbeingMunicDistribution, getWellbeingOverview, getWellbeingSeries, getWellbeingSocialDistribution,
  type WellbeingObservation,
} from '@senadotracker/db';
import { webPostgresPool } from '../postgres-pool.ts';
import { instrument, memo, scopeFromEntity, scopeOf } from '../security/load.ts';
import { brl, fmt, periodLabel } from '../security/format.ts';
import { IND, MUNIC_DIGITAL_IDS } from './catalog.ts';
import { bars, chart, lastOf, monthlySeries, nameOf, ptsOf, stat, table, territoryCompare, type YV } from './build.ts';
import { actionNarrative, conditionsNarrative, digitalNarrative, evolutionNarrative, portraitLede, socialNarrative, workNarrative } from './narrative.ts';
import type {
  ActionChapter, ConditionsChapter, DigitalChapter, DigitalItem, EvolutionChapter, EvolutionSeries, PortraitFact, SocialChapter, WbScope, WellbeingPageData, WorkChapter,
} from './types.ts';

const brl0 = (v: number): string => brl(v, 0);
const find = (obs: WellbeingObservation[], id: number): WellbeingObservation | null => obs.find(o => o.indicatorId === id) ?? null;
const lastValid = (rows: WellbeingObservation[] | null): WellbeingObservation | null => { if (!rows) return null; for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.value != null) return rows[i]!; return null; };
const notNull = <T,>(xs: Array<T | null | undefined>): T[] => xs.filter((x): x is T => x != null);

/** Carrega a página de Bem-estar: 1 chamada a `getWellbeingOverview` (que já cobre 27 observações + cobertura + finanças)
 * mais um punhado de chamadas pontuais de série/comparador — nunca uma por indicador, nunca `coverage_all`. */
export async function loadWellbeingPage(scope: WbScope): Promise<WellbeingPageData> {
  const t0 = performance.now(); const { q: pool, stats } = instrument(webPostgresPool()); const dbStart = performance.now();
  const isMuni = scope.kind === 'municipio'; const ref = { entityId: scope.entityId };

  const overview = await getWellbeingOverview(pool, ref);
  const obs = overview?.observations ?? [];
  const o = (id: number) => find(obs, id);

  const incomeMedianObs = o(IND.incomeMedian), incomeMeanObs = o(IND.incomeMean), giniObs = o(IND.gini);
  const waterObs = o(IND.waterOk), sewerObs = o(IND.sewerOk), garbageObs = o(IND.garbageOk);
  const crasObs = o(IND.cras), creasObs = o(IND.creas), idcrasObs = o(IND.idcrasMean), idcreasObs = o(IND.idcreasMean), idconselhoObs = o(IND.idconselhoMean);
  const remunerationObs = o(IND.raisRemuneration);
  const digitalObs = MUNIC_DIGITAL_IDS.map(id => ({ id, obs: o(id) }));

  const [incomeComparator, giniComparator, raisSeries, cagedStockSeries, cagedAdmSeries, cagedDisSeries, cagedBalSeries, digitalDistributions, crasDist, creasDist] = await Promise.all([
    incomeMedianObs?.value != null ? getWellbeingComparators(pool, ref, incomeMedianObs.indicatorCode) : Promise.resolve(null),
    !isMuni && giniObs?.value != null ? getWellbeingComparators(pool, ref, giniObs.indicatorCode) : Promise.resolve(null),
    getWellbeingSeries(pool, ref, 'WB-LABOR-RAIS-STOCK'),
    getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-STOCK'),
    getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-ADM'),
    getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-DIS'),
    getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-BAL'),
    !isMuni ? Promise.all(digitalObs.map(d => getWellbeingMunicDistribution(pool, d.obs?.indicatorCode ?? '', scope.ufCode))) : Promise.resolve(null),
    !isMuni ? getWellbeingSocialDistribution(pool, 'WB-SUAS-CRAS', scope.ufCode) : Promise.resolve(null),
    !isMuni ? getWellbeingSocialDistribution(pool, 'WB-SUAS-CREAS', scope.ufCode) : Promise.resolve(null),
  ]);

  // ======================================================================= Capítulo 1 — Condições de vida
  const incomeBars = bars([
    { label: 'Média', value: incomeMeanObs?.value ?? null, ...(incomeMeanObs?.value != null ? { display: brl0(incomeMeanObs.value) } : {}) },
    { label: 'Mediana', value: incomeMedianObs?.value ?? null, ...(incomeMedianObs?.value != null ? { display: brl0(incomeMedianObs.value) } : {}) },
  ]);
  const housing = bars([
    { label: 'Água adequada', value: waterObs?.value ?? null },
    { label: 'Esgotamento adequado', value: sewerObs?.value ?? null },
    { label: 'Coleta de lixo', value: garbageObs?.value ?? null },
  ].map(r => ({ ...r, ...(r.value != null ? { display: `${fmt(r.value, 0)}%` } : {}) })));
  const giniBrazil = giniComparator?.comparisons.brazil; const giniNote = giniBrazil?.eligible && giniBrazil.value != null ? `Brasil: ${fmt(giniBrazil.value, 3)} (Censo ${incomeMedianObs?.periodStart?.slice(0, 4) ?? '2022'}).` : `Censo ${incomeMedianObs?.periodStart?.slice(0, 4) ?? '2022'}.`;
  const gini = !isMuni && giniObs?.value != null ? stat('Gini da renda', fmt(giniObs.value, 3), undefined, giniNote) : null;
  const incomeCompare = incomeComparator ? territoryCompare({
    ownLabel: nameOf(scope), ...(isMuni ? { stateLabel: scope.stateName } : {}), comparisons: incomeComparator.comparisons,
    year: incomeMedianObs?.periodStart?.slice(0, 4) ?? null, unit: 'R$/mês', format: v => brl0(v), restrictions: incomeComparator.restrictions,
  }) : null;
  const conditions: ConditionsChapter = {
    id: 'condicoes', number: 1, title: 'Condições de vida', narrative: conditionsNarrative({ scope, incomeMedian: incomeMedianObs?.value ?? null, incomeMean: incomeMeanObs?.value ?? null, waterPct: waterObs?.value ?? null, sewerPct: sewerObs?.value ?? null, garbagePct: garbageObs?.value ?? null, gini: !isMuni ? giniObs?.value ?? null : null }),
    available: incomeMedianObs?.value != null || housing.length > 0, emptyReason: 'O Censo 2022 não publicou renda ou condições domiciliares para este território.',
    limits: ['Dado do Censo Demográfico 2022: uma única fotografia, sem série anual.', 'O Gini da renda per capita só é publicado pelo IBGE em nível de UF e Brasil, nunca por município.', 'Água, esgoto e lixo "adequados" seguem a definição do IBGE; o percentual considera só domicílios particulares permanentes.'],
    sources: 'Fonte: IBGE, Censo Demográfico 2022.',
    incomeBars, incomeCompare, housing, gini,
    disclosures: notNull([incomeMedianObs, incomeMeanObs, !isMuni ? giniObs : null, waterObs, sewerObs, garbageObs]),
  };

  // ======================================================================= Capítulo 2 — Trabalho e oportunidades
  const raisYV: YV[] = (raisSeries ?? []).filter(r => r.periodStart).map(r => ({ year: Number(r.periodStart!.slice(0, 4)), value: r.value }));
  const raisLast = lastOf(raisYV);
  const cagedStockLast = lastValid(cagedStockSeries), cagedAdmLast = lastValid(cagedAdmSeries), cagedDisLast = lastValid(cagedDisSeries), cagedBalLast = lastValid(cagedBalSeries);
  const raisChart = chart({ id: 'rais-estoque', title: 'Vínculos formais ativos (RAIS)', unit: 'vínculos', digits: 0, series: [{ key: 'own', label: nameOf(scope), color: 'primary', points: ptsOf(raisYV) }], notes: ['Estoque de vínculos formais ativos em 31 de dezembro de cada ano.'], source: 'RAIS (MTE)', coverage: 'estoque anual' });
  const cagedChart = chart({
    id: 'caged-fluxo', title: 'Admissões, desligamentos e saldo mensal (Novo Caged)', unit: 'movimentações', digits: 0, grain: 'M',
    series: [monthlySeries('adm', 'Admissões', cagedAdmSeries ?? [], 'blue'), monthlySeries('dis', 'Desligamentos', cagedDisSeries ?? [], 'amber'), monthlySeries('bal', 'Saldo', cagedBalSeries ?? [], 'primary')],
    notes: ['O Novo Caged mede movimentações vinculadas ao local do estabelecimento, não ao local de residência de quem trabalha.', 'Saldo negativo significa mais desligamentos que admissões no mês; não é taxa de desemprego.'],
    source: 'Novo Caged (MTE)', coverage: 'admissões e desligamentos declarados',
  });
  const remuneration = remunerationObs?.value != null ? stat('Remuneração média de dezembro (RAIS)', brl0(remunerationObs.value), undefined, 'Só publicada em nível estadual nesta edição.') : null;
  const workStats = [
    raisLast && stat('Vínculos formais ativos (RAIS)', fmt(raisLast.value!), 'vínculos', `estoque em 31/12/${raisLast.year}`),
    cagedStockLast && stat('Estoque de referência (Novo Caged)', fmt(cagedStockLast.value!), 'vínculos', cagedStockLast.periodStart ? periodLabel(cagedStockLast.periodStart.slice(0, 7)) : null),
    cagedBalLast && stat('Saldo do mês (Novo Caged)', `${cagedBalLast.value! > 0 ? '+' : ''}${fmt(cagedBalLast.value!)}`, 'vínculos', cagedBalLast.periodStart ? periodLabel(cagedBalLast.periodStart.slice(0, 7)) : null),
    cagedAdmLast && cagedDisLast && stat('Admissões e desligamentos do mês', `${fmt(cagedAdmLast.value!)} / ${fmt(cagedDisLast.value!)}`, undefined, cagedAdmLast.periodStart ? periodLabel(cagedAdmLast.periodStart.slice(0, 7)) : null),
  ].filter((x): x is NonNullable<typeof x> => !!x);
  const work: WorkChapter = {
    id: 'trabalho', number: 2, title: 'Trabalho e oportunidades', narrative: workNarrative({ scope, raisYear: raisLast?.year ?? null, raisStock: raisLast?.value ?? null, cagedMonth: cagedBalLast?.periodStart ? periodLabel(cagedBalLast.periodStart.slice(0, 7)) : null, cagedBal: cagedBalLast?.value ?? null, cagedStock: cagedStockLast?.value ?? null }),
    available: !!raisLast || !!cagedBalLast, emptyReason: 'Não há estoque da RAIS nem movimentação do Novo Caged publicados para este território.',
    limits: ['Estoque RAIS (anual), estoque de referência do Caged e fluxo mensal do Caged são três medidas diferentes: nunca somadas entre si.', 'O Novo Caged mede vínculos pelo local do estabelecimento; não é residência nem taxa de desemprego.', 'Remuneração média só está publicada no nível estadual nesta edição.'],
    sources: 'Fontes: RAIS 2023–2025 e Novo Caged (MTE), janeiro–agosto/2026.',
    stats: workStats, raisChart, cagedChart, remuneration,
    disclosures: notNull([lastValid(raisSeries), cagedStockLast, cagedAdmLast, cagedDisLast, cagedBalLast, remunerationObs]),
  };

  // ======================================================================= Capítulo 3 — Rede socioassistencial
  const crasCount = isMuni ? crasObs?.value ?? null : crasDist?.total ?? null;
  const creasCount = isMuni ? creasObs?.value ?? null : creasDist?.total ?? null;
  const crasCapacity = isMuni ? bars([
    { label: 'Até 2.500 famílias', value: o(IND.crasCap2500)?.value ?? null },
    { label: 'Até 3.500 famílias', value: o(IND.crasCap3500)?.value ?? null },
    { label: 'Até 5.000 famílias', value: o(IND.crasCap5000)?.value ?? null },
  ]) : [];
  const indices = isMuni ? [
    idcrasObs?.value != null && stat('IDCRAS médio', fmt(idcrasObs.value, 2)),
    idcreasObs?.value != null && stat('IDCREAS médio', fmt(idcreasObs.value, 2)),
    idconselhoObs?.value != null && stat('IDConselho', fmt(idconselhoObs.value, 2)),
  ].filter((x): x is ReturnType<typeof stat> => !!x) : [];
  const social: SocialChapter = {
    id: 'rede-social', number: 3, title: 'Rede socioassistencial', narrative: socialNarrative({ scope, cras: crasCount, creas: creasCount }),
    available: crasCount != null || creasCount != null, emptyReason: 'O Censo SUAS 2024 não registrou CRAS ou CREAS respondente para este território.',
    limits: [
      'CRAS e CREAS são contados pela sede: um município sem CREAS sediado pode ter atendimento regional, o que este dado não mostra.',
      'Capacidade de referenciamento é o que a unidade DECLAROU suportar, não quantas famílias foram efetivamente atendidas.',
      !isMuni ? 'IDCRAS, IDCREAS e IDConselho são índices por município; uma média estadual simples trataria municípios de tamanhos diferentes como iguais, por isso não é calculada aqui — veja cada município individualmente.' : 'Índices oficiais do Censo SUAS 2024; não são uma nota de qualidade criada pelo Cívica.',
      'Não inclui CadÚnico, Bolsa Família nem BPC: essas fontes ainda não foram publicadas neste domínio.',
    ],
    sources: 'Fonte: Censo SUAS 2024 (SAGICAD-MDS).',
    cras: [crasCount != null && stat('CRAS', fmt(crasCount), 'unidades', isMuni ? undefined : `soma dos ${crasDist?.respondentMunicipalities ?? 0} municípios respondentes`)].filter((x): x is ReturnType<typeof stat> => !!x),
    crasCapacity, creas: creasCount != null ? stat('CREAS com sede', fmt(creasCount), 'unidades', isMuni ? undefined : `soma dos ${creasDist?.respondentMunicipalities ?? 0} municípios respondentes`) : null,
    creasNote: !isMuni ? 'Município sem CREAS sediado pode receber atendimento de uma unidade regional.' : null, indices,
    disclosures: isMuni ? notNull([crasObs, creasObs, idcrasObs, idcreasObs, idconselhoObs]) : [],
  };

  // ======================================================================= Capítulo 4 — Cotidiano digital
  let items: DigitalItem[] = []; let distribution: DigitalChapter['distribution'] = [];
  if (isMuni) {
    items = digitalObs.map(({ obs: d }) => ({
      code: d?.indicatorCode ?? '', label: d?.label ?? '', detail: d?.value == null ? 'Sem resposta Sim/Não registrada no MUNIC 2024.' : null,
      status: d?.value === 1 ? 'sim' : d?.value === 0 ? 'nao' : 'sem_resposta_valida',
    }));
  } else {
    distribution = (digitalDistributions ?? []).filter((d): d is NonNullable<typeof d> => d != null).map(d => ({
      label: d.label, value: d.validCount > 0 && d.positiveCount != null ? Math.round((d.positiveCount / d.validCount) * 1000) / 10 : 0,
      display: d.positiveCount != null ? `${fmt(d.positiveCount)} de ${fmt(d.validCount)} prefeituras` : 'sem respostas válidas',
    }));
  }
  const municipalityAnswer = isMuni ? (digitalObs[0]?.obs?.value === 1 ? true : digitalObs[0]?.obs?.value === 0 ? false : null) : null;
  const ufValidRaw = (digitalDistributions ?? []).find((d): d is NonNullable<typeof d> => d != null);
  const firstDist = ufValidRaw ? { positive: ufValidRaw.positiveCount, valid: ufValidRaw.validCount } : null;
  const digital: DigitalChapter = {
    id: 'digital', number: 4, title: 'Cotidiano digital', narrative: digitalNarrative({ scope, municipalityAnswer, ufPositive: firstDist?.positive ?? null, ufValid: firstDist?.valid ?? null }),
    available: isMuni ? items.some(i => i.status !== 'sem_resposta_valida') : (digitalDistributions ?? []).some(d => d != null && d.validCount > 0),
    emptyReason: 'O MUNIC 2024 não tem resposta válida registrada para este território.',
    limits: ['Respostas declaradas pela própria prefeitura ao IBGE (MUNIC), categóricas: Sim, Não, Recusa ou Não informou.', 'O denominador é o número de prefeituras com resposta Sim/Não, não a população.', '"Não" declarado não prova ausência de qualquer serviço digital; mede só a resposta a esta pergunta específica.'],
    sources: 'Fonte: IBGE, Pesquisa de Informações Básicas Municipais (MUNIC) 2024.',
    items, distribution,
    disclosures: isMuni ? notNull(digitalObs.map(d => d.obs)) : [],
  };

  // ======================================================================= Capítulo 5 — Ação pública
  const financeRows = overview?.finance?.rows ?? [];
  const financeYears = [...new Set(financeRows.map(r => r.year))].sort((a, b) => a - b);
  const lastFyYear = financeYears.at(-1) ?? null;
  const stageAt = (year: number, st: 'EMP' | 'LIQ' | 'PAG') => financeRows.find(r => r.year === year && r.stage === st)?.amountBrl ?? null;
  const emp = lastFyYear != null ? stageAt(lastFyYear, 'EMP') : null, liq = lastFyYear != null ? stageAt(lastFyYear, 'LIQ') : null, pag = lastFyYear != null ? stageAt(lastFyYear, 'PAG') : null;
  const financeTable = table('Despesa em Assistência Social por exercício (Siconfi)', ['Empenhado', 'Liquidado', 'Pago'], financeYears.map(y => [String(y), [stageAt(y, 'EMP') != null ? brl0(stageAt(y, 'EMP')!) : null, stageAt(y, 'LIQ') != null ? brl0(stageAt(y, 'LIQ')!) : null, stageAt(y, 'PAG') != null ? brl0(stageAt(y, 'PAG')!) : null]]), 'Empenhado, liquidado e pago são estágios diferentes da mesma despesa e nunca devem ser somados entre si.');
  const action: ActionChapter = {
    id: 'acao-publica', number: 5, title: 'Ação pública', narrative: actionNarrative({ scope, year: lastFyYear, emp, liq, pag }),
    available: financeRows.length > 0, emptyReason: 'Não há despesa de Assistência Social publicada no Siconfi para este território.',
    limits: ['Função 08 (Assistência Social) do Siconfi; não é a transferência paga diretamente a beneficiários (Bolsa Família, BPC), fontes ainda não publicadas neste domínio.', 'Empenhado, liquidado e pago nunca devem ser somados entre si.', 'Valores não deflacionados: comparação entre anos distantes deve considerar a inflação do período.'],
    sources: 'Fonte: Siconfi (Tesouro Nacional), função 08 — Assistência Social.',
    stats: lastFyYear != null ? [stat('Exercício mais recente publicado', String(lastFyYear)), emp != null && stat('Empenhado', brl0(emp)), liq != null && stat('Liquidado', brl0(liq)), pag != null && stat('Pago', brl0(pag))].filter((x): x is ReturnType<typeof stat> => !!x) : [],
    table: financeTable, disclosures: [],
  };

  // ======================================================================= Capítulo 6 — Evolução e comparações (derivado dos capítulos 2 e 5; nenhuma consulta nova)
  const toMi = (v: number | null) => v == null ? null : v / 1e6;
  const financeChart = chart({
    id: 'siconfi-serie', title: 'Despesa em Assistência Social por exercício', unit: 'R$ milhões', digits: 1,
    series: [{ key: 'emp', label: 'Empenhado', color: 'grey', dash: true, points: ptsOf(financeYears.map(y => ({ year: y, value: toMi(stageAt(y, 'EMP')) }))) }, { key: 'liq', label: 'Liquidado', color: 'blue', points: ptsOf(financeYears.map(y => ({ year: y, value: toMi(stageAt(y, 'LIQ')) }))) }, { key: 'pag', label: 'Pago', color: 'primary', points: ptsOf(financeYears.map(y => ({ year: y, value: toMi(stageAt(y, 'PAG')) }))) }],
    notes: ['Valores correntes, não deflacionados.'], source: 'Siconfi', coverage: 'função 08',
  });
  const evolutionSeries: EvolutionSeries[] = [
    raisChart && { title: 'Vínculos formais ativos (RAIS, 2023–2025)', chart: raisChart },
    cagedChart && { title: 'Admissões, desligamentos e saldo mensal (Novo Caged, 2026)', chart: cagedChart },
    financeChart && { title: 'Despesa em Assistência Social por exercício (Siconfi)', chart: financeChart },
  ].filter((x): x is EvolutionSeries => !!x);
  const evolution: EvolutionChapter = {
    id: 'evolucao', number: 6, title: 'Evolução e comparações', narrative: evolutionNarrative({ scope, hasRais: !!raisChart, hasCaged: !!cagedChart, hasFinance: !!financeChart }),
    available: evolutionSeries.length > 0, emptyReason: 'Não há série temporal suficiente publicada para este território.',
    limits: ['O Censo 2022 (renda, domicílios) e o Censo SUAS 2024 (CRAS/CREAS) têm uma edição só: não entram numa curva anual.', 'Cada série mantém sua própria unidade e período; não combine séries diferentes numa só leitura.'],
    sources: 'Fontes: RAIS, Novo Caged e Siconfi.',
    series: evolutionSeries, disclosures: [],
  };

  // ======================================================================= Retrato (panorama)
  const facts: PortraitFact[] = [];
  if (incomeMedianObs?.value != null) facts.push({ label: 'Renda domiciliar per capita mediana', value: brl0(incomeMedianObs.value), unit: 'R$/mês', period: incomeMedianObs.periodStart?.slice(0, 4) ?? '2022', source: 'Censo IBGE 2022' });
  if (raisLast) facts.push({ label: 'Vínculos formais ativos', value: fmt(raisLast.value!), unit: 'RAIS', period: String(raisLast.year), source: 'RAIS' });
  if (cagedBalLast?.value != null) facts.push({ label: 'Saldo do mês (Novo Caged)', value: `${cagedBalLast.value > 0 ? '+' : ''}${fmt(cagedBalLast.value)}`, unit: 'vínculos', period: cagedBalLast.periodStart ? periodLabel(cagedBalLast.periodStart.slice(0, 7)) : '', source: 'Novo Caged' });
  if (crasCount != null) facts.push({ label: isMuni ? 'CRAS' : 'CRAS no estado', value: fmt(crasCount), unit: 'unidades', period: '2024', source: 'Censo SUAS 2024' });
  const portrait = { lede: portraitLede(scope, facts), facts: facts.slice(0, 4) };

  const cagedFirstPeriod = (cagedBalSeries ?? []).find(r => r.value != null)?.periodStart ?? null;
  const cagedPeriodLabel = cagedFirstPeriod && cagedBalLast?.periodStart ? `${periodLabel(cagedFirstPeriod.slice(0, 7))}–${periodLabel(cagedBalLast.periodStart.slice(0, 7))}` : null;
  const sources: Array<{ label: string; period: string }> = [
    conditions.available && { label: 'IBGE, Censo Demográfico', period: '2022' },
    !!raisLast && { label: 'RAIS (MTE)', period: '2023–2025' }, cagedPeriodLabel && { label: 'Novo Caged (MTE)', period: cagedPeriodLabel },
    social.available && { label: 'Censo SUAS (SAGICAD-MDS)', period: '2024' }, digital.available && { label: 'IBGE, MUNIC', period: '2024' },
    action.available && { label: 'Siconfi (Tesouro Nacional)', period: financeYears.length ? `${financeYears[0]}–${financeYears.at(-1)}` : '' },
  ].filter((x): x is { label: string; period: string } => !!x);

  const dbWall = performance.now() - dbStart; const buildMs = performance.now() - t0;
  return { scope, portrait, conditions, work, social, digital, action, evolution, sources, meta: { sqlStatements: stats.n, dbMs: Math.round(dbWall), buildMs: Math.round(buildMs) } };
}

const cachedLoad = (scope: WbScope) => memo(`wellbeing:${scope.entityId}`, () => loadWellbeingPage(scope), 60_000);
export { scopeOf, scopeFromEntity, cachedLoad as loadWellbeingPageCached };
