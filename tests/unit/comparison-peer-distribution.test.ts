import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPeerRuler } from '../../apps/web/lib/comparison/peer-distribution.ts';

const opts = { unit: 'por 100 mil hab.', digits: 1, cohort: 'municípios de Rio de Janeiro', year: '2025' };

test('município com valor elegível e coorte grande recebe uma régua real (p25/p50/p75/n)', () => {
  const values = new Map(Array.from({ length: 92 }, (_, i) => [i + 1, i + 1] as const)); // 1..92
  const r = buildPeerRuler(50, values, opts);
  assert.equal(r.reason, null);
  assert.ok(r.ruler);
  assert.equal(r.ruler!.own, 50);
  assert.equal(r.ruler!.n, 92);
  assert.ok(r.ruler!.p25 < r.ruler!.p50 && r.ruler!.p50 < r.ruler!.p75, 'p25 < p50 < p75');
});

test('município sem valor no mapa (suprimido/sem dado) nunca produz uma régua inventada', () => {
  const values = new Map([[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]]);
  const r = buildPeerRuler(999, values, opts);
  assert.equal(r.ruler, null);
  assert.match(r.reason!, /sem valor elegível/);
});

test('coorte pequena demais (ex. Roraima parcial) bloqueia a régua com motivo explícito, não a esconde', () => {
  const values = new Map([[1, 10], [2, 20], [3, 30]]); // 3 municípios, abaixo do minCohort padrão (5)
  const r = buildPeerRuler(1, values, opts);
  assert.equal(r.ruler, null);
  assert.match(r.reason!, /menos de 5/);
});

test('minCohort customizado é respeitado (coorte de 3 passa quando o mínimo exigido é 3)', () => {
  const values = new Map([[1, 10], [2, 20], [3, 30]]);
  const r = buildPeerRuler(1, values, { ...opts, minCohort: 3 });
  assert.ok(r.ruler);
  assert.equal(r.ruler!.n, 3);
});
