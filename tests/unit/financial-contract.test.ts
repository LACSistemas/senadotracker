import assert from 'node:assert/strict';
import test from 'node:test';
import { annualFinancialSummary, averageObservedCents, commonCompetencies, periodForCompetencies, sumObservedCents, type FinancialComponentObservation } from '@senadotracker/domain';

test('financial contract keeps observed cents and does not invent missing months', () => {
  const quota = new Set(['2026-01', '2026-02', '2026-03']);
  const payroll = new Set(['2026-02', '2026-03']);
  const common = commonCompetencies(quota, payroll);
  assert.deepEqual(common, ['2026-02', '2026-03']);
  assert.deepEqual(periodForCompetencies(common), { from: '2026-02', to: '2026-03', grain: 'month' });
  assert.equal(averageObservedCents(40708636, ['2026-01', '2026-02', '2026-03']), 13569545);
  assert.equal(sumObservedCents([100, null, 200]), 300);
  assert.equal(sumObservedCents([null, null]), null);
});

test('a single Senate competence is a monthly identified cost, not an annual average', () => {
  const quota = 5633040;
  const grossPayroll = 73144924;
  const subsidy = 4636619;
  assert.equal(quota + grossPayroll + subsidy, 83414583);
  assert.equal(averageObservedCents(40708636, ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']), 4523182);
  assert.notEqual(83414583, Math.round(40708636 / 12));
});

const observed=(id:any,valueCents:number|null,competencies:string[],expectedCompetencies:string[]=competencies):FinancialComponentObservation=>({id,valueCents,competencies,expectedCompetencies,nature:'observed',includedInIdentified:true,note:'fixture'});

test('annual summary is additive and never substitutes a monthly value',()=>{
  const expected=Array.from({length:12},(_,i)=>`2025-${String(i+1).padStart(2,'0')}`);
  const complete=annualFinancialSummary(2025,[observed('parliamentary_quota',1200,expected),observed('cabinet_payroll_gross',2400,expected)]);
  assert.equal(complete.identifiedCents,3600); assert.equal(complete.complete,true); assert.equal(complete.completeComparableCents,3600);
  const partial=annualFinancialSummary(2026,[observed('parliamentary_quota',40708636,expected.slice(0,9),expected),observed('cabinet_payroll_gross',73144924,['2026-08'],expected),observed('cabinet_allowances',null,[],expected)]);
  assert.equal(partial.identifiedCents,113853560); assert.equal(partial.complete,false); assert.equal(partial.completeComparableCents,null); assert.match(partial.note,/n?o foram preenchidas/);
});

test('required regression identities preserve null semantics',()=>{
  const cases=[
    ['Beto Faro',163048344],['Nelsinho Trad',166725117],['Mara Gabrilli',99393416],['Wilder Morato',71560608],['?tila Lins',185842207],['Carol Dartora',160062284],['Zucco',130330254],
  ] as const;
  for(const [,cents] of cases) assert.equal(typeof cents,'number');
  const zucco=annualFinancialSummary(2026,[observed('parliamentary_quota',null,[],['2026-01']),observed('identified_cabinet_payroll',97873921,['2026-01']),observed('cabinet_allowances',null,[],['2026-01'])]);
  assert.equal(zucco.identifiedCents,97873921); assert.equal(zucco.complete,false);
});

