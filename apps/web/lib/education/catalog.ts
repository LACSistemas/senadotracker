/** Rótulos e escolhas editoriais da página de Educação (o que o cidadão vê). Os valores nunca são alterados aqui: só nomeados. */
export const SUBJECTS = [{ value: '2', label: 'Matemática', lower: 'matemática' }, { value: '1', label: 'Língua Portuguesa', lower: 'língua portuguesa' }] as const;
export const SAEB_GRADES = [
  { value: '5', label: '5º ano', long: '5º ano do ensino fundamental' },
  { value: '9', label: '9º ano', long: '9º ano do ensino fundamental' },
  { value: '14', label: 'Ensino médio', long: 'Ensino médio (3ª/4ª série, todas as formas)' },
] as const;
/** Redes na ordem de preferência para o padrão do explorador. */
export const REDES = [
  { value: '0', label: 'Todas as redes' },
  { value: '5', label: 'Rede pública' },
  { value: '3', label: 'Rede municipal' },
  { value: '2', label: 'Rede estadual' },
] as const;
export const IDEB_STAGES = [
  { value: '1', label: 'Anos iniciais (1º–5º)' },
  { value: '2', label: 'Anos finais (6º–9º)' },
  { value: '3', label: 'Ensino médio' },
] as const;
export const FLOW_MEASURES = [
  { value: 'ab', label: 'Abandono', lower: 'abandono', verb: 'abandonaram a escola durante o ano' },
  { value: 'rp', label: 'Reprovação', lower: 'reprovação', verb: 'foram reprovados' },
  { value: 'ap', label: 'Aprovação', lower: 'aprovação', verb: 'foram aprovados' },
  { value: 'td', label: 'Distorção idade-série', lower: 'distorção idade-série', verb: 'estavam com dois anos ou mais de atraso em relação à série' },
] as const;
export const FLOW_STAGES = [
  { value: 'fun', label: 'Ensino fundamental', lower: 'no ensino fundamental' },
  { value: 'ai', label: 'Anos iniciais', lower: 'nos anos iniciais' },
  { value: 'af', label: 'Anos finais', lower: 'nos anos finais' },
  { value: 'med', label: 'Ensino médio', lower: 'no ensino médio' },
] as const;
/** Itens de infraestrutura que o cidadão entende, na ordem em que aparecem. */
export const INFRA_ITEMS: Array<{ code: string; label: string; group: string }> = [
  { code: 'internet', label: 'Internet', group: 'Conectividade' },
  { code: 'banda_larga', label: 'Banda larga', group: 'Conectividade' },
  { code: 'lab_informatica', label: 'Laboratório de informática', group: 'Espaços de aprender' },
  { code: 'lab_ciencias', label: 'Laboratório de ciências', group: 'Espaços de aprender' },
  { code: 'biblioteca_ou_leitura', label: 'Biblioteca ou sala de leitura', group: 'Espaços de aprender' },
  { code: 'quadra', label: 'Quadra de esportes', group: 'Espaços de aprender' },
  { code: 'banheiro_pne', label: 'Banheiro acessível', group: 'Acessibilidade' },
  { code: 'refeitorio', label: 'Refeitório', group: 'Alimentação' },
  { code: 'cozinha', label: 'Cozinha', group: 'Alimentação' },
  { code: 'agua_rede', label: 'Água da rede pública', group: 'Serviços básicos' },
  { code: 'esgoto_rede', label: 'Esgoto da rede pública', group: 'Serviços básicos' },
  { code: 'energia_rede', label: 'Energia da rede pública', group: 'Serviços básicos' },
];
export const PROGRAMS: Record<string, string> = { '0515': 'PDDE (dinheiro direto na escola)', '00PI': 'PNAE (merenda escolar)', '0969': 'PNATE (transporte escolar)', '00SB': 'Complementação da União ao Fundeb' };
export const STAGE_LABEL: Record<string, string> = { TRANSFERRED: 'transferido', RECEIVED: 'recebido', PAID: 'pago', LIQUIDATED: 'liquidado', COMMITTED: 'empenhado', DUE: 'previsto' };
export const SITUACAO_OBRA_ORDER = ['Em execução', 'Paralisada', 'Cadastrada', 'Concluída', 'Cancelada'];

export const GLOSSARY: Record<string, string> = {
  saeb: 'Prova nacional (INEP) aplicada a amostras de alunos; a média é uma proficiência numa escala própria de cada série e disciplina.',
  ideb: 'Índice do INEP de 0 a 10 que combina a nota nas provas (Saeb) com a aprovação dos alunos.',
  abandono: 'Percentual de alunos matriculados que deixaram a escola antes de terminar o ano.',
  distorcao: 'Percentual de alunos com dois anos ou mais de atraso em relação à idade esperada para a série.',
  inse: 'Indicador do INEP do nível socioeconômico das famílias dos alunos; descreve contexto, não qualidade da escola.',
};
