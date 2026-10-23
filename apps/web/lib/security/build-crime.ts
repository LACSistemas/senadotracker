import { ALL_CRIME_DEFS, type CrimeDef } from '@senadotracker/db';
import { CRIME_FEATURED, EXPLICIT_ZERO, CRIME_PLAIN, GROUP_LABEL, GROUP_ORDER, ROBBERY_FAMILY, SOURCE_PLAIN, VDE_CRIME, VDE_RATE_ID, vdeCountCode } from './catalog.ts';
import { fillMonthly, mkChart, mkSeries, monthlyToAnnual, monthlyToAnnualBounded, pointsFromCrime, pointsFromRm, type Bounds, type CrimePointRm, type RmPoint } from './series.ts';
import type { BenchView, ChartPoint, ChartView, CrimeChapter, ExploreOption, MeasureView, ScopeInfo } from './types.ts';

export interface SegMetric { indicatorId: number; code: string; label: string; unit: string; source: string; definition: string; granularity: string; grain: 'A' | 'M'; perspective?: string | null; comparability: string; series: RmPoint[]; latestPeriod: string | null; provisional: boolean }
export interface SegPayload { metrics: SegMetric[]; coverage: { vde?: { firstMonth?: string; lastMonth?: string; municipalUniverse?: number } } }
export interface StateCrimeSeries { indicatorId: number; code: string; label: string; unit: string; group: string; canonical: string | null; composite: string[] | null; comparability: string; sensitive: boolean; note: string; points: CrimePointRm[]; first: string | null; last: string | null }
export interface StateCrimePayloadLite { source: { key: string; name: string } | null; series: StateCrimeSeries[]; restrictions: string[]; coverage: { months: number; first: string | null; last: string | null } }
export interface PopYear { year: number; population: number }

const defOf = new Map<number, CrimeDef>(ALL_CRIME_DEFS.map(d => [d.id, d]));
const UNIT_PLAIN: Record<string, string> = { vitima: 'Vítimas', caso: 'Casos', ocorrencia: 'Ocorrências (boletins)', autor: 'Autores', adolescente: 'Adolescentes', evento: 'Eventos' };
const byCode = (m: SegMetric[]) => new Map(m.map(x => [x.code, x]));

/** Taxa anual por 100 mil = total do ano ÷ população do MESMO ano (ano completo, população oficial; 2022–2023 não têm estimativa e ficam de fora). */
export function annualRate(annual: ChartPoint[], pop: PopYear[]): ChartPoint[] {
  const by = new Map(pop.map(p => [p.year, p.population]));
  return annual.filter(p => p.v != null && p.state !== 'partial' && by.has(Number(p.t))).map(p => ({ t: p.t, v: p.v! / by.get(Number(p.t))! * 100000, state: p.state, n: p.v, d: by.get(Number(p.t))! }));
}
export const POP_GAP = { from: '2022', to: '2023', label: 'sem estimativa oficial de população' };

/** Opção a partir de um indicador VDE com município na fonte (contagem mensal + taxa anual publicada). */
function vdeOption(scope: ScopeInfo, v: (typeof VDE_CRIME)[number], seg: SegMetric[], opts: { stateOnly: boolean }): ExploreOption | null {
  const m = byCode(seg); const cnt = m.get(vdeCountCode(v.slug)); if (!cnt || !cnt.series.some(p => p.value != null)) return null;
  const monthlyPts = pointsFromRm(cnt.series, 'M'); const annual = monthlyToAnnual(monthlyPts);
  const rateCode = `IND-SEG-VDE-${v.slug.toUpperCase()}-TAXA`; const rate = m.get(rateCode);
  const where = opts.stateOnly ? `${scope.stateName} (estado)` : scope.name;
  const count = mkChart({ id: `vde:${v.slug}:count`, title: `${v.plain} em ${where}`, unit: cnt.unit, digits: 0, grain: 'A', series: [mkSeries('t', where, annual)], monthly: [mkSeries('t', where, monthlyPts)],
    gaps: [], source: 'Sinesp VDE (MJSP/SENASP), dados informados pelas secretarias estaduais', coverage: `${cnt.series[0]!.period.slice(0, 7)} a ${cnt.latestPeriod?.slice(0, 7) ?? '—'}`,
    notes: ['Registro policial: não é condenação nem crime judicialmente comprovado.', cnt.provisional ? 'O último período é preliminar e pode ser revisto.' : ''].filter(Boolean) });
  const measures: MeasureView[] = [{ key: 'count', label: 'Quantidade', chart: count }];
  if (rate && rate.series.some(p => p.value != null)) {
    const ratePts = pointsFromRm(rate.series, 'A').filter(p => p.v != null);
    measures.push({ key: 'rate', label: 'Por 100 mil habitantes', chart: mkChart({ id: `vde:${v.slug}:rate`, title: `${v.plain}: taxa por 100 mil habitantes`, unit: 'por 100 mil habitantes', digits: 1, grain: 'A', series: [mkSeries('t', where, ratePts)],
      gaps: [POP_GAP], benchUrl: `/api/seguranca/benchmark?entity=${scope.entityId}&opt=vde:${v.slug}`, source: 'Sinesp VDE; população IBGE do mesmo ano', coverage: `${ratePts[0]?.t ?? '—'} a ${ratePts.at(-1)?.t ?? '—'}`, notes: ['Taxa = vítimas do ano ÷ população do mesmo ano × 100 mil. Sem estimativa oficial de população em 2022 e 2023, não há taxa nesses anos.'] }) });
  }
  return { id: `vde:${v.slug}`, label: v.plain, plain: v.plain, group: v.group, scope: opts.stateOnly ? 'uf' : (scope.kind === 'uf' ? 'uf' : 'municipio'), source: 'Sinesp VDE', definition: v.definition,
    caveat: opts.stateOnly ? 'Este dado só existe para o estado: não é o número da cidade.' : (v.sensitive ? 'Números pequenos: variações de poucos casos mudam muito o percentual.' : null), unit: cnt.unit, measures, ...(v.sensitive ? { sensitive: true } : {}) };
}

/** Mortes por agressão no SIM (óbitos pelo CID): é saúde pública, não registro policial. Vale por município de residência (taxa) e de ocorrência. */
function simOption(scope: ScopeInfo, seg: SegMetric[]): ExploreOption | null {
  const m = byCode(seg); const res = m.get('IND-SEG-SIM-AGR-RES'), oco = m.get('IND-SEG-SIM-AGR-OCO'), rate = m.get('IND-SEG-SIM-AGR-TAXA'); if (!res || !res.series.some(p => p.value != null)) return null;
  const where = scope.name; const series = [mkSeries('res', 'Moradores', pointsFromRm(res.series, 'A'))]; if (oco) series.push(mkSeries('oco', 'Ocorridas no local', pointsFromRm(oco.series, 'A'), 'blue', true));
  const measures: MeasureView[] = [{ key: 'count', label: 'Quantidade', chart: mkChart({ id: 'sim:agr:count', title: `Mortes por agressão em ${where}: registros de saúde (SIM)`, unit: 'óbitos', digits: 0, grain: 'A', series,
    source: 'SIM/DATASUS (certidões de óbito)', coverage: `${res.series[0]!.period.slice(0, 4)} a ${res.latestPeriod?.slice(0, 4) ?? '—'}`, notes: ['Conta óbitos pelo CID (agressões), por município de residência da vítima e por município onde ocorreu. É outra medida que o homicídio do registro policial: não somar nem igualar.', res.provisional ? 'O último ano é preliminar.' : ''].filter(Boolean) }) }];
  if (rate && rate.series.some(p => p.value != null)) measures.push({ key: 'rate', label: 'Por 100 mil habitantes', chart: mkChart({ id: 'sim:agr:rate', title: `Mortes por agressão: taxa por 100 mil moradores`, unit: 'por 100 mil habitantes', digits: 1, grain: 'A', series: [mkSeries('t', where, pointsFromRm(rate.series, 'A').filter(p => p.v != null))],
    gaps: [POP_GAP], benchUrl: `/api/seguranca/benchmark?entity=${scope.entityId}&opt=sim:agr`, source: 'SIM/DATASUS; população IBGE do mesmo ano', coverage: '', notes: ['Taxa pela residência da vítima. Sem estimativa oficial de população em 2022 e 2023, não há taxa nesses anos.'] }) });
  return { id: 'sim:agr', label: 'Mortes por agressão (saúde)', plain: 'Mortes por agressão (registro de saúde)', group: 'Violência letal', scope: scope.kind === 'uf' ? 'uf' : 'municipio', source: 'SIM/DATASUS', definition: 'Óbitos classificados como agressão (CID-10 X85–Y09) na declaração de óbito.',
    caveat: 'Não é o homicídio do registro policial: as duas medidas têm origem e critérios diferentes.', unit: 'óbitos', measures };
}

export interface StateOption { opt: ExploreOption; heroRobbery?: ChartPoint[] }
/** Opção de um registro estadual municipalizado (P9.6). Fonte de eventos: município-mês sem linha é lacuna, nunca zero. */
function stateSourceOption(scope: ScopeInfo, sc: StateCrimePayloadLite, s: StateCrimeSeries, pop: PopYear[], bounds?: Map<number, Bounds>): ExploreOption | null {
  const def = defOf.get(s.indicatorId); const srcKey = sc.source!.key; const explicit = EXPLICIT_ZERO.has(srcKey); void def;
  const monthly = pointsFromCrime(s.points, { explicitZeros: explicit }); if (!monthly.some(p => p.v != null)) return null;
  const monthlyFilled = explicit ? monthly : fillMonthly(monthly); const annual = monthlyToAnnualBounded(monthlyFilled, bounds?.get(s.indicatorId));
  const plain = CRIME_PLAIN[`${srcKey}:${s.code}`] ?? s.label; const where = scope.kind === 'uf' ? scope.stateName : scope.name;
  const suppressed = monthly.some(p => p.state === 'suppressed');
  const comp = s.composite ? 'Indicador composto publicado pela fonte; não é a soma dos indicadores exibidos aqui.' : null;
  const count = mkChart({ id: `st:${srcKey}:${s.code}:count`, title: `${plain} em ${where}`, unit: s.unit === 'vitima' ? 'vítimas' : s.unit === 'caso' ? 'casos' : s.unit === 'ocorrencia' ? 'ocorrências' : s.unit, digits: 0, grain: 'A', series: [mkSeries('t', where, annual)], monthly: [mkSeries('t', where, monthlyFilled)],
    source: SOURCE_PLAIN[srcKey] ?? srcKey, coverage: `${s.first ?? '—'} a ${s.last ?? '—'}`, notes: [explicit ? 'A fonte informa todos os municípios em todos os meses: zero é zero declarado.' : 'Mês sem registro aparece como lacuna, não como zero: a fonte só traz linhas onde houve registro.', suppressed ? 'Células com poucos casos de categorias sensíveis são ocultadas para proteger as vítimas.' : '', comp ?? ''].filter(Boolean) });
  const measures: MeasureView[] = [{ key: 'count', label: 'Quantidade', chart: count }];
  const rate = annualRate(annual, pop);
  if (rate.length >= 2 && !suppressed) measures.push({ key: 'rate', label: 'Por 100 mil habitantes', chart: mkChart({ id: `st:${srcKey}:${s.code}:rate`, title: `${plain}: taxa por 100 mil habitantes`, unit: 'por 100 mil habitantes', digits: 1, grain: 'A', series: [mkSeries('t', where, rate)], gaps: [POP_GAP],
    benchUrl: `/api/seguranca/benchmark?entity=${scope.entityId}&opt=st:${encodeURIComponent(srcKey)}:${encodeURIComponent(s.code)}`, source: `${SOURCE_PLAIN[srcKey] ?? srcKey}; população IBGE do mesmo ano`, coverage: '', notes: ['Só anos completos com população oficial do mesmo ano (2022 e 2023 não têm estimativa).'] }) });
  return { id: `st:${srcKey}:${s.code}`, label: plain, plain, group: GROUP_LABEL[s.group] ?? 'Outros registros', scope: scope.kind === 'uf' ? 'uf' : 'municipio', source: SOURCE_PLAIN[srcKey] ?? srcKey, definition: `${UNIT_PLAIN[s.unit] ?? s.unit} registrados pela fonte estadual (${SOURCE_PLAIN[srcKey] ?? srcKey}). ${explicit ? 'A fonte informa todos os municípios em todos os meses publicados: zero é zero declarado.' : 'A fonte só traz linhas onde houve registro: mês sem linha aparece como lacuna, não como zero.'} ${s.composite ? 'É um indicador composto publicado pela própria fonte.' : ''}`.trim(),
    caveat: [comp, s.comparability === 'NOT_COMPARABLE' ? 'Não comparável com outras fontes.' : 'Não comparar com outros estados: cada secretaria usa definições próprias.'].filter(Boolean).join(' '), unit: count.unit, measures, ...(s.composite ? {} : { exclusiveGroup: `${srcKey}:${s.unit}:${s.group}` }), ...(s.sensitive ? { sensitive: true } : {}) };
}

/** Série do "roubo" do herói: soma das categorias EXCLUSIVAS da fonte declaradas em ROBBERY_FAMILY (ou o total da própria fonte). */
export function robberyFamilySeries(sc: StateCrimePayloadLite | null, bounds?: Map<number, Bounds>): { label: string; note: string | null; annual: ChartPoint[]; codes: string[]; ids: number[] } | null {
  if (!sc?.source) return null; const fam = ROBBERY_FAMILY[sc.source.key]; if (!fam) return null;
  const parts = fam.codes.map(c => sc.series.find(s => s.code === c)).filter((x): x is StateCrimeSeries => !!x); if (parts.length !== fam.codes.length) return null;
  const sumBy = new Map<string, { v: number; prelim: boolean }>();
  for (const s of parts) for (const p of s.points) { if (p.value == null) continue; const c = sumBy.get(p.month) ?? { v: 0, prelim: false }; c.v += p.value; c.prelim ||= p.preliminary; sumBy.set(p.month, c); }
  const monthly: ChartPoint[] = [...sumBy.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([t, c]) => ({ t, v: c.v, state: c.prelim ? 'prelim' as const : 'ok' as const }));
  if (!monthly.length) return null; const bs = parts.map(p => bounds?.get(p.indicatorId)); const bb: Bounds | undefined = bs.every(Boolean) ? { first: bs.map(x => x!.first).sort().at(-1)!, last: bs.map(x => x!.last).sort()[0]! } : undefined;
  return { label: fam.label, note: fam.note, annual: monthlyToAnnualBounded(fillMonthly(monthly), bb), codes: fam.codes, ids: parts.map(p => p.indicatorId) };
}

export function buildCrimeChapter(o: { scope: ScopeInfo; seg: SegPayload | null; segState: SegPayload | null; sc: StateCrimePayloadLite | null; pop: PopYear[]; heroBench?: Map<string, BenchView>; full?: 'all' | Set<string>; bounds?: Map<number, Bounds> }): CrimeChapter {
  const { scope, seg, segState, sc, pop } = o; const options: ExploreOption[] = []; const stateOnly: string[] = [];
  const muniMetrics = seg?.metrics ?? [];
  const sim = simOption(scope, muniMetrics); if (sim) options.push(sim);
  for (const v of VDE_CRIME) {
    const here = vdeOption(scope, v, muniMetrics, { stateOnly: false });
    if (here) options.push(here);
    else if (scope.kind === 'municipio' && segState) { const st = vdeOption({ ...scope }, v, segState.metrics, { stateOnly: true }); if (st) { options.push(st); stateOnly.push(v.plain); } }
  }
  if (sc?.source) {
    const feat = CRIME_FEATURED[sc.source.key] ?? []; const order = new Map(feat.map((c, i) => [c, i]));
    for (const s of [...sc.series].filter(x => order.has(x.code)).sort((a, b) => order.get(a.code)! - order.get(b.code)!)) { const op = stateSourceOption(scope, sc, s, pop, o.bounds); if (op) options.push(op); }
  }
  options.sort((a, b) => (a.scope === b.scope ? 0 : a.scope === 'municipio' || scope.kind === 'uf' ? -1 : 1) || (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)));
  const defaultId = options.find(x => x.id === 'vde:homicidio-doloso' && x.scope !== 'uf' || (scope.kind === 'uf' && x.id === 'vde:homicidio-doloso'))?.id ?? options.find(x => x.scope === (scope.kind === 'uf' ? 'uf' : 'municipio'))?.id ?? options[0]?.id ?? null;
  const vdeCov = seg?.coverage.vde; const muniCov = vdeCov?.municipalUniverse != null ? `${vdeCov.municipalUniverse} municípios do estado têm registro do Sinesp.` : '';
  const hasSc = !!sc?.source;
  const full = o.full ?? new Set([defaultId ?? '']);
  const shown = full === 'all' ? options : options.map(op => full.has(op.id) ? op : stub(op));
  return {
    id: 'criminalidade', number: 1, title: 'Criminalidade', question: 'Quais crimes são registrados e como isso está mudando?', available: options.length > 0,
    narrative: { question: 'Quais crimes são registrados e como isso está mudando?', answer: '', context: null, invite: 'Escolha um tipo de crime, troque entre quantidade e taxa e mude o período.' },
    options: shown, defaultOptionId: defaultId, municipalCoverage: muniCov, stateOnly, stateSource: hasSc ? (SOURCE_PLAIN[sc!.source!.key] ?? sc!.source!.key) : null,
    sourceNote: hasSc ? `Os crimes patrimoniais (roubos, furtos) vêm do registro da fonte estadual (${SOURCE_PLAIN[sc!.source!.key] ?? sc!.source!.key}); cada estado usa definições próprias, por isso eles não são comparáveis entre estados.` : 'Para este estado não há registro de roubos e furtos por município publicado no Cívica: só aparecem os indicadores nacionais do Sinesp e do SIM.',
  };
}
export type { ChartView };

/** Versão leve de uma opção: só metadados e o último valor anual completo; as séries vêm por demanda quando o usuário escolhe o crime. */
function stub(o: ExploreOption): ExploreOption {
  const last = o.measures[0]?.chart.series[0]?.points.filter(p => p.v != null && p.state !== 'partial').at(-1);
  return { ...o, lazy: true, peek: last ? { t: last.t, v: last.v } : null, measures: o.measures.map(m => ({ ...m, chart: { ...m.chart, series: [], monthly: undefined, bench: undefined, notes: [] } })) };
}
