import assert from 'node:assert/strict';
import test from 'node:test';
import { countsAsParticipation } from '@senadotracker/db';

test('Senado conta posições de voto e exclui estados sem voto registrado', () => {
  for (const value of ['Sim', 'Não', 'Abstenção', 'Votou']) assert.equal(countsAsParticipation('senado', value), true);
  for (const value of ['P-NRV', 'NCom', 'AP', 'LS', 'MIS', 'LP', 'LAP', 'Presidente (art. 51 RISF)']) assert.equal(countsAsParticipation('senado', value), false);
});

test('Câmara conta obstrução, mas não vazio ou Artigo 17', () => {
  for (const value of ['Sim', 'Não', 'Abstenção', 'Obstrução', 'Secreto']) assert.equal(countsAsParticipation('camara', value), true);
  for (const value of ['', '---', 'Artigo 17']) assert.equal(countsAsParticipation('camara', value), false);
});
