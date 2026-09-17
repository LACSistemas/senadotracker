import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCamaraAgenda } from '../../apps/collector/src/camara-agenda.ts';

test('normaliza pauta deliberativa da Câmara com o escopo do evento',()=>{
  const rows=parseCamaraAgenda({dados:[{ordem:2,topico:'Ordem do Dia',regime:'Urgência',proposicao_:{id:123,siglaTipo:'PL',numero:7,ano:2026}}]},'raw-1',{id:'99',date:'2026-09-15',scope:'plenario'});
  assert.equal(rows.length,1);assert.equal(rows[0]?.proposalId,'123');assert.equal(rows[0]?.label,'PL 7 2026');assert.equal(rows[0]?.occurredAt,'2026-09-15');assert.equal(JSON.parse(rows[0]!.value!).scope,'plenario');
});
