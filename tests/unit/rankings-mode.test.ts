import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardQuery, groupHouse, modeHref, parseMode, queryFor, queryHref, type Params } from '../../apps/web/app/legislativo/rankings/query.ts';

// Regressão do bug descrito no plano: sem `mode` explícito em `queryHref`, ordenar, paginar ou baixar o
// CSV num modo agregado voltava o visitante a Parlamentares em silêncio.
test('queryHref carrega o modo em ordenação e paginação, e o omite em Parlamentares',()=>{
  const query=dashboardQuery({ordem:'cost_desc',ano:'2026'});
  assert.equal(queryHref(query,'partidos',{page:2}),'/legislativo/rankings?modo=partidos&ano=2026&ordem=cost_desc&pagina=2');
  assert.equal(queryHref(query,'estados'),'/legislativo/rankings?modo=estados&ano=2026&ordem=cost_desc');
  // Parlamentares é o padrão: a URL fica limpa, sem `modo=parlamentares` poluindo todo link existente.
  assert.equal(queryHref(query,'parlamentares'),'/legislativo/rankings?ano=2026&ordem=cost_desc');
});

test('queryHref aceita um caminho alternativo, para o CSV reusar a mesma leitura de query',()=>{
  const query=dashboardQuery({modo:'partidos',casa:'senado'});
  assert.equal(queryHref(query,'partidos',{},'/legislativo/rankings/baixar'),'/legislativo/rankings/baixar?modo=partidos&casa=senado');
});

test('parseMode cai em Parlamentares para qualquer valor que não seja um dos três modos',()=>{
  assert.equal(parseMode('partidos'),'partidos');
  assert.equal(parseMode('estados'),'estados');
  assert.equal(parseMode('parlamentares'),'parlamentares');
  assert.equal(parseMode(undefined),'parlamentares');
  assert.equal(parseMode('cargo'),'parlamentares');
  assert.equal(parseMode(''),'parlamentares');
});

test('trocar de sujeito descarta filtro de pessoa e preserva Casa, ano e ordenação',()=>{
  const query=dashboardQuery({casa:'camara',uf:'SP',partido:'PT',busca:'ana',ordem:'proposals_desc',ano:'2026',pagina:'3'});
  const forParty=queryFor(query,'partidos');
  // UF, partido e busca filtram pessoa; no modo agregado, UF/partido também nomeiam o agrupamento —
  // mantê-los seria filtro e agrupamento pela mesma chave ao mesmo tempo.
  assert.equal(forParty.uf,undefined);
  assert.equal(forParty.party,undefined);
  assert.equal(forParty.search,undefined);
  assert.equal(forParty.source,'camara');
  assert.equal(forParty.sort,'proposals_desc');
  assert.equal(forParty.year,2026);
  assert.equal(forParty.page,1);
  // Parlamentares não descarta nada: é o único modo em que UF/partido/busca são filtros de verdade.
  assert.deepEqual(queryFor(query,'parlamentares'),query);
});

test('modeHref para um modo agregado sem Casa assume a Câmara, o maior universo',()=>{
  const query=dashboardQuery({});
  assert.equal(groupHouse(undefined),'camara');
  assert.equal(groupHouse('senado'),'senado');
  assert.match(modeHref(query,'estados'),/casa=camara/);
  assert.match(modeHref(dashboardQuery({casa:'senado'}),'estados'),/casa=senado/);
});

test('dashboardQuery ignora ordenação desconhecida e cai em nome',()=>{
  const params:Params={ordem:'inexistente'};
  assert.equal(dashboardQuery(params).sort,'name');
});
