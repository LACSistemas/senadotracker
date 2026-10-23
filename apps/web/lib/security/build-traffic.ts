import { FLEET_TYPE_PLAIN, INFRACTION_NOTE, PRF_BREAK, TRAFFIC_USER } from './catalog';
import { fmt, periodLong } from './format';
import { mkChart, mkSeries, monthlyToAnnual, pointsFromRm, type RmPoint } from './series';
import { POP_GAP } from './build-crime';
import type { ChartPoint, ChartView, ScopeInfo, TrafficChapter } from './types';

interface TMetric { indicatorId: number; code: string; label: string; unit: string; series: RmPoint[]; latestPeriod: string | null; provisional: boolean; comparability: string }
interface FleetPt { competence: number; total: number; byType: Record<string, number> }
export interface TrafficPayload {
  sim: TMetric[]; renaest: TMetric[]; prf: TMetric[]; ufCoverage?: Array<{ source: string; competence: number; records: number; fatalRecords: number; municipalities: number; universe: number; scope: string }>;
  coverage?: Array<{ source: string; competence: number; records: number; fatalRecords: number; municipalities: number; universe: number; scope: string }>;
  fleet: { source: string; semantics: string; latest: { competence: number; total: number; byType: Record<string, number> } | null; series: FleetPt[]; competences: { first: number; last: number; published: number } } | null;
  infractions?: { metric: TMetric; latestCompetence: number | null; semantics: string } | null; restrictions: string[];
}
const find = (m: TMetric[], id: number) => m.find(x => x.indicatorId === id);
const ym = (c: number) => `${Math.floor(c / 100)}-${String(c % 100).padStart(2, '0')}`;

export function buildTrafficChapter(o: { scope: ScopeInfo; t: TrafficPayload | null }): TrafficChapter {
  const { scope, t } = o; const where = scope.kind === 'uf' ? scope.stateName : scope.name;
  const empty: TrafficChapter = { id: 'transito', number: 3, title: 'Segurança viária', question: 'O que acontece nas ruas e estradas?', available: false, emptyReason: 'Sem dados de trânsito publicados para este território.', narrative: { question: 'O que acontece nas ruas e estradas?', answer: '', context: null, invite: '' },
    deaths: { residence: null, occurrence: null, rate: null }, byUser: [], fleet: null, fleetByType: [], fleetBasis: null, prf: null, renaest: null, renaestCoverage: null, infractions: null, restrictions: [] };
  if (!t) return empty;
  const res = find(t.sim, 4001), oco = find(t.sim, 4101), rate = find(t.sim, 4021);
  const chart = (id: string, title: string, m: TMetric | undefined, extra: Partial<ChartView> = {}): ChartView | null => {
    if (!m || !m.series.some(p => p.value != null)) return null;
    return mkChart({ id, title, unit: m.unit, digits: extra.digits ?? 0, grain: 'A', series: [mkSeries('t', where, pointsFromRm(m.series, 'A'))], source: 'SIM/DATASUS (declarações de óbito)', coverage: `${m.series[0]!.period.slice(0, 4)} a ${m.latestPeriod?.slice(0, 4) ?? '—'}`,
      notes: ['Óbitos por acidente de transporte terrestre (CID-10 V01–V89). É medida de saúde: não é o total de sinistros.', m.provisional ? 'O último ano é preliminar.' : ''].filter(Boolean), ...extra });
  };
  const deaths = { residence: chart('tra:res', `Mortes no trânsito de moradores de ${where}`, res), occurrence: chart('tra:oco', `Mortes no trânsito ocorridas em ${where}`, oco),
    rate: chart('tra:rate', `Mortes no trânsito: taxa por 100 mil moradores`, rate, { digits: 1, gaps: [POP_GAP], benchUrl: `/api/seguranca/benchmark?entity=${scope.entityId}&opt=tra:rate`, unit: 'por 100 mil habitantes' }) };
  const lastYear = res?.series.at(-1)?.period.slice(0, 4);
  const byUser = TRAFFIC_USER.map(u => { const m = find(t.sim, u.id); const p = m?.series.at(-1); return p && p.value != null && p.value > 0 ? { label: u.label, value: p.value, year: Number(p.period.slice(0, 4)) } : null; }).filter((x): x is { label: string; value: number; year: number } => !!x).sort((a, b) => b.value - a.value);

  // Frota: estoque no fim de cada ano (dezembro) ou última competência do ano em curso.
  let fleet: ChartView | null = null; let fleetByType: Array<{ label: string; value: number }> = []; let fleetBasis: string | null = null;
  if (t.fleet?.series.length) {
    const byYear = new Map<number, FleetPt>(); for (const p of t.fleet.series) byYear.set(Math.floor(p.competence / 100), p);
    const pts: ChartPoint[] = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, p]) => ({ t: String(y), v: p.total, state: p.competence % 100 === 12 ? 'ok' as const : 'partial' as const }));
    const monthly: ChartPoint[] = t.fleet.series.map(p => ({ t: ym(p.competence), v: p.total, state: 'ok' as const }));
    fleet = mkChart({ id: 'tra:fleet', title: `Veículos registrados em ${where}`, unit: 'veículos', digits: 0, grain: 'A', series: [mkSeries('t', where, pts)], monthly: [mkSeries('t', where, monthly)], source: 'Senatran — frota registrada (Renavam)', coverage: `${ym(t.fleet.competences.first)} a ${ym(t.fleet.competences.last)}`,
      notes: ['Veículos registrados no território, não veículos circulando ao mesmo tempo. O ponto do ano é a posição de dezembro; o ano em curso mostra a última competência (círculo vazado).'] });
    if (t.fleet.latest) { fleetBasis = `Posição de ${periodLong(ym(t.fleet.latest.competence))}`; fleetByType = Object.entries(t.fleet.latest.byType).filter(([, v]) => v > 0).map(([k, v]) => ({ label: FLEET_TYPE_PLAIN[k] ?? k, value: v })).sort((a, b) => b.value - a.value).slice(0, 8); }
  }
  // PRF: só rodovias federais; a série tem quebra de metodologia 2015→2016.
  const prfS = find(t.prf, 4621), prfF = find(t.prf, 4622);
  const prf = prfS && prfS.series.some(p => p.value != null) ? mkChart({ id: 'tra:prf', title: `Sinistros nas rodovias federais que cortam ${where}`, unit: 'sinistros', digits: 0, grain: 'A',
    series: [mkSeries('s', 'Sinistros', pointsFromRm(prfS.series, 'A')), ...(prfF ? [mkSeries('f', 'Com vítima fatal', pointsFromRm(prfF.series, 'A'), 'amber')] : [])], markers: [{ t: PRF_BREAK.to, label: PRF_BREAK.label }],
    source: 'Polícia Rodoviária Federal — dados abertos', coverage: `${prfS.series[0]!.period.slice(0, 4)} a ${prfS.latestPeriod?.slice(0, 4) ?? '—'}`, notes: ['Só rodovias federais: não representa todos os sinistros do território.', PRF_BREAK.label] }) : null;
  // RENAEST: cobertura desigual; não resposta não é ausência de sinistros.
  const rS = find(t.renaest, 4301), rF = find(t.renaest, 4302);
  const renaest = rS && rS.series.some(p => p.value != null) ? mkChart({ id: 'tra:renaest', title: `Sinistros reportados ao RENAEST em ${where}`, unit: 'sinistros', digits: 0, grain: 'A',
    series: [mkSeries('s', 'Sinistros reportados', monthlyToAnnual(pointsFromRm(rS.series, 'M'))), ...(rF ? [mkSeries('f', 'Com óbito', monthlyToAnnual(pointsFromRm(rF.series, 'M')), 'amber')] : [])],
    monthly: [mkSeries('s', 'Sinistros reportados', pointsFromRm(rS.series, 'M')), ...(rF ? [mkSeries('f', 'Com óbito', pointsFromRm(rF.series, 'M'), 'amber')] : [])],
    source: 'Ministério dos Transportes/Senatran — RENAEST', coverage: `${rS.series[0]!.period.slice(0, 7)} a ${rS.latestPeriod?.slice(0, 7) ?? '—'}`, notes: ['A cobertura do RENAEST é desigual: unidade da federação que não reportou um mês não significa que não houve sinistros, e quedas bruscas podem refletir mudança de cobertura, não menos acidentes.'] }) : null;
  const cov = (t.ufCoverage ?? t.coverage ?? []).filter(c => c.source === 'renaest'); const lastCov = cov.at(-1);
  const renaestCoverage = lastCov ? `Na última competência (${periodLong(ym(lastCov.competence))}), ${fmt(lastCov.municipalities)} de ${fmt(lastCov.universe)} municípios do estado têm registro no RENAEST.` : null;
  // Infrações: só para a UF (UF de jurisdição do veículo).
  const inf = t.infractions?.metric; const infractions = scope.kind === 'uf' && inf && inf.series.some(p => p.value != null)
    ? mkChart({ id: 'tra:inf', title: `Notificações de infração de veículos emplacados em ${where}`, unit: 'notificações', digits: 0, grain: 'A', series: [mkSeries('t', where, monthlyToAnnual(pointsFromRm(inf.series, 'M')))], monthly: [mkSeries('t', where, pointsFromRm(inf.series, 'M'))],
        source: 'Senatran — infrações', coverage: `${inf.series[0]!.period.slice(0, 7)} a ${inf.latestPeriod?.slice(0, 7) ?? '—'}`, notes: [INFRACTION_NOTE] }) : null;
  const available = !!(deaths.residence || deaths.occurrence || fleet || prf || renaest);
  void lastYear;
  return { ...empty, available, emptyReason: available ? '' : 'Sem dados de trânsito publicados para este território.', deaths, byUser, fleet, fleetByType, fleetBasis, prf, renaest, renaestCoverage, infractions,
    restrictions: ['SIM conta óbitos (saúde); PRF só rodovias federais; RENAEST tem cobertura desigual; frota é veículo registrado. Os universos são diferentes e não se somam nem se igualam.', 'Os dados mostram o que ocorreu, não a causa: crescimento da frota e mortes não têm relação causal demonstrada aqui.'] };
}
