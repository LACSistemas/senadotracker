import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateSenateExecutionRows,parseSenateContractualExpenses,parseSenateExecutionDetail,reconciledDetailedPhases } from '../../apps/collector/src/senate-financial-execution.ts';

test('execução do Senado distingue empenhado, liquidado e pago pela NE exata', () => {
  const html = `<table id="tabDespesasContratuais"><tbody><tr>
    <td><a href="https://senado/2025NE000400">2025NE000400</a></td><td>OUTRAS DESPESAS</td><td>SERVIÇOS DE TI</td>
    <td class="valor">264.146,79</td><td class="valor">260.000,00</td><td class="valor">250.000,00</td>
  </tr></tbody></table>`;
  const [row] = parseSenateContractualExpenses(html);
  assert.equal(row?.commitmentNumber, '2025NE000400');
  assert.equal(row?.committedScaled, 26_414_679);
  assert.equal(row?.liquidatedScaled, 26_000_000);
  assert.equal(row?.paidScaled, 25_000_000);
});

test('detalhe SIAFI preserva data, exercício, restos e anulação',()=>{const html=`<div id="collapseDocumentosRelacionados"><table><tbody>
<tr><td>04/11/2021</td><td>PAGAMENTO</td><td><a href="detalhe_documento.asp?DOCUMENTO=2021OB1">2021OB1</a></td><td>1</td><td>12</td><td>Serviço</td><td>Empresa</td><td>1.000,00</td></tr>
<tr><td>10/02/2022</td><td>ANULAÇÃO PAGAMENTO</td><td>2022OB2</td><td>2</td><td>12</td><td>Serviço</td><td>Empresa</td><td>100,00</td></tr>
</tbody></table></div>`,rows=parseSenateExecutionDetail(html,2021);assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>[row.phase,row.movementYear,row.amountSignedScaled,row.restosAPagar]),[['payment',2021,100000,false],['payment',2022,-10000,true]])});

test('linhas da mesma NE por elemento de despesa são somadas antes do vínculo',()=>{const rows=aggregateSenateExecutionRows([{commitmentNumber:'2025NE000398',detailUrl:'u',expenseGroup:'A',expenseElement:'X',committedScaled:100,liquidatedScaled:90,paidScaled:80},{commitmentNumber:'2025NE000398',detailUrl:'u',expenseGroup:'B',expenseElement:'Y',committedScaled:200,liquidatedScaled:190,paidScaled:180}]);assert.equal(rows.length,1);assert.deepEqual([rows[0]?.committedScaled,rows[0]?.liquidatedScaled,rows[0]?.paidScaled],[300,280,260])});

test('detalhe divergente não substitui o total oficial agregado',()=>{const movement={sourceId:'OB1:1:payment',phase:'payment' as const,kind:'documento',occurredAt:'2026-01-01',movementYear:2026,amountSignedScaled:200,restosAPagar:false,detailUrl:'u'},result=reconciledDetailedPhases([movement],{commitment:100,liquidation:100,payment:100});assert.equal(result.accepted.has('payment'),false);assert.deepEqual(result.conflicts,['payment'])});
