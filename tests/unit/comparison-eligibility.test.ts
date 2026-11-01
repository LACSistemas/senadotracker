import test from 'node:test';
import assert from 'node:assert/strict';
import { assessComparability } from '../../apps/web/lib/comparison/eligibility.ts';

const ok = { sameDefinition: true, sameUnit: true, samePeriod: true, sameUniverse: true, sameMethodology: true, sameScope: true, sameAggregation: true };

test('comparação elegível quando todas as 7 dimensões batem e a coorte é grande o bastante', () => {
  const r = assessComparability({ ...ok, minCohort: 5, cohortSize: 92 });
  assert.equal(r.eligible, true);
  assert.equal(r.reason, null);
});

test('comparação bloqueada quando uma única dimensão diverge — nunca aparece como válida', () => {
  const r = assessComparability({ ...ok, sameUnit: false });
  assert.equal(r.eligible, false);
  assert.match(r.reason!, /unidade/);
});

test('cada dimensão divergente produz um motivo específico, não um texto genérico', () => {
  assert.match(assessComparability({ ...ok, sameDefinition: false }).reason!, /definição/);
  assert.match(assessComparability({ ...ok, samePeriod: false }).reason!, /período/);
  assert.match(assessComparability({ ...ok, sameUniverse: false }).reason!, /universo/);
  assert.match(assessComparability({ ...ok, sameMethodology: false }).reason!, /metodologia/);
  assert.match(assessComparability({ ...ok, sameScope: false }).reason!, /abrangência/);
  assert.match(assessComparability({ ...ok, sameAggregation: false }).reason!, /agregação/);
});

test('coorte pequena demais bloqueia mesmo com todas as 7 dimensões batendo (Roraima: poucos municípios elegíveis)', () => {
  const r = assessComparability({ ...ok, minCohort: 5, cohortSize: 3 });
  assert.equal(r.eligible, false);
  assert.match(r.reason!, /menos de 5/);
});

test('sem minCohort, uma coorte pequena não é bloqueada (comparação que não depende de distribuição)', () => {
  const r = assessComparability({ ...ok, cohortSize: 1 });
  assert.equal(r.eligible, true);
});
