import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '@senadotracker/db';
import { InstitutionalHttp } from '../../apps/collector/src/institutional-http.ts';
import { collectPncpEnrichment } from '../../apps/collector/src/pncp-enrichment.ts';

test('PNCP é enriquecimento publicável sem inferir pagamento', async () => {
  const db = openDatabase(':memory:'), rawDirectory = mkdtempSync(join(tmpdir(), 'civica-pncp-'));
  const http = new InstitutionalHttp({ delayMs: 0, maxAttempts: 1, fetch: async input => {
    const url = new URL(String(input)), cnpj = url.searchParams.get('cnpjOrgao');
    return new Response(JSON.stringify({ data: [{ numeroControlePNCP: `${cnpj}-2-000001/2026`, anoContrato: 2026, sequencialContrato: 1, numeroContratoEmpenho: '1/2026', niFornecedor: '11.385.361/0001-10', valorInicial: 123.45 }], totalPaginas: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
  }});
  const result = await collectPncpEnrichment(db, { from: '2026-01-01', to: '2026-12-31', rawDirectory, http });
  assert.equal(result.results.length, 2);
  assert.equal(Number(db.prepare("SELECT count(*) n FROM institutional_source_records WHERE source_system='pncp'").get()?.n), 2);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM financial_movements').get()?.n), 0);
  db.close();
});

test('falha do PNCP permanece pendente e não derruba a execução das Casas', async () => {
  const db = openDatabase(':memory:'), rawDirectory = mkdtempSync(join(tmpdir(), 'civica-pncp-'));
  const http = new InstitutionalHttp({ delayMs: 0, maxAttempts: 1, fetch: async () => new Response('{"erro":"consulta indisponível"}', { status: 422 }) });
  const result = await collectPncpEnrichment(db, { from: '2026-01-01', to: '2026-01-02', rawDirectory, http });
  assert.equal(result.nonBlocking, true);
  assert.equal(result.results.every(item => Boolean((item as {pending?:boolean}).pending)), true);
  assert.equal(Number(db.prepare("SELECT count(*) n FROM institutional_collector_checkpoints WHERE collector='pncp-enrichment' AND status='pending'").get()?.n), 2);
  db.close();
});
