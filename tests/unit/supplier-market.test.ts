import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, publishedSupplierExplorer, startRun } from '@senadotracker/db';

test('explorador separa universos e não expõe CPF', () => {
  const db=openDatabase(':memory:');
  try {
    const run=startRun(db,'civica',Date.parse('2026-09-24T00:00:00Z'));
    db.prepare("INSERT INTO supplier_aggregate_revisions VALUES (?,?,'published','{}')").run(run,'2026-09-24T00:00:00Z');
    db.prepare('INSERT INTO active_supplier_aggregate_revision VALUES (1,?)').run(run);
    db.prepare("INSERT INTO suppliers VALUES ('both','Fornecedor Ambos','company','confirmed','2026-01-01','2026-01-01'),('institutional','Fornecedor Institucional','company','confirmed','2026-01-01','2026-01-01')").run();
    db.prepare("INSERT INTO supplier_identifiers VALUES ('cnpj','both','cnpj','12.345.678/0001-95','12345678000195','BR',0,'valid','v1',NULL,NULL,'fixture','cnpj','2026-01-01'),('cpf','institutional','cpf','123.456.789-09','12345678909','BR',0,'valid','v1',NULL,NULL,'fixture','cpf','2026-01-01')").run();
    db.prepare("INSERT INTO supplier_names VALUES ('name-both','both','Fornecedor Ambos','fornecedor ambos',1,NULL,NULL,'fixture','name-both','2026-01-01','2026-01-01'),('name-inst','institutional','Fornecedor Institucional','fornecedor institucional',1,NULL,NULL,'fixture','name-inst','2026-01-01','2026-01-01')").run();
    db.prepare("INSERT INTO supplier_roles VALUES ('both','PARLIAMENTARY_EXPENSE','CAMARA','2026-01-01','2026-01-01','fixture','r1'),('both','INSTITUTIONAL_PAYMENT','CAMARA','2026-01-01','2026-01-01','fixture','r2'),('institutional','INSTITUTIONAL_PAYMENT','SENADO','2026-01-01','2026-01-01','fixture','r3')").run();
    db.prepare('INSERT INTO supplier_global_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'both',2026,10000,2,2,2,2,1,5000,1,1,1,'2026-01-01','2026-02-01');
    db.prepare('INSERT INTO supplier_global_yearly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(run,'institutional',2026,null,null,null,null,null,null,7000,1,1,1,null,null);
    const result=publishedSupplierExplorer(db,{year:2026,sort:'name',direction:'asc'});
    assert.equal(result.total,2);
    assert.equal(result.items[0]?.activity,'both');
    assert.deepEqual(result.items[0]?.parliamentary,{netCents:10000,records:2,parliamentarians:2,ufs:2,parties:2});
    assert.deepEqual(result.items[0]?.institutional,{paidCents:5000,contracts:1,commitments:1});
    assert.equal(result.items[0]?.publicDocument,'12345678000195');
    assert.equal(result.items[1]?.activity,'institutional');
    assert.equal(result.items[1]?.publicDocument,null);
  } finally { db.close(); }
});
