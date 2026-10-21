/** Aritmética de competência `yyyymm`. Nunca subtrair 1 de uma competência: use ymPrev/ymNext. */
export const isValidYm = (c: number): boolean => Number.isInteger(c) && c >= 190001 && c <= 299912 && c % 100 >= 1 && c % 100 <= 12;
function assertYm(c: number): void { if (!isValidYm(c)) throw new RangeError(`competência inválida: ${c}`); }
export function ymNext(c: number): number { assertYm(c); return c % 100 === 12 ? (Math.floor(c / 100) + 1) * 100 + 1 : c + 1; }
export function ymPrev(c: number): number { assertYm(c); return c % 100 === 1 ? (Math.floor(c / 100) - 1) * 100 + 12 : c - 1; }
export function ymDate(c: number): string { assertYm(c); return `${Math.floor(c / 100)}-${String(c % 100).padStart(2, '0')}-01`; }
export function ymRange(from: number, to: number): number[] { assertYm(from); assertYm(to); const out: number[] = []; for (let c = from; c <= to; c = ymNext(c)) out.push(c); return out; }
