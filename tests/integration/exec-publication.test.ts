import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { DATASET, SPECS, applyExecMigrations, publishSlice, replayFrom, rollbackRun, sha256, series, stateAt, upsertIndicators, type Row } from '../../packages/db/src/exec/index.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

// Estes testes exigem um PostgreSQL DESCARTÁVEL (EXEC_TEST_ADMIN_URL). Sem ele são pulados — nunca rodam contra o banco do Cívica.
const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
const ES = 32, RJ = 33;
const VIT = 3205309, VV = 3205200, RIO = 3304557;

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let pool: Pool;

async function ident(cnes: number, entity: number) {
  await pool.query(`INSERT INTO civica_exec.exec_sau_cnes_estab (cnes, first_seen, origin, entity_id, name) VALUES ($1, 201301, 1, $2, $3) ON CONFLICT DO NOTHING`, [cnes, entity, `Hospital ${cnes}`]);
}
const leito = (cnes: number, entity: number, sus: number, exist = 10): Row => ({ cnes, entity_id: entity, tp_leito: 1, cod_leito: 3, qt_exist: exist, qt_sus: sus, qt_nsus: exist - sus });
async function pubLeitos(uf: number, comp: number, rows: Row[], extra: Partial<Parameters<typeof publishSlice>[1]> = {}) {
  return publishSlice(pool, { datasetId: DATASET.cnes_lt, uf, competence: comp, sourceHash: sha256(JSON.stringify([uf, comp, rows])), tables: [{ spec: SPECS.cnes_leito_v, rows }], ...extra });
}
async function intervals(cnes: number) {
  return (await pool.query(`SELECT valid_from, valid_to, qt_sus FROM civica_exec.exec_sau_cnes_leito_v WHERE cnes = $1 ORDER BY valid_from`, [cnes])).rows.map(r => [r.valid_from, r.valid_to, r.qt_sus]);
}
async function stateHash(): Promise<string> {
  return String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM civica_exec.exec_sau_cnes_leito_v t`)).rows[0].h);
}

test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; const r = await seedMiniTerritory(pool); assert.equal(r.status, 'PUBLISHED'); await ident(111, VIT); await ident(222, VIT); await ident(333, RIO); });
test.after(async () => { if (!skip) await ctx.drop(); });

test('migrations: 38 tabelas (v2 = exec_seg_cov; v3 = trânsito; v4 = prisional; v5 = finanças; v6 = contratos e transferências), idempotentes', { skip }, async () => {
  const n = (await pool.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema = 'civica_exec' AND table_name <> 'schema_migrations'`)).rows[0].n;
  assert.equal(n, 39);
  assert.deepEqual(await applyExecMigrations(pool), []);
});

test('fundação territorial: tipos, município ignorado, DF, Boa Esperança do Norte sem data inventada', { skip }, async () => {
  const k = Object.fromEntries((await pool.query(`SELECT kind, count(*)::int n FROM civica_exec.exec_entity GROUP BY kind`)).rows.map(r => [r.kind, r.n]));
  assert.deepEqual(k, { 1: 1, 2: 5, 3: 27, 4: 7, 5: 27 });
  assert.equal((await pool.query(`SELECT entity_id FROM civica_exec.exec_entity_external_id WHERE source = 1 AND code = '320000'`)).rows[0].entity_id, 3200000);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_entity WHERE ibge7 IN (53, 5300108)`)).rows[0].n, 2, 'DF como UF e como município');
  const v = (await pool.query(`SELECT evidence_ref, valid_to FROM civica_exec.exec_entity_version WHERE entity_id = 5101837`)).rows[0];
  assert.match(v.evidence_ref, /NÃO comprovada/);
  assert.equal((await pool.query(`SELECT uf FROM civica_exec.exec_entity WHERE entity_id = 5101837`)).rows[0].uf, 'MT');
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_entity (entity_id, kind, ibge7, uf_code, uf, name) VALUES (9999992, 4, 3205301, 32, 'ES', 'mesmo ibge6 de Vitória')`), /duplicate|unique/i);
});

test('restrições de integridade rejeitam dados inválidos', { skip }, async () => {
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_sau_cnes_estab_v (cnes, valid_from, entity_id) VALUES (111, 202500, $1)`, [VIT]), /competence|check|violates/i);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_sau_cnes_leito_v (cnes, entity_id, tp_leito, cod_leito, valid_from, qt_exist) VALUES (999, $1, 1, 1, 202401, 1)`, [VIT]), /foreign key/i);
  await pool.query(`INSERT INTO civica_exec.exec_sau_cnes_estab_v (cnes, valid_from, entity_id, tp_unid) VALUES (111, 202401, $1, 5)`, [VIT]);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_sau_cnes_estab_v (cnes, valid_from, entity_id, tp_unid) VALUES (111, 202402, $1, 5)`, [VIT]), /duplicate|unique/i);
  await pool.query(`DELETE FROM civica_exec.exec_sau_cnes_estab_v WHERE cnes = 111`);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_sau_cnes_leito_v (cnes, entity_id, tp_leito, cod_leito, valid_from, valid_to, qt_exist) VALUES (111, $1, 9, 9, 202402, 202401, 1)`, [VIT]), /check/i);
});

test('T1 dez/2024 → jan/2025 no banco: série contígua, intervalo fecha em 202501', { skip }, async () => {
  for (const [c, sus] of [[202411, 6], [202412, 6], [202501, 7]] as const) { const r = await pubLeitos(ES, c, [leito(111, VIT, sus, sus + 4)], c === 202411 ? { bootstrap: true } : {}); assert.equal(r.status, 'PUBLISHED', JSON.stringify(r)); }
  assert.deepEqual(await intervals(111), [[202411, 202501, 6], [202501, null, 7]]);
  const at = async (c: number) => (await pool.query(`SELECT qt_sus FROM civica_exec.exec_sau_cnes_leito_v WHERE cnes = 111 AND valid_from <= $1 AND (valid_to IS NULL OR valid_to > $1)`, [c])).rows[0]?.qt_sus;
  assert.equal(await at(202412), 6); assert.equal(await at(202501), 7);
});

test('T2/T3/T4 mudança, desaparecimento, reaparecimento e lacuna recusada', { skip }, async () => {
  // continua a série da UF 32: 202502 (222 aparece), 202503 (222 some), 202504 (222 volta com valor diferente)
  assert.equal((await pubLeitos(ES, 202502, [leito(111, VIT, 7, 11), leito(222, VIT, 5, 5)])).status, 'PUBLISHED');
  assert.equal((await pubLeitos(ES, 202503, [leito(111, VIT, 7, 11)])).status, 'PUBLISHED');
  assert.equal((await pubLeitos(ES, 202504, [leito(111, VIT, 7, 11), leito(222, VIT, 4, 4)])).status, 'PUBLISHED');
  assert.deepEqual(await intervals(222), [[202502, 202503, 5], [202504, null, 4]]);
  assert.deepEqual(await intervals(111), [[202411, 202501, 6], [202501, null, 7]], 'valores iguais em 202502–202504 não geram nova linha');
  const gap = await pubLeitos(ES, 202506, [leito(111, VIT, 7, 11)]);
  assert.deepEqual(gap, { status: 'FAILED_SAFE', reason: 'GAP: 202506 não é a seguinte a 202504' });
});

test('idempotência: reenviar a mesma fatia é NO_CHANGE e não escreve', { skip }, async () => {
  const rows = [leito(111, VIT, 7, 11), leito(222, VIT, 4, 4)];
  const before = Number((await pool.query(`SELECT count(*) n FROM civica_exec.exec_change_log`)).rows[0].n);
  const r = await pubLeitos(ES, 202504, rows);
  assert.equal(r.status, 'NO_CHANGE');
  assert.equal(Number((await pool.query(`SELECT count(*) n FROM civica_exec.exec_change_log`)).rows[0].n), before);
});

test('falha injetada no meio: nada parcial, run registrado como FALHO', { skip }, async () => {
  const h = await stateHash();
  const pubBefore = (await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2`, [DATASET.cnes_lt, ES])).rows[0].n;
  await assert.rejects(pubLeitos(ES, 202505, [leito(111, VIT, 9, 12)], { failAfterApply: true }), /falha injetada/);
  assert.equal(await stateHash(), h);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2`, [DATASET.cnes_lt, ES])).rows[0].n, pubBefore);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ingestion_run WHERE status = 11`)).rows[0].n >= 1, true);
});

test('rollback exato: hash idêntico ao anterior; segunda reversão e reversão de run antigo são recusadas', { skip }, async () => {
  const h0 = await stateHash();
  const old = (await pool.query(`SELECT run_id FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = 202503`, [DATASET.cnes_lt, ES])).rows[0].run_id;
  const r = await pubLeitos(ES, 202505, [leito(111, VIT, 9, 12), leito(222, VIT, 4, 4)]);
  assert.equal(r.status, 'PUBLISHED'); assert.notEqual(await stateHash(), h0);
  const refused = await rollbackRun(pool, old);
  assert.equal(refused.status, 'REFUSED');
  const rb = await rollbackRun(pool, (r as { runId: number }).runId);
  assert.equal(rb.status, 'ROLLED_BACK');
  assert.equal(await stateHash(), h0);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_publication WHERE competence = 202505 AND dataset_id = $1 AND uf = $2`, [DATASET.cnes_lt, ES])).rows[0].n, 0);
  assert.equal((await rollbackRun(pool, (r as { runId: number }).runId)).status, 'REFUSED');
});

test('T5 correção retroativa (REPLAY_FROM) em transação é igual a reconstruir tudo do zero; falha no replay não deixa estado parcial', { skip }, async () => {
  const comps = [202201, 202202, 202203, 202204, 202205, 202206];
  const susOf = (c: number) => c <= 202204 ? 6 : 8;
  for (const c of comps) assert.equal((await pubLeitos(RJ, c, [leito(333, RIO, susOf(c), susOf(c) + 4)], c === 202201 ? { bootstrap: true } : {})).status, 'PUBLISHED');
  const orig = await intervals(333);
  assert.deepEqual(orig, [[202201, 202205, 6], [202205, null, 8]]);
  const corrected = (c: number) => c === 202203 ? 5 : susOf(c);
  const snaps = new Map(comps.filter(c => c >= 202203).map(c => [c, [{ spec: SPECS.cnes_leito_v, rows: [leito(333, RIO, corrected(c), corrected(c) + 4)] }]]));
  const h0 = await stateHash();
  await assert.rejects(replayFrom(pool, { datasetId: DATASET.cnes_lt, uf: RJ, fromCompetence: 202203, snapshots: snaps, sourceHash: sha256('replay-falha'), failAfterApply: true }), /falha injetada/);
  assert.equal(await stateHash(), h0, 'falha no meio do replay não publica nada');
  const rep = await replayFrom(pool, { datasetId: DATASET.cnes_lt, uf: RJ, fromCompetence: 202203, snapshots: snaps, sourceHash: sha256('replay-ok') });
  assert.equal(rep.competences.length, 4);
  const got = await intervals(333);
  const fresh = series(new Map(comps.map(c => [c, new Map([['333', [corrected(c), corrected(c) + 4]]])])));
  assert.deepEqual(got.map(r => [r[0], r[1], r[2]]), fresh.map(i => [i.vf, i.vt, (i.val as number[])[0]]));
  assert.deepEqual(stateAt(fresh, 202204).get('333'), [6, 10]);
  // o replay também é reversível pelo change log
  const rb = await rollbackRun(pool, rep.runId);
  assert.equal(rb.status, 'ROLLED_BACK');
  assert.deepEqual(await intervals(333), orig);
});

test('publicações de UFs diferentes não se bloqueiam; a mesma UF espera pelo lock', { skip }, async () => {
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`civica_exec:${DATASET.cnes_lt}:${ES}`]);
    await ident(444, VIT);
    const other = await Promise.race([pubLeitos(RJ, 202301, [leito(333, RIO, 3, 5)], { bootstrap: true }), new Promise(r => setTimeout(() => r('lento'), 3000))]);
    assert.notEqual(other, 'lento', 'UF diferente não pode esperar');
    let done = false;
    const same = pubLeitos(ES, 202505, [leito(111, VIT, 7, 11), leito(222, VIT, 4, 4)]).then(r => { done = true; return r; });
    await new Promise(r => setTimeout(r, 600));
    assert.equal(done, false, 'mesma UF deve esperar o lock');
    await holder.query('COMMIT');
    assert.equal((await same).status, 'PUBLISHED');
  } finally { holder.release(); }
});

test('T6 duas versões metodológicas do mesmo indicador, sem sobreposição, com lacuna declarada', { skip }, async () => {
  await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, label, grain, valid_from_period, valid_to_period) VALUES (101, 'IND-SAU-01', 1, 1, 'Cobertura AB', 'M', '2019-12-01', '2020-12-31')`);
  await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, supersedes_id, domain, label, grain, valid_from_period) VALUES (102, 'IND-SAU-01', 2, 101, 1, 'Cobertura APS', 'M', '2021-12-01')`);
  await assert.rejects(pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, label, grain) VALUES (103, 'IND-SAU-01', 2, 1, 'duplicada', 'M')`), /unique|duplicate/i);
  const r = await publishSlice(pool, { datasetId: DATASET.ind_derived, uf: ES, competence: 202012, sourceHash: sha256('ab'), bootstrap: true, tables: [], derive: async (c, runId) => { await upsertIndicators(c, runId, [{ indicator_id: 101, entity_id: VIT, period_start: '2020-12-01', period_end: '2021-01-01', status: 2, numerator: null, denominator: null, value: 92.28 }]); } });
  assert.equal(r.status, 'PUBLISHED');
  const r2 = await publishSlice(pool, { datasetId: DATASET.ind_derived, uf: ES, competence: 202112, sourceHash: sha256('aps'), bootstrap: true, tables: [], derive: async (c, runId) => { await upsertIndicators(c, runId, [{ indicator_id: 102, entity_id: VIT, period_start: '2021-12-01', period_end: '2022-01-01', status: 2, numerator: null, denominator: null, value: 92.46 }]); } });
  assert.equal(r2.status, 'PUBLISHED');
  const rows = (await pool.query(`SELECT d.method_version, v.period_start::text, v.value FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE d.code = 'IND-SAU-01' AND v.entity_id = $1 ORDER BY v.period_start`, [VIT])).rows;
  assert.deepEqual(rows.map(x => [x.method_version, x.period_start, x.value]), [[1, '2020-12-01', 92.28], [2, '2021-12-01', 92.46]]);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id = 102 AND period_start < '2021-12-01'`)).rows[0].n, 0, 'nada interpolado na lacuna 2021');
});

test('T7 preliminar substituída por definitiva; rollback restaura a preliminar e o exec_ind_latest', { skip }, async () => {
  await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, label, grain) VALUES (8, 'IND-SAU-08', 1, 1, 'Mortalidade infantil', 'A')`);
  const prelim = await publishSlice(pool, { datasetId: DATASET.ind_derived, uf: ES, competence: 202401, stage: 1, sourceHash: sha256('prelim'), bootstrap: true, tables: [], derive: async (c, runId) => { await upsertIndicators(c, runId, [{ indicator_id: 8, entity_id: VIT, period_start: '2024-01-01', period_end: '2025-01-01', status: 1, numerator: 39, denominator: 3480, value: 11.2, flags: 2 }]); } });
  assert.equal(prelim.status, 'PUBLISHED');
  const fin = await publishSlice(pool, { datasetId: DATASET.ind_derived, uf: ES, competence: 202401, stage: 2, sourceHash: sha256('final'), tables: [], derive: async (c, runId) => { await upsertIndicators(c, runId, [{ indicator_id: 8, entity_id: VIT, period_start: '2024-01-01', period_end: '2025-01-01', status: 2, numerator: 37, denominator: 3498, value: 10.58, flags: 0 }]); } });
  assert.equal(fin.status, 'PUBLISHED');
  const now = async () => (await pool.query(`SELECT v.status, v.value, l.status AS ls, l.value AS lv FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_latest l USING (indicator_id, entity_id, period_start) WHERE indicator_id = 8 AND entity_id = $1`, [VIT])).rows[0];
  assert.deepEqual(await now(), { status: 2, value: 10.58, ls: 2, lv: 10.58 });
  const rb = await rollbackRun(pool, (fin as { runId: number }).runId);
  assert.equal(rb.status, 'ROLLED_BACK');
  assert.deepEqual(await now(), { status: 1, value: 11.2, ls: 1, lv: 11.2 });
});

test('derivados na mesma transação: falha no derivado não deixa indicador nem fato; rollback remove ambos', { skip }, async () => {
  const hLeitos = await stateHash();
  await assert.rejects(publishSlice(pool, { datasetId: DATASET.cnes_lt, uf: RJ, competence: 202302, sourceHash: sha256('deriv-falha'), tables: [{ spec: SPECS.cnes_leito_v, rows: [leito(333, RIO, 4, 6)] }],
    derive: async (c, runId) => { await upsertIndicators(c, runId, [{ indicator_id: 8, entity_id: RIO, period_start: '2023-02-01', period_end: '2023-03-01', status: 2, numerator: 1, denominator: 1, value: 1 }]); throw new Error('derivado falhou'); } }), /derivado falhou/);
  assert.equal(await stateHash(), hLeitos);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE entity_id = $1`, [RIO])).rows[0].n, 0);
  const ok = await publishSlice(pool, { datasetId: DATASET.cnes_lt, uf: RJ, competence: 202302, sourceHash: sha256('deriv-ok'), tables: [{ spec: SPECS.cnes_leito_v, rows: [leito(333, RIO, 4, 6)] }],
    derive: async (c, runId) => { await upsertIndicators(c, runId, [{ indicator_id: 8, entity_id: RIO, period_start: '2023-02-01', period_end: '2023-03-01', status: 2, numerator: 4, denominator: 6, value: 66.7 }]); } });
  assert.equal(ok.status, 'PUBLISHED');
  assert.equal((await rollbackRun(pool, (ok as { runId: number }).runId)).status, 'ROLLED_BACK');
  assert.equal(await stateHash(), hLeitos);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE entity_id = $1`, [RIO])).rows[0].n, 0);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_latest WHERE entity_id = $1`, [RIO])).rows[0].n, 0);
});
