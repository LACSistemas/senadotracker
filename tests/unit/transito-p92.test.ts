import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FLAG, FROTA_COLUMNS, FROTA_IDS, PRF_METRICS, REN_IDS, SIM_TRA_IDS, TRA_ALIASES, TRA_DEFS, buildEntityDir, buildFrotaSlice, buildInfrSlice, buildPrfSlice, buildRenaestSlice, buildSimTraOccurrence, buildSimTraResidence,
  buildTraCrosswalk, classifyTra, compactKey, frotaHeaderOk, renaestScope, resolveTraName, type EntityRow, type FrotaJson, type PrfJson, type RenaestJson,
} from '../../packages/db/src/exec/index.ts';
import { frotaMonthOf, infrMonthOf, isZipMagic, latestRenaestResource, notHtml, parseFrotaPage, parseInfrPage, parsePrfPage, pickFrota, pickInfr } from '../../apps/collector/src/exec/transito.ts';

const UFS: Array<[number, string, string]> = [[11, 'RO', 'Rondônia'], [12, 'AC', 'Acre'], [13, 'AM', 'Amazonas'], [14, 'RR', 'Roraima'], [15, 'PA', 'Pará'], [16, 'AP', 'Amapá'], [17, 'TO', 'Tocantins'], [21, 'MA', 'Maranhão'], [22, 'PI', 'Piauí'], [23, 'CE', 'Ceará'], [24, 'RN', 'Rio Grande do Norte'], [25, 'PB', 'Paraíba'],
  [26, 'PE', 'Pernambuco'], [27, 'AL', 'Alagoas'], [28, 'SE', 'Sergipe'], [29, 'BA', 'Bahia'], [31, 'MG', 'Minas Gerais'], [32, 'ES', 'Espírito Santo'], [33, 'RJ', 'Rio de Janeiro'], [35, 'SP', 'São Paulo'], [41, 'PR', 'Paraná'], [42, 'SC', 'Santa Catarina'], [43, 'RS', 'Rio Grande do Sul'],
  [50, 'MS', 'Mato Grosso do Sul'], [51, 'MT', 'Mato Grosso'], [52, 'GO', 'Goiás'], [53, 'DF', 'Distrito Federal']];
const munis = JSON.parse(readFileSync(new URL('../fixtures/exec/ibge_municipios.json', import.meta.url), 'utf8')) as Array<[number, string, string]>;
const ufCodeOf = new Map(UFS.map(([c, a]) => [a, c]));
const rows: EntityRow[] = [
  ...UFS.map(([c, , n]) => ({ entity_id: c, kind: 3, ibge7: c, uf_code: c, name: n })), ...UFS.map(([c, a]) => ({ entity_id: c * 100000, kind: 5, ibge7: c * 100000, uf_code: c, name: `Município ignorado - ${a}` })),
  ...munis.map(([id, uf, name]) => ({ entity_id: id, kind: 4, ibge7: id, uf_code: ufCodeOf.get(uf)!, name, unproven: id === 5101837 })),
];
const dir = buildEntityDir(rows); const ufByAcronym = new Map(UFS.map(([c, a]) => [a, c])); const xw = buildTraCrosswalk(dir, ufByAcronym);
const VIT = 3205309, VV = 3205200, ARN = 3200359, ES = 32, ES_IGN = 3200000;
const byId = <T extends { indicator_id: number; entity_id: number; period_start?: string }>(rs: T[], ind: number, ent: number, ps?: string) => rs.find(r => r.indicator_id === ind && r.entity_id === ent && (!ps || r.period_start === ps));

test('CID de trânsito: terrestre V01–V89 por categoria, V90–V99 à parte, Y85.0 é sequela e nunca entra no evento agudo', () => {
  assert.deepEqual(classifyTra('V01'), { group: 'TT', cat: 'PED' }); assert.deepEqual(classifyTra('V09'), { group: 'TT', cat: 'PED' }); assert.deepEqual(classifyTra('V20'), { group: 'TT', cat: 'MOT' });
  assert.deepEqual(classifyTra('V49'), { group: 'TT', cat: 'AUT' }); assert.deepEqual(classifyTra('V89'), { group: 'TT', cat: 'OTE' }); assert.deepEqual(classifyTra('V90'), { group: 'OUT' }); assert.deepEqual(classifyTra('V99'), { group: 'OUT' });
  assert.deepEqual(classifyTra('Y850'), { group: 'SEQ' }); assert.deepEqual(classifyTra('Y85x'), { group: 'OTHERSEQ' });
  assert.throws(() => classifyTra('X85'), /inválida/); assert.throws(() => classifyTra('V00'), /inválida/);
});

test('chave compacta: determinística e sem fuzzy; crosswalk valida 48 aliases contra o IBGE e não tem colisões', () => {
  assert.equal(compactKey("PINGO D'AGUA"), 'PINGODAGUA'); assert.equal(compactKey('Pindaré-Mirim'), 'PINDAREMIRIM'); assert.equal(compactKey(compactKey('São Luiz do Anauá')), 'SAOLUIZDOANAUA');
  assert.equal(TRA_ALIASES.length, 48);
  assert.equal(xw.byUfKey.get(`14|SAOLUIZ`), 1400605); assert.equal(xw.byUfKey.get('25|SANTAREM'), xw.byUfKey.get('25|JOCACLAUDINO'));
  const r = (n: string, uf = 'ES') => resolveTraName(n, ufCodeOf.get(uf)!, dir, xw);
  assert.deepEqual([r('VITORIA').how, r('VITORIA').entity], ['direto', VIT]); assert.equal(r('MUNICIPIO NAO INFORMADO').entity, ES_IGN); assert.equal(r('CIDADE INEXISTENTE').how, 'nao_conciliado');
  assert.equal(r('PARATI', 'RJ').how, 'alias'); assert.equal(r('IBITIUVA', 'SP').how, 'nao_conciliado', 'sem município com esse nome em SP: nada é inventado');
  assert.equal(r('VITORIA', 'RJ').how, 'nao_conciliado', 'a UF faz parte da chave');
  const dup = buildEntityDir([...rows, { entity_id: 3205310, kind: 4, ibge7: 3205310, uf_code: 32, name: 'VITORIA' }]);
  assert.throws(() => buildTraCrosswalk(dup, ufByAcronym), /colisão/);
});

test('inventário da frota: competência identificada em todos os 165 nomes reais de arquivo (2013-01 a 2026-09), um por mês', () => {
  const fx = JSON.parse(readFileSync(new URL('../fixtures/exec/senatran_frota_nomes.json', import.meta.url), 'utf8')) as Array<[number, string]>;
  assert.equal(fx.length, 165);
  for (const [comp, file] of fx) assert.equal(frotaMonthOf(file), comp % 100, `${comp} ${file}`);
  assert.equal(frotaMonthOf('FrotaporMunicpioeTipoMARO2024.xls'), 3); assert.equal(frotaMonthOf('copy_of_FrotaporMunicpioeTipoJUL2024.xlsx'), 7); assert.equal(frotaMonthOf('frota_por_municipio_e_tipo-dez_15.rar'), 12); assert.equal(frotaMonthOf('sem-mes.xlsx'), null);
  const html21 = `<a href="/x/frota_munic_modelo_junho_2021.xls/@@download/file">Frota por Município e Tipo</a><a href="/x/G_Frota_por_UF_Municipio_TIPO_ESPECIE_EIXOS_Junho_2021.xlsx/@@download/file">Quantidade de Veículos por UF Município Tipo Espécie e Eixos</a>`;
  const html = `<a href="/x/FrotaporMunicipioetipoJulho2025.csv/@@download/file"></a><a href="/x/copy_of_FrotaporMunicipioetipoJulho2025.xlsx/@@download/file">Frota por Município e Tipo</a><a href="/x/H_Frota_por_UF_Municipio_RESTRICAO_Julho_2025.xlsx/@@download/file">Frota por Município e Tipo de Restrição</a>`;
  const a = parseFrotaPage(html21, 2021), b = pickFrota(parseFrotaPage(html, 2025));
  assert.deepEqual(a.map(x => x.competence), [202106]); assert.deepEqual(b.map(x => [x.competence, x.file.endsWith('.xlsx')]), [[202507, true]], 'planilha preferida ao CSV; arquivo de restrição ignorado');
});

test('páginas da PRF e das infrações: links repetidos/trocados não enganam o parser; HTML nunca é aceito como arquivo', () => {
  const html = `<table><tr><td><p>Documento CSV de Acidentes 2025 (Agrupados por ocorrência)</p></td><td><p><a href="https://drive.google.com/file/d/1-G3MdmH/view?usp=sharing/download">Baixar planilha</a><a href="https://drive.google.com/file/d/14lB0vq/view?usp=sharing/download"></a></p></td></tr>`
    + `<tr><td><p>Documento CSV de Acidentes 2025 (Agrupados por pessoa)</p></td><td><p><a href="https://drive.google.com/file/d/PESSOA/view">Baixar planilha</a></p></td></tr>`
    + `<tr><td><p>Documento CSV de Acidentes 2026 (Agrupados por ocorrência)</p></td><td><p><a href="https://drive.google.com/file/d/ID2026/view">Baixar planilha</a><a href="https://drive.google.com/file/d/1-G3MdmH/view"></a></p></td></tr></table>`;
  assert.deepEqual([...parsePrfPage(html)], [[2025, '1-G3MdmH'], [2026, 'ID2026']]);
  assert.equal(infrMonthOf('2019-01_infracoes_com_np.csv'), 201901); assert.equal(infrMonthOf('2022_05_infracoes_com_np.csv'), 202205); assert.equal(infrMonthOf('QuantidadedeInfraescomNotificaodePenalidadeNPemitidasemSETEMBROde2026porUFdeJuri.csv'), 202609);
  assert.equal(infrMonthOf('copy_of_QuantidadedeInfraescomNotificaodePenalidadeNPemitidasemMarode2025porUFdeJuri.csv.xlsx'), 202503);
  const fx = JSON.parse(readFileSync(new URL('../fixtures/exec/senatran_infracoes_nomes.json', import.meta.url), 'utf8')) as Array<[number, string]>;
  for (const [ym, file] of fx) assert.equal(infrMonthOf(file), ym, file);
  const p = parseInfrPage(`<a href="/a/2020_01_infracoes_com_np.csv/@@download/file">baixar</a><a href="/a/2020_01_infracoes_com_np.xlsx/@@download/file">baixar</a><a href="/a/condutores_habilitados_2022_01.csv/@@download/file">x</a>`);
  assert.deepEqual(pickInfr(p).map(x => [x.competence, x.ext]), [[202001, 'csv']]);
  const q = parseInfrPage(`<a href="https://antigo.infraestrutura.gov.br/images/x/2020-06_infracoes_com_NP.csv">csv antigo</a><a href="/a/2020-06_infracoes_com_np.xlsx/@@download/file">xlsx</a>`);
  assert.deepEqual(q.map(x => [x.competence, x.ext, x.url.startsWith('https://www.gov.br')]), [[202006, 'xlsx', true], [202006, 'csv', false]], 'gov.br é preferido; host antigo fica como alternativa');
  assert.equal(notHtml(Buffer.from('<!DOCTYPE html><html>')), false); assert.equal(notHtml(Buffer.from('<html lang="pt">')), false); assert.equal(notHtml(Buffer.from('UF;Cod_Infracao;Quantidade')), true); assert.equal(notHtml(Buffer.from([0xff, 0xfe, 0x22, 0x00])), true); assert.equal(isZipMagic(Buffer.from([0x50, 0x4b, 3, 4])), true); assert.equal(isZipMagic(Buffer.from('<!DOC')), false);
});

test('RENAEST: escolhe o recurso cumulativo mais recente pelo mês do nome (não pela ordem da lista)', () => {
  const pkg = { result: { resources: [{ name: 'RENAEST - Mensal - 03-2026', url: 'u3', created: '2026-07-20', size: 1 }, { name: 'RENAEST - Mensal - 05-2026', url: 'u5', created: '2026-10-09', size: '529020946' }, { name: 'RENAEST - Mensal - 12-2025', url: 'u12', created: '2026-02-01', size: 2 }, { name: 'Dicionário', url: 'd', created: '2026-01-01' }] } };
  const r = latestRenaestResource(pkg); assert.deepEqual([r.url, r.month, r.size], ['u5', 202605, 529020946]);
  assert.throws(() => latestRenaestResource({ result: { resources: [] } }), /sem recursos/);
});

// ----------------------------------------------------------------------------------------------- SIM trânsito
const simArgs = { year: 2024, prelim: false, dir, pop: new Map<number, number>([[VIT, 360000], [VV, 500000], [ARN, 7000], [ES, 4000000]]) };
test('SIM trânsito: totais com zero explícito, categorias só quando > 0, sequela separada, V90–V99 fora do terrestre, nada vaza entre UFs', () => {
  const agg = { stats: { rows_read: 10, nonfetal: 10 }, occ: {}, res: { '320530': { V03: 4, V23: 6, V43: 3, V95: 1, Y850: 2, Y85x: 5 }, '320520': { V28: 2 }, '320000': { V01: 1 }, '': { V09: 1 }, '330455': { V29: 2 } } };
  const r = buildSimTraResidence(agg, ES, simArgs);
  assert.deepEqual([r.totals.TT, r.totals.OUT, r.totals.SEQ, r.totals.AT], [19, 1, 2, 20]);
  const t = (id: number, e: number) => byId(r.rows, id, e)?.value;
  assert.equal(t(4001, VIT), 13); assert.equal(t(4002, VIT), 14); assert.equal(t(4004, VIT), 2); assert.equal(t(4003, VIT), 1); assert.equal(t(4011, VIT), 4); assert.equal(t(4013, VIT), 6);
  assert.equal(t(4001, ARN), 0, 'universo: zero explícito nos totais'); assert.equal(t(4013, ARN), undefined, 'categoria sem óbito não é gravada');
  assert.equal(t(4001, ES_IGN), 4, 'código xx0000, vazio e de outra UF vão ao município ignorado'); assert.equal(t(4001, ES), 19);
  assert.equal(r.rows.some(x => x.entity_id === 3304557), false);
  assert.equal(r.quality.sequelaOutras, 5, 'Y85.x (exceto Y85.0) é contada à parte e não publicada');
  assert.ok(Math.abs(t(4021, VIT)! - 13 / 360000 * 100000) < 1e-9); assert.equal(t(4021, 3200300), undefined);
  assert.ok((byId(r.rows, 4021, ARN)!.flags! & FLAG.smallN) !== 0);
  const sem = buildSimTraResidence(agg, ES, { ...simArgs, pop: new Map() }); assert.equal(sem.rows.some(x => x.indicator_id === 4021 || x.indicator_id === 4022), false, 'sem população do ano: sem taxa e sem interpolação');
  const pre = buildSimTraResidence(agg, ES, { ...simArgs, prelim: true }); assert.ok(pre.rows.every(x => x.status === 1 && (x.flags! & FLAG.preliminary) !== 0));
});
test('SIM trânsito: ocorrência é perspectiva distinta (indicadores próprios, sem taxa); sem município fica fora e declarado', () => {
  const es = { stats: {}, res: {}, occ: { '320530': { V23: 3 }, '330455': { V23: 2, V99: 1 }, '': { V03: 1 }, '999999': { V03: 1 } } };
  const rj = { stats: {}, res: {}, occ: { '330455': { V23: 7 } } };
  const o = buildSimTraOccurrence([es, rj], simArgs);
  assert.equal(byId(o.rows, 4101, VIT)!.value, 3); assert.equal(byId(o.rows, 4101, 3304557)!.value, 9); assert.equal(byId(o.rows, 4102, 3304557)!.value, 10); assert.equal(byId(o.rows, 4101, 33)!.value, 9);
  assert.equal(o.quality.unplacedInvalidCode, 1); assert.equal(o.quality.unplacedUnresolvedCode, 1);
  assert.ok(o.rows.every(x => x.indicator_id >= 4101 && x.indicator_id <= 4119) && o.rows.every(x => ![4021, 4022].includes(x.indicator_id)));
  void SIM_TRA_IDS;
});

// ----------------------------------------------------------------------------------------------- frota
const hdr = ['TOTAL', ...FROTA_COLUMNS.map(c => c[0])];
const frow = (uf: string, name: string, vals: Array<number | null>): [string, string, ...Array<number | null>] => [uf, name, ...vals];
const zeros = (n: number): Array<number | null> => new Array(n).fill(0);
function frotaJson(): FrotaJson {
  const mk = (total: number, auto: number, moto: number): Array<number | null> => { const v = zeros(22); v[0] = total; v[1] = auto; v[10] = moto; v[11] = 0; return v; };
  return { title: 'Frota - MAR/2024', sheet: 'MAR_2024', header: hdr, formula_total: null, skipped: 0, source: 'x.xls', rows: [
    frow('UF', 'MUNICIPIO', zeros(22)), frow('ES', 'VITORIA', mk(200000, 120000, 30000)), frow('ES', 'VILA VELHA', mk(300000, 180000, 50000)), frow('ES', 'ALTO RIO NOVO', [null, ...zeros(21)] as never),
    frow('ES', 'MUNICIPIO NAO INFORMADO', mk(10, 5, 1)), frow('ES', 'CIDADE FANTASMA', mk(7, 2, 1)), frow('RJ', 'PARATI', mk(50000, 30000, 8000)) ] };
}
test('frota: cabeçalho esperado, município ignorado e não conciliado preservados na UF, total e tipos sem perda', () => {
  assert.equal(frotaHeaderOk(hdr), true); assert.equal(frotaHeaderOk(hdr.slice(1)), false); assert.equal(FROTA_IDS.porMil, 4201);
  assert.throws(() => buildFrotaSlice({ ...frotaJson(), header: hdr.slice(1) }, ES, 'ES', 202403, { dir, xw, pop: new Map(), emitIndicators: false }), /cabeçalho/);
  const r = buildFrotaSlice(frotaJson(), ES, 'ES', 202403, { dir, xw, pop: new Map([[VIT, 360000], [ES, 4000000], [VV, 500000]]), emitIndicators: true });
  assert.equal(r.totals.total, 200000 + 300000 + 10 + 7); assert.equal(r.rows.find(x => x.entity_id === VIT)!.automovel, 120000);
  const ign = r.rows.find(x => x.entity_id === ES_IGN)!; assert.equal(ign.total, 17, 'MUNICIPIO NAO INFORMADO + nome sem correspondência somam no município ignorado'); assert.deepEqual(r.resolution.nao_conciliado, ['CIDADE FANTASMA']);
  assert.equal(r.rows.find(x => x.entity_id === ARN)!.total, null, 'célula vazia na fonte permanece nula (≠ 0)');
  assert.equal(r.rows.some(x => x.entity_id === 3304557), false, 'outras UFs ficam fora da fatia');
  assert.ok(Math.abs(byId(r.indicators, 4201, VIT)!.value! - 200000 / 360000 * 1000) < 1e-9); assert.equal(byId(r.indicators, 4202, VIT)!.value, 15); assert.equal(byId(r.indicators, 4201, ES_IGN), undefined, 'município ignorado não ganha taxa');
  assert.ok(byId(r.indicators, 4201, ES)); assert.equal(buildFrotaSlice(frotaJson(), ES, 'ES', 202403, { dir, xw, pop: new Map(), emitIndicators: false }).indicators.length, 0);
  const rj = buildFrotaSlice(frotaJson(), 33, 'RJ', 202403, { dir, xw, pop: new Map(), emitIndicators: false }); assert.equal(rj.resolution.alias, 1, 'PARATI → Paraty (alias validado)');
});

// ----------------------------------------------------------------------------------------------- RENAEST
const rj = (): RenaestJson => ({
  bad: {}, acidentes: 0, vitimas_linhas: 0, veiculos_total: 0, veiculos_orfaos: 0,
  muni: [['ES', '3205309', 202401, 100, 5, 6, 300, 290], ['ES', '3205200', 202401, 50, 2, 2, 120, 118], ['ES', '0000000', 202401, 3, 0, 0, 7, 7], ['ES', '3205309', 202402, 10, 1, 1, 30, 29], ['ES', '3205309', 202301, 9, 0, 0, 20, 20], ['RJ', '3304557', 202401, 40, 3, 3, 90, 87]],
  tp_acidente: [['ES', 202401, 'COLISAO', 120], ['ES', 202401, 'CHOQUE', 33], ['ES', 202402, 'CHOQUE', 10]], gravidade: [['ES', 202401, 'LEVE', 200], ['ES', 202401, 'OBITO', 8]], envolvido: [['ES', 202401, 'MOTORISTA', 150]], veiculo: [['ES', 202401, 'AUTOMOVEL', 170], ['ES', 202401, 'MOTOCICLETA', 40]],
  vitima_obitos: [], cov: [['ES', 202401, 153, 7, 3], ['ES', 202402, 10, 1, 1], ['ES', 202301, 9, 0, 1], ['RJ', 202401, 40, 3, 1]], localidade: [['ES', 202401, 79], ['ES', 202402, 79], ['ES', 202403, 79], ['ES', 202301, 79], ['RJ', 202401, 92]],
});
test('RENAEST: UF = Σ municípios + ignorado; sem registro não vira zero; escopo restrito a fatais é inferido e rotulado; mês sem registro gera cobertura', () => {
  const r = buildRenaestSlice(rj(), 'ES', ES, 2024, { dir, lastMonth: 202403, sourceSha: 'a'.repeat(64) });
  const v = (ind: number, e: number, ps: string) => byId(r.rows, ind, e, ps)?.value;
  assert.equal(v(4301, VIT, '2024-01-01'), 100); assert.equal(v(4301, ES_IGN, '2024-01-01'), 3, "código '0000000' vai ao município ignorado"); assert.equal(v(4301, ES, '2024-01-01'), 153); assert.equal(v(4303, ES, '2024-01-01'), 8);
  assert.equal(v(4302, VV, '2024-01-01'), 2); assert.equal(byId(r.rows, 4301, VV, '2024-02-01'), undefined, 'município sem sinistro reportado no mês: sem linha (e nunca zero)');
  assert.equal(r.rows.some(x => x.entity_id === 3304557 || x.period_start.startsWith('2023')), false);
  assert.equal(v(REN_IDS.tp.get('COLISAO')!, ES, '2024-01-01'), 120); assert.equal(v(REN_IDS.veic.get('MOTOCICLETA')!, ES, '2024-01-01'), 40); assert.equal(byId(r.rows, REN_IDS.tp.get('CHOQUE')!, VIT), undefined, 'dimensões só existem na UF');
  assert.deepEqual(r.cov.map(c => [c.competence, c.records, c.scope, c.universe]), [[202401, 153, 1, 79], [202402, 10, 1, 79], [202403, 0, 3, 79]], 'março: a fonte lista o mês e a UF não tem registro');
  assert.ok(r.rows.every(x => x.status === 1 && (x.flags! & FLAG.preliminary) !== 0), 'os 3 últimos meses do pacote são preliminares');
  const old = buildRenaestSlice(rj(), 'ES', ES, 2024, { dir, lastMonth: 202406, sourceSha: 'a'.repeat(64) }); assert.ok(old.rows.every(x => x.status === 2), 'meses anteriores aos 3 últimos: definitivos');
  assert.equal(renaestScope(0, 0), 3); assert.equal(renaestScope(29, 29), 1, 'poucos registros: sem inferência'); assert.equal(renaestScope(1000, 997), 2); assert.equal(renaestScope(1000, 100), 1);
  const bad = rj(); bad.tp_acidente.push(['ES', 202401, 'TIPO NOVO', 1]);
  assert.throws(() => buildRenaestSlice(bad, 'ES', ES, 2024, { dir, lastMonth: 202403, sourceSha: 'a' }), /categoria desconhecida/);
});

// ----------------------------------------------------------------------------------------------- PRF
const pr = (uf: string, mun: string, ym: number, c: number[]): PrfJson['rows'][number] => [uf, mun, ym, ...c];   // c = sinistros, fatais, feridas, sem, ign, mortos, leves, graves, ilesos, pessoas, veículos
const prfRows: PrfJson['rows'] = [pr('ES', 'VITORIA', 202401, [5, 1, 3, 1, 0, 2, 4, 1, 3, 12, 9]), pr('ES', 'VILA VELHA', 202401, [2, 0, 2, 0, 0, 0, 3, 0, 1, 4, 4]), pr('ES', 'VITORIA', 202403, [1, 0, 0, 1, 0, 0, 0, 0, 2, 2, 2]), pr('ES', 'CIDADE FANTASMA', 202402, [1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 2]),
  pr('(NULL)', 'GUARANTA DO NORTE', 202401, [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1]), pr('RJ', 'PARATI', 202401, [3, 1, 1, 1, 0, 1, 1, 0, 1, 6, 5])];
const prfJson = (): PrfJson => ({ year: 2024, rows_read: 20, sinistros: 14, dup_ids: 0, bad_date: 0, other_year: 0, classes: {}, rows: prfRows });
test('PRF: mensal por UF com zero explícito dentro do período do arquivo; anual por município; nome sem correspondência vai ao ignorado; UF nula não é inferida', () => {
  const r = buildPrfSlice(prfJson(), 'ES', ES, 2024, { dir, xw, lastMonth: 202403, sourceSha: 'b'.repeat(64) });
  const m = (i: number) => 4601 + i, a = (i: number) => 4621 + i;
  assert.equal(byId(r.rows, m(0), ES, '2024-01-01')!.value, 7); assert.equal(byId(r.rows, m(0), ES, '2024-02-01')!.value, 1); assert.equal(byId(r.rows, m(0), ES, '2024-03-01')!.value, 1);
  assert.equal(r.months.length, 3, 'março é o último mês do arquivo: abril em diante não existe'); assert.equal(r.rows.some(x => x.period_start === '2024-04-01'), false);
  assert.equal(byId(r.rows, m(4), ES, '2024-01-01')!.value, 6, 'com vítimas = fatais + feridas'); assert.equal(byId(r.rows, m(5), ES, '2024-01-01')!.value, 2, 'mortos');
  assert.equal(byId(r.rows, a(0), VIT)!.value, 6); assert.equal(byId(r.rows, a(0), ES_IGN)!.value, 1, 'nome não conciliado → município ignorado'); assert.equal(byId(r.rows, a(0), ES)!.value, 9); assert.equal(byId(r.rows, a(5), ES)!.value, 2);
  assert.deepEqual(Object.keys(r.resolution.nao_conciliado), ['CIDADE FANTASMA']); assert.equal(r.rows.some(x => x.entity_id === 3304557), false);
  assert.deepEqual(r.cov.map(c => [c.competence, c.records, c.scope]), [[202401, 7, 1], [202402, 1, 1], [202403, 1, 1]]);
  assert.ok(byId(r.rows, m(0), ES, '2024-03-01')!.status === 1 && byId(r.rows, m(0), ES, '2024-01-01')!.status === 2, 'só o último mês do arquivo é preliminar');
  const prev = buildPrfSlice({ ...prfJson(), year: 2023, rows: prfRows.map(x => [x[0], x[1], x[2] - 100, ...x.slice(3)] as PrfJson['rows'][number]) }, 'ES', ES, 2023, { dir, xw, lastMonth: 202403, sourceSha: 'c' });
  assert.equal(prev.months.length, 12, 'ano anterior ao último: 12 meses'); assert.equal(byId(prev.rows, m(0), ES, '2023-06-01')!.value, 0, 'mês sem sinistro registrado pela PRF: zero explícito'); assert.equal(PRF_METRICS.length, 11);
});

// ----------------------------------------------------------------------------------------------- infrações
test('infrações: UF de jurisdição por nome, soma por UF = soma das linhas, nomes de UF desconhecidos são declarados', () => {
  const ufKey = new Map(UFS.map(([c, , n]) => [compactKey(n), c]));
  const j = { layout: 'wide', blanks: 3, rows: [['ESPIRITO SANTO', 5002, 100], ['ESPIRITO SANTO', 5010, 30], ['RIO DE JANEIRO', 5002, 999], ['ATLANTIDA', 5002, 5]] as Array<[string, number, number]> };
  const b = buildInfrSlice(j, ES, ufKey, 202401);
  assert.equal(b.total, 130); assert.deepEqual(b.rows.map(r => [r.cod_infracao, r.qtde]), [[5002, 100], [5010, 30]]); assert.equal(b.indicators[0]!.value, 130); assert.deepEqual(b.unknownUfNames, ['ATLANTIDA']);
  assert.equal(buildInfrSlice({ ...j, rows: [] }, ES, ufKey, 202401).indicators.length, 0, 'UF sem linhas: sem indicador (não é zero)');
});
test('definições: ids únicos, códigos únicos, famílias e granularidades coerentes', () => {
  assert.equal(new Set(TRA_DEFS.map(d => d.id)).size, TRA_DEFS.length); assert.equal(new Set(TRA_DEFS.map(d => d.code)).size, TRA_DEFS.length);
  assert.ok(TRA_DEFS.filter(d => d.family === 'RENAEST' && d.id >= 4310).every(d => d.granularity === 'uf'));
  assert.ok(TRA_DEFS.filter(d => d.family === 'SIM' && d.code.endsWith('TAXA')).every(d => d.perspective === 'residencia'));
  assert.equal(TRA_DEFS.filter(d => d.family === 'PRF').length, 22);
});
