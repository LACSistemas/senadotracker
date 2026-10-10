import test from 'node:test';
import assert from 'node:assert/strict';
import { amendmentCodeOf, authorCodeOfAmendment, authoringWindow, buildRosterIndex, classifyEnte, crossHouseCandidates, isProfileAttributable, parseBrDecimal, resolveAuthorCode, ufSigla, type RosterRecord } from '../../packages/domain/src/budget.ts';
import { parsePolicyAreas } from '../../packages/db/src/postgres-budget.ts';
import { csvRows, parsePortalAmendmentsCsv, parsePortalPaymentsCsv } from '../../apps/collector/src/postgres-pix-portal.ts';

const rec = (house: 'camara' | 'senado', externalId: string, personKey: string, names: string[], ufs: string[], exercises: Array<[string, string | null]>): RosterRecord =>
  ({ house, externalId, personKey, names, ufs, exercises: exercises.map(([start, end]) => ({ start, end })) });
const resolve = (roster: RosterRecord[], code: string, names: string[], ufs: string[], years: number[]) => resolveAuthorCode({ code, names, ufs, years }, buildRosterIndex(roster));

test('código da emenda: 12 dígitos, autor SIOP nas posições 5–8; formas inválidas viram null', () => {
  assert.equal(amendmentCodeOf('202040870001-Carlos Viana'), '202040870001');
  assert.equal(amendmentCodeOf('202040870001'), '202040870001');
  assert.equal(amendmentCodeOf('20204087001'), null);
  assert.equal(amendmentCodeOf(null), null);
  assert.equal(authorCodeOfAmendment('202040870001'), '4087');
  assert.throws(() => authorCodeOfAmendment('4087'));
});

test('decimal brasileiro, ente e UF não inventam valor', () => {
  assert.equal(parseBrDecimal('1.234.567,89'), 1234567.89);
  assert.equal(parseBrDecimal('0,00'), 0);
  assert.equal(parseBrDecimal(''), null);
  assert.equal(classifyEnte('MUNICIPIO DE PAU D:ARCO DO PIAUI'), 'municipio');
  assert.equal(classifyEnte('ESTADO DA PARAIBA'), 'estado');
  assert.equal(classifyEnte('ALVORADA DO SUL'), 'outro');
  assert.equal(ufSigla('AMAPÁ'), 'AP'); assert.equal(ufSigla('MÚLTIPLO'), null); assert.equal(ufSigla('Sem informação'), null); assert.equal(ufSigla('sp'), 'SP');
});

test('áreas de política pública viram pares função/subfunção', () => {
  const parsed = parsePolicyAreas('15-Urbanismo / 451-Infraestrutura Urbana , 10-Saúde / 301-Atenção Básica');
  assert.deepEqual(parsed.map(p => [p.functionCode, p.subfunctionCode]), [[15, 451], [10, 301]]);
  assert.deepEqual(parsePolicyAreas(null), []);
});

test('EXACT: nome exato + UF + exercício na janela de autoria em todos os anos', () => {
  const roster = [rec('camara', '10', 'p1', ['Fulano Silva'], ['SP'], [['2019-02-01', null]])];
  const r = resolve(roster, '4001', ['Fulano Silva'], ['SP'], [2023, 2024]);
  assert.equal(r.cls, 'EXACT'); assert.equal(r.byYear[2023]?.recordKey, 'camara:10'); assert.equal(r.method, 'name_exact+exercise+uf');
});

test('o código SIOP numérico nunca casa com id da Câmara/Senado', () => {
  const roster = [rec('senado', '3777', 'p-eduardo', ['Eduardo Gomes'], ['TO'], [['2019-02-01', null]])];
  const r = resolve(roster, '3777', ['Vitor Lippi'], ['PR'], [2022]);
  assert.equal(r.cls, 'UNMATCHED'); assert.equal(r.personKey, null);
});

test('homônimos pai/filho: o período decide (Átila Lira), sem AMBIGUOUS', () => {
  const roster = [
    rec('camara', '74459', 'pai', ['Átila Lira'], ['PI'], [['2019-02-01', '2023-01-31']]),
    rec('camara', '123086', 'filho', ['Átila Lira'], ['PI'], [['2023-02-01', null]]),
  ];
  const first = resolve(roster, '1935', ['Átila Lira'], ['PI'], [2021, 2022, 2023]);
  const second = resolve(roster, '4309', ['Átila Lira'], ['PI'], [2024, 2025, 2026]);
  assert.equal(first.cls, 'EXACT'); assert.equal(first.byYear[2023]?.recordKey, 'camara:74459');
  assert.equal(second.cls, 'EXACT'); assert.equal(second.byYear[2024]?.recordKey, 'camara:123086');
});

test('AMBIGUOUS quando dois homônimos têm exercício na janela do mesmo ano', () => {
  const roster = [rec('camara', '1', 'a', ['Maria Souza'], ['BA'], [['2019-02-01', null]]), rec('camara', '2', 'b', ['Maria Souza'], ['BA'], [['2023-02-01', null]])];
  const r = resolve(roster, '4500', ['Maria Souza'], ['BA'], [2024]);
  assert.equal(r.cls, 'AMBIGUOUS'); assert.equal(r.personKey, null);
});

test('troca de Casa: a mesma pessoa tem um código por Casa e o ano da emenda segue a janela de autoria', () => {
  // deputado até 2023-01-31, senador depois (mesma pessoa, nome civil igual)
  const roster = [
    rec('camara', '141422', 'civil:efraim', ['Efraim Filho'], ['PB'], [['2019-02-01', '2023-01-31']]),
    rec('senado', '4642', 'civil:efraim', ['Efraim Filho'], ['PB'], [['2023-02-01', null]]),
  ];
  const camara = resolve(roster, '2449', ['Efraim Filho'], ['PB'], [2020, 2021, 2022, 2023]);
  const senado = resolve(roster, '4270', ['Efraim Filho'], ['PB'], [2024, 2025, 2026]);
  assert.equal(camara.cls, 'EXACT'); assert.equal(senado.cls, 'EXACT');
  assert.deepEqual(Object.values(camara.byYear).map(v => v?.house), ['camara', 'camara', 'camara', 'camara']);
  assert.deepEqual(Object.values(senado.byYear).map(v => v?.house), ['senado', 'senado', 'senado']);
  assert.equal(camara.personKey, senado.personKey, 'mesma pessoa, dois códigos, Casas diferentes');
});

test('HIGH: exercício só no ano da emenda (suplente que assume), nunca EXACT', () => {
  const roster = [rec('camara', '9', 'p', ['Joseildo Ramos'], ['BA'], [['2021-03-01', null]])];
  const r = resolve(roster, '4190', ['Joseildo Ramos'], ['BA'], [2021]);
  assert.equal(r.cls, 'HIGH'); assert.deepEqual(r.fallbackYears, [2021]);
});

test('HIGH: UF da emenda (aplicação) diferente da UF do parlamentar; HIGH: nome com tratamento removido', () => {
  const roster = [rec('camara', '204374', 'bia', ['Bia Kicis'], ['DF'], [['2019-02-01', null]]), rec('camara', '73806', 'rose', ['Roseana Sarney'], ['MA'], [['2019-02-01', null]])];
  const uf = resolve(roster, '3919', ['Bia Kicis'], ['SP'], [2024]);
  assert.equal(uf.cls, 'HIGH'); assert.equal(uf.reason, 'uf_of_emenda_differs_from_parliamentarian_uf');
  const title = resolve(roster, '1651', ['Dep. Roseana Sarney'], ['MA'], [2024]);
  assert.equal(title.cls, 'HIGH'); assert.equal(title.reason, 'name_stripped_title');
});

test('sem exercício datado não há atribuição: nome achado + histórico vazio = CONFLICT sem pessoa (caso 1270)', () => {
  const roster = [rec('camara', '141458', 'bacelar-filho', ['João Carlos Bacelar'], ['BA'], []), rec('camara', '69871', 'bacelar', ['Bacelar'], ['BA'], [['2015-02-01', null]])];
  const r = resolve(roster, '1270', ['João Carlos Bacelar'], ['BA'], [2020, 2021, 2022]);
  assert.ok(r.cls !== 'EXACT' && r.cls !== 'HIGH'); assert.equal(r.personKey, null);
  assert.ok(Object.values(r.byYear).every(v => v === null));
});

test('janela de autoria: ago–dez do ano anterior', () => { assert.deepEqual(authoringWindow(2023), ['2022-08-01', '2022-12-31']); });

test('regra de uso: só revisado, EXACT|HIGH e com pessoa é atribuível a perfil', () => {
  assert.equal(isProfileAttributable({ reviewed: true, confidence: 'EXACT', personId: 'p' }), true);
  assert.equal(isProfileAttributable({ reviewed: true, confidence: 'HIGH', personId: 'p' }), true);
  assert.equal(isProfileAttributable({ reviewed: false, confidence: 'HIGH', personId: 'p' }), false, 'HIGH pendente de revisão');
  assert.equal(isProfileAttributable({ reviewed: true, confidence: 'EXACT', personId: null }), false);
  assert.equal(isProfileAttributable({ reviewed: true, confidence: 'AMBIGUOUS', personId: 'p' }), false);
});

test('candidatos Câmara↔Senado por nome civil completo exato; nome de uma palavra não vira candidato', () => {
  const pairs = crossHouseCandidates([
    { house: 'camara', externalId: '1', civilName: 'EFRAIM DE ARAUJO MORAIS FILHO' }, { house: 'senado', externalId: '9', civilName: 'Efraim de Araújo Morais Filho' },
    { house: 'camara', externalId: '2', civilName: 'Bacelar' }, { house: 'senado', externalId: '8', civilName: 'Bacelar' },
    { house: 'camara', externalId: '3', civilName: 'Fulano de Tal' }, { house: 'camara', externalId: '4', civilName: 'Fulano de Tal' },
  ]);
  assert.equal(pairs.length, 1); assert.equal(pairs[0]!.camara.externalId, '1'); assert.equal(pairs[0]!.senado.externalId, '9');
});

test('CSV do Portal: aspas, delimitador e quebra de linha dentro do campo', () => {
  const rows = [...csvRows('a;b;c\n"x;1";"y ""q"" z";"linha1\nlinha2"\n')];
  assert.deepEqual(rows[1], ['x;1', 'y "q" z', 'linha1\nlinha2']);
});

test('Portal: só Transferências Especiais; valores brasileiros; código/autor como texto', () => {
  const header = 'Código da Emenda;Ano da Emenda;Tipo de Emenda;Código do Autor da Emenda;Nome do Autor da Emenda;Número da emenda;Localidade de aplicação do recurso;Código Município IBGE;Município;Código UF IBGE;UF;Região;Código Função;Nome Função;Código Subfunção;Nome Subfunção;Código Programa;Nome Programa;Código Ação;Nome Ação;Código Plano Orçamentário;Nome Plano Orçamentário;Valor Empenhado;Valor Liquidado;Valor Pago;Valor Restos A Pagar Inscritos;Valor Restos A Pagar Cancelados;Valor Restos A Pagar Pagos';
  const special = '202038970006;2020;Emenda Individual - Transferências Especiais;3897;ACACIO FAVACHO;0006;MÚLTIPLO;Sem informação;Múltiplo;1600000;AMAPÁ;Norte;28;Encargos especiais;845;Outras transferências;0903;P;0EC2;TE;0000;TED;7.700.000,00;7.700.000,00;7.700.000,00;0,00;0,00;0,00';
  const other = '202010480009;2020;Emenda de Bancada;1048;BANCADA X;0009;SP;3550308;SÃO PAULO;35;SÃO PAULO;Sudeste;10;Saúde;302;Assist;0;P;0;A;0;PO;1,00;1,00;1,00;0,00;0,00;0,00';
  const parsed = parsePortalAmendmentsCsv([header, special, other, ''].join('\r\n'));
  assert.equal(parsed.amendments.length, 1); const a = parsed.amendments[0]!;
  assert.equal(a.amendmentCode, '202038970006'); assert.equal(a.authorCode, '3897'); assert.equal(a.paid, 7700000); assert.equal(a.uf, 'AP'); assert.equal(a.ibgeCode, null);
  assert.equal(parsed.byKind['Emenda de Bancada'], 1);
  const payHeader = 'Código da Emenda;Código do Autor da Emenda;Nome do Autor da Emenda;Número da emenda;Tipo de Emenda;Ano/Mês;Código do Favorecido;Favorecido;Natureza Jurídica;Tipo Favorecido;UF Favorecido;Município Favorecido;Valor Recebido';
  const pay = parsePortalPaymentsCsv([payHeader, '202038970006;3897;ACACIO;0006;Emenda Individual - Transferências Especiais;202009;00000000000191;BANCO;SEM;Pessoa Jurídica;DF;BRASÍLIA;1.000,50', '202010480009;1048;B;0009;Emenda de Bancada;202009;1;X;Y;Z;SP;SP;5,00', ''].join('\n'));
  assert.equal(pay.length, 1); assert.equal(pay[0]!.amount, 1000.5); assert.equal(pay[0]!.month, '202009');
});

test('homônimo parcial (caso 1270): outra pessoa ativa cujo nome oficial começa pelo nome do autor → AMBIGUOUS, sem pessoa', () => {
  const roster = [
    rec('camara', '141458', 'civil:filho', ['João Carlos Bacelar'], ['BA'], [['2019-02-01', null]]),
    rec('camara', '69871', 'civil:batista', ['Bacelar', 'João Carlos Bacelar Batista'], ['BA'], [['2015-02-01', null]]),
  ];
  const r = resolve(roster, '1270', ['João Carlos Bacelar'], ['BA'], [2020, 2021]);
  assert.equal(r.cls, 'AMBIGUOUS'); assert.equal(r.personKey, null); assert.match(r.reason, /name_prefix_competitor:camara:69871/);
  assert.deepEqual([...r.candidates].sort(), ['camara:141458', 'camara:69871']);
  // o concorrente fora do período/UF não impede a atribuição
  const apart = [roster[0]!, rec('camara', '69871', 'civil:batista', ['Bacelar', 'João Carlos Bacelar Batista'], ['SP'], [['2015-02-01', null]])];
  assert.equal(resolve(apart, '1270', ['João Carlos Bacelar'], ['BA'], [2020]).cls, 'EXACT');
});

test('pai e filho com nome oficial próprio (Otto Alencar × Otto Alencar Filho): nome mais longo reivindicado por outro código não vira concorrente', () => {
  const roster = [
    rec('senado', '5523', 'civil:pai', ['Otto Alencar'], ['BA'], [['2019-02-01', null]]),
    rec('camara', '204573', 'civil:filho', ['Otto Alencar Filho'], ['BA'], [['2019-02-01', null]]),
  ];
  const input = { code: '3795', names: ['Otto Alencar'], ufs: ['BA'], years: [2024] };
  assert.equal(resolveAuthorCode(input, buildRosterIndex(roster)).cls, 'AMBIGUOUS', 'sem saber que o filho é autor por si só, o prefixo é suspeito');
  const resolved = resolveAuthorCode(input, buildRosterIndex(roster, ['Otto Alencar', 'Otto Alencar Filho']));
  assert.equal(resolved.cls, 'EXACT'); assert.equal(resolved.byYear[2024]?.recordKey, 'senado:5523');
  assert.equal(resolveAuthorCode({ code: '4123', names: ['Otto Alencar Filho'], ufs: ['BA'], years: [2024] }, buildRosterIndex(roster, ['Otto Alencar', 'Otto Alencar Filho'])).byYear[2024]?.recordKey, 'camara:204573');
});
