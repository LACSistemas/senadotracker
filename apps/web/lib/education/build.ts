import type { ChartPoint, ChartSeries, ChartView, PointState } from '../security/types.ts';
import { brlShort, compact, fmt } from '../security/format.ts';
import { FLOW_MEASURES, FLOW_STAGES, IDEB_STAGES, INFRA_ITEMS, REDES, SAEB_GRADES, SUBJECTS } from './catalog.ts';
import type { BarRow, DistBar, EduScope, Explorer, ExplorerDim, ExplorerView, StatItem, Table } from './types.ts';

/** Utilitários de montagem de gráficos e exploradores. Nada aqui recalcula dado oficial: só organiza, nomeia e compara lado a lado. */
export type YV = { year: number; value: number | null };
export const pt = (year: number, v: number | null, state: PointState = 'ok'): ChartPoint => ({ t: String(year), v, state: v == null ? 'absent' : state });
export const ptsOf = (rows: YV[], prelimFrom?: number): ChartPoint[] => rows.map(r => pt(r.year, r.value, prelimFrom != null && r.year >= prelimFrom ? 'prelim' : 'ok'));
export const lastOf = (rows: YV[]): YV | null => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.value != null) return rows[i]!; return null; };
export const prevOf = (rows: YV[], last: YV | null): YV | null => { if (!last) return null; for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.year < last.year && rows[i]!.value != null) return rows[i]!; return null; };
export const nameOf = (scope: EduScope): string => scope.kind === 'uf' ? scope.stateName : scope.name;

export interface Cmp { own: YV[]; uf: YV[] | null; br: YV[] | null }
/** Séries lado a lado: o território (verde), a UF (azul, só para município) e o Brasil (cinza tracejado). */
export function compareSeries(scope: EduScope, c: Cmp): ChartSeries[] {
  const out: ChartSeries[] = [{ key: 'own', label: nameOf(scope), color: 'primary', points: ptsOf(c.own) }];
  if (scope.kind === 'municipio' && c.uf?.some(r => r.value != null)) out.push({ key: 'uf', label: scope.stateName, color: 'blue', points: ptsOf(c.uf) });
  if (c.br?.some(r => r.value != null)) out.push({ key: 'br', label: 'Brasil', color: 'grey', dash: true, points: ptsOf(c.br) });
  return out;
}
export function chart(o: { id: string; title: string; unit: string; digits: number; stepYears?: number; zoom?: boolean; yMax?: number; series: ChartSeries[]; notes: string[]; source: string; coverage: string }): ChartView | null {
  if (!o.series.some(s => s.points.some(p => p.v != null))) return null;
  const years = o.series.flatMap(s => s.points.filter(p => p.v != null).map(p => p.t)).sort();
  return { id: o.id, title: o.title, unit: o.unit, digits: o.digits, grain: 'A', ...(o.stepYears ? { stepYears: o.stepYears } : {}), ...(o.zoom ? { zoom: true } : {}), ...(o.yMax ? { yMax: o.yMax } : {}), series: o.series, notes: o.notes, source: o.source, coverage: `${years[0]}–${years.at(-1)}${o.coverage ? ` · ${o.coverage}` : ''}` };
}
export const keyOf = (dims: ExplorerDim[], vals: string[]): string => vals.join('|');
export function combos(dims: ExplorerDim[]): string[][] { return dims.reduce<string[][]>((acc, d) => acc.flatMap(a => d.options.map(o => [...a, o.value])), [[]]); }
export function explorer(id: string, dims: ExplorerDim[], build: (vals: string[]) => ExplorerView | null, emptyText: string): Explorer | null {
  const views: Record<string, ExplorerView> = {}; let any = false;
  for (const vals of combos(dims)) { const v = build(vals); if (v) { views[keyOf(dims, vals)] = v; if (v.chart) any = true; } }
  if (!any) return null;
  const firstKey = Object.entries(views).find(([, v]) => v.chart)?.[0]!; const defaults: Record<string, string> = {}; firstKey.split('|').forEach((v, i) => { defaults[dims[i]!.id] = v; });
  return { id, dims, defaults, views, emptyText };
}
/** Só oferece as opções que têm dado em pelo menos uma combinação. */
export const pick = <T extends { value: string; label: string }>(all: readonly T[], has: (v: string) => boolean): Array<{ value: string; label: string }> => all.filter(o => has(o.value)).map(o => ({ value: o.value, label: o.label }));

/** Variação sem julgamento de bom ou ruim: só direção e tamanho. `unit` = "p.p." para percentuais, "pontos" para escalas. */
export const deltaText = (cur: number, prev: number, prevYear: number, unit: string, d = 1): { text: string; direction: 'up' | 'down' | 'flat' } => {
  const diff = cur - prev; const flat = Math.abs(diff) < 0.5 * 10 ** -d;
  return { text: flat ? `estável desde ${prevYear}` : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), d)} ${unit} desde ${prevYear}`, direction: flat ? 'flat' : diff > 0 ? 'up' : 'down' };
};
export const bars = (rows: Array<{ label: string; value: number | null; display?: string }>): BarRow[] => rows.filter((r): r is { label: string; value: number; display?: string } => r.value != null).map(r => ({ label: r.label, value: r.value, display: r.display ?? fmt(r.value, 1) }));
export const stat = (label: string, value: string, unit?: string, note?: string | null): StatItem => ({ label, value, ...(unit ? { unit } : {}), note: note ?? null });
export const table = (title: string, columns: string[], rows: Array<[string, Array<string | null>]>, caption?: string): Table | null => rows.length ? { title, columns, rows: rows.map(([label, cells]) => ({ label, cells })), ...(caption ? { caption } : {}) } : null;
export { brlShort, compact, fmt, FLOW_MEASURES, FLOW_STAGES, IDEB_STAGES, INFRA_ITEMS, REDES, SAEB_GRADES, SUBJECTS };
export type { DistBar };
