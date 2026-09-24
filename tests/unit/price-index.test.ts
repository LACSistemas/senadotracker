import test from 'node:test';
import assert from 'node:assert/strict';
import { indexScale, openDatabase, publishPriceIndex, publishedDeflator, publishedPriceIndex, startRun } from '@senadotracker/db';
import { parsePriceIndex } from '../../apps/collector/src/price-index.ts';

function seed(points:{referenceMonth:string;indexScaled:number}[]){
  const db=openDatabase(':memory:'),runId=startRun(db,'ibge');
  db.prepare("INSERT INTO raw_objects VALUES ('raw-ibge',?,?,'2026-01-05',200,'application/json',?,'raw/ibge',0)").run(runId,'https://example.invalid','0'.repeat(64));
  publishPriceIndex(db,runId,'ipca','https://example.invalid','Série de teste.','available',points,'raw-ibge');
  return db;
}
const scaled=(value:number)=>Math.round(value*indexScale);

test('deflator é o quociente dos números-índice dos dois meses',()=>{
  const db=seed([{referenceMonth:'2018-10',indexScaled:scaled(5103.69)},{referenceMonth:'2022-10',indexScaled:scaled(6407.93)}]);
  try{
    const deflator=publishedDeflator(db,'ipca','2018-10','2022-10')!;
    assert.ok(Math.abs(deflator.factor-6407.93/5103.69)<1e-9);
    assert.equal(deflator.coverage.source,'ibge');
    // Corrigir 100 reais de 2018-10 dá ~125,56 em reais de 2022-10.
    assert.equal(Math.round(10_000*deflator.factor),12_555);
  } finally { db.close(); }
});

test('mês ausente não é estimado: a série nunca é completada',()=>{
  const db=seed([{referenceMonth:'2022-10',indexScaled:scaled(6407.93)}]);
  try{
    assert.equal(publishedDeflator(db,'ipca','2018-10','2022-10'),null);
    assert.equal(publishedPriceIndex(db,'ipca','2018-10'),null);
    // Nem cai no mês mais próximo nem no mais recente publicado.
    assert.equal(publishedPriceIndex(db,'ipca','2022-09'),null);
    assert.equal(publishedPriceIndex(db,'ipca','2022-10')?.indexScaled,scaled(6407.93));
    assert.equal(publishedPriceIndex(db,'igpm','2022-10'),null);
    assert.equal(publishedPriceIndex(db,'ipca','2022-13'),null);
  } finally { db.close(); }
});

test('publicação rejeita lote inválido em vez de gravar dado ruim',()=>{
  const db=openDatabase(':memory:'),runId=startRun(db,'ibge');
  db.prepare("INSERT INTO raw_objects VALUES ('raw-ibge',?,?,'2026-01-05',200,'application/json',?,'raw/ibge',0)").run(runId,'https://example.invalid','0'.repeat(64));
  try{
    const publish=(points:{referenceMonth:string;indexScaled:number}[])=>publishPriceIndex(db,runId,'ipca','https://example.invalid','n','available',points,'raw-ibge');
    assert.throws(()=>publish([]),/vazio/);
    assert.throws(()=>publish([{referenceMonth:'2022-13',indexScaled:100}]),/Mês de referência inválido/);
    assert.throws(()=>publish([{referenceMonth:'2022-10',indexScaled:0}]),/Número-índice inválido/);
    assert.throws(()=>publish([{referenceMonth:'2022-10',indexScaled:1},{referenceMonth:'2022-10',indexScaled:2}]),/duplicado/);
  } finally { db.close(); }
});

test('o parser do SIDRA descarta período e valor não numéricos',()=>{
  const payload=[{resultados:[{series:[{serie:{'201810':'5103.69','202210':'6407,93','202211':'...','202212':'-','20221':'99','abc':'1'}}]}]}];
  const points=parsePriceIndex(new TextEncoder().encode(JSON.stringify(payload)));
  assert.deepEqual(points.map(point=>point.referenceMonth),['2018-10','2022-10']);
  assert.equal(points[0]!.indexScaled,scaled(5103.69));
  // Vírgula decimal do IBGE é aceita; "...", "-" e períodos malformados saem sem virar zero.
  assert.equal(points[1]!.indexScaled,scaled(6407.93));
  assert.throws(()=>parsePriceIndex(new TextEncoder().encode('[]')),/sem variável/);
  assert.throws(()=>parsePriceIndex(new TextEncoder().encode(JSON.stringify([{resultados:[]}]))),/Nenhum número-índice/);
});
