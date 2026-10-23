import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  ALL_CRIME_DEFS, OC_BY_INDICATOR, OC_FAMILIES, OC_NOT_AVAILABLE, OC_RESTRICTIONS, applyExecMigrations, buildTerritory, getOrganizedCrimeMunicipality, getOrganizedCrimeNational, getOrganizedCrimeState,
  seedCrimeDefs, seedSegurancaDefs, seedTerritory, type IbgeMunicipio,
} from '../../packages/db/src/exec/index.ts';
import { ADMIN_URL, ESTADOS, MUNICIPIOS, REGIOES, createTestDb } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
const VIX = 3205309, SPC = 3550308, ES = 32, SP = 35;
test.before(async () => {
  if (skip) return; ctx = await createTestDb(); pool = ctx.pool;
  assert.equal((await seedTerritory(pool, buildTerritory(MUNICIPIOS as IbgeMunicipio[], ESTADOS, REGIOES), 202610)).status, 'PUBLISHED');
  await seedSegurancaDefs(pool); await seedCrimeDefs(pool);
});
test.after(async () => { if (!skip) await ctx.drop(); });

const row = (indicator_id: number, entity_id: number, month: string, value: number | null, flags = 0) => ({ indicator_id, entity_id, period_start: `${month}-01`, period_end: `${month}-28`, status: 2, numerator: value, denominator: null, value, flags });
/** Insere linhas de teste direto no banco descartável, sob uma execução própria (a escrita transacional real é coberta pelos testes de P9.1/P9.6). */
let seq = 0;
async function put(rows: ReturnType<typeof row>[]) {
  const run = Number((await pool.query(`INSERT INTO civica_exec.exec_ingestion_run (dataset_id, uf, competence, status, source_hash) VALUES (15, 0, 202601, 9, $1) RETURNING run_id`, [Buffer.from(`oc-test-${++seq}`)])).rows[0].run_id);
  for (const r of rows) await pool.query(`INSERT INTO civica_exec.exec_ind_value (indicator_id, entity_id, period_start, period_end, status, numerator, denominator, value, flags, run_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [r.indicator_id, r.entity_id, r.period_start, r.period_end, r.status, r.numerator, r.denominator, r.value, r.flags, run]);
}

test('registro de famílias: todo id aponta indicador existente, com unidade coerente e sem id novo (P9.1/P9.6 não renumerados)', async () => {
  const defs = new Map((await pool.query(`SELECT indicator_id, code, unit FROM civica_exec.exec_ind_def`)).rows.map(r => [Number(r.indicator_id), r]));
  const crime = new Map(ALL_CRIME_DEFS.map(d => [d.id, d]));
  for (const { ind, family } of OC_BY_INDICATOR.values()) {
    assert.ok(defs.has(ind.indicatorId), `${family.code}: id ${ind.indicatorId} inexistente`);
    assert.ok(ind.indicatorId < 3300 || ind.indicatorId >= 8000, 'só ids de P9.1 (VDE) ou P9.6');
    if (ind.source !== 'VDE') { const d = crime.get(ind.indicatorId)!; assert.ok(d, `${ind.indicatorId} fora do catálogo P9.6`); assert.equal(d.ufCode, ind.ufCode); assert.equal(d.composite, null, 'composto não entra'); }
    else assert.match(String(defs.get(ind.indicatorId)!.code), /^IND-SEG-VDE-/);
  }
  const ids = [...OC_BY_INDICATOR.keys()]; assert.equal(new Set(ids).size, ids.length, 'indicador em duas famílias');
  // ids conferidos pelo código de origem, não por posição
  const byCode = (src: string, code: string) => ALL_CRIME_DEFS.find(d => d.source === src && d.code === code)!.id;
  assert.equal(byCode('ISP-RJ', 'trafico_drogas'), 8042); assert.equal(byCode('SSP-RS', 'ENTORPECENTES_TRAFICO'), 8315); assert.equal(byCode('SSP-SP', 'TRAFICO_DE_ENTORPECENTES'), 8720); assert.equal(byCode('SSP-SP', 'PORTE_DE_ARMA'), 8723);
  assert.ok(OC_RESTRICTIONS.some(r => /organização criminosa/.test(r)) && OC_NOT_AVAILABLE.length >= 3);
  assert.equal(OC_FAMILIES.filter(f => f.indicators.some(i => i.measure === 'peso_informado')).length, 2);
});

test('Brasil: soma só partições do mesmo indicador; Estadual e PF/PRF nunca se somam; parcial não é "completo"; fonte estadual não tem total nacional', async () => {
  const E = 3124, F = 3125; const rows = [row(E, ES, '2025-01', 10), row(E, SP, '2025-01', 5), row(F, ES, '2025-01', 7), row(F, SP, '2025-01', 1), row(E, SP, '2025-02', 4)];
  await put(rows);
  const n = await getOrganizedCrimeNational(pool);
  const e = n.series.find(s => s.indicatorId === E)!, f = n.series.find(s => s.indicatorId === F)!;
  assert.equal(e.years[0]!.value, 19); assert.equal(f.years[0]!.value, 8); assert.equal(e.years[0]!.ufsWithData, 2); assert.equal(e.years[0]!.complete, false);
  assert.ok(!n.series.some(s => s.source !== 'VDE'), 'só VDE tem total nacional'); assert.ok(n.stateSourcesOnly.length >= 10);
  assert.ok(n.series.every(s => s.aggregation.includes('não soma Estadual com PF/PRF')));
});

test('UF e município: fonte da UF certa, ausência não vira zero, mês sem linha continua sem linha, município sem fonte vem vazio', async () => {
  const mand = 3112, traficoSp = 8720;
  await put([row(mand, VIX, '2025-01', 3), row(mand, VIX, '2025-03', 0), row(traficoSp, SPC, '2025-01', 120), row(traficoSp, SP, '2025-01', 130)]);
  const v = await getOrganizedCrimeMunicipality(pool, VIX); const s = v.families.flatMap(f => f.series);
  assert.deepEqual(s.map(x => x.indicatorId), [mand]); assert.deepEqual(s[0]!.points.map(p => p.period), ['2025-01', '2025-03']); assert.equal(s[0]!.points[1]!.value, 0, 'zero declarado permanece zero'); assert.ok(!s[0]!.points.some(p => p.period === '2025-02'));
  const sp = await getOrganizedCrimeMunicipality(pool, SPC); assert.ok(sp.families.some(f => f.code === 'OC.DRUG.TRAFFICKING_RECORDS' && f.series.some(x => x.indicatorId === traficoSp)));
  assert.ok(!sp.families.some(f => f.series.some(x => x.source === 'ISP-RJ' || x.source === 'SSP-RS')), 'nunca mistura fontes de outras UFs');
  const uf = await getOrganizedCrimeState(pool, SP); assert.equal(uf.scope, 'uf'); assert.ok(uf.families.some(f => f.series.some(x => x.indicatorId === traficoSp && x.points[0]!.value === 130)));
  const nada = await getOrganizedCrimeMunicipality(pool, 9999999); assert.equal(nada.families.length, 0); assert.ok(nada.restrictions.length >= 5);
});

test('privacidade e escopo: nenhuma tabela/coluna individual, nem território de organização, e o catálogo não cria entidades novas', async () => {
  const cols = (await pool.query(`SELECT table_name || '.' || column_name AS c FROM information_schema.columns WHERE table_schema = 'civica_exec'`)).rows.map(r => String(r.c));
  for (const bad of ['faccao', 'organizacao_criminosa', 'orcrim', 'investigado', 'suspeito', 'cpf', 'placa', 'latitude', 'longitude', 'numero_processo']) assert.ok(!cols.some(c => c.toLowerCase().includes(bad)), `coluna proibida ${bad}`);
  assert.equal(Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_entity WHERE kind NOT IN (1, 2, 3, 4, 5, 6, 7)`)).rows[0].n), 0);
});
