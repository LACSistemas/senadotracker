import test from 'node:test';
import assert from 'node:assert/strict';
import { mapMarkup } from '../../apps/web/components/brazil-map-markup.ts';
import { markupUfs, paintStateMap, type StatePaint } from '../../apps/web/components/state-map-paint.ts';

const paint=(fill:string,extra:Partial<StatePaint>={}):StatePaint=>({fill,title:'titulo',...extra});

test('o mapa base mantém as 27 UFs e a navegação por href',()=>{
  const ufs=markupUfs(mapMarkup);
  assert.equal(ufs.length,27);
  assert.equal(new Set(ufs).size,27);
  assert.ok(ufs.includes('DF'));
  assert.match(mapMarkup,/href="\/quem-me-representa\?uf=SP"/);
  assert.match(mapMarkup,/<title id="map-title">/);
  assert.match(mapMarkup,/aria-labelledby="map-title map-description"/);
});

test('cada UF pintada alcança path e o disco de chamada na mesma regra',()=>{
  const painted=paintStateMap(mapMarkup,new Map([['SE',paint('var(--map-5)')]]),{variant:'metric-map',description:'teste',emptyFill:'var(--map-empty)'});
  // SE tem <path class="circle">; sem o seletor .circle o disco ficaria com a cor de "sem dado".
  assert.ok(painted.includes('.metric-map .estado[data-uf="SE"] path,.metric-map .estado[data-uf="SE"] .circle{fill:var(--map-5)}'));
  assert.ok(painted.includes('class="brazil-map metric-map"'));
});

test('UF sem valor recebe o cinza de ausência, nunca o tom mais claro da rampa',()=>{
  const painted=paintStateMap(mapMarkup,new Map([['SP',paint('var(--map-4)')]]),{variant:'metric-map',description:'teste',emptyFill:'var(--map-empty)'});
  assert.ok(painted.includes('.metric-map .estado path,.metric-map .estado .circle{fill:var(--map-empty)}'));
  assert.ok(!painted.includes('data-uf="AC"] path,.metric-map .estado[data-uf="AC"] .circle{fill:'));
});

test('tom escuro troca a tinta do rótulo e o halo protege o meio-tom',()=>{
  const painted=paintStateMap(mapMarkup,new Map([['SP',paint('var(--map-5)',{ink:'#fff'})]]),{variant:'metric-map',description:'teste',emptyFill:'var(--map-empty)'});
  assert.ok(painted.includes('.metric-map .estado[data-uf="SP"] text{fill:#fff;stroke:none}'));
  assert.ok(painted.includes('paint-order:stroke fill'));
});

test('tooltip nativo e aria-label carregam o valor; o href pode ser redirecionado',()=>{
  const painted=paintStateMap(mapMarkup,new Map([['SP',paint('var(--map-3)',{title:'São Paulo: R$ 10 · n=70',ariaLabel:'R$ 10, mediana de 70 observações'})]]),{variant:'metric-map',description:'teste',emptyFill:'var(--map-empty)',href:uf=>`/destino/${uf}`});
  assert.match(painted,/data-uf="SP" aria-label="São Paulo \(SP\): R\$ 10, mediana de 70 observações"><title>São Paulo: R\$ 10 · n=70<\/title>/);
  assert.ok(painted.includes('href="/destino/SP"'));
  assert.ok(painted.includes('href="/destino/AC"'));
  assert.ok(!painted.includes('href="/quem-me-representa?uf=SP"'));
});

test('texto injetado é escapado para não romper o SVG',()=>{
  const painted=paintStateMap(mapMarkup,new Map([['SP',paint('var(--map-1)',{title:'a "b" <c> & d'})]]),{variant:'metric-map',description:'desc <b>',emptyFill:'#fff'});
  assert.ok(painted.includes('<title>a &quot;b&quot; &lt;c&gt; &amp; d</title>'));
  assert.ok(painted.includes('desc &lt;b&gt;'));
});
