import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, FIN_VERSION, SPECS, buildContract, contractIndicators, getSecurityFinanceOrgans, publishSlice, replaceIndicatorsBulk, rollbackRun, seedFinancasDefs, sha256, transferIndicators,
  type ContractCtx, type PncpContract, type Row,
} from '../../packages/db/src/exec/index.ts';
import { publishContractSlice } from '../../apps/collector/src/exec/contratos.ts';
import { buildRsAll, orgIdMun } from '../../apps/collector/src/exec/tcers.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

/** Ondas D–F da P9.5: contratos do PNCP, transferências do MJSP e execução municipal do TCE-RS. */
const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx0: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx0 = await createTestDb(); pool = ctx0.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); await seedFinancasDefs(pool); });
test.after(async () => { if (!skip) await ctx0.drop(); });
const VIX = 3205309, VV = 3205200;
const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const q = async (sql: string, a: unknown[] = []) => (await pool.query(sql, a)).rows;
const id = (r: { status: string; runId?: number }) => r.status === 'PUBLISHED' ? r.runId! : 0;

test('contratos do PNCP: fatia UF × ano com fornecedor PJ, indicadores, ausência ≠ zero; NO_CHANGE; contrato some → some; rollback exato; PF nunca persistida; sem classificação barra', { skip }, async () => {
  const ctx: ContractCtx = { ufCode: a => (a === 'ES' ? 32 : undefined), entityByIbge7: new Map([[VIX, VIX]]), entityByUf: new Map([[32, 32]]), brEntity: 76 };
  const mk = (idc: string, org: string, obj: string, valor: number, o: Partial<PncpContract> = {}): PncpContract => ({ numeroControlePNCP: idc, orgaoEntidade: { cnpj: '27080571000130', esferaId: 'E', razaoSocial: org }, unidadeOrgao: { ufSigla: 'ES', codigoIbge: String(VIX), nomeUnidade: 'U' }, niFornecedor: '11222333000181', nomeRazaoSocialFornecedor: 'ACME LTDA', tipoPessoa: 'PJ', tipoContrato: { id: 1 }, categoriaProcesso: { id: 1 }, objetoContrato: obj, valorGlobal: valor, valorInicial: valor, dataAssinatura: '2024-02-01', ...o });
  const build = (cs: PncpContract[]) => { const rows: Row[] = []; const sup = new Map<number, string>(); for (const c of cs) { const r = buildContract(c, 2024, ctx); if ('drop' in r) continue; rows.push(r.row); if (r.supplier) sup.set(r.supplier.cnpj, r.supplier.name); } return { rows, sup: [...sup].map(([cnpj, name]) => ({ cnpj, name })) }; };
  const cs = [mk('A', 'SECRETARIA DE ESTADO DA SEGURANÇA PÚBLICA', 'material de expediente', 1000), mk('B', 'SECRETARIA DE ESTADO DA SAÚDE', 'colete balístico', 500), mk('C', 'SECRETARIA DE ESTADO DA SAÚDE', 'vigilância patrimonial armada', 900),
    mk('D', 'POLÍCIA CIVIL', 'viaturas policiais', 300, { tipoPessoa: 'PF', niFornecedor: '12345678901' }), mk('E', 'POLÍCIA MILITAR', 'combustível', 200, { tipoContrato: { id: 7 }, numeroContratoEmpenho: '2024NE000001' })];
  const slice = (list: PncpContract[], fp: string, first: boolean) => { const b = build(list); return publishContractSlice(pool, { year: 2024, uf: 32, rows: b.rows, suppliers: b.sup, indicators: contractIndicators(b.rows, 2024, false), fingerprint: sha256(fp), first, current: false, inputs: {}, quality: {} }); };
  const r1 = await slice(cs, 'c1', true); assert.equal(r1.status, 'PUBLISHED');
  assert.deepEqual((await q(`SELECT pncp_id FROM civica_exec.exec_fin_contract ORDER BY 1`)).map(r => r.pncp_id), ['A', 'B', 'D', 'E'], 'vigilância patrimonial (C) não entra');
  assert.equal((await q(`SELECT supplier FROM civica_exec.exec_fin_contract WHERE pncp_id = 'D'`))[0]!.supplier, null); assert.equal((await q(`SELECT count(*)::int n FROM civica_exec.exec_fin_supplier`))[0]!.n, 1);
  assert.equal((await q(`SELECT link FROM civica_exec.exec_fin_contract WHERE pncp_id = 'B'`))[0]!.link, 2); assert.equal((await q(`SELECT empenho FROM civica_exec.exec_fin_contract WHERE pncp_id = 'E'`))[0]!.empenho, '2024NE000001');
  const v = async (i: number, e = 32) => (await q(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = ${i} AND entity_id = ${e} AND period_start = '2024-01-01'`))[0]?.value;
  assert.equal(await v(7061), 3); assert.equal(await v(7062), 1500); assert.equal(await v(7064), 2); assert.equal(await v(7066), 1); assert.equal(await v(7061, 76), undefined, 'ausência não é zero');
  assert.equal((await slice(cs, 'c1', false)).status, 'NO_CHANGE');
  const snap = async () => await hash(`SELECT * FROM civica_exec.exec_fin_contract`) + await hash(`SELECT * FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 7061 AND 7066`);
  const before = await snap();
  const r2 = await slice(cs.filter(c => c.numeroControlePNCP !== 'A'), 'c2', false); assert.equal(r2.status, 'PUBLISHED'); assert.equal(await v(7061), 2); assert.equal((await q(`SELECT count(*)::int n FROM civica_exec.exec_fin_contract WHERE pncp_id = 'A'`))[0]!.n, 0);
  assert.equal((await rollbackRun(pool, id(r2))).status, 'ROLLED_BACK'); assert.equal(await snap(), before, 'rollback exato');
  const bad = build(cs); bad.rows[0] = { ...bad.rows[0]!, org_kind: 0, theme: 0 };
  await assert.rejects(publishContractSlice(pool, { year: 2024, uf: 32, rows: bad.rows, suppliers: bad.sup, indicators: [], fingerprint: sha256('c3'), first: false, current: false, inputs: {}, quality: {} }), /sem classificação/);
  assert.equal(await snap(), before);
});

test('transferências: indicadores só para convênios assinados com ente identificado; origem de financiamento não cria nem altera fato de despesa', { skip }, async () => {
  const rows = [{ entity_id: VIX, year: 2024, conv_status: 1, v_global_conv: 100000, v_repasse_conv: 90000, v_desembolsado_conv: 30000 }, { entity_id: null, year: 2024, conv_status: 1, v_global_conv: 5, v_repasse_conv: 5, v_desembolsado_conv: 5 }, { entity_id: VV, year: 2024, conv_status: 0, v_global_conv: null, v_repasse_conv: null, v_desembolsado_conv: null }];
  const full = rows.map((r, i) => ({ proposal_id: i + 1, year: 2024, uf: 32, entity_id: r.entity_id, benef_kind: 2, concedente: 30000, instrument: 1, prop_status: 2, conv_status: r.conv_status, v_global_prop: 1, v_repasse_prop: 1, v_global_conv: r.v_global_conv, v_repasse_conv: r.v_repasse_conv, v_empenhado_conv: null, v_desembolsado_conv: r.v_desembolsado_conv, signed: '2024-05-05' }));
  const factsBefore = await hash(`SELECT * FROM civica_exec.exec_fin_fact`) + await hash(`SELECT * FROM civica_exec.exec_fin_exec`);
  const r = await publishSlice(pool, { datasetId: DATASET.fin_transfer, uf: 32, competence: 202412, sourceHash: sha256('t1'), bootstrap: true, tables: [{ spec: SPECS.fin_transfer, rows: full }],
    derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: [7071, 7072, 7073, 7074], ufCode: 32, from: '2024-01-01', to: '2025-01-01' }, transferIndicators(rows, 2024, false), false); } });
  assert.equal(r.status, 'PUBLISHED'); const v = async (i: number, e: number) => (await q(`SELECT value FROM civica_exec.exec_ind_value WHERE indicator_id = $1 AND entity_id = $2`, [i, e]))[0]?.value;
  assert.equal(await v(7071, VIX), 1); assert.equal(await v(7072, VIX), 1000); assert.equal(await v(7073, VIX), 900); assert.equal(await v(7074, VIX), 300); assert.equal(await v(7071, VV), undefined);
  assert.equal(await hash(`SELECT * FROM civica_exec.exec_fin_fact`) + await hash(`SELECT * FROM civica_exec.exec_fin_exec`), factsBefore);
});

test('TCE-RS: exercício pela data da operação (remessa tardia), só a prefeitura "PM DE", restos a pagar pagos à parte, natureza pela rubrica; câmara e nome sem município são relatados; fatia estadual não toca a federal', { skip }, async () => {
  const mun = new Map([['VITORIA', { entityId: VIX, ibge6: 320530 }]]);
  // linha: [mês, órgão, UO, subfunção, programa, projeto, categoria, grupo, modalidade, rp, emp, liq, pago]
  const x2025 = { rows_in: 10, rows_kept: 4, rows: [['2025-01', 'PM DE VITORIA', '12', '181', '5', '2001', 3, 1, 90, 0, 1000, 800, 700], ['2025-01', 'PM DE VITORIA', '12', '181', '5', '2001', 3, 1, 90, 1, 0, 50, 40], ['2025-02', 'CM DE VITORIA', '1', '31', '1', '1', 3, 3, 90, 0, 9, 9, 9]], orgs: [['PM DE VITORIA', '12', 'SECRETARIA DE SEGURANCA']], ctrl: [] } as never;
  const x2026 = { rows_in: 5, rows_kept: 2, rows: [['2025-01', 'PM DE VITORIA', '12', '181', '5', '2001', 3, 1, 90, 0, 100, 100, 100], ['2026-03', 'PM DE VITORIA', '12', '182', '5', '2002', 4, 4, 90, 0, 10, 0, 0], ['2026-03', 'PM DE ZZZ', '1', '181', '1', '1', 3, 1, 90, 0, 1, 1, 1]], orgs: [['PM DE VITORIA', '12', 'SECRETARIA DE SEGURANCA']], ctrl: [] } as never;
  const b = buildRsAll([{ fileYear: 2025, x: x2025 }, { fileYear: 2026, x: x2026 }], mun);
  const y25 = b.get(2025)!; assert.equal(y25.rows.length, 1, 'a remessa de 2026 que reenvia operação de 2025 NÃO é somada de novo'); assert.equal(y25.stats.lateResendSkipped, 1); const r = y25.rows[0]!;
  assert.equal(r.emp, 1000); assert.equal(r.liq, 800); assert.equal(r.pago, 700); assert.equal(r.rp_pago, 40); assert.equal(r.funcao, 6); assert.equal(r.org_id, orgIdMun(320530, '12'));
  assert.equal(b.get(2026)!.rows.length, 1); assert.equal(b.get(2026)!.rows[0]!.categoria, 4); assert.deepEqual(b.get(2026)!.unmatched, ['PM DE ZZZ']); assert.equal(y25.stats.nonPmRows, 1);
  // vizinho federal já presente: a fatia estadual (aqui usando a UF 32 do mini-território como suporte) não pode tocá-lo
  const br = (await q(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1`))[0]!.entity_id as number;
  const fed = { entity_id: br, exercicio: 2025, mes: 1, org_id: 1, funcao: 6, subfuncao: 181, programa: 1, acao: 'A', categoria: 3, grupo: 1, modalidade: 90, uf_loc: 0, emp: 1, liq: 1, pago: 1, rp_insc: 0, rp_canc: 0, rp_pago: 0 };
  assert.equal((await publishSlice(pool, { datasetId: DATASET.fin_fed_exec, uf: 0, competence: 202512, sourceHash: sha256('fedx'), bootstrap: true, tables: [{ spec: SPECS.fin_exec, rows: [fed] }] })).status, 'PUBLISHED');
  const p = await publishSlice(pool, { datasetId: DATASET.fin_rs_exec, uf: 32, competence: 202512, sourceHash: sha256(`rs1:${FIN_VERSION.rs}`), bootstrap: true, tables: [{ spec: SPECS.fin_org, rows: y25.orgs }, { spec: SPECS.fin_exec_uf, rows: y25.rows }] });
  assert.equal(p.status, 'PUBLISHED'); assert.equal((await q(`SELECT count(*)::int n FROM civica_exec.exec_fin_exec WHERE entity_id = $1`, [VIX]))[0]!.n, 1); assert.equal((await q(`SELECT count(*)::int n FROM civica_exec.exec_fin_exec WHERE entity_id = $1`, [br]))[0]!.n, 1);
  const od = await getSecurityFinanceOrgans(pool, VIX); assert.ok(od); const o25 = od.years.find(y => y.exercicio === 2025)!; assert.equal(o25.organs[0]!.pago, '700'); assert.equal(o25.organs[0]!.restosPagos, '40'); assert.equal(o25.organs[0]!.pessoalPago, '700'); assert.equal(o25.byNature[0]!.label, 'Despesa corrente: Pessoal e encargos sociais');
  assert.equal(await getSecurityFinanceOrgans(pool, VV), null, 'ente sem execução detalhada não ganha detalhe inventado');
  const again = await publishSlice(pool, { datasetId: DATASET.fin_rs_exec, uf: 32, competence: 202512, sourceHash: sha256(`rs1:${FIN_VERSION.rs}`), tables: [{ spec: SPECS.fin_org, rows: y25.orgs }, { spec: SPECS.fin_exec_uf, rows: y25.rows }] }); assert.equal(again.status, 'NO_CHANGE');
});
