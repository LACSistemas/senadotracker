import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseCards, parseDxEnvelope, parseStateObject } from '../../apps/collector/src/state/providers/alepa-devexpress/index.ts';

const searchFixture = fs.readFileSync('artifacts/alepa_callback_search.txt', 'utf8');
const pageFixture = fs.readFileSync('artifacts/alepa_card_response.txt', 'utf8');

test('ALEPA DevExpress callback fixtures expose independent state and HTML', () => {
  const search = parseDxEnvelope(searchFixture); const page = parseDxEnvelope(pageFixture);
  const searchCards = parseCards(search.html); const pageCards = parseCards(page.html);
  assert.equal(searchCards.length, 10); assert.equal(pageCards.length, 10);
  assert.equal(search.pageCount, 185); assert.equal(page.pageCount, 185);
  assert.equal(new Set(searchCards.map(card => card.id)).size, 10); assert.equal(new Set(pageCards.map(card => card.id)).size, 10);
  assert.notDeepEqual(searchCards.map(card => card.id), pageCards.map(card => card.id));
  assert.ok(search.state.keys.every(key => searchCards.some(card => card.id === key)));
  assert.ok(page.state.keys.every(key => pageCards.some(card => card.id === key)));
});

test('ALEPA identity is IdProposicao and callback state is not semantic content', () => {
  const parsed = parseDxEnvelope(searchFixture); const cards = parseCards(parsed.html); assert.ok(cards.every(card => /^\d+$/.test(card.id)));
  const changed = searchFixture.replace(parsed.state.callbackState, `${parsed.state.callbackState}X`);
  const changedParsed = parseDxEnvelope(changed);
  assert.deepEqual(parseCards(changedParsed.html).map(card => ({ id: card.id, type: card.type, number: card.number, year: card.year, presentedAt: card.presentedAt, ementa: card.ementa })), cards.map(card => ({ id: card.id, type: card.type, number: card.number, year: card.year, presentedAt: card.presentedAt, ementa: card.ementa })));
  assert.equal(parseStateObject(searchFixture).keys.length, 10);
});

test('ALEPA parser fails closed for malformed envelope and missing proposal identity', () => {
  assert.throws(() => parseDxEnvelope('/*DX*/{}/*DXHTML*/<div>broken</div>'), /missing card view/);
  assert.throws(() => parseCards(`<div onclick='onCardClick("/Legislativo/DetalhesProposicao?tipo=PL")'><h3>DEP</h3></div>`), /missing IdProposicao/);
});
