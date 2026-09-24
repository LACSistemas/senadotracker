import test from 'node:test';
import assert from 'node:assert/strict';
import {canStrongMatchSupplierIdentifier,compactSupplierIdentifier,normalizeSupplierIdentifier,validCnpj,validCpf} from '@senadotracker/domain';

test('normaliza CNPJ sem destruir letras',()=>{
  assert.equal(compactSupplierIdentifier('00.000.000/E08G-12'),'00000000E08G12');
  assert.equal(validCnpj('00.000.000/E08G-12'),true);
  const result=normalizeSupplierIdentifier('00.000.000/E08G-12');
  assert.deepEqual(result,{type:'cnpj',rawValue:'00.000.000/E08G-12',normalizedValue:'00000000E08G12',countryCode:'BR',isMasked:false,validationStatus:'valid',normalizationVersion:'supplier-id-v1'});
  assert.equal(canStrongMatchSupplierIdentifier(result),true);
});

test('mantém compatibilidade com CNPJ numérico e rejeita sentinela',()=>{
  assert.equal(validCnpj('02.558.157/0001-62'),true);
  assert.equal(validCnpj('02.558.157/0001-61'),false);
  const sentinel=normalizeSupplierIdentifier('00.000.000/0000-10');
  assert.equal(sentinel.validationStatus,'sentinel');
  assert.equal(canStrongMatchSupplierIdentifier(sentinel),false);
});

test('CPF tem tipo próprio e documento mascarado não produz match forte',()=>{
  assert.equal(validCpf('529.982.247-25'),true);
  assert.equal(validCpf('529.982.247-24'),false);
  assert.equal(normalizeSupplierIdentifier('529.982.247-25').type,'cpf');
  const masked=normalizeSupplierIdentifier('***.982.247-**','cpf');
  assert.equal(masked.validationStatus,'masked');
  assert.equal(canStrongMatchSupplierIdentifier(masked),false);
});

test('documento desconhecido não vira identidade forte',()=>{
  const foreign=normalizeSupplierIdentifier('US-ABC-991','foreign_tax_id','US');
  assert.equal(foreign.validationStatus,'not_validated');
  assert.equal(canStrongMatchSupplierIdentifier(foreign),false);
  assert.equal(normalizeSupplierIdentifier('').validationStatus,'invalid');
});
