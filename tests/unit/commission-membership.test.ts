import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileCommissionMembershipKeys} from '@senadotracker/db';

test('snapshot completo encerra pessoa que desapareceu',()=>{
  assert.deepEqual(reconcileCommissionMembershipKeys(['123|Titular'],[],true,true),['123|Titular']);
});
test('snapshot parcial não encerra membros antigos',()=>{
  assert.deepEqual(reconcileCommissionMembershipKeys(['1|Titular','2|Titular'],['1|Titular'],false),[]);
  assert.deepEqual(reconcileCommissionMembershipKeys(['1|Titular','2|Titular'],[],true,false),[]);
});
test('mudança de função encerra a função anterior e mantém a nova',()=>{
  assert.deepEqual(reconcileCommissionMembershipKeys(['1|Titular'],['1|Suplente'],true),['1|Titular']);
});
test('dois papéis publicados permanecem ativos',()=>{
  assert.deepEqual(reconcileCommissionMembershipKeys(['1|Titular','1|Presidente'],['1|Titular','1|Presidente'],true),[]);
});
