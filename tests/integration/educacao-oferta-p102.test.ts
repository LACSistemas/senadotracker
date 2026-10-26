import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, EDU_OFFER_COLS, applyExecMigrations, buildEduYear, buildOfferYear, eduCompetence, getEducationMunicipalityOffer, getEducationNationalOffer, getEducationSchoolOffer, getEducationStateOffer, offerCompetence, rollbackRun,
  type CensoRow, type OfferRaw, type OfferYearBuilt,
} from '../../packages/db/src/exec/index.ts';
import { loadMunicipalities, publishEduSlice, type EduFiles } from '../../apps/collector/src/exec/educacao.ts';
import { loadOfferCadastro, publishOfferSlice, type OfferFiles } from '../../apps/collector/src/exec/educacao-oferta.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); });
test.after(async () => { if (!skip) await ctx.drop(); });

const VIT = '3205309', VV = '3205200', SP = '3550308';
const cad = (inep: number, o: Partial<CensoRow> = {}): CensoRow => ({ row: inep, inep: String(inep), ibge7: VIT, uf: '32', name: `ESCOLA ${inep}`, dep: '3', loc: '1', sit: '1', mat: '100', ...o });
const raw = (inep: number, v: Record<string, number> = {}): OfferRaw => ({ row: inep, inep: String(inep), v: Object.fromEntries(Object.entries({ mat_bas: 100, mat_inf_cre: 10, mat_inf_pre: 20, mat_fund_ai: 30, mat_fund_af: 25, mat_med: 15, mat_eja_fund: 0, mat_eja_med: 0, mat_prof: 5, mat_esp_cc: 4, mat_esp_ce: 1,
  tur_bas: 6, tur_inf_cre: 1, tur_inf_pre: 1, tur_fund_ai: 2, tur_fund_af: 1, tur_med: 1, tur_eja: 0, tur_prof: 0, tur_esp_cc: 1, tur_esp_ce: 0, v_mat_inf: 30, v_mat_fund: 55, v_mat_esp: 5, v_tur_inf: 2, v_tur_fund: 3, v_tur_esp: 1, ...v }).map(([k, x]) => [k, String(x)])) });
const efiles = (year: number): EduFiles => ({ year, relPaths: [`inep/censo_escolar/${year}/x.zip`], sha256: [`c${year}`.padEnd(64, '0')], bytes: 1 });
const ofiles = (year: number, tag = 'o'): OfferFiles => ({ year, relPaths: [`inep/censo_escolar/${year}/x.zip`], sha256: [`${tag}${year}`.padEnd(64, '0')], bytes: 1 });
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const state = async () => `${await hash('SELECT * FROM civica_exec.exec_edu_offer_year')}|${await hash('SELECT * FROM civica_exec.exec_edu_offer_agg')}|${await hash('SELECT * FROM civica_exec.exec_edu_offer_cov')}`;
const logCount = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
const firstOf = async (ds: number, uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [ds, uf, comp])).rowCount === 0;
async function publishCadastro(year: number, rows: CensoRow[]) {
  const built = buildEduYear(year, rows, await loadMunicipalities(pool));
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) await publishEduSlice(pool, { year, slice, files: efiles(year), first: await firstOf(DATASET.edu_censo, uf, eduCompetence(year)), built });
}
async function publishOffer(year: number, rows: OfferRaw[], tag = 'o', failAfterApply = false) {
  const built: OfferYearBuilt = buildOfferYear(year, rows, await loadOfferCadastro(pool, year)); const out = [];
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) out.push({ uf, res: await publishOfferSlice(pool, { year, slice, files: ofiles(year, tag), first: await firstOf(DATASET.edu_oferta, uf, offerCompetence(year)), failAfterApply }) });
  return { built, out };
}

test('migração v10: três tabelas aditivas, FK composta para o cadastro da P10.1, sem coluna pessoal, idempotente', async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  assert.ok((await pool.query(`SELECT version FROM civica_exec.schema_migrations`)).rows.some(x => x.version === 10));
  const tabs = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'civica_exec' AND table_name LIKE 'exec_edu_offer%' ORDER BY 1`)).rows.map(x => x.table_name);
  assert.deepEqual(tabs, ['exec_edu_offer_agg', 'exec_edu_offer_cov', 'exec_edu_offer_year']);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name LIKE 'exec_edu_offer%'`)).rows.map(x => x.column_name);
  for (const bad of ['aluno', 'student', 'cpf', 'nome', 'gestor', 'docente', 'professor', 'email', 'telefone', 'endereco', 'raca', 'cor', 'sexo', 'deficiencia']) assert.ok(!cols.some(c => c === bad), `coluna proibida ${bad}`);
  for (const c of EDU_OFFER_COLS) assert.ok(cols.includes(c), c);
  const fk = (await pool.query(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid = 'civica_exec.exec_edu_offer_year'::regclass AND contype = 'f'`)).rows.map(x => String(x.d)).join(' ');
  assert.match(fk, /\(inep, year\) REFERENCES civica_exec\.exec_edu_school_year\(inep, year\)/);
});

test('publicação: oferta exige o cadastro da P10.1 (FK), CHECKs de partição, NO_CHANGE sem log, soma agregada = soma das escolas', async () => {
  await publishCadastro(2024, [cad(32000001), cad(32000002, { dep: '2', loc: '2' }), cad(32000003, { dep: '4', sit: '2', mat: '' }), cad(32000004, { ibge7: VV }), cad(35000001, { ibge7: SP, uf: '35' })]);
  const rows = [raw(32000001), raw(32000002, { mat_bas: 200, mat_fund_af: 125, v_mat_fund: 155, tur_bas: 8 }), raw(32000004, { mat_bas: 60, mat_inf_cre: 0, mat_inf_pre: 0, mat_fund_ai: 30, mat_fund_af: 30, mat_med: 0, mat_prof: 0, mat_esp_cc: 0, mat_esp_ce: 0, tur_bas: 3, tur_inf_cre: 0, tur_inf_pre: 0, tur_fund_ai: 2, tur_fund_af: 1, tur_med: 0, tur_prof: 0, tur_esp_cc: 0, v_mat_inf: 0, v_mat_fund: 60, v_mat_esp: 0, v_tur_inf: 0, v_tur_fund: 3, v_tur_esp: 0 }), raw(35000001)];
  const a = await publishOffer(2024, rows); assert.deepEqual(a.out.map(x => [x.uf, x.res.status]), [[32, 'PUBLISHED'], [35, 'PUBLISHED']]);
  const n = async (sql: string) => Number((await pool.query(sql)).rows[0].n);
  assert.equal(await n(`SELECT count(*)::int n FROM civica_exec.exec_edu_offer_year`), 4); assert.equal(await n(`SELECT count(*)::int n FROM civica_exec.exec_change_log`), 0, 'carga inicial sem change log');
  assert.deepEqual((await pool.query(`SELECT uf, rows_in, valid, rejected, with_mat, with_tur, only_tur FROM civica_exec.exec_edu_offer_cov ORDER BY uf`)).rows, [{ uf: 32, rows_in: 3, valid: 3, rejected: 0, with_mat: 3, with_tur: 3, only_tur: 0 }, { uf: 35, rows_in: 1, valid: 1, rejected: 0, with_mat: 1, with_tur: 1, only_tur: 0 }]);
  assert.equal(await n(`SELECT sum(mat_bas)::int n FROM civica_exec.exec_edu_offer_agg WHERE uf = 32`), 360); assert.equal(await n(`SELECT sum(mat_bas)::int n FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING (inep, year) WHERE y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = 32)`), 360);
  const before = await state(); const logs = await logCount(); const again = await publishOffer(2024, rows); assert.deepEqual(again.out.map(x => x.res.status), ['NO_CHANGE', 'NO_CHANGE']); assert.equal(await state(), before); assert.equal(await logCount(), logs);
  // a FK da P10.1 vale: oferta de escola sem cadastro na edição não entra; CHECKs recusam partição impossível
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_edu_offer_year (inep, year, mat_bas) VALUES (32000099, 2024, 10)`), /foreign key|violates/i);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_edu_offer_year (inep, year, mat_bas, mat_med) VALUES (32000003, 2024, 10, 20)`), /check|violates/i);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_edu_offer_year (inep, year, mat_bas, mat_esp_cc) VALUES (32000003, 2024, 10, 20)`), /check|violates/i);
});

test('consistência com o bit0 da P10.1: escola do cadastro com matrícula e sem oferta bloqueia a fatia inteira (nada parcial)', async () => {
  const st = await state();
  await assert.rejects(publishOffer(2024, [raw(32000001), raw(32000002), raw(35000001)], 'bit'), /divergem do bit0/);   // 32000004 (matrícula 100 no cadastro) ficou sem linha de oferta
  assert.equal(await state(), st);
});

test('retificação: só o diferente entra no log; rollback exato; falha injetada sem rastro; cadastro P10.1 intocado', async () => {
  const cadBefore = await hash('SELECT * FROM civica_exec.exec_edu_school_year');
  const rows = [raw(32000001), raw(32000002, { mat_bas: 200, mat_fund_af: 125, v_mat_fund: 155, tur_bas: 8 }), raw(32000004, { mat_bas: 60, mat_inf_cre: 0, mat_inf_pre: 0, mat_fund_ai: 30, mat_fund_af: 30, mat_med: 0, mat_prof: 0, mat_esp_cc: 0, mat_esp_ce: 0, tur_bas: 3, tur_inf_cre: 0, tur_inf_pre: 0, tur_fund_ai: 2, tur_fund_af: 1, tur_med: 0, tur_prof: 0, tur_esp_cc: 0, v_mat_inf: 0, v_mat_fund: 60, v_mat_esp: 0, v_tur_inf: 0, v_tur_fund: 3, v_tur_esp: 0 })];
  const ref = await state(); const logs = await logCount();
  const v2 = rows.map(r => r.inep === '32000001' ? raw(32000001, { mat_bas: 110, mat_med: 25, tur_bas: 7, tur_med: 2 }) : r);
  const x = await publishOffer(2024, v2, 'r2'); const run = x.out.find(o => o.uf === 32)!.res; assert.equal(run.status, 'PUBLISHED');
  const ops = (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [(run as { runId: number }).runId])).rows.map(o => `t${o.table_id}${o.op}${o.n}`);
  assert.deepEqual(ops, ['t83U1', 't84U1', 't85U0'].filter(o => !o.endsWith('U0')), 'uma escola e a linha agregada mudaram; cobertura igual');
  assert.equal((await logCount()) - logs, 2);
  const rb = await rollbackRun(pool, (run as { runId: number }).runId); assert.equal(rb.status, 'ROLLED_BACK'); assert.equal(await state(), ref);
  const st = await state(); await assert.rejects(publishOffer(2024, v2, 'r3', true)); assert.equal(await state(), st);
  assert.equal(await hash('SELECT * FROM civica_exec.exec_edu_school_year'), cadBefore);
});

test('dependência da P10.1: o cadastro não pode apagar escola que tem oferta (FK); republicar o cadastro igual é NO_CHANGE', async () => {
  const same = await (async () => { const built = buildEduYear(2024, [cad(32000001), cad(32000002, { dep: '2', loc: '2' }), cad(32000003, { dep: '4', sit: '2', mat: '' }), cad(32000004, { ibge7: VV })], await loadMunicipalities(pool)); return publishEduSlice(pool, { year: 2024, slice: built.slices.get(32)!, files: efiles(2024), first: false, built }); })();
  assert.equal(same.status, 'NO_CHANGE');
  const built = buildEduYear(2024, [cad(32000001), cad(32000002, { dep: '2', loc: '2' }), cad(32000003, { dep: '4', sit: '2', mat: '' })], await loadMunicipalities(pool));   // some 32000004, que tem oferta
  await assert.rejects(publishEduSlice(pool, { year: 2024, slice: built.slices.get(32)!, files: { ...efiles(2024), sha256: ['zz'.padEnd(64, '0')] }, first: false, built }), /foreign key|violates/i);
});

test('read models: município, UF, Brasil, escola; etapas somam o total; transversais separadas; razões e entradas inválidas', async () => {
  await publishCadastro(2025, [cad(32000001), cad(32000002, { dep: '2', loc: '2' }), cad(35000001, { ibge7: SP, uf: '35' })]);
  await publishOffer(2025, [raw(32000001, { mat_prof: 8, mat_esp_cc: 3, mat_esp_ce: 0, v_mat_esp: 3 }), raw(32000002, { mat_bas: 130, mat_inf_cre: 0, mat_inf_pre: 0, mat_fund_ai: 40, mat_fund_af: 40, mat_med: 20, mat_eja_fund: 10, mat_eja_med: 0, mat_prof: 0, mat_esp_cc: 0, mat_esp_ce: 0, tur_bas: 9, tur_inf_cre: 0, tur_inf_pre: 0, tur_fund_ai: 3, tur_fund_af: 3, tur_med: 1, tur_eja: 1, tur_esp_cc: 0, v_mat_inf: 0, v_mat_fund: 80, v_mat_eja: 10, v_mat_esp: 0, v_tur_inf: 0, v_tur_fund: 6, v_tur_esp: 0 }), raw(35000001)]);
  const m = (await getEducationMunicipalityOffer(pool, VIT, { year: 2024 }))!;
  assert.deepEqual([m.totals.matriculas, m.totals.turmas, m.totals.escolas, m.totals.matPorTurma], [300, 14, 2, 21.43]);
  const st = Object.fromEntries(m.stages.map(s => [s.code, s.matriculas])); assert.equal(Object.values(st).reduce((a, b) => a! + b!, 0), m.totals.matriculas);   // etapas + resto derivado = total
  assert.deepEqual(m.byDependency.map(d => [d.label, d.matriculas]), [['Estadual', 200], ['Municipal', 100]]); assert.deepEqual(m.byLocation.map(d => [d.label, d.matriculas]), [['Urbana', 100], ['Rural', 200]]);
  assert.equal(m.special.educacaoEspecial.total, 10); assert.equal(m.special.educacaoProfissionalTotal, 10);   // transversais: não entram em `stages`
  assert.ok(m.stages.find(s => s.code === 'MED')!.escolas! >= 1); assert.equal(m.series.length, 2); assert.deepEqual(m.series.map(s => s.year), [2024, 2025]);
  const uf = (await getEducationStateOffer(pool, 32, { year: 2025 }))!, br = (await getEducationNationalOffer(pool))!;
  assert.equal(uf.totals.matriculas, 230); assert.equal(br.totals.matriculas, 330); assert.equal(br.year, 2025); assert.equal(br.scope.kind, 'brasil'); assert.equal(br.series.length, 2); assert.equal(uf.scope.name, 'Espírito Santo');
  assert.deepEqual(br.byDependency.map(d => [d.key, d.matriculas]), [[2, 130], [3, 200]]);
  const sc = (await getEducationSchoolOffer(pool, 32000001))!; assert.deepEqual(sc.years.map(y => y.year), [2024, 2025]); assert.equal(sc.hasOffer, true);
  const none = (await getEducationSchoolOffer(pool, 32000003))!; assert.equal(none.hasOffer, false); assert.equal(none.years.length, 0);
  assert.equal(await getEducationSchoolOffer(pool, 11111111), null); assert.equal(await getEducationMunicipalityOffer(pool, 'abc'), null); assert.equal(await getEducationMunicipalityOffer(pool, VIT, { year: 1999 }), null);
  assert.equal(await getEducationStateOffer(pool, 99), null); assert.ok(m.restrictions.some(t => /não um aluno/i.test(t))); assert.deepEqual(m.extensions, {});
});
