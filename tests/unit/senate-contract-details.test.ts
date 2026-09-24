import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSenateContractPortal } from '../../apps/collector/src/senate-contract-details.ts';
import { collectSenateContractDetails } from '../../apps/collector/src/senate-contract-details.ts';
import { InstitutionalHttp } from '../../apps/collector/src/institutional-http.ts';
import { openDatabase } from '@senadotracker/db';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('fallback do Senado separa cobrança, documento fiscal, empenho e liquidação', () => {
  const main = '<table><tr><th>Valores</th><td>R$&nbsp;<span>830.702,28</span> (Global)</td></tr></table>';
  const payments = `
    <dl class="dl-horizontal">
      <dt>Descrição da Despesa:</dt><dd>Nota Fiscal nº 16730</dd>
      <dt>Valor cobrado</dt><dd>R$ 1.816.692,00</dd><dt>Multa</dt><dd>R$ 0,00</dd><dt>Glosa</dt><dd>R$ 10,00</dd><dt>Data</dt><dd>29/10/2021</dd>
      <table summary="tabela de documentos fiscais"><tbody><tr><td>16730</td><td>25/10/2021</td><td>24/11/2021</td><td>-</td></tr></tbody></table>
    </dl>
    <div id="empenhos"><table><tbody><tr><td>NE 1730/2021</td><td>SERVIÇOS DE TI</td><td>R$ 957.720,00</td><td>R$ 957.720,00</td><td>R$ 0,00</td></tr></tbody></table></div>`;
  const parsed = parseSenateContractPortal(main, payments);
  assert.equal(parsed.currentValueScaled, 83_070_228);
  assert.equal(parsed.billings[0]?.billedValueScaled, 181_669_200);
  assert.equal(parsed.billings[0]?.documentNumber, '16730');
  assert.equal(parsed.commitments[0]?.committedValueScaled, 95_772_000);
  assert.equal(parsed.commitments[0]?.liquidatedValueScaled, 95_772_000);
  assert.equal('paidValueScaled' in parsed.commitments[0]!, false);
});

test('PagamentoDto é cobrança e filhos preservam documento fiscal e empenho', async () => {
  const db=openDatabase(':memory:'),rawDirectory=mkdtempSync(join(tmpdir(),'civica-senado-detail-'));
  const http=new InstitutionalHttp({delayMs:0,maxAttempts:1,fetch:async input=>{const url=String(input);let body:unknown=[];let contentType='application/json';
    if(/\/pagamentos$/.test(url))body=[{id:8,valor_cobrado:'100.50',data:'2026-03-01'}];
    else if(url.endsWith('/pagamentos/8/empenhos'))body=[{id:9,numero:'2026NE000009',valor_empenhado:'90.00'}];
    else if(url.endsWith('/pagamentos/8/documentos_fiscais'))body=[{id:10,numero:'NF-10',data_emissao:'2026-02-28'}];
    else if(/\/contratos\/77$/.test(url)){body='<h2>Contrato 77/2026</h2>';contentType='text/html'}
    else if(url.endsWith('/pagamentos/')){body='<html></html>';contentType='text/html'}
    return new Response(typeof body==='string'?body:JSON.stringify(body),{status:200,headers:{'content-type':contentType}})}});
  await collectSenateContractDetails(db,{ids:['77'],rawDirectory,http});
  assert.equal(Number(db.prepare('SELECT billed_value_scaled n FROM contract_billings').get()?.n),10050);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM fiscal_documents').get()?.n),1);
  assert.equal(Number(db.prepare('SELECT committed_value_scaled n FROM commitments').get()?.n),9000);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM financial_movements').get()?.n),0);
  db.close();
});
