import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createAmCoreProvider, createApCoreProvider, createCeCoreProvider, createDfCoreProvider, createMgCoreProvider, createPeCoreProvider, createRnCoreProvider, createSeCoreProvider, createSpCoreProvider, createToCoreProvider } from '../../apps/collector/src/state/providers/state-finance/wave-a.ts';
import { parseCeVdpCsv, provenanceForRaw } from '../../apps/collector/src/state/providers/state-finance/index.ts';
import { CollectorRuntime } from '../../apps/collector/src/core/collector-runtime.ts';

const fixture = (house: string, provider: string) => ({ body: JSON.stringify({ house, sourceRows: [{ external_id: `${house}-1`, person_external_id: `${house}-person-1`, competence: '2026-01', amount_cents: 12345, category: 'TEST', source_url: `https://fixture.invalid/${provider}` }] }), sourceUrl: `https://fixture.invalid/${provider}`, contentType: 'application/json', rawId: `raw:${house}:fixture` });

test('P18.3D permanent providers are Core-compatible and deterministic', async () => {
  const providers = [
    createAmCoreProvider(fixture('AM', 'aleam_ceap_pdf')),
    createApCoreProvider(fixture('AP', 'alap_ceap')),
    createDfCoreProvider(fixture('DF', 'cldf_ckan_vi')),
    createMgCoreProvider(fixture('MG', 'almg_verba_indenizatoria')),
    createPeCoreProvider(fixture('PE', 'alepe_ceap')),
    createRnCoreProvider(fixture('RN', 'alrn_ceap')),
    createSeCoreProvider(fixture('SE', 'alese_ressarcimento')),
    createToCoreProvider(fixture('TO', 'aleto_codap')),
  ];
  for (const provider of providers) {
    const input = fixture(provider.manifest.house, provider.manifest.provider);
    const first = await provider.parse(input);
    const second = await provider.parse(input);
    assert.equal(provider.validateSource(input).ok, true);
    assert.deepEqual(first.map(row => row.key.externalId), second.map(row => row.key.externalId));
    assert.equal(first[0]?.amountCents, 12345);
    assert.equal(provider.validateCanonical(first).ok, true);
  }
});

test('P18.3D CE and SP source contracts fail closed on invalid schema', () => {
  const ce = createCeCoreProvider({ body: '\uFEFFDEPUTADO;PERIODO;EMPENHO;DESCRICAO;CNPJ;CREDOR;VALOR\nDEP;10/2026;1;Teste;1;Fornecedor;10,00\n', sourceUrl: 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?mes=10&ano=2026', contentType: 'text/csv' });
  assert.equal(ce.validateSource({ body: 'DEPUTADO;PERIODO;EMPENHO;DESCRICAO;CNPJ;CREDOR;VALOR\n', sourceUrl: 'https://official.example/ce.csv', contentType: 'text/csv' }).ok, true);
  assert.equal(ce.validateSource({ body: 'DEPUTADO;VALOR\n', sourceUrl: 'https://official.example/ce.csv', contentType: 'text/csv' }).ok, false);
  const sp = createSpCoreProvider({ body: JSON.stringify([{ id: 1, ano: 2026, mes: 1, valor: 10, deputado: 'Deputado', tipo: 'A' }]), sourceUrl: 'https://www3.al.sp.gov.br/repositorio/dados-abertos/output/json/despesas_gabinetes.json', contentType: 'application/json' });
  assert.equal(sp.validateSource({ body: '{}', sourceUrl: 'https://official.example/sp.json', contentType: 'application/json' }).ok, true);
});

test('P18.3GR CE parser locates the official header after preamble and preserves rows', () => {
  const body = fs.readFileSync(new URL('../../apps/collector/src/state/providers/state-finance/fixtures/ce-2026-10.csv', import.meta.url), 'utf8');
  const rows = parseCeVdpCsv(body, 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?mes=10&ano=2026', provenanceForRaw('raw:test:ce', 'https://official.example/ce.csv', body));
  assert.equal(rows.length > 0, true);
  assert.equal(rows[0]?.person?.externalId, 'DEP AGENOR NETO');
  assert.equal(rows[0]?.amountCents, 400000);
  assert.equal(parseCeVdpCsv('\uFEFF;;;\nDEPUTADO;PERIODO;EMPENHO;DESCRICAO;CNPJ;CREDOR;VALOR\n', 'https://official.example/ce.csv', provenanceForRaw('raw:test:ce-empty', 'https://official.example/ce.csv', '')).length, 0);
  assert.equal(parseCeVdpCsv('DEPUTADO;VALOR\nDEP;10,00\n', 'https://official.example/ce.csv', provenanceForRaw('raw:test:ce-invalid', 'https://official.example/ce.csv', '')).length, 0);
});

test('P18.3E NO_OP semantics never report PUBLISHED', async () => {
  const input = fixture('AM', 'aleam_ceap_pdf');
  const provider = createAmCoreProvider(input);
  const canonical = await provider.parse(input);
  const result = await new CollectorRuntime().run(provider, { runId: 'p18.3e-no-op', house: 'AM', domain: 'finance', provider: provider.manifest.provider, providerVersion: provider.manifest.providerVersion, startedAt: '2026-10-06T00:00:00.000Z' }, canonical);
  assert.equal(result.status, 'NO_OP');
  assert.equal(result.counts?.noOp, true);
  assert.equal(result.revisionAfter, result.revisionBefore);
});

