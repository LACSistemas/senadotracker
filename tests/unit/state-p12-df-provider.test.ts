import assert from 'node:assert/strict';
import test from 'node:test';
import { redact, mapProposal } from '../../apps/collector/src/state/providers/cldf-ple/index.ts';

const raw = { rawId: 'raw:test', endpoint: 'https://example.test', fetchedAt: '2026-01-01T00:00:00.000Z', sha256: 'sha' } as any;

test('P12 DF removes private fields before persistence', () => {
  const sanitized = redact(JSON.stringify({ loginRede: 'secret', ipUsuario: '10.0.0.1', nested: { loginRede: 'nested-secret' }, id: 159354 }));
  assert.equal(sanitized.includes('secret'), false);
  assert.equal(sanitized.includes('10.0.0.1'), false);
  assert.deepEqual(JSON.parse(sanitized), { nested: {}, id: 159354 });
});

test('P12 DF proposal identity is the public numeric id', () => {
  const proposal = mapProposal({ id: 159354, ementa: 'Teste', siglaTipoProposicao: 'PL', numero: 10, dataCadastro: '2026-01-02T00:00:00.000Z' }, raw);
  assert.equal(proposal.key.externalId, '159354');
  assert.equal(proposal.type, 'PL');
});
