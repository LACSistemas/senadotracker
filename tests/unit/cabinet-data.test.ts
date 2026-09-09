import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase, publishCabinetBudgets, publishedCabinetBudgets, publishedCabinetPanorama, publishedCabinetProfile, publishStaffSnapshot, publishedStaffSnapshot, snapshotAvailability, startRun } from '@senadotracker/db';
import type { CabinetMonthlyBudget, FunctionalStaffAssignment, Profile, Source } from '@senadotracker/domain';

function seed(source:Source){
  const db=openDatabase(':memory:');
  const roster=`roster-${source}`,personId=`person-${source}`,externalId=source==='camara'?'204549':'5672',rawId=`raw-${roster}`;
  const profile:Profile={source,externalId,name:'Pessoa Teste',fullName:null,uf:'AC',party:'P1',photoUrl:null,officialUrl:'https://example.invalid',observedAt:'2026-09-09T00:00:00.000Z',historyAvailability:'available',mandates:[],exercises:[],parties:[],events:[],rawId};
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,?,'published','test',1)").run(roster,source,profile.observedAt);
  db.prepare('INSERT INTO publication_batches VALUES (?,?,?)').run(roster,source,profile.observedAt);
  db.prepare('INSERT INTO active_publications VALUES (?,?)').run(source,roster);
  db.prepare('INSERT INTO people VALUES (?,?)').run(personId,profile.observedAt);
  db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run(source,externalId,personId);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,?,200,'application/json',?,?,0)").run(rawId,roster,profile.officialUrl,profile.observedAt,'0'.repeat(64),`raw/${rawId}`);
  db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?)').run(roster,personId,externalId,profile.name,'pessoa teste','AC','P1',rawId,JSON.stringify(profile));
  return{db,externalId};
}

function addRaw(db:ReturnType<typeof openDatabase>,runId:string,rawId:string){db.prepare("INSERT INTO raw_objects VALUES (?,?,?,?,200,'text/csv',?,?,1)").run(rawId,runId,'https://example.invalid/source.csv','2026-09-09T00:00:00.000Z','1'.repeat(64),`raw/${rawId}`)}

test('snapshot publica somente atribuição confirmada e deriva desatualização',()=>{
  const {db,externalId}=seed('camara');
  try{
    const run=startRun(db,'camara',Date.parse('2026-09-09T00:00:00Z')),rawId='staff-raw';addRaw(db,run,rawId);
    const observedAt='2026-09-08T12:00:00.000Z';
    const confirmed:FunctionalStaffAssignment={source:'camara',staffKey:'ponto:1',functionalId:'1',name:'Servidor A',relationship:'Secretário Parlamentar',position:'SP01',role:null,unitId:'u1',unitLabel:'Gabinete',appointedAt:'2026-01-01',startedAt:'2026-01-01',endedAt:null,observedAt,externalId,matchStatus:'confirmed',matchEvidence:['uriLotacao','cadastro'],rawId};
    const pending:FunctionalStaffAssignment={...confirmed,staffKey:'ponto:2',name:'Servidor B',functionalId:'2',externalId:null,matchStatus:'pending',matchEvidence:[]};
    publishStaffSnapshot(db,run,'camara',observedAt,'partial','Uma lotação pendente.',[confirmed,pending]);
    const current=publishedStaffSnapshot(db,'camara',externalId,new Date('2026-09-09T12:00:00Z'));
    assert.equal(current.items.length,1);
    assert.equal(current.coverage.availability,'partial');
    const publicProfile=publishedCabinetProfile(db,'camara',externalId),serialized=JSON.stringify(publicProfile);
    assert.equal(serialized.includes('functionalId'),false);
    assert.equal(serialized.includes('matchEvidence'),false);
    assert.equal(serialized.includes('staffKey'),false);
    assert.equal(serialized.includes('unitId'),false);
    assert.equal(publicProfile.staff.items[0]!.name,'Servidor A');
    const stale=publishedStaffSnapshot(db,'camara',undefined,new Date('2026-09-12T12:00:01Z'));
    assert.equal(stale.coverage.availability,'stale');
    assert.equal(stale.items.length,2);
    assert.equal(snapshotAvailability(observedAt,'available',new Date('2026-09-09T00:00:00Z')), 'available');
  }finally{db.close()}
});

test('snapshot rejeita atribuição ambígua e preserva atomicidade',()=>{
  const {db,externalId}=seed('senado');
  try{
    const run=startRun(db,'senado'),rawId='staff-invalid';addRaw(db,run,rawId);
    const row:FunctionalStaffAssignment={source:'senado',staffKey:'1',functionalId:'1',name:'Servidor',relationship:'Comissionado',position:null,role:null,unitId:null,unitLabel:'Gabinete',appointedAt:null,startedAt:null,endedAt:null,observedAt:'2026-09-09T00:00:00.000Z',externalId,matchStatus:'ambiguous',matchEvidence:['nome'],rawId};
    assert.throws(()=>publishStaffSnapshot(db,run,'senado',row.observedAt,'partial','ambíguo',[row]),/não confirmado/);
    assert.equal(db.prepare('SELECT count(*) n FROM staff_snapshot_batches').get()!.n,0);
    assert.equal(db.prepare('SELECT count(*) n FROM functional_staff_assignments').get()!.n,0);
  }finally{db.close()}
});

test('verba mensal preserva limite proporcional, nulo e lote anterior',()=>{
  const {db,externalId}=seed('camara');
  try{
    const first=startRun(db,'camara'),raw1='budget-raw-1';addRaw(db,first,raw1);
    const rows:CabinetMonthlyBudget[]=[
      {source:'camara',externalId,year:2026,month:1,availableCents:13317054,spentCents:11609544,rawId:raw1},
      {source:'camara',externalId,year:2026,month:2,availableCents:14599164,spentCents:null,rawId:raw1},
    ];
    publishCabinetBudgets(db,first,2026,'partial','Janeiro e fevereiro.',rows);
    const published=publishedCabinetBudgets(db,externalId,2026);
    assert.equal(published.items[0]!.utilization,11609544/13317054);
    assert.equal(published.items[1]!.utilization,null);const profile=publishedCabinetProfile(db,'camara',externalId);assert.equal(profile.financial.kind,'budget');assert.equal(profile.financial.totalSpentCents,11609544);const panorama=publishedCabinetPanorama(db,'camara');assert.equal(panorama.period,'2026');assert.equal(panorama.sampleSize,1);

    const second=startRun(db,'camara'),raw2='budget-raw-2';addRaw(db,second,raw2);
    assert.throws(()=>publishCabinetBudgets(db,second,2026,'available','duplicado',[{...rows[0]!,rawId:raw2},{...rows[0]!,rawId:raw2}]),/duplicada/);
    assert.equal(db.prepare("SELECT batch_id FROM active_cabinet_budget_publications WHERE source='camara' AND year=2026").get()!.batch_id,first);
    assert.equal(db.prepare('SELECT count(*) n FROM cabinet_budget_batches').get()!.n,1);
  }finally{db.close()}
});
