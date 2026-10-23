import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanStatus, kindOf } from '../../apps/web/lib/presence-kinds.ts';

test('kindOf classifica os status literais da Câmara', () => {
  assert.equal(kindOf('Presença'), 'present');
  assert.equal(kindOf('Presença (~)'), 'present_partial');
  assert.equal(kindOf('Ausência'), 'absent');
  assert.equal(kindOf('Licença-Gestante'), 'leave');
  assert.equal(kindOf('Missão Autorizada'), 'mission');
  assert.equal(kindOf('Decisão da Mesa'), 'official');
  assert.equal(kindOf('Atendimento a Obrigação Político-Partidária'), 'official');
});

test('cleanStatus só remove o rótulo duplicado da fonte', () => {
  assert.equal(cleanStatus('Decisão da Mesa Decisão da Mesa'), 'Decisão da Mesa');
  assert.equal(cleanStatus('Decisão da Presidência Decisão da Presidência'), 'Decisão da Presidência');
  assert.equal(cleanStatus('Presença'), 'Presença');
  assert.equal(cleanStatus('Missão Autorizada'), 'Missão Autorizada');
});
