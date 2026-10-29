import type { ChartPoint, ChartSeries, ChartView, PointState } from '../security/types.ts';
import { fmt } from '../security/format.ts';
import type { BarRow, ComparePoint, StatItem, Table, TerritoryCompare, WbScope } from './types.ts';

/** Utilitários de montagem: nada aqui recalcula dado oficial, só organiza, nomeia e compara lado a lado. Espelha
 * `lib/education/build.ts`, duplicado em vez de importado para não acoplar o domínio de Bem-estar ao de Educação. */
export type YV = { year: number; value: number | null };
export const pt = (year: number, v: number | null, state: PointState = 'ok'): ChartPoint => ({ t: String(year), v, state: v == null ? 'absent' : state });
export const ptsOf = (rows: YV[]): ChartPoint[] => rows.map(r => pt(r.year, r.value));
export const lastOf = (rows: YV[]): YV | null => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.value != null) return rows[i]!; return null; };
export const prevOf = (rows: YV[], last: YV | null): YV | null => { if (!last) return null; for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.year < last.year && rows[i]!.value != null) return rows[i]!; return null; };
export const nameOf = (scope: WbScope): string => scope.kind === 'uf' ? scope.stateName : scope.name;

export interface Cmp { own: YV[]; uf: YV[] | null; br: YV[] | null }
export function compareSeries(scope: WbScope, c: Cmp): ChartSeries[] {
  const out: ChartSeries[] = [{ key: 'own', label: nameOf(scope), color: 'primary', points: ptsOf(c.own) }];
  if (scope.kind === 'municipio' && c.uf?.some(r => r.value != null)) out.push({ key: 'uf', label: scope.stateName, color: 'blue', points: ptsOf(c.uf) });
  if (c.br?.some(r => r.value != null)) out.push({ key: 'br', label: 'Brasil', color: 'grey', dash: true, points: ptsOf(c.br) });
  return out;
}
export function chart(o: { id: string; title: string; unit: string; digits: number; grain?: 'A' | 'M'; yMax?: number; series: ChartSeries[]; notes: string[]; source: string; coverage: string }): ChartView | null {
  if (!o.series.some(s => s.points.some(p => p.v != null))) return null;
  const periods = o.series.flatMap(s => s.points.filter(p => p.v != null).map(p => p.t)).sort();
  return { id: o.id, title: o.title, unit: o.unit, digits: o.digits, grain: o.grain ?? 'A', ...(o.yMax ? { yMax: o.yMax } : {}), series: o.series, notes: o.notes, source: o.source, coverage: `${periods[0]}–${periods.at(-1)}${o.coverage ? ` · ${o.coverage}` : ''}` };
}
/** Série mensal a partir de observações cruas (Novo Caged): `t` vira "AAAA-MM" para o `TrendChart` ler como grão mensal. */
export function monthlySeries(key: string, label: string, rows: Array<{ periodStart: string | null; value: number | null }>, color: ChartSeries['color'] = 'primary', dash = false): ChartSeries {
  return { key, label, color, ...(dash ? { dash: true } : {}), points: rows.filter(r => r.periodStart).map(r => ({ t: r.periodStart!.slice(0, 7), v: r.value, state: (r.value == null ? 'absent' : 'ok') as PointState })) };
}
export const bars = (rows: Array<{ label: string; value: number | null; display?: string; note?: string | null }>): BarRow[] =>
  rows.filter((r): r is { label: string; value: number; display?: string; note?: string | null } => r.value != null).map(r => ({ label: r.label, value: r.value, display: r.display ?? fmt(r.value, 1), ...(r.note ? { note: r.note } : {}) }));
export const stat = (label: string, value: string, unit?: string, note?: string | null): StatItem => ({ label, value, ...(unit ? { unit } : {}), note: note ?? null });
export const table = (title: string, columns: string[], rows: Array<[string, Array<string | null>]>, caption?: string): Table | null =>
  rows.length ? { title, columns, rows: rows.map(([label, cells]) => ({ label, cells })), ...(caption ? { caption } : {}) } : null;

/** Um ponto de comparação a partir de `WellbeingComparator`: nunca inventa valor quando `eligible` é falso. */
export function comparePoint(label: string, c: { eligible: boolean; value: number | null; reason: string | null } | undefined, format: (v: number) => string): ComparePoint {
  if (!c || !c.eligible || c.value == null) return { label, value: null, display: '—', eligible: false, reason: c?.reason ?? 'não disponível' };
  return { label, value: c.value, display: format(c.value), eligible: true, reason: null };
}
export function territoryCompare(o: { ownLabel: string; stateLabel?: string; comparisons: { municipality?: { eligible: boolean; value: number | null; reason: string | null }; state?: { eligible: boolean; value: number | null; reason: string | null }; brazil?: { eligible: boolean; value: number | null; reason: string | null } }; year: string | null; unit: string; format: (v: number) => string; restrictions: string[] }): TerritoryCompare | null {
  const own = comparePoint(o.ownLabel, o.comparisons.municipality, o.format);
  if (!own.eligible) return null;
  // Em páginas de UF, "estado" e "território" são a mesma linha: omitir o ponto duplicado em vez de mostrar uma comparação trivial.
  const state = o.stateLabel ? comparePoint(o.stateLabel, o.comparisons.state, o.format) : null;
  return { unit: o.unit, year: o.year, own, state, brazil: comparePoint('Brasil', o.comparisons.brazil, o.format), restrictions: o.restrictions };
}
