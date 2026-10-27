/** Catálogo canônico da P10.8. IDs e semântica são estáveis; recortes ficam nos read models. */
export type EducationIndicatorFamily =
  | 'ESCOLAS_OFERTA' | 'MATRICULAS_TURMAS' | 'INFRAESTRUTURA' | 'DOCENTES'
  | 'APRENDIZAGEM' | 'FLUXO_ESCOLAR' | 'FINANCIAMENTO'
  | 'PROGRAMAS_TRANSFERENCIAS' | 'CONTRATACOES' | 'OBRAS';
export type EducationIndicatorOrigin = 'OFFICIAL' | 'CIVICA_DERIVED';
export type EducationGranularity = 'ESCOLA' | 'MUNICIPIO' | 'UF' | 'BRASIL';
export type EducationPublicationClass = 'INTERNAL_READY' | 'PUBLIC_DISPLAY_WITH_CONDITIONS' | 'NEEDS_LEGAL_VALIDATION' | 'NOT_PUBLICABLE';

export interface EducationIndicatorDefinition {
  id: string; technicalName: string; friendlyName: string; family: EducationIndicatorFamily;
  origin: EducationIndicatorOrigin; officialSource: string; unit: string; editions: string;
  granularities: EducationGranularity[]; network: string; stage: string; location: string;
  formula: string | null; denominator: string | null; coverage: string; comparability: string;
  update: string; publication: EducationPublicationClass; interpretation: string; limitation: string;
}

type Seed = Pick<EducationIndicatorDefinition, 'id' | 'technicalName' | 'friendlyName' | 'family' | 'origin' | 'officialSource' | 'unit' | 'editions' | 'granularities' | 'interpretation' | 'limitation'>
  & Partial<Pick<EducationIndicatorDefinition, 'network' | 'stage' | 'location' | 'formula' | 'denominator' | 'coverage' | 'comparability' | 'update' | 'publication'>>;
const item = (x: Seed): EducationIndicatorDefinition => ({
  network: 'preservar o recorte publicado', stage: 'preservar o recorte publicado', location: 'total/urbana/rural quando publicado',
  formula: null, denominator: null, coverage: 'conforme cobertura da fonte', comparability: 'mesmo indicador, edição, universo e recortes',
  update: 'conforme edição oficial', publication: 'NEEDS_LEGAL_VALIDATION', ...x,
});
const ALL: EducationGranularity[] = ['ESCOLA', 'MUNICIPIO', 'UF', 'BRASIL'];
const TERR: EducationGranularity[] = ['MUNICIPIO', 'UF', 'BRASIL'];
const inep = (id: string, name: string, family: EducationIndicatorFamily, unit: string, editions: string, granularities: EducationGranularity[] = ALL, extra: Partial<Seed> = {}) => item({
  id: `edu.${id}`, technicalName: id.replaceAll('.', '_'), friendlyName: name, family, origin: 'OFFICIAL', officialSource: 'INEP', unit, editions, granularities,
  interpretation: 'valor oficial no grão publicado', limitation: 'ausência, não publicação ou supressão não significam zero', ...extra,
});

export const EDUCATION_INDICATORS: EducationIndicatorDefinition[] = [
  inep('school.registered', 'Escolas cadastradas', 'ESCOLAS_OFERTA', 'escolas', '2007-2025', ALL, { interpretation: 'estabelecimentos presentes na edição', limitation: 'ausência na edição não prova fechamento', comparability: 'fotografia anual; 2007-2010 listam somente escolas ativas' }),
  inep('school.active', 'Escolas em atividade', 'ESCOLAS_OFERTA', 'escolas', '2007-2025', ALL, { interpretation: 'situação de funcionamento declarada', limitation: 'não equivale a escola com matrícula' }),
  item({ id: 'edu.school.with_enrollment', technicalName: 'escolas_com_matricula', friendlyName: 'Escolas com matrícula', family: 'ESCOLAS_OFERTA', origin: 'CIVICA_DERIVED', officialSource: 'INEP/Censo Escolar', unit: 'escolas', editions: '2007-2025', granularities: ALL, formula: 'count(QT_MAT_BAS > 0)', interpretation: 'escolas com matrícula básica positiva', limitation: 'matrícula não é aluno único' }),
  item({ id: 'edu.school.sinopse_universe', technicalName: 'escolas_universo_sinopse', friendlyName: 'Escolas no universo da Sinopse', family: 'ESCOLAS_OFERTA', origin: 'CIVICA_DERIVED', officialSource: 'INEP/Censo Escolar', unit: 'escolas', editions: '2007-2025', granularities: ALL, formula: 'em atividade AND QT_MAT_BAS > 0', interpretation: 'universo oficial de totalização', limitation: 'não usar como sinônimo de cadastradas' }),

  inep('enrollment.total', 'Matrículas na educação básica', 'MATRICULAS_TURMAS', 'matrículas', '2007-2025', ALL, { interpretation: 'vínculos aluno-turma', limitation: 'não representa alunos únicos' }),
  inep('classes.total', 'Turmas da educação básica', 'MATRICULAS_TURMAS', 'turmas', '2007-2025', ALL, { limitation: 'turmas por etapa podem sobrepor' }),
  item({ id: 'edu.class_size.derived', technicalName: 'matriculas_por_turma_derivada', friendlyName: 'Matrículas por turma (derivada)', family: 'MATRICULAS_TURMAS', origin: 'CIVICA_DERIVED', officialSource: 'INEP/Censo Escolar', unit: 'matrículas/turma', editions: '2007-2025', granularities: ALL, formula: 'sum(matrículas) / sum(turmas)', denominator: 'turmas do mesmo recorte', interpretation: 'razão de somas', limitation: 'não substitui o ATU oficial' }),
  inep('enrollment.integral', 'Matrículas em tempo integral', 'MATRICULAS_TURMAS', 'matrículas', '2016-2025 comparável', ALL, { interpretation: 'recorte transversal', limitation: 'não somar às etapas; série descontínua antes de 2016' }),
  inep('enrollment.night', 'Matrículas no turno noturno', 'MATRICULAS_TURMAS', 'matrículas', 'conforme vigência', ALL, { interpretation: 'recorte transversal', limitation: 'não somar às etapas' }),
  inep('enrollment.special', 'Matrículas de educação especial', 'MATRICULAS_TURMAS', 'matrículas', '2007-2025', ALL, { interpretation: 'classes comuns e exclusivas separáveis', limitation: 'recorte transversal; não somar às etapas' }),

  ...[
    ['internet', 'Escolas com internet', '2007-2025', 'não mede velocidade, estabilidade ou uso pedagógico'],
    ['internet_aprendizagem', 'Internet para ensino e aprendizagem', '2019-2025', 'uso declarado; não equivale a conectividade medida'],
    ['biblioteca_ou_leitura', 'Biblioteca e/ou sala de leitura', '2007-2025', 'não mede uso ou qualidade'],
    ['lab_informatica', 'Laboratório de informática', 'conforme vigência', 'fora da edição não é NÃO'],
    ['lab_ciencias', 'Laboratório de ciências', 'conforme vigência', 'não mede funcionamento ou qualidade'],
    ['agua_rede', 'Água da rede pública', '2007-2025', 'não mede potabilidade'],
    ['esgoto_rede', 'Esgoto na rede pública', '2007-2025', 'não mede qualidade do serviço'],
    ['energia_rede', 'Energia da rede pública', '2007-2025', 'não mede estabilidade'],
    ['banheiro_pne', 'Banheiro acessível', '2007-2025', 'redação mudou em 2019; não representa acessibilidade integral'],
  ].map(([code, name, editions, limitation]) => item({ id: `edu.infra.${code}`, technicalName: `infra_${code}`, friendlyName: name!, family: 'INFRAESTRUTURA', origin: 'CIVICA_DERIVED', officialSource: 'INEP/Censo Escolar', unit: 'SIM/NÃO na escola; % no território', editions: editions!, granularities: ALL, formula: 'território: SIM / (SIM + NÃO); escola: resposta source-native', denominator: 'escolas com resposta válida, somente no agregado territorial', interpretation: 'existência declarada; percentual territorial calculado pelo Cívica', limitation: limitation! })),

  inep('teacher.distinct', 'Docentes distintos', 'DOCENTES', 'docentes', '2007-2025', TERR, { officialSource: 'INEP/Sinopse Estatística', limitation: 'não somar contagens escolares ou municipais' }),
  ...[
    ['atu_fun', 'Média de alunos por turma', 'alunos/turma'], ['had_fun', 'Média de horas-aula diária', 'horas'], ['dsu_fun', 'Docentes com curso superior', '%'],
    ['afd_fun1', 'Adequação da formação docente — grupo 1', '%'], ['ied_fun1', 'Esforço docente — nível 1', '%'], ['ird_b4', 'Regularidade docente — faixa superior', '%'], ['icg_n6', 'Complexidade de gestão — nível 6', '%'],
  ].map(([code, name, unit]) => inep(`teacher.${code}`, name!, 'DOCENTES', unit!, '2007-2025 conforme família')),

  inep('learning.ideb', 'Ideb', 'APRENDIZAGEM', 'índice', '2005-2025 bienal'),
  inep('learning.saeb_lp', 'Saeb — Língua Portuguesa', 'APRENDIZAGEM', 'pontos', '2017-2025 bienal', TERR, { limitation: 'não há Saeb escolar independente nas fontes coletadas' }),
  inep('learning.saeb_mt', 'Saeb — Matemática', 'APRENDIZAGEM', 'pontos', '2017-2025 bienal', TERR, { limitation: 'não há Saeb escolar independente nas fontes coletadas' }),
  inep('learning.inse', 'Indicador de nível socioeconômico', 'APRENDIZAGEM', 'índice', '2019, 2021, 2023'),
  ...[
    ['ap_fun', 'Taxa de aprovação', '2006-2025'], ['rp_fun', 'Taxa de reprovação', '2006-2025'], ['ab_fun', 'Taxa de abandono', '2006-2025'], ['td_fun', 'Distorção idade-série', '2006-2025'],
    ['pro_fun', 'Taxa de promoção', '2007-2021'], ['rep_fun', 'Taxa de repetência', '2007-2021'], ['eva_fun', 'Taxa de evasão', '2007-2021'],
  ].map(([code, name, editions]) => inep(`flow.${code}`, name!, 'FLUXO_ESCOLAR', '%', editions!, ['pro_fun', 'rep_fun', 'eva_fun'].includes(code!) ? TERR : ALL)),

  ...[
    ['siconfi_emp', 'Despesa empenhada — função 12', 'Siconfi DCA', '2014-2025'], ['siconfi_liq', 'Despesa liquidada — função 12', 'Siconfi DCA', '2014-2025'], ['siconfi_pag', 'Despesa paga — função 12', 'Siconfi DCA', '2014-2025'],
    ['siope_mde', 'Aplicação em MDE', 'SIOPE', '2017-2025'], ['siope_fundeb', 'Recursos Fundeb', 'SIOPE', '2017-2025'],
  ].map(([code, name, source, editions]) => item({ id: `edu.finance.${code}`, technicalName: code!, friendlyName: name!, family: 'FINANCIAMENTO', origin: 'CIVICA_DERIVED', officialSource: source!, unit: 'R$', editions: editions!, granularities: TERR, formula: 'município: valor oficial declarado; UF/Brasil: soma Cívica das declarações no universo', interpretation: 'valor no estágio financeiro indicado', limitation: 'Siconfi, SIOPE, MDE e Fundeb não são somáveis entre si', comparability: 'mesma fonte, exercício, estágio e universo' })),

  ...[
    ['pdde', 'PDDE', 'Portal nacional 2025; escola somente piloto de 10 escolas'], ['pnae', 'PNAE', 'transferências nacionais somente 2025'],
    ['pnate', 'PNATE', 'transferências nacionais somente 2025'], ['fundeb_complemento', 'Complementação Fundeb', 'transferências nacionais somente 2025'],
  ].map(([code, name, coverage]) => item({ id: `edu.program.${code}`, technicalName: code!, friendlyName: name!, family: 'PROGRAMAS_TRANSFERENCIAS', origin: 'CIVICA_DERIVED', officialSource: 'Portal da Transparência/FNDE', unit: 'R$', editions: '2025', granularities: code === 'pdde' ? ALL : TERR, formula: 'soma Cívica de fatos oficiais no mesmo programa, exercício e estágio', coverage: coverage!, interpretation: 'valor no estágio publicado', limitation: 'não atribuir PNAE/PNATE à escola; DUE, TRANSFERRED e PAID ficam separados', comparability: 'mesmo programa, exercício e estágio financeiro' })),

  item({ id: 'edu.contract.count', technicalName: 'contratos_identificados', friendlyName: 'Contratos educacionais identificados', family: 'CONTRATACOES', origin: 'CIVICA_DERIVED', officialSource: 'PNCP', unit: 'contratos', editions: '2021-2026', granularities: TERR, formula: 'classificação determinística por comprador/objeto', interpretation: 'contratos classificados como educação básica', limitation: 'POSSIBLE fica separado; município é o do órgão contratante' }),
  item({ id: 'edu.contract.value', technicalName: 'valor_contratado', friendlyName: 'Valor contratado identificado', family: 'CONTRATACOES', origin: 'CIVICA_DERIVED', officialSource: 'PNCP', unit: 'R$', editions: '2021-2026', granularities: TERR, formula: 'sum(valor_global), sem outliers > R$10 bi', interpretation: 'valor contratado', limitation: 'não é pago, executado ou investido; sem vínculo com escola' }),
  item({ id: 'edu.work.count', technicalName: 'obras_identificadas', friendlyName: 'Obras educacionais identificadas', family: 'OBRAS', origin: 'CIVICA_DERIVED', officialSource: 'Obrasgov.br', unit: 'obras', editions: 'coleta 2026', granularities: ['UF'], coverage: 'somente 9 UFs', interpretation: 'projetos oficialmente identificados', limitation: 'não apresentar como total nacional nem atribuir a município/escola' }),
  item({ id: 'edu.work.committed', technicalName: 'valor_empenhado_obras', friendlyName: 'Empenho identificado em obras', family: 'OBRAS', origin: 'CIVICA_DERIVED', officialSource: 'Obrasgov.br', unit: 'R$', editions: 'coleta 2026', granularities: ['UF'], formula: 'sum(empenhos oficiais vinculados às obras identificadas)', interpretation: 'soma Cívica de valores source-native', limitation: 'empenho não é pagamento; somente 9 UFs' }),
];

export const EDUCATION_INDICATOR_BY_ID = new Map(EDUCATION_INDICATORS.map(x => [x.id, x]));
export const EDUCATION_FAMILY_COUNTS = Object.fromEntries([...new Set(EDUCATION_INDICATORS.map(x => x.family))].map(f => [f, EDUCATION_INDICATORS.filter(x => x.family === f).length])) as Record<EducationIndicatorFamily, number>;
