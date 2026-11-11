import test from 'node:test';
import assert from 'node:assert/strict';
import { getProuniOverview, searchProuniInstitutions, getAccessProgramComparison, getFiesOverview } from '../../packages/db/src/exec/educacao-access-read.ts';

test('P11.4 overview preserva nulos e não converte bloqueio em zero', async () => {
  const q = { query: async (_sql: string, _args: unknown[]) => ({ rows: [{ year: 2025, granted: null, integral: null, partial: null, institutions: null, courses: null, municipalities: null }] }) };
  const rows = await getProuniOverview(q, { year: 2025, uf: 'ES' });
  assert.equal(rows[0].granted, null);
  assert.equal(rows[0].integral, null);
  assert.equal(rows[0].partial, null);
});

test('P11.4 busca ProUni limita paginação a 100', async () => {
  let argsSeen: unknown[] | undefined;
  const q = { query: async (_sql: string, args: unknown[]) => { argsSeen = args; return { rows: [] }; } };
  await searchProuniInstitutions(q, { text: 'universidade', page: 4, pageSize: 500 });
  assert.deepEqual(argsSeen, ['%universidade%', 100, 300]);
});

test('P11.4 comparação vazia retorna null quando não há snapshot territorial', async () => {
  const q = { query: async (_sql: string, _args: unknown[]) => ({ rows: [] }) };
  assert.equal(await getAccessProgramComparison(q, { program: 'FIES', year: 2022, scope: 'BR' }), null);
});

test('P11.4 série FIES mantém etapa e semestre', async () => {
  const q = { query: async (_sql: string, _args: unknown[]) => ({ rows: [{ year: 2022, semester: 1, stage: 'OFERTA', records: 0, institutions: 0, municipalities: 0 }] }) };
  const rows = await getFiesOverview(q, { year: 2022, semester: 1, stage: 'OFERTA' });
  assert.equal(rows[0].stage, 'OFERTA');
  assert.equal(rows[0].semester, 1);
});
