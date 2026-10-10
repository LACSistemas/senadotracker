import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAuthorship, actorKindFromCamaraTipoAutor, actorKindFromSenadoSiglaTipo, rankingOf, NON_RANKABLE_ROLES } from '../../packages/domain/src/authorship.ts';

const camara = (type: string, tipoAutor = 'Deputado(a)', proponent: string | number | boolean | null = 1) => classifyAuthorship({ house: 'camara', type, actor: actorKindFromCamaraTipoAutor(tipoAutor), proponent });

test('Altineu Côrtes: PRL é relatoria; REQ, PEC e EMP têm papéis distintos', () => {
  assert.equal(camara('PRL').role, 'rapporteurship');
  assert.equal(camara('REQ').role, 'request_authorship');
  assert.equal(camara('PEC').role, 'legislative_authorship');
  assert.equal(camara('EMP').role, 'amendment_authorship');
  assert.deepEqual(['PRL', 'REQ', 'PEC', 'EMP'].map(t => rankingOf(camara(t).role)), ['rapporteurship', 'requests', 'legislative', 'amendments']);
});

test('comissões e órgãos nunca viram parlamentares/autores legislativos', () => {
  for (const tipoAutor of ['COMISSÃO PERMANENTE', 'COMISSÃO ESPECIAL', 'COMISSÃO MISTA PERMANENTE', 'COMISSÃO MEDIDA PROVISÓRIA', 'COMISSÃO DIRETORA', 'Órgão da Câmara dos Deputados', 'GRUPO DE TRABALHO']) {
    for (const type of ['PL', 'REQ', 'PAR', 'EMC-A', 'SBT-A', 'PRL']) assert.equal(camara(type, tipoAutor).role, 'committee_author', `${type} por ${tipoAutor}`);
  }
  assert.equal(rankingOf('committee_author'), null);
});

test('coautor/apoio não é tratado como proponente principal', () => {
  assert.equal(camara('PL', 'Deputado(a)', 0).role, 'coauthor_support');
  assert.equal(camara('REQ', 'Deputado(a)', '0').role, 'coauthor_support');
  assert.equal(camara('PL', 'Deputado(a)', 1).role, 'legislative_authorship');
  assert.equal(rankingOf('coauthor_support'), null);
});

test('institucional, procedimental e ambíguo ficam fora dos rankings de proposições', () => {
  assert.equal(camara('MSC', 'Órgão do Poder Executivo').role, 'institutional_author');
  assert.equal(camara('DOC', 'Plenário Virtual CN').role, 'institutional_author');
  assert.equal(camara('PL', 'Sociedade Civil').role, 'institutional_author');
  assert.equal(camara('RPD').role, 'procedural_act'); assert.equal(camara('DTQ').role, 'procedural_act');
  assert.equal(camara('DOC').role, 'ambiguous');
  assert.equal(classifyAuthorship({ house: 'camara', type: 'PL', actor: 'unknown' }).role, 'ambiguous');
  for (const role of NON_RANKABLE_ROLES) assert.equal(rankingOf(role), null, role);
});

test('relatoria e peças do relator são D, não "emenda apresentada" nem "proposição"', () => {
  for (const type of ['PRL', 'PRLP', 'PRLE', 'PPP', 'PEP', 'PES', 'PPR', 'CVO', 'REL', 'RLP', 'RDF', 'SBT', 'SBR', 'EMR']) assert.equal(camara(type).code, 'D', type);
  for (const type of ['EMC', 'EMP', 'ESB', 'EMA', 'ERD', 'SSP']) assert.equal(camara(type).code, 'A3', type);
});

test('Senado: senador autor de PL/REQ, Câmara e Presidência como institucional, comissão como comissão', () => {
  const senado = (type: string, siglaTipo: string) => classifyAuthorship({ house: 'senado', type, actor: actorKindFromSenadoSiglaTipo(siglaTipo) });
  assert.equal(senado('PL', 'SENADOR').role, 'legislative_authorship');
  assert.equal(senado('REQ', 'SENADOR').role, 'request_authorship');
  assert.equal(senado('RQS', 'SENADOR').role, 'request_authorship');
  assert.equal(senado('PDL', 'CAMARA').role, 'institutional_author');
  assert.equal(senado('MPV', 'PRESIDENCIA').role, 'institutional_author');
  assert.equal(senado('REQ', 'COMISSAO').role, 'committee_author');
  assert.equal(senado('PL', 'DEPUTADO').role, 'legislative_authorship');
  // valores reais de siglaTipo em `autoriaIniciativa`
  assert.equal(senado('REQ', 'COMISSAO_SENADO').role, 'committee_author'); assert.equal(senado('PL', 'COMISSAO_CAMARA').role, 'committee_author');
  assert.equal(senado('REQ', 'LIDER').role, 'institutional_author'); assert.equal(senado('PL', 'CIDADAO').role, 'institutional_author'); assert.equal(senado('MPV', 'PRESIDENTE_REPUBLICA').role, 'institutional_author');
});
