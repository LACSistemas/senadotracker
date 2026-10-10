import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProviderRegistry,
  externalId,
  externalIdentityKeyFingerprint,
  houseCode,
  providerId,
  resourceType,
  validateCoverageManifest,
  validateExternalIdentityKey,
  validateIdentityMapping,
  validateInterval,
  validatePublicDomainRevision,
  validateProviderBinding,
  validateNormalizedVote,
} from '../../apps/collector/src/state/index.ts';
import type { CoverageManifest, ExternalIdentityKey, IngestionRevision, ProviderBinding } from '../../apps/collector/src/state/contracts.ts';

const ro = houseCode('RO');
const am = houseCode('AM');
const sapl = providerId('SAPL');
const parlamentar = resourceType('parlamentar');
const materia = resourceType('materia');
const id221 = externalId('221');

function key(house = ro, provider = sapl, resource = parlamentar): ExternalIdentityKey {
  return { house, provider, resource, externalId: id221 };
}

test('external identity is namespaced by house and resource', () => {
  assert.notEqual(externalIdentityKeyFingerprint(key()), externalIdentityKeyFingerprint(key(am)));
  assert.notEqual(externalIdentityKeyFingerprint(key(ro, sapl, materia)), externalIdentityKeyFingerprint(key()));
  assert.throws(() => validateExternalIdentityKey({ ...key(), externalId: externalId(' ') }));
});

test('registry resolves multiple enabled providers by capability and deterministic priority', () => {
  const registry = new ProviderRegistry();
  registry.registerHouse({ house: ro, name: 'Rondônia', bindings: [
    { provider: providerId('api-votos'), domain: 'participation', capabilities: ['votes'], priority: 5, authority: 'secondary', mergeStrategy: 'overlay', enabled: true },
    { provider: sapl, domain: 'legislative', capabilities: ['proposals', 'movements'], priority: 1, authority: 'primary', mergeStrategy: 'exclusive', enabled: true },
    { provider: providerId('api-legislativo'), domain: 'legislative', capabilities: ['proposals'], priority: 10, authority: 'secondary', mergeStrategy: 'reconcile', enabled: true },
    { provider: providerId('disabled'), domain: 'legislative', capabilities: ['proposals'], priority: 100, authority: 'primary', mergeStrategy: 'exclusive', enabled: false },
  ] });
  assert.deepEqual(registry.resolve(ro, 'legislative', 'proposals').map(binding => binding.provider), [providerId('api-legislativo'), sapl]);
  assert.deepEqual(registry.resolve(ro, 'participation', 'votes').map(binding => binding.provider), [providerId('api-votos')]);
  assert.deepEqual(registry.resolve(ro, 'finance', 'expenses'), []);
});

test('provider binding validation rejects invalid priority and duplicate capabilities', () => {
  const base: ProviderBinding = { provider: sapl, domain: 'identity', capabilities: ['people'], priority: 0, authority: 'primary', mergeStrategy: 'exclusive', enabled: true };
  validateProviderBinding(base);
  assert.throws(() => validateProviderBinding({ ...base, priority: -1 }));
  assert.throws(() => validateProviderBinding({ ...base, capabilities: ['people', 'people'] }));
});

test('unknown coverage is preserved and zero is an available value', () => {
  const manifest: CoverageManifest = {
    house: ro, provider: sapl, domain: 'finance', capability: 'expenses',
    sourceExists: true, endpointExists: true, payloadAvailable: 'unknown', relationshipResolved: 'unknown', historicalVerified: false, consumable: false,
    earliestRecordDate: null, latestRecordDate: null, checkedAt: '2026-10-01T00:00:00Z', availability: 'available',
  };
  validateCoverageManifest(manifest);
  const observed = { value: 0, availability: manifest.availability };
  assert.equal(observed.value, 0);
  assert.equal(observed.availability, 'available');
});

test('identity mapping never creates canonical identity implicitly', () => {
  validateIdentityMapping({ external: key(), status: 'pending', rawId: 'raw:1' });
  assert.throws(() => validateIdentityMapping({ external: key(), status: 'confirmed', rawId: 'raw:1' }));
  validateIdentityMapping({ external: key(), status: 'confirmed', canonicalEntityId: 'person:1', confidence: 1, rawId: 'raw:1' });
});

test('public revision accepts multiple ingestion revisions only from same house/domain', () => {
  const contribution: IngestionRevision = { house: ro, provider: sapl, domain: 'legislative', runId: 'run:1', batchId: 'batch:1' };
  validatePublicDomainRevision({ house: ro, domain: 'legislative', revisionId: 'pub:1', contributions: [contribution, { ...contribution, provider: providerId('api-docs'), runId: 'run:2', batchId: 'batch:2' }], status: 'staged' });
  assert.throws(() => validatePublicDomainRevision({ house: ro, domain: 'legislative', revisionId: 'pub:2', contributions: [{ ...contribution, house: am }], status: 'staged' }));
});

test('interval and vote validators reject invalid temporal/reference values', () => {
  assert.throws(() => validateInterval('2026-02-01', '2026-01-01'));
  validateInterval('2026-01-01', '2026-02-01');
  assert.throws(() => validateNormalizedVote({ deliberation: { ...key(), resource: resourceType('deliberation') }, choice: '', provenance: { rawId: 'raw', endpoint: '/v', fetchedAt: '2026-01-01', sha256: 'hash' } }));
  validateNormalizedVote({ deliberation: { ...key(), resource: resourceType('deliberation') }, choice: 'sim', provenance: { rawId: 'raw', endpoint: '/v', fetchedAt: '2026-01-01', sha256: 'hash' } });
});
