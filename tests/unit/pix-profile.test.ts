import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { ensureBudgetSchema, loadBudgetRun, type BudgetLoadInput } from '../../packages/db/src/postgres-budget.ts';
import { parliamentarianPixSummary } from '../../packages/db/src/postgres-budget-read.ts';
import { parliamentarianPixWith } from '../../apps/web/lib/data-postgres-pix.ts';
import { beneficiaryLabel, brlCompact, buildPixStory, PIX_EMPTY_COPY } from '../../apps/web/lib/pix-profile-model.ts';

/** Seção "Emendas Pix" do perfil: modelo de apresentação (puro) + dados reais em transação revertida (anos 2031–2032). */
const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
const skip = !hasDb && 'requer o PostgreSQL local (DB_*)';
const pool = hasDb ? new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 }) : null!;
test.after(async () => { await pool?.end(); });
if (hasDb) await ensureBudgetSchema(pool);
async function inTx<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> { const c = await pool.connect(); try { await c.query('BEGIN'); return await work(c); } finally { await c.query('ROLLBACK'); c.release(); } }

const plan = (id: number, code: string, author: string, cnpj: string, name: string, uf: string, custeio: number, invest: number, extra: Record<string, unknown> = {}) => ({
  id_plano_acao: id, codigo_plano_acao: `PROF-${id}`, ano_plano_acao: 2031, modalidade_plano_acao: 'ESPECIAL', situacao_plano_acao: 'CIENTE', cnpj_beneficiario_plano_acao: cnpj, nome_beneficiario_plano_acao: name, uf_beneficiario_plano_acao: uf,
  nome_parlamentar_emenda_plano_acao: `Autor ${author}`, ano_emenda_parlamentar_plano_acao: Number(code.slice(0, 4)), codigo_parlamentar_emenda_plano_acao: author, sequencial_emenda_parlamentar_plano_acao: 1, numero_emenda_parlamentar_plano_acao: '1',
  codigo_emenda_parlamentar_formatado_plano_acao: `${code}-Autor ${author}`, codigo_descricao_areas_politicas_publicas_plano_acao: '15-Urbanismo / 451-Infraestrutura Urbana', descricao_programacao_orcamentaria_plano_acao: 'x', valor_custeio_plano_acao: custeio, valor_investimento_plano_acao: invest, id_programa: null, ...extra });
const A = '203188010001', B = '203188010002', S = '203288020001', C = '203188030001';
const portal = (code: string, author: string, committed: number, paid: number | null, year: number) => ({ amendmentCode: code, year, authorCode: author, authorName: `Autor ${author}`, kind: 'Emenda Individual - Transferências Especiais', uf: 'PB', location: 'MÚLTIPLO', ibgeCode: null, functionName: null, subfunctionName: null, committed, liquidated: paid, paid, outstanding: 0, outstandingCancelled: 0, outstandingPaid: 0 });
function fixture(): BudgetLoadInput {
  return { tables: { programa_especial: [],
    plano_acao_especial: [
      plan(9800001, A, '8801', '11111111000111', 'MUNICIPIO DE VITORIA', 'ES', 0, 300000),
      plan(9800002, A, '8801', '22222222000122', 'MUNICIPIO DE SERRA', 'ES', 100000, 0, { situacao_plano_acao: 'IMPEDIDO', codigo_descricao_areas_politicas_publicas_plano_acao: '10-Saúde / 301-Atenção Básica , 15-Urbanismo / 451-Infraestrutura Urbana' }),
      plan(9800003, B, '8801', '11111111000111', 'MUNICIPIO DE VITORIA', 'ES', 50000, 0, { codigo_descricao_areas_politicas_publicas_plano_acao: '10-Saúde / 301-Atenção Básica' }),
      plan(9800004, C, '8803', '33333333000133', 'ESTADO DO ESPIRITO SANTO', 'ES', 0, 70000),
      plan(9800005, S, '8802', '11111111000111', 'MUNICIPIO DE VITORIA', 'ES', 0, 20000, { ano_emenda_parlamentar_plano_acao: 2032 }),
    ] as any,
    empenho_especial: [], documento_habil_especial: [], ordem_pagamento_ordem_bancaria_especial: [], executor_especial: [], plano_trabalho_especial: [], finalidade_especial: [],
    relatorio_gestao_novo_especial: [{ id_relatorio_gestao_novo: 9900001, id_plano_acao: 9800001, tipo_relatorio_gestao_novo: 'Parcial', situacao_relatorio_gestao_novo: 'D', valor_executado_relatorio_gestao_novo: 1000, valor_pendente_relatorio_gestao_novo: 299000, data_e_hora_relatorio_gestao_novo: '2031-06-01T10:00:00' }] as any },
  portalAmendments: [portal(A, '8801', 400000, 150000, 2031), portal(B, '8801', 50000, 50000, 2031), portal(C, '8803', 70000, 70000, 2031), portal(S, '8802', 20000, 0, 2032)],
  portalPayments: [{ amendmentCode: A, month: '203105', favoredCode: '11111111000111', favoredName: 'MUNICIPIO DE VITORIA', legalNature: 'Município', favoredType: 'Pessoa Jurídica', uf: 'ES', municipality: 'VITÓRIA', amount: 1 }] };
}
async function person(c: pg.PoolClient, source: 'camara' | 'senado', externalId: string) { const id = `pix-prof-${externalId}-${Math.random().toString(36).slice(2)}`; await c.query(`INSERT INTO civica.people(id,created_at) VALUES($1,now()::text)`, [id]); await c.query(`INSERT INTO civica.external_identifiers(source,external_id,person_id) VALUES($1,$2,$3)`, [source, externalId, id]); return id; }
async function cw(c: pg.PoolClient, code: string, personId: string | null, confidence: string, reviewed: boolean, house = 'camara', from = '2031-01-01', to = '2032-12-31') {
  await c.query(`INSERT INTO civica_budget.author_code_crosswalk(author_code,valid_from,valid_to,person_id,house,confidence,reviewed,reviewed_at,evidence_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'{}')`, [code, from, to, personId, personId ? house : null, confidence, reviewed, reviewed ? new Date().toISOString() : null]);
}
const load = (c: pg.PoolClient) => loadBudgetRun(c, 'pix-profile-test', fixture(), { purgeStale: false });

test('perfil sem Pix não quebra: pessoa desconhecida e pessoa sem autoria viram estado vazio explicado', { skip }, () => inTx(async c => {
  assert.deepEqual(await parliamentarianPixWith(c, 'camara', '999999999'), { status: 'empty', reason: 'none' });
  const p = await person(c, 'camara', '880001'); void p;
  const r = await parliamentarianPixWith(c, 'camara', '880001');
  assert.equal(r.status, 'empty'); if (r.status === 'empty') assert.ok(['none', 'no_mandate_in_period'].includes(r.reason));
  assert.ok(PIX_EMPTY_COPY.none.description.includes('não afirma'));
}));

test('estado "autoria em revisão": linha da pessoa ainda não revisada não entra, mas explica o vazio', { skip }, () => inTx(async c => {
  await load(c); const p = await person(c, 'camara', '880002'); await cw(c, '8801', p, 'HIGH', false);
  const r = await parliamentarianPixWith(c, 'camara', '880002');
  assert.deepEqual(r, { status: 'empty', reason: 'pending_authorship' });
}));

test('somente reviewed=true entra; AMBIGUOUS/CONFLICT/outro parlamentar nunca; totais batem com os planos', { skip }, () => inTx(async c => {
  await load(c);
  const mine = await person(c, 'camara', '880003'), other = await person(c, 'camara', '880004');
  await cw(c, '8801', mine, 'EXACT', true); await cw(c, '8803', other, 'EXACT', true); await cw(c, '8802', null, 'AMBIGUOUS', false);
  const r = await parliamentarianPixWith(c, 'camara', '880003');
  assert.equal(r.status, 'available'); if (r.status !== 'available') return;
  const s = r.summary;
  assert.equal(s.financials.destinedAmount, 300000 + 100000 + 50000, 'destinado = soma dos planos das emendas dele');
  assert.equal(s.financials.paidAmount, 150000 + 50000); assert.equal(s.financials.committedAmount, 400000 + 50000);
  assert.equal(s.counts.amendments, 2); assert.equal(s.counts.plans, 3); assert.equal(s.counts.beneficiaries, 2); assert.equal(s.counts.ufs, 1);
  assert.deepEqual(s.amendments.map(a => a.amendmentCode).sort(), [A, B]); assert.ok(!s.amendments.some(a => a.amendmentCode === C || a.amendmentCode === S), 'nada de outro parlamentar nem de AMBIGUOUS');
  assert.equal(s.financials.executedByEnteAmount, 1000); assert.notEqual(s.financials.executedByEnteAmount, s.financials.paidAmount, 'pago ≠ executado pelo ente');
  assert.equal(s.byExpenseKind.custeio, 150000); assert.equal(s.byExpenseKind.investimento, 300000);
  assert.deepEqual(s.byYear.map(y => [y.year, y.destinedAmount, y.paidAmount]), [[2031, 450000, 200000]]);
  assert.equal(s.byUf[0]!.uf, 'ES'); assert.equal(s.byUf[0]!.destinedAmount, 450000);
  const vitoria = s.topBeneficiaries.find(b => b.cnpj === '11111111000111')!;
  assert.equal(vitoria.plans, 2); assert.equal(vitoria.destinedAmount, 350000); assert.equal(vitoria.municipalityName, 'VITÓRIA', 'nome acentuado vem do Portal pelo CNPJ');
  const a = s.amendments.find(x => x.amendmentCode === A)!;
  assert.equal(a.plans, 2); assert.equal(a.beneficiaries, 2); assert.equal(a.impededPlans, 1); assert.equal(a.topBeneficiary!.cnpj, '11111111000111');
}));

test('funções: valor só por plano de área única; planos multiárea ficam à parte e não são repartidos', { skip }, () => inTx(async c => {
  await load(c);
  const mine = await person(c, 'camara', '880005'); await cw(c, '8801', mine, 'EXACT', true);
  const s = await parliamentarianPixSummary(c, mine);
  const urb = s.byFunction.find(f => f.functionCode === 15)!, saude = s.byFunction.find(f => f.functionCode === 10)!;
  assert.equal(urb.plans, 2); assert.equal(urb.exclusivePlans, 1); assert.equal(urb.exclusiveDestinedAmount, 300000);
  assert.equal(saude.plans, 2); assert.equal(saude.exclusivePlans, 1); assert.equal(saude.exclusiveDestinedAmount, 50000);
  assert.deepEqual([s.functionCoverage.singleFunctionPlans, s.functionCoverage.multiFunctionPlans, s.functionCoverage.multiFunctionAmount], [2, 1, 100000]);
  const story = buildPixStory(s, { currentYear: 2031 });
  assert.match(story.functions.sentence, /1 plano abrange mais de uma área/);
  assert.equal(story.functions.items.reduce((t, i) => t + i.amount, 0), 350000, 'a soma das áreas exclui o plano multiárea');
}));

test('pessoa com mais de um author_code: agrega os dois e mostra Casa/anos; link candidato não une', { skip }, () => inTx(async c => {
  await load(c);
  const dep = await person(c, 'camara', '880006'), sen = await person(c, 'senado', '880007');
  await cw(c, '8801', dep, 'EXACT', true, 'camara', '2031-01-01', '2031-12-31'); await cw(c, '8802', sen, 'EXACT', true, 'senado', '2032-01-01', '2032-12-31');
  const only = await parliamentarianPixWith(c, 'senado', '880007'); if (only.status !== 'available') throw new Error('esperava dados'); assert.equal(only.summary.financials.destinedAmount, 20000);
  await c.query(`INSERT INTO civica.identity_links(id,person_a,person_b,status,evidence) VALUES('pix-prof-link',$1,$2,'confirmed','{}')`, [dep, sen]);
  const merged = await parliamentarianPixWith(c, 'senado', '880007'); if (merged.status !== 'available') throw new Error('esperava dados');
  assert.equal(merged.summary.financials.destinedAmount, 470000); assert.deepEqual(merged.summary.authorCodes.map(x => x.authorCode), ['8801', '8802']);
  const story = buildPixStory(merged.summary, { currentYear: 2032 });
  assert.match(story.authorship, /8801 \(Câmara, 2031\); 8802 \(Senado, 2032\)/); assert.equal(story.years.hasOngoing, true);
}));

test('modelo de apresentação: moeda, proporção, nomes e paginação sem inventar', () => {
  assert.equal(brlCompact(150_760_417.08), 'R$ 150,8 mi'); assert.equal(brlCompact(3_500_000), 'R$ 3,50 mi'); assert.equal(brlCompact(748_000), 'R$ 748 mil'); assert.equal(brlCompact(950), 'R$ 950'); assert.equal(brlCompact(null), '—');
  assert.deepEqual(beneficiaryLabel('MUNICIPIO DE SAO BORJA', 'municipio'), { title: 'Sao Borja', kind: 'Município', original: 'MUNICIPIO DE SAO BORJA' });
  assert.equal(beneficiaryLabel('MUNICIPIO DE SAO BORJA', 'municipio', 'SÃO BORJA').title, 'São Borja');
  assert.equal(beneficiaryLabel('ESTADO DA PARAIBA', 'estado').title, 'Paraiba'); assert.equal(beneficiaryLabel('FUNDACAO X', 'outro').kind, 'Outro ente'); assert.equal(beneficiaryLabel(null, null).title, 'Beneficiário não informado');
});

test('estrutura: a seção só é consultada na rota de atuação e nenhuma regra de identidade existe no web', () => {
  const page = readFileSync('apps/web/components/parliamentarian-profile-page.tsx', 'utf8');
  assert.match(page, /section==='activity'\?getPix\(source,id\):null/); assert.match(page, /<PixProfileSection data=\{pixData\}/);
  assert.match(readFileSync('apps/web/app/globals.css', 'utf8'), /data-profile-section="activity"\][^{]*:not\(:has\(#emendas-pix\)\)/);
  for (const file of ['apps/web/lib/data-postgres-pix.ts', 'apps/web/components/pix-profile-section.tsx', 'apps/web/lib/pix-profile-model.ts']) {
    const src = readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /proposal_authors|ILIKE|search_name|LIKE '%/, `${file} não casa por nome`);
    assert.doesNotMatch(src, /author_code_crosswalk(?![\s\S]*NOT reviewed)/, `${file}: o crosswalk só aparece no diagnóstico de revisão pendente`);
  }
});
