import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { ensureBudgetSchema, loadBudgetRun, type BudgetLoadInput, type PortalAmendmentRow } from '../../packages/db/src/postgres-budget.ts';
import { linkedPersonIds, parliamentarianPixSummary, pixAmendmentDetail, pixBeneficiaryDetail } from '../../packages/db/src/postgres-budget-read.ts';

/** Fixture sintética em 2031–2032 (anos que não existem na fonte) dentro de transação revertida: não toca nos dados reais. */
const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
const skip = !hasDb && 'requer o PostgreSQL local (DB_*)';
const pool = hasDb ? new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 }) : null!;
test.after(async () => { await pool?.end(); });
if (hasDb) await ensureBudgetSchema(pool);

async function inTx<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); return await work(client); } finally { await client.query('ROLLBACK'); client.release(); }
}
const RUN = 'pix-test-run';
const A = '203177010001', B = '203177020001', C = '203177030001', D = '203177040001', S1 = '203177050001', S2 = '203277060001';
const plan = (id: number, code: string, author: string, cnpj: string, name: string, custeio: number, investimento: number, extra: Record<string, unknown> = {}) => ({
  id_plano_acao: id, codigo_plano_acao: `PIX-TEST-${id}`, ano_plano_acao: 2031, modalidade_plano_acao: 'ESPECIAL', situacao_plano_acao: 'CIENTE', cnpj_beneficiario_plano_acao: cnpj, nome_beneficiario_plano_acao: name, uf_beneficiario_plano_acao: 'PB',
  nome_parlamentar_emenda_plano_acao: `Autor ${author}`, ano_emenda_parlamentar_plano_acao: Number(code.slice(0, 4)), codigo_parlamentar_emenda_plano_acao: author, sequencial_emenda_parlamentar_plano_acao: 1, numero_emenda_parlamentar_plano_acao: '1',
  codigo_emenda_parlamentar_formatado_plano_acao: `${code}-Autor ${author}`, codigo_descricao_areas_politicas_publicas_plano_acao: '15-Urbanismo / 451-Infraestrutura Urbana', descricao_programacao_orcamentaria_plano_acao: 'x', valor_custeio_plano_acao: custeio, valor_investimento_plano_acao: investimento, id_programa: null, ...extra });
const portal = (code: string, author: string, committed: number, paid: number | null, year = 2031): PortalAmendmentRow => ({ amendmentCode: code, year, authorCode: author, authorName: `Autor ${author}`, kind: 'Emenda Individual - Transferências Especiais', uf: 'PB', location: 'MÚLTIPLO', ibgeCode: null, functionName: 'Encargos especiais', subfunctionName: 'Outras transferências', committed, liquidated: paid, paid, outstanding: 0, outstandingCancelled: 0, outstandingPaid: 0 });

function fixture(): BudgetLoadInput {
  const plans = [
    plan(9000001, A, '7701', '11111111000101', 'MUNICIPIO DE TESTE UM', 100000, 0),          // A tem dois planos (multi-plano por emenda)
    plan(9000002, A, '7701', '22222222000102', 'MUNICIPIO DE TESTE DOIS', 0, 200000),
    plan(9000003, B, '7702', '11111111000101', 'MUNICIPIO DE TESTE UM', 0, 50000),
    plan(9000004, C, '7703', '33333333000103', 'ESTADO DE TESTE', 0, 70000),
    plan(9000005, D, '7704', '44444444000104', 'MUNICIPIO DE TESTE QUATRO', 0, 80000),
    plan(9000006, S1, '7705', '11111111000101', 'MUNICIPIO DE TESTE UM', 0, 10000),
    plan(9000007, S2, '7706', '11111111000101', 'MUNICIPIO DE TESTE UM', 0, 20000, { ano_emenda_parlamentar_plano_acao: 2032 }),
  ];
  return { tables: {
    programa_especial: [],
    plano_acao_especial: plans as any,
    // P1: empenho + documento hábil + OB (2023+). P2: empenho sem documento. D: só empenho (fixa o "pago do Portal", como 2020–2022).
    empenho_especial: [
      { id_empenho: 9100001, id_plano_acao: 9000001, numero_empenho: '2031NE1', descricao_situacao_empenho: 'Enviado', descricao_tipo_documento_empenho: 'Empenho Original', categoria_despesa_empenho: 'CUSTEIO', natureza_despesa_empenho: '444041', valor_empenho: 100000, data_emissao_empenho: '2031-03-01', ug_emitente_empenho: 1, cnpj_beneficiario_empenho: '11111111000101' },
      { id_empenho: 9100002, id_plano_acao: 9000002, numero_empenho: '2031NE2', descricao_situacao_empenho: 'Enviado', descricao_tipo_documento_empenho: 'Empenho Original', categoria_despesa_empenho: 'INVESTIMENTO', natureza_despesa_empenho: '444041', valor_empenho: 200000, data_emissao_empenho: '2031-03-01', ug_emitente_empenho: 1, cnpj_beneficiario_empenho: '22222222000102' },
      { id_empenho: 9100005, id_plano_acao: 9000005, numero_empenho: '2031NE5', descricao_situacao_empenho: 'Enviado', descricao_tipo_documento_empenho: 'Empenho Original', categoria_despesa_empenho: 'INVESTIMENTO', natureza_despesa_empenho: '444041', valor_empenho: 80000, data_emissao_empenho: '2031-03-01', ug_emitente_empenho: 1, cnpj_beneficiario_empenho: '44444444000104' },
    ] as any,
    documento_habil_especial: [{ id_dh: 9200001, id_empenho: 9100001, numero_documento_habil: '2031TF1', descricao_situacao_dh: 'Enviado com Sucesso', tipo_documento_dh: 'TF', data_emissao_dh: '2031-04-01', data_vencimento_dh: '2031-04-10', valor_dh: 100000, valor_rateio_dh: 100000 }] as any,
    ordem_pagamento_ordem_bancaria_especial: [{ id_op_ob: 9300001, id_dh: 9200001, numero_ordem_pagamento: '2031OP1', numero_ordem_bancaria: '2031OB1', descricao_situacao_op: 'OB Enviada', data_emissao_op: '2031-04-02', data_emissao_ob: '2031-04-03', data_situacao_op: '2031-04-04' }] as any,
    executor_especial: [{ id_executor: 9400001, id_plano_acao: 9000001, cnpj_executor: '11111111000101', nome_executor: 'MUNICIPIO DE TESTE UM', objeto_executor: 'Pavimentação de teste', vl_custeio_executor: 100000, vl_investimento_executor: 0 }] as any,
    plano_trabalho_especial: [{ id_plano_trabalho: 9500001, id_plano_acao: 9000001, situacao_plano_trabalho: 'CONCLUIDO_NT_TCU', data_inicio_execucao_plano_trabalho: '2031-05-01T00:00:00', data_fim_execucao_plano_trabalho: '2031-11-01T00:00:00' }] as any,
    finalidade_especial: [{ id_executor: 9400001, cd_area_politica_publica_tipo_pt: 15, area_politica_publica_tipo_pt: 'Urbanismo', cd_area_politica_publica_pt: 451, area_politica_publica_pt: 'Infraestrutura Urbana' }] as any,
    // execução pelo ente: 10 mil, enquanto 100 mil já tiveram OB — pago ≠ executado
    relatorio_gestao_novo_especial: [{ id_relatorio_gestao_novo: 9600001, id_plano_acao: 9000001, tipo_relatorio_gestao_novo: 'Parcial', situacao_relatorio_gestao_novo: 'DISPONIBILIZADO', valor_executado_relatorio_gestao_novo: 10000, valor_pendente_relatorio_gestao_novo: 90000, data_e_hora_relatorio_gestao_novo: '2031-06-01T10:00:00' }] as any,
  }, portalAmendments: [portal(A, '7701', 300000, 100000), portal(B, '7702', 50000, null), portal(C, '7703', 70000, 0), portal(D, '7704', 80000, 50000), portal(S1, '7705', 10000, 10000), portal(S2, '7706', 20000, 20000, 2032)],
  portalPayments: [{ amendmentCode: A, month: '203104', favoredCode: '11111111000101', favoredName: 'MUNICIPIO DE TESTE UM', legalNature: 'Município', favoredType: 'Pessoa Jurídica', uf: 'PB', municipality: 'TESTE', amount: 100000 }] };
}
async function person(client: pg.PoolClient, label: string) { const id = `pix-test-${label}-${Math.random().toString(36).slice(2)}`; await client.query(`INSERT INTO civica.people(id,created_at) VALUES($1,now()::text)`, [id]); return id; }
async function crosswalk(client: pg.PoolClient, authorCode: string, personId: string | null, confidence: string, reviewed: boolean, house: string | null = 'camara', from = '2031-01-01', to = '2033-12-31') {
  await client.query(`INSERT INTO civica_budget.author_code_crosswalk(author_code,valid_from,valid_to,person_id,house,confidence,reviewed,reviewed_at,evidence_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'{}')`, [authorCode, from, to, personId, personId ? house : null, confidence, reviewed, reviewed ? new Date().toISOString() : null]);
}
const load = (client: pg.PoolClient) => loadBudgetRun(client, RUN, fixture(), { purgeStale: false });

test('recarga idempotente: carregar duas vezes não duplica nada e o código da emenda é único', { skip }, () => inTx(async client => {
  const count = async () => Number((await client.query(`SELECT (SELECT count(*) FROM civica_budget.budget_amendments WHERE amendment_year IN (2031,2032)) + (SELECT count(*) FROM civica_budget.special_action_plans WHERE plan_id BETWEEN 9000001 AND 9000007) + (SELECT count(*) FROM civica_budget.special_commitments WHERE commitment_id BETWEEN 9100001 AND 9100005) n`)).rows[0].n);
  const first = await load(client); const afterFirst = await count();
  const second = await load(client);
  assert.equal(await count(), afterFirst); assert.deepEqual(second.counts, first.counts);
  assert.equal(afterFirst, 6 + 7 + 3);
  await client.query('SAVEPOINT dup');
  await assert.rejects(client.query(`INSERT INTO civica_budget.budget_amendments(amendment_code,amendment_year,author_code,run_id) VALUES($1,2031,'7701','x')`, [A]), /duplicate key|unique|duplicar|unicidade/i);
  await client.query('ROLLBACK TO SAVEPOINT dup');
  await assert.rejects(client.query(`INSERT INTO civica_budget.budget_amendments(amendment_code,amendment_year,author_code,run_id) VALUES('123',2031,'7701','x')`), /check|verifica/i, 'código de emenda precisa ter 12 dígitos');
}));

test('plano ligado à emenda correta; uma emenda com vários planos; Portal ↔ Transferegov pelo código de 12 dígitos', { skip }, () => inTx(async client => {
  await load(client);
  const rows = (await client.query(`SELECT amendment_code, count(*)::int n, sum(custeio_amount+investimento_amount) v FROM civica_budget.special_action_plans WHERE plan_id BETWEEN 9000001 AND 9000007 GROUP BY 1 ORDER BY 1`)).rows;
  const byCode = Object.fromEntries(rows.map(r => [r.amendment_code, r]));
  assert.equal(byCode[A].n, 2); assert.equal(Number(byCode[A].v), 300000); assert.equal(byCode[B].n, 1);
  const plan1 = (await client.query(`SELECT amendment_code, author_code, ente_type, work_plan_situation, ibge_code FROM civica_budget.special_action_plans WHERE plan_id=9000001`)).rows[0];
  assert.equal(plan1.amendment_code, A); assert.equal(plan1.author_code, '7701'); assert.equal(plan1.ente_type, 'municipio'); assert.equal(plan1.work_plan_situation, 'CONCLUIDO_NT_TCU'); assert.equal(plan1.ibge_code, null, 'IBGE nunca é inventado');
  const unmatched = (await client.query(`SELECT count(*)::int n FROM civica_budget.budget_amendments WHERE amendment_year IN (2031,2032) AND in_portal AND NOT in_transferegov`)).rows[0].n;
  assert.equal(unmatched, 0);
  assert.equal((await client.query(`SELECT ente_type FROM civica_budget.special_action_plans WHERE plan_id=9000004`)).rows[0].ente_type, 'estado');
}));

test('perfil: EXACT revisado é visível; HIGH reviewed=false e não resolvido ficam fora do perfil', { skip }, () => inTx(async client => {
  await load(client);
  const exact = await person(client, 'exact'), high = await person(client, 'high');
  await crosswalk(client, '7701', exact, 'EXACT', true); await crosswalk(client, '7702', high, 'HIGH', false); await crosswalk(client, '7703', null, 'UNMATCHED', false);
  const summary = await parliamentarianPixSummary(client, exact);
  assert.deepEqual(summary.authorCodes.map(c => c.authorCode), ['7701']);
  assert.equal(summary.financials.destinedAmount, 300000); assert.equal(summary.counts.plans, 2); assert.equal(summary.counts.amendments, 1); assert.equal(summary.counts.beneficiaries, 2);
  assert.equal(summary.attribution, 'reviewed_crosswalk_only');
  const none = await parliamentarianPixSummary(client, high);
  assert.equal(none.counts.amendments, 0, 'HIGH pendente de revisão é invisível');
  assert.equal(none.financials.destinedAmount, 0);
  // revisão humana libera o HIGH
  await client.query(`UPDATE civica_budget.author_code_crosswalk SET reviewed=true, reviewed_at=now(), review_source='human' WHERE author_code='7702'`);
  assert.equal((await parliamentarianPixSummary(client, high)).financials.destinedAmount, 50000);
  const detailC = await pixAmendmentDetail(client, C);
  assert.equal(detailC!.author.attributed, false); assert.equal(detailC!.author.personId, null); assert.match(detailC!.author.reason, /unresolved/);
  assert.equal((await pixAmendmentDetail(client, A))!.author.personId, exact);
}));

test('o código não resolvido (modelo do 1270) nunca devolve pessoa; a CHECK impede reviewed sem pessoa', { skip }, () => inTx(async client => {
  await load(client);
  await crosswalk(client, '7703', null, 'UNMATCHED', false);
  const rows = (await client.query(`SELECT * FROM civica_budget.reviewed_amendment_authors WHERE author_code='7703'`)).rows;
  assert.equal(rows.length, 0);
  await client.query('SAVEPOINT s');
  await assert.rejects(crosswalk(client, '7799', null, 'UNMATCHED', true), /crosswalk_reviewed_needs_person|check/i);
  await client.query('ROLLBACK TO SAVEPOINT s');
  const someone = await person(client, 'amb');
  await assert.rejects(crosswalk(client, '7798', someone, 'AMBIGUOUS', true), /crosswalk_reviewed_needs_person|check/i, 'AMBIGUOUS nunca pode ser revisado como atribuição');
}));

test('CONFLICT e AMBIGUOUS com pessoa candidata nunca atribuem, mesmo com reviewed=false/true bloqueado pela CHECK', { skip }, () => inTx(async client => {
  await load(client);
  const p = await person(client, 'conf');
  await crosswalk(client, '7702', null, 'CONFLICT', false); await crosswalk(client, '7703', null, 'AMBIGUOUS', false);
  assert.equal((await parliamentarianPixSummary(client, p)).counts.amendments, 0);
  assert.equal(Number((await client.query(`SELECT count(*) n FROM civica_budget.reviewed_amendment_authors WHERE author_code IN ('7702','7703')`)).rows[0].n), 0);
  assert.match((await pixAmendmentDetail(client, B))!.author.reason, /unresolved:CONFLICT/);
}));

test('pago ≠ execução; pago do Portal por emenda (sem DH, como 2020–2022); DH+OB por plano (2023+)', { skip }, () => inTx(async client => {
  await load(client);
  const p = await person(client, 'fin'); await crosswalk(client, '7701', p, 'EXACT', true); await crosswalk(client, '7704', p, 'EXACT', true);
  const s = await parliamentarianPixSummary(client, p);
  assert.equal(s.financials.destinedAmount, 380000);
  assert.equal(s.financials.committedAmount, 380000, 'empenhado = Portal por emenda');
  assert.equal(s.financials.paidAmount, 150000, 'pago = Portal (A 100 mil + D 50 mil)');
  assert.equal(s.financials.paidByPlanDocumentsAmount, 100000, 'só o plano com DH+OB; D (sem DH) não entra');
  assert.equal(s.financials.executedByEnteAmount, 10000, 'executado pelo ente é outra coisa');
  assert.notEqual(s.financials.executedByEnteAmount, s.financials.paidAmount);
  assert.match(s.notes.paid, /não indica execução física/);
  const detail = await pixAmendmentDetail(client, A);
  const p1 = detail!.plans.find(x => x.planId === 9000001)!, p2 = detail!.plans.find(x => x.planId === 9000002)!;
  assert.equal(p1.commitments[0]!.documents[0]!.orders[0]!.obNumber, '2031OB1'); assert.equal(p1.paidByDocumentsAmount, 100000); assert.equal(p1.executedByEnteAmount, 10000);
  assert.equal(p2.commitments.length, 1); assert.equal(p2.commitments[0]!.documents.length, 0); assert.equal(p2.paidByDocumentsAmount, 0);
  assert.deepEqual(p1.objects, ['Pavimentação de teste']); assert.equal(p1.functions[0]!.functionCode, 15); assert.equal(detail!.portal.paid, 100000);
}));

test('pessoa com dois códigos SIOP em Casas diferentes: união só com identity_links CONFIRMADO', { skip }, () => inTx(async client => {
  await load(client);
  const dep = await person(client, 'dep'), sen = await person(client, 'sen');
  await crosswalk(client, '7705', dep, 'EXACT', true, 'camara', '2031-01-01', '2031-12-31'); await crosswalk(client, '7706', sen, 'EXACT', true, 'senado', '2032-01-01', '2033-12-31');
  assert.equal((await parliamentarianPixSummary(client, dep)).financials.destinedAmount, 10000);
  assert.equal((await parliamentarianPixSummary(client, sen)).financials.destinedAmount, 20000);
  await client.query(`INSERT INTO civica.identity_links(id,person_a,person_b,status,evidence) VALUES($1,$2,$3,'candidate','{}')`, ['pix-test-link', dep, sen]);
  assert.deepEqual((await linkedPersonIds(client, dep)).sort(), [dep], 'candidato não une');
  assert.equal((await parliamentarianPixSummary(client, dep)).financials.destinedAmount, 10000);
  await client.query(`UPDATE civica.identity_links SET status='confirmed' WHERE id='pix-test-link'`);
  const merged = await parliamentarianPixSummary(client, dep);
  assert.equal(merged.financials.destinedAmount, 30000); assert.deepEqual(merged.authorCodes.map(c => `${c.authorCode}:${c.house}`).sort(), ['7705:camara', '7706:senado']);
  assert.equal(merged.byYear.length, 2);
}));

test('validade datada do código: mesma pessoa/código fora do período não atribui', { skip }, () => inTx(async client => {
  await load(client);
  const p = await person(client, 'old'); await crosswalk(client, '7701', p, 'EXACT', true, 'camara', '2020-01-01', '2022-12-31');
  assert.equal((await parliamentarianPixSummary(client, p)).counts.amendments, 0);
}));

test('beneficiário: autores só aparecem atribuídos quando o crosswalk está revisado', { skip }, () => inTx(async client => {
  await load(client);
  const p = await person(client, 'ben'); await crosswalk(client, '7701', p, 'EXACT', true);
  const b = await pixBeneficiaryDetail(client, '11111111000101');
  assert.equal(b!.plans, 4); assert.equal(b!.destinedAmount, 100000 + 50000 + 10000 + 20000);
  assert.equal(b!.authors.find(a => a.authorCode === '7701')!.personId, p); assert.equal(b!.authors.find(a => a.authorCode === '7702')!.personId, null);
  assert.equal(b!.portalReceivedAmount, 100000); assert.deepEqual(b!.years, [2031, 2032]);
}));

test('o domínio é separado de proposições: nenhuma FK/tabela de civica_budget aponta para civica_poc', { skip }, async () => {
  const tables = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='civica_budget' ORDER BY 1`)).rows.map(r => r.table_name as string);
  assert.ok(tables.length >= 12); assert.ok(tables.every(t => !/proposal/.test(t)));
  const refs = (await pool.query(`SELECT confrelid::regclass::text t FROM pg_constraint WHERE contype='f' AND connamespace='civica_budget'::regnamespace`)).rows.map(r => r.t as string);
  assert.ok(refs.every(r => !r.startsWith('civica_poc.')), `FKs: ${refs.join(',')}`);
  const views = (await pool.query(`SELECT pg_get_viewdef('civica_budget.reviewed_amendment_authors'::regclass) d`)).rows[0].d as string;
  assert.ok(!/proposals|proposal_authors/.test(views));
});
