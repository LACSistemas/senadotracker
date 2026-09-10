import test from 'node:test';
import assert from 'node:assert/strict';
import { voteColor, voteDescription } from '../../apps/web/lib/vote-semantics.ts';

test('cores de voto distinguem sim, não e códigos sem inferir desconhecidos',()=>{assert.equal(voteColor('Sim'),'#16845b');assert.equal(voteColor('Não'),'#c43d4b');assert.notEqual(voteColor('P-NRV'),voteColor('AP'));assert.equal(voteColor('Código futuro'),'#64748b');assert.equal(voteDescription('P-NRV'),'Presente, não registrou voto');assert.equal(voteDescription('NCom'),'Não compareceu');assert.match(voteDescription('AP'),/Código literal/) });
