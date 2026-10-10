/**
 * Geometria do hemiciclo (diagrama de assentos de plenário). Puro e determinístico: o servidor calcula, o cliente só desenha.
 * Coordenadas em um semicírculo de raio 100 com o centro em (0,0); y negativo é "para cima".
 * Cadeiras em fileiras concêntricas; cada fileira recebe cadeiras proporcionais ao seu raio, e as cadeiras são
 * ordenadas por ângulo (esquerda → direita) para que cada partido ocupe uma fatia contínua, como num plenário.
 */
export interface Seat { x: number; y: number; party: number; row: number; angle: number }
export interface HemicycleLayout { seats: Seat[]; dotRadius: number; rows: number; outer: number; inner: number; total: number }

export const OUTER_RADIUS = 100;
const INNER_RATIO = 0.3;

/** Número de fileiras para que o espaçamento entre cadeiras da mesma fileira ≈ distância entre fileiras. */
export function rowsFor(total: number): number {
  if (total <= 1) return 1;
  const k = 2 * (1 - INNER_RATIO) / (Math.PI * (1 + INNER_RATIO));
  return Math.max(2, Math.round((1 + Math.sqrt(1 + 4 * k * total)) / 2));
}

/** Maior resto: reparte `total` em partes proporcionais a `weights`, somando exatamente `total`. */
function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0), exact = weights.map(w => total * w / sum), base = exact.map(Math.floor);
  let rest = total - base.reduce((a, b) => a + b, 0);
  exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || b.i - a.i).forEach(({ i }) => { if (rest > 0) { base[i]!++; rest--; } });
  return base;
}

export function layoutHemicycle(counts: number[], options: { rows?: number } = {}): HemicycleLayout {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return { seats: [], dotRadius: 0, rows: 0, outer: OUTER_RADIUS, inner: OUTER_RADIUS * INNER_RATIO, total: 0 };
  const rows = Math.max(1, options.rows ?? rowsFor(total)), inner = OUTER_RADIUS * INNER_RATIO;
  const radii = Array.from({ length: rows }, (_, i) => rows === 1 ? OUTER_RADIUS : inner + (OUTER_RADIUS - inner) * i / (rows - 1));
  const perRow = apportion(total, radii);
  const raw: Array<Omit<Seat, 'party'>> = [];
  perRow.forEach((n, row) => { for (let j = 0; j < n; j++) { const angle = n === 1 ? Math.PI / 2 : Math.PI - j * Math.PI / (n - 1); raw.push({ x: radii[row]! * Math.cos(angle), y: -radii[row]! * Math.sin(angle), row, angle }); } });
  // esquerda → direita; no mesmo ângulo, de dentro para fora
  raw.sort((a, b) => b.angle - a.angle || a.row - b.row);
  const seats: Seat[] = []; let party = 0, left = counts[0]!;
  for (const seat of raw) { while (left === 0 && party < counts.length - 1) left = counts[++party]!; seats.push({ ...seat, party }); left--; }
  const rowGap = rows === 1 ? OUTER_RADIUS : (OUTER_RADIUS - inner) / (rows - 1);
  const arcGap = Math.min(...perRow.map((n, i) => n > 1 ? Math.PI * radii[i]! / (n - 1) : Infinity));
  const dotRadius = Math.min(rowGap, arcGap) * 0.5 * 0.84;
  return { seats, dotRadius, rows, outer: OUTER_RADIUS, inner, total };
}

export interface PartySeats { party: string; seats: number }
export interface PartyComposition { total: number; parties: PartySeats[] }

/** Cadeiras por partido a partir do cadastro em exercício (uma pessoa = uma cadeira). Sem partido → "Sem partido". */
export function summarizeSeats(people: ReadonlyArray<{ party?: string | null }>): PartyComposition {
  const map = new Map<string, number>();
  for (const p of people) { const party = (p.party ?? '').trim() || 'Sem partido'; map.set(party, (map.get(party) ?? 0) + 1); }
  const parties = [...map.entries()].map(([party, seats]) => ({ party, seats })).sort((a, b) => b.seats - a.seats || a.party.localeCompare(b.party, 'pt-BR'));
  return { total: parties.reduce((s, p) => s + p.seats, 0), parties };
}
