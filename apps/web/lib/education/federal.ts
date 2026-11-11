import {
  getEducationNationalInfra, getEducationNationalOffer, getEducationTeachers, getEducationTerritoryIndicators,
  getFlowTerritory, getIdebTerritory, getInseTerritory, getSaebTerritory,
  type FlowResult, type IdebResult, type InseResult, type SaebResult,
} from '@senadotracker/db';
import { webPostgresPool } from '../postgres-pool.ts';
import { memo } from '../security/load.ts';
import type { ChartSeries, ChartView, Narrative } from '../security/types.ts';
import { bars, chart, fmt, stat, table, INFRA_ITEMS } from './build.ts';
import type { BarRow, StatItem, Table } from './types.ts';

type Loose = Record<string, any>;
type YV = { year: number; value: number | null };
const pt = (year: number, v: number | null) => ({ t: String(year), v, state: v == null ? 'absent' as const : 'ok' as const });
const own = (rows: YV[], label = 'Brasil'): ChartSeries[] => [{ key: 'brasil', label, color: 'primary' as const, points: rows.map(r => pt(r.year, r.value)) }];
const lastOf = (rows: YV[]): YV | null => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.value != null) return rows[i]!; return null; };
const prevOf = (rows: YV[], last: YV | null): YV | null => { if (!last) return null; for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.year < last.year && rows[i]!.value != null) return rows[i]!; return null; };
const hasData = (rows: YV[]) => rows.some(r => r.value != null);

const saebSeries = (r: SaebResult | null, subj: number, grade: number, dep: number): YV[] => r ? r.rows.filter(x => x.subj === subj && x.grade === grade && x.dep === dep && x.loc === 0 && x.cap === 0).map(x => ({ year: x.year, value: x.media })) : [];
const idebSeries = (r: IdebResult | null, stage: number, dep: number): YV[] => r ? r.rows.filter(x => x.stage === stage && x.dep === dep).map(x => ({ year: x.year, value: x.values.ideb ?? null })) : [];
const flowSeries = (rows: FlowResult['series'] | undefined, code: string): YV[] => (rows ?? []).map(x => ({ year: x.year, value: x.values[code] ?? null }));
const inseSeries = (r: InseResult | null): YV[] => r ? r.rows.filter(x => x.dep === 0 && x.loc === 0 && x.cap === 0).map(x => ({ year: x.year, value: x.media })) : [];

export interface EducationFederalPageData {
  year: number;
  network: { narrative: Narrative; stats: StatItem[]; stages: BarRow[]; dependency: BarRow[]; available: boolean; emptyReason: string };
  learning: { narrative: Narrative; mathChart: ChartView | null; idebChart: ChartView | null; available: boolean; emptyReason: string };
  trajectory: { narrative: Narrative; chart: ChartView | null; breakdown: Table | null; available: boolean; emptyReason: string };
  context: { narrative: Narrative; chart: ChartView | null; stats: StatItem[]; available: boolean; emptyReason: string };
  structure: { narrative: Narrative; items: BarRow[]; universe: string | null; available: boolean; emptyReason: string };
  teachers: { narrative: Narrative; stats: StatItem[]; available: boolean; emptyReason: string };
  sources: Array<{ label: string; period: string }>;
}

/** Educação, nível Brasil (P14.14): reusa as MESMAS leituras já nacionais que a página de UF já chama como
 * comparador ("Brasil: X" ao lado de cada gráfico) — aqui elas são a série principal, não uma linha de
 * referência. `{}` (chave vazia) resolve para a entidade Brasil em `getIdebTerritory`/`getSaebTerritory`/
 * `getFlowTerritory`/`getInseTerritory` (confirmado: mesmo mecanismo usado em `/executivo`); `ufCode`
 * omitido resolve para Brasil em `getEducationNationalOffer`/`getEducationNationalInfra`/
 * `getEducationTerritoryIndicators`/`getEducationTeachers` — são os números OFICIAIS do INEP para o Brasil,
 * nunca uma soma refeita pelo Cívica. Não inclui Enem/Ensino Superior/Pós-graduação/contratos: essas
 * leituras exigem UF ou município (`teScope`/`contractKey`) e não têm modo nacional nesta camada. */
async function loadEducationFederal(selectedYear = 2025): Promise<EducationFederalPageData> {
  const pool = webPostgresPool();
  const [overview, saeb, ideb, flow, inse, teachers, indicators] = await Promise.all([
    getEducationNationalOffer(pool, { year: selectedYear }) as Promise<Loose | null>,
    getSaebTerritory(pool, {}),
    getIdebTerritory(pool, {}),
    getFlowTerritory(pool, {}),
    getInseTerritory(pool, {}),
    getEducationTeachers(pool, { year: selectedYear }),
    getEducationTerritoryIndicators(pool, { year: selectedYear, series: false }) as Promise<Loose | null>,
  ]);
  const year = Number(overview?.year ?? selectedYear);
  const infra = await getEducationNationalInfra(pool, { year, series: false }) as Loose | null;

  // ================================================================= Rede
  const totals = (overview?.totals ?? {}) as Loose;
  const stageBars = bars(((overview?.stages ?? []) as Loose[]).map(s => ({ label: String(s.label), value: s.matriculas == null ? null : Number(s.matriculas), display: s.matriculas == null ? '' : fmt(Number(s.matriculas)) })));
  const depBars = bars(((overview?.byDependency ?? []) as Loose[]).map(s => ({ label: String(s.label), value: s.matriculas == null ? null : Number(s.matriculas), display: s.matriculas == null ? '' : fmt(Number(s.matriculas)) })));
  const network = {
    narrative: { question: 'Quantos estudam no Brasil?', answer: totals.matriculas != null ? `${fmt(Number(totals.matriculas))} matrículas na educação básica, em ${fmt(Number(totals.escolas ?? 0))} escolas.` : 'Sem matrículas publicadas.', context: 'Censo Escolar do INEP, ano letivo informado — contagem oficial, não recalculada pelo Cívica.', invite: '' },
    stats: [totals.matriculas != null && stat('Matrículas', fmt(Number(totals.matriculas))), totals.escolas != null && stat('Escolas', fmt(Number(totals.escolas))), totals.turmas != null && stat('Turmas', fmt(Number(totals.turmas))), totals.matPorTurma != null && stat('Alunos por turma', fmt(Number(totals.matPorTurma), 1))].filter((x): x is StatItem => !!x),
    stages: stageBars, dependency: depBars, available: totals.matriculas != null, emptyReason: 'Não há matrículas publicadas para o Brasil nesta edição.',
  };

  // ================================================================= Aprendizagem
  const mathOwn = saebSeries(saeb, 2, 5, 0); const mathL = lastOf(mathOwn); const mathP = prevOf(mathOwn, mathL);
  const mathChart = hasData(mathOwn) ? chart({ id: 'saeb-br', title: 'Matemática: média no Saeb, 5º ano (todas as redes)', unit: 'pontos', digits: 1, stepYears: 2, zoom: true, series: own(mathOwn), notes: ['A prova é aplicada a amostras de alunos, a cada dois anos.', 'Escala própria desta série e disciplina — não compare com outras etapas ou disciplinas.'], source: 'INEP, Saeb', coverage: 'rede total' }) : null;
  const idOwn = idebSeries(ideb, 1, 0); const idL = lastOf(idOwn); const idP = prevOf(idOwn, idL);
  const idebChart = hasData(idOwn) ? chart({ id: 'ideb-br', title: 'Ideb: anos iniciais (todas as redes)', unit: 'nota de 0 a 10', digits: 1, stepYears: 2, zoom: true, series: own(idOwn), notes: ['Ideb = nota do Saeb × aprovação dos alunos. Não é a média das escolas.', 'A meta oficial do Ideb existe só até 2021.'], source: 'INEP, Ideb', coverage: 'rede total' }) : null;
  const learning = {
    narrative: { question: 'O que os alunos brasileiros aprendem?', answer: [mathL ? `Matemática, 5º ano: ${fmt(mathL.value!, 0)} pontos (${mathL.year})${mathP ? `, ante ${fmt(mathP.value!, 0)} em ${mathP.year}` : ''}.` : null, idL ? `Ideb, anos iniciais: ${fmt(idL.value!, 1)} (${idL.year})${idP ? `, ante ${fmt(idP.value!, 1)} em ${idP.year}` : ''}.` : null].filter(Boolean).join(' ') || 'Sem resultado publicado.', context: 'Valores oficiais do INEP para o Brasil, sem recálculo — o Ideb do Brasil não é a média das escolas nem das UFs.', invite: '' },
    mathChart, idebChart, available: !!mathChart || !!idebChart, emptyReason: 'Não há resultado do Saeb nem do Ideb publicado para o Brasil.',
  };

  // ================================================================= Trajetória
  const abOwn = flowSeries(flow?.series, 'ab_fun'); const apOwn = flowSeries(flow?.series, 'ap_fun'); const rpOwn = flowSeries(flow?.series, 'rp_fun');
  const abL = lastOf(abOwn);
  const trajChart = hasData(abOwn) || hasData(apOwn) ? chart({
    id: 'flow-br', title: 'Aprovação, reprovação e abandono — ensino fundamental (Brasil)', unit: '%', digits: 1,
    series: [{ key: 'ap', label: 'Aprovação', color: 'primary', points: apOwn.map(r => pt(r.year, r.value)) }, { key: 'rp', label: 'Reprovação', color: 'amber', points: rpOwn.map(r => pt(r.year, r.value)) }, { key: 'ab', label: 'Abandono', color: 'grey', points: abOwn.map(r => pt(r.year, r.value)) }],
    notes: ['Aprovação, reprovação e abandono somam cerca de 100% dos alunos.', 'Taxas oficiais do INEP por ano letivo, sem recálculo.'], source: 'INEP, Indicadores Educacionais', coverage: 'rede total',
  }) : null;
  const cuts = (flow?.cuts ?? []).filter(c => c.dep === 0 && c.loc === 0);
  const cv = (c: FlowResult['cuts'][number], code: string) => { const v = c.values.find(x => x.code === code)?.value; return v == null ? null : `${fmt(v, 1)}%`; };
  const breakdown = cuts.length ? table(`Trajetória por etapa (${cuts[0]!.year})`, ['Abandono', 'Reprovação', 'Aprovação', 'Distorção'], cuts.map(c => [c.locLabel, [cv(c, 'ab_fun'), cv(c, 'rp_fun'), cv(c, 'ap_fun'), cv(c, 'td_fun')]]), 'Taxas oficiais do INEP para o Brasil, rede total.') : null;
  const trajectory = { narrative: { question: 'Quem fica pelo caminho?', answer: abL ? `${fmt(abL.value!, 1)}% dos alunos do fundamental abandonaram a escola em ${abL.year}.` : 'Sem taxa publicada.', context: 'Aprovação, reprovação e abandono somam cerca de 100% dos alunos; distorção idade-série mede atraso, não reprovação.', invite: '' }, chart: trajChart, breakdown, available: !!trajChart, emptyReason: 'Não há taxas de aprovação, reprovação e abandono publicadas para o Brasil.' };

  // ================================================================= Contexto (INSE)
  const inseOwn = inseSeries(inse).filter(r => r.year >= 2021); const inseLast = lastOf(inseOwn);
  const inseChart = hasData(inseOwn) ? chart({ id: 'inse-br', title: 'Nível socioeconômico médio dos alunos — Brasil (INSE)', unit: 'escala 1 a 8', digits: 2, stepYears: 2, zoom: true, series: own(inseOwn), notes: ['O INSE descreve o contexto das famílias, não a qualidade da escola.', 'A edição de 2019 usa outra escala e não entra no gráfico.'], source: 'INEP, Indicador de Nível Socioeconômico', coverage: '2021 e 2023' }) : null;
  const context = { narrative: { question: 'Qual o contexto socioeconômico das famílias?', answer: inseLast ? `INSE médio nacional: ${fmt(inseLast.value!, 2)} (escala de 1 a 8, ${inseLast.year}).` : 'Sem INSE publicado.', context: 'O INSE descreve o contexto socioeconômico dos alunos; não mede a qualidade da escola e não prova causa de resultados.', invite: '' }, chart: inseChart, stats: inseLast ? [stat('INSE médio', fmt(inseLast.value!, 2), 'escala de 1 a 8')] : [], available: !!inseChart, emptyReason: 'O INEP não publicou o nível socioeconômico para o Brasil.' };

  // ================================================================= Estrutura (infraestrutura escolar)
  const infraItems = (infra?.itens ?? []) as Loose[];
  const infraBars = INFRA_ITEMS.map(i => { const it = infraItems.find(x => x.code === i.code && x.available); return it?.pct == null ? null : { label: i.label, value: Number(it.pct), display: `${fmt(Number(it.pct), 0)}%`, note: i.group }; }).filter((x): x is NonNullable<typeof x> => !!x);
  const structure = { narrative: { question: 'Como são as escolas brasileiras?', answer: infraBars.length ? `${infraBars[0]!.display} das escolas têm ${infraBars[0]!.label.toLowerCase()}.` : 'Sem infraestrutura publicada.', context: 'Informação autodeclarada pela escola no Censo Escolar; o percentual considera só as que responderam.', invite: '' }, items: infraBars, universe: infra?.universe ? `${fmt(Number(infra.universe.comResposta))} de ${fmt(Number(infra.universe.escolas))} escolas responderam` : null, available: infraBars.length > 0, emptyReason: 'Não há infraestrutura publicada para o Brasil.' };

  // ================================================================= Professores
  const docs = teachers?.docentes.find(d => d.code === 'doc_total') ?? null;
  const meds = (((indicators?.recortes ?? []) as Loose[]).find(r => r.dep === 0 && r.loc === 0)?.medidas ?? []) as Loose[];
  const med = (code: string): number | null => { const v = meds.find(m => m.code === code)?.value; return v == null ? null : Number(v); };
  const teacherStats = [docs?.value != null && stat('Professores', fmt(Number(docs.value)), 'docentes distintos'), med('atu_fun') != null && stat('Alunos por turma (fundamental)', fmt(med('atu_fun')!, 1)), med('afd_fun1') != null && stat('Com formação adequada (fundamental)', `${fmt(med('afd_fun1')!, 0)}%`)].filter((x): x is StatItem => !!x);
  const teachersCh = { narrative: { question: 'Quem ensina no Brasil?', answer: docs?.value != null ? `${fmt(Number(docs.value))} professores distintos na educação básica (${teachers!.year}).` : 'Sem docentes publicados.', context: 'Docentes distintos: cada professor conta uma vez, mesmo lecionando em várias escolas ou etapas.', invite: '' }, stats: teacherStats, available: teacherStats.length > 0, emptyReason: 'Não há dados de docentes publicados para o Brasil.' };

  const sources: Array<{ label: string; period: string }> = [
    saeb && { label: 'INEP, Saeb', period: `edições ${saeb.editions.join(', ')}` }, ideb && { label: 'INEP, Ideb', period: `edições ${ideb.editions.at(0)}–${ideb.editions.at(-1)}` },
    flow?.series.length && { label: 'INEP, Indicadores Educacionais (rendimento e distorção)', period: `${flow.series[0]!.year}–${flow.series.at(-1)!.year}` },
    overview && { label: 'INEP, Censo Escolar (matrículas e infraestrutura)', period: `${year}` }, inse && { label: 'INEP, Indicador de Nível Socioeconômico', period: 'edições 2021 e 2023' },
    teachers && { label: 'INEP, Sinopse Estatística da Educação Básica', period: String(teachers.year) },
  ].filter((x): x is { label: string; period: string } => !!x);

  return { year, network, learning, trajectory, context, structure, teachers: teachersCh, sources };
}

export const loadEducationFederalPageCached = (year?: number): Promise<EducationFederalPageData> => memo(`education:federal:${year ?? 'd'}`, () => loadEducationFederal(year), 60_000);
