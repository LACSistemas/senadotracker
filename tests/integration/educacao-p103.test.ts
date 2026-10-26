import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, INFRA_COLS, applyExecMigrations, buildDocYear, buildEduYear, buildIndYear, buildInfraYear, eduCompetence, getEducationMunicipalityInfra, getEducationNationalInfra, getEducationSchoolInfra,
  getEducationSchoolIndicators, getEducationTeachers, getEducationTerritoryIndicators, rollbackRun, INFRA_VARS,
  type CensoRow, type DocRaw, type IndFileRows, type InfraRaw,
} from '../../packages/db/src/exec/index.ts';
import { loadMunicipalities, publishEduSlice, type EduFiles } from '../../apps/collector/src/exec/educacao.ts';
import { loadInfraCadastro, publishInfraSlice, type InfraFiles } from '../../apps/collector/src/exec/educacao-infra.ts';
import { loadIndContext, publishIndSlice } from '../../apps/collector/src/exec/educacao-ind.ts';
import { loadDocEntities, publishDocSlice } from '../../apps/collector/src/exec/educacao-doc.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); });
test.after(async () => { if (!skip) await ctx.drop(); });

const VIT = '3205309', VV = '3205200', SP = '3550308';
const cad = (inep: number, o: Partial<CensoRow> = {}): CensoRow => ({ row: inep, inep: String(inep), ibge7: VIT, uf: '32', name: `ESCOLA ${inep}`, dep: '3', loc: '1', sit: '1', mat: '100', ...o });
const efiles = (year: number): EduFiles => ({ year, relPaths: [`inep/censo_escolar/${year}/x.zip`], sha256: [`c${year}`.padEnd(64, '0')], bytes: 1 });
const ifiles = (year: number, tag = 'i'): InfraFiles => ({ year, relPaths: [`inep/censo_escolar/${year}/x.zip`], sha256: [`${tag}${year}`.padEnd(64, '0')], bytes: 1 });
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const state = async () => [await hash('SELECT * FROM civica_exec.exec_edu_infra_year'), await hash('SELECT * FROM civica_exec.exec_edu_infra_agg'), await hash('SELECT * FROM civica_exec.exec_edu_infra_cov')].join('|');
const logCount = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
const firstOf = async (ds: number, uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [ds, uf, comp])).rowCount === 0;
async function publishCadastro(year: number, rows: CensoRow[]) {
  const built = buildEduYear(year, rows, await loadMunicipalities(pool));
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) await publishEduSlice(pool, { year, slice, files: efiles(year), first: await firstOf(DATASET.edu_censo, uf, eduCompetence(year)), built });
}
const raw = (inep: number, v: Record<string, string> = {}, sit = '1'): InfraRaw => ({ row: inep, inep: String(inep), sit, v: Object.fromEntries(INFRA_VARS.map(x => [x.code, x.kind === 'flag' ? '1' : '3']).map(([k, d]) => [k, v[k!] ?? d])) });
async function publishInfra(year: number, rows: InfraRaw[], tag = 'i', failAfterApply = false) {
  const built = buildInfraYear(year, rows, await loadInfraCadastro(pool, year)); const out = [];
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) out.push({ uf, res: await publishInfraSlice(pool, { year, slice, files: ifiles(year, tag), first: await firstOf(DATASET.edu_infra, uf, year * 100 + 5), failAfterApply }) });
  return { built, out };
}

test('migrações v11 e v12: tabelas aditivas, FK composta para o cadastro, sem coluna pessoal, idempotente', async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  const versions = (await pool.query(`SELECT version FROM civica_exec.schema_migrations`)).rows.map(x => x.version);
  assert.ok(versions.includes(11) && versions.includes(12));
  const tabs = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'civica_exec' AND (table_name LIKE 'exec_edu_infra%' OR table_name LIKE 'exec_edu_ind%' OR table_name LIKE 'exec_edu_doc%') ORDER BY 1`)).rows.map(x => x.table_name);
  assert.deepEqual(tabs, ['exec_edu_doc_terr', 'exec_edu_ind_cov', 'exec_edu_ind_school', 'exec_edu_ind_terr', 'exec_edu_infra_agg', 'exec_edu_infra_cov', 'exec_edu_infra_year']);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND (table_name LIKE 'exec_edu_infra%' OR table_name LIKE 'exec_edu_ind%' OR table_name LIKE 'exec_edu_doc%')`)).rows.map(x => x.column_name);
  for (const bad of ['nome', 'name', 'cpf', 'cns', 'professor', 'docente_id', 'registro', 'email', 'telefone', 'endereco', 'raca', 'sexo', 'nascimento', 'gestor']) assert.ok(!cols.includes(bad), bad);
  for (const c of INFRA_COLS) assert.ok(cols.includes(c), c);
  const fk = (await pool.query(`SELECT conrelid::regclass::text t, pg_get_constraintdef(oid) d FROM pg_constraint WHERE contype = 'f' AND conrelid IN ('civica_exec.exec_edu_infra_year'::regclass, 'civica_exec.exec_edu_ind_school'::regclass)`)).rows;
  assert.equal(fk.length, 2); for (const f of fk) assert.match(String(f.d), /\(inep, year\) REFERENCES civica_exec\.exec_edu_school_year\(inep, year\)/);
});

test('infraestrutura: publicação por UF × edição, NO_CHANGE sem log, NULL ≠ "não", FK e CHECK do banco', async () => {
  await publishCadastro(2024, [cad(32000001), cad(32000002, { dep: '2', loc: '2' }), cad(32000003, { dep: '4', sit: '2', mat: '' }), cad(32000004, { ibge7: VV }), cad(35000001, { ibge7: SP, uf: '35' })]);
  const rows = [raw(32000001), raw(32000002, { internet: '0', biblioteca_ou_leitura: '0', salas_utilizadas: '10' }), raw(32000003, {}, '2'), raw(32000004, { internet: '', salas_utilizadas: '' }), raw(35000001, { internet_comp_aluno: '9', qt_tv: '88888' })];
  const a = await publishInfra(2024, rows); assert.deepEqual(a.out.map(x => [x.uf, x.res.status]), [[32, 'PUBLISHED'], [35, 'PUBLISHED']]);
  const n = async (sql: string) => Number((await pool.query(sql)).rows[0].n);
  assert.equal(await n(`SELECT count(*)::int n FROM civica_exec.exec_edu_infra_year`), 4, 'a escola paralisada não gera linha'); assert.equal(await n(`SELECT count(*)::int n FROM civica_exec.exec_change_log`), 0, 'carga inicial sem change log');
  const cov = (await pool.query(`SELECT uf, rows_in, active, valid, rejected, answered, unanswered, with_mat, extreme, coded_unknown FROM civica_exec.exec_edu_infra_cov ORDER BY uf`)).rows;
  assert.deepEqual(cov[0], { uf: 32, rows_in: 4, active: 3, valid: 3, rejected: 0, answered: 3, unanswered: 0, with_mat: 3, extreme: 0, coded_unknown: 0 }); assert.equal(cov[1]!.extreme, 1); assert.equal(cov[1]!.coded_unknown, 1);
  const r4 = (await pool.query(`SELECT internet, salas_utilizadas FROM civica_exec.exec_edu_infra_year WHERE inep = 32000004`)).rows[0]; assert.deepEqual(r4, { internet: null, salas_utilizadas: null });   // em branco = não informado, não "não"
  assert.equal((await pool.query(`SELECT internet FROM civica_exec.exec_edu_infra_year WHERE inep = 32000002`)).rows[0].internet, false);
  const before = await state(); const logs = await logCount(); const again = await publishInfra(2024, rows); assert.deepEqual(again.out.map(x => x.res.status), ['NO_CHANGE', 'NO_CHANGE']); assert.equal(await state(), before); assert.equal(await logCount(), logs);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_edu_infra_year (inep, year, internet) VALUES (32000099, 2024, true)`), /foreign key|violates/i);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_edu_infra_year (inep, year, salas_utilizadas) VALUES (32000003, 2024, -1)`), /check|violates/i);
});

test('infraestrutura: retificação só registra o diferente; rollback exato; falha injetada sem rastro', async () => {
  const rows = [raw(32000001), raw(32000002, { internet: '0', biblioteca_ou_leitura: '0', salas_utilizadas: '10' }), raw(32000003, {}, '2'), raw(32000004, { internet: '', salas_utilizadas: '' }), raw(35000001, { internet_comp_aluno: '9', qt_tv: '88888' })];
  const ref = await state(); const logs = await logCount();
  const v2 = rows.map(r => r.inep === '32000001' ? raw(32000001, { internet: '0', salas_utilizadas: '12' }) : r);
  const x = await publishInfra(2024, v2, 'r2'); const run = x.out.find(o => o.uf === 32)!.res as { status: string; runId: number }; assert.equal(run.status, 'PUBLISHED');
  const ops = (await pool.query(`SELECT table_id, op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [run.runId])).rows.map(o => `t${o.table_id}${o.op}${o.n}`);
  assert.deepEqual(ops, ['t86U1', 't87U1'], 'uma escola e uma linha agregada mudaram; cobertura igual');
  assert.equal((await logCount()) - logs, 2);
  assert.equal((await rollbackRun(pool, run.runId)).status, 'ROLLED_BACK'); assert.equal(await state(), ref);
  const st = await state(); await assert.rejects(publishInfra(2024, v2, 'r3', true)); assert.equal(await state(), st);
});

test('read models de infraestrutura: percentual = sim ÷ (sim + não); sem resposta à parte; vigência; escola', async () => {
  await publishCadastro(2025, [cad(32000001), cad(32000002, { dep: '2', loc: '2' }), cad(32000004, { ibge7: VV }), cad(35000001, { ibge7: SP, uf: '35' })]);
  await publishInfra(2025, [raw(32000001), raw(32000002, { internet: '0' }), raw(32000004, { internet: '' }), raw(35000001)]);
  const m = (await getEducationMunicipalityInfra(pool, VIT, { year: 2024 }))!;
  const net = m.itens.find(i => i.code === 'internet')!; assert.deepEqual([net.sim, net.nao, net.semResposta, net.pct], [1, 1, 0, 50]);
  assert.equal(m.universe.escolas, 2); assert.equal(m.series.length, 2);
  const vv = (await getEducationMunicipalityInfra(pool, VV, { year: 2025 }))!; const nv = vv.itens.find(i => i.code === 'internet')!; assert.deepEqual([nv.sim, nv.nao, nv.semResposta, nv.pct], [0, 0, 1, null]);   // sem resposta não vira "não"
  assert.equal(m.itens.find(i => i.code === 'agua_filtrada')!.available, false);   // pergunta até 2018, substituída em 2019: nunca fundidas
  assert.equal(m.itens.find(i => i.code === 'agua_potavel')!.available, true);
  const br = (await getEducationNationalInfra(pool, { year: 2025 }))!; assert.equal(br.scope.kind, 'brasil'); assert.equal(br.universe.escolas, 4); assert.ok(br.restrictions.some(t => /autodeclarad/i.test(t)));
  const uf = (await getEducationNationalInfra(pool, { year: 2025, ufCode: 32 }))!; assert.equal(uf.universe.escolas, 3); assert.equal(uf.scope.name, 'Espírito Santo');
  const sc = (await getEducationSchoolInfra(pool, 32000002))!; assert.deepEqual(sc.years.map(y => y.year), [2025, 2024]);
  const it = sc.years[0]!.itens.find(i => i.code === 'internet')!; assert.equal(it.state, 'NAO'); assert.equal(sc.years[0]!.itens.find(i => i.code === 'acess_rampa')!.state, 'SIM');
  assert.equal(sc.years[1]!.itens.find(i => i.code === 'agua_filtrada')!.state, 'FORA_DA_EDICAO');   // pergunta encerrada em 2018
  assert.equal(await getEducationSchoolInfra(pool, 11111111), null); assert.equal(await getEducationMunicipalityInfra(pool, 'abc'), null); assert.equal(await getEducationMunicipalityInfra(pool, VIT, { year: 1999 }), null); assert.equal(await getEducationNationalInfra(pool, { ufCode: 99 }), null);
});

test('indicadores oficiais do INEP: escola e território publicados como vieram; "--" = NULL; leitura em escala real; rollback', async () => {
  const school = (inep: string, v: Record<string, string>) => ({ row: Number(inep), inep, v });
  const files: IndFileRows[] = [
    { family: 'ATU', level: 'escolas', sha256: ['a'.padEnd(64, '0')], rows: [school('32000001', { atu_inf: '--', atu_cre: '--', atu_pre: '--', atu_fun: '22.5', atu_ai: '21', atu_af: '24', atu_med: '--' }), school('32000002', { atu_inf: '--', atu_cre: '--', atu_pre: '--', atu_fun: '--', atu_ai: '--', atu_af: '--', atu_med: '--' })] },
    { family: 'ICG', level: 'escolas', sha256: ['b'.padEnd(64, '0')], rows: [school('32000001', { icg_nivel: 'Nível 3' })] },
    { family: 'IRD', level: 'escolas', sha256: ['c'.padEnd(64, '0')], rows: [school('32000001', { ird_media: '3.456789' })] },
    { family: 'ATU', level: 'municipios', sha256: ['d'.padEnd(64, '0')], rows: [{ row: 1, ibge7: VIT, loc: 'Total', dep: 'Total', v: { atu_inf: '15.1', atu_cre: '--', atu_pre: '16', atu_fun: '22.2', atu_ai: '21', atu_af: '23', atu_med: '28.4' } }, { row: 2, ibge7: VIT, loc: 'Total', dep: 'Pública', v: { atu_inf: '16', atu_cre: '--', atu_pre: '--', atu_fun: '22', atu_ai: '--', atu_af: '--', atu_med: '--' } }] },
    { family: 'ATU', level: 'uf', sha256: ['e'.padEnd(64, '0')], rows: [{ row: 1, geo: 'Brasil', loc: 'Total', dep: 'Total', v: { atu_inf: '15.1', atu_cre: '12', atu_pre: '16', atu_fun: '22.2', atu_ai: '21', atu_af: '23', atu_med: '28.4' } }, { row: 2, geo: 'Espírito Santo', loc: 'Total', dep: 'Total', v: { atu_inf: '14', atu_cre: '--', atu_pre: '--', atu_fun: '21', atu_ai: '--', atu_af: '--', atu_med: '--' } }, { row: 3, geo: 'Centro-Oeste', loc: 'Total', dep: 'Total', v: { atu_inf: '1', atu_cre: '--', atu_pre: '--', atu_fun: '--', atu_ai: '--', atu_af: '--', atu_med: '--' } }] },
    { family: 'IRD', level: 'uf', sha256: ['f'.padEnd(64, '0')], rows: [{ row: 1, geo: 'Brasil', loc: 'Total', dep: 'Total', v: { ird_b1: '13.7', ird_b2: '37.6', ird_b3: '39.1', ird_b4: '9.6' } }] },
  ];
  const ctxI = await loadIndContext(pool, 2025); const built = buildIndYear(2025, files, ctxI.cadastro, ctxI.ent);
  assert.equal(built.rejects.length, 0); assert.deepEqual([...built.slices.keys()].sort((a, b) => a - b), [0, 32]);
  const shas = files.flatMap(f => f.sha256).sort();
  const pub = async (b: typeof built) => { const out = []; for (const [uf, slice] of [...b.slices.entries()].sort((a, c) => a[0] - c[0])) out.push((await publishIndSlice(pool, { year: 2025, slice, fileShas: shas, relPaths: ['x'], first: await firstOf(DATASET.edu_ind, uf, 202505) })).status); return out; };
  assert.deepEqual(await pub(built), ['PUBLISHED', 'PUBLISHED']); assert.deepEqual(await pub(built), ['NO_CHANGE', 'NO_CHANGE']);
  const sc = (await getEducationSchoolIndicators(pool, 32000001))!; const get = (c: string) => sc.recortes[0]!.medidas.find(x => x.code === c)?.value;
  assert.equal(get('atu_fun'), 22.5); assert.equal(get('atu_inf'), undefined); assert.equal(get('icg_nivel'), 3); assert.equal(get('ird_media'), 3.457);
  assert.equal((await getEducationSchoolIndicators(pool, 32000002))!.recortes.length, 0, 'escola só com "--" não tem linha publicada');
  const muni = (await getEducationTerritoryIndicators(pool, { ibge7: VIT }))!; assert.deepEqual(muni.recortes.map(r => [r.depLabel, r.locLabel]), [['Total', 'Total'], ['Pública (federal, estadual e municipal)', 'Total']]);
  assert.equal(muni.recortes[0]!.medidas.find(x => x.code === 'atu_fun')!.value, 22.2); assert.ok(muni.restrictions.some(t => /não os recalcula/i.test(t)));
  const br = (await getEducationTerritoryIndicators(pool, {}))!; assert.equal(br.scope.kind, 'brasil'); assert.equal(br.recortes[0]!.medidas.find(x => x.code === 'ird_b4')!.value, 9.6);
  const uf = (await getEducationTerritoryIndicators(pool, { ufCode: 32 }))!; assert.equal(uf.recortes[0]!.medidas.find(x => x.code === 'atu_fun')!.value, 21);
  assert.equal(await getEducationTerritoryIndicators(pool, { ibge7: 'x' }), null); assert.equal(await getEducationTerritoryIndicators(pool, { ufCode: 99 }), null);
  // valor fora da faixa e chave repetida são rejeitados, nunca corrigidos
  const bad = buildIndYear(2025, [{ family: 'IRD', level: 'uf', sha256: ['g'.padEnd(64, '0')], rows: [{ row: 1, geo: 'Brasil', loc: 'Total', dep: 'Total', v: { ird_b1: '130', ird_b2: '1', ird_b3: '1', ird_b4: '1' } }, { row: 2, geo: 'Brasil', loc: 'Total', dep: 'Total', v: { ird_b1: '1', ird_b2: '1', ird_b3: '1', ird_b4: '1' } }, { row: 3, geo: 'Marte', loc: 'Total', dep: 'Total', v: { ird_b1: '1' } }] }], ctxI.cadastro, ctxI.ent);
  assert.deepEqual(bad.rejects.map(r => r.reason), ['VALOR_FORA_DE_FAIXA', 'CHAVE_DUPLICADA', 'TERRITORIO_INEXISTENTE']);
});

test('docentes oficiais: total distinto não é a soma das redes; Brasil na fatia 0; leitura com notas', async () => {
  const ent = await loadDocEntities(pool);
  const rows: DocRaw[] = [
    { row: 1, key: 'Brasil', kind: 'brasil', v: { doc_total: '2407049', doc_pub: '1908735', doc_priv: '573953', doc_inf: '697086' } },
    { row: 2, key: 'Espírito Santo', kind: 'uf', v: { doc_total: '60000', doc_pub: '50000', doc_priv: '12000' } },
    { row: 3, key: VIT, kind: 'mun', v: { doc_total: '9000', doc_pub: '6000', doc_priv: '3500', doc_urb: '9000', doc_rur: '' } },
    { row: 4, key: '9999999', kind: 'mun', v: { doc_total: '1' } },
  ];
  const b = buildDocYear(2025, rows, ent); assert.deepEqual(b.rejects.map(r => r.reason), ['TERRITORIO_INEXISTENTE']); assert.deepEqual([...b.slices.keys()].sort((a, c) => a - c), [0, 32]);
  for (const [uf, slice] of b.slices) assert.equal((await publishDocSlice(pool, { year: 2025, slice, fileSha: 'd'.padEnd(64, '0'), relPath: 'inep/sinopse_docentes/docentes_2025.tsv', first: await firstOf(DATASET.edu_doc, uf, 202505) })).status, 'PUBLISHED');
  const br = (await getEducationTeachers(pool, {}))!; const v = (c: string) => br.docentes.find(d => d.code === c)!.value!;
  assert.equal(v('doc_total'), 2407049); assert.ok(v('doc_pub') + v('doc_priv') > v('doc_total'), 'docente que atua nas duas redes conta nas duas: o total não é a soma');
  assert.ok(br.nota.some(t => /não é a soma/i.test(t))); assert.equal(br.series.length, 1);
  const m = (await getEducationTeachers(pool, { ibge7: VIT }))!; assert.equal(m.docentes.find(d => d.code === 'doc_rur')!.value, null); assert.equal(m.scope.kind, 'municipio');
  assert.equal((await getEducationTeachers(pool, { ufCode: 32 }))!.docentes[0]!.value, 60000); assert.equal(await getEducationTeachers(pool, { ufCode: 99 }), null); assert.equal(await getEducationTeachers(pool, { ibge7: 'x' }), null);
  assert.equal(Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_doc_terr`)).rows[0].n), 3);
});
