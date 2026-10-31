import type { InfrastructureIndicator } from '@senadotracker/db';
import type { BarRow, ComparePoint, IndicatorGroup, StatItem, TerritoryCompare } from './types.ts';
import { CODED_PERIOD_FAMILIES } from './catalog.ts';
import { formatIndicatorValue, indicatorUnitLabel } from './format.ts';

/** Utilitários de montagem: nada aqui recalcula dado oficial, só organiza, nomeia e agrupa. Espelha
 * `lib/wellbeing/build.ts`, duplicado em vez de importado para não acoplar o domínio de Infraestrutura a Bem-estar. */
export const stat = (label: string, value: string, unit?: string, note?: string | null): StatItem => ({ label, value, ...(unit ? { unit } : {}), note: note ?? null });

export const bars = (rows: Array<{ label: string; value: number | null; display?: string; note?: string | null }>): BarRow[] =>
  rows.filter((r): r is { label: string; value: number; display?: string; note?: string | null } => r.value != null)
    .map(r => ({ label: r.label, value: r.value, display: r.display ?? String(r.value), ...(r.note ? { note: r.note } : {}) }));

/** Nota sobre a competência técnica quando a família não publica uma data real de coleta/pesquisa (G0.4): PEMOB,
 * SNISB, ANM, ATLAS_AGUAS, MMGD, ANP e LOGISTICA codificam a competência do pipeline de origem, não o fim de uma
 * pesquisa de campo — nunca ler essa data como "pesquisa encerrada em [mês/ano]". */
export function temporalNote(ind: InfrastructureIndicator): string | null {
  if (!CODED_PERIOD_FAMILIES.has(ind.sourceFamily) || !ind.period) return null;
  return `Competência técnica ${ind.period.slice(0, 7)} (não é uma pesquisa encerrada nesta data).`;
}

export function statFromIndicator(ind: InfrastructureIndicator, label?: string): StatItem {
  const notes = [temporalNote(ind), !ind.comparisonEligible ? 'A fonte não autoriza agregação/comparação automática.' : null].filter((n): n is string => !!n);
  return stat(label ?? ind.title, formatIndicatorValue(ind), indicatorUnitLabel(ind.unit), notes.length ? notes.join(' ') : null);
}

/** Um ponto de comparação a partir de `getInfrastructureIndicatorComparison`: nunca inventa valor quando o
 * backend não elegeu o território (município/UF/Brasil) para agregação. */
export function comparePoint(label: string, raw: { value: number | null; status: string } | null, format: (v: number) => string): ComparePoint {
  if (!raw || raw.value == null) return { label, value: null, display: '—', eligible: false, reason: raw ? 'não aplicável' : 'não disponível' };
  return { label, value: raw.value, display: format(raw.value), eligible: true, reason: null };
}

/** Só município é comparável hoje (o backend computa `comparison` apenas quando o território é kind=4) — por isso
 * esta função nunca é chamada em páginas de UF/Brasil; `territoryCompareFromComparison` retorna `null` quando o
 * próprio território não for elegível, para nunca mostrar uma comparação "a partir do nada". */
export function territoryCompareFromComparison(o: {
  ownLabel: string; stateLabel: string; unit: string; year: string | null; format: (v: number) => string; note: string;
  municipality: { value: number | null; status: string } | null; uf: { value: number | null; status: string } | null; brazil: { value: number | null; status: string } | null;
}): TerritoryCompare | null {
  const own = comparePoint(o.ownLabel, o.municipality, o.format);
  if (!own.eligible) return null;
  const state = comparePoint(o.stateLabel, o.uf, o.format);
  const brazil = comparePoint('Brasil', o.brazil, o.format);
  return { unit: o.unit, year: o.year, own, state, brazil, restrictions: [o.note] };
}

/** Um indicador por grupo, na ordem em que os códigos aparecem em `codes`; indicadores sem valor são omitidos do
 * grupo (ausência nunca é mostrada como zero), mas o grupo em si permanece se tiver ao menos um valor. */
export function group(label: string, indicators: InfrastructureIndicator[], codes: readonly string[], note?: string | null): IndicatorGroup | null {
  const byCode = new Map(indicators.map(i => [i.code, i]));
  const stats = codes.map(c => byCode.get(c)).filter((i): i is InfrastructureIndicator => !!i && i.value != null).map(i => statFromIndicator(i));
  if (!stats.length) return null;
  return { label, stats, ...(note ? { note } : {}) };
}
