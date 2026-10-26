import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EDU_FLAG, buildEduYear, eduCompetence, eduLayoutOf, eduSliceFingerprint, gapsOf, transitionsOf,
  type CensoRow, type EduMunicipality, type EduSchoolEdition,
} from '../../packages/db/src/exec/index.ts';
import { parseCensoLinks } from '../../apps/collector/src/exec/inep-censo.ts';

const MUNS = new Map<string, EduMunicipality>([['3205309', { entityId: 10, ufCode: 32 }], ['3205200', { entityId: 11, ufCode: 32 }], ['3550308', { entityId: 20, ufCode: 35 }]]);
let n = 0;
const row = (o: Partial<CensoRow> = {}): CensoRow => ({ row: ++n, inep: String(32000000 + n), ibge7: '3205309', uf: '32', name: `ESCOLA ${n}`, dep: '3', loc: '1', sit: '1', mat: '120', ...o });

test('competência e layout: referência de maio; 2025+ em tabelas', () => {
  assert.equal(eduCompetence(2025), 202505); assert.equal(eduLayoutOf(2024), 1); assert.equal(eduLayoutOf(2025), 2);
});

test('flags: com matrícula = QT_MAT_BAS > 0; recorte = em atividade E com matrícula; paralisada/extinta nunca entram', () => {
  const b = buildEduYear(2024, [row({ mat: '120' }), row({ mat: '0' }), row({ mat: '' }), row({ sit: '2', mat: '50' }), row({ sit: '3', mat: '' })], MUNS);
  const s = b.slices.get(32)!; const f = s.rows.map(r => r.flags);
  assert.deepEqual(f, [EDU_FLAG.withEnrollment | EDU_FLAG.universe, 0, 0, EDU_FLAG.withEnrollment, 0]);
  assert.deepEqual([s.cov.rows_in, s.cov.valid, s.cov.rejected, s.cov.active, s.cov.with_mat, s.cov.univ], [5, 5, 0, 3, 2, 1]);
});

test('rejeições: código inválido/duplicado, município inexistente, UF incompatível, dependência/situação/localização inválidas; cadastro histórico NÃO é descartado por sit', () => {
  const dupe = row();
  const rows = [dupe, { ...row(), inep: dupe.inep }, row({ inep: '123' }), row({ ibge7: '9999999' }), row({ uf: '35' }), row({ dep: '9' }), row({ dep: '' }), row({ sit: '7' }), row({ loc: '5' }), row({ sit: '3', mat: '' })];
  const b = buildEduYear(2020, rows, MUNS); const reasons = b.rejects.map(r => r.reason);
  assert.deepEqual(reasons, ['INEP_DUPLICADO', 'INEP_INVALIDO', 'MUNICIPIO_INEXISTENTE', 'UF_INCOMPATIVEL', 'DEPENDENCIA_INVALIDA', 'DEPENDENCIA_INVALIDA', 'SITUACAO_INVALIDA', 'LOCALIZACAO_INVALIDA']);
  const s = b.slices.get(32)!; assert.equal(s.rows.length, 2); assert.equal(s.rows.at(-1)!.sit, 3);   // a extinta continua no cadastro
  assert.equal(s.cov.rows_in, s.cov.valid + s.cov.rejected);
});

test('localização vazia vira NULL; nome vazio é marcado e recebe rótulo neutro; município e UF vêm da entidade', () => {
  const b = buildEduYear(2012, [row({ loc: '', name: '' }), row({ ibge7: '3550308', uf: '35' })], MUNS);
  const a = b.slices.get(32)!.rows[0]!; assert.equal(a.loc, null); assert.ok(a.flags & EDU_FLAG.nameMissing); assert.match(a.name, /^Escola \d+$/);
  assert.equal(b.slices.get(35)!.rows[0]!.entity_id, 20); assert.equal(b.slices.get(32)!.cov.muns, 1);
});

test('impressão da fatia: estável com ordem diferente e muda com qualquer atributo, versão ou arquivo', () => {
  const rows = [row(), row(), row({ mat: '0' })]; const a = buildEduYear(2021, rows, MUNS).slices.get(32)!; const b = buildEduYear(2021, [...rows].reverse(), MUNS).slices.get(32)!;
  assert.equal(eduSliceFingerprint(['x'], a), eduSliceFingerprint(['x'], b));
  assert.notEqual(eduSliceFingerprint(['x'], a), eduSliceFingerprint(['y'], a));
  const c = buildEduYear(2021, [rows[0]!, rows[1]!, { ...rows[2]!, name: 'OUTRO' }], MUNS).slices.get(32)!; assert.notEqual(eduSliceFingerprint(['x'], a), eduSliceFingerprint(['x'], c));
});

const ed = (year: number, o: Partial<EduSchoolEdition> = {}): EduSchoolEdition => ({ inep: 32000001, year, municipality: { entityId: 10, ibge7: '3205309', name: 'Vitória', uf: 'ES' }, name: 'E1', dependency: { code: 3, label: 'Municipal' }, location: { code: 1, label: 'Urbana' }, situation: { code: 1, label: 'Em atividade' }, withEnrollment: true, sinopseUniverse: true, ...o });
test('transições: nome, município, dependência, localização e situação entre edições consecutivas; sem mudança → nenhuma', () => {
  assert.deepEqual(transitionsOf([ed(2020), ed(2021)]), []);
  const t = transitionsOf([ed(2021), ed(2020), ed(2022, { name: 'E2', dependency: { code: 2, label: 'Estadual' }, situation: { code: 2, label: 'Paralisada' }, location: null, municipality: { entityId: 11, ibge7: '3205200', name: 'Vila Velha', uf: 'ES' } }), ed(2023)]);
  assert.deepEqual(t.filter(x => x.toYear === 2022).map(x => x.kind).sort(), ['DEPENDENCIA', 'LOCALIZACAO', 'MUNICIPIO', 'NOME', 'SITUACAO']);
  assert.equal(t.filter(x => x.toYear === 2023).length, 5);
});
test('lacunas: edição publicada sem a escola é AUSENTE_NA_EDICAO, nunca fechamento; antes da 1ª e depois da última não é lacuna', () => {
  const g = gapsOf([ed(2019), ed(2022), ed(2023)], [2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  assert.deepEqual(g, [{ afterYear: 2019, beforeYear: 2022, missingEditions: [2020, 2021], meaning: 'AUSENTE_NA_EDICAO_NAO_IMPLICA_FECHAMENTO' }]);
  assert.deepEqual(gapsOf([ed(2020), ed(2021)], [2019, 2020, 2021, 2022]), []);
});

test('links do INEP: lê a página (a URL de 2025 tem underscore final) e ignora lixo', () => {
  const html = '<a href="https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2024.zip">x</a><a href="https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2025_.zip">y</a><a href="https://x.com/microdados_censo_escolar_2023.zip">z</a>';
  const m = parseCensoLinks(html); assert.equal(m.size, 2); assert.match(m.get(2025)!, /2025_\.zip$/); assert.ok(!m.has(2023));
});
