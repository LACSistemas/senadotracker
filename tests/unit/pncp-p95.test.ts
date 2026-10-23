import assert from 'node:assert/strict';
import test from 'node:test';
import { THEME_PATRIMONIAL, buildContract, classifyOrgan, classifyTheme, contractIndicators, transferIndicators, type ContractCtx, type PncpContract } from '../../packages/db/src/exec/index.ts';

test('órgão de segurança por nome e esfera; segurança alimentar/do trabalho, Defesa Nacional e prefeitura genérica ficam de fora', () => {
  const k = (n: string, e: string, u = '') => classifyOrgan(n, u, e);
  assert.equal(k('SECRETARIA DE ESTADO DE SEGURANÇA PÚBLICA', 'E'), 1); assert.equal(k('SECRETARIA DE ESTADO DA JUSTIÇA E SEGURANÇA PÚBLICA', 'E'), 1); assert.equal(k('POLÍCIA MILITAR DO ESTADO DE MINAS GERAIS', 'E'), 2);
  assert.equal(k('POLICIA CIVIL DO ESTADO', 'E'), 3); assert.equal(k('CORPO DE BOMBEIROS MILITAR', 'E'), 4); assert.equal(k('SECRETARIA DE ADMINISTRAÇÃO PENITENCIÁRIA', 'E'), 5);
  assert.equal(k('POLÍCIA CIENTÍFICA DO ESTADO', 'E'), 6); assert.equal(k('MINISTERIO DA JUSTICA E SEGURANCA PUBLICA', 'F'), 8); assert.equal(k('SECRETARIA MUNICIPAL DE SEGURANÇA URBANA', 'M'), 7); assert.equal(k('MUNICIPIO X', 'M', 'GUARDA CIVIL MUNICIPAL'), 7);
  assert.equal(k('ESTADO DA BAHIA', 'E', 'GUARDA CIVIL MUNICIPAL'), 7, 'guarda municipal é 7 em qualquer esfera não federal');
  for (const n of ['SECRETARIA DE SEGURANÇA ALIMENTAR', 'SECRETARIA MUNICIPAL DE SAÚDE', 'PREFEITURA MUNICIPAL DE VITÓRIA', 'COMANDO DO EXÉRCITO', 'MINISTÉRIO DA DEFESA', 'UNIVERSIDADE FEDERAL', 'SECRETARIA DO TRABALHO E SEGURANÇA DO TRABALHO']) assert.equal(k(n, n.includes('MUNICIPAL') || n.includes('PREFEITURA') ? 'M' : 'F'), 0, n);
});
test('tema do objeto: palavras fortes valem sozinhas; genéricas exigem contexto policial; vigilância patrimonial é fora do tema', () => {
  assert.equal(classifyTheme('Aquisição de viaturas policiais ostensivas', 0), 1); assert.equal(classifyTheme('Manutenção de viatura administrativa', 0), 0); assert.equal(classifyTheme('Colete balístico nível III-A', 0), 2);
  assert.equal(classifyTheme('Fornecimento de uniformes escolares', 0), 0); assert.equal(classifyTheme('Fornecimento de uniformes', 2), 4); assert.equal(classifyTheme('Uniformes para a Polícia Judicial', 0), 4);
  assert.equal(classifyTheme('Reforma da delegacia de polícia civil', 0), 7); assert.equal(classifyTheme('Reforma da delegacia da Receita Federal', 0), 0); assert.equal(classifyTheme('Serviços de vigilância patrimonial armada', 0), THEME_PATRIMONIAL);
  assert.equal(classifyTheme('Refeições para a penitenciária estadual', 0), 8); assert.equal(classifyTheme('Câmeras de monitoramento para escola', 0), 0); assert.equal(classifyTheme('Sistema de videomonitoramento', 5), 6);
});
const ctx: ContractCtx = { ufCode: a => ({ ES: 32, SP: 35 } as Record<string, number>)[a], entityByIbge7: new Map([[3205309, 3205309]]), entityByUf: new Map([[32, 32], [35, 35]]), brEntity: 76 };
const c = (o: Partial<PncpContract> & { org?: string; esfera?: string; obj?: string; ibge?: string; uf?: string }): PncpContract => ({ numeroControlePNCP: 'X-1', orgaoEntidade: { cnpj: '27080571000130', esferaId: o.esfera ?? 'E', razaoSocial: o.org ?? 'SECRETARIA DE ESTADO DA SEGURANÇA PÚBLICA' }, unidadeOrgao: { ufSigla: o.uf ?? 'ES', codigoIbge: o.ibge ?? '3205309', nomeUnidade: 'X' },
  niFornecedor: '12345678000190', nomeRazaoSocialFornecedor: 'FORNECEDOR LTDA', tipoPessoa: 'PJ', tipoContrato: { id: 1 }, categoriaProcesso: { id: 3 }, objetoContrato: o.obj ?? 'Aquisição de material de expediente', valorGlobal: 1234.56, valorInicial: 1000, dataAssinatura: '2024-03-01', ...o });
test('contrato: vínculo institucional × temático, PF nunca persistida, empenho só no tipo Empenho, valor em centavos, sem texto do objeto', () => {
  const a = buildContract(c({}), 2024, ctx); assert.ok(!('drop' in a)); if ('drop' in a) return;
  assert.equal(a.row.link, 1); assert.equal(a.row.org_kind, 1); assert.equal(a.row.entity_id, 32); assert.equal(a.row.valor_global, 123456); assert.equal(a.row.supplier, 12345678000190); assert.equal(a.row.empenho, null); assert.ok(!('objeto' in a.row) && !JSON.stringify(a.row).includes('expediente'));
  const both = buildContract(c({ obj: 'Aquisição de viaturas policiais' }), 2024, ctx); assert.ok(!('drop' in both) && both.row.link === 3);
  const thematic = buildContract(c({ org: 'SECRETARIA DE ESTADO DA SAÚDE', obj: 'Colete balístico' }), 2024, ctx); assert.ok(!('drop' in thematic) && thematic.row.link === 2 && thematic.row.org_kind === 0);
  const pf = buildContract(c({ tipoPessoa: 'PF', niFornecedor: '12345678901' }), 2024, ctx); assert.ok(!('drop' in pf) && pf.row.supplier === null && pf.supplier === null);
  const emp = buildContract(c({ tipoContrato: { id: 7 }, numeroContratoEmpenho: '2024NE000123' }), 2024, ctx); assert.ok(!('drop' in emp) && emp.row.empenho === '2024NE000123');
  assert.deepEqual(buildContract(c({ org: 'SECRETARIA DE ESTADO DA SAÚDE' }), 2024, ctx), { drop: 'nao_seguranca' });
  assert.deepEqual(buildContract(c({ org: 'COMANDO DO EXÉRCITO', obj: 'viaturas policiais' }), 2024, ctx), { drop: 'nao_seguranca' });
  assert.deepEqual(buildContract(c({ org: 'SECRETARIA DE ESTADO DA SAÚDE', obj: 'Serviço de vigilância patrimonial armada' }), 2024, ctx), { drop: 'nao_seguranca' });
  assert.deepEqual(buildContract(c({ esfera: 'M', ibge: '9999999', org: 'SECRETARIA MUNICIPAL DE SEGURANÇA URBANA' }), 2024, ctx), { drop: 'sem_ente' });
  const fed = buildContract(c({ esfera: 'F', org: 'MINISTERIO DA JUSTICA E SEGURANCA PUBLICA' }), 2024, ctx); assert.ok(!('drop' in fed) && fed.row.entity_id === 76 && fed.row.org_kind === 8);
});
test('indicadores de contratos e transferências: ausência não é zero, valores em reais, preliminar no ano corrente', () => {
  const rows = [{ entity_id: 5, link: 1, valor_global: 10000, supplier: 1, empenho: null }, { entity_id: 5, link: 3, valor_global: 5000, supplier: 1, empenho: 'E1' }, { entity_id: 5, link: 2, valor_global: 700, supplier: 2, empenho: null }, { entity_id: 6, link: 2, valor_global: 300, supplier: null, empenho: null }];
  const ind = contractIndicators(rows, 2024, false); const v = (e: number, i: number) => ind.find(x => x.entity_id === e && x.indicator_id === i)?.value;
  assert.equal(v(5, 7061), 2); assert.equal(v(5, 7062), 150); assert.equal(v(5, 7063), 1); assert.equal(v(5, 7064), 2); assert.equal(v(5, 7065), 57); assert.equal(v(5, 7066), 1); assert.equal(v(6, 7061), undefined); assert.equal(v(6, 7064), 1); assert.ok(ind.every(i => i.status === 2));
  assert.ok(contractIndicators(rows, 2026, true).every(i => i.status === 1));
  const t = transferIndicators([{ entity_id: 1, year: 2024, conv_status: 1, v_global_conv: 100000, v_repasse_conv: 90000, v_desembolsado_conv: 0 }, { entity_id: 1, year: 2024, conv_status: 2, v_global_conv: 50000, v_repasse_conv: 40000, v_desembolsado_conv: 20000 }, { entity_id: null, year: 2024, conv_status: 1, v_global_conv: 1, v_repasse_conv: 1, v_desembolsado_conv: 1 }, { entity_id: 2, year: 2024, conv_status: 0, v_global_conv: null, v_repasse_conv: null, v_desembolsado_conv: null }], 2024, false);
  const tv = (i: number) => t.find(x => x.entity_id === 1 && x.indicator_id === i)?.value; assert.equal(tv(7071), 2); assert.equal(tv(7072), 1500); assert.equal(tv(7073), 1300); assert.equal(tv(7074), 200); assert.equal(t.filter(x => x.entity_id !== 1).length, 0);
});
