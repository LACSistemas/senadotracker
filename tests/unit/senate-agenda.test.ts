import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSenateCommissionAgenda } from '../../apps/collector/src/senate-agenda.ts';

test('normaliza itens de pauta e respeita o recorte publicado',()=>{
  const document={AgendaReuniao:{reunioes:{reuniao:[
    {codigo:'10',dataInicio:'2026-09-15T10:00:00.000',colegiadoCriador:{codigo:'40',sigla:'CCJ'},partes:{codigo:'1',itens:[{codigo:'100',ordem:'1',tipoPauta:'Pauta',nome:'PL 1/2026',doma:{codigoMateria:'500',identificacao:'PL 1/2026'}}]}},
    {codigo:'11',dataInicio:'2026-09-16T10:00:00.000',partes:{itens:{codigo:'101',doma:{codigoMateria:'501',identificacao:'PL 2/2026'}}}}
  ]}}};
  const rows=parseSenateCommissionAgenda(document,'raw-1','2026-01-01','2026-09-15');
  assert.equal(rows.length,1);
  assert.equal(rows[0]?.proposalId,'500');
  assert.equal(rows[0]?.occurredAt,'2026-09-15');
  assert.equal(rows[0]?.kind,'agenda_item');
  assert.deepEqual(JSON.parse(rows[0]!.value!),{meetingId:'10',itemId:'100',order:'1',agendaType:'Pauta',result:null,committee:'CCJ'});
});
