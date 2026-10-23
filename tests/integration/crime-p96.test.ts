import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  ALL_CRIME_DEFS, CRIME_DEF_BY_ID, CRIME_SOURCES, applyExecMigrations, buildTerritory, crimeIdsOf, seedTerritory,
  type IbgeMunicipio, getStateCrimeMunicipality, getStateCrimeState, seedCrimeDefs,
  type CrimeRecord,
} from '../../packages/db/src/exec/index.ts';
import { publishCrimeSource, type CrimeLoaded } from '../../apps/collector/src/exec/crime.ts';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { discoverCeFiles } from '../../apps/collector/src/exec/crime-ce.ts';
import { PE_ALIASES, discoverPeFiles } from '../../apps/collector/src/exec/crime-pe.ts';
import { mgCode, truncateFutureZeros } from '../../apps/collector/src/exec/crime-mg.ts';
import { spYearFiles } from '../../apps/collector/src/exec/crime-sp.ts';
import { ADMIN_URL, ESTADOS, MUNICIPIOS, REGIOES, createTestDb } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
/** O crosswalk do VDE exige que os municípios dos aliases oficiais existam: o território de teste os acrescenta. */
const ALIAS_MUNS: IbgeMunicipio[] = ([[3105509, 'Barão do Monte Alto', 31], [5107800, 'Santo Antônio de Leverger', 51], [2401206, 'Arez', 24], [2400208, 'Assú', 24], [1400605, 'São Luiz do Anauá', 14], [2802601, 'Graccho Cardoso', 28], [2611606, 'Recife', 26], [2609600, 'Olinda', 26]] as const)
  .map(([id, nome, u]) => ({ id, nome, microrregiao: { mesorregiao: { UF: ESTADOS.find(e => e.id === u)! } } }) as IbgeMunicipio);
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool; const cfg = storageConfig();
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedTerritory(pool, buildTerritory([...MUNICIPIOS, ...ALIAS_MUNS], ESTADOS, REGIOES), 202610)).status, 'PUBLISHED'); await seedCrimeDefs(pool); });
test.after(async () => { if (!skip) await ctx.drop(); });

const ES = CRIME_SOURCES.find(s => s.key === 'SESP-ES')!; const PE = CRIME_SOURCES.find(s => s.key === 'SDS-PE')!; const MG = CRIME_SOURCES.find(s => s.key === 'SEJUSP-MG')!;
const VIX = 3205309, REC = 2611606, OLI = 2609600;
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const vals = async (slot: number) => hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id = ANY(ARRAY[${crimeIdsOf(slot).join(',') || 0}]::smallint[])`);
const idOf = (slot: number, c: string) => ALL_CRIME_DEFS.find(d => d.slot === slot && d.code === c)!.id;
const loaded = (recs: CrimeRecord[], o: Partial<CrimeLoaded> = {}): CrimeLoaded => ({ files: [{ relPath: 'x', sha256: 'h1' }], records: recs, months: new Set(recs.map(r => r.ym)), explicitZeros: false, duplicates: 'sum', notes: {}, ...o });
const pub = (src: typeof ES, l: CrimeLoaded, o: { failAfterApply?: boolean } = {}) => publishCrimeSource(pool, cfg, src, l, { today: new Date('2026-10-23T00:00:00Z'), ...o });
const cell = async (i: number, e: number) => (await pool.query(`SELECT value, flags, period_start::text p FROM civica_exec.exec_ind_value WHERE indicator_id = $1 AND entity_id = $2 ORDER BY period_start`, [i, e])).rows;

test('migração v8 e catálogo: ids por fonte em faixa própria, sem colisão, composto declarado e idempotência', async () => {
  assert.deepEqual(await applyExecMigrations(pool), []); assert.ok((await pool.query(`SELECT version FROM civica_exec.schema_migrations`)).rows.some(r => r.version === 8));
  const ids = ALL_CRIME_DEFS.map(d => d.id); assert.equal(new Set(ids).size, ids.length);
  for (const d of ALL_CRIME_DEFS) {
    const base = 8000 + d.slot * 100; assert.ok(d.id > base && d.id < base + 100);
    for (const c of d.composite ?? []) assert.ok(ALL_CRIME_DEFS.some(x => x.slot === d.slot && x.code === c), `${d.code}: componente ${c} inexistente`);
    if (d.composite) assert.equal(d.comparability, 'NOT_COMPARABLE');
  }
  const other = await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 8000`); const n = await seedCrimeDefs(pool); assert.equal(await seedCrimeDefs(pool), n); assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 8000`), other);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name = 'exec_crime_indicator'`)).rows.map(r => r.column_name);
  for (const bad of ['cpf', 'nome', 'endereco', 'address', 'latitude', 'longitude', 'sexo', 'idade']) assert.ok(!cols.includes(bad));
});

test('adaptadores: descoberta de links, aliases, truncamento de meses futuros e códigos', () => {
  assert.deepEqual(discoverPeFiles('<a href="/images/indicadores/CVP/MICRODADOS_DE_CVLI_JAN_2004_A_SETEMBRO_2026.xlsx">x</a><a href="/a/Microdados_de_CVP_-_Dispon%C3%ADvel.xlsx">y</a>').map(x => x.kind), ['cvli', 'cvp']);
  assert.equal(PE_ALIASES.ITAMARACA, 'Ilha de Itamaracá');
  assert.equal(discoverCeFiles('<a href="https://x/CVLI_Setembro.xlsx">a</a><a href="https://x/CVP_Setembro.xlsx">b</a><a href="https://x/Crime-ou-Preconceito_2026.xlsx">c</a>').size, 2);
  assert.equal(mgCode('HOMICÍDIO CONSUMADO (REGISTROS)'), 'HOMICIDIO_CONSUMADO_REGISTROS'); assert.equal(mgCode('Homicídio Consumado (Vitimas)'), 'HOMICIDIO_CONSUMADO_VITIMAS');
  const t = truncateFutureZeros([{ ym: 202601, value: 0 }, { ym: 202602, value: 3 }, { ym: 202603, value: 0 }, { ym: 202604, value: 0 }]);
  assert.equal(t.lastMonth, 202602); assert.deepEqual(t.kept.map(r => r.ym), [202601, 202602]); assert.equal(t.dropped, 2);   // zero de mês fechado fica; zeros depois do último dado saem
  assert.equal(truncateFutureZeros([{ ym: 202601, value: 0 }]).kept.length, 0);
  assert.deepEqual(spYearFiles({ data: [{ nome: 'Dados criminais', lista: [{ periodo: '2025', arquivo: 'assets/a_2025.xlsx' }, { periodo: 'Dados a partir de 2013', arquivo: 'x' }] }, { nome: 'Dados de Produtividade', lista: [{ periodo: '2024', arquivo: 'p' }] }] }), [{ year: 2025, url: 'https://www.ssp.sp.gov.br/assets/a_2025.xlsx' }]);
  assert.throws(() => spYearFiles({ data: [] }));
});

test('fonte de eventos (ES): sem zero inventado, município fora do IBGE vai ao ignorado, Σ = UF, rollback por falha injetada e NO_CHANGE', async () => {
  const def = ALL_CRIME_DEFS.find(d => d.slot === ES.slot)!; const k = def.code;
  const recs: CrimeRecord[] = [{ ym: 202501, ibge7: VIX, code: k, value: 5 }, { ym: 202501, name: 'Vila Velha', code: k, value: 7 }, { ym: 202501, name: 'LUGAR NENHUM', code: k, value: 2 }, { ym: 202502, ibge7: VIX, code: k, value: 0 }];
  const before = await vals(ES.slot); assert.equal(await pub(ES, loaded(recs), { failAfterApply: true }).then(() => 'ok', () => 'fail'), 'fail'); assert.equal(await vals(ES.slot), before);   // rollback exato
  assert.equal((await pub(ES, loaded(recs)))[0]!.status, 'PUBLISHED');
  assert.ok(!(await cell(def.id, VIX)).some(x => x.p.startsWith('2025-02')), 'zero de fonte de eventos não é publicado');
  const uf = (await cell(def.id, ES.ufCode)).find(x => x.p.startsWith('2025-01'))!; assert.equal(uf.value, 14);
  const sum = (await pool.query(`SELECT sum(v.value) s FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE v.indicator_id = $1 AND e.uf_code = $2 AND e.kind IN (4, 5) AND v.period_start = '2025-01-01'`, [def.id, ES.ufCode])).rows[0].s; assert.equal(Number(sum), 14);
  const h = await vals(ES.slot); assert.equal((await pub(ES, loaded(recs)))[0]!.status, 'NO_CHANGE'); assert.equal(await vals(ES.slot), h);
});

test('derivado de microdado (PE): células sensíveis pequenas são suprimidas (NULL + flag), a UF mantém o total, categoria não sensível fica', async () => {
  const fem = idOf(PE.slot, 'FEMINICIDIO'), hom = idOf(PE.slot, 'HOMICIDIO');
  await pub(PE, loaded([{ ym: 202401, ibge7: REC, code: 'FEMINICIDIO', value: 2 }, { ym: 202401, ibge7: OLI, code: 'FEMINICIDIO', value: 4 }, { ym: 202401, ibge7: REC, code: 'HOMICIDIO', value: 2 }], { suppressBelow: 3 }));
  const a = (await cell(fem, REC))[0]!; assert.equal(a.value, null); assert.ok((Number(a.flags) & 8) !== 0);
  assert.equal((await cell(fem, OLI))[0]!.value, 4); assert.equal((await cell(hom, REC))[0]!.value, 2); assert.equal((await cell(fem, PE.ufCode))[0]!.value, 6);
});

test('fonte com grade completa (MG): zero declarado de mês fechado publica, mês futuro não; a leitura nunca mistura fontes nem vira ausência em zero', async () => {
  const k = 'HOMICIDIO_CONSUMADO_VITIMAS'; const hom = idOf(MG.slot, k);
  const kept = truncateFutureZeros([{ ym: 202301, name: 'ZZ', code: k, value: 0 }, { ym: 202302, name: 'ZZ', code: k, value: 4 }, { ym: 202303, name: 'ZZ', code: k, value: 0 }] as Array<CrimeRecord & { value: number }>).kept;
  await pub(MG, loaded(kept, { explicitZeros: true, duplicates: 'error' }));
  const ufRows = await cell(hom, MG.ufCode); assert.deepEqual(ufRows.map(x => x.p.slice(0, 7)), ['2023-01', '2023-02']); assert.equal(ufRows[0]!.value, 0);
  const p = await getStateCrimeState(pool, MG.ufCode); assert.equal(p.source!.key, 'SEJUSP-MG'); assert.ok(p.restrictions.length >= 5); assert.equal(p.coverage.last, '2023-02');
  const m = await getStateCrimeMunicipality(pool, VIX); assert.equal(m.source!.key, 'SESP-ES'); assert.ok(m.series.every(x => CRIME_DEF_BY_ID.get(x.indicatorId)!.slot === ES.slot));
  const none = await getStateCrimeState(pool, 99); assert.equal(none.series.length, 0); assert.equal(none.source, null);
});
