import test from 'node:test';
import assert from 'node:assert/strict';
import { houseMetrics, type HouseMetricKey, type HouseMetricSummary } from '@senadotracker/db';
import { distribution, percentileOf, type DataCoverage } from '@senadotracker/domain';
import { houseLede, humanAnchor, profileLede } from '../../apps/web/lib/lede.ts';

const coverage=(availability:DataCoverage['availability'],sampleSize:number):DataCoverage=>({availability,source:'senado',period:{from:'2026-01-01',to:'2026-12-31',grain:'year'},batchId:'lote',note:'Nota.',sampleSize});

/** Monta um resumo de Casa com as métricas pedidas. `values` é o universo; `row` é a pessoa observada. */
function summary(metrics:Partial<Record<HouseMetricKey,{values:number[];availability?:DataCoverage['availability']}>>,row:Partial<Record<HouseMetricKey,number|null>>):HouseMetricSummary{
  const keys=Object.keys(houseMetrics) as HouseMetricKey[];
  return{source:'senado',year:2026,updatedAt:null,legislature:null,roster:100,
    metrics:Object.fromEntries(keys.map(key=>{const entry=metrics[key],values=entry?.values??[];
      return[key,{meta:houseMetrics[key],distribution:distribution(values),values,coverage:coverage(entry?.availability??(values.length?'available':'unavailable'),values.length)}]})) as HouseMetricSummary['metrics'],
    states:{},parties:{},
    rows:{'1':{source:'senado',externalId:'1',name:'Pessoa',photoUrl:null,role:'Senador(a)',uf:'DF',party:'P1',situation:'Em exercício',
      presence:null,participation:null,proposals:null,rapporteurships:null,expenseCents:null,cabinetCents:null,
      totalCostCents:null,monthlyCostCents:null,costMonths:null,costPeriod:null,staff:null,assetsCents:null,assetYear:null,mandates:null,...row}}} as HouseMetricSummary;
}
const context={root:'/legislativo/senadores/1',universeLabel:'senadores'};
const universe=(n:number,at:(index:number)=>number)=>Array.from({length:n},(_,index)=>at(index));

test('escolhe a métrica de percentil mais extremo',()=>{
  // staff no topo do universo, proposals no meio: a manchete tem de ser a de staff.
  const result=profileLede(summary({
    staff:{values:universe(40,index=>index)},
    proposals:{values:universe(40,index=>index)},
  },{staff:39,proposals:20}),'1',context)!;
  assert.equal(result.metric,'staff');
  assert.match(result.text,/Vínculos de gabinete de 39 em 2026/);
  assert.match(result.text,/nenhum dos 40 senadores registra mais/);
  // Fora do extremo, a frase volta ao enquadramento percentual.
  const second=profileLede(summary({staff:{values:universe(40,index=>index)},proposals:{values:universe(40,index=>index)}},{staff:35,proposals:20}),'1',context)!;
  assert.equal(second.metric,'staff');
  assert.match(second.text,/maior que 88% dos senadores/);
});

test('some quando nenhuma métrica tem referencial',()=>{
  // Universo abaixo do piso de 10 e cobertura indisponível: nada sustenta uma manchete.
  assert.equal(profileLede(summary({staff:{values:[1,2,3]}},{staff:3}),'1',context),null);
  assert.equal(profileLede(summary({staff:{values:universe(40,i=>i),availability:'unavailable'}},{staff:39}),'1',context),null);
  assert.equal(profileLede(summary({},{}),'1',context),null);
  assert.equal(profileLede(summary({staff:{values:universe(40,i=>i)}},{staff:null}),'1',context),null);
  assert.equal(profileLede(summary({staff:{values:universe(40,i=>i)}},{staff:39}),'999',context),null);
});

test('nunca afirma "abaixo de X%" nem enuncia percentual tautológico',()=>{
  // `percentileOf` mede a fração estritamente abaixo; o complemento não é verdade com empates.
  const low=profileLede(summary({staff:{values:universe(40,index=>index)}},{staff:0}),'1',context)!;
  assert.doesNotMatch(low.text,/abaixo de/);
  assert.match(low.text,/nenhum dos 40 senadores registra menos/);
  const high=profileLede(summary({staff:{values:universe(40,index=>index)}},{staff:39}),'1',context)!;
  assert.match(high.text,/nenhum dos 40 senadores registra mais/);
  // Fração não nula que arredondaria para 0% é enunciada como limite, não como zero.
  const tiny=profileLede(summary({staff:{values:universe(400,index=>index)}},{staff:1}),'1',context)!;
  assert.match(tiny.text,/maior que menos de 1% dos senadores/);
});

test('empate desconta o desvio: um zero compartilhado não vence a manchete',()=>{
  // 30 de 40 empatados em zero (percentil 0) contra um valor genuinamente alto em outra métrica.
  const result=profileLede(summary({
    rapporteurships:{values:[...universe(30,()=>0),...universe(10,index=>index+1)]},
    proposals:{values:universe(40,index=>index)},
  },{rapporteurships:0,proposals:37}),'1',context)!;
  assert.equal(result.metric,'proposals');
});

test('é determinística e liga para a rota da seção, nunca só para o hash',()=>{
  const build=()=>profileLede(summary({presence:{values:universe(40,index=>index/40)}},{presence:.1}),'1',context)!;
  assert.deepEqual(build(),build());
  const result=build();
  assert.equal(result.href,'/legislativo/senadores/1/atuacao-parlamentar#participacao');
  assert.ok(!result.href.startsWith('#'),'hash isolado não rola: o CSS esconde a seção fora da rota');
  // O ano enunciado é o do resumo da Casa, não o ano corrente.
  assert.match(result.text,/em 2026/);
});

test('cada métrica aponta para a seção que a originou',()=>{
  const at=(key:HouseMetricKey,values:number[],value:number)=>profileLede(summary({[key]:{values}},{[key]:value}),'1',context)!.href;
  const scale=universe(40,index=>index+1);
  assert.match(at('expenseCents',scale,40),/gastos-equipe#custos$/);
  assert.match(at('cabinetCents',scale,40),/gastos-equipe#gabinete$/);
  assert.match(at('staff',scale,40),/gastos-equipe#gabinete$/);
  assert.match(at('participation',scale,40),/atuacao-parlamentar#participacao$/);
  assert.match(at('proposals',scale,40),/atuacao-parlamentar#producao$/);
  assert.match(at('rapporteurships',scale,40),/atuacao-parlamentar#producao$/);
});

test('a lede da Casa enuncia mediana e n, e não recebe tom',()=>{
  const base=summary({monthlyCostCents:{values:universe(40,index=>(index+1)*100_00)}},{});
  const result=houseLede(base,'monthlyCostCents',{href:'/legislativo/rankings',universeLabel:'deputados'})!;
  // `Intl` separa o símbolo com espaço inquebrável; normalizar antes de comparar.
  assert.match(result.text.replace(/ /g,' '),/mediano de R\$ 2\.050 entre 40 deputados em 2026\./);
  // Uma mediana não se compara consigo mesma: sem referencial, sem cor.
  assert.equal(result.tone,'unknown');
  assert.equal(result.percentile,null);
  assert.equal(houseLede(summary({monthlyCostCents:{values:[1,2]}},{}),'monthlyCostCents',{href:'/x',universeLabel:'deputados'}),null);
});

test('a âncora humana some sem valor de referência publicado',()=>{
  assert.equal(humanAnchor(229_731_00,162_100,'salários mínimos'),'142 salários mínimos');
  assert.equal(humanAnchor(229_731_00,null,'salários mínimos'),null);
  assert.equal(humanAnchor(229_731_00,undefined,'salários mínimos'),null);
  assert.equal(humanAnchor(null,162_100,'salários mínimos'),null);
});

test('a contagem do percentil bate com percentileOf do domain',()=>{
  const values=[...universe(30,()=>0),...universe(10,index=>index+1)];
  for(const value of [0,1,5,10]){
    const result=profileLede(summary({staff:{values}},{staff:value}),'1',context);
    if(result)assert.equal(result.percentile,percentileOf(values,value),`valor ${value}`);
  }
});
