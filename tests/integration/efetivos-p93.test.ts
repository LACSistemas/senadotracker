import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, EFE_DEFS, IBGE_EDITIONS, applyExecMigrations, buildEstadic, buildFbsp, buildMunic, buildSiape, getSecurityStaffingNational, getSecurityStaffingState, getSecurityStructureMunicipality, rollbackRun, seedEfetivosDefs,
  seedSegurancaDefs, seedTransitoDefs, type FbspJson, type IbgeJson, type SiapeJson,
} from '../../packages/db/src/exec/index.ts';
import { loadEntities, publishEstadicSlice, publishFbspSlice, publishMunicSlice, publishSiapeSlice, type EfeFile } from '../../apps/collector/src/exec/efetivos.ts';
import { loadEntityDir, loadPopulation } from '../../apps/collector/src/exec/seguranca.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

// Exigem PostgreSQL DESCARTÁVEL (EXEC_TEST_ADMIN_URL); sem ele são pulados — nunca rodam contra o banco do Cívica.
const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
const fbspFix = JSON.parse(readFileSync(new URL('../fixtures/exec/fbsp_raiox_tabelas.json', import.meta.url), 'utf8')) as FbspJson;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
const ES = 32, VIT = 3205309, VV = 3205200, ARN = 3200359;
const UF_CODES: Record<string, number> = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 };
test.before(async () => {
  if (skip) return;
  ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED');
  await seedSegurancaDefs(pool); await seedTransitoDefs(pool);
  await pool.query(`INSERT INTO civica_exec.exec_territory_population (entity_id, year, source, value) SELECT entity_id, 2025, 1, 1000000 FROM civica_exec.exec_entity WHERE kind = 3`);
});
test.after(async () => { if (!skip) await ctx.drop(); });

const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const efeState = () => hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5000 AND 5399`);
const latestState = () => hash(`SELECT indicator_id, entity_id, period_start, status, value, numerator, denominator, flags, run_id FROM civica_exec.exec_ind_latest WHERE indicator_id BETWEEN 5000 AND 5399`);
const otherState = () => hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id < 5000`);
const firstOf = async (ds: number, uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [ds, uf, comp])).rowCount === 0;
const file = (key: EfeFile['key'], sha: string): EfeFile => ({ key, reused: false, entry: { url: 'https://x', relPath: `seguranca/efetivos/${key}/x`, sha256: sha.repeat(64).slice(0, 64), bytes: 1, fetchedAt: '2026-10-21T00:00:00Z', sourceModifiedAt: null, competence: 202301, uf: 0, retention: 1, dataset: 'x' } });
const id = (r: { status: string; runId?: number }) => r.status === 'PUBLISHED' ? r.runId! : 0;
const val = async (ind: number, e: number | string, start?: string) => (await pool.query(`SELECT v.value, v.flags FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity x USING (entity_id) WHERE v.indicator_id = $1 AND ${typeof e === 'number' ? 'x.ibge7 = $2::int' : 'x.kind = 3 AND x.uf = $2::text'} ${start ? `AND v.period_start = '${start}'` : ''}`, [ind, e])).rows[0] as { value: number | null; flags: number } | undefined;

test('sem migração: as tabelas do modelo D bastam (versões 1–3 inalteradas); 62 definições, idempotentes, sem tocar indicadores anteriores', async () => {
  const before = await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 5000`);
  assert.deepEqual(await applyExecMigrations(pool), []); assert.deepEqual((await pool.query(`SELECT version FROM civica_exec.schema_migrations ORDER BY 1`)).rows.map(r => r.version), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(await seedEfetivosDefs(pool), EFE_DEFS.length); assert.equal(await seedEfetivosDefs(pool), EFE_DEFS.length);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_def WHERE indicator_id BETWEEN 5000 AND 5399`)).rows[0].n, 62);
  assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 5000`), before);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_def WHERE indicator_id BETWEEN 5000 AND 5399 AND domain <> 3`)).rows[0].n, 0);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_def WHERE indicator_id BETWEEN 5300 AND 5399 AND grain <> 'M'`)).rows[0].n, 0, 'SIAPE é mensal');
});

const bump = (j: FbspJson, uf: string, d: number): FbspJson => {
  const c = clone(j); for (const k of [uf, 'BR']) { c.tables.T2.rows[k]!.cells.PM!.v! += d; c.tables.T2.rows[k]!.cells.TOTAL!.v! += d; c.tables.T3.rows[k]!.cells.EXISTENTE!.v! += d;
    const cell = c.tables.T3.rows[k]!.cells; cell.RELACAO_PCT!.v = Math.round(cell.EXISTENTE!.v! / cell.PREVISTO!.v! * 1000) / 10; }
  return c;
};
test('FBSP: bootstrap, NO_CHANGE, republicação com log só das linhas alteradas, rollback exato, falha injetada e reconciliação que barra', async () => {
  const ents = await loadEntities(pool); const pop = await loadPopulation(pool, 2025);
  const mk = (j: FbspJson) => buildFbsp(j, { ufEntityBySigla: ents.ufEntityBySigla, brEntity: ents.brEntity, popByEntity: pop });
  const pub = async (b: ReturnType<typeof mk>, sha: string, o: { fail?: boolean } = {}) => publishFbspSlice(pool, { file: file('fbsp', sha), built: b, first: await firstOf(DATASET.efe_fbsp, 0, 202501), ...(o.fail ? { failAfterApply: true } : {}) });
  const other = await otherState(); const b1 = mk(fbspFix);
  const r1 = await pub(b1, 'a'); assert.equal(r1.status, 'PUBLISHED');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5001 AND 5034`)).rows[0].n, b1.rows.length);
  assert.equal((await val(5001, 76))!.value, 413319); assert.equal((await val(5001, 'SP'))!.value, 82250); assert.equal((await val(5002, 'SP'))!.value, null); assert.equal((await val(5010, 'AC'))!.value, 0);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1`, [id(r1)])).rows[0].n, 0, 'bootstrap não gera change log');
  assert.equal((await pub(b1, 'a')).status, 'NO_CHANGE');
  const before = await efeState(); const beforeLatest = await latestState();
  const r2 = await pub(mk(bump(fbspFix, 'MG', 10)), 'b'); assert.equal(r2.status, 'PUBLISHED');
  assert.equal((await val(5001, 'MG'))!.value, 37271); assert.equal((await val(5001, 76))!.value, 413329);
  const log = (await pool.query(`SELECT op, count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1`, [id(r2)])).rows; assert.deepEqual(log, [{ op: 'U', n: log[0]!.n }]); assert.ok(log[0]!.n >= 4 && log[0]!.n <= 12, `só as linhas afetadas (${log[0]!.n})`);
  assert.equal((await rollbackRun(pool, id(r2))).status, 'ROLLED_BACK'); assert.equal(await efeState(), before); assert.equal(await latestState(), beforeLatest);
  await assert.rejects(pub(mk(bump(fbspFix, 'BA', 5)), 'c', { fail: true }), /falha injetada/); assert.equal(await efeState(), before);
  const tampered = mk(fbspFix); const bad = { ...tampered, rows: tampered.rows.map(r => r.indicator_id === 5003 && r.entity_id === ents.ufEntityBySigla.get('BA') ? { ...r, value: 1, numerator: 1 } : r) };
  await assert.rejects(pub(bad, 'd'), /reconciliação FBSP/); assert.equal(await efeState(), before);
  assert.equal(await otherState(), other, 'indicadores de outros domínios intocados');
});

const estadicJson = (edition: 2019 | 2023, base = 100, patch: (rows: IbgeJson['rows']) => void = () => undefined): IbgeJson => {
  const y = edition === 2023 ? 2022 : 2018; const dic: IbgeJson['dictionary'] = {};
  const VARS = ['ESEG271', 'ESEG272', 'ESEG273', 'ESEG491', 'ESEG492', 'ESEG493', 'ESEG3011', 'ESEG3021', 'ESEG3031', 'ESEG5111', 'ESEG5114', 'ESEG5121', 'ESEG5124', 'ESEG5131', 'ESEG5134', 'ESEG50', 'ESEG082', 'ESEG081'];
  const lbl: Record<string, [string, string]> = { ESEG271: ['Homens', `Efetivo existente em 31 de dezembro de ${y}`], ESEG272: ['Mulheres', `Efetivo existente em 31 de dezembro de ${y}`], ESEG273: ['Total', `Efetivo existente em 31 de dezembro de ${y}`], ESEG491: ['Homens', `Efetivo existente em 31 de dezembro de ${y}`], ESEG492: ['Mulheres', `Efetivo existente em 31 de dezembro de ${y}`], ESEG493: ['Total', `Efetivo existente em 31 de dezembro de ${y}`],
    ESEG3031: ['Total', `Quantidade de unidades operacionais existentes em 31 de dezembro de ${y}`], ESEG5131: ['Total', `Quantidade de Unidades Policiais e/ou Delegacias existentes em 31 de dezembro de ${y}`], ESEG5134: ['Total', `Quantidade de Unidades Policiais e/ou Delegacias existentes em 31 de dezembro de ${y}`], ESEG50: ['A Perícia Oficial é vinculada a esta Polícia Civil', ''] };
  for (const v of VARS) dic[v] = { label: lbl[v]?.[0] ?? 'x', context: lbl[v]?.[1] ?? '' };
  const rows = Object.values(UF_CODES).filter(c => c > 0).map((c, i) => ({ ufCode: c, v: { ESEG271: base + i, ESEG272: 10, ESEG273: base + i + 10, ESEG491: 50 + i, ESEG492: 5, ESEG493: 55 + i, ESEG3011: 1, ESEG3021: 2, ESEG3031: 3 + i, ESEG5111: 1, ESEG5114: 1, ESEG5121: 1, ESEG5124: 1, ESEG5131: 7, ESEG5134: 4, ESEG50: 'Sim', ESEG082: 'Sim', ESEG081: 'Sim' } as Record<string, number | string> }));
  patch(rows); return { version: 'ibge-perfil-seg-v2', mode: 'estadic', edition, sheet: 'x', columns: 1, rows, dictionary: dic, missingOptional: [] };
};
test('ESTADIC: edições 2019 e 2023 coexistem em janelas disjuntas; recusa de RO é estado; republicar uma não toca a outra; rollback exato', async () => {
  const ents = await loadEntities(pool);
  const mk = (j: IbgeJson, ed: 'estadic2019' | 'estadic2023') => buildEstadic(j, { ufEntityByCode: ents.ufEntityByCode, edition: IBGE_EDITIONS[ed] });
  const pub = async (b: ReturnType<typeof mk>, ed: 'estadic2019' | 'estadic2023', sha: string, o: { fail?: boolean } = {}) => publishEstadicSlice(pool, { file: file(ed, sha), edition: IBGE_EDITIONS[ed], built: b, first: await firstOf(DATASET.efe_estadic, 0, IBGE_EDITIONS[ed].competence), ...(o.fail ? { failAfterApply: true } : {}) });
  const ro = (rows: IbgeJson['rows']) => { for (const k of Object.keys(rows[0]!.v)) rows[0]!.v[k] = 'Recusa'; };
  const a19 = mk(estadicJson(2019, 200), 'estadic2019'); const a23 = mk(estadicJson(2023, 100, ro), 'estadic2023');
  assert.equal((await pub(a19, 'estadic2019', '1')).status, 'PUBLISHED'); const s19 = await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5101 AND 5110 AND period_start = '2018-12-31'`);
  assert.equal((await pub(a23, 'estadic2023', '2')).status, 'PUBLISHED');
  assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5101 AND 5110 AND period_start = '2018-12-31'`), s19, 'publicar 2023 não altera 2019');
  const roRow = await val(5101, 'RO', '2022-12-31'); assert.equal(roRow!.value, null); assert.ok((roRow!.flags & 1024) !== 0); assert.equal((await val(5101, 'RO', '2018-12-31'))!.value, 200 + 10, 'RO respondeu em 2019');
  assert.equal((await pub(a23, 'estadic2023', '2')).status, 'NO_CHANGE');
  const before = await efeState(); const b2 = await pub(mk(estadicJson(2023, 150, ro), 'estadic2023'), 'estadic2023', '3'); assert.equal(b2.status, 'PUBLISHED');
  assert.equal((await val(5101, 'AC', '2022-12-31'))!.value, 150 + 1 + 10); assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5101 AND 5110 AND period_start = '2018-12-31'`), s19);
  assert.equal((await rollbackRun(pool, id(b2))).status, 'ROLLED_BACK'); assert.equal(await efeState(), before);
  await assert.rejects(pub(mk(estadicJson(2023, 999, ro), 'estadic2023'), 'estadic2023', '4', { fail: true }), /falha injetada/); assert.equal(await efeState(), before);
  const bad = { ...a23, sums: { ...a23.sums, 5101: 1 } }; await assert.rejects(pub(bad, 'estadic2023', '5'), /reconciliação ESTADIC/); assert.equal(await efeState(), before);
});

const mrow = (cod: number, v: Record<string, number | string>): IbgeJson['rows'][number] => ({ ufCode: ES, cod, v: { MSEG27: 'Não', MSEG281: '-', MSEG282: '-', MSEG283: '-', MSEG161: 'Sim', MSEG162: 'Não', MSEG163: 'Não', MSEG164: 'Não', MSEG165: 'Não', MSEG166: 'Não', MSEG167: 'Não', MSEG168: 'Não', MSEG169: 'Não', MSEG1610: 'Não', MSEG1611: '-', MSEG17: 'Não', MSEG18: 'Sim', MSEG19: 'Não', ...v } });
const municJson = (edition: 2019 | 2023, rows: IbgeJson['rows']): IbgeJson => {
  const dic: IbgeJson['dictionary'] = { MSEG27: { label: 'Guarda municipal - existência', context: '' }, MSEG281: { label: 'Homens', context: 'Efetivo em 31 de dezembro de 2022' }, MSEG282: { label: 'Mulheres', context: 'Efetivo em 31 de dezembro de 2022' }, MSEG283: { label: 'Total', context: 'Efetivo em 31 de dezembro de 2022' },
    MSEG161: { label: 'Delegacia de Polícia Civil', context: '' }, MSEG162: { label: 'Delegacia de Homicídios', context: '' }, MSEG163: { label: 'Delegacia de Proteção à Pessoa Idosa', context: '' }, MSEG164: { label: 'Delegacia de Proteção à Criança e ao Adolescente (DPCA)', context: '' }, MSEG165: { label: 'Delegacia da Criança e do Adolescente (DCA)', context: '' },
    MSEG166: { label: 'Delegacia da Criança e do Adolescente (especialidades não separadas)', context: '' }, MSEG167: { label: 'Delegacia de Proteção ao Meio Ambiente', context: '' }, MSEG168: { label: 'Delegacia especializada no Atendimento à Mulher', context: '' }, MSEG169: { label: 'Delegacia especializada em Pessoas Desaparecidas', context: '' },
    MSEG1610: { label: 'Delegacia de Repressão aos Crimes de Informática', context: '' }, MSEG1611: { label: 'Nenhuma das citadas', context: '' }, MSEG17: { label: 'Instituto Médico Legal', context: '' }, MSEG18: { label: 'Sede de Comarca', context: '' }, MSEG19: { label: 'Unidade do Corpo de Bombeiros', context: '' } };
  if (edition === 2019) { delete dic.MSEG1611; for (const k of ['MSEG281', 'MSEG282', 'MSEG283']) dic[k]!.context = 'Efetivo'; for (const r of rows) delete r.v.MSEG1611; }
  return { version: 'ibge-perfil-seg-v2', mode: 'munic', edition, sheet: 'x', columns: 1, rows, dictionary: dic, missingOptional: edition === 2019 ? ['MSEG1611'] : [] };
};
const sampleRows = (vit = 427): IbgeJson['rows'] => [mrow(VIT, { MSEG27: 'Sim', MSEG281: vit - 47, MSEG282: 47, MSEG283: vit, MSEG162: 'Sim' }), mrow(ARN, {}), mrow(VV, { MSEG27: 'Sim', MSEG281: 200, MSEG282: 86, MSEG283: 286, MSEG161: 'Não informou' })];
test('MUNIC: UF × edição; "-" sem linha; agregados da UF reconciliados; remoção no arquivo apaga a linha; rollback exato; 2019 e 2023 não se misturam', async () => {
  const { dir } = await loadEntityDir(pool); const ents = await loadEntities(pool); const ufEntity = ents.ufEntityByCode.get(ES)!;
  const mk = (j: IbgeJson, ed: 'munic2019' | 'munic2023') => buildMunic(j, { ufCode: ES, ufEntity, dir, edition: IBGE_EDITIONS[ed], expectRows: j.rows.length });
  const pub = async (b: ReturnType<typeof mk>, ed: 'munic2019' | 'munic2023', sha: string, o: { fail?: boolean } = {}) => publishMunicSlice(pool, { file: file(ed, sha), edition: IBGE_EDITIONS[ed], ufCode: ES, built: b, first: await firstOf(DATASET.efe_munic, ES, IBGE_EDITIONS[ed].competence), ...(o.fail ? { failAfterApply: true } : {}) });
  const b19 = mk(municJson(2019, [mrow(VIT, { MSEG27: 'Sim', MSEG283: 470, MSEG281: 400, MSEG282: 70 }), mrow(ARN, { MSEG27: 'Recusa', MSEG161: 'Recusa' }), mrow(VV, { MSEG27: 'Não' })]), 'munic2019');
  const m1 = mk(municJson(2023, sampleRows()), 'munic2023');
  assert.equal((await pub(b19, 'munic2019', '1')).status, 'PUBLISHED'); const s19 = await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5201 AND 5234 AND period_start >= '2019-01-01' AND period_start < '2020-01-01'`);
  assert.equal((await pub(m1, 'munic2023', '2')).status, 'PUBLISHED');
  assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5201 AND 5234 AND period_start >= '2019-01-01' AND period_start < '2020-01-01'`), s19, '2023 não altera 2019');
  assert.equal((await val(5202, VIT, '2022-12-31'))!.value, 427); assert.equal((await val(5201, ARN, '2023-01-01'))!.value, 0); assert.equal((await val(5202, ARN, '2022-12-31')), undefined, 'sem guarda: sem linha de efetivo');
  assert.equal((await val(5211, VV, '2023-01-01'))!.value, null); assert.ok(((await val(5211, VV, '2023-01-01'))!.flags & 512) !== 0); assert.ok(((await val(5201, ARN, '2019-01-01'))!.flags & 1024) !== 0, '2019: recusa');
  assert.equal((await val(5231, 'ES', '2023-01-01'))!.value, 2); assert.equal((await val(5232, 'ES', '2022-12-31'))!.value, 713); assert.equal((await val(5232, 'ES', '2019-01-01'))!.value, 470); assert.equal((await val(5233, 'ES', '2019-01-01'))!.value, 1);
  assert.equal((await pub(m1, 'munic2023', '2')).status, 'NO_CHANGE');
  const before = await efeState(); const beforeLatest = await latestState();
  const r2 = await pub(mk(municJson(2023, sampleRows(430).slice(0, 2)), 'munic2023'), 'munic2023', '3'); assert.equal(r2.status, 'PUBLISHED');
  assert.equal((await val(5202, VIT, '2022-12-31'))!.value, 430); assert.equal(await val(5201, VV, '2023-01-01'), undefined, 'município que saiu do arquivo some da fatia'); assert.equal((await val(5232, 'ES', '2022-12-31'))!.value, 430);
  const ops = (await pool.query(`SELECT op FROM civica_exec.exec_change_log WHERE run_id = $1 GROUP BY 1 ORDER BY 1`, [id(r2)])).rows.map(r => r.op); assert.deepEqual(ops, ['D', 'U']);
  assert.equal((await rollbackRun(pool, id(r2))).status, 'ROLLED_BACK'); assert.equal(await efeState(), before); assert.equal(await latestState(), beforeLatest);
  await assert.rejects(pub(mk(municJson(2023, sampleRows(999)), 'munic2023'), 'munic2023', '4', { fail: true }), /falha injetada/); assert.equal(await efeState(), before);
  const bad = { ...m1, stats: { ...m1.stats, comGuarda: 9 } }; await assert.rejects(pub(bad, 'munic2023', '5'), /reconciliação MUNIC ES/); assert.equal(await efeState(), before);
  assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5201 AND 5234 AND period_start >= '2019-01-01' AND period_start < '2020-01-01'`), s19);
});

const siape = (pf: number, prf: number, comp = 202608): SiapeJson => ({ version: 'siape-agg-v1', competence: comp, file_rows: 9, orgs: {
  '20115': { name: 'Departamento de Polícia Federal', rows: pf, distinct: 1, by_tipo: { Cargo: pf - 3, Função: 3 }, situacao: { Sigiloso: pf }, uf_sigiloso: pf, cargo_sigiloso: pf },
  '30802': { name: 'Departamento de Polícia Rodoviária Federal', rows: prf, distinct: 1, by_tipo: { Cargo: prf }, situacao: { Sigiloso: prf }, uf_sigiloso: prf, cargo_sigiloso: prf } } });
test('SIAPE: mês a mês no Brasil; republicar um mês não toca os outros; rollback exato; nada além de contagens agregadas é gravado', async () => {
  const ents = await loadEntities(pool);
  const pub = async (j: SiapeJson, sha: string, o: { fail?: boolean } = {}) => publishSiapeSlice(pool, { ym: j.competence, agg: { ...j, source: { url: 'https://x', sha256: sha.repeat(64).slice(0, 64), bytes: 1 } }, built: buildSiape(j, { brEntity: ents.brEntity }), first: await firstOf(DATASET.efe_siape, 0, j.competence), ...(o.fail ? { failAfterApply: true } : {}) });
  assert.equal((await pub(siape(17000, 14000, 202607), 'a')).status, 'PUBLISHED'); const aug = await pub(siape(17253, 14000), 'b'); assert.equal(aug.status, 'PUBLISHED');
  const jul = await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5301 AND 5304 AND period_start = '2026-07-01'`);
  assert.equal((await pub(siape(17253, 14000), 'b')).status, 'NO_CHANGE'); const before = await efeState();
  const r = await pub(siape(17300, 14010), 'c'); assert.equal(r.status, 'PUBLISHED'); assert.equal((await val(5301, 76, '2026-08-01'))!.value, 17300);
  assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5301 AND 5304 AND period_start = '2026-07-01'`), jul);
  assert.equal((await rollbackRun(pool, id(r))).status, 'ROLLED_BACK'); assert.equal(await efeState(), before);
  await assert.rejects(pub(siape(1, 1), 'd', { fail: true }), /falha injetada/); assert.equal(await efeState(), before);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name = 'exec_ind_value' ORDER BY ordinal_position`)).rows.map(x => x.column_name);
  assert.deepEqual(cols, ['indicator_id', 'entity_id', 'period_start', 'period_end', 'status', 'numerator', 'denominator', 'value', 'flags', 'run_id'], 'só colunas agregadas: nenhuma coluna pessoal');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 5301 AND 5304 AND entity_id <> $1`, [ents.brEntity])).rows[0].n, 0, 'SIAPE só no Brasil');
});

test('contratos de leitura: UF, município e Brasil — estados explícitos, fontes lado a lado, contexto estadual rotulado, no máximo 4 consultas por chamada', async () => {
  let n = 0; const counting = { query: (...a: Parameters<Pool['query']>) => { n++; return (pool.query as (...x: unknown[]) => unknown)(...a as unknown[]); } } as unknown as Pool;
  n = 0; const es = await getSecurityStaffingState(counting, ES); assert.ok(es); assert.ok(n <= 3, `consultas UF: ${n}`);
  assert.equal(es!.fbsp.existing.find(p => p.corporation === 'PM')!.value, 9231); assert.equal(es!.fbsp.plans.find(p => p.corporation === 'PM')!.occupancy!.value! > 81, true);
  assert.deepEqual(es!.estadic.map(e => e.edition), [2019, 2023]); assert.equal(es!.divergences.find(d => d.corporation === 'PM')!.comparable, false);
  assert.equal(es!.divergences.find(d => d.corporation === 'PM')!.estadic.length, 2); assert.ok(es!.restrictions.length >= 5); assert.ok(es!.sources.some(s => s.dataset === 'fbsp_raiox'));
  assert.deepEqual(es!.municipalGuards.editions.map(e => e.survey), ['2019-01-01', '2023-01-01']);
  const sp = await getSecurityStaffingState(counting, 35); assert.equal(sp!.fbsp.existing.find(p => p.corporation === 'CBM')!.status, 'included_in_other'); assert.ok(sp!.fbsp.existing.find(p => p.corporation === 'PM')!.flags.includes('composite'));
  const ro = await getSecurityStaffingState(counting, 11); assert.equal(ro!.estadic.find(e => e.edition === 2023)!.points.find(p => p.indicatorId === 5101)!.status, 'refused'); assert.equal(ro!.estadic.find(e => e.edition === 2019)!.points.find(p => p.indicatorId === 5101)!.status, 'reported');
  assert.equal(await getSecurityStaffingState(counting, 99), null);
  n = 0; const vit = await getSecurityStructureMunicipality(counting, VIT); assert.ok(n <= 4, `consultas município: ${n}`);
  assert.equal(vit!.editions.length, 2); const e23 = vit!.editions.find(e => e.survey === '2023-01-01')!; assert.equal(e23.guard.state, 'yes'); assert.equal(e23.guard.staff!.value, 427);
  assert.equal(e23.policeStation.state, 'yes'); assert.equal(e23.specializedStations.find(s => s.code === 'MSEG162')!.state, 'yes'); assert.equal(vit!.stateContext.pmFbsp!.value, 9231); assert.match(vit!.stateContext.notice, /não é o efetivo lotado/);
  assert.equal(vit!.rates.guardsPer100k, null);
  const arn = await getSecurityStructureMunicipality(counting, ARN); const a19 = arn!.editions.find(e => e.survey === '2019-01-01')!; assert.equal(a19.guard.state, 'refused'); assert.equal(a19.policeStation.state, 'refused'); assert.equal(a19.guard.staff, null);
  assert.equal(await getSecurityStructureMunicipality(counting, 9999999), null);
  n = 0; const br = await getSecurityStaffingNational(counting); assert.ok(n <= 3, `consultas Brasil: ${n}`); assert.equal(br!.fbsp.find(p => p.corporation === 'PF')!.value, 12536); assert.equal(br!.siape.find(s => s.code === 'PF')!.series.length, 2);
  assert.match(br!.siape[0]!.note, /Não é efetivo policial/);
});
