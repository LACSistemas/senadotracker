import { isValidYm, ymNext } from './ym.ts';

/** Intervalo semiaberto [vf, vt); vt === null significa vigente na última competência publicada. */
export interface Interval<V> { key: string; vf: number; vt: number | null; val: V }
export class GapError extends Error { constructor(message: string) { super(message); this.name = 'GapError'; } }

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Aplica o snapshot da competência `c`. `lastPublished` é a última competência publicada da UF (ou null na primeira). */
export function applySnapshot<V>(ints: readonly Interval<V>[], c: number, snap: ReadonlyMap<string, V>, lastPublished: number | null): Interval<V>[] {
  if (!isValidYm(c)) throw new RangeError(`competência inválida: ${c}`);
  if (lastPublished !== null && c !== ymNext(lastPublished)) throw new GapError(`competência ${c} não é a seguinte a ${lastPublished} (esperada ${ymNext(lastPublished)})`);
  const out = ints.map(i => ({ ...i }));
  const open = new Map(out.filter(i => i.vt === null).map(i => [i.key, i]));
  for (const [key, i] of open) {
    const now = snap.get(key);
    if (now === undefined) i.vt = c;
    else if (!same(i.val, now)) { i.vt = c; out.push({ key, vf: c, vt: null, val: now }); }
  }
  for (const [key, val] of snap) if (!open.has(key)) out.push({ key, vf: c, vt: null, val });
  return out;
}

export function stateAt<V>(ints: readonly Interval<V>[], c: number): Map<string, V> {
  const m = new Map<string, V>();
  for (const i of ints) if (i.vf <= c && (i.vt === null || i.vt > c)) m.set(i.key, i.val);
  return m;
}

export function checkIntegrity<V>(ints: readonly Interval<V>[]): void {
  const by = new Map<string, Interval<V>[]>();
  for (const i of ints) {
    if (i.vt !== null && i.vt <= i.vf) throw new Error(`intervalo invertido ${i.key} [${i.vf}, ${i.vt})`);
    (by.get(i.key) ?? by.set(i.key, []).get(i.key)!).push(i);
  }
  for (const [key, list] of by) {
    list.sort((a, b) => a.vf - b.vf);
    if (list.filter(i => i.vt === null).length > 1) throw new Error(`mais de um intervalo aberto: ${key}`);
    for (let n = 1; n < list.length; n++) { const a = list[n - 1]!, b = list[n]!; if (a.vt === null || a.vt > b.vf) throw new Error(`sobreposição em ${key}`); }
  }
}

export function series<V>(snaps: ReadonlyMap<number, ReadonlyMap<string, V>>, startAfter: number | null = null): Interval<V>[] {
  let ints: Interval<V>[] = []; let last = startAfter;
  for (const c of [...snaps.keys()].sort((a, b) => a - b)) { ints = applySnapshot(ints, c, snaps.get(c)!, last); last = c; }
  return ints;
}

/** Correção retroativa: refaz os intervalos de `k` em diante com os snapshots fornecidos (k … última). */
export function rebuildFrom<V>(ints: readonly Interval<V>[], k: number, snaps: ReadonlyMap<number, ReadonlyMap<string, V>>, lastPublishedBeforeK: number | null): Interval<V>[] {
  let base: Interval<V>[] = [];
  for (const i of ints) {
    if (i.vf >= k) continue;
    base.push({ ...i, vt: i.vt !== null && i.vt >= k ? null : i.vt });
  }
  let last = lastPublishedBeforeK;
  for (const c of [...snaps.keys()].sort((a, b) => a - b)) { if (c < k) throw new RangeError(`snapshot ${c} anterior a ${k}`); base = applySnapshot(base, c, snaps.get(c)!, last); last = c; }
  return base;
}
