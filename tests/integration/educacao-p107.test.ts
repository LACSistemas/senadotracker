import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import {
  DATASET, applyExecMigrations, buildEduContract, getEduContractCoverage, getEduContractDetail, getEduContractList, getEduContractsTerritory, getEduOrgan, getEduSchoolContracts, getEduSupplier, getEduSuppliers, getEduWorkDetail, getEduWorks, buildProcurement, buildTerm, buildWorks, rollbackRun, sha256,
  type EduPncpContract, type ObraProject, type Row,
} from '../../packages/db/src/exec/index.ts';
import { loadContractCtx } from '../../apps/collector/src/exec/contratos.ts';
import { publishEduContractSlice, type EduSlice } from '../../apps/collector/src/exec/educacao-contratos.ts';
import { publishProcurementSlice, publishTermSlice } from '../../apps/collector/src/exec/educacao-complemento.ts';
import { publishWorkSlice } from '../../apps/collector/src/exec/educacao-obras-publish.ts';
import { ADMIN_URL, createTestDb, seedMiniTerritory } from '../helpers/exec-db.ts';

const skip = ADMIN_URL ? false : 'EXEC_TEST_ADMIN_URL não definido';
let ctx: Awaited<ReturnType<typeof createTestDb>>; let pool: Pool;
test.before(async () => { if (skip) return; ctx = await createTestDb(); pool = ctx.pool; assert.equal((await seedMiniTerritory(pool)).status, 'PUBLISHED'); });
test.after(async () => { if (!skip) await ctx.drop(); });

const hash = async (sql: string) => String((await pool.query(`SELECT md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) h FROM (${sql}) t`)).rows[0].h);
const logCount = async () => Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_change_log`)).rows[0].n);
const firstOf = async (ds: number, uf: number, comp: number) => (await pool.query(`SELECT 1 FROM civica_exec.exec_publication WHERE dataset_id = $1 AND uf = $2 AND competence = $3`, [ds, uf, comp])).rowCount === 0;
const P107 = ['exec_edu_contract', 'exec_edu_contract_class', 'exec_edu_procurement', 'exec_edu_contract_term', 'exec_edu_work', 'exec_edu_work_commit', 'exec_edu_contract_audit', 'exec_edu_ctr_cov'];
const state = async () => (await Promise.all(P107.map(t => hash(`SELECT * FROM civica_exec.${t}`)))).join('|');

const ORG = { cnpj: '27142058000126', esferaId: 'M', razaoSocial: 'MUNICIPIO DE VITORIA' };
const mk = (n: number, o: Partial<EduPncpContract> = {}): EduPncpContract => ({
  numeroControlePNCP: `27142058000126-2-${String(n).padStart(6, '0')}/2025`, anoContrato: 2025, sequencialContrato: n, orgaoEntidade: ORG,
  unidadeOrgao: { ufSigla: 'ES', codigoIbge: '3205309', nomeUnidade: 'Secretaria Municipal de Educação' }, objetoContrato: 'Aquisição de gêneros alimentícios para merenda escolar',
  valorGlobal: 1000 + n, valorInicial: 1000 + n, tipoContrato: { id: 1 }, niFornecedor: '12345678000190', nomeRazaoSocialFornecedor: 'FORNECEDOR LTDA', tipoPessoa: 'PJ',
  numeroControlePncpCompra: `27142058000126-1-0000${n}/2025`, ...o,
} as EduPncpContract);

async function slice(contracts: EduPncpContract[]): Promise<{ s: EduSlice; suppliers: Array<{ cnpj: number; name: string }> }> {
  const c = await loadContractCtx(pool); const rows: Row[] = [], classes: Row[] = []; const sup = new Map<number, string>(); let rejected = 0;
  for (const x of contracts) {
    const r = buildEduContract(x, 2025, c); if ('drop' in r) { rejected++; continue; }
    rows.push(r.row); classes.push(...r.classes); if (r.supplier) sup.set(r.supplier.cnpj, r.supplier.name);
  }
  return { s: { rows, classes, in: contracts.length, rejected, noValue: rows.filter(r => r.valor_global == null).length }, suppliers: [...sup].map(([cnpj, name]) => ({ cnpj, name })) };
}
const pubCtr = async (contracts: EduPncpContract[], tag: string, fail = false) => {
  const { s, suppliers } = await slice(contracts);
  return publishEduContractSlice(pool, { year: 2025, uf: 32, slice: s, suppliers, fingerprint: sha256(JSON.stringify(s.rows) + JSON.stringify(s.classes) + tag), first: await firstOf(DATASET.edu_contract, 32, 202512), current: false, inputs: { tag }, quality: { rowsIn: s.in, valid: s.rows.length, rejected: s.rejected }, ...(fail ? { failAfterApply: true } : {}) });
};

test('migração v16: 8 tabelas aditivas, sem coluna pessoal, versão registrada, idempotente', { skip }, async () => {
  assert.deepEqual(await applyExecMigrations(pool), []);
  assert.ok((await pool.query(`SELECT version FROM civica_exec.schema_migrations`)).rows.some(x => x.version === 16));
  const tabs = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'civica_exec' AND table_name ~ '^exec_edu_(contract|procurement|work|ctr_cov)'`)).rows.map(r => String(r.table_name)).sort();
  assert.deepEqual(tabs, [...P107].sort());
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name = ANY($1)`, [P107])).rows.map(r => String(r.column_name));
  for (const bad of ['cpf', 'cns', 'aluno_id', 'estudante', 'professor', 'email', 'telefone', 'endereco', 'nome_pf', 'ni_fornecedor']) assert.ok(!cols.includes(bad), bad);
});

test('contratos: publica, NO_CHANGE sem log, retifica com log, rollback restaura, falha injetada não deixa rastro; PF nunca persistida', { skip }, async () => {
  const set1 = [mk(1), mk(2, { objetoContrato: 'Reforma da Escola Municipal Alfa', valorGlobal: 250000 }), mk(3, { tipoPessoa: 'PF', niFornecedor: '12345678901', nomeRazaoSocialFornecedor: 'MARIA DA SILVA SANTOS', objetoContrato: 'Merenda escolar com MARIA DA SILVA SANTOS' }),
    mk(4, { objetoContrato: 'Locação de veículo', unidadeOrgao: { ufSigla: 'ES', codigoIbge: '3205309', nomeUnidade: 'Secretaria de Obras' }, orgaoEntidade: { ...ORG, razaoSocial: 'MUNICIPIO DE VITORIA' } })];
  const r1 = await pubCtr(set1, 'v1'); assert.equal(r1.status, 'PUBLISHED');
  assert.equal(await logCount(), 0, 'carga inicial sem change log');
  const n = (await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract`)).rows[0].n; assert.equal(n, 3, 'contrato de obras sem tema educacional fica de fora');
  assert.equal((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract WHERE supplier IS NULL`)).rows[0].n, 1, 'PF sem fornecedor persistido');
  const txt = (await pool.query(`SELECT string_agg(objeto, ' ') t FROM civica_exec.exec_edu_contract`)).rows[0].t as string; assert.ok(!/MARIA|SANTOS/.test(txt));
  const s0 = await state();
  assert.equal((await pubCtr(set1, 'v1')).status, 'NO_CHANGE'); assert.equal(await logCount(), 0); assert.equal(await state(), s0);
  const set2 = [mk(1, { valorGlobal: 9999 }), ...set1.slice(1)];
  const r2 = await pubCtr(set2, 'v2'); assert.equal(r2.status, 'PUBLISHED'); assert.ok(await logCount() > 0, 'retificação grava change log');
  assert.equal(Number((await pool.query(`SELECT valor_global v FROM civica_exec.exec_edu_contract WHERE seq = 1`)).rows[0].v), 999900);
  assert.notEqual(await state(), s0);
  if (r2.status === 'PUBLISHED') { await rollbackRun(pool, r2.runId); assert.equal(await state(), s0, 'rollback restaura o estado anterior'); }
  const before = await state(); const logBefore = await logCount();
  await assert.rejects(pubCtr([mk(1, { valorGlobal: 123 }), ...set1.slice(1)], 'v3', true), /falha injetada/);
  assert.equal(await state(), before, 'falha injetada não deixa rastro'); assert.equal(await logCount(), logBefore);
  const orphan = await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_class k WHERE NOT EXISTS (SELECT 1 FROM civica_exec.exec_edu_contract x WHERE x.pncp_id = k.pncp_id)`); assert.equal(orphan.rows[0].n, 0);
});

test('contratação e termos: valor estimado ≠ homologado ≠ contratado; sigilo vira NULL; NO_CHANGE e falha injetada', { skip }, async () => {
  const p = buildProcurement({ numeroControlePNCP: '27142058000126-1-00001/2025', anoCompra: 2025, valorTotalEstimado: 1000, valorTotalHomologado: 900, orcamentoSigilosoCodigo: 1, modalidadeId: 8, orgaoEntidade: { cnpj: '27142058000126' }, objetoCompra: 'Merenda' }, { uf: 32, entity_id: 3205309 });
  assert.ok(!('drop' in p));
  const sig = buildProcurement({ numeroControlePNCP: '27142058000126-1-00002/2025', anoCompra: 2025, valorTotalEstimado: 50, valorTotalHomologado: 40, orcamentoSigilosoCodigo: 2, orgaoEntidade: { cnpj: '27142058000126' } }, { uf: 32, entity_id: 3205309 });
  assert.ok(!('drop' in sig));
  const ps = { year: 2025, uf: 32, rows: [p as Row, sig as Row], expected: 3, fetched: 2, rejected: 0, noValue: 1 };
  assert.equal((await publishProcurementSlice(pool, ps, { first: await firstOf(DATASET.edu_procurement, 32, 202512) })).status, 'PUBLISHED');
  const row = (await pool.query(`SELECT valor_estimado e, valor_homologado h, sigiloso FROM civica_exec.exec_edu_procurement WHERE compra = '27142058000126-1-00001/2025'`)).rows[0];
  assert.equal(Number(row.e), 100000); assert.equal(Number(row.h), 90000);
  const sg = (await pool.query(`SELECT valor_estimado e, valor_homologado h, sigiloso FROM civica_exec.exec_edu_procurement WHERE compra = '27142058000126-1-00002/2025'`)).rows[0]; assert.equal(sg.e, null); assert.equal(sg.h, null); assert.equal(sg.sigiloso, true);
  const cov = (await pool.query(`SELECT pending FROM civica_exec.exec_edu_ctr_cov WHERE kind = 2 AND uf = 32 AND year = 2025`)).rows[0]; assert.equal(Number(cov.pending), 1, 'cobertura declara a compra que ainda não foi coletada');
  assert.equal((await publishProcurementSlice(pool, ps, { first: false })).status, 'NO_CHANGE');
  const t = buildTerm('27142058000126-2-000001/2025', 2025, 32, { sequencialTermoContrato: 1, tipoTermoContratoNome: 'Termo Aditivo', valorAcrescido: 10.5, prazoAditadoDias: 90 });
  const ts = { year: 2025, uf: 32, rows: [t as Row], expected: 1, fetched: 1, withTerms: 1, rejected: 0 };
  assert.equal((await publishTermSlice(pool, ts, { first: await firstOf(DATASET.edu_term, 32, 202512) })).status, 'PUBLISHED');
  assert.equal((await publishTermSlice(pool, ts, { first: false })).status, 'NO_CHANGE');
  const before = await state(); await assert.rejects(publishTermSlice(pool, { ...ts, rows: [{ ...(t as Row), valor_acrescido: 99 }] }, { first: false, failAfterApply: true, tag: 'x' }), /falha injetada/); assert.equal(await state(), before);
});

test('obras: empenho ≠ pago, vínculo com contrato só por CIPI, sem escola/município; publica, NO_CHANGE e falha injetada', { skip }, async () => {
  const proj = (o: Partial<ObraProject>): ObraProject => ({ idUnico: '1.1-1', nome: 'CMEI Guilherme', uf: 'ES', situacao: 'Concluída', executores: [{ nome: 'FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCAÇÃO', codigo: 253 }], fontesDeRecurso: [{ origem: 'Federal', valorInvestimentoPrevisto: 0.01 }], ...o } as ObraProject);
  const c = await loadContractCtx(pool);
  const b = buildWorks([proj({}), proj({ idUnico: '4.4-4', nome: 'Escola Municipal Alfa', executores: [{ nome: 'PREFEITURA' }], fontesDeRecurso: [{ valorInvestimentoPrevisto: 2000 }] })],
    [{ idUnico: '1.1-1', percentual: 98, dataSituacao: '2018-05-23' }], [{ idProjetoInvestimento: '1.1-1', valorEmpenho: 301198.71, numeroNotaEmpenhoGerada: '2025NE000300', ugEmitente: '160017' }], new Set(), { ufCode: a => ({ ES: 32 }[a as 'ES']), entityByUf: c.entityByUf, year: 2026 });
  const sl = b.bySlice.get(32)!; assert.equal(sl.works.length, 2);
  const args = { uf: 32, competence: 202610, slice: sl, pending: 2, first: await firstOf(DATASET.edu_work, 32, 202610) };
  assert.equal((await publishWorkSlice(pool, args)).status, 'PUBLISHED');
  const w = (await pool.query(`SELECT committed, phys_percent, valor_placeholder FROM civica_exec.exec_edu_work WHERE work_id = '1.1-1'`)).rows[0];
  assert.equal(Number(w.committed), 30119871); assert.equal(Number(w.phys_percent), 98); assert.equal(w.valor_placeholder, true);
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name IN ('exec_edu_work', 'exec_edu_work_commit')`)).rows.map(r => String(r.column_name));
  assert.ok(!cols.includes('paid') && !cols.includes('pago') && !cols.includes('inep'), 'obra não tem valor pago nem INEP inventado');
  assert.equal((await pool.query(`SELECT pending FROM civica_exec.exec_edu_ctr_cov WHERE kind = 4 AND uf = 32`)).rows[0].pending, 2);
  assert.equal((await publishWorkSlice(pool, { ...args, first: false })).status, 'NO_CHANGE');
  const before = await state(); await assert.rejects(publishWorkSlice(pool, { ...args, first: false, failAfterApply: true, tag: 'x', slice: { ...sl, works: sl.works.slice(0, 1) } }), /falha injetada/); assert.equal(await state(), before);
});

test('leituras: Brasil, UF e município batem entre si; contratado ≠ estimado ≠ homologado; sem valor não vira zero; escola sem INEP não tem vínculo', { skip }, async () => {
  const br = await getEduContractsTerritory(pool, {}); const uf = await getEduContractsTerritory(pool, { ufCode: 32 }); const vit = await getEduContractsTerritory(pool, { ibge7: '3205309' });
  assert.ok(br && uf && vit);
  assert.equal(vit!.scope.kind, 'municipio'); assert.equal(uf!.scope.kind, 'uf'); assert.equal(br!.scope.kind, 'brasil');
  assert.equal(vit!.total.highAndConfirmed.contracts, 3); assert.equal(uf!.total.highAndConfirmed.contracts, 3); assert.equal(br!.total.highAndConfirmed.contracts, 3);
  assert.equal(vit!.total.highAndConfirmed.contractedValue, 1001 + 250000 + 1003 > 0 ? 1001 + 250000 + 1003 : 0, 'soma só dos contratos com valor, em reais');
  assert.equal(vit!.total.highAndConfirmed.withValue, 3); assert.equal(vit!.total.possible.contracts, 0);
  assert.ok(vit!.byCategory.every(c => c.categoryLabel.length > 0));
  assert.equal(vit!.byCategory.filter(c => c.category === 8).reduce((a, c) => a + c.contracts, 0), 2, 'merenda: contratos 1 e 3');
  assert.equal(await getEduContractsTerritory(pool, { ufCode: 35 }), null, 'UF sem contrato educacional = null, não zero');
  const list = await getEduContractList(pool, { ibge7: '3205309', limit: 2 }); assert.equal(list!.rows.length, 2); assert.ok(list!.rows[0]!.contractedValue! >= list!.rows[1]!.contractedValue!, 'ordem por valor contratado');
  assert.equal((await getEduContractList(pool, { ibge7: '3205309', category: 2 }))!.rows.length, 1);
  const first = (await getEduContractList(pool, { ibge7: '3205309' }))!.rows.find(r => r.object.includes('gêneros'))!; const det = await getEduContractDetail(pool, first.pncpId);
  assert.ok(det!.classes.length >= 1 && det!.classes.every(k => k.evidence !== undefined));
  assert.equal(det!.procurement?.estimatedValue, 1000); assert.equal(det!.procurement?.approvedValue, 900); assert.equal(det!.contract.contractedValue, 1001, 'contratado ≠ estimado ≠ homologado');
  assert.equal(det!.work, null, 'sem CIPI não há obra vinculada');
  const sup = await getEduSuppliers(pool, { ufCode: 32 }); assert.equal(sup!.rows.length, 1); assert.equal(sup!.rows[0]!.cnpj, '12345678000190'); assert.equal(sup!.rows[0]!.contracts, 2, 'a PF não aparece como fornecedor');
  assert.equal((await getEduSupplier(pool, '12345678000190'))!.byYear[0]!.contracts, 2); assert.equal(await getEduSupplier(pool, '12345678901'), null);
  assert.equal((await getEduOrgan(pool, '27142058000126'))!.byYear[0]!.contracts, 3);
  const cov = await getEduContractCoverage(pool, { kind: 1 }); assert.equal(cov.rows[0]!.rowsIn, 4); assert.equal(cov.rows[0]!.rowsOut, 3); assert.equal(cov.rows[0]!.rejected, 1);
  assert.equal(await getEduSchoolContracts(pool, 32000001), null, 'escola inexistente');
  const w = await getEduWorks(pool, { ufCode: 32 }); assert.equal(w!.total, 2); assert.equal(w!.coverage!.pendingPages, 2);
  const wd = await getEduWorkDetail(pool, '1.1-1'); assert.equal(wd!.commitments.length, 1); assert.equal(wd!.commitments[0]!.value, 301198.71); assert.equal(wd!.work.committed, 301198.71);
  assert.equal(await getEduWorkDetail(pool, 'x'), null);
});

test('ondas anteriores intactas: nenhuma tabela de Segurança, Finanças ou Educação P10.1–P10.4 foi tocada pela v16', { skip }, async () => {
  const q = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'civica_exec' AND table_name !~ '^exec_edu_(contract|procurement|work|ctr_cov)'`);
  assert.ok(q.rowCount! > 20);
  const fk = await pool.query(`SELECT conrelid::regclass::text t FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text ~ '^civica_exec\\.exec_edu_(contract|procurement|work)' AND confrelid::regclass::text !~ '^civica_exec\\.(exec_entity|exec_fin_supplier|exec_edu_contract|exec_edu_work|exec_dataset|exec_ingestion_run)$'`);
  assert.equal(fk.rowCount, 0, fk.rows.map(r => r.t).join(','));
});
