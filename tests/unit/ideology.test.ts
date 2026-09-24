import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, publishedVoteAxis } from '@senadotracker/db';
import type { Deliberation, LegislativeVote, Profile, Source } from '@senadotracker/domain';

/** Semeia uma Casa em que dois blocos votam sempre em sentidos opostos, com `noise` deliberações
    unânimes e `sparse` pessoas votando pouco. É o caso em que o primeiro eixo tem resposta conhecida. */
function seed(source:Source,{blockA,blockB,votings,unanimous=0,sparseVotes=0,blockBVote='Não'}:{blockA:number;blockB:number;votings:number;unanimous?:number;sparseVotes?:number;blockBVote?:string}){
  const db=openDatabase(':memory:'),roster=`roster-${source}`,legislative=`votes-${source}`,year=2026;
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-01-05','published','test',1)").run(roster,source);
  db.prepare('INSERT INTO publication_batches VALUES (?,?,?)').run(roster,source,'2026-01-05');
  db.prepare('INSERT INTO active_publications VALUES (?,?)').run(source,roster);
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-01-05','published','test',1)").run(legislative,source);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-01-05',200,'application/json',?,?,0)").run(`raw-${source}`,roster,'https://example.invalid','0'.repeat(64),`raw/${source}`);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-01-05',200,'application/json',?,?,0)").run(`raw-v-${source}`,legislative,'https://example.invalid','1'.repeat(64),`raw/${source}-v`);
  const total=blockA+blockB+(sparseVotes?1:0);
  const people=Array.from({length:total},(_,index)=>String(100+index));
  people.forEach((external,index)=>{
    const personId=`person-${source}-${index}`,party=index<blockA?'AAA':index<blockA+blockB?'ZZZ':'MMM';
    const profile:Profile={source,externalId:external,name:`Pessoa ${external}`,fullName:null,uf:'DF',party,photoUrl:null,officialUrl:'https://example.invalid',observedAt:'2026-01-05',historyAvailability:'available',
      mandates:[{key:`m-${external}`,officialId:null,legislature:'57',uf:'DF',role:null,titularId:null,start:'2023-02-01',end:'2027-01-31',rawId:`raw-${source}`}],exercises:[],parties:[],events:[],rawId:`raw-${source}`};
    db.prepare('INSERT INTO people VALUES (?,?)').run(personId,'2026-01-05');
    db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run(source,external,personId);
    db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?)').run(roster,personId,external,profile.name,profile.name,'DF',party,profile.rawId,JSON.stringify(profile));
  });
  const deliberations:Deliberation[]=[],votes:LegislativeVote[]=[];
  const add=(id:string,choice:(index:number)=>string|null)=>{
    deliberations.push({source,externalId:id,year,date:`${year}-03-10`,recordedAt:null,chamberBody:'PLEN',description:id,result:null,approved:null,secret:false,proposalId:null,proposalLabel:null,proposalSummary:null,officialUrl:'https://example.invalid',rawId:`raw-v-${source}`});
    people.forEach((external,index)=>{const vote=choice(index);if(vote)votes.push({source,deliberationId:id,externalId:external,vote,description:null,party:null,uf:'DF',recordedAt:null,rawId:`raw-v-${source}`})});
  };
  for(let item=0;item<votings;item++)add(`d${item}`,index=>index<blockA?'Sim':index<blockA+blockB?blockBVote:(item<sparseVotes?'Sim':null));
  for(let item=0;item<unanimous;item++)add(`u${item}`,()=>'Sim');
  db.prepare('INSERT INTO legislative_batches VALUES (?,?,?,?,?,?)').run(legislative,source,year,'2026-01-05',deliberations.length,votes.length);
  db.prepare('INSERT INTO active_legislative_publications VALUES (?,?,?)').run(source,year,legislative);
  for(const item of deliberations)db.prepare('INSERT INTO deliberations VALUES (?,?,?,?,?,?,?)').run(legislative,source,item.externalId,year,item.date,item.rawId,JSON.stringify(item));
  for(const item of votes)db.prepare('INSERT INTO legislative_votes VALUES (?,?,?,?,?,?)').run(legislative,source,item.deliberationId,item.externalId,item.rawId,JSON.stringify(item));
  for(const id of new Set(votes.map(item=>item.deliberationId)))db.prepare('INSERT INTO nominal_deliberations VALUES (?,?)').run(legislative,id);
  return db;
}

test('o primeiro eixo separa blocos que votam em sentidos opostos',()=>{
  const db=seed('camara',{blockA:6,blockB:5,votings:40});
  try{
    const axis=publishedVoteAxis(db,'camara',[2026]);
    assert.equal(axis.coverage.availability,'available');
    assert.equal(axis.points.length,11);
    // Com dois blocos perfeitamente opostos, uma dimensão explica toda a variância.
    assert.ok(axis.explained!>.99,`esperado ~1, obtido ${axis.explained}`);
    const sides=new Map(axis.points.map(point=>[point.party,point.position]));
    assert.notEqual(Math.sign(sides.get('AAA')!),Math.sign(sides.get('ZZZ')!));
    // Cada bloco fica junto: o desvio dentro do bloco é nulo quando todos votam igual.
    const byParty=(party:string)=>axis.points.filter(point=>point.party===party).map(point=>point.position);
    assert.equal(new Set(byParty('AAA').map(value=>value.toFixed(6))).size,1);
    assert.equal(new Set(byParty('ZZZ').map(value=>value.toFixed(6))).size,1);
  } finally { db.close(); }
});

test('a orientação do eixo é determinística entre execuções',()=>{
  const first=seed('camara',{blockA:6,blockB:5,votings:40});
  const second=seed('camara',{blockA:6,blockB:5,votings:40});
  try{
    const a=publishedVoteAxis(first,'camara',[2026]),b=publishedVoteAxis(second,'camara',[2026]);
    assert.deepEqual(a.points.map(point=>[point.externalId,point.position.toFixed(6)]),b.points.map(point=>[point.externalId,point.position.toFixed(6)]));
    // O partido alfabeticamente primeiro entre os posicionados fica no lado negativo, por regra fixa.
    assert.ok(a.points.filter(point=>point.party==='AAA').every(point=>point.position<0));
    assert.deepEqual(a.poles.negative,['AAA']);
  } finally { first.close();second.close(); }
});

test('quem vota pouco é omitido em vez de posicionado no zero',()=>{
  const db=seed('camara',{blockA:6,blockB:5,votings:40,sparseVotes:4});
  try{
    const axis=publishedVoteAxis(db,'camara',[2026]);
    assert.equal(axis.points.length,11);
    assert.equal(axis.omitted,1);
    assert.equal(axis.coverage.availability,'partial');
    assert.ok(!axis.points.some(point=>point.party==='MMM'));
    assert.match(axis.coverage.note,/ficaram fora por falta de votos/);
  } finally { db.close(); }
});

test('votação unânime não entra na matriz e universo curto fica indisponível',()=>{
  const thin=seed('camara',{blockA:6,blockB:5,votings:10,unanimous:80});
  try{
    // 80 unânimes não compensam 10 divergentes: sem divergência não há o que separar.
    const axis=publishedVoteAxis(thin,'camara',[2026]);
    assert.equal(axis.deliberations,10);
    assert.equal(axis.coverage.availability,'unavailable');
    assert.deepEqual(axis.points,[]);
    assert.match(axis.coverage.note,/ao menos 30 votações/);
  } finally { thin.close(); }
});

test('obstrução posiciona na Câmara e desaparece no Senado',()=>{
  // Mesmo cenário nas duas Casas, com o segundo bloco em obstrução. Na Câmara é posição e separa os
  // blocos; no Senado o literal sai do universo, sobra só um bloco votando "Sim" e não há divergência.
  const camara=seed('camara',{blockA:6,blockB:5,votings:40,blockBVote:'Obstrução'});
  const senado=seed('senado',{blockA:6,blockB:5,votings:40,blockBVote:'Obstrução'});
  try{
    const withObstruction=publishedVoteAxis(camara,'camara',[2026]);
    assert.equal(withObstruction.points.length,11);
    assert.equal(withObstruction.coverage.availability,'available');
    assert.notEqual(Math.sign(withObstruction.points[0]!.position),Math.sign(withObstruction.points.at(-1)!.position));

    const without=publishedVoteAxis(senado,'senado',[2026]);
    assert.equal(without.deliberations,0);
    assert.equal(without.coverage.availability,'unavailable');
  } finally { camara.close();senado.close(); }
});
