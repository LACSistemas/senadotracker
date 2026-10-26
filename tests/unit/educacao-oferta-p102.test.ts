import assert from 'node:assert/strict';
import test from 'node:test';
import { EDU_OFFER_COLS, OFFER_AVAILABLE_FROM, OFFER_MEASURES, OFFER_MEASURE_BY_CODE, buildOfferYear, offerCompetence, offerSliceFingerprint, type OfferRaw, type OfferSchool } from '../../packages/db/src/exec/index.ts';

const CAD = new Map<number, OfferSchool>([[32000001, { uf: 32, dep: 3, loc: 1 }], [32000002, { uf: 32, dep: 2, loc: 2 }], [32000003, { uf: 32, dep: 4, loc: null }], [35000001, { uf: 35, dep: 3, loc: 1 }], [32000004, { uf: 32, dep: 3, loc: 1 }]]);
const raw = (inep: number, v: Record<string, number | string> = {}, row = inep): OfferRaw => ({ row, inep: String(inep), v: Object.fromEntries(Object.entries({ mat_bas: 100, mat_inf_cre: 10, mat_inf_pre: 20, mat_fund_ai: 30, mat_fund_af: 25, mat_med: 15, mat_eja_fund: 0, mat_eja_med: 0, mat_prof: 0, mat_esp_cc: 4, mat_esp_ce: 1,
  tur_bas: 6, tur_inf_cre: 1, tur_inf_pre: 1, tur_fund_ai: 2, tur_fund_af: 1, tur_med: 1, tur_eja: 0, tur_eja_fund: 0, tur_eja_med: 0, tur_prof: 0, tur_esp_cc: 1, tur_esp_ce: 0, v_mat_inf: 30, v_mat_fund: 55, v_mat_eja: 0, v_mat_esp: 5, v_tur_inf: 2, v_tur_fund: 3, v_tur_esp: 1, ...v }).map(([k, x]) => [k, String(x)])) });

test('catálogo: toda coluna gravada tem medida; partições e transversais declaradas; derivadas sem coluna', () => {
  for (const c of EDU_OFFER_COLS) assert.ok(OFFER_MEASURES.some(m => m.column === c), c);
  assert.equal(new Set(OFFER_MEASURES.map(m => m.code)).size, OFFER_MEASURES.length);
  assert.equal(OFFER_MEASURE_BY_CODE.get('mat_prof')!.additivity, 'TRANSVERSAL'); assert.equal(OFFER_MEASURE_BY_CODE.get('mat_esp_cc')!.additivity, 'TRANSVERSAL'); assert.equal(OFFER_MEASURE_BY_CODE.get('mat_prof_ni')!.column, '(derivada)');
  const parts = OFFER_MEASURES.filter(m => m.code.startsWith('mat_') && m.additivity === 'PARTICAO' && m.partOf === 'mat_bas').map(m => m.code).sort();
  assert.deepEqual(parts, ['mat_ead', 'mat_eja_fund', 'mat_eja_med', 'mat_fund_af', 'mat_fund_ai', 'mat_inf_cre', 'mat_inf_pre', 'mat_med', 'mat_noturno']);   // etapas e turno: duas partições distintas do mesmo total
  assert.equal(offerCompetence(2025), 202505);
});

test('linha válida vira oferta; o resto da partição (profissional não integrada) nunca é negativo; universo = matrícula ou turma > 0', () => {
  const b = buildOfferYear(2024, [raw(32000001), raw(32000002, { mat_bas: 0, tur_bas: 0, mat_inf_cre: 0, mat_inf_pre: 0, mat_fund_ai: 0, mat_fund_af: 0, mat_med: 0, mat_esp_cc: 0, mat_esp_ce: 0, tur_inf_cre: 0, tur_inf_pre: 0, tur_fund_ai: 0, tur_fund_af: 0, tur_med: 0, tur_esp_cc: 0, v_mat_inf: 0, v_mat_fund: 0, v_mat_esp: 0, v_tur_inf: 0, v_tur_fund: 0, v_tur_esp: 0 })], CAD);
  const s = b.slices.get(32)!; assert.equal(s.rows.length, 1); assert.equal(b.skippedNoOffer, 1); assert.equal(s.rows[0]!.mat_bas, 100);
  assert.deepEqual([s.cov.rows_in, s.cov.valid, s.cov.rejected, s.cov.with_mat, s.cov.with_tur, s.cov.only_tur], [1, 1, 0, 1, 1, 0]);
  const only = buildOfferYear(2025, [raw(32000001, { mat_bas: '', mat_inf_cre: '', mat_inf_pre: '', mat_fund_ai: '', mat_fund_af: '', mat_med: '', mat_esp_cc: '', mat_esp_ce: '', v_mat_inf: '', v_mat_fund: '', v_mat_esp: '' })], CAD).slices.get(32)!;
  assert.deepEqual([only.cov.with_mat, only.cov.with_tur, only.cov.only_tur], [0, 1, 1]);   // 2025: turma sem matrícula
  assert.equal(only.rows[0]!.mat_bas, null);
});

test('rejeições classificadas: código, duplicado, fora do cadastro, valor, partição, especial > básica, turno, resto negativo', () => {
  const rows = [raw(123), raw(32000001), raw(32000001, {}, 99), raw(99999999), raw(32000002, { mat_bas: 'x1' }), raw(32000003, { v_mat_inf: 99 }), raw(35000001, { mat_esp_cc: 90, mat_esp_ce: 20, v_mat_esp: 110 }), raw(32000004, { mat_bas: 50 }, 7)];
  const b = buildOfferYear(2024, rows, CAD); const r = b.rejects.map(x => x.reason);
  assert.deepEqual(r, ['INEP_INVALIDO', 'INEP_DUPLICADO', 'FORA_DO_CADASTRO', 'VALOR_INVALIDO', 'PARTICAO_INCONSISTENTE', 'ESPECIAL_MAIOR_QUE_BASICA', 'PARTICAO_INCONSISTENTE']);   // o último: BAS 50 < etapas 100
  const ok = buildOfferYear(2016, [raw(32000001, { v_mat_d: 90, mat_noturno: 5, mat_ead: 0 })], CAD); assert.equal(ok.rejects[0]!.reason, 'TURNO_INCONSISTENTE');
  assert.equal(buildOfferYear(2014, [raw(32000001, { v_mat_d: 95, mat_noturno: 5, mat_ead: 0 })], CAD).rejects.length, 0);
  const cov = b.slices.get(32)!.cov; assert.equal(cov.rows_in, cov.valid + cov.rejected);
});

test('disponibilidade por edição: turno antes de 2014 e tempo integral de turmas antes de 2023 viram NULL (nunca zero); depois ficam', () => {
  assert.deepEqual(OFFER_AVAILABLE_FROM, { mat_noturno: 2014, mat_ead: 2014, tur_int_inf: 2023, tur_int_fund: 2023, tur_int_med: 2023 });
  const old = buildOfferYear(2012, [raw(32000001, { mat_noturno: 30, mat_ead: 0, tur_int_fund: 2 })], CAD).slices.get(32)!.rows[0]!;
  assert.deepEqual([old.mat_noturno, old.mat_ead, old.tur_int_fund], [null, null, null]);
  const nw = buildOfferYear(2024, [raw(32000001, { v_mat_d: 70, mat_noturno: 30, mat_ead: 0, tur_int_fund: 2 })], CAD).slices.get(32)!.rows[0]!;
  assert.deepEqual([nw.mat_noturno, nw.mat_ead, nw.tur_int_fund], [30, 0, 2]);
});

test('EJA de turmas pelo total: fundamental + médio pode ser menor que o total em 2025 sem rejeitar (turma de EJA sem etapa classificada)', () => {
  const b = buildOfferYear(2025, [raw(32000001, { tur_bas: 7, tur_eja: 1, tur_eja_fund: 0, tur_eja_med: 0 })], CAD);
  assert.equal(b.rejects.length, 0); assert.equal(b.slices.get(32)!.rows[0]!.tur_eja, 1);
});

test('agregados por UF × dependência × localização: soma, escolas, NULL mantido quando todas as parcelas são NULL', () => {
  const b = buildOfferYear(2012, [raw(32000001), raw(32000002, { mat_bas: 40, mat_inf_cre: 5, mat_inf_pre: 5, mat_fund_ai: 10, mat_fund_af: 10, mat_med: 5, mat_esp_cc: 0, mat_esp_ce: 0, v_mat_inf: 10, v_mat_fund: 20, v_mat_esp: 0, v_tur_esp: 0, tur_esp_cc: 0 }), raw(32000003)], CAD).slices.get(32)!;
  assert.deepEqual(b.agg.map(a => [a.dep, a.loc, a.schools, a.mat_bas]), [[2, 2, 1, 40], [3, 1, 1, 100], [4, 0, 1, 100]]);
  assert.equal(b.agg[0]!.mat_noturno, null);   // 2012: sem turno
  assert.equal(b.agg.reduce((s, a) => s + (a.mat_bas ?? 0), 0), b.rows.reduce((s, r) => s + (r.mat_bas ?? 0), 0));
});

test('impressão da fatia estável com outra ordem e sensível a valor, arquivo e versão', () => {
  const mk = (rows: OfferRaw[]) => buildOfferYear(2024, rows, CAD).slices.get(32)!;
  const a = mk([raw(32000001), raw(32000002)]), b = mk([raw(32000002), raw(32000001)]);
  assert.equal(offerSliceFingerprint(['x'], a), offerSliceFingerprint(['x'], b)); assert.notEqual(offerSliceFingerprint(['x'], a), offerSliceFingerprint(['y'], a));
  assert.notEqual(offerSliceFingerprint(['x'], a), offerSliceFingerprint(['x'], mk([raw(32000001, { mat_prof: 3 }), raw(32000002)])));
});
