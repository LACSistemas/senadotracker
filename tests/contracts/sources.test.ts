import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import senate from '../fixtures/sources/senado-lista.json' with { type: 'json' };
import affiliations from '../fixtures/sources/senado-filiacoes.json' with { type: 'json' };
import firstPage from '../fixtures/sources/camara-lista.json' with { type: 'json' };
import secondPage from '../fixtures/sources/camara-page2.json' with { type: 'json' };
import history from '../fixtures/sources/camara-historico.json' with { type: 'json' };

test('Senado: suplência e exercício são dimensões diferentes', () => {
  const substitute = senate.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.find(p => p.IdentificacaoParlamentar.CodigoParlamentar === '5936');
  assert.ok(substitute);
  assert.equal(substitute.Mandato.DescricaoParticipacao, '1º Suplente');
  assert.equal(substitute.Mandato.Titular?.CodigoParlamentar, '751');
  const exercise = substitute.Mandato.Exercicios.Exercicio[0];
  assert.ok(exercise);
  assert.equal(exercise.DataInicio, '2020-11-03');
  assert.notEqual(exercise.DataInicio, substitute.Mandato.PrimeiraLegislaturaDoMandato.DataInicio);
  assert.equal(Object.hasOwn(exercise, 'DataFim'), false);
});

test('Senado: resposta preserva exercícios encerrados e lacuna entre filiações', () => {
  const senator = senate.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.find(p => p.IdentificacaoParlamentar.CodigoParlamentar === '6336');
  assert.ok(senator);
  assert.ok(senator.Mandato.Exercicios.Exercicio.some(e => 'DataFim' in e && e.DataFim === '2025-02-03'));
  const entries = affiliations.FiliacaoParlamentar.Parlamentar.Filiacoes.Filiacao;
  assert.equal(entries.find(e => e.Partido.SiglaPartido === 'UNIÃO')?.DataDesfiliacao, '2025-11-10');
  assert.ok(entries.some(e => e.DataFiliacao === '2025-11-12'));
});

test('Câmara: o link next conecta duas páginas, sem repetir identidades', () => {
  const next = firstPage.links.find(link => link.rel === 'next');
  const self = secondPage.links.find(link => link.rel === 'self');
  assert.ok(next);
  assert.equal(next.href, self?.href);
  const ids = [...firstPage.dados, ...secondPage.dados].map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const person of [...firstPage.dados, ...secondPage.dados]) {
    assert.ok(Number.isSafeInteger(person.id));
    assert.equal(new URL(person.uri).pathname, `/api/v2/deputados/${person.id}`);
  }
  assert.ok(secondPage.links.some(link => link.rel === 'next'), 'a amostra não encerra o cadastro');
});

test('Câmara: evento nulo após fim de mandato não equivale a exercício', () => {
  const ended = history.dados.find(row => row.situacao === 'FIM_MANDATO');
  const last = history.dados.at(-1);
  assert.ok(ended);
  assert.ok(last);
  assert.ok(last.dataHora > ended.dataHora);
  assert.equal(last.situacao, null);
  assert.equal(last.condicaoEleitoral, null);
  assert.ok(history.dados.some(row => row.situacao === 'Licença'));
  assert.ok(new Set(history.dados.map(row => row.siglaPartido)).size > 1);
  assert.equal(/(?:Z|[+-]\d{2}:\d{2})$/.test(last.dataHora), false);
});

test('fixtures têm integridade e proveniência de respostas oficiais, sem representar cobertura completa', async () => {
  const directory = new URL('../fixtures/sources/', import.meta.url);
  const files = (await readdir(directory)).filter(name => name.endsWith('.provenance.json') && !name.includes('votacao'));
  assert.equal(files.length, 7);
  for (const file of files) {
    const provenance = JSON.parse(await readFile(new URL(file, directory), 'utf8')) as {
      url: string; fetchedAt: string; status: number; rawResponseSha256: string; fixtureSha256: string; isCompleteDataset: boolean;
    };
    const bytes = await readFile(new URL(file.replace('.provenance', ''), directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.fixtureSha256);
    assert.match(provenance.rawResponseSha256, /^[a-f0-9]{64}$/);
    assert.equal(provenance.status, 200);
    assert.ok(['legis.senado.leg.br', 'dadosabertos.camara.leg.br'].includes(new URL(provenance.url).hostname));
    assert.ok(Number.isFinite(Date.parse(provenance.fetchedAt)));
    assert.equal(provenance.isCompleteDataset, false);
    assert.doesNotMatch(bytes.toString('utf8'), /"(?:cpf|email|EmailParlamentar|Telefones)"\s*:/);
  }
});
