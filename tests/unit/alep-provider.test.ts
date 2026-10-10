import assert from 'node:assert/strict';
import test from 'node:test';
import { AlepClient, AlepDiscovery, alepPrHouseConfig, AlepMapper, registerAlepPr, runAlepSlice } from '../../apps/collector/src/state/providers/alep/index.ts';
import { ProviderRegistry } from '../../apps/collector/src/state/index.ts';

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  if (url.pathname.endsWith('/proposicao/campos')) return Promise.resolve(json({ campos: ['codigo', 'ementa', 'autor', 'tramites'] }));
  if (url.pathname.endsWith('/proposicao/filtrar')) { assert.equal(init?.method, 'POST'); return Promise.resolve(json({ lista: [{ codigo: 113430, ementa: 'Proposta PR', siglaTipoProposicao: 'PL', numero: 1, ano: 2025, dataEntrada: '2025-01-03' }], total: 5468 })); }
  if (url.pathname.endsWith('/proposicao/113430')) return Promise.resolve(json({ codigo: 113430, ementa: 'Proposta PR', autor: 'Deputado Teste', tramites: [{ codigo: 7001, data: '2025-01-04', local: 'Plenário', observacao: 'Recebida' }] }));
  throw new Error(`unexpected ${url.pathname}`);
}
function json(value: unknown): Response { return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } }); }

test('ALEP client/discovery preservam provider, HTTP e schema hash', async () => {
  const client = new AlepClient({ baseUrl: 'http://alep.test/api/public', fetch: fakeFetch, delayMs: 0 });
  const discovery = await new AlepDiscovery(client).discover();
  assert.equal(discovery.providerDetected, 'alep_api');
  assert.ok(discovery.schemaHash);
  assert.equal(discovery.schemaEnvelope.house, 'PR');
  assert.equal(discovery.schemaEnvelope.provider, 'alep_api');
});

test('ALEP slice normaliza proposta, authorRaw e trâmite com revisão determinística', async () => {
  const client = new AlepClient({ baseUrl: 'http://alep.test/api/public', fetch: fakeFetch, delayMs: 0 });
  const first = await runAlepSlice({ client, year: 2025, maxRecords: 1, detailLimit: 1, runId: 'test:alep' });
  const second = await runAlepSlice({ client: new AlepClient({ baseUrl: 'http://alep.test/api/public', fetch: fakeFetch, delayMs: 0 }), year: 2025, maxRecords: 1, detailLimit: 1, runId: 'test:alep' });
  assert.equal(first.publications[0]?.revision.status, 'active');
  assert.equal(first.publications[0]?.revision.revisionId, second.publications[0]?.revision.revisionId);
  assert.equal(first.coverage.find(value => value.capability === 'proposals')?.recordsFound, 1);
  assert.equal(first.batches[0]?.entities.some(value => 'authorRaw' in value && value.authorRaw === 'Deputado Teste'), true);
  assert.equal(first.batches[0]?.entities.some(value => 'movementKey' in value && value.movementKey === '7001'), true);
  assert.equal(first.rawEnvelopes.every(value => value.body), true);
});

test('ALEP registry registra a configuração PR exclusiva', () => {
  const registry = new ProviderRegistry(); registerAlepPr(registry);
  assert.deepEqual(registry.resolve('PR' as never, 'legislative', 'proposals'), [alepPrHouseConfig.bindings[0]]);
  assert.equal(alepPrHouseConfig.bindings[0]?.mergeStrategy, 'exclusive');
});

test('ALEP mapper não inventa identidade de autor', () => {
  const mapper = new AlepMapper();
  const proposal = mapper.key('proposicao', '113430');
  const author = mapper.author({ autor: 'Texto oficial' }, proposal, { rawId: 'raw:1', endpoint: '/p', fetchedAt: '2026-01-01', sha256: 'abc' });
  assert.equal(author.authorRaw, 'Texto oficial');
  assert.equal(author.person, undefined);
  assert.equal(author.actorExternalKey, undefined);
});
