import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import {
  FROTA_COLUMNS, applyExecMigrations, buildFrotaSlice, buildInfrSlice, buildPrfSlice, buildRenaestSlice, buildSimTraResidence, compactKey, getTrafficMunicipality, getTrafficState, rollbackRun, seedTransitoDefs, TRA_DEFS,
  type FrotaJson, type PrfJson, type RenaestJson, type TraXw,
} from '../../packages/db/src/exec/index.ts';
import { loadEntityDir } from '../../apps/collector/src/exec/seguranca.ts';
import { publishFrotaSlice, publishInfrSlice, publishPrfSlice, publishRenaestSlice, publishSimTraResidenceSlice } from '../../apps/collector/src/exec/transito.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

// Exigem PostgreSQL DESCARTÁVEL (EXEC_TEST_ADMIN_URL); sem ele são pulados — nunca rodam contra o banco do Cívica.
const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
const ES = 32, VIT = 3205309, VV = 3205200, ARN = 3200359, ES_IGN = 3200000;
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => {
  if (skip) return;
  ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED');
  await seedTransitoDefs(pool);
  await pool.query(`INSERT INTO civica_exec.exec_territory_population (entity_id, year, source, value) VALUES (${VIT}, 2024, 1, 360000), (${VV}, 2024, 1, 500000), (${ARN}, 2024, 1, 7000), (${ES}, 2024, 1, 4000000)`);
});
test.after(async () => { if (!skip) await ctx.drop(); });

const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const indState = (lo: number, hi: number) => hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN ${lo} AND ${hi}`);
const firstOf = async (ds: number, uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [ds, uf, comp])).rowCount === 0;
const mkXw = async (): Promise<TraXw> => { const { dir } = await loadEntityDir(pool); return { byUfKey: new Map(dir.municipalities.map(m => [`${m.ufCode}|${compactKey(m.name)}`, m.entityId])), aliasUsed: new Map() }; };
const id = (r: { status: string; runId?: number }) => r.status === 'PUBLISHED' ? r.runId! : 0;

test('migração v3: três tabelas tipadas sem dado pessoal; idempotente; 122 definições de trânsito', { skip }, async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  const cols = async (t: string) => (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name = $1 ORDER BY ordinal_position`, [t])).rows.map(r => r.column_name);
  assert.deepEqual(await cols('exec_tra_cov'), ['source', 'uf', 'competence', 'records', 'fatal_records', 'municipalities', 'universe', 'scope']);
  assert.deepEqual(await cols('exec_tra_infr_uf_mes'), ['uf', 'competence', 'cod_infracao', 'qtde']);
  assert.equal((await cols('exec_tra_frota_mun_mes')).length, 24); assert.equal(TRA_DEFS.length, 122);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_def WHERE indicator_id BETWEEN 4000 AND 4999`)).rows[0].n, TRA_DEFS.length);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_tra_cov VALUES (3, 32, 202401, 1, 0, 1, 0, 1)`), /check|violates/i);
});

test('SIM trânsito: bootstrap, NO_CHANGE, republicação com log, rollback exato, falha injetada e reconciliação que barra', { skip }, async () => {
  const { dir } = await loadEntityDir(pool); const pop = new Map<number, number>([[VIT, 360000], [ES, 4000000]]);
  const mk = (res: Record<string, Record<string, number>>) => buildSimTraResidence({ stats: { rows_read: 9, nonfetal: 9 }, res, occ: {} }, ES, { year: 2024, prelim: false, dir, pop });
  const pub = async (b: ReturnType<typeof mk>, sha: string, o: { fail?: boolean } = {}) => publishSimTraResidenceSlice(pool, { ufCode: ES, year: 2024, prelim: false, fileSha: sha, relPath: 'datasus/sim/definitivo/DOES2024.dbc', built: b, first: await firstOf(18, ES, 202401), ...(o.fail ? { failAfterApply: true } : {}) });
  const v1 = mk({ '320530': { V03: 4, V23: 6, V95: 1, Y850: 2 }, '320520': { V28: 2 }, '': { V09: 1 } });
  assert.equal((await pub(v1, 'a'.repeat(64))).status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 4001 AND entity_id = ${VIT}`)).rows[0].value, 10);
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 4001 AND entity_id = ${ARN}`)).rows[0].value, 0, 'zero explícito nos totais');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 4013 AND entity_id = ${ARN}`)).rows[0].n, 0, 'categoria sem óbito: sem linha');
  assert.equal((await pub(v1, 'a'.repeat(64))).status, 'NO_CHANGE');
  const before = await indState(4001, 4122);
  const b = await pub(mk({ '320530': { V03: 4, V23: 9, V95: 1, Y850: 2 }, '320520': { V28: 2 } }), 'b'.repeat(64)); assert.equal(b.status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 4001 AND entity_id = ${ES}`)).rows[0].value, 15);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 4001 AND entity_id = ${ES_IGN}`)).rows[0].n, 0, 'linha que sumiu do arquivo some da fatia');
  assert.equal((await rollbackRun(pool, id(b))).status, 'ROLLED_BACK'); assert.equal(await indState(4001, 4122), before);
  await assert.rejects(pub(mk({ '320530': { V03: 99 } }), 'c'.repeat(64), { fail: true }), /falha injetada/); assert.equal(await indState(4001, 4122), before);
  const g = mk({ '320530': { V03: 5 } }); const bad = { ...g, rows: g.rows.map(r => r.indicator_id === 4001 && r.entity_id === ES ? { ...r, value: 9, numerator: 9 } : r) };
  await assert.rejects(pub(bad, 'd'.repeat(64)), /reconciliação SIM trânsito/); assert.equal(await indState(4001, 4122), before);
});

const hdr = ['TOTAL', ...FROTA_COLUMNS.map(c => c[0])];
const frJson = (a: number, b: number): FrotaJson => { const mk = (t: number): Array<number | null> => [t, Math.floor(t * 0.6), ...new Array(8).fill(0), Math.floor(t * 0.1), ...new Array(11).fill(0)]; return { title: 't', sheet: 's', header: hdr, formula_total: null, skipped: 0, source: 'x', rows: [['ES', 'VITORIA', ...mk(a)], ['ES', 'VILA VELHA', ...mk(b)], ['ES', 'MUNICIPIO NAO INFORMADO', ...mk(3)]] as FrotaJson['rows'] }; };
test('frota: tabela larga por município × mês publicada como instantâneo; troca de arquivo substitui; rollback exato; total divergente barra', { skip }, async () => {
  const { dir } = await loadEntityDir(pool); const xw = await mkXw(); const pop = new Map<number, number>([[VIT, 360000], [ES, 4000000]]);
  const pub = async (j: FrotaJson, sha: string, comp = 202412, emit = true, o: { fail?: boolean } = {}) => { const built = buildFrotaSlice(j, ES, 'ES', comp, { dir, xw, pop, emitIndicators: emit }); return { built, r: await publishFrotaSlice(pool, { ufCode: ES, competence: comp, fileSha: sha, relPath: 'transito/senatran-frota/x.xlsx', built, first: await firstOf(20, ES, comp), ...(o.fail ? { failAfterApply: true } : {}) }) }; };
  const state = () => hash(`SELECT * FROM civica_exec.exec_tra_frota_mun_mes`) .then(async h => h + ':' + await indState(4201, 4203));
  const a = await pub(frJson(1000, 2000), '1'.repeat(64)); assert.equal(a.r.status, 'PUBLISHED');
  const row = (await pool.query(`SELECT total, automovel, motocicleta FROM civica_exec.exec_tra_frota_mun_mes WHERE entity_id = ${VIT} AND competence = 202412`)).rows[0]; assert.deepEqual([row.total, row.automovel, row.motocicleta], [1000, 600, 100]);
  assert.equal((await pool.query(`SELECT total FROM civica_exec.exec_tra_frota_mun_mes WHERE entity_id = ${ES_IGN} AND competence = 202412`)).rows[0].total, 3);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_tra_frota_mun_mes WHERE entity_id = ${ARN}`)).rows[0].n, 0, 'município ausente do arquivo: sem linha (e nunca zero)');
  assert.ok(Math.abs((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 4201 AND entity_id = ${VIT}`)).rows[0].value - 1000 / 360000 * 1000) < 1e-9);
  assert.equal((await pub(frJson(1000, 2000), '1'.repeat(64))).r.status, 'NO_CHANGE');
  await pub(frJson(1000, 2000), '1'.repeat(64), 202411, false);     // mês sem indicadores
  const before = await state();
  const b = await pub(frJson(1100, 1900), '2'.repeat(64)); assert.equal(b.r.status, 'PUBLISHED'); assert.equal((await pool.query(`SELECT total FROM civica_exec.exec_tra_frota_mun_mes WHERE entity_id = ${VIT} AND competence = 202412`)).rows[0].total, 1100);
  assert.equal((await rollbackRun(pool, id(b.r))).status, 'ROLLED_BACK'); assert.equal(await state(), before);
  await assert.rejects(pub(frJson(7777, 1), '3'.repeat(64), 202412, true, { fail: true }), /falha injetada/); assert.equal(await state(), before);
  const g = buildFrotaSlice(frJson(5, 5), ES, 'ES', 202412, { dir, xw, pop, emitIndicators: false });
  await assert.rejects(publishFrotaSlice(pool, { ufCode: ES, competence: 202412, fileSha: '4'.repeat(64), relPath: 'x', built: { ...g, totals: { ...g.totals, total: g.totals.total! + 1 } }, first: false }), /reconciliação frota/); assert.equal(await state(), before);
});

const renJson = (n: number): RenaestJson => ({ bad: {}, acidentes: 0, vitimas_linhas: 0, veiculos_total: 0, veiculos_orfaos: 0,
  muni: [['ES', '3205309', 202401, n, 1, 2, 5, 4], ['ES', '3205200', 202401, 3, 0, 0, 6, 6], ['ES', '0000000', 202401, 1, 0, 0, 1, 1], ['ES', '3205309', 202402, 40, 40, 44, 80, 36]],
  tp_acidente: [['ES', 202401, 'COLISAO', n + 4], ['ES', 202402, 'CHOQUE', 40]], gravidade: [['ES', 202401, 'LEVE', 9]], envolvido: [['ES', 202401, 'MOTORISTA', 9]], veiculo: [['ES', 202401, 'AUTOMOVEL', 12]], vitima_obitos: [],
  cov: [['ES', 202401, n + 4, 1, 3], ['ES', 202402, 40, 40, 1]], localidade: [['ES', 202401, 79], ['ES', 202402, 79], ['ES', 202403, 79]] });
test('RENAEST: fatia UF × ano; conteúdo igual com arquivo novo = NO_CHANGE; revisão de mês antigo troca só aquela fatia; cobertura persistida; rollback exato', { skip }, async () => {
  const { dir } = await loadEntityDir(pool);
  const pub = async (j: RenaestJson, ver: string, o: { fail?: boolean } = {}) => { const built = buildRenaestSlice(j, 'ES', ES, 2024, { dir, lastMonth: 202403, sourceSha: ver }); return { built, r: await publishRenaestSlice(pool, { ufCode: ES, year: 2024, versionSha: ver, built, first: await firstOf(21, ES, 202401), ...(o.fail ? { failAfterApply: true } : {}) }) }; };
  const state = () => indState(4301, 4399).then(async h => h + ':' + await hash(`SELECT * FROM civica_exec.exec_tra_cov WHERE source = 1`));
  const a = await pub(renJson(10), '1'.repeat(64)); assert.equal(a.r.status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 4301 AND entity_id = ${ES} AND period_start = '2024-01-01'`)).rows[0].value, 14);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 4301 AND entity_id = ${ARN}`)).rows[0].n, 0, 'município sem sinistro reportado: sem linha, nunca zero');
  const cov = (await pool.query(`SELECT competence, records, scope, universe FROM civica_exec.exec_tra_cov WHERE source = 1 AND uf = ${ES} ORDER BY competence`)).rows;
  assert.deepEqual(cov.map(c => [c.competence, c.records, c.scope, c.universe]), [[202401, 14, 1, 79], [202402, 40, 2, 79], [202403, 0, 3, 79]], 'fev: 100 % com óbito → restrito a fatais (inferido); mar: sem registros');
  assert.equal((await pub(renJson(10), '9'.repeat(64))).r.status, 'NO_CHANGE', 'novo pacote com o mesmo conteúdo da fatia não republica');
  const before = await state();
  const b = await pub(renJson(25), '2'.repeat(64)); assert.equal(b.r.status, 'PUBLISHED'); assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 4301 AND entity_id = ${ES} AND period_start = '2024-01-01'`)).rows[0].value, 29);
  assert.equal((await rollbackRun(pool, id(b.r))).status, 'ROLLED_BACK'); assert.equal(await state(), before);
  await assert.rejects(pub(renJson(99), '3'.repeat(64), { fail: true }), /falha injetada/); assert.equal(await state(), before);
});

const prJson = (v: number): PrfJson => ({ year: 2024, rows_read: 10, sinistros: v + 3, dup_ids: 0, bad_date: 0, other_year: 0, classes: {}, rows: [['ES', 'VITORIA', 202401, v, 1, v - 1, 0, 0, 2, 3, 1, 9, 4], ['ES', 'VILA VELHA', 202402, 3, 0, 3, 0, 0, 0, 1, 0, 5, 3]] });
test('PRF: mensal (UF) e anual (município) coerentes; reconciliação mensal × anual; republicação e rollback exatos', { skip }, async () => {
  const { dir } = await loadEntityDir(pool); const xw = await mkXw();
  const pub = async (j: PrfJson, sha: string, o: { fail?: boolean } = {}) => { const built = buildPrfSlice(j, 'ES', ES, 2024, { dir, xw, lastMonth: 202403, sourceSha: sha }); return { built, r: await publishPrfSlice(pool, { ufCode: ES, year: 2024, fileSha: sha, relPath: 'transito/prf/datatran2024.zip', built, first: await firstOf(22, ES, 202401), ...(o.fail ? { failAfterApply: true } : {}) }) }; };
  const state = () => indState(4601, 4631).then(async h => h + ':' + await hash(`SELECT * FROM civica_exec.exec_tra_cov WHERE source = 2`));
  const a = await pub(prJson(5), '1'.repeat(64)); assert.equal(a.r.status, 'PUBLISHED');
  const q = async (ind: number, e: number, ps: string) => Number((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = $1 AND entity_id = $2 AND period_start = $3`, [ind, e, ps])).rows[0]?.value ?? NaN);
  assert.equal(await q(4601, ES, '2024-01-01'), 5); assert.equal(await q(4601, ES, '2024-03-01'), 0, 'mês dentro do período do arquivo sem sinistro: zero explícito'); assert.equal(await q(4621, ES, '2024-01-01'), 8); assert.equal(await q(4621, VIT, '2024-01-01'), 5); assert.equal(await q(4621, VV, '2024-01-01'), 3);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 4601 AND period_start = '2024-04-01'`)).rows[0].n, 0, 'depois do último mês do arquivo: sem linha');
  const before = await state(); const b = await pub(prJson(9), '2'.repeat(64)); assert.equal(b.r.status, 'PUBLISHED'); assert.equal(await q(4621, ES, '2024-01-01'), 12);
  assert.equal((await rollbackRun(pool, id(b.r))).status, 'ROLLED_BACK'); assert.equal(await state(), before);
  await assert.rejects(pub(prJson(77), '3'.repeat(64), { fail: true }), /falha injetada/); assert.equal(await state(), before);
  const g = buildPrfSlice(prJson(4), 'ES', ES, 2024, { dir, xw, lastMonth: 202403, sourceSha: 'x' }); const bad = { ...g, rows: g.rows.map(r => r.indicator_id === 4621 && r.entity_id === ES ? { ...r, value: 1, numerator: 1 } : r) };
  await assert.rejects(publishPrfSlice(pool, { ufCode: ES, year: 2024, fileSha: '4'.repeat(64), relPath: 'x', built: bad, first: false }), /reconciliação PRF/); assert.equal(await state(), before);
});

test('infrações: tabela por UF de jurisdição × mês × código; soma confere com o indicador; republicação substitui a fatia', { skip }, async () => {
  const ufKey = new Map<string, number>([[compactKey('Espírito Santo'), ES]]);
  const pub = async (rows: Array<[string, number, number]>, sha: string) => { const b = buildInfrSlice({ layout: 'long', blanks: 0, rows }, ES, ufKey, 202401); return publishInfrSlice(pool, { ufCode: ES, competence: 202401, fileSha: sha, relPath: 'x.csv', rows: b.rows, indicators: b.indicators, quality: b.quality, first: await firstOf(23, ES, 202401) }); };
  assert.equal((await pub([['ESPIRITO SANTO', 5002, 100], ['ESPIRITO SANTO', 5010, 20]], '1'.repeat(64))).status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 4701 AND entity_id = ${ES}`)).rows[0].value, 120);
  const b = await pub([['ESPIRITO SANTO', 5002, 90]], '2'.repeat(64)); assert.equal(b.status, 'PUBLISHED');
  assert.deepEqual((await pool.query(`SELECT cod_infracao, qtde FROM civica_exec.exec_tra_infr_uf_mes WHERE uf = ${ES}`)).rows.map(r => [r.cod_infracao, r.qtde]), [[5002, 90]]);
  assert.equal((await rollbackRun(pool, id(b))).status, 'ROLLED_BACK'); assert.equal((await pool.query(`SELECT sum(qtde)::int s FROM civica_exec.exec_tra_infr_uf_mes WHERE uf = ${ES}`)).rows[0].s, 120);
});

test('contratos de leitura: seções separadas por fonte, poucas consultas, ausência explicada (RENAEST nunca vira zero; SIM/PRF só com fatia publicada)', { skip }, async () => {
  let n = 0; const counting = { query: (...a: unknown[]) => { n++; return (pool.query as (...x: unknown[]) => unknown)(...a); } } as unknown as Pool;
  const st = await getTrafficState(counting, ES); assert.ok(n <= 8, `consultas do estado: ${n}`);
  assert.ok(st.sim.some(m => m.code === 'IND-TRA-SIM-TT-RES')); assert.ok(st.prf.some(m => m.grain === 'M')); assert.ok(st.fleet && st.fleet.latest && st.fleet.series.length >= 1); assert.equal(st.fleet!.latest!.competence, 202412);
  assert.equal(st.coverage.some(c => c.source === 'renaest' && c.scope === 'sem_registros'), true); assert.equal(st.infractions!.topCodes[0]!.code, 5002);
  assert.ok(st.restrictions.length >= 6); assert.ok(st.population.missingYears.includes(2023)); assert.ok(st.sources.some(s => s.dataset === 'frota' && s.slices >= 2));
  const only = await getTrafficState(pool, ES, { sources: ['prf'], from: '2024-02-01' }); assert.deepEqual([only.sim.length, only.renaest.length, only.fleet === undefined, only.infractions === undefined], [0, 0, true, true]); assert.ok(only.prf.every(m => m.series.every(p => p.period >= '2024-02-01')));
  n = 0; const m = (await getTrafficMunicipality(counting, ARN))!; assert.ok(n <= 8, `consultas do município: ${n}`);
  const cat = m.sim.find(x => x.code === 'IND-TRA-SIM-CAT-MOT-RES')!; assert.deepEqual(cat.series.map(p => [p.period, p.value, p.kind]), [['2024-01-01', 0, 'zero_derivado']], 'categoria sem linha em fatia publicada = zero derivado');
  const prf = m.prf.find(x => x.code === 'IND-TRA-PRF-A-SINISTROS')!; assert.equal(prf.series[0]!.kind, 'zero_derivado');
  const ren = (await getTrafficMunicipality(pool, VIT))!.renaest.find(x => x.code === 'IND-TRA-REN-SIN')!; const mar = ren.series.find(p => p.period === '2024-03-01')!;
  assert.deepEqual([mar.value, mar.kind], [null, 'sem_registro']); assert.ok(ren.series.every(p => p.kind !== 'zero_derivado'));
  assert.equal((await getTrafficMunicipality(pool, VIT))!.fleet!.latest!.byType.automovel, 600);
  assert.equal(await getTrafficMunicipality(pool, 999999), null);
});
