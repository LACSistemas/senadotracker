import test from 'node:test';
import assert from 'node:assert/strict';
import { higherOfferHasTerritory, higherOfferNaturalKey } from '../../apps/collector/src/exec/inep-superior.ts';

test('P11.2 oferta inclui TP_DIMENSAO na identidade', () => {
  const a = higherOfferNaturalKey({ year: 2023, coIes: 1, coCurso: 2, coMunicipio: 0, tpModalidade: 2, tpDimensao: 2 });
  const b = higherOfferNaturalKey({ year: 2023, coIes: 1, coCurso: 2, coMunicipio: 0, tpModalidade: 2, tpDimensao: 3 });
  assert.notEqual(a, b);
});

test('P11.2 não atribui dimensão nacional a município', () => {
  assert.equal(higherOfferHasTerritory(1, 3205309), true);
  assert.equal(higherOfferHasTerritory(3, 3205309), false);
  assert.equal(higherOfferHasTerritory(2, 0), false);
});
