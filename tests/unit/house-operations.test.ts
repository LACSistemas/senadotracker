import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeProcessing } from '../../apps/collector/src/house-operations.ts';

test('tramitação usa primeiro desfecho terminal datado, calcula média e mediana',()=>{
  const result=summarizeProcessing([
    {id:'1',presentedAt:'2026-01-01',status:'Transformado em Norma Jurídica'},
    {id:'2',presentedAt:'2026-01-01',status:'Vetado'},
    {id:'3',presentedAt:'2026-01-01',status:'Em tramitação'},
  ],[
    {proposalId:'1',date:'2026-01-11',label:'Transformado em norma jurídica',value:null},
    {proposalId:'1',date:'2026-01-15',label:'Publicação posterior da norma',value:null},
    {proposalId:'2',date:'2026-01-21',label:'Veto total',value:null},
    {proposalId:'3',date:'2026-02-01',label:'Encaminhado à comissão',value:null},
  ]);
  assert.equal(result.sampleSize,2);assert.equal(result.eligible,2);assert.equal(result.coverage,1);assert.equal(result.meanDays,15);assert.equal(result.medianDays,15);
});

test('tramitação exclui eventos sem data e matérias abertas',()=>{
  const result=summarizeProcessing([{id:'1',presentedAt:'2026-01-01',status:'Em tramitação'}],[{proposalId:'1',date:null,label:'Promulgado',value:null}]);
  assert.equal(result.sampleSize,0);assert.equal(result.meanDays,null);assert.equal(result.medianDays,null);
});

test('situação terminal repetida não transforma evento antigo em desfecho',()=>{
  const result=summarizeProcessing([{id:'1',presentedAt:'2026-01-01',status:'Transformado em Norma Jurídica'}],[
    {proposalId:'1',date:'2026-01-01',label:'Apresentação de Proposição',value:'Transformado em Norma Jurídica'},
    {proposalId:'1',date:'2026-04-01',label:'Transformação em Norma Jurídica',value:'Transformado em Norma Jurídica'},
  ]);
  assert.equal(result.sampleSize,1);assert.equal(result.medianDays,90);
});
