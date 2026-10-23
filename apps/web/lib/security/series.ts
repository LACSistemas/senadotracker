import type { BenchBandPoint, BenchView, ChartPoint, ChartSeries, ChartView, Grain, PointState } from './types.ts';
import { changeRatio, fmt, periodLabel, signedPct } from './format.ts';

/** Pontos como saem dos read models P9.1/P9.2/P9.4 (`period` ISO, `kind`, `flags[]`). */
export interface RmPoint { period: string; value: number | null; numerator?: number | null; denominator?: number | null; status?: string; kind?: string; flags?: string[] }
/** Pontos do P9.6 (`month`, `status`, `preliminary`). */
export interface CrimePointRm { month: string; value: number | null; status: string; preliminary: boolean }

export const isoToT = (iso: string, grain: Grain): string => grain === 'A' ? iso.slice(0, 4) : iso.slice(0, 7);

export function stateOf(p: RmPoint): PointState {
  if (p.value == null) return p.flags?.includes('suppressed') ? 'suppressed' : 'absent';
  if (p.flags?.includes('suppressed')) return 'suppressed';
  if (p.kind === 'zero_reportado' || p.kind === 'zero_derivado') return p.flags?.includes('preliminary') ? 'prelim' : 'zero';
  if (p.flags?.includes('partialCoverage')) return 'partial';
  return p.flags?.includes('preliminary') || p.status === 'preliminar' ? 'prelim' : 'ok';
}
export function pointsFromRm(points: RmPoint[], grain: Grain): ChartPoint[] {
  return points.map(p => ({ t: isoToT(p.period, grain), v: p.value, state: stateOf(p), n: p.numerator ?? null, d: p.denominator ?? null }));
}
export function pointsFromCrime(points: CrimePointRm[], opts: { explicitZeros: boolean }): ChartPoint[] {
  return points.map(p => ({ t: p.month, v: p.value, state: p.status === 'suppressed' ? 'suppressed' : p.value == null ? 'absent' : p.preliminary ? 'prelim' : (p.value === 0 && opts.explicitZeros) ? 'zero' : 'ok' }));
}
/** Para fontes de eventos o gráfico mostra lacuna (não zero) onde a fonte não traz linha: preenche meses faltantes com `absent` dentro do intervalo observado. */
export function fillMonthly(points: ChartPoint[]): ChartPoint[] {
  if (points.length < 2) return points;
  const by = new Map(points.map(p => [p.t, p])); const out: ChartPoint[] = [];
  let [y, m] = points[0]!.t.split('-').map(Number) as [number, number]; const [ey, em] = points[points.length - 1]!.t.split('-').map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) { const t = `${y}-${String(m).padStart(2, '0')}`; out.push(by.get(t) ?? { t, v: null, state: 'absent' }); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

export const latestValue = (pts: ChartPoint[]): ChartPoint | null => { for (let i = pts.length - 1; i >= 0; i--) if (pts[i]!.v != null) return pts[i]!; return null; };
export const valueAt = (pts: ChartPoint[], t: string): number | null => pts.find(p => p.t === t)?.v ?? null;
/** Último ano civil COMPLETO de uma série mensal (12 meses com valor, nenhum preliminar-parcial): devolve o ano e a soma. Séries anuais devolvem o próprio último ponto não parcial. */
export function lastCompleteYear(pts: ChartPoint[], grain: Grain, opts: { requireAllMonths?: boolean } = {}): { year: number; total: number; prelim: boolean } | null {
  if (grain === 'A') { const p = [...pts].reverse().find(x => x.v != null && x.state !== 'partial'); return p ? { year: Number(p.t), total: p.v!, prelim: p.state === 'prelim' } : null; }
  const by = new Map<number, ChartPoint[]>(); for (const p of pts) { const y = Number(p.t.slice(0, 4)); (by.get(y) ?? by.set(y, []).get(y)!).push(p); }
  const years = [...by.keys()].sort((a, b) => b - a);
  for (const y of years) { const ps = by.get(y)!; if (ps.length === 12 && (!opts.requireAllMonths || ps.every(p => p.v != null))) return { year: y, total: ps.reduce((s, p) => s + (p.v ?? 0), 0), prelim: ps.some(p => p.state === 'prelim') }; }
  return null;
}
export function yearTotals(pts: ChartPoint[]): Array<{ year: number; total: number; months: number; prelim: boolean }> {
  const by = new Map<number, { total: number; months: number; prelim: boolean }>();
  for (const p of pts) { if (p.v == null) continue; const y = Number(p.t.slice(0, 4)); const c = by.get(y) ?? { total: 0, months: 0, prelim: false }; c.total += p.v; c.months++; c.prelim ||= p.state === 'prelim'; by.set(y, c); }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([year, c]) => ({ year, ...c }));
}
/** Soma anual de uma série mensal em série ANUAL; ano com menos de 12 meses fica marcado como parcial (círculo vazado no gráfico). */
export function monthlyToAnnual(pts: ChartPoint[]): ChartPoint[] {
  return yearTotals(pts).map(y => ({ t: String(y.year), v: y.total, state: y.months < 12 ? 'partial' : y.prelim ? 'prelim' : 'ok' }));
}

export interface Bounds { first: string; last: string }
/** Soma anual com completude definida pela COBERTURA DA FONTE (primeiro/último mês publicados na UF): fonte de eventos não traz linha em mês sem registro, e isso não torna o ano parcial. */
export function monthlyToAnnualBounded(pts: ChartPoint[], b: Bounds | undefined): ChartPoint[] {
  if (!b) return monthlyToAnnual(pts);
  return yearTotals(pts).map(y => { const inside = `${y.year}-01` >= b.first && `${y.year}-12` <= b.last; return { t: String(y.year), v: y.total, state: !inside ? 'partial' : y.prelim ? 'prelim' : 'ok' } as ChartPoint; });
}
export const sparkOf = (pts: ChartPoint[], max = 12): number[] => pts.filter(p => p.v != null).slice(-max).map(p => p.v!);

export function mkSeries(key: string, label: string, points: ChartPoint[], color: ChartSeries['color'] = 'primary', dash = false): ChartSeries { return { key, label, color, dash, points }; }
export function mkChart(c: Omit<ChartView, 'notes'> & { notes?: string[] }): ChartView { return { ...c, notes: c.notes ?? [] }; }

/** Faixa de benchmark pronta para o gráfico + frase validada. `unavailable` explica por que não há comparação. */
export function benchView(o: { label: string; cohort: string; basis: string; points: BenchBandPoint[]; sentence?: string }): BenchView { return { status: 'ok', ...o }; }
export function benchUnavailable(label: string, reason: string): BenchView { return { status: 'indisponivel', label, cohort: '', basis: '', points: [], unavailableReason: reason }; }

/** Frases de variação sem causalidade: descrevem o que mudou, nunca por quê. */
export function changeSentence(label: string, from: { t: string; v: number }, to: { t: string; v: number }, digits = 0): string {
  const r = changeRatio(from.v, to.v);
  const base = `${label}: ${fmt(from.v, digits)} em ${periodLabel(from.t)} e ${fmt(to.v, digits)} em ${periodLabel(to.t)}`;
  return r == null ? base + '.' : `${base} (${signedPct(r)}).`;
}
