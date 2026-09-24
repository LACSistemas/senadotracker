import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, publishedMinimumWage, publishedNormativeValue, publishedParliamentarySubsidy } from '@senadotracker/db';

test('valor normativo respeita a vigência e nunca cai no mais recente',()=>{
  const db=openDatabase(':memory:');
  try{
    // Antes da primeira vigência não há valor: a série não é completada para trás nem para frente.
    assert.equal(publishedMinimumWage(db,'2022-12-31'),null);
    assert.equal(publishedMinimumWage(db,'2023-01-01')?.valueCents,130200);
    assert.equal(publishedMinimumWage(db,'2023-04-30')?.valueCents,130200);
    assert.equal(publishedMinimumWage(db,'2023-05-01')?.valueCents,132000);
    assert.equal(publishedMinimumWage(db,'2024-01-01')?.valueCents,141200);
    assert.equal(publishedMinimumWage(db,'2025-06-15')?.valueCents,151800);
    assert.equal(publishedMinimumWage(db,'2026-09-23')?.valueCents,162100);
    // Cada período cita o ato que o fixou, com URL oficial.
    const current=publishedMinimumWage(db,'2026-09-23')!;
    assert.match(current.legalBasis,/Decreto nº 12\.797/);
    assert.match(current.officialUrl,/^https:\/\/www\.planalto\.gov\.br\//);
    assert.equal(current.unit,'month');
    assert.equal(current.validTo,null);
  } finally { db.close(); }
});

test('kind e applies_to desconhecidos devolvem null em vez de outro valor',()=>{
  const db=openDatabase(':memory:');
  try{
    assert.equal(publishedNormativeValue(db,'minimum_wage','congress','2026-09-23'),null);
    assert.equal(publishedNormativeValue(db,'inexistente','brasil','2026-09-23'),null);
    assert.equal(publishedNormativeValue(db,'minimum_wage','brasil','2026-09-23')?.valueCents,162100);
  } finally { db.close(); }
});

test('o subsídio parlamentar mantém o comportamento anterior',()=>{
  const db=openDatabase(':memory:');
  try{
    // Guarda de regressão: a função virou delegação, mas os sete call sites dependem deste contrato.
    assert.equal(publishedParliamentarySubsidy(db,'2022-12-31'),null);
    assert.equal(publishedParliamentarySubsidy(db,'2023-01-01')?.valueCents,3929332);
    assert.equal(publishedParliamentarySubsidy(db,'2026-09-23')?.valueCents,4636619);
    const value=publishedParliamentarySubsidy(db,'2025-06-01')!;
    assert.deepEqual(Object.keys(value).sort(),['legalBasis','note','officialUrl','publishedAt','unit','validFrom','validTo','valueCents']);
  } finally { db.close(); }
});
