import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEM_MIN_CELL, isValidEssay, isValidSubjectScore, reconcileEnemNational, suppressCell } from '../../packages/db/src/exec/index.ts';

test('Enem: corte de supressão é o mesmo que o Inep usa para mascarar CO_ESCOLA (n < 10)', () => {
  assert.equal(ENEM_MIN_CELL, 10);
  assert.equal(suppressCell(9), true); assert.equal(suppressCell(10), false); assert.equal(suppressCell(0), true);
});

test('Enem: nota de disciplina só é válida com presença=1 e nota numérica não negativa', () => {
  assert.equal(isValidSubjectScore(1, 614.0), true);
  assert.equal(isValidSubjectScore(0, 614.0), false, 'ausente não conta mesmo com nota presente');
  assert.equal(isValidSubjectScore(1, null), false);
  assert.equal(isValidSubjectScore(1, -1), false, 'nota negativa não é válida');
  assert.equal(isValidSubjectScore(2, 500), false, 'eliminado (2) não é presença válida');
});

test('Enem: redação válida é TP_STATUS_REDACAO=1 ("sem problemas"), não "nota presente"', () => {
  assert.equal(isValidEssay(1), true); assert.equal(isValidEssay(2), false); assert.equal(isValidEssay(null), false);
});

test('Enem: reconciliação nacional passa só quando os quatro totais batem exatamente com a Sinopse', () => {
  const ok = reconcileEnemNational({ edition: 2023, registrants: 3_933_955, allFourPresent: 2_678_264, mathValid: 2_692_427, essayValid: 2_704_814,
    sinopseRegistrants: 3_933_955, sinopseAllFourPresent: 2_678_264, sinopseMathValid: 2_692_427, sinopseEssayValid: 2_704_814 });
  assert.equal(ok.reconciled, true);

  const off = reconcileEnemNational({ edition: 2023, registrants: 3_933_954, allFourPresent: 2_678_264, mathValid: 2_692_427, essayValid: 2_704_814,
    sinopseRegistrants: 3_933_955, sinopseAllFourPresent: 2_678_264, sinopseMathValid: 2_692_427, sinopseEssayValid: 2_704_814 });
  assert.equal(off.reconciled, false);
  assert.match(off.note, /inscritos diff -1/);
});
