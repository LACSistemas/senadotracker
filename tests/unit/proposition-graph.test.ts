import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeAuthors, PROPOSITION_GRAPH_SCHEMA_SQL, AMENDMENT_GROUP } from '../../packages/db/src/postgres-proposition-graph.ts';
import { parsePrincipalProposal } from '../../apps/collector/src/principal-proposal-parser.ts';

test('dedupeAuthors remove repetição do mesmo parlamentar e preserva coautores distintos', () => {
  const rows = [
    { name: 'Luis Carlos Heinze', party: null, uf: null, externalId: null },
    { name: 'Luis Carlos Heinze', party: 'PP', uf: 'RS', externalId: '1' },
    { name: 'Luis Carlos Heinze', party: 'PP', uf: 'RS', externalId: '1' },
    { name: 'Nikolas Ferreira', party: 'PL', uf: 'MG', externalId: '2' },
  ];
  const result = dedupeAuthors(rows);
  assert.equal(result.length, 2);
  assert.equal(result.find(a => a.name === 'Luis Carlos Heinze')?.party, 'PP');
  assert.ok(result.some(a => a.name === 'Nikolas Ferreira'));
});

test('dedupeAuthors ignora acentos e caixa ao comparar nomes', () => {
  assert.equal(dedupeAuthors([{ name: 'João Cury' }, { name: 'JOAO CURY' }]).length, 1);
  assert.equal(dedupeAuthors([{ name: 'Joao Silva' }, { name: 'Joao Souza' }]).length, 2);
});

test('o schema do grafo cria o índice pai → filhos e as tabelas de suporte, de forma idempotente', () => {
  const sql = PROPOSITION_GRAPH_SCHEMA_SQL.join('\n');
  assert.match(sql, /CREATE INDEX IF NOT EXISTS proposals_principal_idx ON civica_poc\.proposals \(source, batch_id, principal_id, functional_group\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS civica_poc\.proposal_support /);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS civica_poc\.principal_resolution_queue/);
  assert.equal(AMENDMENT_GROUP, 'emendas_substitutivos');
});

test('o parser do pai histórico preserva o ano real e marca a matéria como suporte', () => {
  const response = (data: unknown) => ({ data, rawId: 'raw', fetchedAt: '2026-10-01T00:00:00Z', url: 'x' });
  const { proposal, themes } = parsePrincipalProposal(
    response({ dados: { id: 2233802, siglaTipo: 'PEC', numero: 221, ano: 2019, ementa: 'Reduz a jornada.', dataApresentacao: '2019-12-11T17:37', uriPropPrincipal: null, statusProposicao: { descricaoSituacao: 'Aguardando Apreciação pelo Senado Federal' } } }),
    response({ dados: [{ codTema: 46, tema: 'Direito Constitucional', relevancia: 1 }] }), '2603808');
  assert.equal(proposal.label, 'PEC 221/2019');
  assert.equal(proposal.year, 2019);
  assert.equal(proposal.catalogRole, 'relationship_support');
  assert.equal(proposal.principalProposalId, null);
  assert.equal(themes[0]?.label, 'Direito Constitucional');
});
