import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calculateVoteAgreement, directionalVote, openDatabase, publishedExpenseComparison, publishedPersonComparison, publishedPersonComparisonDashboard } from '@senadotracker/db';
import type { LegislativeVote } from '@senadotracker/domain';

test('comparação vazia não fabrica média zero e valida recorte',async()=>{const dir=await mkdtemp(join(tmpdir(),'compare-'));const db=openDatabase(join(dir,'db.sqlite'));try{const result=publishedExpenseComparison(db,'senado',2026);assert.equal(result.meanCents,null);assert.deepEqual(result.items,[]);assert.throws(()=>publishedExpenseComparison(db,'senado',2026,{uf:'XX'}),/UF/)}finally{db.close()}});
test('comparação nominal exige de duas a quatro pessoas distintas',()=>{const db=openDatabase(':memory:');try{assert.throws(()=>publishedPersonComparison(db,'senado',2026,['1'],'expenses'),/duas a quatro/);assert.throws(()=>publishedPersonComparison(db,'senado',2026,['1','1'],'expenses'),/diferentes/);assert.throws(()=>publishedPersonComparison(db,'senado',2026,['1','2','3','4','5'],'expenses'),/duas a quatro/)}finally{db.close()}});
const vote=(source:'senado'|'camara',deliberationId:string,externalId:string,value:string)=>({source,deliberationId,externalId,vote:value,description:null,party:'P',uf:'DF',recordedAt:null,rawId:'r'} satisfies LegislativeVote);
test('concordância exclui ausência e não voto do denominador',()=>{const senado=(d:string,id:string,v:string)=>vote('senado',d,id,v);const result=calculateVoteAgreement([senado('a','1','Sim'),senado('b','1','Não'),senado('c','1','Ausente')],[senado('a','2','SIM'),senado('b','2','Sim'),senado('c','2','Não')]);assert.equal(result.total,2);assert.equal(result.equal,1);assert.equal(result.ratio,.5)});
// O Senado publica abreviações que a antiga deny-list por substring deixava passar: 16,8% das linhas do
// lote entravam no denominador, e dois ausentes contavam como concordância.
test('abreviações de ausência do Senado ficam fora do voto direcional',()=>{
  for(const literal of ['AP','P-NRV','LS','MIS','NCom','LP','LAP','NA','P-OD','MERC','Impedido (art.306 RISF)','Presidente (art. 51 RISF)','Ausente',''])assert.equal(directionalVote('senado',literal),null,literal);
  for(const literal of ['Artigo 17','Obstrução'])assert.equal(directionalVote('senado',literal),null,literal);
  assert.equal(directionalVote('senado','Sim'),'sim');
  assert.equal(directionalVote('senado','Não'),'nao');
  assert.equal(directionalVote('senado','Abstenção'),'abstencao');
  assert.equal(directionalVote('camara','Artigo 17'),null);
});
test('obstrução é posição na Câmara e não no Senado',()=>{
  assert.equal(directionalVote('camara','Obstrução'),'obstrucao');
  assert.equal(directionalVote('senado','Obstrução'),null);
});
test('votos sem direção observável não sustentam concordância',()=>{
  // `votou` e `secreto` contam como participação, mas não revelam a posição: dois "secreto" não concordam.
  for(const literal of ['votou','Secreto'])assert.equal(directionalVote('camara',literal),null,literal);
  const result=calculateVoteAgreement([vote('senado','a','1','AP'),vote('senado','b','1','Secreto')],[vote('senado','a','2','AP'),vote('senado','b','2','Secreto')]);
  assert.equal(result.total,0);
  assert.equal(result.ratio,null);
});

test('comparação de custo soma parcelas identificadas e agrega categorias líquidas uma vez',()=>{const db=openDatabase(':memory:');try{
  db.prepare("INSERT INTO people VALUES ('p1','now'),('p2','now')").run();db.prepare("INSERT INTO external_identifiers VALUES ('senado','1','p1'),('senado','2','p2')").run();db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES ('roster','senado','now','published','test',1),('expense','senado','now','published','test',1),('cabinet','senado','now','published','test',1)").run();db.prepare("INSERT INTO raw_objects VALUES ('raw-roster','roster','https://example.test','now',200,'application/json',?,'raw',1),('raw-expense','expense','https://example.test','now',200,'application/json',?,'raw',1),('raw-cabinet','cabinet','https://example.test','now',200,'application/json',?,'raw',1)").run('0'.repeat(64),'1'.repeat(64),'2'.repeat(64));db.prepare("INSERT INTO publication_batches VALUES ('roster','senado','now')").run();db.prepare("INSERT INTO active_publications VALUES ('senado','roster')").run();
  const profile=(id:string,name:string)=>JSON.stringify({source:'senado',externalId:id,name,fullName:name,uf:'DF',party:'P',photoUrl:null,officialUrl:'https://example.test',observedAt:'2026-01-01',historyAvailability:'available',mandates:[],exercises:[{mandateKey:'m',state:'active',cause:null,start:'2026-01-01',end:null}],parties:[],events:[],rawId:'raw-roster'});
  db.prepare("INSERT INTO profiles VALUES ('roster','p1','1','Ana','ana','DF','P','raw-roster',?),('roster','p2','2','Bia','bia','DF','P','raw-roster',?)").run(profile('1','Ana'),profile('2','Bia'));
  db.prepare("INSERT INTO expense_batches VALUES ('expense','senado',2026,'now',4,0)").run();db.prepare("INSERT INTO active_expense_publications VALUES ('senado',2026,'expense')").run();const addExpense=db.prepare("INSERT INTO expenses VALUES ('expense','senado',?,2026,?,?,?, ?,NULL,NULL,NULL,NULL,NULL,NULL,?,0,?,?,NULL,NULL,'raw-expense')");addExpense.run('1',1,'a','A','Categoria A',10000,10000,1000);addExpense.run('1',1,'b','B','Categoria B',5000,5000,0);addExpense.run('1',2,'c','A','Categoria A',7000,7000,0);addExpense.run('2',1,'d','A','Categoria A',12000,12000,0);
  db.prepare("INSERT INTO expanded_cost_batches VALUES ('cabinet','senado',2026,'now','available','teste',2)").run();db.prepare("INSERT INTO active_expanded_cost_publications VALUES ('senado',2026,'cabinet')").run();const addCabinet=db.prepare("INSERT INTO expanded_costs VALUES ('cabinet','senado',?, '2026-01','cabinet_payroll_gross','expense',?,NULL,'raw-cabinet',?)");for(const [id,cents] of [['1',20000],['2',30000]] as const)addCabinet.run(id,cents,JSON.stringify({source:'senado',externalId:id,competence:'2026-01',rubric:'cabinet_payroll_gross',nature:'expense',valueCents:cents,label:'Folha',rawId:'raw-cabinet'}));
  const result=publishedPersonComparisonDashboard(db,'senado',2026,['1','2']);assert.equal(result.coverage.costs.period.from,'2026-01');assert.equal(result.coverage.costs.period.to,'2026-09');assert.equal(result.costs[0]?.expenseCents,21000);assert.equal(result.costs[0]?.cabinetCents,20000);assert.equal(result.costs[0]?.totalCents,41770571);assert.equal(result.expenses[0]?.totalCents,21000);assert.equal(result.expenses[0]?.recordCount,3);assert.equal(result.expenses[0]?.largestCategory?.label,'Categoria A');assert.equal(result.expenses[0]?.largestCategory?.valueCents,16000);
  db.prepare("UPDATE expanded_costs SET competence='2026-02' WHERE external_id='2'").run();const incomplete=publishedPersonComparisonDashboard(db,'senado',2026,['1','2']);assert.equal(incomplete.coverage.costs.availability,'partial');assert.equal(incomplete.costs[0]?.totalCents,41770571);assert.equal(incomplete.costs[1]?.totalCents,41771571);assert.equal(incomplete.costs[1]?.comparable,false);assert.equal(incomplete.costs[1]?.cabinetPeriod,'2026-02');
}finally{db.close()}});
