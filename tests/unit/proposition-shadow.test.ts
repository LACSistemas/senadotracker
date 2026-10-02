import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePropositionResults } from '../../apps/web/lib/proposition-shadow.ts';

const item=(id:string,summary='same')=>({source:'camara',external_id:id,proposal:{source:'camara',externalId:id,label:`PL ${id}`,summary,type:'PL',number:id,year:2026}});
const base={items:[item('1'),item('2')],hasNextPage:false};

test('shadow comparator classifies match and order',()=>{
  assert.equal(comparePropositionResults({},base,{...base,items:[item('1'),item('2')]}).diffType,'MATCH');
  assert.equal(comparePropositionResults({},base,{...base,items:[item('2'),item('1')]}).diffType,'ORDER_MISMATCH');
});

test('shadow comparator distinguishes set, value and pagination mismatches',()=>{
  assert.equal(comparePropositionResults({},base,{items:[item('1'),item('3')],hasNextPage:false}).diffType,'PAGE_WINDOW_MISMATCH');
  assert.equal(comparePropositionResults({},base,{items:[item('1','changed'),item('2')],hasNextPage:false}).diffType,'VALUE_MISMATCH');
  assert.equal(comparePropositionResults({},base,{...base,hasNextPage:true}).diffType,'PAGINATION_MISMATCH');
  assert.equal(comparePropositionResults({},base,{items:[item('1')],hasNextPage:false}).diffType,'SET_MISMATCH');
});
