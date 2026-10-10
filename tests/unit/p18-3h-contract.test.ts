import assert from 'node:assert/strict';
import test from 'node:test';
import { WAVE_B_HOUSES, WAVE_B_PROVIDER_MANIFESTS, createWaveBProvider } from '../../apps/collector/src/state/providers/state-finance/live-wave-b.ts';

const source = (house: string, provider: string) => ({
  body: JSON.stringify([{ id: 1, chave: `${house}-1`, ano: 2026, mes: 1, data_dueof: '2026-01-31', valor_dueof: '12.34', natureza_descricao: 'Cota parlamentar', linha: 'Cota parlamentar', cpf_cnpj: '00000000000191', nome_credor: 'Fonte oficial' }]),
  sourceUrl: `https://official.example/${house.toLowerCase()}`,
  contentType: 'application/json',
  rawId: `raw:test:${house}`,
});

test('P18.3H has a permanent Core manifest for exactly the nine Wave B targets', () => {
  assert.deepEqual([...WAVE_B_HOUSES], ['BA', 'ES', 'GO', 'MA', 'PA', 'PI', 'RO', 'RR', 'RS']);
  for (const house of WAVE_B_HOUSES) {
    const manifest = WAVE_B_PROVIDER_MANIFESTS[house];
    assert.equal(manifest.manifest.domain, 'finance');
    assert.equal(manifest.manifest.house, house);
    assert.match(manifest.providerVersion, /:finance:v1$/);
    assert.ok(manifest.sourceContract.startsWith('https://'));
  }
});

test('P18.3H source-native natural keys are deterministic and validate duplicates', async () => {
  const provider = createWaveBProvider('GO', source('GO', 'alego_transparencia'));
  const input = source('GO', 'alego_transparencia');
  assert.equal(provider.validateSource(input).ok, true);
  const first = await provider.parse(input);
  const second = await provider.parse(input);
  assert.deepEqual(first.map(row => row.key.externalId), second.map(row => row.key.externalId));
  assert.equal(provider.validateCanonical(first).ok, true);
  assert.equal(first[0]?.amountCents, 1234);
});

test('P18.3H invalid source fails closed before publication', () => {
  const provider = createWaveBProvider('GO', source('GO', 'alego_transparencia'));
  assert.equal(provider.validateSource({ body: '', sourceUrl: 'https://official.example/go', contentType: 'application/json' }).ok, false);
  assert.equal(provider.validateSource({ body: '[]', sourceUrl: 'https://official.example/go', contentType: 'application/json' }).ok, false);
});

test('P18.3H provider isolation leaves non-target houses outside manifests', () => {
  assert.equal(Object.keys(WAVE_B_PROVIDER_MANIFESTS).sort().join(','), 'BA,ES,GO,MA,PA,PI,RO,RR,RS');
});
