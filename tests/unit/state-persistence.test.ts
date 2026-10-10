import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePersistenceInput, statePersistencePool } from '../../apps/collector/src/state/persistence.ts';

const provenance = { rawId: 'raw:1', endpoint: 'https://sapl.test/resource', fetchedAt: '2026-10-02T00:00:00.000Z', sha256: 'a'.repeat(64) };
const key = (resource: string, externalId: string) => ({ house: 'RO', provider: 'sapl', resource, externalId });

function result(entities: any[]) {
  return {
    runId: 'run:1', rawEnvelopes: [{ ...provenance, house: 'RO', provider: 'sapl', resource: 'materia', endpoint: provenance.endpoint, params: {}, fetchedAt: provenance.fetchedAt, status: 200, contentType: 'application/json', rawId: provenance.rawId, body: '{}' }],
    batches: [{ ingestion: { house: 'RO', provider: 'sapl', domain: 'legislative', runId: 'run:1', batchId: 'batch:1' }, entities, relations: [], coverage: [] }],
    quality: { legislative: { status: 'PASS' } }, discovery: { schemaHash: 'b'.repeat(64) }, metrics: { requests: 1, retries: 0, failures: 0, latencyMs: 1 }, sanity: { observedInSlice: true, note: 'ok' }, publications: [], coverage: [],
  } as any;
}

test('P1.5 rejeita author órfão antes de qualquer publicação', () => {
  const author = { proposal: key('materia', 'missing'), actorType: 'parliamentarian', role: 'author', person: key('parlamentar', '1'), provenance };
  const checked = validatePersistenceInput(result([author]));
  assert.equal(checked.status, 'FAIL');
  assert.match(checked.errors.join('\n'), /orphan author/);
});

test('P1.5 exige alvo explícito do banco de laboratório', () => {
  assert.throws(() => statePersistencePool({ DB_NAME: 'projetoeleitor_db' }), /STATE_PERSISTENCE_DATABASE=civica_postgres_lab/);
});
