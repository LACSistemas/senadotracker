import assert from 'node:assert/strict';
import test from 'node:test';
import { SaplClient, SaplDiscovery, runRoSlice } from '../../apps/collector/src/state/providers/sapl/index.ts';

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input));
  const data: unknown = url.pathname.endsWith('/schema/') ? {
    openapi: '3.0.3', paths: {
      '/api/parlamentares/parlamentar/': {}, '/api/parlamentares/mandato/': {}, '/api/parlamentares/filiacao/': {},
      '/api/materia/materialegislativa/': {}, '/api/materia/autoria/': {}, '/api/materia/tramitacao/': {},
    },
  } : url.pathname.endsWith('/parlamentar/') ? { count: 1, results: [{ id: 29, nome: 'Parlamentar RO', nome_parlamentar: 'PR RO', ativo: true }] } : url.pathname.endsWith('/mandato/') ? { count: 1, results: [{ id: 1, parlamentar: 29, data_inicio_mandato: '2023-02-01', data_fim_mandato: null, legislatura: 11 }] } : url.pathname.endsWith('/filiacao/') ? { count: 1, results: [{ id: 2, parlamentar: 29, partido: 7, partido_nome: 'PARTIDO RO', data_filiacao: '2023-02-01', data_desfiliacao: null }] } : url.pathname.endsWith('/materialegislativa/') ? { count: 1, results: [{ id: 57929, numero: 1, ano: 2026, tipo: 22, ementa: 'Matéria de teste', data_apresentacao: '2026-01-10', em_tramitacao: true }] } : url.pathname.endsWith('/autoria/') ? { count: 1, results: [{ id: 57808, primeiro_autor: true, autor: 29, materia: 57929 }] } : { count: 1, results: [{ id: 117039, materia: 57929, data_tramitacao: '2026-02-01', status: 12, unidade_tramitacao_local: 52 }] };
  return Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } }));
}

test('SaplDiscovery calcula versão, endpoints, capabilities e schema hash', async () => {
  const client = new SaplClient({ baseUrl: 'https://sapl.test', fetch: mockFetch, delayMs: 0 });
  const result = await new SaplDiscovery(client).discover();
  assert.equal(result.providerDetected, 'sapl');
  assert.equal(result.version, '3.0.3');
  assert.equal(result.capabilities.proposals, 'supported');
  assert.equal(result.capabilities.movements, 'supported');
  assert.ok(result.schemaHash);
  assert.match(result.schemaHash!, /^[a-f0-9]{64}$/);
  assert.equal(result.drift.drift, false);
  const drifted = await new SaplDiscovery(client).discover('0'.repeat(64));
  assert.equal(drifted.drift.drift, true);
});

test('RO slice preserva raw, normaliza relações e publica dois domínios em memória', async () => {
  const client = new SaplClient({ baseUrl: 'https://sapl.test', fetch: mockFetch, delayMs: 0 });
  const result = await runRoSlice({ client, pageSize: 10, maxPages: 1, sanity: { authorshipId: '57808', proposalId: '57929', movementId: '117039' } });
  assert.equal(result.batches.length, 2);
  assert.equal(result.batches[0]?.ingestion.house, 'RO');
  assert.equal(result.batches[0]?.ingestion.provider, 'sapl');
  assert.equal(result.rawEnvelopes.length, 7);
  assert.equal(result.quality.identity?.status, 'PASS');
  assert.equal(result.quality.legislative?.status, 'PASS');
  assert.equal(result.publications.every(publication => publication.revision.status === 'active'), true);
  assert.equal(result.sanity.observedInSlice, true);
  assert.equal(result.batches[1]?.entities.some(entity => 'movementKey' in entity), true);
  assert.equal(result.batches[1]?.entities.some(entity => 'role' in entity && 'person' in entity), true);
});

test('Sapl client retrya falha transitória sem alterar contrato de paginação', async () => {
  let attempts = 0;
  const fetch = async (): Promise<Response> => { attempts++; if (attempts === 1) return new Response('temporário', { status: 503, headers: { 'content-type': 'application/json' } }); return new Response(JSON.stringify({ results: [{ id: 1 }] }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const client = new SaplClient({ baseUrl: 'https://sapl.test', fetch, delayMs: 0, sleep: async () => undefined });
  const page = await client.page('/api/parlamentares/parlamentar/', { pageSize: 10, maxPages: 1 });
  assert.equal(page.records.length, 1);
  assert.equal(client.metrics.retries, 1);
});

test('Sapl client percorre páginas até o cursor terminar', async () => {
  let page = 0;
  const fetch = async (): Promise<Response> => {
    page++;
    const body = page === 1 ? { results: [{ id: 1 }], next: 'page-2' } : { results: [{ id: 2 }], next: null };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = new SaplClient({ baseUrl: 'https://sapl.test', fetch, delayMs: 0 });
  const result = await client.page('/api/materia/materialegislativa/', { pageSize: 1, maxPages: 3 });
  assert.deepEqual(result.records.map(record => record.id), [1, 2]);
  assert.equal(page, 2);
});
