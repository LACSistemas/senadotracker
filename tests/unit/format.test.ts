import test from 'node:test';
import assert from 'node:assert/strict';
import { absent, brl, compact, count, metricValue, multiple, percent } from '../../apps/web/lib/format.ts';

const clean=(value:string)=>value.replace(/ /g,' ');

test('ausência é explícita e nunca vira zero',()=>{
  for(const rendered of [brl(null),percent(null),count(null),compact(null),multiple(null)])assert.equal(rendered,absent);
  assert.equal(metricValue(null,'cents'),absent);
  assert.equal(clean(brl(0)),'R$ 0');
  assert.equal(count(0),'0');
});

test('moeda respeita centavos e o número de dígitos pedido',()=>{
  assert.equal(clean(brl(123456)),'R$ 1.235');
  assert.equal(clean(brl(123456,2)),'R$ 1.234,56');
  assert.equal(clean(brl(-500,2)),'-R$ 5,00');
});

test('razão vira percentual e múltiplo ganha o sinal de vezes',()=>{
  assert.equal(percent(.784),'78,4%');
  assert.equal(percent(.784,0),'78%');
  assert.equal(multiple(1.44),'1,4×');
});

test('unidade da métrica escolhe o formato, para a régua não conhecer centavos',()=>{
  assert.equal(clean(metricValue(250000,'cents')),'R$ 2.500');
  assert.equal(metricValue(.5,'ratio'),'50%');
  assert.equal(metricValue(12,'count'),'12');
  assert.equal(compact(1500),'1.500');
  assert.equal(clean(compact(15000)),'15 mil');
});
