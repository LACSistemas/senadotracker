import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { positionPhrase, rulerOf } from '../../apps/web/lib/security/bench.ts';
import { annualRate, buildCrimeChapter, robberyFamilySeries, type SegMetric, type StateCrimePayloadLite } from '../../apps/web/lib/security/build-crime.ts';
import { buildFinanceChapter, type FinancePayload } from '../../apps/web/lib/security/build-finance.ts';
import { buildPoliceChapter, type OcPayloadLite } from '../../apps/web/lib/security/build-police.ts';
import { buildPrisonChapter } from '../../apps/web/lib/security/build-prison.ts';
import { buildStructureChapter, type StaffMuni, type StaffState } from '../../apps/web/lib/security/build-structure.ts';
import { buildTrafficChapter, type TrafficPayload } from '../../apps/web/lib/security/build-traffic.ts';
import { buildHero } from '../../apps/web/lib/security/hero.ts';
import { crimeNarrative, financeNarrative, policeNarrative, prisonNarrative, structureNarrative, trafficNarrative } from '../../apps/web/lib/security/narrative.ts';
import { fillMonthly, lastCompleteYear, monthlyToAnnual, monthlyToAnnualBounded, pointsFromCrime, pointsFromRm, stateOf } from '../../apps/web/lib/security/series.ts';
import { changeRatio, directionOf, fmt, signedPct } from '../../apps/web/lib/security/format.ts';
import { TrendChart } from '../../apps/web/components/security/trend-chart.tsx';
import type { ChartView, ScopeInfo } from '../../apps/web/lib/security/types.ts';

const VIT: ScopeInfo = { kind: 'municipio', entityId: 3205309, ufCode: 32, uf: 'ES', name: 'Vitória', stateName: 'Espírito Santo', population: { value: 343935, year: 2026 } };
const ES: ScopeInfo = { kind: 'uf', entityId: 32, ufCode: 32, uf: 'ES', name: 'Espírito Santo', stateName: 'Espírito Santo', population: { value: 4126854, year: 2026 } };
const rm = (period: string, value: number | null, extra: Record<string, unknown> = {}) => ({ period, value, numerator: value, denominator: null, status: 'definitivo', kind: 'registrado', flags: [] as string[], ...extra });

test('estados de dado: zero declarado, ausência, suprimido, preliminar e ano parcial são distintos e nunca viram zero', () => {
  assert.equal(stateOf(rm('2025-01-01', 0, { kind: 'zero_reportado' })), 'zero'); assert.equal(stateOf(rm('2025-01-01', null, { kind: 'sem_relato_ou_zero' })), 'absent');
  assert.equal(stateOf(rm('2025-01-01', null, { flags: ['suppressed'] })), 'suppressed'); assert.equal(stateOf(rm('2025-01-01', 3, { flags: ['preliminary'], status: 'preliminar' })), 'prelim'); assert.equal(stateOf(rm('2025-01-01', 3, { flags: ['partialCoverage'] })), 'partial');
  const ev = pointsFromCrime([{ month: '2025-01', value: 4, status: 'reported', preliminary: false }, { month: '2025-03', value: 2, status: 'reported', preliminary: false }], { explicitZeros: false });
  const filled = fillMonthly(ev); assert.deepEqual(filled.map(p => [p.t, p.state]), [['2025-01', 'ok'], ['2025-02', 'absent'], ['2025-03', 'ok']], 'fonte de eventos: mês sem linha é lacuna, não zero');
  const zeros = pointsFromCrime([{ month: '2025-01', value: 0, status: 'reported', preliminary: false }], { explicitZeros: true }); assert.equal(zeros[0]!.state, 'zero');
  const sup = pointsFromCrime([{ month: '2025-01', value: null, status: 'suppressed', preliminary: false }], { explicitZeros: false }); assert.equal(sup[0]!.state, 'suppressed'); assert.equal(sup[0]!.v, null);
  assert.equal(pointsFromRm([rm('2025-03-01', 3)], 'M')[0]!.t, '2025-03'); assert.equal(pointsFromRm([rm('2025-03-01', 3)], 'A')[0]!.t, '2025');
});

test('agregação anual e taxa: ano incompleto é parcial; sem população do mesmo ano não há taxa (2022–2023 não são interpolados)', () => {
  const monthly = Array.from({ length: 14 }, (_, i) => ({ t: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, v: 10, state: 'ok' as const }));
  const annual = monthlyToAnnual(monthly); assert.deepEqual(annual.map(a => [a.t, a.v, a.state]), [['2024', 120, 'ok'], ['2025', 20, 'partial']]);
  assert.deepEqual(lastCompleteYear(monthly, 'M'), { year: 2024, total: 120, prelim: false });
  const rate = annualRate([{ t: '2021', v: 100, state: 'ok' }, { t: '2022', v: 100, state: 'ok' }, { t: '2024', v: 50, state: 'ok' }, { t: '2025', v: 10, state: 'partial' }], [{ year: 2021, population: 100000 }, { year: 2024, population: 50000 }, { year: 2025, population: 50000 }]);
  assert.deepEqual(rate.map(r => [r.t, Math.round(r.v!)]), [['2021', 100], ['2024', 100]], '2022 sem população e 2025 parcial ficam de fora');
});

test('família de roubo: soma só categorias exclusivas da mesma fonte e se recusa a somar quando falta uma parte', () => {
  const mk = (code: string, id: number, vals: number[]) => ({ indicatorId: id, code, label: code, unit: 'ocorrencia', group: 'PATRIMONIAL', canonical: null, composite: null, comparability: 'SIMILAR_LABEL_NOT_PROVEN', sensitive: false, note: '', points: vals.map((v, i) => ({ month: `2025-${String(i + 1).padStart(2, '0')}`, value: v, status: 'reported', preliminary: false })), first: '2025-01', last: '2025-12' });
  const full: StateCrimePayloadLite = { source: { key: 'SESP-ES', name: 'x' }, series: [mk('ROUBO_PESSOA_VIA_PUBLICA', 8203, Array(12).fill(5)), mk('ROUBO_TRANSPORTE_COLETIVO', 8204, Array(12).fill(1)), mk('ROUBO_ESTABELECIMENTO_COMERCIAL', 8205, Array(12).fill(2)), mk('ROUBO_RESIDENCIA_CONDOMINIO', 8206, Array(12).fill(1))], restrictions: [], coverage: { months: 12, first: '2025-01', last: '2025-12' } };
  const fam = robberyFamilySeries(full)!; assert.equal(fam.annual[0]!.v, 108); assert.ok(fam.note && /4 modalidades/.test(fam.note), 'a lista parcial de modalidades é declarada');
  assert.equal(robberyFamilySeries({ ...full, series: full.series.slice(0, 3) }), null, 'falta uma categoria: não soma'); assert.equal(robberyFamilySeries({ ...full, source: { key: 'FONTE-INEXISTENTE', name: 'y' } }), null);
});

test('capítulo de criminalidade: só a opção inicial vem completa; as demais chegam como esboço (lazy) e o dado só do estado é identificado como tal', () => {
  const metric = (code: string, id: number, vals: number[], extra: Partial<SegMetric> = {}): SegMetric => ({ indicatorId: id, code, label: code, unit: 'vítimas', source: 'VDE', definition: 'd', granularity: 'municipio', grain: 'M', comparability: 'c', series: vals.map((v, i) => rm(`2025-${String(i + 1).padStart(2, '0')}-01`, v)), latestPeriod: '2025-12-01', provisional: false, ...extra });
  const seg = { metrics: [metric('IND-SEG-VDE-HOMICIDIO-DOLOSO-E', 3101, Array(12).fill(3)), metric('IND-SEG-VDE-TENTATIVA-HOMICIDIO-E', 3102, Array(12).fill(1))], coverage: {} };
  const segState = { metrics: [metric('IND-SEG-VDE-ESTUPRO-E', 3114, Array(12).fill(40), { granularity: 'uf' })], coverage: {} };
  const ch = buildCrimeChapter({ scope: VIT, seg, segState, sc: null, pop: [] }); const hom = ch.options.find(o => o.id === 'vde:homicidio-doloso')!;
  assert.equal(ch.defaultOptionId, 'vde:homicidio-doloso'); assert.ok(!hom.lazy && hom.measures[0]!.chart.series[0]!.points.length > 0); const tent = ch.options.find(o => o.id === 'vde:tentativa-homicidio')!; assert.ok(tent.lazy && tent.measures[0]!.chart.series.length === 0 && tent.peek?.v === 12);
  const est = ch.options.find(o => o.id === 'vde:estupro')!; assert.equal(est.scope, 'uf'); assert.match(est.caveat ?? '', /só existe para o estado/i); assert.ok(ch.stateOnly.includes('Estupros'));
  const said = crimeNarrative(VIT, ch, null); assert.match(said.answer, /Vitória teve 36 homicídios dolosos/); assert.match(said.context ?? '', /só existem para o estado inteiro/);
});

test('benchmark: frase de posição sem ranking e régua só quando há comparação válida', () => {
  const b = { p25: 10, p50: 15, p75: 20 }; assert.match(positionPhrase(5, b, 1), /abaixo da faixa central/); assert.match(positionPhrase(15, b, 1), /dentro da faixa central/); assert.match(positionPhrase(30, b, 1), /acima da faixa central/);
  assert.equal(rulerOf({ status: 'indisponivel', label: '', cohort: '', basis: '', points: [] }, { t: '2025', v: 3 }, { digits: 1, unit: 'x' }), null); assert.equal(rulerOf(undefined, null, { digits: 1, unit: 'x' }), null);
  const r = rulerOf({ status: 'ok', label: 'l', cohort: 'g', basis: 'b', points: [{ t: '2025', p25: 1, p50: 2, p75: 3, n: 8, universe: 8 }] }, { t: '2025', v: 2.5 }, { digits: 1, unit: 'x' })!; assert.equal(r.n, 8); assert.equal(rulerOf({ status: 'ok', label: 'l', cohort: 'g', basis: 'b', points: [{ t: '2024', p25: 1, p50: 2, p75: 3, n: 8, universe: 8 }] }, { t: '2025', v: 2.5 }, { digits: 1, unit: 'x' }), null, 'ano diferente: sem régua');
  assert.equal(changeRatio(0, 5), null, 'base zero não vira infinito'); assert.equal(directionOf(0.01), 'flat'); assert.equal(signedPct(-0.333), '−33%'); assert.equal(fmt(1234.5, 1), '1.234,5');
});

test('estrutura: PM/PC do estado nunca aparecem como efetivo municipal; "sem guarda" é declaração, o Detran não tem número inventado', () => {
  const pt = (value: number | null, corp: string) => ({ value, status: 'reported', corporation: corp, period: { start: '2025-03-01', end: '2025-04-01' } });
  const muni: StaffMuni = { editions: [{ survey: '2023-01-01', guard: { state: 'no', existence: pt(0, 'GCM') }, policeStation: { state: 'yes', existence: pt(1, 'PC') }, specializedStations: [], otherStructures: [] }] };
  const state: StaffState = { fbsp: { existing: [{ ...pt(9231, 'PM'), corporation: 'PM' }, { ...pt(1764, 'PC'), corporation: 'PC' }], plans: [{ corporation: 'PM', planned: pt(11299, 'PM'), occupancy: pt(81.7, 'PM'), difference: pt(2068, 'PM') }] }, estadic: [], municipalGuards: { editions: [] } };
  const ch = buildStructureChapter({ scope: VIT, muni, state, national: null });
  assert.equal(ch.municipal.find(c => c.key === 'guarda')!.value, 0); assert.ok(ch.state.every(c => c.scope === 'estado') && ch.state.some(c => c.label === 'Polícia Militar')); assert.ok(!ch.municipal.some(c => /Militar/.test(c.label)));
  assert.equal(ch.plannedVsExisting[0]!.planned, 11299); assert.equal(ch.detran.available, false); assert.match(ch.detran.statement, /ainda não tem cadastro/); assert.ok(!/\d{3,}/.test(ch.detran.statement), 'sem números do Detran');
  const said = structureNarrative(VIT, ch); assert.match(said.answer, /declarou que não tem guarda municipal/); assert.match(said.context ?? '', /não são o efetivo lotado em Vitória/);
});

test('sistema prisional: município sem unidade usa a formulação compatível com a cobertura e o contexto estadual vem rotulado', () => {
  const pts = (vals: number[]) => vals.map((v, i) => ({ competence: 202506 + i, ref: `2025/${i + 1}`, period: { start: `2025-0${i * 6 + 1}-01`.replace('2025-013', '2025-07'), end: '2026-01-01' }, value: v }));
  const state = { series: [{ indicatorId: 6004, code: 'IND-PRI-E-OCC', label: 'o', unit: '%', scope: 'E', kind: 'occ', points: pts([160, 165]) }], latestRef: '2025/2', restrictions: [] };
  const ch = buildPrisonChapter({ scope: VIT, muni: { units: [], aggregateSeries: [], latestRef: '2025/2', restrictions: [] }, state });
  assert.match(ch.observed, /Nenhum estabelecimento identificado nesta base/); assert.ok(!/não existe(m)? presíd|não há presíd/i.test(ch.observed)); assert.ok(ch.stateContext?.occupancy && /contexto/.test(ch.stateContext.label)); assert.match(prisonNarrative(VIT, ch).context ?? '', /situação do estado, não do município/);
  assert.ok(ch.restrictions.some(r => /domiciliar não entra/i.test(r)) && ch.restrictions.some(r => /não indica a criminalidade dos moradores/.test(r)));
});

test('finanças: etapas ficam separadas (nunca somadas); exercício corrente é preliminar e sem "pago"; narrativa em reais correntes', () => {
  const m = (v: number) => ({ value: v }); const yr = (e: number, emp: number, pago: number) => ({ exercicio: e, coverage: 'PUBLISHED', function06: { empenhada: m(emp), liquidada: m(emp - 1), paga: m(pago) }, total: null, shareOfTotalEmpenhada: { percent: 2.3 }, subfunctions: [{ code: '06.122', label: 'Administração Geral', empenhada: m(60), paga: m(55) }] });
  const fin: FinancePayload = { years: [yr(2024, 100, 90), yr(2025, 110, 100)], budget: [{ exercicio: 2025, bimestre: 6, preliminary: false, dotacaoAtualizada: m(130) }, { exercicio: 2026, bimestre: 4, preliminary: true, dotacaoAtualizada: m(140), empenhadaAcumulada: m(60), liquidadaAcumulada: m(40) }], perCapita: [{ exercicio: 2025, paidPerInhabitant: 227, population: 343000 }], coverage: [], stateContext: null, restrictions: ['r'] };
  const ch = buildFinanceChapter({ scope: VIT, fin, contracts: null, bench: null }); const y25 = ch.years.find(y => y.exercicio === 2025)!; const y26 = ch.years.find(y => y.exercicio === 2026)!;
  assert.deepEqual([y25.stages.dotacao, y25.stages.empenhada, y25.stages.liquidada, y25.stages.paga], [130, 110, 109, 100]); assert.equal(y26.preliminary, true); assert.equal(y26.stages.paga, null); assert.equal(y26.stages.empenhada, 60);
  assert.equal(ch.stages.map(s => s.key).join(), 'dotacao,empenhada,liquidada,paga'); const said = financeNarrative(VIT, ch); assert.match(said.answer, /R\$ 100,0 milhões|R\$ 0,0 milhões|pagou R\$/); assert.match(said.context ?? '', /nunca se somam/);
});

test('trânsito: PRF só rodovias federais com marco de mudança de método; frota é estoque; infrações só na UF; RENAEST declara cobertura', () => {
  const metric = (id: number, code: string, vals: Array<[string, number]>) => ({ indicatorId: id, code, label: code, unit: 'u', series: vals.map(([p, v]) => rm(p, v)), latestPeriod: vals.at(-1)![0], provisional: false, comparability: 'c' });
  const t: TrafficPayload = { sim: [metric(4001, 'a', [['2024-01-01', 40], ['2025-01-01', 50]]), metric(4013, 'b', [['2025-01-01', 20]])], renaest: [metric(4301, 'r', [['2025-01-01', 10], ['2025-02-01', 11]])], prf: [metric(4621, 'p', [['2014-01-01', 30], ['2016-01-01', 9], ['2017-01-01', 7]])],
    ufCoverage: [{ source: 'renaest', competence: 202505, records: 10, fatalRecords: 1, municipalities: 73, universe: 79, scope: 'registros_presentes' }], fleet: { source: 's', semantics: 's', latest: { competence: 202609, total: 100, byType: { automovel: 60, motocicleta: 40 } }, series: [{ competence: 202412, total: 90, byType: {} }, { competence: 202609, total: 100, byType: {} }], competences: { first: 202412, last: 202609, published: 2 } }, infractions: { metric: metric(4701, 'i', [['2025-01-01', 1000]]), latestCompetence: 202501, semantics: '' }, restrictions: [] };
  const ch = buildTrafficChapter({ scope: VIT, t }); assert.deepEqual(ch.prf!.markers, [{ t: '2016', label: 'Mudança de metodologia da PRF (2015→2016): a série anterior não é comparável.' }]); assert.equal(ch.infractions, null, 'infração só aparece para a UF');
  assert.match(ch.renaestCoverage ?? '', /73 de 79 municípios/); assert.equal(ch.fleet!.series[0]!.points.at(-1)!.state, 'partial', 'ano corrente da frota é parcial'); assert.equal(ch.byUser[0]!.label, 'Motociclistas');
  const st = buildTrafficChapter({ scope: ES, t }); assert.ok(st.infractions); assert.match(trafficNarrative(VIT, ch, null).context ?? '', /não demonstram relação de causa/);
});

test('atuação policial: contexto sem insinuar organização criminosa; Estadual e PF/PRF ficam em gráficos separados', () => {
  const ser = (id: number, abr: string, v: number) => ({ family: 'OC.WEAPON.FIREARMS_SEIZED', indicatorId: id, source: 'VDE', abrangencia: abr, measure: 'armas', unit: 'armas', level: 'uf', note: null, points: [{ period: '2025-01', value: v, preliminary: false }, { period: '2025-02', value: v, preliminary: false }], first: '2025-01', last: '2025-02' });
  const oc: OcPayloadLite = { families: [{ code: 'OC.WEAPON.FIREARMS_SEIZED', label: 'Armas de fogo apreendidas', semantics: 's', series: [ser(3122, 'Estadual', 10), ser(3123, 'PF/PRF', 2)] }], restrictions: ['r'], notAvailable: ['Operações policiais: sem série nacional'] };
  const ch = buildPoliceChapter({ scope: ES, oc, national: null }); assert.equal(ch.families[0]!.series.length, 2); assert.notEqual(ch.families[0]!.series[0]!.chart.id, ch.families[0]!.series[1]!.chart.id);
  const said = policeNarrative(ES, ch); assert.match(said.context ?? '', /não\s+prova|nenhum desses registros prova/i); assert.ok(!/facç/i.test(JSON.stringify(ch)) && !/domin/i.test(JSON.stringify(ch)), 'sem facção nem controle territorial');
});

test('nenhuma narrativa atribui causa: sem "por causa de", "devido a", "graças a" nem "resultado de"', () => {
  const text = [crimeNarrative(VIT, { options: [], defaultOptionId: null, stateOnly: [], sourceNote: '' } as never, 'x').answer, policeNarrative(VIT, { families: [], notAvailable: [], restrictions: [], national: [] } as never).context ?? ''].join(' ');
  assert.ok(!/por causa de|devido a|gra[çc]as a|resultado d[eo]/i.test(text));
});

test('hero: escolhe 3–4 indicadores de dimensões diferentes, sem tom bom/ruim, e registra o que rejeitou e por quê (prisional e apreensões)', async () => {
  const q = { query: async () => ({ rows: [] }) } as never;
  const metric = (code: string, id: number, vals: number[], extra: Partial<SegMetric> = {}): SegMetric => ({ indicatorId: id, code, label: code, unit: 'vítimas', source: 'VDE', definition: 'd', granularity: 'municipio', grain: 'M', comparability: 'c', series: vals.map((v, i) => rm(`${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`, v)), latestPeriod: '2025-12-01', provisional: false, ...extra });
  const crime = buildCrimeChapter({ scope: VIT, seg: { metrics: [metric('IND-SEG-VDE-HOMICIDIO-DOLOSO-E', 3101, Array(24).fill(3))], coverage: {} }, segState: null, sc: null, pop: [] });
  const empty = buildTrafficChapter({ scope: VIT, t: null }); const fin = buildFinanceChapter({ scope: VIT, fin: null, contracts: null, bench: null }); const structure = buildStructureChapter({ scope: VIT, muni: null, state: null, national: null });
  const { hero } = await buildHero(q, { scope: VIT, crime, traffic: empty, finance: fin, structure, sc: null, population: 343935 });
  assert.equal(hero.kpis.length, 1); assert.equal(hero.kpis[0]!.id, 'letal'); assert.ok(hero.kpis[0]!.compare === null || hero.kpis[0]!.compare.valid === false); assert.ok(hero.rejected.some(r => r.id === 'prisional') && hero.rejected.some(r => r.id === 'apreensoes') && hero.rejected.some(r => r.id === 'patrimonio'));
  assert.ok(!('tone' in hero.kpis[0]!), 'nenhum KPI carrega cor de bom/ruim');
});

test('gráfico: renderiza no servidor sem NaN para série vazia, de um ponto, com benchmark e com valor suprimido', () => {
  const base: ChartView = { id: 'x', title: 'T', unit: 'u', digits: 0, grain: 'A', series: [], notes: [], source: 's', coverage: 'c' };
  const html = (c: ChartView) => renderToStaticMarkup(createElement(TrendChart, { chart: c }));
  const empty = html(base); assert.match(empty, /Sem valores neste período/); assert.ok(!/NaN|undefined|Infinity/.test(empty));
  const one = html({ ...base, series: [{ key: 's', label: 'A', points: [{ t: '2025', v: 5, state: 'ok' }] }] }); assert.ok(!/NaN/.test(one)); assert.match(one, /role="img"/);
  const withBench = html({ ...base, series: [{ key: 's', label: 'A', points: [{ t: '2023', v: 5, state: 'ok' }, { t: '2024', v: 7, state: 'ok' }, { t: '2025', v: 6, state: 'prelim' }] }], bench: { status: 'ok', label: 'b', cohort: 'municípios do ES', basis: 'x', points: [{ t: '2023', p25: 3, p50: 4, p75: 6, n: 8, universe: 8 }, { t: '2024', p25: 3, p50: 5, p75: 6, n: 8, universe: 8 }, { t: '2025', p25: 3, p50: 5, p75: 7, n: 8, universe: 8 }] } });
  assert.ok(!/NaN/.test(withBench)); assert.match(withBench, /1º a 3º quartil/); assert.match(withBench, /Mediana: municípios do ES/); assert.match(withBench, /Ver os valores do gráfico/);
  const sup = html({ ...base, series: [{ key: 's', label: 'A', points: [{ t: '2024', v: 5, state: 'ok' }, { t: '2025', v: null, state: 'suppressed' }] }] }); assert.ok(sup.includes('×') && !/NaN/.test(sup));
  const gap = html({ ...base, series: [{ key: 's', label: 'A', points: [{ t: '2021', v: 5, state: 'ok' }, { t: '2024', v: 6, state: 'ok' }] }], gaps: [{ from: '2022', to: '2023', label: 'sem estimativa oficial de população' }] }); assert.match(gap, /sem estimativa oficial de população/);
});

test('ano de fonte de eventos: mês sem linha NÃO torna o ano parcial; só o fim da cobertura da fonte torna', () => {
  const pts = [{ t: '2024-01', v: 3, state: 'ok' as const }, { t: '2024-02', v: null, state: 'absent' as const }, { t: '2024-03', v: 2, state: 'ok' as const }, { t: '2025-01', v: 1, state: 'ok' as const }];
  assert.deepEqual(monthlyToAnnual(pts).map(p => [p.t, p.state]), [['2024', 'partial'], ['2025', 'partial']], 'sem limites: contagem de meses com valor');
  assert.deepEqual(monthlyToAnnualBounded(pts, { first: '2012-01', last: '2025-09' }).map(p => [p.t, p.v, p.state]), [['2024', 5, 'ok'], ['2025', 1, 'partial']], 'com a cobertura da fonte: 2024 completo; 2025 termina em setembro');
  assert.deepEqual(monthlyToAnnualBounded(pts, { first: '2024-06', last: '2025-12' }).map(p => p.state), ['partial', 'ok'], 'fonte que começou no meio do ano: esse ano é parcial');
});
