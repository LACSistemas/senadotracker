import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { applyExecMigrations, educationAnalyticsFreshness, getEducationContractSummary, refreshEducationAnalytics } from '../../packages/db/src/exec/index.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; await seedMiniTerritory(pool); });
test.after(async () => { if (!skip) await ctx.drop(); });

test('P10.8: migration v17 cria somente rollup, metadado e índices direcionados', { skip }, async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  assert.ok((await pool.query(`SELECT 1 FROM civica_exec.schema_migrations WHERE version=17`)).rowCount);
  const tables = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='civica_exec' AND table_name IN ('exec_edu_contract_rollup','exec_edu_analytics_meta') ORDER BY 1`)).rows.map(x => x.table_name);
  assert.deepEqual(tables, ['exec_edu_analytics_meta', 'exec_edu_contract_rollup']);
});

test('P10.8: rollup reconcilia, separa POSSIBLE e é idempotente', { skip }, async () => {
  await pool.query(`INSERT INTO civica_exec.exec_edu_contract (pncp_id,year,uf,entity_id,esfera,org_cnpj,buyer,best_confidence,tipo,categoria,valor_global,outlier,objeto) VALUES
    ('a',2025,32,3205309,'M',1,2,2,1,1,10000,false,'escola'),('b',2025,32,3205309,'M',1,0,3,1,1,20000,false,'possível'),('c',2025,35,3550308,'M',1,2,1,1,1,999999999999,true,'outlier')`);
  await pool.query(`INSERT INTO civica_exec.exec_edu_contract_class (pncp_id,year,uf,entity_id,esfera,valor,outlier,category,via,rule,confidence,evidence) VALUES
    ('a',2025,32,3205309,'M',10000,false,8,1,1,2,'merenda'),('b',2025,32,3205309,'M',20000,false,16,2,2,3,'possível'),('c',2025,35,3550308,'M',999999999999,true,2,1,3,1,'obra')`);
  const first = await refreshEducationAnalytics(pool); const state1 = (await pool.query(`SELECT * FROM civica_exec.exec_edu_contract_rollup ORDER BY 1,2,3,4,5`)).rows;
  const second = await refreshEducationAnalytics(pool); const state2 = (await pool.query(`SELECT * FROM civica_exec.exec_edu_contract_rollup ORDER BY 1,2,3,4,5`)).rows;
  assert.deepEqual(state2, state1); assert.equal(first.sourceFingerprint, second.sourceFingerprint); assert.equal(first.sourceContractRows, 3); assert.equal(first.sourceClassRows, 3);
  const br = await getEducationContractSummary(pool, { year: 2025 }); assert.ok(br); assert.equal(br!.total.highAndConfirmed.contracts, 2); assert.equal(br!.total.possible.contracts, 1); assert.equal(br!.total.highAndConfirmed.contractedValue, 100);
  const es = await getEducationContractSummary(pool, { ufCode: 32, year: 2025 }); assert.equal(es!.total.highAndConfirmed.contracts, 1); assert.equal(es!.total.possible.contracts, 1);
  assert.equal((await educationAnalyticsFreshness(pool))!.sourceContractRows, 3);
});

test('P10.8: falha injetada preserva atomicamente o rollup publicado', { skip }, async () => {
  const before = (await pool.query(`SELECT * FROM civica_exec.exec_edu_contract_rollup ORDER BY 1,2,3,4,5`)).rows;
  const freshnessBefore = await educationAnalyticsFreshness(pool);
  await pool.query(`CREATE FUNCTION civica_exec.p108_reject_rollup_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'p108 injected publication failure'; END $$`);
  await pool.query(`CREATE TRIGGER p108_reject_rollup_write BEFORE DELETE ON civica_exec.exec_edu_contract_rollup
    FOR EACH STATEMENT EXECUTE FUNCTION civica_exec.p108_reject_rollup_write()`);
  try {
    await assert.rejects(refreshEducationAnalytics(pool), /p108 injected publication failure/);
  } finally {
    await pool.query('DROP TRIGGER p108_reject_rollup_write ON civica_exec.exec_edu_contract_rollup');
    await pool.query('DROP FUNCTION civica_exec.p108_reject_rollup_write()');
  }
  const after = (await pool.query(`SELECT * FROM civica_exec.exec_edu_contract_rollup ORDER BY 1,2,3,4,5`)).rows;
  assert.deepEqual(after, before);
  assert.deepEqual(await educationAnalyticsFreshness(pool), freshnessBefore);
});
