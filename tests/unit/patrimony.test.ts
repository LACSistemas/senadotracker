import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, publishedElectionMonths, publishedPatrimonyRanking } from '@senadotracker/db';
import type { Profile } from '@senadotracker/domain';

/** Semeia declarações de bens de dois pleitos. `conflict` duplica a versão de um bem, para exercitar a
    exclusão por conflito; `assets` é o valor total por ano e pessoa, em centavos. */
function seed(people:{externalId:string;assets:Record<number,number>}[],conflict=false){
  const db=openDatabase(':memory:'),roster='roster-senado';
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,'senado','2026-01-05','published','test',1)").run(roster);
  db.prepare('INSERT INTO publication_batches VALUES (?,?,?)').run(roster,'senado','2026-01-05');
  db.prepare('INSERT INTO active_publications VALUES (?,?)').run('senado',roster);
  db.prepare("INSERT INTO raw_objects VALUES ('raw-r',?,?,'2026-01-05',200,'application/json',?,'raw/r',0)").run(roster,'https://example.invalid','0'.repeat(64));
  for(const person of people){
    const personId=`person-${person.externalId}`;
    const profile:Profile={source:'senado',externalId:person.externalId,name:`Pessoa ${person.externalId}`,fullName:null,uf:'DF',party:'P1',photoUrl:null,officialUrl:'https://example.invalid',observedAt:'2026-01-05',historyAvailability:'unavailable',mandates:[],exercises:[],parties:[],events:[],rawId:'raw-r'};
    db.prepare('INSERT INTO people VALUES (?,?)').run(personId,'2026-01-05');
    db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run('senado',person.externalId,personId);
    db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?)').run(roster,personId,person.externalId,profile.name,profile.name,'DF','P1','raw-r',JSON.stringify(profile));
  }
  for(const year of [2018,2022]){
    const election=`tse-${year}`,batch=`electoral-${year}`;
    db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,'tse','2026-01-05','published','test',1)").run(batch);
    db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-01-05',200,'application/json',?,?,0)").run(`raw-${year}`,batch,'https://example.invalid',String(year).repeat(16),`raw/${year}`);
    db.prepare('INSERT INTO elections VALUES (?,?,1,?,?)').run(election,year,'BRASIL','https://example.invalid');
    db.prepare('INSERT INTO electoral_batches VALUES (?,?,?,?,?,?,?,?,?)').run(batch,election,'2026-01-05','available',people.length,people.length,0,0,'Lote de teste.');
    db.prepare('INSERT INTO active_electoral_publications VALUES (?,?)').run(election,batch);
    for(const person of people){
      const value=person.assets[year];if(value===undefined)continue;
      const sequence=`${year}-${person.externalId}`;
      db.prepare('INSERT INTO candidacies VALUES (?,?,?,?,?,?,?,?,?)').run(batch,sequence,`person-${person.externalId}`,'confirmed',year,'DF','SENADOR',`raw-${year}`,JSON.stringify({electionDate:`${year}-10-07`}));
      db.prepare('INSERT INTO electoral_assets VALUES (?,?,?,?,?,?,?)').run(batch,sequence,'a1','v1',value,`raw-${year}`,'{}');
      if(conflict&&year===2018)db.prepare('INSERT INTO electoral_assets VALUES (?,?,?,?,?,?,?)').run(batch,sequence,'a1','v2',value,`raw-${year}`,'{}');
    }
  }
  return db;
}

const people=[
  {externalId:'100',assets:{2018:100_000_00,2022:200_000_00}}, // +100% nominal
  {externalId:'101',assets:{2018:100_000_00,2022:110_000_00}}, // +10% nominal, perda real a 25,6%
  {externalId:'102',assets:{2018:100_000_00,2022:90_000_00}},  // -10% nominal
  {externalId:'103',assets:{2022:500_000_00}},                 // só um pleito: fora do ranking
];
const deflator={indexCode:'ipca',fromMonth:'2018-10',toMonth:'2022-10',factor:1.2555};

test('a correção monetária não reordena o ranking, só muda o sinal',()=>{
  const db=seed(people);
  try{
    const nominal=publishedPatrimonyRanking(db,2018,2022),real=publishedPatrimonyRanking(db,2018,2022,deflator);
    // `(1+r)/k-1` é monótono em `r`: a ordem é idêntica, e a copy da página afirma isso.
    assert.deepEqual(real.items.map(item=>item.externalId),nominal.items.map(item=>item.externalId));
    assert.deepEqual(real.items.map(item=>item.rank),nominal.items.map(item=>item.rank));
    // Quem cresceu 10% com inflação de 25,6% passa a mostrar perda real.
    const modest=real.items.find(item=>item.externalId==='101')!;
    assert.ok(modest.changeRate!>0,'nominal positivo');
    assert.ok(modest.changeRealRate!<0,`esperado negativo, obtido ${modest.changeRealRate}`);
    assert.equal(modest.fromCorrectedCents,Math.round(100_000_00*deflator.factor));
    assert.equal(modest.changeRealCents,110_000_00-modest.fromCorrectedCents!);
    // Quem dobrou continua com ganho real; quem caiu piora.
    assert.ok(real.items.find(item=>item.externalId==='100')!.changeRealRate!>0);
    assert.ok(real.items.find(item=>item.externalId==='102')!.changeRealRate!<0);
  } finally { db.close(); }
});

test('sem deflator os campos reais ficam nulos, nunca iguais ao nominal',()=>{
  const db=seed(people);
  try{
    const nominal=publishedPatrimonyRanking(db,2018,2022);
    assert.equal(nominal.deflator,null);
    assert.ok(nominal.items.every(item=>item.fromCorrectedCents===null&&item.changeRealRate===null&&item.changeRealCents===null));
    assert.match(nominal.coverage.note,/não são corrigidos pela inflação/);
    assert.match(publishedPatrimonyRanking(db,2018,2022,deflator).coverage.note,/corrigidos pelo IPCA de 2018-10 para 2022-10/);
  } finally { db.close(); }
});

test('quem tem um só pleito fica fora e a cobertura diz quantos são',()=>{
  const db=seed(people);
  try{
    const result=publishedPatrimonyRanking(db,2018,2022);
    assert.equal(result.items.length,3);
    assert.equal(result.declared,4);
    assert.ok(!result.items.some(item=>item.externalId==='103'));
    // 3 de 4 com declaração vinculada: a cobertura não pode afirmar universo completo.
    assert.equal(result.coverage.availability,'partial');
    assert.match(result.coverage.note,/3 de 4 pessoas/);
    assert.ok(result.coverage.batchId,'o lote precisa ser citado para a leitura ser auditável');
  } finally { db.close(); }
});

test('bem com versão conflitante é excluído e contado na cobertura',()=>{
  const db=seed(people,true);
  try{
    const result=publishedPatrimonyRanking(db,2018,2022);
    assert.equal(result.conflicts,3);
    assert.match(result.coverage.note,/3 bens com versões conflitantes/);
    // O único bem de 2018 de cada pessoa conflita, então nenhum par sobra.
    assert.equal(result.items.length,0);
    assert.equal(result.coverage.availability,'unavailable');
  } finally { db.close(); }
});

test('o mês de referência vem da data da eleição, não de constante',()=>{
  const db=seed(people);
  try{ assert.deepEqual(publishedElectionMonths(db,[2018,2022]),{2018:'2018-10',2022:'2022-10'}); }
  finally { db.close(); }
});
