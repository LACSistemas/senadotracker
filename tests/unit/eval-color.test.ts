import test from 'node:test';
import assert from 'node:assert/strict';
import type { Availability } from '@senadotracker/domain';
import { evalArrow, evalFillClass, evalLabel, evalTextClass, evalTone, evalVar, toneLegend } from '../../apps/web/lib/eval-color.ts';

const worse=(availability:Availability='available',sampleSize=81)=>({median:100,p10:20,p90:200,direction:'higher-is-worse' as const,availability,sampleSize});
const better=(availability:Availability='available',sampleSize=81)=>({median:.8,p10:.5,p90:.95,direction:'higher-is-better' as const,availability,sampleSize});

test('custo alto acende e custo baixo fica em verde',()=>{
  assert.equal(evalTone(250,worse()),'alert');
  assert.equal(evalTone(200,worse()),'alert');
  assert.equal(evalTone(150,worse()),'watch');
  assert.equal(evalTone(100,worse()),'good');
  assert.equal(evalTone(10,worse()),'good');
});

test('presença baixa acende: a cauda de alerta acompanha a direção da métrica',()=>{
  assert.equal(evalTone(.3,better()),'alert');
  assert.equal(evalTone(.5,better()),'alert');
  assert.equal(evalTone(.7,better()),'watch');
  assert.equal(evalTone(.8,better()),'good');
  assert.equal(evalTone(.99,better()),'good');
});

test('cobertura insuficiente nunca recebe verde nem vermelho',()=>{
  for(const availability of ['unavailable','stale','not_applicable'] as Availability[])assert.equal(evalTone(250,worse(availability)),'unknown',availability);
  assert.equal(evalTone(250,{...worse(),availability:'partial',sampleSize:4}),'unknown');
  assert.equal(evalTone(250,{...worse(),availability:'partial',sampleSize:40}),'alert');
  assert.equal(evalTone(250,{...worse(),availability:'partial',sampleSize:4,minSample:3}),'alert');
  assert.equal(evalTone(null,worse()),'unknown');
  assert.equal(evalTone(Number.NaN,worse()),'unknown');
  assert.equal(evalTone(250,{...worse(),median:null}),'unknown');
  assert.equal(evalTextClass('unknown'),'text-muted-foreground');
});

test('universo sem caudas não emite juízo, só posição relativa',()=>{
  assert.equal(evalTone(150,{...worse(),p90:null}),'watch');
  assert.equal(evalTone(50,{...worse(),p90:null}),'typical');
  assert.equal(evalTone(.4,{...better(),p10:null}),'watch');
  assert.equal(evalTone(.9,{...better(),p10:null}),'typical');
  assert.equal(evalArrow('typical','higher-is-worse'),'');
});

test('seta segue a direção para a cor nunca viajar sozinha',()=>{
  assert.equal(evalArrow('alert','higher-is-worse'),'↑');
  assert.equal(evalArrow('good','higher-is-worse'),'↓');
  assert.equal(evalArrow('alert','higher-is-better'),'↓');
  assert.equal(evalArrow('good','higher-is-better'),'↑');
  assert.equal(evalArrow('unknown','higher-is-worse'),'');
  assert.notEqual(evalLabel('alert','higher-is-worse'),evalLabel('alert','higher-is-better'));
});

test('tokens de tom são estáveis e a legenda cobre o indisponível',()=>{
  assert.deepEqual(['good','typical','watch','alert','unknown'].map(tone=>evalVar(tone as 'good')),['var(--eval-good)','var(--eval-typical)','var(--eval-watch)','var(--eval-alert)','var(--eval-unknown)']);
  assert.equal(evalFillClass('alert'),'bg-eval-alert');
  const legend=toneLegend('higher-is-worse');
  assert.equal(legend.length,4);
  assert.equal(new Set(legend.map(item=>item.color)).size,4);
  assert.ok(legend.some(item=>item.color==='var(--eval-unknown)'));
});
