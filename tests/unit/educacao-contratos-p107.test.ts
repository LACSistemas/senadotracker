import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EDU_CONFIDENCE, buildEduContract, buildProcurement, buildTerm, buildWorks, classifyBuyer, classifyEducationContract, classifyWork, sanitizeObjeto,
  type ContractCtx, type EduPncpContract, type ObraProject,
} from '../../packages/db/src/exec/index.ts';

const ctx: ContractCtx = { ufCode: a => ({ ES: 32, SP: 35 }[a]), entityByIbge7: new Map([[3205309, 3205309], [3550308, 3550308]]), entityByUf: new Map([[32, 32], [35, 35]]), brEntity: 76 };
const cat = (objeto: string, org: string, un: string, esf = 'M') => classifyEducationContract(objeto, org, un, esf).classes.map(c => `${c.category}/${c.confidence}/${c.via}`);

test('comprador: secretaria, fundo, departamento, unidade escolar e MEC/FNDE; defesa, hospital-escola e superior ficam fora', () => {
  assert.equal(classifyBuyer('MUNICIPIO DE VITORIA', 'Secretaria Municipal de Educação', 'M').kind, 2);
  assert.equal(classifyBuyer('FUNDO MUNICIPAL DE EDUCACAO DE X', 'FME', 'M').kind, 3);
  assert.equal(classifyBuyer('PREFEITURA', 'Departamento Municipal de Educação', 'M').kind, 4);
  assert.equal(classifyBuyer('ESTADO DO CEARA', 'EEEP MARIO ALENCAR', 'E').kind, 5, 'EEEP/EEFM/EEMTI são escolas estaduais de educação básica (Ceará)');
  assert.equal(classifyBuyer('ESTADO DO CEARA', 'EEXX QUALQUER', 'E').kind, 0, 'sigla desconhecida não basta');
  assert.equal(classifyBuyer('MUNICIPIO DE X', 'EMEF João da Silva', 'M').kind, 5);
  const fnde = classifyBuyer('FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCACAO', 'FNDE', 'F'); assert.deepEqual([fnde.kind, fnde.confirmed], [1, true]);
  assert.equal(classifyBuyer('UNIVERSIDADE FEDERAL DE X', 'Reitoria', 'F').superior, true);
  assert.equal(classifyBuyer('COMANDO DA MARINHA', 'Escola Naval', 'F').kind, 0);
  assert.equal(classifyBuyer('MUNICIPIO DE X', 'Escola de Governo', 'M').kind, 0);
});

test('objeto: palavra genérica não basta; precisa de contexto escolar ou de comprador de educação', () => {
  assert.deepEqual(cat('Aquisição de computadores', 'PREFEITURA MUNICIPAL', 'Secretaria de Obras'), []);
  assert.deepEqual(cat('Aquisição de computadores', 'PREFEITURA MUNICIPAL', 'Secretaria Municipal de Educação'), ['16/2/1'], 'comprador de educação, objeto genérico: sem tema');
  assert.deepEqual(cat('Aquisição de computadores para as escolas da rede municipal de ensino', 'PREFEITURA', 'Secretaria de Administração'), ['6/2/2']);
  assert.deepEqual(cat('Gêneros alimentícios para merenda escolar', 'MUNICIPIO', 'Secretaria Municipal de Educação'), ['8/2/3']);
  assert.deepEqual(cat('Transporte escolar rural', 'PREFEITURA', 'Secretaria de Administração'), ['9/2/2']);
  assert.deepEqual(cat('Reforma da Escola Municipal João da Silva', 'PREFEITURA', 'Secretaria de Obras'), ['2/2/2']);
  assert.deepEqual(cat('Construção de creche tipo B', 'PREFEITURA', 'Secretaria de Obras'), ['1/2/2']);
  assert.deepEqual(cat('Aquisição de material de construção para manutenção das escolas municipais', 'PREFEITURA', 'Secretaria de Obras'), ['3/2/2'], '"material de construção" é manutenção, não construção de escola');
  assert.deepEqual(cat('MATERIAIS DE EXPEDIENTE, ESCOLAR E DE ARTESANATO - LEI 14.133/2021', 'MUNICIPIO DE BLUMENAU', 'MUNICÍPIO DE BLUMENAU'), [], 'material de expediente genérico de prefeitura não é educação');
});

test('exclusões: escola de governo, hospital universitário, ensino superior e forças armadas nunca viram educação básica', () => {
  assert.deepEqual(cat('Curso na Escola de Governo', 'GOVERNO DO ESTADO', 'Secretaria de Educação', 'E'), []);
  assert.deepEqual(cat('Aquisição de ventilador pulmonar', 'UNIVERSIDADE FEDERAL', 'Hospital Universitário', 'F'), []);
  assert.deepEqual(cat('Contratação de profissional docente para o curso da Escola de Serviço Público', 'ESCOLA DE SERVICO PUBLICO', 'ESCOLA DE SERVICO PUBLICO', 'E'), []);
  assert.deepEqual(cat('Reforma de espaço da UFMS para a construção do laboratório', 'FUNDACAO DE APOIO', 'FUNDACAO DE APOIO', 'M'), []);
  assert.deepEqual(cat('Fornecimento de uniformes para guarda municipal', 'PREFEITURA', 'Guarda Municipal'), []);
});

test('confiança: MEC/FNDE = CONFIRMED_OFFICIAL; unidade escolar nomeada sem tema = alta; marcador fraco = POSSIBLE', () => {
  assert.equal(classifyEducationContract('Serviço de limpeza', 'FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCACAO', 'FNDE', 'F').classes[0]!.confidence, EDU_CONFIDENCE.CONFIRMED_OFFICIAL);
  assert.deepEqual(cat('Serviço de pintura em muro da Escola Bromildo Lawisch', 'MUNICIPIO DE ITANHANGA', 'MUNICIPIO DE ITANHANGA'), ['16/2/2']);
  assert.deepEqual(cat('Aquisição de materiais para atendimento dos alunos', 'MUNICIPIO', 'Secretaria'), ['16/3/2']);
});

test('contrato educacional: ente, valor contratado em centavos, fornecedor PJ, CIPI e saneamento (pessoa física e CPF nunca persistidos)', () => {
  const base: EduPncpContract = { numeroControlePNCP: '1-2-000001/2025', anoContrato: 2025, sequencialContrato: 1, orgaoEntidade: { cnpj: '27142058000126', esferaId: 'M', razaoSocial: 'MUNICIPIO DE VITORIA' }, unidadeOrgao: { ufSigla: 'ES', codigoIbge: '3205309', nomeUnidade: 'Secretaria Municipal de Educação' }, objetoContrato: 'Merenda escolar', valorGlobal: 1234.56, valorInicial: 1000, tipoContrato: { id: 1 }, categoriaProcesso: { id: 1 }, tipoPessoa: 'PJ', niFornecedor: '12345678000190', nomeRazaoSocialFornecedor: 'EMPRESA X LTDA', identificadorCipi: ' 123.45-67 ', numeroControlePncpCompra: '27142058000126-1-000010/2025' };
  const r = buildEduContract(base, 2025, ctx); assert.ok(!('drop' in r)); if ('drop' in r) return;
  assert.ok(r.classes.every(k => k.year === 2025 && k.uf === 32), 'classe carrega a fatia (year/uf)'); assert.equal(r.row.valor_global, 123456); assert.equal(r.row.entity_id, 3205309); assert.equal(r.row.supplier, 12345678000190); assert.equal(r.row.cipi, '123.45-67'); assert.equal(r.row.compra, '27142058000126-1-000010/2025'); assert.equal(r.classes[0]!.category, 8);
  const pf = buildEduContract({ ...base, tipoPessoa: 'PF', niFornecedor: '12345678901', nomeRazaoSocialFornecedor: 'MARIA DA SILVA SANTOS', objetoContrato: 'Contratação de MARIA DA SILVA SANTOS, CPF 123.456.789-01, para merenda escolar' }, 2025, ctx);
  assert.ok(!('drop' in pf)); if (!('drop' in pf)) { assert.equal(pf.row.supplier, null); assert.equal(pf.supplier, null); assert.ok(!/MARIA|SANTOS|123\.456/.test(String(pf.row.objeto)), String(pf.row.objeto)); }
  assert.deepEqual(buildEduContract({ ...base, orgaoEntidade: { ...base.orgaoEntidade!, razaoSocial: 'UNIVERSIDADE FEDERAL X', esferaId: 'F' } }, 2025, ctx), { drop: 'ensino_superior' });
  assert.deepEqual(buildEduContract({ ...base, objetoContrato: 'Locação de veículo', orgaoEntidade: { ...base.orgaoEntidade!, razaoSocial: 'MUNICIPIO DE X' }, unidadeOrgao: { ufSigla: 'ES', codigoIbge: '3205309', nomeUnidade: 'Secretaria de Obras' } }, 2025, ctx), { drop: 'nao_educacao' });
  assert.deepEqual(buildEduContract({ ...base, unidadeOrgao: { ufSigla: 'ES', codigoIbge: '9999999' } }, 2025, ctx), { drop: 'sem_ente' });
  assert.equal(buildEduContract({ ...base, valorGlobal: 2e10 }, 2025, ctx) && (buildEduContract({ ...base, valorGlobal: 2e10 }, 2025, ctx) as unknown as { row: { outlier: boolean } }).row.outlier, true, 'valor acima de R$ 10 bi é marcado como outlier');
  assert.equal((buildEduContract({ ...base, valorGlobal: null }, 2025, ctx) as unknown as { row: { valor_global: unknown } }).row.valor_global, null, 'sem valor = NULL, nunca zero');
});

test('saneamento: CPF mascarado; nome do contratado só é mascarado quando é pessoa física', () => {
  assert.equal(sanitizeObjeto('Sr. Herly Robson, CPF 062.828.004-12', 'HERLY ROBSON CRISTINO ALVES', false), 'Sr. [pessoa física] [pessoa física], CPF [CPF]');
  assert.equal(sanitizeObjeto('EMPRESA X LTDA, CPF do responsável 12345678901', 'EMPRESA X LTDA', true), 'EMPRESA X LTDA, CPF do responsável [CPF]');
});

test('contratação e termos: valor sigiloso vira NULL; ausência não é zero; termo sem sequência é rejeitado', () => {
  const p = buildProcurement({ numeroControlePNCP: 'C-1-000001/2024', anoCompra: 2024, valorTotalEstimado: 100, valorTotalHomologado: 90.5, orcamentoSigilosoCodigo: 1, modalidadeId: 8, situacaoCompraId: 1, orgaoEntidade: { cnpj: '27142058000126' }, objetoCompra: ' Merenda  ' }, { uf: 32, entity_id: 3205309 });
  assert.ok(!('drop' in p)); if (!('drop' in p)) { assert.equal(p.valor_homologado, 9050); assert.equal(p.sigiloso, false); assert.equal(p.objeto, 'Merenda'); }
  const s = buildProcurement({ numeroControlePNCP: 'C-1-000002/2024', anoCompra: 2024, valorTotalEstimado: 100, valorTotalHomologado: 90, orcamentoSigilosoCodigo: 2, orgaoEntidade: { cnpj: '27142058000126' } }, { uf: 32, entity_id: 3205309 });
  assert.ok(!('drop' in s)); if (!('drop' in s)) { assert.equal(s.valor_estimado, null); assert.equal(s.valor_homologado, null); assert.equal(s.sigiloso, true); }
  assert.deepEqual(buildProcurement({ anoCompra: 2024, orgaoEntidade: { cnpj: '27142058000126' } }, { uf: 32, entity_id: 1 }), { drop: 'sem_chave' });
  const t = buildTerm('X-2-000001/2025', 2025, 32, { sequencialTermoContrato: 1, tipoTermoContratoNome: 'Termo Aditivo', valorAcrescido: 10.5, prazoAditadoDias: 90, qualificacaoVigencia: true });
  assert.equal(t!.valor_acrescido, 1050); assert.equal(t!.q_vigencia, true); assert.equal(t!.q_valor, false); assert.equal(buildTerm('X', 2025, 32, { tipoTermoContratoNome: 'x' }), null);
});

test('obras: educação por evidência (órgão, escola nomeada, contrato CIPI), valor placeholder, empenho ≠ pago, sem escola nem município', () => {
  const proj = (o: Partial<ObraProject>): ObraProject => ({ idUnico: '1.1-1', nome: 'CMEI Guilherme', uf: 'ES', situacao: 'Concluída', executores: [{ nome: 'FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCAÇÃO', codigo: 253 }], fontesDeRecurso: [{ origem: 'Federal', valorInvestimentoPrevisto: 0.01 }], tipos: [{ descricao: 'Infraestrutura Hídrica' }], ...o } as ObraProject);
  const wctx = { ufCode: (a: string) => ({ ES: 32, SP: 35 }[a]), entityByUf: new Map([[32, 32], [35, 35]]), year: 2026 };
  const projects = [
    proj({}), proj({ idUnico: '2.2-2', nome: 'Unidade Básica de Saúde', executores: [{ nome: 'MINISTÉRIO DA SAÚDE' }], fontesDeRecurso: [{ valorInvestimentoPrevisto: 1000.5 }] }),
    proj({ idUnico: '3.3-3', nome: 'Pavimentação', executores: [], fontesDeRecurso: [{ valorInvestimentoPrevisto: 500 }] }), proj({ idUnico: '4.4-4', nome: 'Escola Municipal Alfa', executores: [{ nome: 'PREFEITURA' }], fontesDeRecurso: [{ valorInvestimentoPrevisto: 2000 }] }),
    proj({ idUnico: '5.5-5', nome: 'Obra X', executores: [], uf: 'SP' }),
  ];
  const b = buildWorks(projects, [{ idUnico: '1.1-1', percentual: 98, dataSituacao: '2018-05-23', situacao: 'Concluída', emOperacao: true }, { idUnico: '1.1-1', percentual: 50, dataSituacao: '2017-01-01' }],
    [{ idProjetoInvestimento: '1.1-1', valorEmpenho: 301198.71, numeroNotaEmpenhoGerada: '2025NE000300', ugEmitente: '160017' }, { idProjetoInvestimento: '1.1-1', valorEmpenho: 301198.71, numeroNotaEmpenhoGerada: '2025NE000300', ugEmitente: '160017' }], new Set(['5.5-5']), wctx);
  const es = b.bySlice.get(32)!; assert.deepEqual(es.works.map(w => w.work_id), ['1.1-1', '4.4-4'], 'obra de saúde e pavimentação sem escola ficam de fora');
  const w1 = es.works[0]!; assert.equal(w1.valor_previsto, null); assert.equal(w1.valor_placeholder, true); assert.equal(w1.phys_percent, 98, 'vale o último registro de execução física'); assert.equal(w1.committed, 30119871); assert.equal(w1.commits, 1, 'empenho repetido conta uma vez');
  assert.equal(w1.edu_confidence, EDU_CONFIDENCE.CONFIRMED_OFFICIAL); assert.equal(es.works[1]!.valor_previsto, 200000); assert.equal(es.works[1]!.edu_confidence, EDU_CONFIDENCE.HIGH_CONFIDENCE_DERIVED);
  assert.equal(b.bySlice.get(35)!.works[0]!.edu_basis, 3, 'contrato educacional do PNCP aponta a obra pelo CIPI');
  assert.equal(classifyWork(proj({ executores: [], nome: 'Reforma de ginásio' }), new Set()), null);
});

test('R121: material de construção para unidades escolares ⇒ categoria 3 pela regra 121', () => {
  const r = classifyEducationContract('Aquisição de material de construção para as escolas municipais', 'MUNICIPIO DE X', 'Secretaria de Educacao', 'M');
  assert.ok(r.classes.some(c => c.category === 3 && c.rule === 121), JSON.stringify(r.classes));
});

test('v2: plural de mobiliário, implantação, comprador de outro setor, objeto misto, manutenção da merenda, prédio escolar', () => {
  const c = (o: string, org = 'MUNICIPIO DE X', un = 'Prefeitura') => classifyEducationContract(o, org, un, 'M').classes.map(x => `${x.category}/${x.confidence}`);
  assert.deepEqual(c('Fornecimento de mobiliários escolares para atendimento a Secretaria Municipal de Educação'), ['4/2']);
  assert.ok(!c('Locação de sistema de informática nas 23 unidades escolares').some(x => x.startsWith('1/')));
  assert.deepEqual(c('Telas interativas, lousas digitais e suportes', 'FUNDO MUNICIPAL DE SAUDE DE X', 'FUNDO MUNICIPAL DE SAUDE'), []);
  assert.deepEqual(c('Aquisição de gêneros alimentícios destinados a vários setores da municipalidade', 'MUNICIPIO DE X', 'SECRETARIA MUNICIPAL DE EDUCACAO'), ['8/3']);
  assert.deepEqual(c('Implantação de escola padrão UFRJ adaptado no bairro Parque Duque'), ['1/2']);
  assert.deepEqual(c('Aquisição de gêneros alimentícios para manutenção da merenda escolar'), ['8/2']);
  assert.deepEqual(c('Reforma da cobertura do prédio escolar'), ['2/2']);
});

test('v3: agricultura familiar sem contexto escolar é POSSIBLE; mão de obra de reforma não é terceirização; tribunal só com escola nomeada; veículo do transporte não é manutenção predial', () => {
  const c = (o: string, org = 'MUNICIPIO DE X', un = 'Prefeitura', es = 'M') => classifyEducationContract(o, org, un, es).classes.map(x => `${x.category}/${x.confidence}`);
  assert.deepEqual(c('Chamada pública para aquisição de gêneros alimentícios da agricultura familiar'), ['8/3']);
  assert.deepEqual(c('Aquisição de gêneros da agricultura familiar conforme Lei 11.947/2009'), ['8/2']);
  assert.ok(!c('Pintura com fornecimento de material e mão de obra na EMEF Alfa').some(x => x.startsWith('13/')));
  assert.deepEqual(c('Serviços educacionais ministrar aulas', 'TRIBUNAL DE CONTAS DO ESTADO', 'ESCOLA DE CONTAS', 'E'), []);
  assert.ok(!c('Manutenção do veículo do transporte escolar').some(x => x.startsWith('3/')));
  assert.deepEqual(c('Aquisição de material de higiene para atender secretarias, escolas e hospital').map(x => x.split('/')[1]), ['3']);
  assert.equal(classifyEducationContract('Limpeza do edifício sede', 'MINISTERIO DA EDUCACAO', 'SUBSECRETARIA', 'F').classes[0]!.confidence, EDU_CONFIDENCE.CONFIRMED_OFFICIAL);
});

test('v4: locação de imóvel e conserto de colchonetes não são obra; construção de escola continua', () => {
  const c = (o: string) => classifyEducationContract(o, 'MUNICIPIO DE X', 'Secretaria Municipal de Educação', 'M').classes.map(x => x.category);
  assert.ok(!c('Locação de imóvel para funcionamento da Escola Municipal Alfa durante a reforma').some(k => k <= 3));
  assert.ok(!c('Serviço de reforma em capas de colchonetes das escolas').includes(2));
  assert.ok(c('Construção da Escola Municipal Beta').includes(1));
});

test('v5: manutenção de ônibus escolar mantém o transporte; veículo/alunos; software escolar; material didático e unidade estadual (EEFM)', () => {
  const c = (o: string, org = 'MUNICIPIO DE X', un = 'Prefeitura', es = 'M') => classifyEducationContract(o, org, un, es).classes.map(x => `${x.category}/${x.confidence}`);
  assert.ok(c('Aquisição de peças para manutenção do ônibus escolar placa ABC1D23').includes('9/2'));
  assert.ok(c('Contratação de guincho para transportar o veículo escolar placa ABC1D23').includes('9/2'));
  assert.ok(c('Locação de veículos destinados ao transporte dos alunos da rede pública municipal').includes('9/2'));
  assert.ok(c('Locação de software de gestão da Secretaria Municipal de Educação').includes('6/2'));
  assert.ok(c('MATERIAIS DIDÁTICOS - LEI 14.133/2021').includes('10/2'));
  assert.deepEqual(c('AQUISIÇÃO DE MATERIAL EDUCATIVO E ESPORTIVO PARA ATENDER AS NECESSIDADES DA ESCOLA', 'ESTADO DO CEARA', 'EEFM BELARMINO', 'E').map(x => x.split('/')[0]), ['5']);
});

test('v6: FDE (fundação para o desenvolvimento da educação) é comprador de educação; Colégio Pedro II é MEC oficial', () => {
  assert.equal(classifyBuyer('FUNDACAO PARA O DESENVOLVIMENTO DA EDUCACAO', 'ESP-PRESTACAO DE SERVICOS', 'E').kind, 3);
  const cp = classifyBuyer('COLEGIO PEDRO II', 'COLEGIO PEDRO II', 'F'); assert.deepEqual([cp.kind, cp.confirmed], [1, true]);
  assert.equal(classifyBuyer('FUNDACAO CULTURAL CASSIANO RICARDO', 'FUNDACAO CULTURAL', 'M').kind, 0);
});

test('v7: merenda é educacional mesmo com comprador de outro setor; frota escolar, monitor escolar e conjuntos escolares', () => {
  const c = (o: string, org = 'MUNICIPIO DE X', un = 'Prefeitura', es = 'M') => classifyEducationContract(o, org, un, es).classes.map(x => `${x.category}/${x.confidence}`);
  assert.ok(c('Registro de preços para insumos para merenda', 'MUNICIPIO DE X', 'SECRETARIA DE AGRICULTURA').includes('8/2'));
  assert.deepEqual(c('Telas interativas e lousas digitais', 'FUNDO MUNICIPAL DE SAUDE', 'FUNDO MUNICIPAL DE SAUDE'), []);
  assert.ok(c('Serviço de borracharia na frota escolar').includes('9/2'));
  assert.ok(c('Credenciamento de profissionais para exercer a função de MONITOR ESCOLAR').includes('12/2'));
  assert.ok(c('Fornecimento de carteiras e conjuntos escolares').includes('4/2'));
});

test('valor negativo na origem (valorAcumulado) vira NULL em vez de violar o CHECK; empenho negativo (estorno) é preservado', () => {
  const ctx = { ufCode: (a: string) => ({ SP: 35 }[a as 'SP']), entityByIbge7: new Map([[3550308, 3550308]]), entityByUf: new Map([[35, 35]]), brEntity: 76 };
  const r = buildEduContract({ numeroControlePNCP: '1-2-000001/2025', anoContrato: 2025, sequencialContrato: 1, orgaoEntidade: { cnpj: '01614087000150', esferaId: 'M', razaoSocial: 'MUNICIPIO DE SAO PAULO' }, unidadeOrgao: { ufSigla: 'SP', codigoIbge: '3550308', nomeUnidade: 'Secretaria Municipal de Educação' }, objetoContrato: 'Merenda escolar', valorGlobal: 2058.77, valorInicial: 2058.77, valorAcumulado: -2058.77, tipoContrato: { id: 7 } } as EduPncpContract, 2025, ctx);
  assert.ok(!('drop' in r)); if (!('drop' in r)) { assert.equal(r.row.valor_acumulado, null); assert.equal(r.row.valor_global, 205877); }
  const w = buildWorks([{ idUnico: '1.1-1', nome: 'CMEI X', uf: 'SP', executores: [{ nome: 'FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCAÇÃO' }] } as ObraProject], [], [{ idProjetoInvestimento: '1.1-1', valorEmpenho: 100, numeroNotaEmpenhoGerada: 'A' }, { idProjetoInvestimento: '1.1-1', valorEmpenho: -40, numeroNotaEmpenhoGerada: 'B' }], new Set(), { ufCode: a => ({ SP: 35 }[a as 'SP']), entityByUf: new Map([[35, 35]]), year: 2026 });
  assert.equal(w.bySlice.get(35)!.works[0]!.committed, 6000, 'empenhado líquido = 100 − 40 (reais) em centavos');
});
