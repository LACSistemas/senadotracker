import test from 'node:test';
import assert from 'node:assert/strict';
import { distribution, historicalSeries, type DataCoverage, type Source } from '@senadotracker/domain';
import { openDatabase, publishedHousePanorama } from '@senadotracker/db';

const coverage=(source:Source,period:string,available:boolean):DataCoverage=>({availability:available?'available':'unavailable',source,period:{from:period,to:period,grain:'year'},batchId:available?'batch':null,note:available?'Publicado.':'Sem observação.',sampleSize:available?1:0});

function seedHouse(source:Source, values:readonly number[]) {
  const db=openDatabase(':memory:'); const roster=`roster-${source}`; const expenses=`expenses-${source}`;
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-09-08','published','test',1)").run(roster,source);
  db.prepare('INSERT INTO publication_batches VALUES (?,?,?)').run(roster,source,'2026-09-08');
  db.prepare('INSERT INTO active_publications VALUES (?,?)').run(source,roster);
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-09-08','published','test',1)").run(expenses,source);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-09-08',200,'application/json',?, ?,0)").run(`raw-${source}`,roster,'https://example.invalid/roster','0'.repeat(64),`raw/${source}`);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-09-08',200,'application/json',?, ?,0)").run(`expense-raw-${source}`,expenses,'https://example.invalid/expenses','1'.repeat(64),`raw/${source}-expenses`);
  values.forEach((value,index)=>{const person=`${source}-${index}`;const external=String(100+index);db.prepare('INSERT INTO people VALUES (?,?)').run(person,'2026-09-08');db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run(source,external,person);db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?)').run(roster,person,external,`${source} ${index}`,`${source} ${index}`,index?'SP':'RJ',index?'P2':'P1',`raw-${source}`,JSON.stringify({}));});
  db.prepare('INSERT INTO expense_batches VALUES (?,?,?,?,?,?)').run(expenses,source,2026,'2026-09-08',values.length,values.reduce((a,b)=>a+b,0));
  db.prepare('INSERT INTO active_expense_publications VALUES (?,?,?)').run(source,2026,expenses);
  values.forEach((value,index)=>db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(expenses,source,String(100+index),2026,1,`r-${index}`,'1','Categoria',null,null,null,null,null,null,value,0,value,0,null,null,`expense-raw-${source}`));
  return db;
}

test('distribuição usa interpolação linear e vazio permanece nulo',()=>{assert.deepEqual(distribution([]),{count:0,min:null,p10:null,p25:null,median:null,p75:null,p90:null,max:null});assert.deepEqual(distribution([10,20,30,40]),{count:4,min:10,p10:13,p25:17.5,median:25,p75:32.5,p90:37,max:40})});
test('série histórica preserva lacuna como null',()=>{const rows=historicalSeries(['2024','2025','2026'],new Map([['2024',7],['2026',9]]),(p,a)=>coverage('senado',p,a));assert.deepEqual(rows.map(x=>x.value),[7,null,9]);assert.equal(rows[1]!.coverage.availability,'unavailable')});
for(const [source,values] of [['senado',[100,300]],['camara',[20,40,60]]] as const)test(`panorama de ${source} limita o universo a observações compatíveis`,()=>{const db=seedHouse(source,values);try{const result=publishedHousePanorama(db,source,2026);assert.equal(result.roster.parliamentarians,values.length);assert.equal(result.expenses.distributionCents.count,values.length);assert.equal(result.expenses.distributionCents.median,source==='senado'?200:40);assert.equal(result.expenses.coverage.sampleSize,values.length);assert.equal(result.cabinetPayroll.distributionCents.median,null)}finally{db.close()}});
