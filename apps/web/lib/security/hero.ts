import { rateBench, crimeBench, rulerOf } from './bench.ts';
import { robberyFamilySeries, type StateCrimePayloadLite } from './build-crime.ts';
import { changeRatio, directionOf, fmt, signedPct } from './format.ts';
import { latestValue, sparkOf } from './series.ts';
import type { BenchView, ChartPoint, CrimeChapter, FinanceChapter, Hero, Kpi, ScopeInfo, StructureChapter, TrafficChapter } from './types.ts';

type Q = Parameters<typeof rateBench>[0];
const noPartial = (pts: ChartPoint[]) => pts.filter(p => p.v != null && p.state !== 'partial');
const prevOf = (pts: ChartPoint[], t: string) => noPartial(pts).filter(p => p.t < t).at(-1) ?? null;
const delta = (cur: ChartPoint, prev: ChartPoint | null, label: string, flat = 0.03): Kpi['delta'] => {
  if (!prev || prev.v == null || cur.v == null) return null; const r = changeRatio(prev.v, cur.v);
  if (r == null) return { text: `${fmt(prev.v)} em ${prev.t}`, direction: 'flat' };
  const dir = directionOf(r, flat); return { text: dir === 'flat' ? `Estável em relação a ${prev.t} (${signedPct(r)})` : `${signedPct(r)} em relação a ${prev.t}`, direction: dir };
  void label;
};
const SMALL = (v: number) => v < 15 ? 'Números pequenos: poucos casos a mais ou a menos mudam muito o percentual.' : null;

export interface HeroInput { bounds?: Map<number, import('./series.ts').Bounds>; financeBench?: Promise<BenchView | null>; scope: ScopeInfo; crime: CrimeChapter; traffic: TrafficChapter; finance: FinanceChapter; structure: StructureChapter; sc: StateCrimePayloadLite | null; population: number | null }

export async function buildHero(q: Q, i: HeroInput): Promise<{ hero: Hero; benchByKpi: Record<string, BenchView> }> {
  const { scope } = i; const kpis: Kpi[] = []; const rejected: Hero['rejected'] = []; const benchByKpi: Record<string, BenchView> = {};
  const where = scope.kind === 'uf' ? scope.stateName : scope.name;
  const pop = i.population ?? scope.population?.value ?? null;

  const parts: Array<Promise<void>> = []; const order = ['letal', 'patrimonio', 'transito', 'gasto', 'estrutura'];
  // 1) Violência letal: homicídio doloso do Sinesp; o SIM (saúde) entra só quando o Sinesp não tem o município.
  const hom = i.crime.options.find(o => o.id === 'vde:homicidio-doloso' && (scope.kind === 'uf' || o.scope === 'municipio')) ?? i.crime.options.find(o => o.id === 'sim:agr');
  if (hom) parts.push((async () => {
    const count = hom.measures.find(m => m.key === 'count')!.chart; const pts = noPartial(count.series[0]!.points); const cur = pts.at(-1);
    if (cur) {
      const isSim = hom.id === 'sim:agr'; const rateM = hom.measures.find(m => m.key === 'rate'); const ratePts = rateM ? rateM.chart.series[0]!.points.filter(p => p.v != null) : []; const rateCur = ratePts.at(-1);
      const rateId = isSim ? 3006 : 3201;
      const bench = rateCur ? await rateBench(q, { scope, indicatorId: rateId, label: isSim ? 'mortes por agressão (taxa)' : 'homicídios dolosos (taxa)', unit: 'por 100 mil habitantes', digits: 1, own: { t: rateCur.t, v: rateCur.v! }, population: pop, basis: isSim ? 'SIM; população IBGE do mesmo ano' : 'Sinesp VDE; população IBGE do mesmo ano' }) : null;
      if (bench) benchByKpi.letal = bench;
      kpis.push({ id: 'letal', label: isSim ? 'Mortes por agressão' : 'Homicídios dolosos', plain: isSim ? 'Mortes por agressão (registro de saúde, moradores)' : 'Vítimas de homicídio doloso registradas', value: fmt(cur.v!), unit: isSim ? `óbitos em ${cur.t}` : `vítimas em ${cur.t}`,
        basis: `${cur.t}${cur.state === 'prelim' ? ' (preliminar)' : ''}`, chapter: 'criminalidade', delta: delta(cur, prevOf(pts, cur.t), 'homicídio'), compare: bench ? (bench.status === 'ok' ? { text: bench.sentence!, valid: true } : { text: bench.unavailableReason!, valid: false }) : null, ruler: rateCur ? rulerOf(bench, { t: rateCur.t, v: rateCur.v! }, { digits: 1, unit: 'por 100 mil hab.' }) : null,
        spark: sparkOf(pts, 10), sparkLabel: `${pts.slice(-10)[0]?.t ?? ''}–${cur.t}`, secondary: rateCur ? `${fmt(rateCur.v!, 1)} por 100 mil habitantes em ${rateCur.t}` : null, caveat: SMALL(cur.v!), source: isSim ? 'SIM/DATASUS' : 'Sinesp (MJSP)', state: cur.state === 'prelim' ? 'prelim' : 'ok' });
    }
  })()); else rejected.push({ id: 'letal', reason: 'Sem série de homicídio publicada para o território.' });

  // 2) Roubos: só onde há registro estadual municipalizado; soma apenas categorias exclusivas da mesma fonte.
  const rob = robberyFamilySeries(i.sc, i.bounds); const scSrc = i.sc?.source ?? null;
  if (rob && scSrc) parts.push((async () => {
    const pts = noPartial(rob.annual); const cur = pts.at(-1);
    if (cur) {
      let bench: BenchView | null = null; let secondary: string | null = null;
      const cb = await crimeBench(q, { scope, indicatorIds: rob.ids, label: 'roubos', source: scSrc.name }); bench = cb.bench; benchByKpi.patrimonio = bench;
      if (cb.own) secondary = `${fmt(cb.own.v, 0)} por 100 mil habitantes em ${cb.own.t}`;
      kpis.push({ id: 'patrimonio', label: 'Roubos', plain: rob.label, value: fmt(cur.v!), unit: `registros em ${cur.t}`, basis: `${cur.t}${cur.state === 'prelim' ? ' (preliminar)' : ''}`, chapter: 'criminalidade', delta: delta(cur, prevOf(pts, cur.t), 'roubo'),
        compare: bench.status === 'ok' ? { text: bench.sentence!, valid: true } : { text: bench.unavailableReason!, valid: false }, ruler: rulerOf(bench, cb.own, { digits: 0, unit: 'por 100 mil hab.' }), spark: sparkOf(pts, 10), sparkLabel: `${pts.slice(-10)[0]?.t ?? ''}–${cur.t}`, secondary, caveat: rob.note, source: scSrc.name, state: cur.state === 'prelim' ? 'prelim' : 'ok' });
    }
  })()); else rejected.push({ id: 'patrimonio', reason: 'Este estado não tem registro de roubos por município publicado no Cívica; roubo de veículo e de carga existem só no nível estadual.' });

  // 3) Trânsito
  const res = i.traffic.deaths.residence; const rateT = i.traffic.deaths.rate;
  if (res) parts.push((async () => {
    const pts = noPartial(res.series[0]!.points); const cur = pts.at(-1);
    if (cur) {
      const rc = rateT ? rateT.series[0]!.points.filter(p => p.v != null).at(-1) : undefined;
      const bench = rc ? await rateBench(q, { scope, indicatorId: 4021, label: 'mortes no trânsito (taxa)', unit: 'por 100 mil habitantes', digits: 1, own: { t: rc.t, v: rc.v! }, population: pop, basis: 'SIM; população IBGE do mesmo ano' }) : null; if (bench) benchByKpi.transito = bench;
      kpis.push({ id: 'transito', label: 'Mortes no trânsito', plain: 'Moradores mortos em acidentes de trânsito', value: fmt(cur.v!), unit: `óbitos em ${cur.t}`, basis: `${cur.t}${cur.state === 'prelim' ? ' (preliminar)' : ''}`, chapter: 'transito', delta: delta(cur, prevOf(pts, cur.t), 'trânsito'),
        compare: bench ? (bench.status === 'ok' ? { text: bench.sentence!, valid: true } : { text: bench.unavailableReason!, valid: false }) : null, ruler: rc ? rulerOf(bench, { t: rc.t, v: rc.v! }, { digits: 1, unit: 'por 100 mil hab.' }) : null, spark: sparkOf(pts, 10), sparkLabel: `${pts.slice(-10)[0]?.t ?? ''}–${cur.t}`, secondary: rc ? `${fmt(rc.v!, 1)} por 100 mil moradores em ${rc.t}` : null, caveat: SMALL(cur.v!), source: 'SIM/DATASUS', state: cur.state === 'prelim' ? 'prelim' : 'ok' });
    }
  })()); else rejected.push({ id: 'transito', reason: 'Sem série de mortes no trânsito.' });

  // 4) Gasto público em Segurança: despesa paga por habitante (função 06), ano fechado da DCA.
  const fy = i.finance.years.filter(y => !y.preliminary && y.stages.paga != null); const lastFy = fy.at(-1);
  if (lastFy) parts.push((async () => {
    const prev = fy.at(-2); const r = prev ? changeRatio(prev.stages.paga ?? null, lastFy.stages.paga ?? null) : null;
    const bench = (await i.financeBench) ?? i.finance.bench; if (bench) benchByKpi.gasto = bench;
    const valuePc = lastFy.perCapitaPaid;
    kpis.push({ id: 'gasto', label: 'Gasto em Segurança', plain: scope.kind === 'uf' ? 'Despesa paga do governo estadual na função Segurança Pública' : 'Despesa paga pela prefeitura na função Segurança Pública', value: valuePc != null ? `R$ ${fmt(valuePc, 0)}` : `R$ ${fmt((lastFy.stages.paga ?? 0) / 1e6, 1)} mi`,
      unit: valuePc != null ? `por habitante em ${lastFy.exercicio}` : `pagos em ${lastFy.exercicio}`, basis: `exercício ${lastFy.exercicio}`, chapter: 'financas', delta: r == null ? null : { text: `${signedPct(r)} no valor pago, em reais correntes, em relação a ${prev!.exercicio}`, direction: directionOf(r, 0.03) },
      compare: bench ? (bench.status === 'ok' ? { text: bench.sentence!, valid: true } : { text: bench.unavailableReason!, valid: false }) : null, ruler: valuePc != null ? rulerOf(bench, { t: String(lastFy.exercicio), v: valuePc }, { digits: 0, unit: 'por habitante', prefix: 'R$ ' }) : null, spark: (valuePc != null ? fy.filter(y => y.perCapitaPaid != null) : fy).slice(-10).map(y => (valuePc != null ? y.perCapitaPaid : y.stages.paga) ?? 0), sparkLabel: `${(valuePc != null ? fy.filter(y => y.perCapitaPaid != null) : fy).slice(-10)[0]?.exercicio}–${lastFy.exercicio}`,
      secondary: `R$ ${fmt((lastFy.stages.paga ?? 0) / 1e6, 1)} milhões pagos${lastFy.share != null ? `, ${fmt(lastFy.share * 100, 1)}% da despesa total empenhada` : ''}`, caveat: 'Valores correntes, sem correção pela inflação. Gasto não mede eficiência nem resultado.', source: 'Siconfi (Tesouro Nacional)', state: 'ok' });
  })()); else rejected.push({ id: 'gasto', reason: 'Sem despesa na função Segurança Pública publicada.' });
  await Promise.all(parts); kpis.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  // 5) Estrutura (reserva): guarda municipal ou, no estado, o efetivo da PM.
  if (kpis.length < 4 && i.structure.available) {
    const g = i.structure.municipal.find(c => c.key === 'guarda');
    if (g && g.value != null) kpis.push({ id: 'estrutura', label: 'Guarda municipal', plain: 'Guarda municipal declarada pela prefeitura', value: g.value > 0 ? fmt(g.value) : 'Não tem', unit: g.unit, basis: g.basis, chapter: 'estrutura', delta: null, compare: null, ruler: null, spark: [], sparkLabel: '', secondary: null, caveat: g.note, source: g.source, state: 'ok' });
    const pm = i.structure.state.find(c => c.key === 'pm');
    if (kpis.length < 4 && pm && scope.kind === 'uf' && pm.value != null) kpis.push({ id: 'estrutura', label: 'Policiais militares', plain: 'Efetivo da ativa da Polícia Militar', value: fmt(pm.value), unit: pm.unit, basis: pm.basis, chapter: 'estrutura', delta: null, compare: null, ruler: null, spark: [], sparkLabel: '', secondary: pm.planned ? `Quadro previsto: ${fmt(pm.planned)}` : null, caveat: null, source: pm.source, state: 'ok' });
  }
  rejected.push({ id: 'prisional', reason: 'A ocupação prisional descreve o sistema do estado e a unidade custodiada, não a segurança do morador; fica no capítulo próprio.' }, { id: 'apreensoes', reason: 'Apreensões e mandados medem atuação policial: aumento não significa piora nem melhora, por isso não entram como indicador-chave.' });

  const chosen = kpis.slice(0, 4);
  const facts = chosen.map(k => `${k.plain}: ${k.value} ${k.unit}${k.delta ? ` (${k.delta.text.toLowerCase()})` : ''}.`);
  const lede = chosen.length ? `Registros oficiais mais recentes de ${where}. Cada capítulo mostra a origem, a evolução e o que as fontes não permitem concluir.` : `Ainda há poucos dados oficiais de Segurança publicados para ${where}. A página mostra o que existe e o que falta.`;
  return { hero: { kpis: chosen, lede, facts, rejected }, benchByKpi };
}
export { latestValue };
