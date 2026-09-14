import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSenateProcess, senateProcessId } from '../../apps/collector/src/senate-processes.ts';

test('identifica o processo na resposta de detalhe do Senado',()=>{
  assert.equal(senateProcessId({DetalheMateria:{Materia:{IdentificacaoMateria:{IdentificacaoProcesso:'9095355'}}}}),'9095355');
});

test('normaliza assuntos e tramitação do processo do Senado',()=>{
  const rows=parseSenateProcess({id:9095355,identificacao:'PLP 114/2026',dataInicioEfetivo:'2026-08-12',situacaoAtual:'TRANSFORMADA EM NORMA JURÍDICA',classificacoes:[{codigo:1,descricaoHierarquia:'Política Social / Proteção Social'}],autuacoes:[{situacoes:[{idTipo:25,descricao:'APROVADA',inicio:'2026-08-12',fim:'2026-08-14'}],informesLegislativos:[{id:7,data:'2026-08-12 19:00:00',descricao:'Projeto aprovado.'}],movimentacoes:[{id:8,dataEnvio:'2026-08-14 10:00:00',enteOrigem:{sigla:'A'},enteDestino:{sigla:'B'}}]}]},'raw-1','175446');
  assert.deepEqual(rows.map(row=>row.kind),['matter_detail','theme','situation','movement','movement']);
  assert.equal(rows[1]?.label,'Política Social / Proteção Social');
  assert.equal(rows[3]?.value,null);
  assert.ok(rows.every(row=>row.proposalId==='175446'&&row.source==='senado'));
});
