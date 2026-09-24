import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSenatePca, parseSenateSanctions } from '../../apps/collector/src/senate-planning.ts';

const bytes=(value:string)=>new TextEncoder().encode(value);
test('PCA mantém planejamento separado de contratação e gasto',()=>{const rows=parseSenatePca(bytes('título;;;;;;;;;;;\n;Ano da inclusão da contratação no Plano;Situação da Contratação;Número Contratação;Título;Objeto;Justificativa da Necessidade;Tipo da Contratação;Utiliza Sistema de Registro de Preços?;Valor Autorizado pelo Comitê de Contratações;Número do Processo;O objeto já foi contratado?;\n;2026;Autorizada;20260001;Compra;Objeto;Motivo;Licitação;Não;R$ 1.234,56;00200.1/2026;Não;'));assert.equal(rows.length,1);assert.equal(rows[0]?.plannedValueScaled,123456);assert.equal(rows[0]?.number,'20260001')});
test('penalidade preserva fornecedor, espécie e vigência',()=>{const rows=parseSenateSanctions(bytes(';PROCESSO Nº;RAZÃO SOCIAL / NOME EMPRESARIAL;CONTRATO Nº;CNPJ;PORTARIA Nº;PUBLICAÇÃO;DATA PUBLICAÇÃO;CATEGORIA DE SANÇÃO;ABRANGÊNCIA;Quantidade;Unidade;INÍCIO DA VIGÊNCIA;TÉRMINO DA VIGÊNCIA;\n;00200.1/2026;EMPRESA;29/2025;20.278.105/0001-14;38/2026;DOU;27/04/2026;IMPEDIMENTO;UNIÃO;60;DIAS;27/04/2026;25/06/2026;'));assert.equal(rows.length,1);assert.equal(rows[0]?.kind,'IMPEDIMENTO');assert.equal(rows[0]?.endAt,'2026-06-25')});
