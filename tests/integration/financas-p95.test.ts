import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, COV, FIN_DCA_IDS, SPECS, applyExecMigrations, getSecurityFinanceMunicipality, getSecurityFinanceNational, getSecurityFinanceState, getSecurityFinanceUnion, publishSlice, rollbackRun, seedFinancasDefs, sha256,
  type FinEnteInput, type SiconfiItem,
} from '../../packages/db/src/exec/index.ts';
import { buildSliceFor, publishFinSlice, type FinLoaded } from '../../apps/collector/src/exec/financas.ts';
import { buildOrgs, execRows, dotRows, orgId, type FedExtract } from '../../apps/collector/src/exec/federal.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); });
test.after(async () => { if (!skip) await ctx.drop(); });

const VIX = 3205309, ARN = 3200359, VV = 3205200, ES = 32;
const dcaItem = (conta: string, coluna: string, valor: number): SiconfiItem => ({ exercicio: 2024, cod_ibge: VIX, anexo: 'DCA-Anexo I-E', coluna, cod_conta: 'TotalDespesas', conta, valor });
const COLS = ['Despesas Empenhadas', 'Despesas Liquidadas', 'Despesas Pagas', 'Inscrição de Restos a Pagar Não Processados', 'Inscrição de Restos a Pagar Processados'];
/** Ente com função 06 (4 subfunções + demais), função 10 e total coerentes. `f06` em reais (empenhada); os demais estágios são múltiplos. */
const ente = (f06: number, other = 9000): SiconfiItem[] => COLS.flatMap((c, i) => { const k = i + 1; const a = f06 * k;
  return [dcaItem('Despesas Exceto Intraorçamentárias', c, a + other * k), dcaItem('10 - Saúde', c, other * k), dcaItem('06 - Segurança Pública', c, a), dcaItem('06.122 - Administração Geral', c, a * 0.6), dcaItem('06.181 - Policiamento', c, a * 0.25), dcaItem('06.182 - Defesa Civil', c, a * 0.1), dcaItem('FU06 - Demais Subfunções', c, a * 0.05)]; });
const noSec = (): SiconfiItem[] => COLS.flatMap(c => [dcaItem('Despesas Exceto Intraorçamentárias', c, 500), dcaItem('10 - Saúde', c, 500)]);
const loaded = (entes: FinEnteInput[], o: { kind?: 'dca' | 'rreo'; year?: number; uf?: number; sha?: string; periodo?: number } = {}): FinLoaded => ({ kind: o.kind ?? 'dca', year: o.year ?? 2024, ufCode: o.uf ?? ES, relPath: `siconfi/x/${o.year ?? 2024}/uf${o.uf ?? ES}.jsonl.gz`, sha256: o.sha ?? 'aa', periodo: o.periodo ?? (o.kind === 'rreo' ? 6 : 0), entes, unmatched: [] });
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const state = async () => (await Promise.all([`SELECT * FROM civica_exec.exec_fin_fact`, `SELECT * FROM civica_exec.exec_fin_cov`, `SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id >= 7000`, `SELECT indicator_id, entity_id, period_start, status, value, numerator, denominator, flags, run_id FROM civica_exec.exec_ind_latest WHERE indicator_id >= 7000`].map(hash))).join('|');
const pop = new Map<number, number>([[VIX, 100000], [ES, 4000000]]);
const run = async (l: FinLoaded, p = pop, o: { first?: boolean; failAfterApply?: boolean } = {}) => publishFinSlice(pool, l, await buildSliceFor(pool, l, p), p, { first: o.first ?? false, ...(o.failAfterApply ? { failAfterApply: true } : {}) });
const id = (r: { status: string; runId?: number }) => r.status === 'PUBLISHED' ? r.runId! : 0;
const ind = async (i: number, e: number, y = 2024) => (await pool.query(`SELECT value, numerator, denominator, flags, status FROM civica_exec.exec_ind_value WHERE indicator_id = $1 AND entity_id = $2 AND period_start = make_date($3, 1, 1)`, [i, e, y])).rows[0];

test('migrações v5 e v6 aplicam, são idempotentes e as definições financeiras entram sem tocar os demais domínios', async () => {
  assert.deepEqual(await applyExecMigrations(pool), []); assert.deepEqual((await pool.query(`SELECT version FROM civica_exec.schema_migrations ORDER BY 1`)).rows.map(r => r.version), [1, 2, 3, 4, 5, 6, 7, 8]);
  const other = await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 7000`);
  const n = await seedFinancasDefs(pool); assert.equal(await seedFinancasDefs(pool), n); assert.equal(await hash(`SELECT * FROM civica_exec.exec_ind_def WHERE indicator_id < 7000`), other);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name IN ('exec_fin_cov', 'exec_fin_org', 'exec_fin_exec', 'exec_fin_dot', 'exec_fin_contract', 'exec_fin_supplier', 'exec_fin_transfer')`)).rows.map(r => r.column_name);
  for (const bad of ['cpf', 'address', 'endereco', 'cep', 'banco', 'agencia', 'conta_bancaria', 'objeto', 'telefone', 'nome_pf', 'ni_pf']) assert.ok(!cols.includes(bad), `coluna proibida ${bad}`);
});

test('DCA: publicação por UF × exercício com fatos exatos, cobertura, indicadores e verificação; NO_CHANGE; republicação com log; rollback exato; falha injetada', async () => {
  const entes = (f: number): FinEnteInput[] => [{ entityId: VIX, status: 200, items: ente(f) }, { entityId: ES, status: 200, items: ente(f * 30, 90000) }, { entityId: ARN, status: 200, items: [] }, { entityId: VV, status: 200, items: noSec() }];
  const r1 = await run(loaded(entes(1000)), pop, { first: true }); assert.equal(r1.status, 'PUBLISHED');
  assert.deepEqual((await pool.query(`SELECT entity_id, status, items, fn06 FROM civica_exec.exec_fin_cov ORDER BY entity_id`)).rows.map(r => [Number(r.entity_id), Number(r.status), Number(r.items) > 0, Number(r.fn06)]),
    [[ES, COV.PUBLISHED, true, 1], [ARN, COV.NOT_REPORTED, false, 0], [VV, COV.DECLARED_WITHOUT_FUNCTION, true, 0], [VIX, COV.PUBLISHED, true, 1]].sort((a, b) => Number(a[0]) - Number(b[0])));
  const f = await pool.query(`SELECT f.valor::text v FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code c ON c.ref_id = f.conta_id JOIN civica_exec.exec_ref_code k ON k.ref_id = f.coluna_id WHERE f.entity_id = $1 AND c.code = '06' AND k.code = 'EMP'`, [VIX]); assert.equal(f.rows[0].v, '100000');
  assert.equal((await ind(7001, VIX)).value, 1000); assert.equal((await ind(7003, VIX)).value, 3000); assert.equal((await ind(7034, VIX)).value, 300); assert.ok(!(await ind(7001, ARN)) && !(await ind(7001, VV)), 'sem 06 e sem declaração não têm linha');
  assert.equal((await ind(7032, VIX)).value, 0.03); assert.equal((await ind(7032, VIX)).denominator, 100000);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_latest WHERE indicator_id = 7001`)).rows[0].n, 2);
  const r1b = await run(loaded(entes(1000))); assert.equal(r1b.status, 'NO_CHANGE');
  const s1 = await state();
  // republicação: Vitória muda; Vila Velha some do arquivo (some também a cobertura e os fatos dentro da fatia)
  const changed = loaded([{ entityId: VIX, status: 200, items: ente(1100) }, { entityId: ES, status: 200, items: ente(30000, 90000) }, { entityId: ARN, status: 200, items: [] }], { sha: 'bb' });
  const r2 = await run(changed); assert.equal(r2.status, 'PUBLISHED'); assert.equal((await ind(7001, VIX)).value, 1100); assert.equal(Number((await pool.query(`SELECT count(*) FROM civica_exec.exec_fin_cov WHERE entity_id = $1`, [VV])).rows[0].count), 0);
  assert.ok((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log WHERE run_id = $1`, [id(r2)])).rows[0].n > 0, 'republicação registra change log');
  const rb = await rollbackRun(pool, id(r2)); assert.equal(rb.status, 'ROLLED_BACK', JSON.stringify(rb)); assert.equal(await state(), s1, 'rollback exato');
  // falha injetada depois de aplicar: nada fica
  await assert.rejects(run(loaded([{ entityId: VIX, status: 200, items: ente(7777) }], { sha: 'cc' }), pop, { failAfterApply: true }), /falha injetada/); assert.equal(await state(), s1);
});

test('reconciliação barra: indicador que não bate com o fato da função 06 cancela a publicação inteira', async () => {
  const l = loaded([{ entityId: VIX, status: 200, items: ente(500) }], { sha: 'dd', year: 2023 }); const slice = await buildSliceFor(pool, l, pop);
  const corrupt = { ...slice, indicators: slice.indicators.map(i => i.indicator_id === 7001 ? { ...i, numerator: 1, value: 1 } : i) };
  const before = await state(); await assert.rejects(publishFinSlice(pool, l, corrupt, pop, { first: true }), /reconciliação financeira/); assert.equal(await state(), before);
  assert.equal((await publishFinSlice(pool, l, slice, pop, { first: true })).status, 'PUBLISHED');
});

test('fatias disjuntas: RREO não é apagado por republicar a DCA da mesma UF e exercício; União isolada das UFs; acumulado do RREO não é somado', async () => {
  const rr = (conta: string, coluna: string, valor: number, cod = 'RREO2TotalDespesas'): SiconfiItem => ({ exercicio: 2024, cod_ibge: VIX, anexo: 'RREO-Anexo 02', coluna, cod_conta: cod, conta, valor });
  const cols: Array<[string, number]> = [['DOTAÇÃO INICIAL', 80], ['DOTAÇÃO ATUALIZADA (a)', 100], ['DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)', 90], ['DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)', 70]];
  const items = cols.flatMap(([c, k]) => [rr('DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)', c, k * 10), rr('Segurança Pública', c, k * 2), rr('Policiamento', c, k), rr('FU06 - Administração Geral', c, k), rr('Saúde', c, k * 8), rr('FU10 - Demais Subfunções', c, k * 8)]);
  const r = await run(loaded([{ entityId: VIX, status: 200, items }], { kind: 'rreo', sha: 'rr1' }), pop, { first: true }); assert.equal(r.status, 'PUBLISHED');
  assert.equal((await ind(7042, VIX)).value, 200); assert.equal((await ind(7045, VIX)).value, 90); assert.equal((await ind(7043, VIX)).status, 2);
  const rreoBefore = await hash(`SELECT f.* FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code k ON k.ref_id = f.coluna_id WHERE k.domain = 32`);
  const d = await run(loaded([{ entityId: VIX, status: 200, items: ente(1200) }, { entityId: ES, status: 200, items: ente(30000, 90000) }, { entityId: ARN, status: 200, items: [] }], { sha: 'ee' })); assert.equal(d.status, 'PUBLISHED');
  assert.equal(await hash(`SELECT f.* FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code k ON k.ref_id = f.coluna_id WHERE k.domain = 32`), rreoBefore, 'republicar a DCA não toca os fatos do RREO');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 7041 AND 7046`)).rows[0].n, 6, 'indicadores do RREO preservados');
  // União (escopo nacional): não toca UF
  const br = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0].entity_id as number;
  const ufState = await state();
  const ru = await run(loaded([{ entityId: br, status: 200, items: ente(15000000, 4000000000) }], { uf: 0, sha: 'br1' }), new Map(), { first: true }); assert.equal(ru.status, 'PUBLISHED');
  assert.equal((await ind(7001, br)).value, 15000000);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_fin_fact WHERE entity_id = $1`, [br])).rows[0].n > 0, true);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_fin_fact f JOIN civica_exec.exec_ref_code k ON k.ref_id = f.coluna_id WHERE f.entity_id = ANY($1::int[]) AND k.domain = 31`, [[VIX, ES]])).rows[0].n > 0, true);
  assert.notEqual(await state(), ufState); assert.equal((await ind(7001, VIX)).value, 1200, 'a fatia da União não altera as UFs');
  void SPECS; void DATASET; void FIN_DCA_IDS; void sha256; void getSecurityFinanceNational;
});

test('leitura: valor exato em centavos, estágio, cobertura, revisão, limitações; município com contexto ESTADUAL rotulado; variação nominal; per capita só com população do ano', async () => {
  // 2023 já publicado no teste de reconciliação; 2024 vigente
  await pool.query(`INSERT INTO civica_exec.exec_territory_population (entity_id, year, source, value) VALUES ($1, 2024, 1, 100000) ON CONFLICT DO NOTHING`, [VIX]);
  const m = await getSecurityFinanceMunicipality(pool, VIX); assert.ok(m); assert.equal(m.executor.kind, 'municipio'); assert.deepEqual(m.years.map(y => y.exercicio), [2023, 2024]);
  const y24 = m.years[1]!; const emp = y24.function06.empenhada!;
  assert.equal(emp.cents, '120000'); assert.equal(emp.currency, 'BRL'); assert.equal(emp.stage, 'empenhada'); assert.equal(emp.stageKind, 'execucao'); assert.equal(emp.period.kind, 'ANUAL'); assert.equal(emp.executor.entityId, VIX); assert.ok(emp.revision.runId! > 0); assert.match(emp.source, /DCA/);
  assert.equal(y24.function06.restosNaoProcessadosInscritos!.stageKind, 'restos_a_pagar_inscritos'); assert.notEqual(y24.function06.restosNaoProcessadosInscritos!.stage, y24.function06.paga!.stage);
  assert.equal(y24.nominalChange!.basis, 'NOMINAL_SEM_DEFLACAO'); assert.equal(y24.nominalChange!.empenhadaPercent, 140);   // R$ 1.200 contra R$ 500 em 2023
  assert.equal(m.years[0]!.nominalChange, null); assert.equal(y24.shareOfTotalEmpenhada!.numeratorCents, emp.cents);
  assert.deepEqual(m.perCapita.map(p => p.exercicio), [2024]); assert.equal(m.perCapita[0]!.paidPerInhabitant, 0.036);   // 3 × R$ 1.200 pagos / 100 mil hab.
  assert.ok(y24.subfunctions.find(s => s.code === '06.122')!.empenhada!.limitations.join(' ').match(/não é "gasto policial"/));
  assert.equal(m.budget[0]!.bimestre, 6); assert.equal(m.budget[0]!.preliminary, false); assert.equal(m.budget[0]!.execution.empenhadaSobreDotacaoAtualizada, 90);
  assert.equal(m.stateContext!.executor.kind, 'estado');
  assert.equal(m.organs.status, 'NOT_AVAILABLE'); assert.ok(m.restrictions.length >= 6 && m.restrictions.some(r => /não são rateados|não é rateado/.test(r)));
  assert.ok(m.coverage.some(c => c.source === 'DCA_I_E' && c.exercicio === 2024 && c.status === 'PUBLISHED') && m.coverage.some(c => c.source === 'RREO_02'));
  const st = await getSecurityFinanceState(pool, 32); assert.ok(st); assert.equal(st.executor.kind, 'estado');
  const arn = await getSecurityFinanceMunicipality(pool, ARN); assert.ok(arn); assert.deepEqual(arn.years, []); assert.equal(arn.coverage.find(c => c.exercicio === 2024)?.status, 'NOT_REPORTED');
  assert.equal(await getSecurityFinanceMunicipality(pool, 9999999), null);
});

test('federal: órgãos, execução mensal (fluxo), dotação anual e modalidade; leitura separa funcional × institucional e não funde totais', async () => {
  const br = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0].entity_id as number;
  const mk = (month: string, rows: Array<Array<string | number>>): FedExtract => ({ mode: 'exec', periods: [`2024/${month}`], rows_in: 1000, rows_kept: rows.length, rows, orgs: { sup: { '30000': 'Ministério da Justiça e Segurança Pública', '52000': 'Ministério da Defesa' }, sub: { '30108': ['Polícia Federal', '30000'], '52131': ['Comando da Marinha', '52000'] }, uo: { '30108': ['Polícia Federal', '30108'], '52931': ['Fundo Naval', '52131'] } }, ctrl: [] });
  // linha: [ym, uo, fn, sf, programa, acao, cat, grupo, mod, uf, emp, liq, pago, rpi, rpc, rpp]
  const jan = mk('01', [['2024/01', '30108', '06', '181', 5000, '2000', 3, 1, 90, 'DF', 1000, 900, 800, 0, 0, 0], ['2024/01', '30108', '04', '122', 5000, '2000', 3, 3, 90, 'DF', 300, 200, 100, 0, 0, 0], ['2024/01', '52931', '06', '181', 6012, '21A0', 4, 4, 30, 'ES', 50, 40, 30, 0, 0, 0]]);
  const feb = mk('02', [['2024/02', '30108', '06', '181', 5000, '2000', 3, 1, 90, 'DF', 700, 600, 500, 10, 5, 3]]);
  const orgs = buildOrgs(br, [{ year: 2024, x: jan }, { year: 2024, x: feb }]);
  assert.equal(orgs.find(o => o.org_id === orgId(2, '30108'))!.parent_id, orgId(1, '30000'));
  const rows = [...execRows(br, 2024, jan), ...execRows(br, 2024, feb)]; assert.equal(rows.length, 4); assert.equal(rows[0]!.uf_loc, 53); assert.equal(rows[2]!.uf_loc, 32);
  const dot = dotRows(br, 2024, { mode: 'dot', periods: ['2024'], rows_in: 3, rows_kept: 1, rows: [['2024', '30108', '06', '181', 5000, '2000', 3, 1, 10000, 12000, 9000, 8000]], orgs: jan.orgs, ctrl: [] });
  const r = await publishSlice(pool, { datasetId: DATASET.fin_fed_exec, uf: 0, competence: 202412, sourceHash: sha256('fed1'), bootstrap: true, tables: [{ spec: SPECS.fin_org, rows: orgs }, { spec: SPECS.fin_exec, rows }] }); assert.equal(r.status, 'PUBLISHED');
  const d = await publishSlice(pool, { datasetId: DATASET.fin_fed_dot, uf: 0, competence: 202412, sourceHash: sha256('dot1'), bootstrap: true, tables: [{ spec: SPECS.fin_org, rows: orgs }, { spec: SPECS.fin_dot, rows: dot }] }); assert.equal(d.status, 'PUBLISHED');
  assert.equal((await publishSlice(pool, { datasetId: DATASET.fin_fed_exec, uf: 0, competence: 202412, sourceHash: sha256('fed1'), tables: [{ spec: SPECS.fin_org, rows: orgs }, { spec: SPECS.fin_exec, rows }] })).status, 'NO_CHANGE');
  const u = await getSecurityFinanceUnion(pool); const y = u.years.find(x => x.exercicio === 2024)!; assert.equal(y.months, 2); assert.equal(y.preliminary, true);
  const pf = y.function06ByOrgan.find(o => o.code === '30108')!; assert.equal(pf.empenhada, '1700'); assert.equal(pf.paga, '1300'); assert.equal(pf.restosInscritos, '10'); assert.equal(pf.superiorCode, '30000');
  assert.equal(y.function06ByOrgan.find(o => o.code === '52131')!.superiorCode, '52000', 'função 06 executada por órgão fora do MJSP aparece na perspectiva funcional');
  assert.deepEqual(y.mjspByFunction.map(f => [f.funcao, f.empenhada]), [[4, '300'], [6, '1700']], 'perspectiva institucional (MJSP) inclui função 04 e NÃO inclui o órgão da Defesa');
  assert.equal(y.function06ByNature.find(n => n.grupo === 4)!.paga, '30'); assert.equal(y.budget!.dotacaoAtualizada, '12000');
  // ERRATA P9.5: execução de ENTES ESTADUAIS/MUNICIPAIS também é função 06 em exec_fin_exec; a visão federal nunca pode somá-la.
  await pool.query(`INSERT INTO civica_exec.exec_fin_exec (entity_id, exercicio, mes, org_id, funcao, subfuncao, programa, acao, categoria, grupo, modalidade, uf_loc, emp, liq, pago, rp_insc, rp_canc, rp_pago)
    VALUES (32, 2024, 1, 1900000001, 6, 181, 1, 'X', 3, 1, 90, 32, 999999, 999999, 999999, 0, 0, 0), (32, 2023, 5, 1900000001, 6, 181, 1, 'X', 3, 1, 90, 32, 5, 5, 5, 0, 0, 0)`);
  const u2 = await getSecurityFinanceUnion(pool); assert.deepEqual(u2.years.map(y => y.exercicio), [2024], 'exercício que só existe no estado não vira exercício federal'); const y2 = u2.years[0]!;
  assert.equal(y2.months, 2); assert.equal(y2.function06ByNature.reduce((s, n) => s + BigInt(n.empenhada), 0n), 1750n, 'natureza federal não inclui o estado'); assert.equal(y2.budget!.dotacaoAtualizada, '12000');
  const nat = await getSecurityFinanceNational(pool); assert.ok(nat); assert.equal(nat.organs.status, 'AVAILABLE');
});
