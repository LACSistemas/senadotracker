import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  ALL_CRIME_DEFS, applyExecMigrations, buildTerritory, listExplorableIndicators, listSecurityContracts, readCrimeRateBench, readIndicatorSeries, readMunicipalRateBench, readPopulationSeries, readUfRateBench, seedCrimeDefs, seedSegurancaDefs, seedTerritory,
  sizeBandOf, type IbgeMunicipio,
} from '../../packages/db/src/exec/index.ts';
import { ADMIN_URL, ESTADOS, MUNICIPIOS, REGIOES, createTestDb } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
/** Seis municípios do ES (além dos três do mini-território) para formar um grupo comparável de verdade. */
const EXTRA: Array<[number, string]> = [[3201308, 'Cariacica'], [3205002, 'Serra'], [3202405, 'Guarapari'], [3203205, 'Linhares'], [3201209, 'Cachoeiro de Itapemirim'], [3204906, 'São Mateus']];
const extraMuns: IbgeMunicipio[] = EXTRA.map(([id, nome]) => ({ id, nome, microrregiao: { mesorregiao: { UF: ESTADOS.find(e => e.id === 32)! } } }) as IbgeMunicipio);
const UF = 32, VIT = 3205309, VV = 3205200, ARN = 3200359; const IDS = [VIT, VV, ...EXTRA.map(e => e[0])];
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool; let runId = 0; const crimeId = ALL_CRIME_DEFS.find(d => d.source === 'SESP-ES' && d.code === 'ROUBO_PESSOA_VIA_PUBLICA')!.id;

test.before(async () => {
  if (skip) return; ctx = await createTestDb(); pool = ctx.pool;
  assert.equal((await seedTerritory(pool, buildTerritory([...MUNICIPIOS, ...extraMuns], ESTADOS, REGIOES), 202610)).status, 'PUBLISHED'); await seedSegurancaDefs(pool); await seedCrimeDefs(pool);
  runId = Number((await pool.query(`INSERT INTO civica_exec.exec_ingestion_run (dataset_id, uf, competence, status, source_hash) VALUES (15, 0, 202601, 9, $1) RETURNING run_id`, [Buffer.from('bench-test')])).rows[0].run_id);
  for (const id of [...IDS, ARN, UF]) for (const y of [2019, 2020, 2021, 2024, 2025]) if (!(id === ARN || id === UF) || true) await pool.query(`INSERT INTO civica_exec.exec_territory_population (entity_id, year, source, value) VALUES ($1, $2, 1, $3) ON CONFLICT DO NOTHING`, [id, y, id === UF ? 4000000 : id === ARN ? 9000 : 30000 + (id % 7) * 12000]);
});
test.after(async () => { if (!skip) await ctx.drop(); });

const put = (ind: number, ent: number, y: number, m: number, value: number | null, flags = 0) => pool.query(`INSERT INTO civica_exec.exec_ind_value (indicator_id, entity_id, period_start, period_end, status, value, numerator, flags, run_id) VALUES ($1, $2, make_date($3, $4, 1), make_date($3, $4, 1) + interval '1 month', 2, $5, $5, $6, $7) ON CONFLICT DO NOTHING`, [ind, ent, y, m, value, flags, runId]);
async function year(y: number, months: number, entities: number[], opts: { suppressedOn?: number } = {}) {
  for (let m = 1; m <= months; m++) { await put(crimeId, UF, y, m, 100 + m); for (const e of entities) await put(crimeId, e, y, m, e === opts.suppressedOn ? null : 5 + (e % 5), e === opts.suppressedOn ? 8 : 0); }
}

test('benchmark de fonte estadual: só vale com população do mesmo ano, 12 meses, cobertura ≥ 80%, sem células suprimidas e grupo mínimo; cada falha tem motivo próprio', async () => {
  await year(2019, 12, IDS);                                 // ok
  await year(2020, 12, IDS, { suppressedOn: IDS[3]! });      // célula suprimida
  await year(2021, 12, IDS.slice(0, 3));                     // cobertura insuficiente (3 de 8)
  await year(2023, 12, IDS);                                 // sem população em 2023
  await year(2025, 6, IDS);                                  // ano incompleto
  const r = await readCrimeRateBench(pool, { ufCode: UF, indicatorIds: [crimeId], entityId: VIT, fromYear: 2019 }); const by = new Map(r.map(x => [x.year, x]));
  assert.equal(by.get(2019)!.status, 'ok'); assert.equal(by.get(2019)!.n, 8); assert.ok(by.get(2019)!.p50! > 0 && by.get(2019)!.p25! <= by.get(2019)!.p75!); assert.ok(by.get(2019)!.own!.rate > 0, 'taxa própria calculada com a população do mesmo ano');
  assert.equal(by.get(2020)!.status, 'celulas_suprimidas'); assert.equal(by.get(2021)!.status, 'cobertura_insuficiente'); assert.equal(by.get(2023)!.status, 'sem_populacao_do_ano'); assert.equal(by.get(2025)!.status, 'ano_incompleto');
  assert.equal(by.get(2023)!.p50, null, 'sem mediana inventada'); assert.equal(by.get(2023)!.own, null, 'sem taxa em ano sem população');
  const small = await readCrimeRateBench(pool, { ufCode: UF, indicatorIds: [crimeId], entityId: VIT, fromYear: 2019, band: { min: 500000, max: 1e12 } }); assert.ok(small.every(x => x.status !== 'ok'), 'faixa sem municípios suficientes não gera benchmark');
});

test('benchmark de taxa publicada: exclui pequeno número e suprimidos, respeita faixa de porte e exige grupo mínimo', async () => {
  const rate = 3201; await pool.query(`UPDATE civica_exec.exec_ind_def SET unit = unit WHERE indicator_id = $1`, [rate]);
  for (const [i, e] of IDS.entries()) await pool.query(`INSERT INTO civica_exec.exec_ind_value (indicator_id, entity_id, period_start, period_end, status, value, numerator, denominator, flags, run_id) VALUES ($1, $2, '2024-01-01', '2025-01-01', 2, $3, 1, $4, 0, $5)`, [rate, e, 10 + i, 30000 + i * 20000, runId]);
  await pool.query(`INSERT INTO civica_exec.exec_ind_value (indicator_id, entity_id, period_start, period_end, status, value, numerator, denominator, flags, run_id) VALUES ($1, $2, '2024-01-01', '2025-01-01', 2, 99, 1, 9000, 1, $3)`, [rate, ARN, runId]);   // pequeno número: fora
  const all = await readMunicipalRateBench(pool, { ufCode: UF, indicatorId: rate }); assert.equal(all.length, 1); assert.equal(all[0]!.n, 8, 'Alto Rio Novo (pequeno número) fora do grupo');
  const band = await readMunicipalRateBench(pool, { ufCode: UF, indicatorId: rate, band: { min: 100000, max: 500000 } }); assert.ok(band.length === 0 || band[0]!.n < 8, 'a faixa de porte reduz o grupo');
  assert.deepEqual(await readUfRateBench(pool, { indicatorId: rate }), [], 'menos de 20 UFs com taxa: sem mediana das UFs');
  assert.equal(sizeBandOf(15000), null); assert.equal(sizeBandOf(343000)!.key, 'm100_500'); assert.equal(sizeBandOf(600000)!.key, 'm500');
});

test('leituras de apoio: população só dos anos oficiais, índice de explorável, série bruta e contratos sem objeto nem pessoa física', async () => {
  const pop = await readPopulationSeries(pool, VIT); assert.deepEqual(pop.map(p => p.year), [2019, 2020, 2021, 2024, 2025]); assert.ok(!pop.some(p => p.year === 2022 || p.year === 2023));
  const idx = await listExplorableIndicators(pool, VIT); assert.ok(idx.some(i => i.indicatorId === crimeId) && idx.every(i => i.indicatorId >= 3001));
  const s = await readIndicatorSeries(pool, { entityId: VIT, indicatorId: crimeId }); assert.ok(s && s.points.length >= 12 && s.points.every(p => typeof p.flags === 'number')); assert.equal(await readIndicatorSeries(pool, { entityId: VIT, indicatorId: 99999 }), null);
  await pool.query(`INSERT INTO civica_exec.exec_fin_supplier (cnpj, name) VALUES (11222333000181, 'FORNECEDOR PJ LTDA')`);
  await pool.query(`INSERT INTO civica_exec.exec_fin_contract (pncp_id, year, uf, entity_id, esfera, org_cnpj, org_kind, theme, link, tipo, categoria, valor_global, valor_inicial, signed, supplier) VALUES ('27142058000126-2-000001/2025', 2025, 32, $1, 'M', 27142058000126, 1, 1, 3, 2, 1, 123456789, 123456789, '2025-03-10', 11222333000181), ('27142058000126-2-000002/2025', 2025, 32, $1, 'M', 27142058000126, 1, 0, 1, 2, 1, 5000, 5000, '2025-04-10', NULL)`, [VIT]);
  const c = await listSecurityContracts(pool, { entityId: VIT, year: 2025, limit: 5 }); assert.equal(c.total, 2); assert.equal(c.rows[0]!.valueCents, '123456789', 'ordem por valor'); assert.equal(c.rows[0]!.supplierName, 'FORNECEDOR PJ LTDA'); assert.equal(c.rows[1]!.supplierCnpj, null, 'sem fornecedor identificado (pessoa física ou sem CNPJ) nada é inventado');
  const keys = Object.keys(c.rows[0]!); for (const bad of ['objeto', 'cpf', 'nome_pf', 'descricao']) assert.ok(!keys.some(k => k.toLowerCase().includes(bad))); assert.ok(c.restrictions.some(r => /não é valor pago/.test(r)));
});
