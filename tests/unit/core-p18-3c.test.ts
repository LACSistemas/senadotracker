import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectorRuntime, InMemoryRevisionRepository } from '../../apps/collector/src/core/index.ts';
import { createMsCeapCoreProvider } from '../../apps/collector/src/state/providers/state-finance/ms-core.ts';

const header = 'Deputado;CPF/CNPJ;Ano;Mes;Documento;Valor (R$);Categoria;Fornecedor;Emissao';
const fixture = `${header}\nAline Silva;001;2026;Janeiro;NF-1;123,45;Combustível;Posto A;01/01/2026\nAline Silva;001;2026;Fevereiro;NF-2;200,00;Diárias;Hotel B;02/02/2026\n`;

test('P18.3C MS Core adapter preserves deterministic current keys while remaining known-deferred', async () => {
  const provider = createMsCeapCoreProvider({ body: fixture, rawId: 'raw:p18-3c-ms' });
  const runtime = new CollectorRuntime();
  const repo = new InMemoryRevisionRepository<readonly import('../../apps/collector/src/state/contracts.ts').NormalizedExpense[]>();
  const result = await runtime.run(provider, { runId: 'p18-3c-ms-1', house: 'MS', domain: 'finance', provider: 'alms_ceap_csv', providerVersion: 'alms_ceap_csv:v1', startedAt: '2026-10-06T00:00:00.000Z' }, [], repo);
  assert.equal(result.status, 'PUBLISHED');
  assert.equal(result.counts?.added, 2);
  assert.equal(result.counts?.duplicateLogicalIds, 0);
  const parsed = await provider.parse({ body: fixture, rawId: 'raw:p18-3c-ms' });
  assert.equal(new Set(parsed.map(row => row.key.externalId)).size, 2);
  assert.ok(parsed.every(row => /^[0-9a-f]{64}$/.test(String(row.key.externalId))));
  assert.deepEqual(parsed.map(row => row.amountCents), [12345, 20000]);
  assert.deepEqual(parsed.map(row => row.competence), ['2026-01', '2026-02']);
});

test('P18.3C MS Core adapter is deterministic and fail-closed on schema drift', async () => {
  const input = { body: fixture, rawId: 'raw:p18-3c-ms' };
  const provider = createMsCeapCoreProvider(input);
  const first = await provider.parse(input);
  const second = await provider.parse(input);
  assert.deepEqual(first.map(row => row.key.externalId), second.map(row => row.key.externalId));
  assert.equal(provider.validateSource(input).ok, true);
  assert.equal(provider.validateSource({ body: 'Deputado;Ano\nAline;2026' }).ok, false);
  const invalid = await provider.validateCanonical([{ ...first[0]!, key: { ...first[0]!.key, externalId: '' as never } }]);
  assert.equal(invalid.ok, false);
});

