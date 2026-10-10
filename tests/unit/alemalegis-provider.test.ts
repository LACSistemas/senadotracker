import assert from 'node:assert/strict';
import test from 'node:test';
import { ProviderRegistry } from '../../apps/collector/src/state/registry.ts';
import { alemalegisMaHouseConfig, registerAlemalegisMa } from '../../apps/collector/src/state/providers/alemalegis/config.ts';
import { author, movement, person, proposal, proposalKey } from '../../apps/collector/src/state/providers/alemalegis/mapper.ts';

const p = { rawId: 'raw:sha256:test', endpoint: 'https://alemalegis.al.ma.leg.br/api/v1/public/test', fetchedAt: '2026-10-02T00:00:00.000Z', sha256: 'test' };

test('ALEMALEGIS registers MA without touching SAPL and exposes only proven capabilities', () => {
  const registry = new ProviderRegistry(); registerAlemalegisMa(registry);
  assert.equal(alemalegisMaHouseConfig.house, 'MA');
  assert.deepEqual(registry.resolve('MA' as never, 'identity', 'name').map(x => x.provider), ['alemalegis']);
  assert.equal(registry.resolve('MA' as never, 'identity', 'party').length, 0);
  assert.deepEqual(registry.resolve('MA' as never, 'legislative', 'proposals').map(x => x.provider), ['alemalegis']);
  assert.equal(registry.resolve('MA' as never, 'finance', 'expenses').length, 0);
});

test('ALEMALEGIS mapper preserves provider and house namespaces and canonical relations', () => {
  const personValue = person({ id: 158, fullName: 'Júnior Vieira', activeInHouse: 'ACTIVE' }, p);
  const proposalValue = proposal({ id: 101336, matterTypeSigla: 'PLO', number: '267', year: '2026', ement: 'Utilidade pública' }, p);
  const authorValue = author({ author: { parliamentary: { id: 158 } } }, proposalValue.key, p);
  const movementValue = movement({ id: 111214, legislativeMatterId: 101336, matterDate: '2026-10-01', actionText: 'Tramitação inicial' }, proposalKey(101336), p);
  assert.equal(personValue.key.house, 'MA'); assert.equal(personValue.key.provider, 'alemalegis'); assert.equal(personValue.key.externalId, '158');
  assert.equal(proposalValue.key.resource, 'materia'); assert.equal(authorValue?.person?.externalId, '158'); assert.equal(movementValue.proposal.externalId, '101336');
});
