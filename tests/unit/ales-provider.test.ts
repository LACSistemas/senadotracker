import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRegistry } from '../../apps/collector/src/state/registry.ts';
import { alesEsHouseConfig, registerAlesEs } from '../../apps/collector/src/state/providers/ales/config.ts';
import { mapPerson, parseParliamentarians, parseProposalDetail, parseProposalIds, personKey } from '../../apps/collector/src/state/providers/ales/mapper.ts';

const provenance = { rawId: 'raw:fixture', endpoint: 'https://www3.al.es.gov.br/', fetchedAt: '2026-10-02T00:00:00.000Z', sha256: 'fixture' };
test('ALES parliamentarian parser preserves official profile identity and party', () => {
  const html = `<a href='parlamentar.aspx?id=40' title='ADILSON ESPINDULA'><small>(PP)</small></a><a href='parlamentar.aspx?id=41' title='MARIA TESTE'><small>(MDB)</small></a>`;
  const records = parseParliamentarians(html); assert.deepEqual(records.map(x => [x.id, x.displayName, x.party]), [['40','ADILSON ESPINDULA','PP'],['41','MARIA TESTE','MDB']]);
  assert.deepEqual(mapPerson(records[0]!, provenance).key, personKey('40')); 
});
test('ALES proposal parser retains process id, author, status and movement dates', () => {
  const html = `<h1>Projeto de Lei 15/2022</h1><div>Ementa: Institui uma política</div><div>Data de Protocolo: 14/03/2022</div><div>Autor: Sergio Majeski</div><div>Situação: Arquivado</div><div>Histórico de tramitação 14/03/2022 Apresentação 20/04/2022 Arquivamento</div>`;
  const value = parseProposalDetail('136734', html); assert.equal(value.id, '136734'); assert.equal(value.number, '15'); assert.equal(value.year, 2022); assert.equal(value.author, 'Sergio Majeski'); assert.equal(value.movements.length, 2);
});
test('ALES proposal ids are deterministic and namespaced', () => { assert.deepEqual(parseProposalIds(`<a href='processo.aspx?id=136734'>x</a><a href='processo.aspx?id=136734'>y</a>`), ['136734']); });
test('ALES registry exposes only proven identity and legislative capabilities', () => { const registry = new ProviderRegistry(); registerAlesEs(registry); assert.equal(alesEsHouseConfig.house, 'ES'); assert.deepEqual(registry.resolve('ES' as never, 'identity', 'name').map(x => x.provider), ['ales_legislative']); assert.deepEqual(registry.resolve('ES' as never, 'legislative', 'proposals').map(x => x.provider), ['ales_legislative']); assert.equal(registry.resolve('ES' as never, 'finance', 'expenses').length, 0); });

