import test from 'node:test';
import assert from 'node:assert/strict';
import { applySnapshot, checkIntegrity, GapError, isValidYm, rebuildFrom, series, stateAt, ymDate, ymNext, ymPrev, ymRange } from '../../packages/db/src/exec/index.ts';

const snap = (o: Record<string, unknown>) => new Map(Object.entries(o));

test('aritmética de competência: dezembro → janeiro e janeiro → dezembro', () => {
  assert.equal(ymNext(202412), 202501); assert.equal(ymPrev(202501), 202412); assert.equal(ymPrev(202412), 202411); assert.equal(ymNext(202411), 202412);
  assert.equal(202501 - 1, 202500, 'o erro do plano anterior');
  assert.equal(isValidYm(202500), false); assert.equal(isValidYm(202513), false); assert.equal(isValidYm(202501), true);
  assert.throws(() => ymPrev(202500), RangeError); assert.throws(() => ymNext(202513), RangeError);
  assert.equal(ymDate(202501), '2025-01-01');
  assert.deepEqual(ymRange(202411, 202502), [202411, 202412, 202501, 202502]);
});

test('T1 dez/2024 → jan/2025: intervalo semiaberto fecha em 202501 e dezembro continua com o valor antigo', () => {
  const s = series(new Map([[202411, snap({ H1: [10, 6] })], [202412, snap({ H1: [10, 6] })], [202501, snap({ H1: [12, 7] })]]));
  checkIntegrity(s);
  assert.deepEqual(s.map(i => [i.vf, i.vt]), [[202411, 202501], [202501, null]]);
  assert.deepEqual(stateAt(s, 202412).get('H1'), [10, 6]); assert.deepEqual(stateAt(s, 202501).get('H1'), [12, 7]);
});

test('T2 mudança de leitos numa competência não duplica competências iguais', () => {
  const s = series(new Map([[202301, snap({ H1: [10, 6] })], [202302, snap({ H1: [10, 7] })], [202303, snap({ H1: [10, 7] })]]));
  assert.equal(s.length, 2); assert.deepEqual(stateAt(s, 202303).get('H1'), [10, 7]);
});

test('T3/T4 desaparecimento e reaparecimento (e lacuna recusada)', () => {
  const m = new Map<number, Map<string, unknown>>([[202306, snap({ H1: [10, 6], H2: [5, 5] })]]);
  for (const c of [202307, 202308, 202309, 202310, 202311, 202312]) m.set(c, snap({ H2: [5, 5] }));
  m.set(202401, snap({ H1: [8, 4], H2: [5, 5] }));
  const s = series(m); checkIntegrity(s);
  assert.equal(stateAt(s, 202307).has('H1'), false); assert.equal(stateAt(s, 202312).has('H1'), false);
  assert.deepEqual(stateAt(s, 202401).get('H1'), [8, 4]);
  assert.equal(s.filter(i => i.key === 'H1').length, 2, 'dois intervalos, sem preencher o buraco');
  assert.throws(() => applySnapshot(s, 202403, snap({ H2: [5, 5] }), 202401), GapError);
});

test('T5 correção retroativa de uma competência antiga é igual a reconstruir do zero', () => {
  const base = new Map<number, Map<string, unknown>>([[202201, snap({ H1: [10, 6] })], [202202, snap({ H1: [10, 6] })], [202203, snap({ H1: [10, 6] })], [202204, snap({ H1: [10, 6] })], [202205, snap({ H1: [12, 8] })], [202206, snap({ H1: [12, 8] })]]);
  const original = series(base);
  const corrected = new Map(base); corrected.set(202203, snap({ H1: [10, 5] }));
  const fix = rebuildFrom(original, 202203, new Map([...corrected].filter(([c]) => c >= 202203)), 202202);
  checkIntegrity(fix);
  assert.deepEqual(stateAt(fix, 202202).get('H1'), [10, 6]); assert.deepEqual(stateAt(fix, 202203).get('H1'), [10, 5]);
  assert.deepEqual(stateAt(fix, 202204).get('H1'), [10, 6]); assert.deepEqual(stateAt(fix, 202205).get('H1'), [12, 8]);
  const norm = (a: ReturnType<typeof series>) => a.map(i => [i.key, i.vf, i.vt, i.val]).sort((x, y) => String(x).localeCompare(String(y)));
  assert.deepEqual(norm(fix), norm(series(corrected)));
});
