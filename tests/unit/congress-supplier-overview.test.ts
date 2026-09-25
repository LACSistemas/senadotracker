import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, publishedCongressSupplierOverview, publishedCongressSupplierCategoryMix, startRun } from '@senadotracker/db';

test('hub unificado soma parlamentar+institucional sem deduplicar por valor e rankeia por dimensão', () => {
  const db=openDatabase(':memory:');
  try {
    const run=startRun(db,'civica',Date.parse('2026-09-24T00:00:00Z'));
    db.prepare("INSERT INTO supplier_aggregate_revisions VALUES (?,?,'published','{}')").run(run,'2026-09-24T00:00:00Z');
    db.prepare('INSERT INTO active_supplier_aggregate_revision VALUES (1,?)').run(run);
    db.prepare("INSERT INTO suppliers VALUES ('both','Fornecedor Ambos','company','confirmed','2026-01-01','2026-01-01'),('parl','Fornecedor Parlamentar','company','confirmed','2026-01-01','2026-01-01'),('inst','Fornecedor Institucional','company','confirmed','2026-01-01','2026-01-01')").run();
    db.prepare('INSERT INTO supplier_global_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'both',2026,10000,1,1,1,1,1,5000,1,1,1,'2026-01-01','2026-01-01');
    db.prepare('INSERT INTO supplier_global_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'parl',2026,20000,1,1,1,1,1,null,null,null,null,null,null);
    db.prepare('INSERT INTO supplier_global_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'inst',2026,null,null,null,null,null,null,30000,1,1,1,null,null);
    db.prepare('INSERT INTO supplier_global_house_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'both',2026,'CAMARA',10000,1,1,1,1,5000,1,1,'2026-01-01','2026-01-01');
    db.prepare('INSERT INTO supplier_global_house_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'parl',2026,'SENADO',20000,1,1,1,1,null,null,null,null,null);
    db.prepare('INSERT INTO supplier_global_house_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'inst',2026,'CAMARA',null,null,null,null,null,30000,1,1,null,null);
    db.prepare('INSERT INTO supplier_parliamentary_categories VALUES (?,?,?,?,?,?,?,?)').run(run,'both',2026,'CAMARA','Telefonia',7000,2,1);
    db.prepare('INSERT INTO supplier_parliamentary_categories VALUES (?,?,?,?,?,?,?,?)').run(run,'parl',2026,'SENADO','Passagens',23000,2,1);
    db.prepare('INSERT INTO supplier_parliamentary_monthly VALUES (?,?,?,?,?,?,?,?)').run(run,'both',2026,3,'CAMARA',10000,2,1);
    db.prepare('INSERT INTO supplier_parliamentary_monthly VALUES (?,?,?,?,?,?,?,?)').run(run,'parl',2026,5,'SENADO',20000,2,1);

    const result=publishedCongressSupplierOverview(db,{year:2026,house:'all'});

    assert.equal(result.parliamentaryCents,30000);
    assert.equal(result.institutionalCents,35000);
    assert.equal(result.totalObservedCents,65000);
    assert.equal(result.suppliersLinked,3);
    assert.equal(result.suppliersParliamentary,2);
    assert.equal(result.suppliersInstitutional,2);

    assert.equal(result.topSupplier?.supplierId,'inst');
    assert.equal(result.topFiveCents,65000);
    assert.equal(result.topFiveShare,1);

    assert.equal(result.topSupplierParliamentary?.supplierId,'parl');
    assert.equal(result.topFiveParliamentaryCents,30000);
    assert.equal(result.topFiveParliamentaryShare,1);

    assert.equal(result.topSupplierInstitutional?.supplierId,'inst');
    assert.equal(result.topFiveInstitutionalCents,35000);
    assert.equal(result.topFiveInstitutionalShare,1);

    const camara=result.houseBreakdown.find(row=>row.institution==='CAMARA'), senado=result.houseBreakdown.find(row=>row.institution==='SENADO');
    assert.deepEqual(camara,{institution:'CAMARA',parliamentary:10000,institutional:35000,total:45000,share:45000/65000});
    assert.deepEqual(senado,{institution:'SENADO',parliamentary:20000,institutional:0,total:20000,share:20000/65000});

    assert.deepEqual(result.monthly,[
      {institution:'CAMARA',month:3,parliamentary:10000,institutional:0,year:2026,total:10000},
      {institution:'SENADO',month:5,parliamentary:20000,institutional:0,year:2026,total:20000},
    ]);

  } finally { db.close(); }
});

test('mix de categorias unifica parlamentar e institucional sem fundir Casas, reconciliando top+outros+sem-classificacao com o total', () => {
  const db=openDatabase(':memory:');
  try {
    const run=startRun(db,'civica',Date.parse('2026-09-24T00:00:00Z'));
    db.prepare("INSERT INTO supplier_aggregate_revisions VALUES (?,?,'published','{}')").run(run,'2026-09-24T00:00:00Z');
    db.prepare('INSERT INTO active_supplier_aggregate_revision VALUES (1,?)').run(run);
    db.prepare("INSERT INTO suppliers VALUES ('both','Fornecedor Ambos','company','confirmed','2026-01-01','2026-01-01')").run();
    // Mesma categoria ("Telefonia") publicada por Câmara e Senado: devem permanecer linhas distintas, nunca fundidas.
    db.prepare('INSERT INTO supplier_parliamentary_categories VALUES (?,?,?,?,?,?,?,?)').run(run,'both',2026,'CAMARA','Telefonia',7000,2,1);
    db.prepare('INSERT INTO supplier_parliamentary_categories VALUES (?,?,?,?,?,?,?,?)').run(run,'both',2026,'SENADO','Telefonia',23000,2,1);

    const result=publishedCongressSupplierCategoryMix(db,{year:2026,house:'all'});

    assert.equal(result.top.length,2);
    assert.deepEqual(result.top[0],{universe:'parlamentar',institution:'SENADO',category:'Telefonia',value:23000});
    assert.deepEqual(result.top[1],{universe:'parlamentar',institution:'CAMARA',category:'Telefonia',value:7000});
    assert.equal(result.othersCents,0);
    assert.deepEqual(result.unclassified,[]);
    assert.equal(result.unclassifiedCents,0);
    assert.equal(result.totalCents,30000);
    // Regra de consistência: top + outros + sem-classificação reconcilia exatamente com o total.
    assert.equal(result.top.reduce((sum,row)=>sum+row.value,0)+result.othersCents+result.unclassifiedCents,result.totalCents);
  } finally { db.close(); }
});

test('filtro por Casa restringe totais e ranking à Casa escolhida', () => {
  const db=openDatabase(':memory:');
  try {
    const run=startRun(db,'civica',Date.parse('2026-09-24T00:00:00Z'));
    db.prepare("INSERT INTO supplier_aggregate_revisions VALUES (?,?,'published','{}')").run(run,'2026-09-24T00:00:00Z');
    db.prepare('INSERT INTO active_supplier_aggregate_revision VALUES (1,?)').run(run);
    db.prepare("INSERT INTO suppliers VALUES ('both','Fornecedor Ambos','company','confirmed','2026-01-01','2026-01-01'),('parl','Fornecedor Parlamentar','company','confirmed','2026-01-01','2026-01-01')").run();
    db.prepare('INSERT INTO supplier_global_house_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'both',2026,'CAMARA',10000,1,1,1,1,5000,1,1,'2026-01-01','2026-01-01');
    db.prepare('INSERT INTO supplier_global_house_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'parl',2026,'SENADO',20000,1,1,1,1,null,null,null,null,null);

    const result=publishedCongressSupplierOverview(db,{year:2026,house:'CAMARA'});
    assert.equal(result.parliamentaryCents,10000);
    assert.equal(result.institutionalCents,5000);
    assert.equal(result.suppliersLinked,1);
    assert.equal(result.topSupplier?.supplierId,'both');
    // houseBreakdown sempre reflete as duas Casas, independentemente do filtro.
    assert.equal(result.houseBreakdown.length,2);
  } finally { db.close(); }
});
