/**
 * Taxonomia funcional das proposições em linguagem humana.
 *
 * Este módulo é seguro para servidor e cliente (sem `server-only`): é a única fonte dos
 * nomes, dos verbos e das cores dos dez grupos funcionais.
 *
 * Cores: sete matizes categóricos + um cinza para "Outras formas". Os hexadecimais
 * (declarados em globals.css como --group-*) foram validados com o validador de paleta do
 * skill de dataviz sobre a superfície do cartão (#faf9f5):
 *   - faixa de luminosidade OKLCH 0,43–0,77, croma ≥ 0,10, contraste ≥ 3:1;
 *   - pior par adjacente na ordem fixa abaixo: ΔE 13,6 (CVD) e 22,8 (visão normal).
 * A ordem da faixa é FIXA (taxonômica), nunca por tamanho: a cor segue a entidade e a ordem
 * é o mecanismo de segurança para daltônicos. Não reordene sem revalidar.
 */

export type GroupKey =
  | 'proposicoes_legislativas_principais'
  | 'requerimentos'
  | 'emendas_substitutivos'
  | 'pareceres_relatorios'
  | 'instrumentos_votacao_tramitacao'
  | 'indicacoes_sugestoes'
  | 'oficios_documentos'
  | 'mensagens_comunicacoes_institucionais'
  | 'recursos_representacoes_peticoes'
  | 'atos_documentos_especiais';

export interface GroupMeta {
  key: GroupKey;
  /** O que o grupo faz, em verbo — usado como rótulo principal. */
  verb: string;
  /** Nome oficial legível do grupo (a sigla fica como sublabel). */
  label: string;
  /** Uma frase que explica o grupo para quem nunca ouviu a sigla. */
  description: string;
  /** Valor CSS da cor (variável definida em globals.css). */
  color: string;
  /** true = dobra no segmento cinza "Outras formas" nas visões densas. */
  tail: boolean;
}

/** Ordem taxonômica fixa da faixa. Não ordenar por tamanho. */
export const GROUPS: readonly GroupMeta[] = [
  { key: 'proposicoes_legislativas_principais', verb: 'Criar ou alterar normas', label: 'Proposições legislativas principais', description: 'Projetos, propostas de emenda à Constituição e medidas que podem virar norma.', color: 'var(--group-1)', tail: false },
  { key: 'requerimentos', verb: 'Fazer requerimentos', label: 'Requerimentos', description: 'Pedidos de informação, de providência ou de decisão dentro do processo legislativo.', color: 'var(--group-2)', tail: false },
  { key: 'emendas_substitutivos', verb: 'Modificar textos', label: 'Emendas e substitutivos', description: 'Propostas para mudar o texto de uma matéria que já está em tramitação.', color: 'var(--group-3)', tail: false },
  { key: 'pareceres_relatorios', verb: 'Analisar matérias', label: 'Pareceres e relatórios', description: 'Documentos que analisam outra matéria. Não são novas propostas de lei.', color: 'var(--group-4)', tail: false },
  { key: 'instrumentos_votacao_tramitacao', verb: 'Intervir na votação ou na tramitação', label: 'Instrumentos de votação e tramitação', description: 'Atos que mudam a forma como uma matéria, ou parte dela, é apreciada.', color: 'var(--group-5)', tail: false },
  { key: 'indicacoes_sugestoes', verb: 'Recomendar providências', label: 'Indicações e sugestões', description: 'Recomendações encaminhadas a um destinatário ou a um processo.', color: 'var(--group-6)', tail: false },
  { key: 'oficios_documentos', verb: 'Documentar e oficiar', label: 'Ofícios e documentos', description: 'Comunicações e documentos ligados a outro processo.', color: 'var(--group-7)', tail: false },
  { key: 'mensagens_comunicacoes_institucionais', verb: 'Comunicar institucionalmente', label: 'Mensagens e comunicações institucionais', description: 'Comunicações de finalidade institucional, como mensagens do Executivo.', color: 'var(--group-other)', tail: true },
  { key: 'recursos_representacoes_peticoes', verb: 'Contestar e peticionar', label: 'Recursos, representações e petições', description: 'Procedimentos que contestam ou provocam uma decisão dentro de um processo.', color: 'var(--group-other)', tail: true },
  { key: 'atos_documentos_especiais', verb: 'Atos especiais', label: 'Atos e documentos especiais', description: 'Atos com função específica no processo; a história depende da evidência publicada.', color: 'var(--group-other)', tail: true },
] as const;

export const GROUP_KEYS: readonly GroupKey[] = GROUPS.map(group => group.key);
export const GROUP_BY_KEY: Readonly<Record<string, GroupMeta>> = Object.fromEntries(GROUPS.map(group => [group.key, group]));

/** Cor do segmento cinza que reúne a cauda. */
export const OTHER_COLOR = 'var(--group-other)';
export const OTHER_LABEL = 'Outras formas';

/**
 * Cor do texto DENTRO de um segmento colorido, escolhida pela luminância do preenchimento para clarear 4,5:1:
 * branco nos grupos 1, 2, 4, 5 e 6 (4,7 a 7,1:1); tinta quase preta nos grupos 3 e 7 e no cinza (4,6 a 5,2:1).
 */
const INK_ON_COLOR: Readonly<Record<string, string>> = {
  'var(--group-1)': '#ffffff', 'var(--group-2)': '#ffffff', 'var(--group-3)': '#0b1512', 'var(--group-4)': '#ffffff',
  'var(--group-5)': '#ffffff', 'var(--group-6)': '#ffffff', 'var(--group-7)': '#0b1512', 'var(--group-other)': '#0b1512',
};
export const inkOn = (color: string) => INK_ON_COLOR[color] ?? '#ffffff';

export const groupMeta = (key: string): GroupMeta => GROUP_BY_KEY[key] ?? GROUPS[GROUPS.length - 1]!;

/** Siglas cujo significado é seguro afirmar. Qualquer outra aparece como "sigla publicada". */
const TYPE_NAMES: Readonly<Record<string, string>> = {
  PL: 'Projeto de lei', PLS: 'Projeto de lei do Senado', PLC: 'Projeto de lei da Câmara', PLP: 'Projeto de lei complementar',
  PEC: 'Proposta de emenda à Constituição', PDL: 'Projeto de decreto legislativo', PDS: 'Projeto de decreto legislativo do Senado',
  PRS: 'Projeto de resolução do Senado', PRC: 'Projeto de resolução', MPV: 'Medida provisória', PLN: 'Projeto de lei do Congresso Nacional',
  PLV: 'Projeto de lei de conversão',
  REQ: 'Requerimento', RQS: 'Requerimento', RIC: 'Requerimento de informação', RQI: 'Requerimento de informação', RQN: 'Requerimento no Congresso Nacional',
  SBT: 'Substitutivo', EMC: 'Emenda', EMP: 'Emenda de plenário', EMR: 'Emenda de relator',
  PRL: 'Parecer do relator', PAR: 'Parecer', REL: 'Relatório',
  RPD: 'Instrumento de tramitação', DTQ: 'Destaque',
  INC: 'Indicação', SUG: 'Sugestão',
  MSC: 'Mensagem', MSF: 'Mensagem', MCN: 'Mensagem do Congresso Nacional',
  DOC: 'Documento', OF: 'Ofício', OFS: 'Ofício', OFN: 'Ofício',
  REC: 'Recurso', PET: 'Petição', REP: 'Representação',
};
export const typeName = (type: string): string | null => TYPE_NAMES[type.toUpperCase()] ?? null;

/** Rótulos do macroestágio, na ordem do "rio de tramitação". */
export const STAGES = [
  { key: 'presented', label: 'Apresentação' },
  { key: 'rite', label: 'Rito' },
  { key: 'instruction', label: 'Instrução' },
  { key: 'agenda', label: 'Pauta' },
  { key: 'deliberation', label: 'Deliberação' },
  { key: 'post', label: 'Pós-deliberação' },
  { key: 'outcome', label: 'Desfecho' },
] as const;
export type StageKey = (typeof STAGES)[number]['key'];
export const stageLabel = (key: string) => STAGES.find(stage => stage.key === key)?.label ?? key;

export const HOUSES = { camara: 'Câmara dos Deputados', senado: 'Senado Federal' } as const;
export type ScopeKey = 'congresso' | 'camara' | 'senado';
export const SCOPE_LABEL: Record<ScopeKey, string> = { congresso: 'Congresso', camara: 'Câmara', senado: 'Senado' };
export const houseShort = (source: string) => (source === 'senado' ? 'Senado' : 'Câmara');

export const nf = new Intl.NumberFormat('pt-BR');
export const pf = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
export const pf0 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
export const formatDate = (value: string | null | undefined) => {
  const day = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return day ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)) : 'data não publicada';
};
