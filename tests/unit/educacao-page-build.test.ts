import assert from 'node:assert/strict';
import test from 'node:test';
import { chart, combos, compareSeries, deltaText, explorer, lastOf, prevOf, pt } from '../../apps/web/lib/education/build.ts';
import type { EduScope } from '../../apps/web/lib/education/types.ts';

const muni: EduScope = { kind: 'municipio', entityId: 3205309, ufCode: 32, uf: 'ES', name: 'Vitória', stateName: 'Espírito Santo', population: null };

test('série bienal: pontos só nas edições, linha com stepYears; vazio vira "sem dado", nunca zero', () => {
  const s = compareSeries(muni, { own: [{ year: 2021, value: 213 }, { year: 2023, value: 227.6 }, { year: 2025, value: null }], uf: [{ year: 2023, value: 232 }], br: [{ year: 2023, value: 225 }] });
  assert.deepEqual(s.map(x => x.key), ['own', 'uf', 'br']); assert.equal(s[0]!.points[2]!.state, 'absent'); assert.equal(s[0]!.points[2]!.v, null);
  const c = chart({ id: 't', title: 't', unit: 'pontos', digits: 1, stepYears: 2, zoom: true, series: s, notes: [], source: 's', coverage: 'x' })!;
  assert.equal(c.stepYears, 2); assert.equal(c.zoom, true); assert.equal(c.coverage, '2021–2023 · x');
  assert.equal(chart({ id: 't', title: 't', unit: 'u', digits: 0, series: [{ key: 'a', label: 'a', points: [pt(2020, null)] }], notes: [], source: '', coverage: '' }), null, 'sem nenhum valor não há gráfico');
});
test('UF não duplica a linha de estado; município mostra território, estado e Brasil', () => {
  const uf: EduScope = { ...muni, kind: 'uf', name: 'Espírito Santo' };
  assert.deepEqual(compareSeries(uf, { own: [{ year: 2023, value: 1 }], uf: [{ year: 2023, value: 2 }], br: [{ year: 2023, value: 3 }] }).map(x => x.key), ['own', 'br']);
});
test('explorador: só combinações com dado entram; o padrão aponta para uma vista com gráfico', () => {
  const dims = [{ id: 'a', label: 'A', options: [{ value: '1', label: 'um' }, { value: '2', label: 'dois' }] }, { id: 'b', label: 'B', options: [{ value: 'x', label: 'x' }] }];
  assert.equal(combos(dims).length, 2);
  const mk = (v: number | null) => chart({ id: 'c', title: 'c', unit: 'u', digits: 0, series: [{ key: 'o', label: 'o', points: [pt(2020, v)] }], notes: [], source: '', coverage: '' });
  const e = explorer('e', dims, ([a]) => a === '2' ? { chart: mk(5), headline: 'h', note: null } : { chart: mk(null), headline: null, note: null }, 'vazio')!;
  assert.equal(e.defaults.a, '2'); assert.equal(e.views['1|x']!.chart, null);
  assert.equal(explorer('e', dims, () => ({ chart: mk(null), headline: null, note: null }), 'vazio'), null, 'sem nenhuma vista com dado não há explorador');
});
test('variação descreve direção e tamanho, sem julgar', () => {
  assert.deepEqual(deltaText(0.3, 0.4, 2024, 'p.p.', 1), { text: '−0,1 p.p. desde 2024', direction: 'down' });
  assert.equal(deltaText(6.4, 6.4, 2023, 'pontos', 1).direction, 'flat');
  const rows = [{ year: 2019, value: 1 }, { year: 2021, value: null }, { year: 2023, value: 3 }];
  assert.equal(lastOf(rows)!.year, 2023); assert.equal(prevOf(rows, lastOf(rows))!.year, 2019);
});
