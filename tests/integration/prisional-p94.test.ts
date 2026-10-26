import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, PRI_DEFS, PRI_MEASURES, applyExecMigrations, buildPriNational, buildPriSlice, checkCycle, getPrisonMunicipality, getPrisonNational, getPrisonState, resolveIdentities, rollbackRun, seedPrisionalDefs, semesterOfRef,
  type PriCycleJson, type PriRow,
} from '../../packages/db/src/exec/index.ts';
import { loadEntities } from '../../apps/collector/src/exec/efetivos.ts';
import { publishPriNational, publishPriUfSlice, type PriLoaded } from '../../apps/collector/src/exec/prisional.ts';
import { loadEntityDir } from '../../apps/collector/src/exec/seguranca.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); });
test.after(async () => { if (!skip) await ctx.drop(); });

const H = new Map(PRI_MEASURES.map(m => [m.code, m.header]));
const capCols = PRI_MEASURES.filter(m => m.block === '1.3 capacidade').map(m => m.header), popCols = PRI_MEASURES.filter(m => m.block === '4.1 população').map(m => m.header);
let n = 0;
function row(o: { nome: string; uf?: string; ibge?: string; cep?: string; tipo?: string; ambito?: string; capM?: number | null; capF?: number | null; popT?: number | null; sexo?: string }): PriRow {
  const cap: Record<string, number | null> = Object.fromEntries(capCols.map(c => [c, null])), pop: Record<string, number | null> = Object.fromEntries(popCols.map(c => [c, null]));
  cap[H.get('cap.total.M')!] = o.capM === undefined ? 100 : o.capM; cap[H.get('cap.total.F')!] = o.capF === undefined ? null : o.capF; pop[H.get('pop.total')!] = o.popT === undefined ? 150 : o.popT; pop[H.get('pop.prov.T')!] = o.popT === undefined ? 150 : o.popT;
  return { row: ++n, ciclo: '', ano: '', ref: '', tipo: o.tipo ?? 'Cela física', preench: 'Validado', nome: o.nome, situacao: 'Ativo', outras: '', cep: o.cep ?? '29000000', ambito: o.ambito ?? 'Estadual', uf: o.uf ?? 'ES', municipio: 'x', ibge: o.ibge ?? '3205309', sexo: o.sexo ?? 'Masculino', tipo_orig: 'x', gestao: 'Pública', cap, pop };
}
const checked = (rows: PriRow[], ref: string) => checkCycle({ version: 'sisdepen-v1', head_cols: 1, cap_cols: capCols, pop_cols: popCols, rows: rows.map(r => ({ ...r, ref, ciclo: String(semesterOfRef(ref).cycle) })) } satisfies PriCycleJson, ref);
const loaded = (ch: ReturnType<typeof checked>, sha: string): PriLoaded => ({ checked: ch, file: { cycle: ch.semester.cycle, ref: ch.semester.ref, reused: false, entry: { url: 'x', relPath: `seguranca/prisional/${ch.semester.ref}.csv`, sha256: sha.repeat(64).slice(0, 64), bytes: 1, fetchedAt: '2026-10-21T00:00:00Z', sourceModifiedAt: null, competence: ch.semester.competence, uf: 0, retention: 1, dataset: 'x' } } });
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const state = async () => (await Promise.all([`SELECT * FROM civica_exec.exec_pri_unit`, `SELECT * FROM civica_exec.exec_pri_obs`, `SELECT * FROM civica_exec.exec_pri_fact`, `SELECT * FROM civica_exec.exec_pri_xwalk`, `SELECT * FROM civica_exec.exec_pri_cov`, `SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 6000 AND 6199`].map(hash))).join('|');
const id = (r: { status: string; runId?: number }) => r.status === 'PUBLISHED' ? r.runId! : 0;
const firstOf = async (ds: number, uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [ds, uf, comp])).rowCount === 0;
const val = async (ind: number, ent: number | string, start: string) => (await pool.query(`SELECT v.value, v.flags FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity x USING (entity_id) WHERE v.indicator_id = $1 AND ${typeof ent === 'number' ? 'x.ibge7 = $2::int' : "x.kind = 3 AND x.uf = $2::text"} AND v.period_start = $3`, [ind, ent, start])).rows[0] as { value: number | null; flags: number } | undefined;

test('migração v4: seis tabelas; idempotente; definições (indicadores + 71 medidas) sem tocar outros domínios', async () => {
  assert.deepEqual(await applyExecMigrations(pool), []); assert.deepEqual((await pool.query(`SELECT version FROM civica_exec.schema_migrations ORDER BY 1`)).rows.map(r => r.version), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const other = await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 6000`);
  assert.equal(await seedPrisionalDefs(pool), PRI_DEFS.length); assert.equal(await seedPrisionalDefs(pool), PRI_DEFS.length);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_pri_measure`)).rows[0].n, 71); assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 6000`), other);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name LIKE 'exec_pri_%' ORDER BY table_name, ordinal_position`)).rows.map(r => r.column_name);
  for (const bad of ['cep', 'address', 'endereco', 'telefone', 'phone', 'bairro', 'nome_custodiado', 'cpf']) assert.ok(!cols.includes(bad), `coluna proibida ${bad}`);
});

test('publicação por UF × ciclo: invariantes, NO_CHANGE, republicação com log, rollback exato, falha injetada, reconciliação que barra, Brasil = Σ UFs; 2 ciclos independentes', async () => {
  const ents = await loadEntities(pool); const { dir } = await loadEntityDir(pool);
  const A = (cap: number) => [row({ nome: 'PEN VITORIA', capM: cap, popT: 300 }), row({ nome: 'CDP VILA VELHA', ibge: '3205200', cep: '2', capM: 0, popT: 40 }), row({ nome: 'CASA SEM IBGE', ibge: '', cep: '3', capM: 60, popT: 90, sexo: 'Misto', capF: 10 }), row({ nome: 'NUCLEO MON', tipo: 'Domiciliar com monitoramento eletrônico', cep: '4', popT: 500 }), row({ nome: 'FEDERAL PORTO', ambito: 'Federal', ibge: '3205309', cep: '5', capM: 200, popT: 150 })];
  const SP = () => [row({ nome: 'CDP SP', uf: 'SP', ibge: '3550308', cep: '9', capM: 1000, popT: 1500 })];
  const mk = (ref: string, rowsES: PriRow[], rowsSP: PriRow[]) => checked([...rowsES, ...rowsSP], ref);
  const c1 = mk('2025/1', A(100), SP()); const c2 = mk('2025/2', A(100), SP());
  const resolved = resolveIdentities([c1, c2].map(c => ({ semester: c.semester, rows: c.rows })));
  const slice = (c: ReturnType<typeof checked>, uf: string, code: number, prev = new Set<number>()) => buildPriSlice(c, { ufAcronym: uf, ufCode: code, ufEntity: ents.ufEntityByCode.get(code)!, dir, resolved, prevUnits: prev });
  const pubUf = async (c: ReturnType<typeof checked>, sha: string, uf: string, code: number, s: ReturnType<typeof slice>, o: { fail?: boolean } = {}) => publishPriUfSlice(pool, { loaded: loaded(c, sha), ufAcronym: uf, ufCode: code, slice: s, fingerprint: sha.repeat(64).slice(0, 64), first: await firstOf(DATASET.pri_uf, code, c.semester.competence), ...(o.fail ? { failAfterApply: true } : {}) });
  const s1es = slice(c1, 'ES', 32), s1sp = slice(c1, 'SP', 35);
  assert.equal((await pubUf(c1, 'a', 'ES', 32, s1es)).status, 'PUBLISHED'); assert.equal((await pubUf(c1, 'a', 'SP', 35, s1sp)).status, 'PUBLISHED');
  assert.equal((await val(6003, 'ES', '2025-01-01'))!.value, 300 + 40 + 90, 'população em celas físicas estaduais (sem domiciliar e sem federal)'); assert.equal((await val(6103, 'ES', '2025-01-01'))!.value, 150);
  assert.equal((await val(6003, 3205309, '2025-01-01'))!.value, 300, 'município: só Vitória'); assert.equal((await val(6041, 'ES', '2025-01-01'))!.value, 500);
  const occ = (await val(6004, 'ES', '2025-01-01'))!; assert.ok(Math.abs(occ.value! - 390 / 170 * 100) < 1e-9, 'unidade sem capacidade (CDP VV) fora do denominador, unidade mista elegível'); assert.ok((occ.flags & 4) !== 0);
  assert.equal((await pool.query(`SELECT cap_incomplete, unassigned_mun, cela, federal FROM civica_exec.exec_pri_cov WHERE uf = 32`)).rows[0].unassigned_mun, 1);
  const brRows = buildPriNational([s1es.agg, s1sp.agg, ...[] ], ents.brEntity, c1.semester); assert.equal((await publishPriNational(pool, { loaded: loaded(c1, 'a'), rows: brRows, fingerprint: 'b'.repeat(64), first: await firstOf(DATASET.pri_br, 0, c1.semester.competence) })).status, 'PUBLISHED');
  const br = await pool.query(`SELECT value FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 1 AND v.indicator_id = 6003`); assert.equal(br.rows[0].value, 430 + 1500, 'Brasil = ES + SP');
  assert.equal((await pubUf(c1, 'a', 'ES', 32, s1es)).status, 'NO_CHANGE');
  // ciclo 2 é independente
  assert.equal((await pubUf(c2, 'c', 'ES', 32, slice(c2, 'ES', 32, resolved.seen.get(c1.semester.competence)!))).status, 'PUBLISHED'); assert.equal((await val(6003, 'ES', '2025-07-01'))!.value, 430); assert.equal((await val(6003, 'ES', '2025-01-01'))!.value, 430);
  const before = await state();
  // retificação do ciclo 2 com capacidade maior
  const c2b = mk('2025/2', A(400), SP()); const resolvedB = resolveIdentities([c1, c2b].map(c => ({ semester: c.semester, rows: c.rows })));
  const s2b = buildPriSlice(c2b, { ufAcronym: 'ES', ufCode: 32, ufEntity: ents.ufEntityByCode.get(32)!, dir, resolved: resolvedB, prevUnits: new Set() });
  const r = await pubUf(c2b, 'd', 'ES', 32, s2b); assert.equal(r.status, 'PUBLISHED'); assert.equal((await val(6002, 'ES', '2025-07-01'))!.value, 400 + 0 + 70);
  const rb = await rollbackRun(pool, id(r)); assert.equal(rb.status, 'ROLLED_BACK', JSON.stringify(rb)); assert.equal(await state(), before, 'rollback exato (unidades, observações, fatos, crosswalk, cobertura e indicadores)');
  await assert.rejects(pubUf(c2b, 'e', 'ES', 32, s2b, { fail: true }), /falha injetada/); assert.equal(await state(), before);
  const bad = { ...s2b, indicators: s2b.indicators.map(x => x.indicator_id === 6003 && x.entity_id === ents.ufEntityByCode.get(32) ? { ...x, value: 1, numerator: 1 } : x) };
  await assert.rejects(pubUf(c2b, 'f', 'ES', 32, bad), /reconciliação prisional/); assert.equal(await state(), before);
  const badBr = buildPriNational([s1es.agg, s1sp.agg], ents.brEntity, c1.semester).map(x => x.indicator_id === 6003 ? { ...x, value: 5 } : x);
  await assert.rejects(publishPriNational(pool, { loaded: loaded(c1, 'a'), rows: badBr, fingerprint: 'g'.repeat(64), first: false }), /reconciliação prisional Brasil/); assert.equal(await state(), before);
});

test('contratos de leitura: UF (série, cobertura sem universo esperado), município (unidades, ocupação por unidade, histórico) e Brasil; no máximo 4 consultas', async () => {
  let k = 0; const counting = { query: (...a: Parameters<Pool['query']>) => { k++; return (pool.query as (...x: unknown[]) => unknown)(...a as unknown[]); } } as unknown as Pool;
  k = 0; const es = await getPrisonState(counting, 32); assert.ok(es && k <= 4, `consultas UF ${k}`); assert.equal(es!.latestRef, '2025/2');
  const pop = es!.series.find(s => s.code === 'IND-PRI-E-POP')!; assert.deepEqual(pop.points.map(p => p.ref), ['2025/1', '2025/2']); assert.ok(es!.coverage.every(c => c.expectedUniverse === null)); assert.ok(es!.restrictions.length >= 6);
  assert.ok(es!.series.find(s => s.code === 'IND-PRI-E-OCC')!.note.includes('nunca média'));
  k = 0; const vit = await getPrisonMunicipality(counting, 3205309); assert.ok(vit && k <= 5, `consultas município ${k}`); const pen = vit!.units.find(u => u.name === 'PEN VITORIA')!;
  assert.equal(pen.latest.population, 300); assert.equal(pen.latest.capacity, 100); assert.equal(pen.latest.occupancyPct, 300); assert.equal(pen.latest.excess, 200); assert.equal(pen.observedCycles, 2); assert.equal(pen.history.length, 2);
  const dom = vit!.units.find(u => u.name === 'NUCLEO MON')!; assert.equal(dom.tipo, 'domiciliar_com_monitoramento'); assert.equal(dom.latest.occupancyPct, null); assert.equal(dom.latest.capacityStatus, 'not_applicable_domiciliary');
  const fed = vit!.units.find(u => u.name === 'FEDERAL PORTO')!; assert.equal(fed.ambito, 'federal'); assert.match(vit!.stateContext.notice, /não são deste município/);
  const vv = await getPrisonMunicipality(counting, 3205200); assert.equal(vv!.units[0]!.latest.capacityStatus, 'zero'); assert.equal(vv!.units[0]!.latest.occupancyPct, null, 'capacidade zero: sem divisão');
  assert.equal((await getPrisonMunicipality(counting, 3200359))!.units.length, 0, 'município sem estabelecimento: lista vazia (≠ comprovadamente sem unidade)');
  assert.equal(await getPrisonMunicipality(counting, 9999999), null); assert.equal(await getPrisonState(counting, 99), null);
  k = 0; const br = await getPrisonNational(counting); assert.ok(br && k <= 4); assert.equal(br!.coverage[0]!.ufsParticipating, 2);
});
