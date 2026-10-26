import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, applyExecMigrations, buildEduYear, eduCompetence, getEducationMunicipalitySchools, getEducationSchool, getEducationSchoolHistory, getEducationStateSchools, rollbackRun,
  type CensoRow, type EduYearBuilt,
} from '../../packages/db/src/exec/index.ts';
import { loadMunicipalities, publishEduSlice, type EduFiles } from '../../apps/collector/src/exec/educacao.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); });
test.after(async () => { if (!skip) await ctx.drop(); });

const VIT = '3205309', VV = '3205200', SP = '3550308';
const r = (inep: number, o: Partial<CensoRow> = {}): CensoRow => ({ row: inep, inep: String(inep), ibge7: VIT, uf: '32', name: `ESCOLA ${inep}`, dep: '3', loc: '1', sit: '1', mat: '100', ...o });
const files = (year: number, tag = 'a'): EduFiles => ({ year, relPaths: [`inep/censo_escolar/${year}/x.zip`], sha256: [`${tag}${year}`.padEnd(64, '0')], bytes: 1 });
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const eduState = async () => `${await hash('SELECT * FROM civica_exec.exec_edu_school_year')}|${await hash('SELECT * FROM civica_exec.exec_edu_school')}|${await hash('SELECT * FROM civica_exec.exec_edu_cov')}`;
const logCount = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
const firstOf = async (uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [DATASET.edu_censo, uf, comp])).rowCount === 0;
async function publish(year: number, rows: CensoRow[], tag = 'a', failAfterApply = false) {
  const built: EduYearBuilt = buildEduYear(year, rows, await loadMunicipalities(pool)); const out = [];
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) out.push({ uf, res: await publishEduSlice(pool, { year, slice, files: files(year, tag), first: await firstOf(uf, eduCompetence(year)), built, failAfterApply }) });
  return { built, out };
}

test('migração v9: três tabelas aditivas, idempotente, sem tocar exec_entity nem colunas pessoais', async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  assert.ok((await pool.query(`SELECT version FROM civica_exec.schema_migrations`)).rows.some(x => x.version === 9));
  const tabs = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'civica_exec' AND table_name LIKE 'exec_edu_%' AND table_name NOT LIKE 'exec_edu_offer%' AND table_name NOT LIKE 'exec_edu_infra%' AND table_name NOT LIKE 'exec_edu_ind%' AND table_name NOT LIKE 'exec_edu_doc%' AND table_name NOT LIKE 'exec_edu_ideb%' AND table_name NOT LIKE 'exec_edu_saeb%' AND table_name NOT LIKE 'exec_edu_flow%' AND table_name NOT LIKE 'exec_edu_trn%' AND table_name NOT LIKE 'exec_edu_inse%' ORDER BY 1`)).rows.map(x => x.table_name);
  assert.deepEqual(tabs, ['exec_edu_cov', 'exec_edu_school', 'exec_edu_school_year']);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name LIKE 'exec_edu_%' AND table_name NOT LIKE 'exec_edu_offer%' AND table_name NOT LIKE 'exec_edu_infra%' AND table_name NOT LIKE 'exec_edu_ind%' AND table_name NOT LIKE 'exec_edu_doc%' AND table_name NOT LIKE 'exec_edu_ideb%' AND table_name NOT LIKE 'exec_edu_saeb%' AND table_name NOT LIKE 'exec_edu_flow%' AND table_name NOT LIKE 'exec_edu_trn%' AND table_name NOT LIKE 'exec_edu_inse%'`)).rows.map(x => x.column_name);
  for (const bad of ['gestor', 'manager', 'cpf', 'email', 'telefone', 'phone', 'endereco', 'address', 'cep', 'latitude', 'longitude']) assert.ok(!cols.includes(bad), `coluna proibida ${bad}`);
  const chk = (await pool.query(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid = 'civica_exec.exec_entity'::regclass AND contype = 'c'`)).rows.map(x => String(x.d)).join(' ');
  assert.match(chk, /kind >= 1\) AND \(kind <= 5\)|BETWEEN 1 AND 5/i);
});

test('publicação por UF × edição: contagens, identidade global, NO_CHANGE sem novo log, FK adiada, cobertura', async () => {
  const rows24 = [r(32000001), r(32000002, { sit: '2', mat: '' }), r(32000003, { dep: '4' }), r(32000004, { ibge7: VV }), r(35000001, { ibge7: SP, uf: '35' }), r(32000005, { ibge7: '9999999' }), r(32000001)];
  const a = await publish(2024, rows24);
  assert.deepEqual(a.out.map(x => [x.uf, x.res.status]), [[32, 'PUBLISHED'], [35, 'PUBLISHED']]);
  const n = async (sql: string) => Number((await pool.query(sql)).rows[0].n);
  assert.equal(await n(`SELECT count(*)::int n FROM civica_exec.exec_edu_school_year WHERE year = 2024`), 5);
  assert.equal(await n(`SELECT count(*)::int n FROM civica_exec.exec_edu_school`), 5);
  const cov = (await pool.query(`SELECT uf, rows_in, valid, rejected, active, with_mat, univ, muns FROM civica_exec.exec_edu_cov WHERE year = 2024 ORDER BY uf`)).rows;
  assert.deepEqual(cov, [{ uf: 32, rows_in: 5, valid: 4, rejected: 1, active: 3, with_mat: 3, univ: 3, muns: 2 }, { uf: 35, rows_in: 1, valid: 1, rejected: 0, active: 1, with_mat: 1, univ: 1, muns: 1 }]);
  assert.equal(a.built.rejects.filter(x => x.reason === 'MUNICIPIO_INEXISTENTE').length, 1);
  assert.equal(await n(`SELECT count(*)::int n FROM civica_exec.exec_change_log`), 0, 'carga inicial não gera change log');
  const before = await eduState(); const logs = await logCount();
  const again = await publish(2024, rows24);
  assert.deepEqual(again.out.map(x => x.res.status), ['NO_CHANGE', 'NO_CHANGE']); assert.equal(await eduState(), before); assert.equal(await logCount(), logs);
  // a FK da identidade é adiada, mas vale no COMMIT: linha de escola sem identidade não passa
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_edu_school_year (inep, year, entity_id, name, dep, sit) SELECT 11111111, 2024, entity_id, 'X', 3, 1 FROM civica_exec.exec_entity WHERE ibge7 = ${VIT}`), /foreign key|violates/i);
});

test('republicação com mudança: só o diferente entra no log; transições, lacunas e rollback exato; ausência não vira fechamento', async () => {
  const base = [r(32000001), r(32000002, { sit: '2', mat: '' }), r(32000003, { dep: '4' }), r(32000004, { ibge7: VV })];
  await publish(2025, [...base, r(32000006)]);                    // 2025: 32000006 nova; 32000004 ainda lá
  await publish(2023, [r(32000001), r(32000003, { dep: '4' })]);  // 2023: 32000002 e 32000004 AUSENTES (existem em 2024)
  const prevHash = await eduState(); const logs = await logCount();
  // retificação 2025 (arquivo novo): muda nome, município e dependência de 32000004 e some 32000006 na UF 32
  const v2 = [r(32000001), r(32000002, { sit: '2', mat: '' }), r(32000003, { dep: '4' }), r(32000004, { ibge7: VIT, name: 'NOVO NOME', dep: '2' })];
  const x = await publish(2025, v2, 'b');
  const run = x.out.find(o => o.uf === 32)!.res; assert.equal(run.status, 'PUBLISHED'); assert.ok(x.out.find(o => o.uf === 32)!.res.status === 'PUBLISHED');
  const after = await logCount(); assert.ok(after > logs && after - logs <= 3, `log só do diferente (2 U + 1 D), obtido ${after - logs}`);
  const ops = (await pool.query(`SELECT op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY op ORDER BY op`, [(run as { runId: number }).runId])).rows;
  assert.deepEqual(ops.map(o => `${o.op}${o.n}`).sort(), ['D1', 'U2']);   // D: escola que sumiu da fatia; U: a escola alterada + a linha de cobertura da UF
  const h = await getEducationSchoolHistory(pool, 32000004); assert.deepEqual(h!.editions.map(e => e.year), [2024, 2025]);
  assert.deepEqual(h!.transitions.map(t => `${t.kind}:${t.toYear}`).sort(), ['DEPENDENCIA:2025', 'MUNICIPIO:2025', 'NOME:2025']);
  const g = await getEducationSchoolHistory(pool, 32000002); assert.deepEqual(g!.gaps, []);   // presente em 2024 e 2025 (contíguas); ausente de 2023 não é lacuna (ainda não constava)
  const g2 = await getEducationSchoolHistory(pool, 32000004); assert.equal(g2!.gaps.length, 0);
  const rb = await rollbackRun(pool, (run as { runId: number }).runId); assert.equal(rb.status, 'ROLLED_BACK'); assert.equal(await eduState(), prevHash);
  // falha injetada não deixa nada
  const st = await eduState(); await assert.rejects(publish(2025, v2, 'c', true)); assert.equal(await eduState(), st);
});

test('lacuna real: escola presente em 2023 e 2025 e ausente em 2024 → lacuna declarada, sem fechamento', async () => {
  await publish(2022, [r(32000099)]); await publish(2024, [r(32000001), r(32000002, { sit: '2', mat: '' }), r(32000003, { dep: '4' }), r(32000004, { ibge7: VV }), r(35000001, { ibge7: SP, uf: '35' })], 'z');
  await publish(2026, [r(32000099)]);
  const h = await getEducationSchoolHistory(pool, 32000099); assert.deepEqual(h!.editions.map(e => e.year), [2022, 2026]);
  assert.deepEqual(h!.gaps.map(g => g.missingEditions), [[2023, 2024, 2025]]); assert.equal(h!.gaps[0]!.meaning, 'AUSENTE_NA_EDICAO_NAO_IMPLICA_FECHAMENTO');
  const sc = await getEducationSchool(pool, 32000099); assert.equal(sc!.latest!.year, 2026); assert.deepEqual(sc!.extensions, {}); assert.ok(sc!.restrictions.some(t => /ausente de uma edição NÃO é escola encerrada/i.test(t)));
  assert.equal(await getEducationSchool(pool, 11111111), null); assert.equal(await getEducationSchool(pool, Number.NaN), null);
});

test('read models territoriais: resumo por dependência, universo ≠ cadastro, filtros, busca, paginação limitada, vazios e entradas inválidas', async () => {
  const rows = [r(32100001), r(32100002, { sit: '2', mat: '' }), r(32100003, { dep: '4', name: '100% ESCOLA_X' }), r(32100004, { dep: '2' }), r(32100005, { mat: '0' }), r(32100006, { ibge7: VV })];
  await publish(2027, rows);
  const m = (await getEducationMunicipalitySchools(pool, VIT, { year: 2027 }))!;
  assert.deepEqual(m.counts, { registered: 5, active: 4, withEnrollment: 3, sinopseUniverse: 3 }); assert.equal(m.year, 2027); assert.equal(m.dataBase, '2027-05');
  assert.deepEqual(m.byDependency.map(d => [d.dependency.label, d.registered]), [['Estadual', 1], ['Municipal', 3], ['Privada', 1]]);
  assert.equal(m.page.total, 5); assert.equal(m.schools.length, 5); assert.equal(m.scope.name, 'Vitória'); assert.deepEqual(m.series.at(-1), { year: 2027, registered: 5, active: 4, withEnrollment: 3, sinopseUniverse: 3 });
  assert.ok(m.coverage.some(c => c.year === 2027 && c.rowsInFile === 6));
  const f = (await getEducationMunicipalitySchools(pool, VIT, { year: 2027, dependency: 3, sinopseUniverse: true }))!; assert.deepEqual(f.schools.map(s => s.name), ['ESCOLA 32100001']);
  assert.equal((await getEducationMunicipalitySchools(pool, VIT, { year: 2027, situation: 2 }))!.page.total, 1);
  assert.equal((await getEducationMunicipalitySchools(pool, VIT, { year: 2027, withEnrollment: false }))!.page.total, 2);
  assert.deepEqual((await getEducationMunicipalitySchools(pool, VIT, { year: 2027, search: '100% ESCOLA_X' }))!.schools.map(s => s.inep), [32100003]);   // curingas escapados
  assert.equal((await getEducationMunicipalitySchools(pool, VIT, { year: 2027, search: '%' }))!.page.total, 1);   // '%' é literal: só o nome que tem o caractere (um curinga traria as 5)
  assert.deepEqual((await getEducationMunicipalitySchools(pool, VIT, { year: 2027, search: '32100004' }))!.schools.map(s => s.inep), [32100004]);
  const p = (await getEducationMunicipalitySchools(pool, VIT, { year: 2027, pageSize: 2, page: 2 }))!; assert.equal(p.schools.length, 2); assert.equal(p.page.pages, 3);
  assert.equal((await getEducationMunicipalitySchools(pool, VIT, { year: 2027, pageSize: 100000 }))!.page.size, 200);
  assert.equal((await getEducationMunicipalitySchools(pool, VIT, { year: 1999 })), null); assert.equal(await getEducationMunicipalitySchools(pool, '12'), null); assert.equal(await getEducationMunicipalitySchools(pool, '1111111'), null);
  const u = (await getEducationStateSchools(pool, 32, { year: 2027, listSchools: false }))!; assert.deepEqual(u.counts, { registered: 6, active: 5, withEnrollment: 4, sinopseUniverse: 4 }); assert.equal(u.schools.length, 0);
  assert.equal(u.scope.uf, 'ES'); assert.equal(await getEducationStateSchools(pool, 99), null);
  const empty = (await getEducationMunicipalitySchools(pool, '3200359', { year: 2027 }))!; assert.deepEqual(empty.counts, { registered: 0, active: 0, withEnrollment: 0, sinopseUniverse: 0 }); assert.equal(empty.schools.length, 0);
});

test('edições antigas: a nota de 2007–2010 (só escolas em atividade) aparece na cobertura', async () => {
  await publish(2009, [r(32200001)]);
  const m = (await getEducationMunicipalitySchools(pool, VIT, { year: 2009 }))!; assert.match(m.coverage.find(c => c.year === 2009)!.note!, /somente escolas em atividade/);
});
