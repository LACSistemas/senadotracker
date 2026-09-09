import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, publishedStateComparison, publishedStateRepresentation } from '@senadotracker/db';
import type { Profile, Source } from '@senadotracker/domain';

function seed() {
  const db=openDatabase(':memory:');
  for (const source of ['senado','camara'] as Source[]) {
    const batch=`roster-${source}`;
    db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-09-09','published','test',1)").run(batch,source);
    db.prepare('INSERT INTO publication_batches VALUES (?,?,?)').run(batch,source,'2026-09-09');
    db.prepare('INSERT INTO active_publications VALUES (?,?)').run(source,batch);
    const states=source==='senado'?['SP','SP','RJ']:['SP','RJ'];
    states.forEach((uf,index)=>{
      const externalId=`${source}-${index}`,personId=`person-${externalId}`;
      const profile:Profile={source,externalId,name:`Pessoa ${externalId}`,fullName:null,uf,party:'P1',photoUrl:null,officialUrl:'https://example.invalid',observedAt:'2026-09-09',historyAvailability:'unavailable',mandates:[],exercises:[],parties:[],events:[],rawId:`raw-${externalId}`};
      db.prepare('INSERT INTO people VALUES (?,?)').run(personId,'2026-09-09');
      db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run(source,externalId,personId);
      db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-09-09',200,'application/json',?,?,0)").run(profile.rawId,batch,'https://example.invalid','0'.repeat(64),`raw/${externalId}`);
      db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?)').run(batch,personId,externalId,profile.name,profile.name,uf,'P1',profile.rawId,JSON.stringify(profile));
    });
  }
  return db;
}

test('consulta por UF separa Casas e não transforma métricas ausentes em zero',()=>{
  const db=seed();
  try {
    const result=publishedStateRepresentation(db,'SP',2026);
    assert.equal(result.summary.representatives,3);
    assert.equal(result.senators.length,2);
    assert.equal(result.deputies.length,1);
    assert.equal(result.summary.expenseCents.median,null);
    assert.equal(result.summary.presence.median,null);
    assert.equal(result.summary.cabinetByHouse.senado.staff.median,null);
    assert.equal(result.summary.cabinetByHouse.camara.financialCents.median,null);
    assert.equal(result.summary.cabinetByHouse.senado.kind,'identified_payroll');
    assert.equal(result.summary.cabinetByHouse.camara.kind,'budget_spent');
    assert.equal(result.coverage.sampleSize,3);
  } finally { db.close(); }
});

test('comparação estadual usa o mesmo ano e omite UF sem representantes',()=>{
  const db=seed();
  try {
    const result=publishedStateComparison(db,2026,['SP','RJ','AC']);
    assert.deepEqual(result.map(item=>item.uf),['SP','RJ']);
    assert.deepEqual(result.map(item=>item.representatives),[3,2]);
  } finally { db.close(); }
});
