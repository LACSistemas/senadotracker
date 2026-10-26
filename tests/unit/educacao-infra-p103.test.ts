import assert from 'node:assert/strict';
import test from 'node:test';
import { EDU_INFRA_AGG_COLS, EDU_INFRA_COLS, INFRA_BY_CODE, INFRA_COUNTS, INFRA_FLAGS, INFRA_VARS, buildInfraYear, infraAvailable, infraCompetence, infraSliceFingerprint, type InfraRaw, type InfraSchool } from '../../packages/db/src/exec/index.ts';

const CAD = new Map<number, InfraSchool>([[32000001, { uf: 32, dep: 3, loc: 1, withMat: true }], [32000002, { uf: 32, dep: 2, loc: 2, withMat: true }], [32000003, { uf: 32, dep: 4, loc: null, withMat: false }], [35000001, { uf: 35, dep: 3, loc: 1, withMat: true }]]);
/** Linha crua: todas as colunas "sim"/"1" por padrão; override por código. */
const raw = (inep: number, v: Record<string, string> = {}, sit = '1', row = inep): InfraRaw => ({ row, inep: String(inep), sit, v: Object.fromEntries(INFRA_VARS.map(x => [x.code, x.kind === 'flag' ? '1' : '3']).map(([k, d]) => [k, v[k!] ?? d])) });

test('catálogo: códigos e colunas oficiais únicos; 2019 separa famílias redefinidas em colunas distintas', () => {
  assert.equal(new Set(INFRA_VARS.map(x => x.code)).size, INFRA_VARS.length);
  assert.equal(new Set(INFRA_VARS.map(x => x.src)).size, INFRA_VARS.length);
  assert.equal(INFRA_FLAGS.length + INFRA_COUNTS.length, INFRA_VARS.length);
  assert.equal(EDU_INFRA_COLS.length, INFRA_VARS.length);
  assert.equal(EDU_INFRA_AGG_COLS.length, INFRA_FLAGS.length * 2 + INFRA_COUNTS.length * 2);
  for (const [oldC, newC] of [['agua_filtrada', 'agua_potavel'], ['banheiro_dentro', 'banheiro'], ['salas_existentes', 'salas_dentro'], ['energia_gerador', 'energia_gerador_fossil']] as const) {
    assert.ok(INFRA_BY_CODE.get(oldC)!.to <= 2018 && INFRA_BY_CODE.get(newC)!.from >= 2019, `${oldC}/${newC}`);   // nunca fundidas
  }
  assert.equal(infraAvailable('internet_alunos', 2018), false); assert.equal(infraAvailable('internet_alunos', 2019), true); assert.equal(infraAvailable('biblioteca', 2008), false); assert.equal(infraAvailable('biblioteca_ou_leitura', 2007), true);
  assert.equal(infraCompetence(2025), 202505);
});

test('fora da vigência da variável o valor do arquivo é descartado (NULL), mesmo que venha 0 ou 1: o ZIP histórico preenche colunas futuras', () => {
  const b = buildInfraYear(2011, [raw(32000001, { agua_potavel: '0', internet_alunos: '0', biblioteca: '1' })], CAD);
  const r = b.slices.get(32)!.rows[0]!;
  assert.equal(r.agua_potavel, null); assert.equal(r.internet_alunos, null); assert.equal(r.banheiro, null); assert.equal(r.salas_dentro, null);
  assert.equal(r.biblioteca, true); assert.equal(r.internet, true); assert.equal(r.salas_utilizadas, 3);
  const nw = buildInfraYear(2024, [raw(32000001, { agua_potavel: '0', agua_filtrada: '1' })], CAD).slices.get(32)!.rows[0]!;
  assert.equal(nw.agua_potavel, false); assert.equal(nw.agua_filtrada, null);   // DISCONTINUED até 2018
});

test('branco = não informado (NULL), 0 = "não" declarado; escola sem nenhuma resposta aplicável é contada como sem resposta, não como "sem infraestrutura"', () => {
  const blank = Object.fromEntries(INFRA_VARS.map(x => [x.code, '']));
  const b = buildInfraYear(2022, [raw(32000001, blank), raw(32000002, { internet: '0', biblioteca: '' })], CAD);
  const s = b.slices.get(32)!;
  assert.equal(s.rows.find(r => r.inep === 32000001)!.internet, null);
  assert.equal(s.rows.find(r => r.inep === 32000002)!.internet, false); assert.equal(s.rows.find(r => r.inep === 32000002)!.biblioteca, null);
  assert.deepEqual([s.cov.valid, s.cov.answered, s.cov.unanswered], [2, 1, 1]);
  const g = s.agg.find(a => a.dep === 2)!; assert.equal(g.internet_f, 1); assert.equal(g.internet_t, null);
  const g3 = s.agg.find(a => a.dep === 3)!; assert.equal(g3.schools, 1); assert.equal(g3.internet_t, null); assert.equal(g3.internet_f, null);   // sem resposta não entra nem em "sim" nem em "não"
});

test('códigos oficiais especiais: 9 = não informado e 88888 = valor extremo viram NULL, contados à parte e nunca somados; 9 em outra variável é erro', () => {
  const b = buildInfraYear(2024, [raw(32000001, { internet_comp_aluno: '9', internet_disp_pessoal: '1', qt_tv: '88888', qt_multimidia: '3' }), raw(32000002, { qt_tv: '2' })], CAD);
  const s = b.slices.get(32)!; const r1 = s.rows.find(r => r.inep === 32000001)!;
  assert.equal(r1.internet_comp_aluno, null); assert.equal(r1.internet_disp_pessoal, true); assert.equal(r1.qt_tv, null); assert.equal(r1.qt_multimidia, 3);
  assert.deepEqual([s.cov.coded_unknown, s.cov.extreme, s.cov.rejected], [1, 1, 0]);
  assert.equal(s.agg.reduce((n, a) => n + (a.qt_tv_s ?? 0), 0), 2);   // 88888 não entra na soma
  assert.equal(s.agg.reduce((n, a) => n + (a.qt_tv_n ?? 0), 0), 1);
  assert.equal(buildInfraYear(2024, [raw(32000001, { internet: '9' })], CAD).rejects[0]!.reason, 'VALOR_INVALIDO');
  assert.equal(INFRA_BY_CODE.get('banda_larga')!.applicableWhen, 'internet');
});

test('universo = escola em atividade com identidade no cadastro; demais situações não geram linha e não são rejeição', () => {
  const b = buildInfraYear(2024, [raw(32000001), raw(32000002, {}, '2'), raw(32000003, {}, '3'), raw(99999999, {}, '2')], CAD);
  const s = b.slices.get(32)!; assert.equal(s.rows.length, 1); assert.equal(b.notActive, 2);
  assert.deepEqual([s.cov.rows_in, s.cov.active, s.cov.valid, s.cov.rejected, s.cov.with_mat], [3, 1, 1, 0, 1]);
  assert.equal(b.rejects.length, 0);   // paralisada/extinta fora do cadastro não é erro
});

test('rejeições classificadas: código, duplicado, fora do cadastro (ativa), valor e faixa', () => {
  const rows = [raw(123), raw(32000001), raw(32000001, {}, '1', 99), raw(99999999), raw(32000002, { internet: '2' }), raw(32000003, { salas_utilizadas: 'x' }), raw(35000001, { salas_utilizadas: '40000' })];
  const b = buildInfraYear(2024, rows, CAD); const r = b.rejects.map(x => x.reason);
  assert.deepEqual(r, ['INEP_INVALIDO', 'INEP_DUPLICADO', 'FORA_DO_CADASTRO', 'VALOR_INVALIDO', 'VALOR_INVALIDO', 'VALOR_FORA_DE_FAIXA']);
  const cov = b.slices.get(32)!.cov; assert.equal(cov.rows_in, cov.valid + cov.rejected);
});

test('agregados por dependência × localização: sim e não por variável; soma e nº de escolas com valor para quantidades', () => {
  const b = buildInfraYear(2024, [raw(32000001, { internet: '1', salas_utilizadas: '4' }), raw(32000002, { internet: '0', salas_utilizadas: '6' }), raw(32000003, { internet: '1', salas_utilizadas: '' })], CAD);
  const s = b.slices.get(32)!; assert.equal(s.agg.length, 3);
  const total = (k: string) => s.agg.reduce((n, a) => n + (a[k] ?? 0), 0);
  assert.equal(total('internet_t'), 2); assert.equal(total('internet_f'), 1); assert.equal(total('schools'), 3);
  assert.equal(total('salas_utilizadas_s'), 10); assert.equal(total('salas_utilizadas_n'), 2);
  const loc0 = s.agg.find(a => a.dep === 4)!; assert.equal(loc0.loc, 0);   // localização ausente no cadastro = 0
});

test('impressão da fatia muda com qualquer célula, com o parser e com os arquivos de origem', () => {
  const mk = (v: Record<string, string>) => buildInfraYear(2024, [raw(32000001, v)], CAD).slices.get(32)!;
  const a = infraSliceFingerprint(['aa'], mk({})), b = infraSliceFingerprint(['aa'], mk({ biblioteca: '0' })), c = infraSliceFingerprint(['bb'], mk({}));
  assert.notEqual(a, b); assert.notEqual(a, c); assert.equal(a, infraSliceFingerprint(['aa'], mk({})));
});
