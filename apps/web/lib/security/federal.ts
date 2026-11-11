import { getOrganizedCrimeNational, getPrisonNational, getSecurityFinanceNational, getSecurityStaffingNational, type PriPoint } from '@senadotracker/db';
import { webPostgresPool } from '../postgres-pool.ts';
import { memo } from './load.ts';
import { fmt } from './format.ts';
import type { ChartSeries, ChartView, Narrative } from './types.ts';

export interface BarRow { label: string; value: number; display: string; note?: string | null }
export interface StatItem { label: string; value: string; unit?: string; note?: string | null }
export interface SummaryTable { title: string; columns: string[]; rows: Array<{ id: string; label: string; cells: Array<string | null> }>; caption?: string }

const pt = (year: number, v: number | null) => ({ t: String(year), v, state: v == null ? 'absent' as const : 'ok' as const });
const seriesChart = (id: string, title: string, unit: string, digits: number, points: Array<{ year: number; value: number | null }>, notes: string[], source: string, coverage: string): ChartView | null => {
  if (!points.some(p => p.value != null)) return null;
  const years = points.filter(p => p.value != null).map(p => p.year);
  const series: ChartSeries[] = [{ key: 'brasil', label: 'Brasil', color: 'primary', points: points.map(p => pt(p.year, p.value)) }];
  return { id, title, unit, digits, grain: 'A', series, notes, source, coverage: `${years[0]}–${years.at(-1)} · ${coverage}` };
};
/** Série mensal (SIAPE: vínculo por mês) — grão 'M', `t` = "AAAA-MM", nunca truncada para ano (criaria pontos
 * duplicados no mesmo ano, achado real: aviso de key duplicada do React, confirmado em captura). */
const monthlyChart = (id: string, title: string, unit: string, digits: number, points: Array<{ month: string; value: number | null }>, notes: string[], source: string, coverage: string): ChartView | null => {
  if (!points.some(p => p.value != null)) return null;
  const months = points.filter(p => p.value != null).map(p => p.month);
  const series: ChartSeries[] = [{ key: 'brasil', label: 'Brasil', color: 'primary', points: points.map(p => ({ t: p.month, v: p.value, state: p.value == null ? 'absent' as const : 'ok' as const })) }];
  return { id, title, unit, digits, grain: 'M', series, notes, source, coverage: `${months[0]}–${months.at(-1)} · ${coverage}` };
};

export interface SecurityFederalPageData {
  crime: { narrative: Narrative; charts: ChartView[]; summary: SummaryTable | null; stateSourcesNote: string; available: boolean; emptyReason: string };
  structure: { narrative: Narrative; fbsp: BarRow[]; pfChart: ChartView | null; prfChart: ChartView | null; available: boolean; emptyReason: string };
  prison: { narrative: Narrative; charts: ChartView[]; summary: SummaryTable | null; stats: StatItem[]; available: boolean; emptyReason: string };
  finance: { narrative: Narrative; chart: ChartView | null; available: boolean; emptyReason: string };
  sources: Array<{ label: string; period: string }>;
}

/** Segurança, nível Brasil (P14.14): diferente dos outros 4 temas, nem todo capítulo da página de UF tem
 * equivalente nacional pronto nesta base — criminalidade ESTADUAL municipalizada (ISP-RJ/SSP-RS/SSP-SP...)
 * e trânsito não têm agregado nacional nesta leitura. O que existe é genuinamente nacional, não uma soma
 * aproximada: `getOrganizedCrimeNational` já soma só indicadores do Sinesp VDE (27 UFs, mesma fonte),
 * nunca estadual com PF/PRF; `getSecurityFinanceNational` é o gasto do próprio órgão superior federal
 * (MJSP/União) — não uma soma dos 27 orçamentos estaduais de segurança, que é outra coisa. */
async function loadSecurityFederal(): Promise<SecurityFederalPageData> {
  const pool = webPostgresPool();
  const [oc, staff, prison, finance] = await Promise.all([
    getOrganizedCrimeNational(pool), getSecurityStaffingNational(pool), getPrisonNational(pool), getSecurityFinanceNational(pool),
  ]);

  // ================================================================= Crime organizado (Sinesp VDE)
  // 11 indicadores VDE existem nesta base; mostrar os 11 como gráfico cheio produzia uma página de 27 mil
  // px (achado real, confirmado em captura) — os 4 famílias mais reconhecíveis viram gráfico, o resto vira
  // uma tabela compacta (mesmo padrão que a UF usa no "explorador": nem todo indicador precisa de gráfico
  // próprio pra ser real e consultável).
  const OC_HEADLINE = ['OC.DRUG.TRAFFICKING_RECORDS', 'OC.WEAPON.FIREARMS_SEIZED', 'OC.ENFORCEMENT.ARREST_WARRANTS_SERVED', 'OC.ENFORCEMENT.FLAGRANT_ARRESTS'];
  const ocSeries = oc?.series ?? [];
  const ocLabel = (family: string) => oc!.families.find(f => f.code === family)?.label ?? family;
  const ocChart = (s: (typeof ocSeries)[number]) => seriesChart(`oc-${s.indicatorId}`, ocLabel(s.family), s.unit, 0, s.years.map(y => ({ year: y.year, value: y.complete ? y.value : null })), [s.note ?? '', 'Ano incompleto (nem todas as 27 UFs × 12 meses com valor) vira lacuna, nunca um valor parcial disfarçado de total.'].filter(Boolean), 'Sinesp VDE', 'Σ das 27 UFs, mesmo indicador');
  const ocHeadlineSeries = OC_HEADLINE.map(code => ocSeries.find(s => s.family === code)).filter((s): s is NonNullable<typeof s> => !!s);
  const ocCharts = ocHeadlineSeries.map(ocChart).filter((c): c is ChartView => !!c);
  const ocRest = ocSeries.filter(s => !OC_HEADLINE.includes(s.family));
  const ocSummary: SummaryTable | null = ocRest.length ? {
    title: 'Outros indicadores do Sinesp VDE', columns: ['Último ano completo', 'Valor'],
    rows: ocRest.map(s => { const last = [...s.years].reverse().find(y => y.complete); return { id: `oc-${s.indicatorId}`, label: ocLabel(s.family), cells: [last ? String(last.year) : null, last ? `${fmt(last.value)} ${s.unit}` : null] }; }),
    caption: 'Σ das 27 UFs do mesmo indicador; ano sem as 27 UFs × 12 meses completos não entra.',
  } : null;
  const crime = {
    narrative: { question: 'O que os registros de criminalidade organizada mostram no Brasil?', answer: ocSeries.length ? `${ocSeries.length} indicadores do Sinesp VDE, somados das 27 UFs.` : 'Sem registros publicados.', context: 'Fonte estadual (Sinesp VDE) — Polícia Federal e PRF têm série própria, não somada aqui. Mais registros pode refletir mais notificação, não necessariamente mais ocorrência.', invite: '' },
    charts: ocCharts, summary: ocSummary, stateSourcesNote: 'Criminalidade estadual municipalizada (RJ, RS, SP e outras fontes próprias de cada estado) não tem agregado nacional nesta base — cada estado define seus próprios tipos penais, o que impede somar.',
    available: ocCharts.length > 0 || !!ocSummary, emptyReason: 'Não há registros de criminalidade organizada publicados para o Brasil.',
  };

  // ================================================================= Efetivos e estrutura
  const fbspBars: BarRow[] = (staff?.fbsp ?? []).filter(p => p.value != null).map(p => ({ label: p.label, value: p.value!, display: fmt(p.value!) }));
  const pfSeries = staff?.siape.find(s => s.code === 'PF'); const prfSeries = staff?.siape.find(s => s.code === 'PRF');
  const pfChart = pfSeries?.series.length ? monthlyChart('pf', 'Polícia Federal — registros de vínculo (SIAPE)', 'vínculos', 0, pfSeries.series.map(s => ({ month: s.month, value: s.registros })), [pfSeries.note], 'SIAPE', 'cadastro de vínculo') : null;
  const prfChart = prfSeries?.series.length ? monthlyChart('prf', 'Polícia Rodoviária Federal — registros de vínculo (SIAPE)', 'vínculos', 0, prfSeries.series.map(s => ({ month: s.month, value: s.registros })), [prfSeries.note], 'SIAPE', 'cadastro de vínculo') : null;
  const structure = {
    narrative: { question: 'Quantos profissionais de segurança pública o Brasil tem?', answer: fbspBars.length ? `${fbspBars.length} corporações com efetivo declarado (FBSP).` : 'Sem efetivo publicado.', context: 'Efetivo declarado por cada corporação ao Fórum Brasileiro de Segurança Pública; PF e PRF vêm do cadastro de vínculo SIAPE, não é efetivo policial no mesmo sentido.', invite: '' },
    fbsp: fbspBars, pfChart, prfChart, available: fbspBars.length > 0 || !!pfChart || !!prfChart, emptyReason: 'Não há efetivos de segurança pública publicados para o Brasil.',
  };

  // ================================================================= Sistema prisional
  // A fonte publica 2 competências por ano (1º e 2º semestre) — 1 ponto por ano usa o SEGUNDO semestre
  // disponível (mais completo/recente), nunca os dois juntos (duplicaria o ano no gráfico, achado real).
  // 13 indicadores existem nesta base (capacidade/população por sexo, regime, sistema federal, domiciliar
  // etc.) — mesmo tratamento do crime organizado acima: capacidade/população/ocupação do sistema estadual
  // (o maior e mais completo) viram gráfico; o resto (margens por sexo/regime, sistema federal, domiciliar)
  // vira tabela.
  const yearlyPrisonPoints = (points: PriPoint[]) => { const byYear = new Map<number, PriPoint>(); for (const p of points) byYear.set(Math.floor(p.competence / 100), p); return [...byYear.entries()].sort(([a], [b]) => a - b).map(([year, p]) => ({ year, value: p.value })); };
  const priSeries = prison?.series ?? [];
  const PRI_HEADLINE_KIND = ['pop', 'cap', 'occ'];
  const priHeadline = PRI_HEADLINE_KIND.map(kind => priSeries.find(s => s.scope === 'E' && s.kind === kind)).filter((s): s is NonNullable<typeof s> => !!s);
  const prisonCharts = priHeadline.map(s => seriesChart(`pri-${s.indicatorId}`, s.label, s.unit, s.kind === 'occ' ? 1 : 0, yearlyPrisonPoints(s.points), [s.note], 'SISDEPEN/SENAPPEN', 'último semestre publicado de cada ano')).filter((c): c is ChartView => !!c);
  const priRest = priSeries.filter(s => !priHeadline.includes(s));
  const prisonSummary: SummaryTable | null = priRest.length ? {
    title: 'Outros indicadores do sistema prisional', columns: ['Último semestre', 'Valor'],
    rows: priRest.map(s => { const last = [...s.points].reverse().find(p => p.value != null); return { id: `pri-${s.indicatorId}`, label: s.label, cells: [last?.ref ?? null, last ? `${fmt(last.value!)} ${s.unit}` : null] }; }),
    caption: 'Margens por sexo, regime, sistema federal e domiciliar — detalham os 3 indicadores principais acima, nunca somadas a eles.',
  } : null;
  const latestCov = prison?.coverage.at(-1) ?? null;
  const prisonStats = latestCov ? [{ label: 'Unidades no cadastro', value: fmt(latestCov.unitsInFile) }, { label: 'UFs participantes', value: `${latestCov.ufsParticipating} de 27` }] : [];
  const prisonCh = { narrative: { question: 'Como está o sistema prisional brasileiro?', answer: prisonCharts.length ? `${priSeries.length} indicadores nacionais de capacidade e população prisional.` : 'Sem série publicada.', context: 'Dados declarados semestralmente pelas unidades prisionais ao SISDEPEN/SENAPPEN; cobertura e completude variam por semestre.', invite: '' }, charts: prisonCharts, summary: prisonSummary, stats: prisonStats, available: prisonCharts.length > 0 || !!prisonSummary, emptyReason: 'Não há série do sistema prisional publicada para o Brasil.' };

  // ================================================================= Finanças (União)
  const finYears = finance?.years ?? [];
  const finChart = seriesChart('fin-br', 'Despesa paga em Segurança Pública — órgão superior federal (MJSP)', 'R$ milhões', 1, finYears.map(y => ({ year: y.exercicio, value: y.function06.paga ? y.function06.paga.value / 1e6 : null })), ['Valores do próprio orçamento da União (MJSP), não uma soma dos orçamentos estaduais de segurança — são peças orçamentárias diferentes.', 'Empenhado, liquidado e pago são estágios diferentes do mesmo gasto: nunca somados entre si.'], 'Siconfi/Portal da Transparência', 'função 06, órgão MJSP');
  const financeCh = { narrative: { question: 'Quanto a União gasta com segurança pública?', answer: finChart ? `Série de despesa federal (MJSP) de ${finYears[0]?.exercicio} a ${finYears.at(-1)?.exercicio}.` : 'Sem série publicada.', context: 'É o gasto do órgão superior federal (Ministério da Justiça e Segurança Pública), não a soma dos 27 orçamentos estaduais de segurança — essas são peças orçamentárias independentes, de entes federativos diferentes.', invite: '' }, chart: finChart, available: !!finChart, emptyReason: 'Não há série de despesa federal em segurança publicada.' };

  const sources: Array<{ label: string; period: string }> = [
    crime.available && { label: 'Sinesp VDE (MJSP)', period: '27 UFs' }, structure.available && { label: 'FBSP e SIAPE (PF/PRF)', period: 'edição mais recente' },
    prisonCh.available && { label: 'SISDEPEN/SENAPPEN', period: 'série semestral' }, financeCh.available && { label: 'Siconfi/Portal da Transparência (MJSP)', period: finYears.length ? `${finYears[0]!.exercicio}–${finYears.at(-1)!.exercicio}` : '' },
  ].filter((x): x is { label: string; period: string } => !!x);

  return { crime, structure, prison: prisonCh, finance: financeCh, sources };
}

export const loadSecurityFederalPageCached = (): Promise<SecurityFederalPageData> => memo('security:federal', loadSecurityFederal, 60_000);
