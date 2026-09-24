import test from 'node:test';
import assert from 'node:assert/strict';
import {validCnpj} from '@senadotracker/domain';

test('supplier detail accepts only CNPJ with valid check digits',()=>{
  assert.equal(validCnpj('02.558.157/0001-62'),true);
  assert.equal(validCnpj('02558157000161'),false);
  assert.equal(validCnpj('11111111111111'),false);
  assert.equal(validCnpj('12345678901'),false);
});
