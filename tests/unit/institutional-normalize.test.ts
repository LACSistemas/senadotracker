import assert from 'node:assert/strict';import test from 'node:test';
import {compoundKey,isoDate,scaledDecimal,signedMovement} from '../../apps/collector/src/institutional-normalize.ts';
test('normaliza data, moeda e chave sem perder precisão',()=>{assert.equal(isoDate('23/09/2026'),'2026-09-23');assert.equal(isoDate('inválida'),null);assert.equal(scaledDecimal('R$ 49.085.672,19'),4_908_567_219);assert.equal(compoundKey('a',2,null),'a\u001f2\u001f')});
test('movimentos de anulação e estorno têm sinal negativo',()=>{assert.equal(signedMovement('1.234,50','Anulação'),-123450);assert.equal(signedMovement('1.234,50','Pagamento'),123450)});
