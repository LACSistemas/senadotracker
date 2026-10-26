/**
 * Catálogo de infraestrutura escolar (P10.3, Censo Escolar INEP, Tabela de Escola). Fonte única da lista de colunas da tabela `exec_edu_infra_year`, do extrator Python e dos read models.
 * Toda medida é AUTODECLARADA pela escola (existência/uso de uma dependência, serviço ou equipamento): nunca nota de qualidade, funcionamento, manutenção ou suficiência.
 * Regra de ausência: NULL = a edição não tem a variável OU a escola não respondeu (os dois casos são separados por `INFRA_VARS[].from/to` e pela cobertura da edição); 0/false = "não" declarado.
 * Quebra metodológica de 2019: o questionário foi reformulado; famílias redefinidas são colunas SEPARADAS (nunca fundidas) e levam `comparability` explícita.
 */
export type InfraKind = 'flag' | 'count';
export type InfraFamily = 'A_SERVICOS' | 'B_CONECTIVIDADE' | 'C_AMBIENTES' | 'D_ALIMENTACAO' | 'E_ACESSIBILIDADE' | 'F_INSTALACOES';
export type InfraComparability = 'COMPARABLE_ACROSS_YEARS' | 'COMPARABLE_WITH_CAVEATS' | 'NEW_VARIABLE' | 'DISCONTINUED' | 'DEFINITION_CHANGED';
export interface InfraVar {
  code: string;                 // nome da coluna no banco
  kind: InfraKind;              // flag = boolean; count = smallint
  src: string;                  // coluna oficial do Censo
  family: InfraFamily;
  label: string;                // nome amigável (PT)
  from: number;                 // primeira edição com a variável no layout oficial
  to: number;                   // última edição (2025 = vigente)
  comparability: InfraComparability;
  note?: string;
  /** Código oficial de "Não informado" (ex.: 9 em IN_ACESSO_INTERNET_*): vira NULL e é contado à parte. */
  unknownCode?: string;
  /** Valor oficial de "valor extremo marcado pelo INEP" (88888 nas quantidades de equipamentos): vira NULL e é contado à parte; nunca entra em soma. */
  extremeCode?: number;
  /** Variável só se aplica a escolas com a condição (denominador dos percentuais): ex.: banda larga só entre escolas com internet. */
  applicableWhen?: string;
}
const Y1 = 2007, YN = 2025;
const v = (code: string, kind: InfraKind, src: string, family: InfraFamily, label: string, from: number, to: number, comparability: InfraComparability, note?: string): InfraVar =>
  ({ code, kind, src, family, label, from, to, comparability, ...(note ? { note } : {}) });
const f = (code: string, src: string, family: InfraFamily, label: string, from = Y1, to = YN, c: InfraComparability = 'COMPARABLE_ACROSS_YEARS', note?: string) => v(code, 'flag', src, family, label, from, to, c, note);
const n = (code: string, src: string, family: InfraFamily, label: string, from = Y1, to = YN, c: InfraComparability = 'COMPARABLE_ACROSS_YEARS', note?: string) => v(code, 'count', src, family, label, from, to, c, note);
const NEW19 = (from = 2019): [number, number, InfraComparability] => [from, YN, 'NEW_VARIABLE'];
const OLD18: [number, number, InfraComparability] = [Y1, 2018, 'DISCONTINUED'];

export const INFRA_VARS: InfraVar[] = [
  // A. Serviços essenciais
  f('agua_rede', 'IN_AGUA_REDE_PUBLICA', 'A_SERVICOS', 'Água da rede pública'),
  f('agua_poco', 'IN_AGUA_POCO_ARTESIANO', 'A_SERVICOS', 'Água de poço artesiano'),
  f('agua_cacimba', 'IN_AGUA_CACIMBA', 'A_SERVICOS', 'Água de cacimba, cisterna ou poço'),
  f('agua_rio', 'IN_AGUA_FONTE_RIO', 'A_SERVICOS', 'Água de fonte, rio, igarapé ou córrego'),
  f('agua_inexistente', 'IN_AGUA_INEXISTENTE', 'A_SERVICOS', 'Sem abastecimento de água'),
  f('agua_pipa', 'IN_AGUA_CARRO_PIPA', 'A_SERVICOS', 'Água por carro-pipa', 2024, YN, 'NEW_VARIABLE'),
  f('agua_filtrada', 'IN_AGUA_FILTRADA', 'A_SERVICOS', 'Água filtrada para os alunos', ...OLD18, 'Redefinida em 2019 (IN_AGUA_POTAVEL): pergunta diferente, não comparar.'),
  f('agua_potavel', 'IN_AGUA_POTAVEL', 'A_SERVICOS', 'Fornece água potável para consumo', ...NEW19(), 'Substitui IN_AGUA_FILTRADA em 2019 (pergunta redefinida).'),
  f('energia_rede', 'IN_ENERGIA_REDE_PUBLICA', 'A_SERVICOS', 'Energia da rede pública'),
  f('energia_inexistente', 'IN_ENERGIA_INEXISTENTE', 'A_SERVICOS', 'Sem energia elétrica'),
  f('energia_gerador', 'IN_ENERGIA_GERADOR', 'A_SERVICOS', 'Gerador', ...OLD18, 'Em 2019 vira gerador a combustível fóssil.'),
  f('energia_gerador_fossil', 'IN_ENERGIA_GERADOR_FOSSIL', 'A_SERVICOS', 'Gerador movido a combustível fóssil', ...NEW19()),
  f('energia_alternativa', 'IN_ENERGIA_OUTROS', 'A_SERVICOS', 'Outras fontes de energia', ...OLD18, 'Em 2019 vira fontes renováveis ou alternativas.'),
  f('energia_renovavel', 'IN_ENERGIA_RENOVAVEL', 'A_SERVICOS', 'Fontes de energia renováveis ou alternativas', ...NEW19()),
  f('esgoto_rede', 'IN_ESGOTO_REDE_PUBLICA', 'A_SERVICOS', 'Esgoto na rede pública'),
  f('esgoto_fossa', 'IN_ESGOTO_FOSSA', 'A_SERVICOS', 'Esgoto em fossa'),
  f('esgoto_fossa_septica', 'IN_ESGOTO_FOSSA_SEPTICA', 'A_SERVICOS', 'Esgoto em fossa séptica', ...NEW19()),
  f('esgoto_fossa_comum', 'IN_ESGOTO_FOSSA_COMUM', 'A_SERVICOS', 'Esgoto em fossa rudimentar ou comum', ...NEW19()),
  f('esgoto_inexistente', 'IN_ESGOTO_INEXISTENTE', 'A_SERVICOS', 'Sem esgotamento sanitário'),
  f('lixo_coleta', 'IN_LIXO_SERVICO_COLETA', 'A_SERVICOS', 'Lixo recolhido por serviço de coleta'),
  f('lixo_queima', 'IN_LIXO_QUEIMA', 'A_SERVICOS', 'Lixo queimado'),
  f('lixo_enterra', 'IN_LIXO_ENTERRA', 'A_SERVICOS', 'Lixo enterrado'),
  f('banheiro', 'IN_BANHEIRO', 'A_SERVICOS', 'Banheiro na escola', ...NEW19(), 'Substitui banheiro dentro/fora do prédio (até 2018).'),
  f('banheiro_dentro', 'IN_BANHEIRO_DENTRO_PREDIO', 'A_SERVICOS', 'Banheiro dentro do prédio', ...OLD18),
  f('banheiro_fora', 'IN_BANHEIRO_FORA_PREDIO', 'A_SERVICOS', 'Banheiro fora do prédio', ...OLD18),
  f('banheiro_ei', 'IN_BANHEIRO_EI', 'A_SERVICOS', 'Banheiro adequado à educação infantil', 2009, YN),
  f('banheiro_func', 'IN_BANHEIRO_FUNCIONARIOS', 'A_SERVICOS', 'Banheiro exclusivo para funcionários', ...NEW19()),
  f('banheiro_chuveiro', 'IN_BANHEIRO_CHUVEIRO', 'A_SERVICOS', 'Banheiro ou vestiário com chuveiro', 2012, YN),
  // B. Conectividade e tecnologia
  f('internet', 'IN_INTERNET', 'B_CONECTIVIDADE', 'Acesso à internet', Y1, YN, 'COMPARABLE_WITH_CAVEATS', 'Declara acesso; não mede velocidade, estabilidade nem uso pedagógico. Em 2022, 4.259 escolas ativas deixaram em branco.'),
  { ...f('banda_larga', 'IN_BANDA_LARGA', 'B_CONECTIVIDADE', 'Internet banda larga', 2008, YN, 'COMPARABLE_WITH_CAVEATS', 'Definição de banda larga do questionário; não é velocidade medida. Não se aplica a escolas sem internet (branco).'), applicableWhen: 'internet' },
  { ...f('internet_alunos', 'IN_INTERNET_ALUNOS', 'B_CONECTIVIDADE', 'Internet para uso dos alunos', ...NEW19()) },
  { ...f('internet_admin', 'IN_INTERNET_ADMINISTRATIVO', 'B_CONECTIVIDADE', 'Internet para uso administrativo', ...NEW19()) },
  { ...f('internet_aprendizagem', 'IN_INTERNET_APRENDIZAGEM', 'B_CONECTIVIDADE', 'Internet para ensino e aprendizagem', ...NEW19(), 'Uso declarado nos processos de ensino e aprendizagem; não equivale a "escola conectada para aprender".') },
  { ...f('internet_comunidade', 'IN_INTERNET_COMUNIDADE', 'B_CONECTIVIDADE', 'Internet para uso da comunidade', ...NEW19()) },
  { ...f('internet_comp_aluno', 'IN_ACESSO_INTERNET_COMPUTADOR', 'B_CONECTIVIDADE', 'Alunos acessam a internet por computadores da escola', ...NEW19()), unknownCode: '9' },
  { ...f('internet_disp_pessoal', 'IN_ACES_INTERNET_DISP_PESSOAIS', 'B_CONECTIVIDADE', 'Alunos acessam a internet por dispositivos pessoais', ...NEW19()), unknownCode: '9' },
  f('computador', 'IN_COMPUTADOR', 'B_CONECTIVIDADE', 'Computador para uso técnico e administrativo'),
  f('lab_informatica', 'IN_LABORATORIO_INFORMATICA', 'B_CONECTIVIDADE', 'Laboratório de informática'),
  f('desktop_aluno', 'IN_DESKTOP_ALUNO', 'B_CONECTIVIDADE', 'Computador de mesa em uso pelos alunos', ...NEW19()),
  f('portatil_aluno', 'IN_COMP_PORTATIL_ALUNO', 'B_CONECTIVIDADE', 'Computador portátil em uso pelos alunos', ...NEW19()),
  f('tablet_aluno', 'IN_TABLET_ALUNO', 'B_CONECTIVIDADE', 'Tablet em uso pelos alunos', ...NEW19()),
  f('equip_tv', 'IN_EQUIP_TV', 'B_CONECTIVIDADE', 'Televisão'),
  f('equip_dvd', 'IN_EQUIP_DVD', 'B_CONECTIVIDADE', 'DVD ou Blu-ray'),
  f('equip_som', 'IN_EQUIP_SOM', 'B_CONECTIVIDADE', 'Aparelho de som', 2012, YN),
  f('equip_multimidia', 'IN_EQUIP_MULTIMIDIA', 'B_CONECTIVIDADE', 'Projetor multimídia', 2012, YN),
  f('equip_lousa_digital', 'IN_EQUIP_LOUSA_DIGITAL', 'B_CONECTIVIDADE', 'Lousa digital', ...NEW19()),
  f('equip_impressora', 'IN_EQUIP_IMPRESSORA', 'B_CONECTIVIDADE', 'Impressora'),
  f('equip_copiadora', 'IN_EQUIP_COPIADORA', 'B_CONECTIVIDADE', 'Copiadora'),
  f('equip_scanner', 'IN_EQUIP_SCANNER', 'B_CONECTIVIDADE', 'Scanner', ...NEW19()),
  f('equip_parabolica', 'IN_EQUIP_PARABOLICA', 'B_CONECTIVIDADE', 'Antena parabólica'),
  // C. Ambientes pedagógicos
  f('biblioteca', 'IN_BIBLIOTECA', 'C_AMBIENTES', 'Biblioteca', 2009, YN),
  f('sala_leitura', 'IN_SALA_LEITURA', 'C_AMBIENTES', 'Sala de leitura', 2009, YN),
  f('biblioteca_ou_leitura', 'IN_BIBLIOTECA_SALA_LEITURA', 'C_AMBIENTES', 'Biblioteca e/ou sala de leitura', Y1, YN, 'COMPARABLE_ACROSS_YEARS', 'Única variável de leitura presente nas 19 edições; 2007–2008 não separam biblioteca de sala de leitura.'),
  f('lab_ciencias', 'IN_LABORATORIO_CIENCIAS', 'C_AMBIENTES', 'Laboratório de ciências'),
  f('lab_educ_prof', 'IN_LABORATORIO_EDUC_PROF', 'C_AMBIENTES', 'Laboratório de educação profissional', 2022, YN, 'NEW_VARIABLE'),
  f('quadra', 'IN_QUADRA_ESPORTES', 'C_AMBIENTES', 'Quadra de esportes'),
  f('quadra_coberta', 'IN_QUADRA_ESPORTES_COBERTA', 'C_AMBIENTES', 'Quadra de esportes coberta', 2011, YN),
  f('quadra_descoberta', 'IN_QUADRA_ESPORTES_DESCOBERTA', 'C_AMBIENTES', 'Quadra de esportes descoberta', 2011, YN),
  f('parque_infantil', 'IN_PARQUE_INFANTIL', 'C_AMBIENTES', 'Parque infantil'),
  f('patio_coberto', 'IN_PATIO_COBERTO', 'C_AMBIENTES', 'Pátio coberto', 2012, YN),
  f('patio_descoberto', 'IN_PATIO_DESCOBERTO', 'C_AMBIENTES', 'Pátio descoberto', 2012, YN),
  f('piscina', 'IN_PISCINA', 'C_AMBIENTES', 'Piscina', ...NEW19()),
  f('auditorio', 'IN_AUDITORIO', 'C_AMBIENTES', 'Auditório', 2012, YN),
  f('sala_artes', 'IN_SALA_ATELIE_ARTES', 'C_AMBIENTES', 'Sala ou ateliê de artes', ...NEW19()),
  f('sala_musica', 'IN_SALA_MUSICA_CORAL', 'C_AMBIENTES', 'Sala de música ou coral', ...NEW19()),
  f('sala_danca', 'IN_SALA_ESTUDIO_DANCA', 'C_AMBIENTES', 'Sala ou estúdio de dança', ...NEW19()),
  f('sala_multiuso', 'IN_SALA_MULTIUSO', 'C_AMBIENTES', 'Sala multiuso', ...NEW19()),
  f('sala_professor', 'IN_SALA_PROFESSOR', 'C_AMBIENTES', 'Sala de professores'),
  f('sala_diretoria', 'IN_SALA_DIRETORIA', 'C_AMBIENTES', 'Sala de diretoria'),
  f('sala_aee', 'IN_SALA_ATENDIMENTO_ESPECIAL', 'C_AMBIENTES', 'Sala de recursos multifuncionais (AEE)'),
  // D. Alimentação e apoio
  f('cozinha', 'IN_COZINHA', 'D_ALIMENTACAO', 'Cozinha'),
  f('refeitorio', 'IN_REFEITORIO', 'D_ALIMENTACAO', 'Refeitório', 2012, YN),
  f('despensa', 'IN_DESPENSA', 'D_ALIMENTACAO', 'Despensa', 2012, YN),
  f('predio_compartilhado', 'IN_PREDIO_COMPARTILHADO', 'F_INSTALACOES', 'Prédio compartilhado com outra escola'),
  // E. Acessibilidade
  f('banheiro_pne', 'IN_BANHEIRO_PNE', 'E_ACESSIBILIDADE', 'Banheiro acessível a pessoas com deficiência ou mobilidade reduzida', Y1, YN, 'COMPARABLE_WITH_CAVEATS', 'Redação do item mudou em 2019 (dependência existente e utilizada).'),
  f('dependencias_pne', 'IN_DEPENDENCIAS_PNE', 'E_ACESSIBILIDADE', 'Dependências e vias adequadas a pessoas com deficiência', ...OLD18, 'Substituída em 2019 pelos recursos de acessibilidade detalhados.'),
  f('acess_corrimao', 'IN_ACESSIBILIDADE_CORRIMAO', 'E_ACESSIBILIDADE', 'Corrimão e guarda-corpos', ...NEW19()),
  f('acess_elevador', 'IN_ACESSIBILIDADE_ELEVADOR', 'E_ACESSIBILIDADE', 'Elevador', ...NEW19()),
  f('acess_piso_tatil', 'IN_ACESSIBILIDADE_PISOS_TATEIS', 'E_ACESSIBILIDADE', 'Pisos táteis', ...NEW19()),
  f('acess_vao_livre', 'IN_ACESSIBILIDADE_VAO_LIVRE', 'E_ACESSIBILIDADE', 'Portas com vão livre de 80 cm', ...NEW19()),
  f('acess_rampa', 'IN_ACESSIBILIDADE_RAMPAS', 'E_ACESSIBILIDADE', 'Rampas', ...NEW19()),
  f('acess_sinal_sonoro', 'IN_ACESSIBILIDADE_SINAL_SONORO', 'E_ACESSIBILIDADE', 'Sinalização sonora', ...NEW19()),
  f('acess_sinal_tatil', 'IN_ACESSIBILIDADE_SINAL_TATIL', 'E_ACESSIBILIDADE', 'Sinalização tátil', ...NEW19()),
  f('acess_sinal_visual', 'IN_ACESSIBILIDADE_SINAL_VISUAL', 'E_ACESSIBILIDADE', 'Sinalização visual', ...NEW19()),
  f('acess_sinalizacao', 'IN_ACESSIBILIDADE_SINALIZACAO', 'E_ACESSIBILIDADE', 'Sinalização de acessibilidade (geral)', 2024, YN, 'NEW_VARIABLE'),
  f('acess_inexistente', 'IN_ACESSIBILIDADE_INEXISTENTE', 'E_ACESSIBILIDADE', 'Nenhum recurso de acessibilidade', ...NEW19()),
  // F. Instalações e capacidade (contagens)
  n('salas_existentes', 'QT_SALAS_EXISTENTES', 'F_INSTALACOES', 'Salas de aula existentes', ...OLD18, 'Até 2018: salas existentes. De 2019 só as utilizadas: série descontínua.'),
  n('salas_utilizadas', 'QT_SALAS_UTILIZADAS', 'F_INSTALACOES', 'Salas de aula utilizadas (dentro e fora do prédio)', Y1, YN, 'COMPARABLE_WITH_CAVEATS', 'Presente nas 19 edições; o conceito de "utilizada" passa a ser explícito em 2019.'),
  n('salas_dentro', 'QT_SALAS_UTILIZADAS_DENTRO', 'F_INSTALACOES', 'Salas de aula utilizadas dentro do prédio', ...NEW19()),
  n('salas_fora', 'QT_SALAS_UTILIZADAS_FORA', 'F_INSTALACOES', 'Salas de aula utilizadas fora do prédio', ...NEW19()),
  n('salas_climatizadas', 'QT_SALAS_UTILIZA_CLIMATIZADAS', 'F_INSTALACOES', 'Salas de aula climatizadas', ...NEW19()),
  n('salas_acessiveis', 'QT_SALAS_UTILIZADAS_ACESSIVEIS', 'F_INSTALACOES', 'Salas de aula acessíveis', ...NEW19()),
  n('qt_comp_aluno', 'QT_COMP_ALUNO', 'B_CONECTIVIDADE', 'Computadores em uso pelos alunos', ...OLD18, 'Série interrompida em 2018; de 2019 vem separada por tipo (desktop, portátil, tablet).'),
  n('qt_computador', 'QT_COMPUTADOR', 'B_CONECTIVIDADE', 'Computadores na escola (total)', ...OLD18),
  { ...n('qt_desktop_aluno', 'QT_DESKTOP_ALUNO', 'B_CONECTIVIDADE', 'Computadores de mesa em uso pelos alunos', ...NEW19()), extremeCode: 88888 },
  { ...n('qt_portatil_aluno', 'QT_COMP_PORTATIL_ALUNO', 'B_CONECTIVIDADE', 'Computadores portáteis em uso pelos alunos', ...NEW19()), extremeCode: 88888 },
  { ...n('qt_tablet_aluno', 'QT_TABLET_ALUNO', 'B_CONECTIVIDADE', 'Tablets em uso pelos alunos', ...NEW19()), extremeCode: 88888 },
  { ...n('qt_tv', 'QT_EQUIP_TV', 'B_CONECTIVIDADE', 'Televisores', 2013, YN), extremeCode: 88888 },
  { ...n('qt_multimidia', 'QT_EQUIP_MULTIMIDIA', 'B_CONECTIVIDADE', 'Projetores multimídia', 2013, YN), extremeCode: 88888 },
  { ...n('qt_lousa_digital', 'QT_EQUIP_LOUSA_DIGITAL', 'B_CONECTIVIDADE', 'Lousas digitais', ...NEW19()), extremeCode: 88888 },
];
export const INFRA_BY_CODE = new Map(INFRA_VARS.map(x => [x.code, x]));
export const INFRA_FLAGS = INFRA_VARS.filter(x => x.kind === 'flag').map(x => x.code);
export const INFRA_COUNTS = INFRA_VARS.filter(x => x.kind === 'count').map(x => x.code);
export const INFRA_COLS = INFRA_VARS.map(x => x.code);
/** Edições em que a variável existe no layout oficial; fora delas o valor é sempre NULL ("fora da edição"). */
export const infraAvailable = (code: string, year: number): boolean => { const x = INFRA_BY_CODE.get(code); return !!x && year >= x.from && year <= x.to; };
