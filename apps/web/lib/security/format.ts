/** Formatação pt-BR e frases de leitura da experiência de Segurança. Sem `null`, `NaN` nem zero artificial: ausência tem sempre um texto próprio. */
const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const cache = new Map<number, Intl.NumberFormat>();
export const fmt = (v: number, d = 0): string => { let f = cache.get(d); if (!f) { f = nf(d); cache.set(d, f); } return f.format(v); };
export const fmtOrDash = (v: number | null | undefined, d = 0): string => v == null || !Number.isFinite(v) ? '—' : fmt(v, d);
const compactNf = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export const compact = (v: number): string => Math.abs(v) >= 10000 ? compactNf.format(v) : fmt(v, v % 1 ? 1 : 0);
export const pct = (ratio: number, d = 0): string => `${fmt(ratio * 100, d)}%`;
export const signedPct = (ratio: number, d = 0): string => `${ratio > 0 ? '+' : ratio < 0 ? '−' : ''}${fmt(Math.abs(ratio) * 100, d)}%`;
export const brl = (reais: number, d = 0): string => `R$ ${fmt(reais, d)}`;
/** R$ legível sem casas inúteis: mil, milhões, bilhões. */
export function brlShort(reais: number): string {
  const a = Math.abs(reais);
  if (a >= 1e9) return `R$ ${fmt(reais / 1e9, 1)} bi`; if (a >= 1e6) return `R$ ${fmt(reais / 1e6, 1)} mi`; if (a >= 1e3) return `R$ ${fmt(reais / 1e3, 0)} mil`; return `R$ ${fmt(reais, 0)}`;
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "2026-03" → "mar/2026"; "2025" → "2025". */
export const periodLabel = (t: string): string => t.length === 4 ? t : `${MONTHS[Number(t.slice(5, 7)) - 1]}/${t.slice(0, 4)}`;
export const periodLong = (t: string): string => t.length === 4 ? t : `${MONTHS_LONG[Number(t.slice(5, 7)) - 1]} de ${t.slice(0, 4)}`;
export const yearOf = (t: string): number => Number(t.slice(0, 4));
/** Variação relativa entre dois valores; null quando a base é zero ou ausente (nunca "infinito"). */
export function changeRatio(from: number | null, to: number | null): number | null { if (from == null || to == null || from === 0) return null; return (to - from) / Math.abs(from); }
export const directionOf = (ratio: number | null, flat = 0.03): 'up' | 'down' | 'flat' => ratio == null || Math.abs(ratio) < flat ? 'flat' : ratio > 0 ? 'up' : 'down';
export const plural = (n: number, one: string, many: string): string => `${fmt(n)} ${n === 1 ? one : many}`;
