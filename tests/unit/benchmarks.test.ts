import test from 'node:test';
import assert from 'node:assert/strict';
import { distribution, percentileOf, type Profile, type Source } from '@senadotracker/domain';
import { groupDistribution, houseMetrics, openDatabase, publishedHouseMetricSummary, publishedRankingsDashboard, stateChoropleth } from '@senadotracker/db';

/** Semeia cadastro e cota anual de uma Casa. `people` traz UF, partido (padrão `P1`) e valor da cota. */
function seed(source:Source,people:readonly {uf:string;expense:number;party?:string}[]){
  const db=openDatabase(':memory:'),roster=`roster-${source}`,expenses=`expenses-${source}`;
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-01-05','published','test',1)").run(roster,source);
  db.prepare('INSERT INTO publication_batches VALUES (?,?,?)').run(roster,source,'2026-01-05');
  db.prepare('INSERT INTO active_publications VALUES (?,?)').run(source,roster);
  db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES (?,?,'2026-01-05','published','test',1)").run(expenses,source);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-01-05',200,'application/json',?,?,0)").run(`raw-${source}`,roster,'https://example.invalid','0'.repeat(64),`raw/${source}`);
  db.prepare("INSERT INTO raw_objects VALUES (?,?,?,'2026-01-05',200,'application/json',?,?,0)").run(`raw-exp-${source}`,expenses,'https://example.invalid','1'.repeat(64),`raw/${source}-exp`);
  people.forEach((person,index)=>{
    const external=String(100+index),personId=`person-${source}-${index}`,party=person.party??'P1';
    const profile:Profile={source,externalId:external,name:`Pessoa ${external}`,fullName:null,uf:person.uf,party,photoUrl:null,officialUrl:'https://example.invalid',observedAt:'2026-01-05',historyAvailability:'unavailable',mandates:[],exercises:[],parties:[],events:[],rawId:`raw-${source}`};
    db.prepare('INSERT INTO people VALUES (?,?)').run(personId,'2026-01-05');
    db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run(source,external,personId);
    db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?)').run(roster,personId,external,profile.name,profile.name,person.uf,party,profile.rawId,JSON.stringify(profile));
  });
  db.prepare('INSERT INTO expense_batches VALUES (?,?,?,?,?,?)').run(expenses,source,2026,'2026-01-05',people.length,people.reduce((sum,item)=>sum+item.expense,0));
  db.prepare('INSERT INTO active_expense_publications VALUES (?,?,?)').run(source,2026,expenses);
  people.forEach((person,index)=>db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(expenses,source,String(100+index),2026,1,`r-${index}`,'1','Categoria',null,null,null,null,null,null,person.expense,0,person.expense,0,null,null,`raw-exp-${source}`));
  return db;
}

const camara=[
  {uf:'SP',expense:100},{uf:'SP',expense:200},{uf:'SP',expense:300},{uf:'SP',expense:900},
  {uf:'RJ',expense:400},{uf:'RJ',expense:500},{uf:'RJ',expense:600},
  {uf:'AC',expense:50},{uf:'AC',expense:70},
] as const;

test('a distribuição da Casa reproduz exatamente a matriz do painel de rankings',()=>{
  const db=seed('camara',camara);
  try{
    const summary=publishedHouseMetricSummary(db,'camara',2026);
    const dashboard=publishedRankingsDashboard(db,{source:'camara',year:2026});
    const expected=dashboard.allItems.flatMap(row=>row.expenseCents===null?[]:[row.expenseCents]);
    assert.deepEqual(summary.metrics.expenseCents.distribution,distribution(expected));
    assert.equal(summary.metrics.expenseCents.distribution.count,camara.length);
    assert.equal(summary.metrics.expenseCents.meta.direction,'higher-is-worse');
    assert.equal(summary.metrics.presence.meta.direction,'higher-is-better');
    assert.equal(summary.roster,camara.length);
    // A linha da própria pessoa precisa existir, senão a régua compara números de proveniências distintas.
    assert.equal(Object.keys(summary.rows).length,camara.length);
    assert.equal(summary.rows['100']!.expenseCents,100);
  } finally { db.close(); }
});

test('percentil é exato e empates não contam como abaixo',()=>{
  assert.equal(percentileOf([10,20,30,40],10),0);
  assert.equal(percentileOf([10,20,30,40],40),.75);
  assert.equal(percentileOf([10,10,10,40],10),0);
  assert.equal(percentileOf([10,10,10,40],40),.75);
  assert.equal(percentileOf([],5),null);
  assert.equal(percentileOf([1,2],null),null);
});

test('as UFs são agrupadas dentro da Casa e nunca somadas entre Casas',()=>{
  const db=seed('camara',camara);
  try{
    const summary=publishedHouseMetricSummary(db,'camara',2026);
    assert.equal(summary.states.SP!.representatives,4);
    assert.equal(summary.states.SP!.metrics.expenseCents.distribution.median,250);
    assert.equal(summary.states.RJ!.metrics.expenseCents.distribution.median,500);
    // Todas as 27 UFs existem: o mapa precisa pintar de cinza as sem observação.
    assert.equal(Object.keys(summary.states).length,27);
    assert.equal(summary.states.MG!.representatives,0);
    assert.equal(summary.states.MG!.metrics.expenseCents.distribution.count,0);
    assert.equal(summary.states.MG!.metrics.expenseCents.coverage.availability,'unavailable');
    assert.equal(summary.metrics.expenseCents.coverage.source,'camara');
  } finally { db.close(); }
});

test('coroplético inclui as 27 UFs e respeita o piso de amostra por estado',()=>{
  const db=seed('camara',camara);
  try{
    const summary=publishedHouseMetricSummary(db,'camara',2026);
    const map=stateChoropleth(summary,'expenseCents');
    assert.equal(map.items.length,27);
    // AC tem n=2, abaixo do piso de 3: entra sem valor e sem balde, em vez de virar uma cor.
    assert.equal(houseMetrics.expenseCents.stateMinSample,3);
    const acre=map.items.find(item=>item.uf==='AC')!;
    assert.equal(acre.sampleSize,2);
    assert.equal(acre.value,null);
    assert.equal(acre.bucket,null);
    const minas=map.items.find(item=>item.uf==='MG')!;
    assert.equal(minas.value,null);
    assert.equal(minas.bucket,null);
    const paulo=map.items.find(item=>item.uf==='SP')!;
    assert.equal(paulo.value,250);
    assert.notEqual(paulo.bucket,null);
    assert.equal(map.coverage.availability,'partial');
    assert.equal(map.coverage.sampleSize,2);
    assert.equal(map.buckets.reduce((sum,bucket)=>sum+bucket.count,0),2);
  } finally { db.close(); }
});

test('escala encurta sem repetir tom quando há poucos valores distintos',()=>{
  const db=seed('camara',[{uf:'SP',expense:10},{uf:'SP',expense:10},{uf:'SP',expense:10}]);
  try{
    const map=stateChoropleth(publishedHouseMetricSummary(db,'camara',2026),'expenseCents');
    // Uma única mediana distinta não pode gerar cinco faixas idênticas.
    assert.equal(map.buckets.length,1);
    assert.equal(map.buckets[0]!.count,1);
    assert.equal(map.items.find(item=>item.uf==='SP')!.bucket,0);
    assert.equal(new Set(map.buckets.map(bucket=>`${bucket.from}:${bucket.to}`)).size,map.buckets.length);
  } finally { db.close(); }
});

test('bancadas são agrupadas dentro da Casa, simétrico a UF, e nunca somadas entre Casas',()=>{
  const senado=[
    {uf:'SP',expense:100,party:'PT'},{uf:'RJ',expense:900,party:'PT'},
    {uf:'MG',expense:200,party:'PL'},
  ] as const;
  const db=seed('camara',camara),outro=seed('senado',senado);
  try{
    const summary=publishedHouseMetricSummary(db,'camara',2026);
    // As mesmas nove pessoas de `camara` estão todas em P1: uma bancada só, espelhando a soma da Casa.
    assert.equal(Object.keys(summary.parties).length,1);
    assert.equal(summary.parties.P1!.representatives,camara.length);
    assert.equal(summary.parties.P1!.metrics.expenseCents.distribution.median,summary.metrics.expenseCents.distribution.median);
    const senadoSummary=publishedHouseMetricSummary(outro,'senado',2026);
    assert.equal(Object.keys(senadoSummary.parties).length,2);
    assert.equal(senadoSummary.parties.PT!.representatives,2);
    assert.equal(senadoSummary.parties.PT!.metrics.expenseCents.distribution.median,500);
    assert.equal(senadoSummary.parties.PL!.representatives,1);
    // Bancada de partido inexistente na Casa simplesmente não aparece — ao contrário de UF, que sempre
    // preenche as 27, não há um conjunto canônico de siglas a completar.
    assert.equal(senadoSummary.parties.P1,undefined);
  } finally { db.close(); outro.close(); }
});

test('HHI vale 1 com bancada de partido único e discrimina 5+1+1+1 de 2+2+2+2',()=>{
  const solid=[{uf:'RJ',expense:100,party:'PT'},{uf:'RJ',expense:200,party:'PT'},{uf:'RJ',expense:300,party:'PT'}] as const;
  const skewed=[
    {uf:'MT',expense:10,party:'A'},{uf:'MT',expense:10,party:'A'},{uf:'MT',expense:10,party:'A'},{uf:'MT',expense:10,party:'A'},{uf:'MT',expense:10,party:'A'},
    {uf:'MT',expense:10,party:'B'},{uf:'MT',expense:10,party:'C'},{uf:'MT',expense:10,party:'D'},
  ] as const;
  const even=[
    {uf:'RR',expense:10,party:'A'},{uf:'RR',expense:10,party:'A'},
    {uf:'RR',expense:10,party:'B'},{uf:'RR',expense:10,party:'B'},
    {uf:'RR',expense:10,party:'C'},{uf:'RR',expense:10,party:'C'},
    {uf:'RR',expense:10,party:'D'},{uf:'RR',expense:10,party:'D'},
  ] as const;
  const solidDb=seed('camara',solid),skewedDb=seed('camara',skewed),evenDb=seed('camara',even);
  try{
    assert.equal(publishedHouseMetricSummary(solidDb,'camara',2026).states.RJ!.concentration,1);
    // 5×(5/8)² + 3×(1/8)² = 25/64 + 3/64 = 28/64 = 0.4375
    assert.equal(publishedHouseMetricSummary(skewedDb,'camara',2026).states.MT!.concentration,28/64);
    // 4×(2/8)² = 4/16 = 0.25 — mesma contagem de partidos (4) e de cadeiras (8) que o caso acima, HHI difere.
    assert.equal(publishedHouseMetricSummary(evenDb,'camara',2026).states.RR!.concentration,.25);
    assert.equal(publishedHouseMetricSummary(solidDb,'camara',2026).states.MG!.concentration,null);
  } finally { solidDb.close(); skewedDb.close(); evenDb.close(); }
});

test('piso de amostra da bancada é por partido, não o piso maior da Casa',()=>{
  assert.equal(houseMetrics.expenseCents.partyMinSample,3);
  const db=seed('camara',[
    {uf:'SP',expense:100,party:'P1'},{uf:'SP',expense:200,party:'P1'},
    {uf:'RJ',expense:900,party:'P2'},{uf:'RJ',expense:800,party:'P2'},{uf:'RJ',expense:700,party:'P2'},
  ]);
  try{
    const summary=publishedHouseMetricSummary(db,'camara',2026);
    const groups=Object.values(summary.parties);
    const {distribution:scale,values}=groupDistribution(groups,'expenseCents',houseMetrics.expenseCents.partyMinSample);
    // P1 tem 2 observações, abaixo do piso de 3: fica fora da distribuição entre bancadas.
    assert.deepEqual(values,[800]);
    assert.equal(scale.count,1);
  } finally { db.close(); }
});

test('desligar patrimônio não altera as outras colunas',()=>{
  const db=seed('camara',camara);
  try{
    const withAssets=publishedRankingsDashboard(db,{source:'camara',year:2026});
    const without=publishedRankingsDashboard(db,{source:'camara',year:2026,includeAssets:false});
    assert.deepEqual(without.allItems.map(row=>row.assetsCents),without.allItems.map(()=>null));
    const strip=(rows:typeof withAssets.allItems)=>rows.map(({assetsCents,assetYear,...rest})=>rest);
    assert.deepEqual(strip(without.allItems),strip(withAssets.allItems));
  } finally { db.close(); }
});
