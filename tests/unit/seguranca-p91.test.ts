import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAG, VDE_ALIASES, VDE_DEFS, SEG_DEFS, buildEntityDir, buildSimOccurrence, buildSimResidence, buildVdeCrosswalk, buildVdeSlice, classifyCid, findEmptyMonths, normalizeName, resolveIbge6,
  vdeIndicatorId, type EntityRow, type VdeJson,
} from '../../packages/db/src/exec/index.ts';

const E = (entity_id: number, kind: number, ibge7: number, uf_code: number | null, name: string, unproven = false): EntityRow => ({ entity_id, kind, ibge7, uf_code, name, unproven });
const rows: EntityRow[] = [
  E(32, 3, 32, 32, 'Espírito Santo'), E(33, 3, 33, 33, 'Rio de Janeiro'), E(51, 3, 51, 51, 'Mato Grosso'), E(53, 3, 53, 53, 'Distrito Federal'), E(24, 3, 24, 24, 'Rio Grande do Norte'), E(31, 3, 31, 31, 'Minas Gerais'), E(14, 3, 14, 14, 'Roraima'), E(28, 3, 28, 28, 'Sergipe'),
  E(3200000, 5, 3200000, 32, 'Município ignorado - ES'), E(3300000, 5, 3300000, 33, 'Município ignorado - RJ'), E(5100000, 5, 5100000, 51, 'Município ignorado - MT'), E(5300000, 5, 5300000, 53, 'Município ignorado - DF'),
  E(2400000, 5, 2400000, 24, 'Município ignorado - RN'), E(3100000, 5, 3100000, 31, 'Município ignorado - MG'), E(1400000, 5, 1400000, 14, 'Município ignorado - RR'), E(2800000, 5, 2800000, 28, 'Município ignorado - SE'),
  E(3205309, 4, 3205309, 32, 'Vitória'), E(3205200, 4, 3205200, 32, 'Vila Velha'), E(3200359, 4, 3200359, 32, 'Alto Rio Novo'), E(3304557, 4, 3304557, 33, 'Rio de Janeiro'),
  E(5101837, 4, 5101837, 51, 'Boa Esperança do Norte', true), E(5107800, 4, 5107800, 51, 'Santo Antônio de Leverger'), E(5300108, 4, 5300108, 53, 'Brasília'),
  E(2400208, 4, 2400208, 24, 'Assú'), E(2401206, 4, 2401206, 24, 'Arez'), E(3105509, 4, 3105509, 31, 'Barão do Monte Alto'), E(1400605, 4, 1400605, 14, 'São Luiz do Anauá'), E(2802601, 4, 2802601, 28, 'Graccho Cardoso'),
];
const dir = buildEntityDir(rows);
const ufByAcronym = new Map([['ES', 32], ['RJ', 33], ['MT', 51], ['DF', 53], ['RN', 24], ['MG', 31], ['RR', 14], ['SE', 28]]);
const pop = new Map<number, number>([[3205309, 360000], [3205200, 500000], [3200359, 7000], [32, 4000000]]);
const byId = (rs: Array<{ indicator_id: number; entity_id: number; value: number | null; flags?: number; numerator: number | null; denominator: number | null }>, ind: number, ent: number) => rs.find(r => r.indicator_id === ind && r.entity_id === ent);

test('CID-10: agressão, indeterminada, intervenção legal e guerra são grupos separados; trânsito e demais causas ficam fora', () => {
  const cases: Array<[string, string | null]> = [['X850', 'AGR'], ['X95', 'AGR'], ['X999', 'AGR'], ['Y00', 'AGR'], ['Y09', 'AGR'], ['x93', 'AGR'], ['X84', null], ['Y10', 'IND'], ['Y349', 'IND'], ['Y33', 'IND'], ['Y35', 'INT'], ['Y350', 'INT'], ['Y36', 'GUE'], ['Y37', null], ['Y871', null], ['V890', null], ['R99', null], ['', null], ['Y', null], ['YAB', null]];
  for (const [c, g] of cases) assert.equal(classifyCid(c), g, c);
});

test('normalização de nomes: determinística, idempotente e sem apagar o nome original', () => {
  assert.equal(normalizeName("SÃO LUIZ D'OESTE"), 'SAO LUIZ DOESTE');
  assert.equal(normalizeName(normalizeName('  Barão   do Monte-Alto ')), 'BARAO DO MONTEALTO');
  assert.equal(normalizeName('Brasília'), normalizeName('BRASÍLIA'));
});

test('crosswalk: 6 aliases validados resolvem para o município canônico; colisão de nome no IBGE é erro', () => {
  const xw = buildVdeCrosswalk(dir, ufByAcronym);
  assert.equal(VDE_ALIASES.length, 6);
  assert.equal(xw.byUfName.get(`14|${normalizeName('SÃO LUIZ')}`), 1400605);
  assert.equal(xw.byUfName.get(`24|${normalizeName('AÇU')}`), 2400208);
  assert.equal(xw.byUfName.get(`24|${normalizeName('ARÊS')}`), 2401206);
  assert.equal(xw.byUfName.get(`32|${normalizeName('VITÓRIA')}`), 3205309);
  const dup = buildEntityDir([...rows, E(3205310, 4, 3205310, 32, 'VITORIA')]);
  assert.throws(() => buildVdeCrosswalk(dup, ufByAcronym), /colisão/);
  const noCanon = buildEntityDir(rows.filter(r => r.entity_id !== 2401206));
  assert.throws(() => buildVdeCrosswalk(noCanon, ufByAcronym), /inexistente/);
});

test('resolveIbge6: DF por região administrativa vai a Brasília; xx0000 é município ignorado; código inexistente não resolve', () => {
  assert.equal(resolveIbge6('530130', dir), 5300108);
  assert.equal(resolveIbge6('530010', dir), 5300108);
  assert.equal(resolveIbge6('530000', dir), 5300000);
  assert.equal(resolveIbge6('320000', dir), 3200000);
  assert.equal(resolveIbge6('999999', dir), undefined);
});

test('SIM residência: universo com zero explícito, município ignorado preservado, nenhuma perda no total da UF', () => {
  const agg = { stats: { rows_read: 40, nonfetal: 40 }, res: {
    '320530': { AGR: 10, INT: 1, IND: 5 }, '320520': { AGR: 2 }, '320000': { AGR: 1, IND: 1 }, '': { AGR: 1 }, '330455': { AGR: 4 } }, occ: {} };
  const r = buildSimResidence(agg, 32, { year: 2024, prelim: false, dir, pop });
  assert.deepEqual(r.totals, { AGR: 18, INT: 1, GUE: 0, IND: 6 });
  assert.equal(byId(r.rows, 3001, 3205309)!.value, 10);
  assert.equal(byId(r.rows, 3001, 3200359)!.value, 0, 'município do universo sem óbito: zero explícito');
  assert.equal(byId(r.rows, 3001, 3200000)!.value, 6, 'código 320000, vazio e de outra UF vão ao município ignorado');
  assert.equal(byId(r.rows, 3001, 32)!.value, 18);
  assert.equal(r.rows.some(x => x.entity_id === 3300000 || x.entity_id === 3304557), false, 'nada vaza para outra UF');
  const parts = r.rows.filter(x => x.indicator_id === 3001 && x.entity_id !== 32).reduce((n, x) => n + (x.value ?? 0), 0);
  assert.equal(parts, 18);
  assert.equal(r.quality.otherUfCode, 4); assert.equal(r.quality.invalidCode, 1);
  // recorte Atlas = agressão + intervenção legal
  assert.equal(byId(r.rows, 3005, 32)!.value, 19);
  // taxa só com denominador do mesmo ano; pequeno número sinalizado
  assert.ok(Math.abs(byId(r.rows, 3006, 3205309)!.value! - 10 / 360000 * 100000) < 1e-9);
  assert.ok((byId(r.rows, 3006, 3200359)!.flags! & FLAG.smallN) !== 0);
  assert.equal(byId(r.rows, 3006, 3205200)!.numerator, 2);
  // proporção de indeterminadas só com ≥ 10 mortes violentas
  assert.equal(byId(r.rows, 3008, 3205309)!.value, 5 / 16 * 100);
  assert.equal(byId(r.rows, 3008, 3205200), undefined);
  const noPop = buildSimResidence(agg, 32, { year: 2023, prelim: false, dir, pop: new Map() });
  assert.equal(noPop.rows.some(x => x.indicator_id === 3006 || x.indicator_id === 3007), false, 'sem estimativa oficial: sem taxa e sem interpolação');
  assert.equal(byId(noPop.rows, 3001, 3205309)!.value, 10, 'contagem absoluta é sempre persistida');
});

test('SIM: recorte Atlas é X85–Y09 + Y35; operações de guerra (Y36) ficam em indicador próprio e fora da soma', () => {
  const r = buildSimResidence({ stats: {}, res: { '320530': { AGR: 10, INT: 2, GUE: 3, IND: 4 } }, occ: {} }, 32, { year: 2024, prelim: false, dir, pop });
  assert.equal(byId(r.rows, 3005, 3205309)!.value, 12); assert.equal(byId(r.rows, 3003, 3205309)!.value, 3);
  assert.ok(Math.abs(byId(r.rows, 3007, 3205309)!.value! - 12 / 360000 * 100000) < 1e-9);
  assert.equal(byId(r.rows, 3008, 3205309)!.value, 4 / 19 * 100, 'a proporção de indeterminadas usa todas as mortes violentas');
});

test('SIM residência: 2025 preliminar leva status 1 e sinal; município sem instalação comprovada só entra se houver óbito', () => {
  const none = buildSimResidence({ stats: {}, res: { '510000': { AGR: 3 } }, occ: {} }, 51, { year: 2025, prelim: true, dir, pop });
  assert.equal(none.rows.some(x => x.entity_id === 5101837), false);
  assert.ok(none.rows.every(x => x.status === 1 && (x.flags! & FLAG.preliminary) !== 0));
  const some = buildSimResidence({ stats: {}, res: { '510183': { AGR: 1 } }, occ: {} }, 51, { year: 2025, prelim: true, dir, pop });
  assert.equal(byId(some.rows, 3001, 5101837)!.value, 1);
});

test('SIM ocorrência é perspectiva separada: o óbito de residente do ES ocorrido no RJ conta no RJ; sem município fica fora e é declarado', () => {
  const es = { stats: { nonfetal: 30 }, res: { '320530': { AGR: 5 } }, occ: { '320530': { AGR: 3 }, '330455': { AGR: 2 }, '': { AGR: 1 }, '999999': { AGR: 1 } } };
  const rj = { stats: { nonfetal: 20 }, res: { '330455': { AGR: 9 } }, occ: { '330455': { AGR: 7 } } };
  const o = buildSimOccurrence([es, rj], { year: 2024, prelim: false, dir, pop });
  assert.equal(byId(o.rows, 3011, 3205309)!.value, 3);
  assert.equal(byId(o.rows, 3011, 3304557)!.value, 9);
  assert.equal(byId(o.rows, 3011, 33)!.value, 9);
  assert.equal(byId(o.rows, 3011, 32)!.value, 3);
  assert.equal(o.quality.unplacedInvalidCode, 1); assert.equal(o.quality.unplacedUnresolvedCode, 1);
  const r = buildSimResidence(es, 32, { year: 2024, prelim: false, dir, pop });
  assert.equal(byId(r.rows, 3001, 3205309)!.value, 5, 'residência segue distinta da ocorrência');
  assert.ok(o.rows.every(x => x.indicator_id >= 3011 && x.indicator_id <= 3015), 'ocorrência não usa indicadores de residência');
});

// ----------------------------------------------------------------------------------------------- VDE
const cov = (uf: string, evento: string, comp: number, o: Partial<{ abr: string; mun: number; lin: number; nz: number; dup: number; vit: number; tot: number; peso: number }> = {}) =>
  ({ uf, evento, comp, abr: o.abr ?? 'Estadual', mun: o.mun ?? 1, lin: o.lin ?? 1, nz: o.nz ?? 0, dup: o.dup ?? 0, vit: o.vit ?? 0, tot: o.tot ?? 0, peso: o.peso ?? 0 });
function vdeFixture(): VdeJson {
  const months = Array.from({ length: 12 }, (_, i) => 202401 + i);
  const covs = [] as VdeJson['cov']; const rws = [] as VdeJson['rows'];
  for (const m of months) {
    covs.push(cov('ES', 'Homicídio doloso', m, { mun: 79, lin: 79, nz: m === 202401 ? 3 : 0, vit: m === 202401 ? 9 : 0 }));
    covs.push(cov('ES', 'Estupro', m, { vit: m === 202402 ? 4 : 0, nz: m === 202402 ? 1 : 0 }));
    covs.push(cov('ES', 'Roubo de veículo', m, { tot: 7, nz: 1 }));
    covs.push(cov('ES', 'Apreensão de Cocaína', m, { peso: 2.5, nz: 1 }));
    covs.push(cov('ES', 'Furto de veículo', m, { abr: 'Polícia Federal' }));
    covs.push(cov('DF', 'Homicídio doloso', m, { mun: 2, lin: 34, dup: 33, nz: m === 202401 ? 1 : 0, vit: m === 202401 ? 17 : 0 }));
  }
  rws.push(['ES', 'VITÓRIA', 'Homicídio doloso', 202401, 'Estadual', 5, null, null, 0], ['ES', 'VILA VELHA', 'Homicídio doloso', 202401, 'Estadual', 3, null, null, 0], ['ES', 'NÃO INFORMADO', 'Homicídio doloso', 202401, 'Estadual', 1, null, null, 0]);
  rws.push(['ES', 'NÃO INFORMADO', 'Estupro', 202402, 'Estadual', 4, null, null, 0]);
  for (const m of months) { rws.push(['ES', 'NÃO INFORMADO', 'Roubo de veículo', m, 'Estadual', null, 7, null, 0], ['ES', 'NÃO INFORMADO', 'Apreensão de Cocaína', m, 'Estadual', null, null, 2.5, 0]); }
  rws.push(['DF', 'BRASÍLIA', 'Homicídio doloso', 202401, 'Estadual', 17, null, null, 32]);
  return { rows_read: 1000, keys: 900, competences: months, columns: [], bad: {}, events: {}, abrangencias: {}, rows: rws, cov: covs };
}
const xw = buildVdeCrosswalk(dir, ufByAcronym);
const vargs = (uf: string, over: Partial<Parameters<typeof buildVdeSlice>[1]> = {}) => ({ year: 2024, ufCode: ufByAcronym.get(uf)!, ufAcronym: uf, dir, xw, pop, currentYear: 2026, emptyMonths: new Set<number>(), ufByAcronym, ...over });

test('VDE: contrato de 41 indicadores (evento × abrangência) + 8 taxas; ids únicos; zero estrutural não vira indicador', () => {
  assert.equal(VDE_DEFS.filter(d => d.grain === 'M').length, 41);
  assert.equal(VDE_DEFS.filter(d => d.grain === 'A').length, 8);
  assert.equal(new Set(SEG_DEFS.map(d => d.id)).size, SEG_DEFS.length);
  assert.equal(new Set(SEG_DEFS.map(d => d.code)).size, SEG_DEFS.length);
  assert.equal(vdeIndicatorId('Furto de veículo', 'Polícia Federal'), null);
  assert.equal(vdeIndicatorId('Homicídio doloso', 'Estadual'), 3101);
});

test('VDE: município nominal, "NÃO INFORMADO" no município ignorado, evento só-UF apenas na UF, total estadual preservado', () => {
  const r = buildVdeSlice(vdeFixture(), vargs('ES'));
  const jan = '2024-01-01';
  const at = (ind: number, ent: number, ps = jan) => r.rows.find(x => x.indicator_id === ind && x.entity_id === ent && x.period_start === ps);
  assert.equal(at(3101, 3205309)!.value, 5); assert.equal(at(3101, 3205200)!.value, 3);
  assert.equal(at(3101, 3200000)!.value, 1, 'NÃO INFORMADO → município ignorado da UF');
  assert.equal(at(3101, 32)!.value, 9, 'UF = Σ de todas as linhas');
  assert.equal(at(3101, 3205309, '2024-02-01'), undefined, 'zero municipal não é persistido');
  assert.equal(at(3101, 32, '2024-02-01')!.value, 0); assert.ok((at(3101, 32, '2024-02-01')!.flags! & FLAG.zeroAmbiguous) !== 0, 'UF zerada no mês: zero ambíguo sinalizado');
  assert.equal(r.rows.filter(x => x.indicator_id === 3114 && x.entity_id !== 32).length, 0, 'estupro só existe por UF');
  assert.equal(at(3114, 32, '2024-02-01')!.value, 4);
  assert.equal(at(3124, 32)!.value, 2.5, 'apreensão usa total_peso');
  const parts = r.rows.filter(x => x.indicator_id === 3101 && x.period_start === jan && x.entity_id !== 32).reduce((n, x) => n + (x.value ?? 0), 0);
  assert.equal(parts, 9);
  assert.equal(r.xwStats.unassignedName, 1);
});

test('VDE: cobertura distingue mês com registros (1) de mês zerado (2) e conta linhas repetidas (DF por região administrativa)', () => {
  const r = buildVdeSlice(vdeFixture(), vargs('ES'));
  const c = (ind: number, comp: number) => r.cov.find(x => x.indicator_id === ind && x.competence === comp)!;
  assert.equal(c(3101, 202401).status, 1); assert.equal(c(3101, 202402).status, 2); assert.equal(c(3101, 202401).mun_pairs, 79);
  assert.equal(c(3101, 202401).unassigned, 1);
  assert.equal(r.cov.some(x => x.indicator_id === 3118), false, 'PF furto de veículo é zero estrutural: sem cobertura nem indicador');
  const df = buildVdeSlice(vdeFixture(), vargs('DF'));
  assert.equal(df.cov.find(x => x.competence === 202401)!.dup_lines, 33);
  const bsb = df.rows.find(x => x.indicator_id === 3101 && x.entity_id === 5300108)!;
  assert.equal(bsb.value, 17, 'linhas repetidas de Brasília são somadas');
});

test('VDE: meses futuros preenchidos com zero não são publicados', () => {
  const j = vdeFixture();
  for (let m = 202410; m <= 202412; m++) for (const c of j.cov) if (c.comp === m) { c.vit = 0; c.tot = 0; c.peso = 0; c.nz = 0; }
  j.rows = j.rows.filter(r => r[3] < 202410);
  const empty = findEmptyMonths(j);
  assert.deepEqual([...empty].sort(), [202410, 202411, 202412]);
  const r = buildVdeSlice(j, vargs('ES', { emptyMonths: empty }));
  assert.equal(r.months.length, 9);
  assert.equal(r.rows.some(x => x.period_start >= '2024-10-01' && x.indicator_id < 3200), false);
  assert.equal(r.quality.rateYearComplete, false, 'ano com meses faltando não tem taxa anual');
});

test('VDE: taxa anual só em ano civil completo, com denominador do mesmo ano e sem taxa em município sem registro', () => {
  const r = buildVdeSlice(vdeFixture(), vargs('ES'));
  const uf = r.rows.find(x => x.indicator_id === 3201 && x.entity_id === 32)!;
  assert.ok(Math.abs(uf.value! - 9 / 4000000 * 100000) < 1e-9);
  assert.equal(r.rows.find(x => x.indicator_id === 3201 && x.entity_id === 3205309)!.numerator, 5);
  assert.equal(r.rows.find(x => x.indicator_id === 3201 && x.entity_id === 3200359), undefined);
  const semPop = buildVdeSlice(vdeFixture(), vargs('ES', { pop: new Map() }));
  assert.equal(semPop.rows.some(x => x.indicator_id === 3201), false);
  const corrente = buildVdeSlice(vdeFixture(), vargs('ES', { currentYear: 2024 }));
  assert.equal(corrente.rows.some(x => x.indicator_id === 3201), false, 'ano corrente é parcial: sem taxa');
  assert.ok(corrente.rows.every(x => x.status === 1 && (x.flags! & FLAG.preliminary) !== 0));
});

test('VDE: evento desconhecido, medida inesperada, só-UF com município e zero estrutural com valor falham em vez de serem gravados', () => {
  const j1 = vdeFixture(); j1.rows.push(['ES', 'NÃO INFORMADO', 'Evento novo', 202401, 'Estadual', 1, null, null, 0]); j1.cov.push(cov('ES', 'Evento novo', 202401));
  assert.throws(() => buildVdeSlice(j1, vargs('ES')), /desconhecido/);
  const j2 = vdeFixture(); j2.rows.push(['ES', 'VITÓRIA', 'Homicídio doloso', 202403, 'Estadual', 1, 2, null, 0]);
  assert.throws(() => buildVdeSlice(j2, vargs('ES')), /medida inesperada/);
  const j3 = vdeFixture(); j3.rows.push(['ES', 'VITÓRIA', 'Roubo de veículo', 202403, 'Estadual', null, 1, null, 0]);
  assert.throws(() => buildVdeSlice(j3, vargs('ES')), /só-UF com município/);
  const j4 = vdeFixture(); j4.rows.push(['ES', 'NÃO INFORMADO', 'Furto de veículo', 202403, 'Polícia Federal', null, 1, null, 0]);
  assert.throws(() => buildVdeSlice(j4, vargs('ES')), /zero estrutural/);
});

test('VDE: nome municipal sem correspondência vai ao município ignorado e é declarado (nunca vira zero nem município inventado)', () => {
  const j = vdeFixture(); j.rows.push(['ES', 'CIDADE INEXISTENTE', 'Homicídio doloso', 202403, 'Estadual', 2, null, null, 0]); j.cov.find(c => c.uf === 'ES' && c.evento === 'Homicídio doloso' && c.comp === 202403)!.vit = 2;
  const r = buildVdeSlice(j, vargs('ES'));
  assert.deepEqual(r.xwStats.unmatched, ['CIDADE INEXISTENTE']);
  assert.equal(r.rows.find(x => x.indicator_id === 3101 && x.entity_id === 3200000 && x.period_start === '2024-03-01')!.value, 2);
  assert.equal(r.rows.find(x => x.indicator_id === 3101 && x.entity_id === 32 && x.period_start === '2024-03-01')!.value, 2);
});

test('VDE: alias de grafia (SÃO LUIZ → São Luiz do Anauá) é aplicado e contado', () => {
  const j: VdeJson = { rows_read: 1, keys: 1, competences: [202401], columns: [], bad: {}, events: {}, abrangencias: {}, rows: [['RR', 'SÃO LUIZ', 'Homicídio doloso', 202401, 'Estadual', 2, null, null, 0]], cov: [cov('RR', 'Homicídio doloso', 202401, { mun: 16, vit: 2, nz: 1 })] };
  const r = buildVdeSlice(j, vargs('RR', { year: 2024 }));
  assert.equal(r.rows.find(x => x.indicator_id === 3101 && x.entity_id === 1400605)!.value, 2);
  assert.equal(r.xwStats.matchedAlias, 1);
});
