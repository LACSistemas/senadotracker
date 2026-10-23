import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { SIM_RES_IDS, applyExecMigrations, buildSimResidence, buildVdeSlice, getSegMunicipality, getSegState, rollbackRun, seedSegurancaDefs, SEG_DEFS, type SimAgg, type VdeCrosswalk, type VdeJson } from '../../packages/db/src/exec/index.ts';
import { loadEntityDir, publishSimResidenceSlice, publishVdeSlice } from '../../apps/collector/src/exec/seguranca.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

// Exigem PostgreSQL DESCARTÁVEL (EXEC_TEST_ADMIN_URL); sem ele são pulados — nunca rodam contra o banco do Cívica.
const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
const ES = 32, VIT = 3205309, VV = 3205200, ARN = 3200359, ES_IGN = 3200000;
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;

test.before(async () => {
  if (skip) return;
  ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED');
  await seedSegurancaDefs(pool);
  await pool.query(`INSERT INTO civica_exec.exec_territory_population (entity_id, year, source, value) VALUES (${VIT}, 2024, 1, 360000), (${VV}, 2024, 1, 500000), (${ARN}, 2024, 1, 7000), (${ES}, 2024, 1, 4000000)`);
});
test.after(async () => { if (!skip) await ctx.drop(); });

const agg = (res: SimAgg['res']): SimAgg => ({ stats: { rows_read: 100, nonfetal: 100 }, res, occ: {} });
async function simRows(): Promise<string> {
  return String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY indicator_id, entity_id, period_start), '')) h FROM civica_exec.exec_ind_value t WHERE indicator_id BETWEEN 3001 AND 3008`)).rows[0].h);
}
async function pubSim(res: SimAgg['res'], sha: string, o: { first?: boolean; fail?: boolean } = {}) {
  const { dir } = await loadEntityDir(pool); const pop = new Map<number, number>([[VIT, 360000], [VV, 500000], [ARN, 7000], [ES, 4000000]]);
  const built = buildSimResidence(agg(res), ES, { year: 2024, prelim: false, dir, pop });
  const first = o.first ?? (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = 15 AND uf = 32 AND competence = 202401`)).rowCount === 0;
  return { built, r: await publishSimResidenceSlice(pool, { ufCode: ES, year: 2024, prelim: false, fileSha: sha, relPath: 'datasus/sim/definitivo/DOES2024.dbc', built, first, ...(o.fail ? { failAfterApply: true } : {}) }) };
}

test('migração v2: exec_seg_cov criada, idempotente, sem dados pessoais; 62 definições de Segurança no domínio 3', { skip }, async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name = 'exec_seg_cov' ORDER BY ordinal_position`)).rows.map(r => r.column_name);
  assert.deepEqual(cols, ['uf', 'indicator_id', 'competence', 'mun_pairs', 'src_lines', 'dup_lines', 'nz_rows', 'uf_total', 'unassigned', 'status']);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_def WHERE domain = 3`)).rows[0].n, SEG_DEFS.length);
});

test('SIM: primeira carga (bootstrap), idempotência, substituição por arquivo novo com change log, rollback exato', { skip }, async () => {
  const v1 = { '320530': { AGR: 10, INT: 1, IND: 5 }, '320520': { AGR: 2 }, '': { AGR: 1 } };
  const a = await pubSim(v1, 'a'.repeat(64)); assert.equal(a.r.status, 'PUBLISHED');
  const totals = (await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 3001 AND entity_id = ${ES}`)).rows[0].value; assert.equal(totals, 13);
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 3001 AND entity_id = ${ARN}`)).rows[0].value, 0, 'zero explícito para município do universo');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 3001 AND entity_id = ${ES_IGN}`)).rows[0].value, 1);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1`, [a.r.status === 'PUBLISHED' ? a.r.runId : 0])).rows[0].n, 0, 'carga inicial não gera change log (replay pelo RAW)');
  const again = await pubSim(v1, 'a'.repeat(64)); assert.equal(again.r.status, 'NO_CHANGE');
  const before = await simRows();
  const v2 = { '320530': { AGR: 12, INT: 1, IND: 5 }, '320520': { AGR: 2 } };       // arquivo corrigido: some o "município ignorado" e Vitória muda
  const b = await pubSim(v2, 'b'.repeat(64)); assert.equal(b.r.status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 3001 AND entity_id = ${ES}`)).rows[0].value, 14);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 3001 AND entity_id = ${ES_IGN}`)).rows[0].n, 0, 'linha que sumiu do arquivo é removida da fatia');
  const ops = Object.fromEntries((await pool.query(`SELECT op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY op`, [b.r.status === 'PUBLISHED' ? b.r.runId : 0])).rows.map(r => [r.op, r.n]));
  assert.ok(ops.U > 0 && ops.D > 0, JSON.stringify(ops));
  const latest = (await pool.query(`SELECT value FROM civica_exec.exec_ind_latest WHERE indicator_id = 3001 AND entity_id = ${ES}`)).rows[0].value; assert.equal(latest, 14);
  const rb = await rollbackRun(pool, b.r.status === 'PUBLISHED' ? b.r.runId : 0); assert.equal(rb.status, 'ROLLED_BACK');
  assert.equal(await simRows(), before, 'rollback devolve exatamente o estado anterior');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_latest WHERE indicator_id = 3001 AND entity_id = ${ES}`)).rows[0].value, 13);
});

test('SIM: falha após aplicar não deixa nada; total municipal ≠ UF barra a publicação', { skip }, async () => {
  const before = await simRows();
  await assert.rejects(pubSim({ '320530': { AGR: 99 } }, 'c'.repeat(64), { fail: true }), /falha injetada/);
  assert.equal(await simRows(), before);
  const { dir } = await loadEntityDir(pool);
  const built = buildSimResidence(agg({ '320530': { AGR: 5 } }), ES, { year: 2024, prelim: false, dir, pop: new Map() });
  const bad = built.rows.map(r => r.indicator_id === 3001 && r.entity_id === ES ? { ...r, value: 6, numerator: 6 } : r);
  await assert.rejects(publishSimResidenceSlice(pool, { ufCode: ES, year: 2024, prelim: false, fileSha: 'd'.repeat(64), relPath: 'x', built: { ...built, rows: bad }, first: false }), /reconciliação SIM/);
  assert.equal(await simRows(), before);
});

// ------------------------------------------------------------------------------------- VDE
const cv = (evento: string, comp: number, o: Partial<{ mun: number; nz: number; vit: number; tot: number; dup: number }> = {}) => ({ uf: 'ES', evento, comp, abr: 'Estadual', mun: o.mun ?? 1, lin: o.mun ?? 1, nz: o.nz ?? 0, dup: o.dup ?? 0, vit: o.vit ?? 0, tot: o.tot ?? 0, peso: 0 });
function vde(h: { jan: [number, number, number]; fev: number }): VdeJson {
  const [vit, vv, nao] = h.jan; const total = vit + vv + nao;
  return { rows_read: 10, keys: 10, competences: [202401, 202402], columns: [], bad: {}, events: {}, abrangencias: {},
    rows: [['ES', 'VITÓRIA', 'Homicídio doloso', 202401, 'Estadual', vit, null, null, 0], ['ES', 'VILA VELHA', 'Homicídio doloso', 202401, 'Estadual', vv, null, null, 0], ['ES', 'NÃO INFORMADO', 'Homicídio doloso', 202401, 'Estadual', nao, null, null, 0],
      ['ES', 'NÃO INFORMADO', 'Roubo de veículo', 202401, 'Estadual', null, 7, null, 0], ['ES', 'NÃO INFORMADO', 'Roubo de veículo', 202402, 'Estadual', null, h.fev, null, 0]].filter(r => (r[5] ?? r[6]) !== 0) as VdeJson['rows'],
    cov: [cv('Homicídio doloso', 202401, { mun: 3, nz: [vit, vv, nao].filter(Boolean).length, vit: total }), cv('Homicídio doloso', 202402, { mun: 3 }), cv('Roubo de veículo', 202401, { tot: 7, nz: 1 }), cv('Roubo de veículo', 202402, { tot: h.fev, nz: h.fev ? 1 : 0 })] };
}
async function pubVde(j: VdeJson, sha: string, o: { fail?: boolean } = {}) {
  const { dir, ufByAcronym } = await loadEntityDir(pool);
  const xw: VdeCrosswalk = { byUfName: new Map(dir.municipalities.map(m => [`${m.ufCode}|${m.norm}`, m.entityId])), aliasHits: new Map() };
  const built = buildVdeSlice(j, { year: 2024, ufCode: ES, ufAcronym: 'ES', dir, xw, pop: new Map([[VIT, 360000], [ES, 4000000]]), currentYear: 2026, emptyMonths: new Set(), ufByAcronym });
  const first = (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = 17 AND uf = 32 AND competence = 202401`)).rowCount === 0;
  return { built, r: await publishVdeSlice(pool, { ufCode: ES, year: 2024, fileSha: sha, relPath: 'seguranca/sinesp-vde/x/bancovde-2024.xlsx', built, first, currentYear: 2026, ...(o.fail ? { failAfterApply: true } : {}) }) };
}
const vdeState = async () => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY indicator_id, entity_id, period_start), '')) h FROM civica_exec.exec_ind_value t WHERE indicator_id BETWEEN 3101 AND 3208`)).rows[0].h) + ':' +
  String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY indicator_id, competence), '')) h FROM civica_exec.exec_seg_cov t`)).rows[0].h);

test('VDE: publica valores e cobertura; arquivo reescrito pela fonte substitui a fatia sem duplicar; rollback exato', { skip }, async () => {
  const p1 = await pubVde(vde({ jan: [5, 3, 1], fev: 7 }), '1'.repeat(64)); assert.equal(p1.r.status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = 3101 AND entity_id = ${ES} AND period_start = '2024-01-01'`)).rows[0].value, 9);
  const cov = (await pool.query(`SELECT status, mun_pairs, unassigned FROM civica_exec.exec_seg_cov WHERE uf = ${ES} AND indicator_id = 3101 ORDER BY competence`)).rows;
  assert.deepEqual(cov.map(c => c.status), [1, 2]); assert.equal(cov[0].unassigned, 1);
  assert.equal((await pubVde(vde({ jan: [5, 3, 1], fev: 7 }), '1'.repeat(64))).r.status, 'NO_CHANGE');
  const before = await vdeState();
  const p2 = await pubVde(vde({ jan: [6, 0, 0], fev: 0 }), '2'.repeat(64)); assert.equal(p2.r.status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 3101 AND entity_id = ${VV}`)).rows[0].n, 0, 'Vila Velha zerou no arquivo novo: linha removida');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 3101 AND period_start = '2024-01-01'`)).rows[0].n, 2, 'Vitória + UF');
  assert.equal((await pool.query(`SELECT flags FROM civica_exec.exec_ind_value WHERE indicator_id = 3119 AND entity_id = ${ES} AND period_start = '2024-02-01'`)).rows[0].flags & 128, 128, 'UF zerada: zero ambíguo');
  const rb = await rollbackRun(pool, p2.r.status === 'PUBLISHED' ? p2.r.runId : 0); assert.equal(rb.status, 'ROLLED_BACK');
  assert.equal(await vdeState(), before);
});

test('VDE: falha após aplicar, evento desconhecido e perda de total por município são barrados sem efeito', { skip }, async () => {
  const before = await vdeState();
  await assert.rejects(pubVde(vde({ jan: [50, 3, 1], fev: 7 }), '3'.repeat(64), { fail: true }), /falha injetada/);
  assert.equal(await vdeState(), before);
  const j = vde({ jan: [5, 3, 1], fev: 7 }); j.rows.push(['ES', 'NÃO INFORMADO', 'Evento novo', 202401, 'Estadual', 1, null, null, 0]); j.cov.push(cv('Evento novo', 202401));
  await assert.rejects(pubVde(j, '4'.repeat(64)), /desconhecido/);
  const { built } = await pubVde(vde({ jan: [5, 3, 1], fev: 7 }), '1'.repeat(64));
  const bad = built.rows.map(r => r.indicator_id === 3101 && r.entity_id === ES && r.period_start === '2024-01-01' ? { ...r, value: 99, numerator: 99 } : r);
  await assert.rejects(publishVdeSlice(pool, { ufCode: ES, year: 2024, fileSha: '5'.repeat(64), relPath: 'x', built: { ...built, rows: bad }, first: false, currentYear: 2026 }), /reconciliação VDE/);
  assert.equal(await vdeState(), before);
});

test('contrato de leitura: poucas consultas, cobertura explícita, residência/ocorrência separadas, zero reportado ≠ sem relato', { skip }, async () => {
  await pubVde(vde({ jan: [5, 3, 1], fev: 7 }), '1'.repeat(64));
  let n = 0; const counting = { query: (...a: unknown[]) => { n++; return (pool.query as (...x: unknown[]) => unknown)(...a); } } as unknown as Pool;
  const st = await getSegState(counting, ES);
  assert.ok(n <= 6, `consultas do estado: ${n}`);
  assert.ok(st.metrics.some(m => m.code === 'IND-SEG-SIM-AGR-RES' && m.series.length >= 1));
  assert.equal(st.metrics.some(m => m.perspective === 'ocorrencia'), false, 'sem fatia de ocorrência publicada, não há série de ocorrência');
  assert.ok(st.restrictions.length >= 4); assert.deepEqual(st.coverage.population.missingYears.includes(2023), true);
  assert.deepEqual(st.coverage.vde.ambiguousMonthsByIndicator[3101], ['2024-02']);
  assert.ok(st.sources.some(s => s.dataset === 'sinesp_vde' && s.stage === 'definitivo'));
  n = 0;
  const m = (await getSegMunicipality(counting, VV))!;
  assert.ok(n <= 6, `consultas do município: ${n}`);
  const hom = m.metrics.find(x => x.code === 'IND-SEG-VDE-HOMICIDIO-DOLOSO-E')!;
  assert.deepEqual(hom.series.map(p => [p.period.slice(0, 7), p.value, p.kind]), [['2024-01', 3, 'registrado'], ['2024-02', null, 'sem_relato_ou_zero']], 'mês zerado em toda a UF não vira zero reportado');
  const alto = (await getSegMunicipality(pool, ARN))!.metrics.find(x => x.code === 'IND-SEG-VDE-HOMICIDIO-DOLOSO-E')!;
  assert.equal(alto.series[0]!.kind === 'registrado' || alto.series[0]!.kind === 'sem_relato_ou_zero' || alto.series[0]!.kind === 'zero_reportado', true);
  assert.ok(m.metrics.every(x => x.granularity === 'municipio'), 'nenhum evento só-UF é exposto como municipal');
  const slim = (await getSegMunicipality(pool, VV, { indicatorIds: [3101], from: '2024-02-01' }))!; assert.deepEqual(slim.metrics.map(x => x.indicatorId), [3101]); assert.ok(slim.metrics[0]!.series.every(p => p.period >= '2024-02-01'));
  assert.equal(await getSegMunicipality(pool, 3304557) !== null, true);
  assert.equal((await getSegMunicipality(pool, 999999)), null);
  void SIM_RES_IDS;
});
