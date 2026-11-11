import {
  getWellbeingMunicDistribution, getWellbeingOverview, getWellbeingSeries, getWellbeingSocialDistribution, type WellbeingObservation,
} from '@senadotracker/db';
import { webPostgresPool } from '../postgres-pool.ts';
import { memo } from '../security/load.ts';
import { brl, fmt, periodLabel } from '../security/format.ts';
import type { ChartSeries, ChartView, Narrative } from '../security/types.ts';
import { IND, MUNIC_DIGITAL_IDS } from './catalog.ts';

export interface BarRow { label: string; value: number; display: string; note?: string | null }
export interface StatItem { label: string; value: string; unit?: string; note?: string | null }
const brl0 = (v: number) => brl(v, 0);
const find = (obs: WellbeingObservation[], id: number): WellbeingObservation | null => obs.find(o => o.indicatorId === id) ?? null;
const lastValid = (rows: WellbeingObservation[] | null): WellbeingObservation | null => { if (!rows) return null; for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.value != null) return rows[i]!; return null; };
const pt = (year: number, v: number | null) => ({ t: String(year), v, state: v == null ? 'absent' as const : 'ok' as const });
const monthly = (rows: WellbeingObservation[]): ChartSeries['points'] => rows.filter(r => r.periodStart).map(r => ({ t: r.periodStart!.slice(0, 7), v: r.value, state: r.value == null ? 'absent' as const : 'ok' as const }));

export interface WellbeingFederalPageData {
  conditions: { narrative: Narrative; incomeBars: BarRow[]; housing: BarRow[]; gini: StatItem | null; available: boolean; emptyReason: string };
  work: { narrative: Narrative; stats: StatItem[]; raisChart: ChartView | null; cagedChart: ChartView | null; available: boolean; emptyReason: string };
  social: { narrative: Narrative; stats: StatItem[]; available: boolean; emptyReason: string };
  digital: { narrative: Narrative; distribution: BarRow[]; available: boolean; emptyReason: string };
  action: { narrative: Narrative; stats: StatItem[]; available: boolean; emptyReason: string };
  sources: Array<{ label: string; period: string }>;
}

/** Bem-estar, nível Brasil (P14.14): `entityId: 76` já é a entidade Brasil de primeira classe neste
 * domínio (confirmado em uso real por `/executivo`, `loadWellbeingOverview({entityId:76})`). CRAS/CREAS e
 * indicadores MUNIC vêm de `getWellbeingSocialDistribution`/`getWellbeingMunicDistribution` SEM `ufCode` —
 * documentado no próprio código-fonte como "soma... entre os municípios... do Brasil, sem ufCode": a MESMA
 * fórmula já usada pelas páginas de UF, generalizada para quando o território É o Brasil. */
async function loadWellbeingFederal(): Promise<WellbeingFederalPageData> {
  const pool = webPostgresPool(); const ref = { entityId: 76 };
  const overview = await getWellbeingOverview(pool, ref);
  const obs = overview?.observations ?? []; const o = (id: number) => find(obs, id);
  const incomeMedianObs = o(IND.incomeMedian), incomeMeanObs = o(IND.incomeMean), giniObs = o(IND.gini);
  const waterObs = o(IND.waterOk), sewerObs = o(IND.sewerOk), garbageObs = o(IND.garbageOk);
  const remunerationObs = o(IND.raisRemuneration);
  const digitalObs = MUNIC_DIGITAL_IDS.map(id => ({ id, obs: o(id) }));

  const [raisSeries, cagedStockSeries, cagedAdmSeries, cagedDisSeries, cagedBalSeries, digitalDistributions, crasDist, creasDist] = await Promise.all([
    getWellbeingSeries(pool, ref, 'WB-LABOR-RAIS-STOCK'), getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-STOCK'), getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-ADM'), getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-DIS'), getWellbeingSeries(pool, ref, 'WB-LABOR-CAGED-BAL'),
    Promise.all(digitalObs.map(d => getWellbeingMunicDistribution(pool, d.obs?.indicatorCode ?? ''))),
    getWellbeingSocialDistribution(pool, 'WB-SUAS-CRAS'), getWellbeingSocialDistribution(pool, 'WB-SUAS-CREAS'),
  ]);

  // ================================================================= Condições de vida
  const incomeBars: BarRow[] = [
    incomeMeanObs?.value != null && { label: 'Média', value: incomeMeanObs.value, display: brl0(incomeMeanObs.value) },
    incomeMedianObs?.value != null && { label: 'Mediana', value: incomeMedianObs.value, display: brl0(incomeMedianObs.value) },
  ].filter((x): x is BarRow => !!x);
  const housing: BarRow[] = [
    waterObs?.value != null && { label: 'Água adequada', value: waterObs.value, display: `${fmt(waterObs.value, 0)}%` },
    sewerObs?.value != null && { label: 'Esgotamento adequado', value: sewerObs.value, display: `${fmt(sewerObs.value, 0)}%` },
    garbageObs?.value != null && { label: 'Coleta de lixo', value: garbageObs.value, display: `${fmt(garbageObs.value, 0)}%` },
  ].filter((x): x is BarRow => !!x);
  const gini: StatItem | null = giniObs?.value != null ? { label: 'Gini da renda', value: fmt(giniObs.value, 3), note: `Censo ${incomeMedianObs?.periodStart?.slice(0, 4) ?? '2022'}.` } : null;
  const conditions = {
    narrative: { question: 'Como vivem as famílias brasileiras?', answer: incomeMedianObs?.value != null ? `Renda domiciliar per capita mediana de ${brl0(incomeMedianObs.value)}/mês (Censo ${incomeMedianObs.periodStart?.slice(0, 4)}).` : 'Sem renda publicada.', context: 'Dado do Censo Demográfico 2022: uma única fotografia, sem série anual.', invite: '' },
    incomeBars, housing, gini, available: incomeMedianObs?.value != null || housing.length > 0, emptyReason: 'O Censo 2022 não publicou renda ou condições domiciliares para o Brasil.',
  };

  // ================================================================= Trabalho
  const raisLast = lastValid(raisSeries); const cagedStockLast = lastValid(cagedStockSeries); const cagedBalLast = lastValid(cagedBalSeries); const cagedAdmLast = lastValid(cagedAdmSeries); const cagedDisLast = lastValid(cagedDisSeries);
  const raisChart: ChartView | null = (raisSeries ?? []).some(r => r.value != null) ? { id: 'rais-br', title: 'Vínculos formais ativos — Brasil (RAIS)', unit: 'vínculos', digits: 0, grain: 'A', series: [{ key: 'own', label: 'Brasil', color: 'primary', points: (raisSeries ?? []).filter(r => r.periodStart).map(r => pt(Number(r.periodStart!.slice(0, 4)), r.value)) }], notes: ['Estoque de vínculos formais ativos em 31 de dezembro de cada ano.'], source: 'RAIS (MTE)', coverage: 'estoque anual' } : null;
  const cagedChart: ChartView | null = (cagedAdmSeries ?? []).some(r => r.value != null) || (cagedDisSeries ?? []).some(r => r.value != null) ? {
    id: 'caged-br', title: 'Admissões, desligamentos e saldo mensal — Brasil (Novo Caged)', unit: 'movimentações', digits: 0, grain: 'M',
    series: [
      { key: 'adm', label: 'Admissões', color: 'blue', points: monthly(cagedAdmSeries ?? []) }, { key: 'dis', label: 'Desligamentos', color: 'amber', points: monthly(cagedDisSeries ?? []) }, { key: 'bal', label: 'Saldo', color: 'primary', points: monthly(cagedBalSeries ?? []) },
    ], notes: ['O Novo Caged mede movimentações vinculadas ao local do estabelecimento.', 'Saldo negativo significa mais desligamentos que admissões no mês; não é taxa de desemprego.'], source: 'Novo Caged (MTE)', coverage: 'admissões e desligamentos declarados',
  } : null;
  const workStats: StatItem[] = [
    raisLast && { label: 'Vínculos formais ativos (RAIS)', value: fmt(raisLast.value!), unit: 'vínculos', note: `estoque em 31/12/${raisLast.periodStart?.slice(0, 4)}` },
    cagedStockLast && { label: 'Estoque de referência (Novo Caged)', value: fmt(cagedStockLast.value!), unit: 'vínculos', note: cagedStockLast.periodStart ? periodLabel(cagedStockLast.periodStart.slice(0, 7)) : null },
    cagedBalLast && { label: 'Saldo do mês (Novo Caged)', value: `${cagedBalLast.value! > 0 ? '+' : ''}${fmt(cagedBalLast.value!)}`, unit: 'vínculos', note: cagedBalLast.periodStart ? periodLabel(cagedBalLast.periodStart.slice(0, 7)) : null },
    remunerationObs?.value != null && { label: 'Remuneração média de dezembro (RAIS)', value: brl0(remunerationObs.value) },
    cagedAdmLast && cagedDisLast && { label: 'Admissões e desligamentos do mês', value: `${fmt(cagedAdmLast.value!)} / ${fmt(cagedDisLast.value!)}`, note: cagedAdmLast.periodStart ? periodLabel(cagedAdmLast.periodStart.slice(0, 7)) : null },
  ].filter((x): x is StatItem => !!x);
  const work = { narrative: { question: 'Como está o mercado de trabalho formal no Brasil?', answer: raisLast ? `${fmt(raisLast.value!)} vínculos formais ativos (RAIS, ${raisLast.periodStart?.slice(0, 4)}).` : 'Sem estoque publicado.', context: 'Estoque RAIS (anual), estoque de referência do Caged e fluxo mensal do Caged são três medidas diferentes: nunca somadas entre si.', invite: '' }, stats: workStats, raisChart, cagedChart, available: !!raisLast || !!cagedBalLast, emptyReason: 'Não há estoque da RAIS nem movimentação do Novo Caged publicados para o Brasil.' };

  // ================================================================= Rede socioassistencial
  const crasCount = crasDist?.total ?? null; const creasCount = creasDist?.total ?? null;
  const socialStats: StatItem[] = [
    crasCount != null ? { label: 'CRAS', value: fmt(crasCount), unit: 'unidades', note: `soma dos ${crasDist?.respondentMunicipalities ?? 0} municípios respondentes` } as StatItem : null,
    creasCount != null ? { label: 'CREAS com sede', value: fmt(creasCount), unit: 'unidades', note: `soma dos ${creasDist?.respondentMunicipalities ?? 0} municípios respondentes` } as StatItem : null,
  ].filter((x): x is StatItem => x != null);
  const social = { narrative: { question: 'Qual o tamanho da rede socioassistencial brasileira?', answer: crasCount != null ? `${fmt(crasCount)} CRAS em funcionamento no Brasil (soma dos municípios respondentes).` : 'Sem CRAS publicado.', context: 'CRAS e CREAS são contados pela sede: um município sem CREAS sediado pode ter atendimento regional, o que este dado não mostra. IDCRAS/IDCREAS/IDConselho são índices por município; uma média nacional simples trataria municípios de tamanhos diferentes como iguais, por isso não é calculada aqui.', invite: '' }, stats: socialStats, available: socialStats.length > 0, emptyReason: 'O Censo SUAS 2024 não registrou CRAS ou CREAS respondente para o Brasil.' };

  // ================================================================= Cotidiano digital
  const distribution: BarRow[] = (digitalDistributions ?? []).filter((d): d is NonNullable<typeof d> => d != null).map(d => ({
    label: d.label, value: d.validCount > 0 && d.positiveCount != null ? Math.round((d.positiveCount / d.validCount) * 1000) / 10 : 0,
    display: d.positiveCount != null ? `${fmt(d.positiveCount)} de ${fmt(d.validCount)} prefeituras` : 'sem respostas válidas',
  }));
  const digital = { narrative: { question: 'Como está o cotidiano digital das prefeituras brasileiras?', answer: distribution.length ? `${distribution.length} indicadores digitais declarados pelas prefeituras ao MUNIC 2024.` : 'Sem resposta publicada.', context: 'Respostas declaradas pela própria prefeitura ao IBGE (MUNIC), categóricas: Sim, Não, Recusa ou Não informou. O denominador é o número de prefeituras com resposta Sim/Não, não a população.', invite: '' }, distribution, available: (digitalDistributions ?? []).some(d => d != null && d.validCount > 0), emptyReason: 'O MUNIC 2024 não tem resposta válida registrada para o Brasil.' };

  // ================================================================= Ação pública
  const financeRows = overview?.finance?.rows ?? []; const financeYears = [...new Set(financeRows.map(r => r.year))].sort((a, b) => a - b); const lastFyYear = financeYears.at(-1) ?? null;
  const stageAt = (year: number, st: 'EMP' | 'LIQ' | 'PAG') => financeRows.find(r => r.year === year && r.stage === st)?.amountBrl ?? null;
  const emp = lastFyYear != null ? stageAt(lastFyYear, 'EMP') : null, liq = lastFyYear != null ? stageAt(lastFyYear, 'LIQ') : null, pag = lastFyYear != null ? stageAt(lastFyYear, 'PAG') : null;
  const actionStats: StatItem[] = [lastFyYear != null ? { label: 'Exercício mais recente publicado', value: String(lastFyYear) } : null, emp != null ? { label: 'Empenhado', value: brl0(emp) } : null, liq != null ? { label: 'Liquidado', value: brl0(liq) } : null, pag != null ? { label: 'Pago', value: brl0(pag) } : null].filter((x): x is StatItem => x != null);
  const action = { narrative: { question: 'Quanto o Brasil gasta com Assistência Social?', answer: lastFyYear != null && pag != null ? `${brl0(pag)} pagos em Assistência Social (União, função 08) em ${lastFyYear}.` : 'Sem despesa publicada.', context: 'Função 08 (Assistência Social) do Siconfi, só da União — não é a transferência paga diretamente a beneficiários (Bolsa Família, BPC), fontes ainda não publicadas neste domínio. Empenhado, liquidado e pago nunca devem ser somados entre si.', invite: '' }, stats: actionStats, available: financeRows.length > 0, emptyReason: 'Não há despesa de Assistência Social publicada no Siconfi para a União.' };

  const sources: Array<{ label: string; period: string }> = [
    conditions.available && { label: 'IBGE, Censo Demográfico', period: '2022' }, !!raisLast && { label: 'RAIS (MTE)', period: '2023–2025' },
    (cagedBalSeries ?? []).some(r => r.value != null) && { label: 'Novo Caged (MTE)', period: '2026' }, social.available && { label: 'Censo SUAS (SAGICAD-MDS)', period: '2024' },
    digital.available && { label: 'IBGE, MUNIC', period: '2024' }, action.available && { label: 'Siconfi (Tesouro Nacional)', period: financeYears.length ? `${financeYears[0]}–${financeYears.at(-1)}` : '' },
  ].filter((x): x is { label: string; period: string } => !!x);

  return { conditions, work, social, digital, action, sources };
}

export const loadWellbeingFederalPageCached = (): Promise<WellbeingFederalPageData> => memo('wellbeing:federal', loadWellbeingFederal, 60_000);
