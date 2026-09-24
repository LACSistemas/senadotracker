import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '@senadotracker/db';
import { InstitutionalHttp } from '../../apps/collector/src/institutional-http.ts';
import { collectSenateProcurement } from '../../apps/collector/src/senate-procurement.ts';
import { collectSenateInstrumentDetails } from '../../apps/collector/src/senate-instrument-details.ts';

const jsonHttp = (answer: (url: string) => unknown, status: (url: string) => number = () => 200) =>
  new InstitutionalHttp({
    delayMs: 0,
    maxAttempts: 1,
    fetch: async input => {
      const url = String(input), code = status(url);
      return new Response(JSON.stringify(answer(url)), { status: code, headers: { 'content-type': 'application/json' } });
    }
  });

test('detalha ata sem converter garantia ou cobrança em pagamento', async () => {
  const db = openDatabase(':memory:'), rawDirectory = mkdtempSync(join(tmpdir(), 'civica-ata-'));
  const company = { nome: 'EMPRESA TESTE', cpf_cnpj: '11.385.361/0001-10' };
  const contract = { id: 2, numero: '20260002', empresa: company, objeto: 'Serviço' };
  const baseHttp = jsonHttp(url => url.includes('/empresas') ? [{ id: 1, ...company }]
    : url.includes('/contratos?') ? [contract]
    : url.endsWith('/licitacoes') ? [{ id: 3, numero: 'PE 1/2026', objeto: 'Licitação' }]
    : url.includes('/notas_empenho') ? [{ id: 4, numero: '2026NE1', empresa: company }]
    : [{ id: 7128, numero: 'ARP 1/2026', empresa: company, objeto: 'Registro de preços' }]);
  await collectSenateProcurement(db, { year: 2026, limit: 1, rawDirectory, http: baseHttp });

  const detailsHttp = jsonHttp(url => url.endsWith('/itens') ? [{ id: 91, descricao: 'Item registrado', quantidade: '3' }]
    : url.endsWith('/acionamentos') ? [{ id: 92, numero: 'AC 1', objeto: 'Unidade solicitante' }]
    : url.endsWith('/pagamentos') ? [{ id: 93, valor_cobrado: '1234.56' }]
    : [{ id: 94, descricao: 'Garantia contratual' }]);
  const first = await collectSenateInstrumentDetails(db, { rawDirectory, ids: ['7128'], http: detailsHttp });
  assert.equal(first.atas, 1);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM ata_items').get()?.n), 1);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM ata_activations').get()?.n), 1);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM financial_movements').get()?.n), 0);
  const payload = JSON.parse(String(db.prepare("SELECT payload FROM institutional_source_records WHERE entity_type='ata_detail'").get()?.payload));
  assert.equal(payload.availability.billings, 'available');
  assert.equal(payload.billings[0].valor_cobrado, '1234.56');

  await collectSenateInstrumentDetails(db, { rawDirectory, ids: ['7128'], http: detailsHttp });
  assert.equal(Number(db.prepare('SELECT count(*) n FROM ata_items').get()?.n), 1);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM ata_activations').get()?.n), 1);
  db.close();
});

test('endpoint opcional indisponível é ausência de cobertura, não ausência factual', async () => {
  const db = openDatabase(':memory:'), rawDirectory = mkdtempSync(join(tmpdir(), 'civica-ata-'));
  const company = { nome: 'EMPRESA TESTE', cpf_cnpj: '11.385.361/0001-10' };
  const baseHttp = jsonHttp(url => url.includes('/empresas') ? [{ id: 1, ...company }]
    : url.includes('/contratos?') ? [{ id: 2, numero: '20260002', empresa: company }]
    : url.endsWith('/licitacoes') ? [{ id: 3, numero: 'PE 1/2026', objeto: 'Licitação' }]
    : url.includes('/notas_empenho') ? [{ id: 4, numero: '2026NE1', empresa: company }]
    : [{ id: 7128, numero: 'ARP 1/2026', empresa: company }]);
  await collectSenateProcurement(db, { year: 2026, limit: 1, rawDirectory, http: baseHttp });
  const detailsHttp = jsonHttp(() => [], url => url.endsWith('/garantias') ? 404 : 200);
  await collectSenateInstrumentDetails(db, { rawDirectory, ids: ['7128'], http: detailsHttp });
  const payload = JSON.parse(String(db.prepare("SELECT payload FROM institutional_source_records WHERE entity_type='ata_detail'").get()?.payload));
  assert.equal(payload.availability.guarantees, 'unavailable');
  assert.equal(payload.availability.items, 'api_empty');
  db.close();
});
