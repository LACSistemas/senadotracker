import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, FLOW_COLS, IDEB_MEASURES, TDI_COLS, TRN_COLS, TXR_COLS, applyExecMigrations, buildEduYear, buildFlowYear, buildIdebYear, buildInseYear, buildSaebYear, eduCompetence,
  getFlowSchool, getFlowTerritory, getIdebSchool, getIdebTerritory, getInseTerritory, getLearningCoverage, getSaebTerritory, getTransitionTerritory, rollbackRun,
  type CensoRow, type FlowFile, type FlowRaw, type IdebFile, type IdebRaw, type InseFile, type SaebFile, type SaebRaw,
} from '../../packages/db/src/exec/index.ts';
import { loadMunicipalities, publishEduSlice, type EduFiles } from '../../apps/collector/src/exec/educacao.ts';
import { loadLearnContext, publishIdebSlice, publishSaebSlice } from '../../apps/collector/src/exec/educacao-learn.ts';
import { publishFlowSlice, publishInseSlice } from '../../apps/collector/src/exec/educacao-flow.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); });
test.after(async () => { if (!skip) await ctx.drop(); });

const VIT = '3205309';
const cad = (inep: number, o: Partial<CensoRow> = {}): CensoRow => ({ row: inep, inep: String(inep), ibge7: VIT, uf: '32', name: `ESCOLA ${inep}`, dep: '3', loc: '1', sit: '1', mat: '100', ...o });
const efiles = (year: number): EduFiles => ({ year, relPaths: [`inep/censo_escolar/${year}/x.zip`], sha256: [`c${year}`.padEnd(64, '0')], bytes: 1 });
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const logCount = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
const firstOf = async (ds: number, uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [ds, uf, comp])).rowCount === 0;
const P104_TABLES = ['exec_edu_ideb_school', 'exec_edu_ideb_terr', 'exec_edu_ideb_cov', 'exec_edu_saeb_terr', 'exec_edu_saeb_cov', 'exec_edu_flow_school', 'exec_edu_flow_terr', 'exec_edu_flow_cov', 'exec_edu_trn_terr', 'exec_edu_trn_cov', 'exec_edu_inse_school', 'exec_edu_inse_terr', 'exec_edu_inse_cov'];
const state = async () => (await Promise.all(P104_TABLES.map(t => hash(`SELECT * FROM civica_exec.${t}`)))).join('|');
async function cadastro(year: number, rows: CensoRow[]) {
  const built = buildEduYear(year, rows, await loadMunicipalities(pool));
  for (const [uf, slice] of [...built.slices.entries()].sort((a, b) => a[0] - b[0])) await publishEduSlice(pool, { year, slice, files: efiles(year), first: await firstOf(DATASET.edu_censo, uf, eduCompetence(year)), built });
}
const v = (o: Record<string, string>, cols: readonly string[]): Record<string, string> => Object.fromEntries(cols.map(c => [c, o[c] ?? '']));

test('migração v13: 13 tabelas aditivas, FK para o cadastro da P10.1, sem coluna pessoal, idempotente', { skip }, async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  assert.ok((await pool.query(`SELECT version FROM civica_exec.schema_migrations`)).rows.some(x => x.version === 13));
  const tabs = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'civica_exec' AND table_name ~ '^exec_edu_(ideb|saeb|flow|trn|inse)_' ORDER BY 1`)).rows.map(r => r.table_name);
  assert.deepEqual(tabs, [...P104_TABLES].sort());
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name ~ '^exec_edu_(ideb|saeb|flow|trn|inse)_'`)).rows.map(r => String(r.column_name));
  for (const bad of ['nome', 'name', 'cpf', 'cns', 'aluno_id', 'estudante', 'professor', 'gestor', 'email', 'telefone', 'endereco', 'raca', 'sexo', 'nascimento']) assert.ok(!cols.includes(bad), bad);
  const fk = (await pool.query(`SELECT conrelid::regclass::text t FROM pg_constraint WHERE contype = 'f' AND confrelid = 'civica_exec.exec_edu_school'::regclass AND conrelid::regclass::text ~ '(ideb|flow|inse)_school' ORDER BY 1`)).rows.map(r => r.t);
  assert.deepEqual(fk, ['civica_exec.exec_edu_flow_school', 'civica_exec.exec_edu_ideb_school', 'civica_exec.exec_edu_inse_school']);
  assert.ok(FLOW_COLS.length === 71 && IDEB_MEASURES.length === 12);
});

const ir = (_level: string, k1: string, k2: string, k3: string, rede: string, year: number, o: Record<string, string>, stage = 1, row = 1): IdebRaw => ({ row, k1, k2, k3, rede, stage, year, v: v(o, IDEB_MEASURES) });
test('Ideb: publica por UF × edição, NO_CHANGE sem log, retifica com log, rollback restaura, falha injetada não deixa rastro; "-" é NULL; escola sem cadastro fica de fora', { skip }, async () => {
  await cadastro(2024, [cad(32000001), cad(32000002), cad(35000001, { ibge7: '3550308', uf: '35' })]);
  const ent = await loadLearnContext(pool);
  const mk = (ideb: string): IdebFile[] => [
    { level: 'escolas', sha256: ['e'], rows: [ir('escolas', 'ES', VIT, '32000001', 'Municipal', 2023, { ap_tot: '93.1', p: '0.93', nota_media: '5.4', nota_mt: '230.5', ideb }), ir('escolas', 'ES', VIT, '32000002', 'Municipal', 2023, { ideb: '' }, 1, 2), ir('escolas', 'ES', VIT, '32999999', 'Municipal', 2023, { ideb: '4' }, 1, 3)] },
    { level: 'municipios', sha256: ['m'], rows: [ir('municipios', 'ES', VIT, 'Vitória', 'Municipal', 2023, { ideb: '5.6', ap_tot: '95' })] },
    { level: 'ufs', sha256: ['u'], rows: [ir('ufs', 'Espírito Santo', '', '', 'Total', 2023, { ideb: '5.5' })] },
    { level: 'brasil', sha256: ['b'], rows: [ir('brasil', 'Brasil', '', '', 'Total', 2023, { ideb: '5.2' })] },
  ];
  const slices = (ideb: string) => buildIdebYear(mk(ideb), ent, [2023]);
  const pub = async (ideb: string, sha: string, fail = false) => { const out = []; for (const s of [...slices(ideb).values()].sort((a, b) => a.uf - b.uf)) out.push(await publishIdebSlice(pool, { slice: s, fileShas: [sha], relPaths: ['inep/ideb/2025/x.zip'], first: await firstOf(DATASET.edu_ideb, s.uf, 202305), ...(fail ? { failAfterApply: true } : {}) })); return out; };
  assert.deepEqual((await pub('5.0', 'sha1')).map(r => r.status), ['PUBLISHED', 'PUBLISHED']);
  assert.equal(await logCount(), 0, 'carga inicial sem change log');
  const s0 = await state();
  assert.deepEqual((await pub('5.0', 'sha1')).map(r => r.status), ['NO_CHANGE', 'NO_CHANGE']); assert.equal(await logCount(), 0); assert.equal(await state(), s0);
  const rows = (await pool.query(`SELECT inep, ideb, meta, ap_1 FROM civica_exec.exec_edu_ideb_school ORDER BY inep`)).rows;
  assert.equal(rows.length, 1, 'escola só com "-" e escola sem cadastro não geram linha'); assert.deepEqual(rows[0], { inep: 32000001, ideb: 5, meta: null, ap_1: null });
  const rej = (await pool.query(`SELECT quality->'rejectReasons' r FROM civica_exec.exec_ingestion_run WHERE dataset_id = $1 AND uf = 32`, [DATASET.edu_ideb])).rows[0].r; assert.equal(rej.SEM_IDENTIDADE_ESCOLAR, 1);
  const res = await pub('5.1', 'sha2'); const es = res[1]!; assert.equal(es.status, 'PUBLISHED');   // [0] = fatia nacional (fingerprint muda com o arquivo, mas nenhuma linha muda: sem log), [1] = ES (nota da escola retificada)
  assert.ok((await logCount()) > 0); assert.notEqual(await state(), s0);
  const rb = await rollbackRun(pool, es.runId); assert.equal(rb.status, 'ROLLED_BACK', JSON.stringify(rb)); assert.equal(await state(), s0);
  const l = await logCount(); let threw = false; try { await pub('5.2', 'sha3', true); } catch { threw = true; }
  assert.ok(threw); assert.equal(await state(), s0); assert.equal(await logCount() - l, 0, 'falha injetada não deixa log');
  const g = await getIdebTerritory(pool, { ibge7: VIT }); assert.ok(g); assert.equal(g.rows[0]!.values.ideb, 5.6); assert.equal(g.rows[0]!.depLabel, 'Municipal');
  const e = await getIdebTerritory(pool, { ufCode: 32 }); assert.equal(e!.rows[0]!.values.ideb, 5.5); const b = await getIdebTerritory(pool, {}); assert.equal(b!.rows[0]!.values.ideb, 5.2);
  const sc = await getIdebSchool(pool, 32000001); assert.equal(sc!.rows[0]!.values.ideb, 5); assert.equal(sc!.rows[0]!.values.meta, null); assert.equal(await getIdebSchool(pool, 99999999), null);
  assert.ok(g.restrictions.some(r => /não é a média dos Idebs das escolas/.test(r)));
});

const sraw = (level: SaebRaw['level'], o: Partial<SaebRaw> = {}): SaebRaw => ({ row: 1, year: 2023, level, uf: '', ibge7: '', name: 'Brasil', dep: 'Total - Federal, Estadual, Municipal e Privada', loc: 'Total', cap: 'Total', grade: 5, subj: 'LP', media: '219.34', tx_alf: '', nv: ['2.5', '7.09', '10.8', '15.28', '18.49', '17.66', '13.91', '8.79', '3.95', '1.54', ''], ...o });
test('Saeb: média e níveis ×100 ida e volta sem perda, três "Total - …" distintos, leitura devolve a unidade original', { skip }, async () => {
  const ent = await loadLearnContext(pool);
  const files: SaebFile[] = [
    { level: 'brasil', sha256: ['a'], rows: [sraw('brasil'), sraw('brasil', { row: 2, dep: 'Total - Federal, Estadual e Municipal', media: '210' }), sraw('brasil', { row: 3, dep: 'Total - Estadual e Municipal', media: '205.5' })] },
    { level: 'municipios', sha256: ['c'], rows: [sraw('municipios', { uf: '32', ibge7: VIT, name: 'Vitória', media: '245.55', nv: Array(11).fill('') })] },
  ];
  const slices = buildSaebYear(files, ent);
  for (const s of [...slices.values()].sort((a, b) => a.uf - b.uf)) assert.equal((await publishSaebSlice(pool, { slice: s, fileShas: ['a', 'c'], relPaths: ['inep/saeb/x.xlsx'], first: await firstOf(DATASET.edu_saeb, s.uf, 202305) })).status, 'PUBLISHED');
  const br = await getSaebTerritory(pool, {}); assert.deepEqual(br!.rows.map(r => r.dep).sort(), [0, 5, 6]); assert.equal(br!.rows.find(r => r.dep === 0)!.media, 219.34); assert.equal(br!.rows.find(r => r.dep === 0)!.niveis[3], 15.28);
  const vit = await getSaebTerritory(pool, { ibge7: VIT, grade: 5, subj: 1 }); assert.equal(vit!.rows[0]!.media, 245.55); assert.ok(vit!.rows[0]!.niveis.every(x => x === null), 'município sem distribuição: níveis NULL, nunca 0');
});

const fr = (key: string, dep: string, loc: string, o: Record<string, string>, cols: readonly string[], uf?: string, row = 1): FlowRaw => ({ row, key, dep, loc, ...(uf ? { uf } : {}), v: v(o, cols) });
test('Fluxo: rendimento + distorção em uma linha por escola, "***" suprimido fica NULL e é contado, transição separada; leitura devolve percentuais originais', { skip }, async () => {
  const ent = await loadLearnContext(pool);
  const files: FlowFile[] = [
    { family: 'TXR', level: 'escolas', year: 2023, sha256: ['x'], rows: [fr('32000001', 'Municipal', 'Urbana', { ap_fun: '90.5', rp_fun: '8', ab_fun: '1.5', ap_ai: '***' }, TXR_COLS, 'ES')] },
    { family: 'TDI', level: 'escolas', year: 2023, sha256: ['y'], rows: [fr('32000001', 'Municipal', 'Urbana', { td_fun: '12.3' }, TDI_COLS, '')] },
    { family: 'TXR', level: 'municipios', year: 2023, sha256: ['z'], rows: [fr(VIT, 'Total', 'Total', { ap_fun: '91', rp_fun: '7', ab_fun: '2' }, TXR_COLS)] },
    { family: 'TXR', level: 'uf', year: 2023, sha256: ['w'], rows: [fr('Brasil', 'Total', 'Total', { ap_fun: '92', rp_fun: '6.5', ab_fun: '1.5' }, TXR_COLS)] },
  ];
  for (const s of [...buildFlowYear(files, ent).values()].sort((a, b) => a.uf - b.uf)) assert.equal((await publishFlowSlice(pool, { slice: s, mode: 'flow', fileShas: ['x', 'y', 'z', 'w'], relPaths: ['inep/indicadores/x.zip'], first: await firstOf(DATASET.edu_fluxo, s.uf, 202305) })).status, 'PUBLISHED');
  const school = await getFlowSchool(pool, 32000001); const c = school!.cuts[0]!; assert.equal(c.values.find(x => x.code === 'ap_fun')!.value, 90.5); assert.equal(c.values.find(x => x.code === 'td_fun')!.value, 12.3); assert.ok(!c.values.some(x => x.code === 'ap_ai'), 'suprimido não vira valor');
  const supp = (await pool.query(`SELECT sum(cells_supp)::int n FROM civica_exec.exec_edu_flow_cov`)).rows[0].n; assert.equal(supp, 1);
  const m = await getFlowTerritory(pool, { ibge7: VIT }); assert.equal(m!.series[0]!.values.ap_fun, 91); const b = await getFlowTerritory(pool, {}); assert.equal(b!.series[0]!.values.rp_fun, 6.5);
  const trn: FlowFile[] = [{ family: 'TRN', level: 'uf', year: 2022, sha256: ['t'], rows: [fr('Brasil', 'Total', 'Total', { pro_fun: '93.6', rep_fun: '3.2', eva_fun: '2.2', mej_fun: '1' }, TRN_COLS)] }];
  for (const s of buildFlowYear(trn, ent, 'trn').values()) assert.equal((await publishFlowSlice(pool, { slice: s, mode: 'trn', fileShas: ['t'], relPaths: ['inep/indicadores/t.zip'], first: await firstOf(DATASET.edu_trn, s.uf, 202205) })).status, 'PUBLISHED');
  const t = await getTransitionTerritory(pool, {}); assert.equal(t!.series[0]!.values.pro_fun, 93.6); assert.equal(t!.editions[0], 2022);
});

test('INSE: média ×10000 ida e volta, dep convertido ao esquema único, leitura e cobertura por família', { skip }, async () => {
  const ent = await loadLearnContext(pool);
  const raw = { row: 1, year: 2023, level: 'municipios' as const, uf_code: '32', uf: 'ES', ibge7: VIT, inep: '', dep: '6', loc: '0', cap: '0', qtd: '1000', media: '4.7512', cls: '', nv: ['0.5', '10', '20', '30', '20', '10', '8.5', '1'] };
  const files: InseFile[] = [{ level: 'municipios', sha256: ['i'], rows: [raw] }];
  for (const s of buildInseYear(files, ent).values()) assert.equal((await publishInseSlice(pool, { slice: s, fileShas: ['i'], relPaths: ['inep/indicadores/INSE_2023_municipios.xlsx'], first: await firstOf(DATASET.edu_inse, s.uf, 202305) })).status, 'PUBLISHED');
  const r = await getInseTerritory(pool, { ibge7: VIT }); assert.equal(r!.rows[0]!.media, 4.7512); assert.equal(r!.rows[0]!.dep, 5); assert.equal(r!.rows[0]!.niveis[1], 10);
  const cov = await getLearningCoverage(pool); assert.deepEqual([...new Set(cov.map(x => x.family))].sort(), [1, 2, 3, 4, 5, 6]);
});
