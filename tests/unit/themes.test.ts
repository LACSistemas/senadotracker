import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCamaraThemes } from '../../apps/collector/src/themes.ts';

test('temas anuais da Câmara vinculam somente proposições ativas e preservam o nome oficial',()=>{
  const bytes=new TextEncoder().encode(JSON.stringify({dados:[{uriProposicao:'https://dadosabertos.camara.leg.br/api/v2/proposicoes/10',codTema:40,tema:'Economia',relevancia:0},{uriProposicao:'https://dadosabertos.camara.leg.br/api/v2/proposicoes/11',codTema:70,tema:'Finanças Públicas e Orçamento',relevancia:0}]}));
  const rows=parseCamaraThemes(bytes,'raw-1',2026,new Set(['10']));
  assert.equal(rows.length,1);assert.equal(rows[0]?.proposalId,'10');assert.equal(rows[0]?.label,'Economia');assert.equal(rows[0]?.value,null);assert.equal(rows[0]?.externalKey,'theme:10:40');
});
