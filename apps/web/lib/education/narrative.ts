import type { Narrative } from '@/lib/security/types';
import { brlShort, fmt } from '@/lib/security/format';
import type { BarRow, EduScope, Explorer } from './types';
import { nameOf, type YV } from './build';

/**
 * Frases de abertura de cada capítulo: dizem o que os dados mostram e o que NÃO mostram. Nunca atribuem causa
 * ("por causa de", "graças a"): variações são descritas, não explicadas, e nenhum território é chamado de bom ou ruim.
 */
type Loose = Record<string, any>;
export interface NarrativeInput {
  scope: EduScope; year: number; errors: string[]; enr: YV[]; enrLast: YV | null; enr5: YV | null; totals: Loose;
  saebExplorer: Explorer | null; idebExplorer: Explorer | null; flowExplorer: Explorer | null; saeb: unknown; ideb: unknown; flow: unknown;
  infraBars: BarRow[]; docs: Loose | undefined; cTot: Loose | undefined; contracts: Loose | null; catTop: BarRow | null; inseLast: Loose | undefined; tr: Loose | undefined;
}
const defaultHeadline = (e: Explorer | null, key?: string): string | null => { if (!e) return null; const k = key && e.views[key]?.headline ? key : Object.keys(e.views).find(x => e.views[x]!.headline); return k ? e.views[k]!.headline : null; };
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const bar = (rows: BarRow[], label: string) => rows.find(r => r.label === label);

export function narrative(i: NarrativeInput): { lede: string; network: Narrative; learning: Narrative; trajectory: Narrative; context: Narrative; structure: Narrative; teachers: Narrative; money: Narrative } {
  const who = nameOf(i.scope); const where = i.scope.kind === 'uf' ? `no estado de ${who}` : `em ${who}`;
  const math = defaultHeadline(i.saebExplorer, '2|5|0') ?? defaultHeadline(i.saebExplorer); const ideb = defaultHeadline(i.idebExplorer); const aband = defaultHeadline(i.flowExplorer, 'ab|fun');
  const m = i.totals.matriculas != null ? Number(i.totals.matriculas) : i.enrLast?.value ?? null; const esc = i.totals.escolas != null ? Number(i.totals.escolas) : null;
  const change = i.enrLast && i.enr5 ? (i.enrLast.value! / i.enr5.value! - 1) : null;
  const net = m != null ? `${fmt(m)} alunos estudam ${where}${esc ? ` em ${fmt(esc)} escolas` : ''} (Censo Escolar ${i.year}).${change != null ? ` Em ${i.enr5!.year} eram ${fmt(i.enr5!.value!)}: ${Math.abs(change) < 0.02 ? 'praticamente o mesmo número' : change > 0 ? `${fmt(Math.abs(change) * 100, 0)}% a mais` : `${fmt(Math.abs(change) * 100, 0)}% a menos`}.` : ''}` : `Não há matrículas publicadas ${where}.`;
  const internet = bar(i.infraBars, 'Internet'); const lib = bar(i.infraBars, 'Biblioteca ou sala de leitura'); const quad = bar(i.infraBars, 'Quadra de esportes'); const lab = bar(i.infraBars, 'Laboratório de ciências');
  const infra = [internet && `${internet.display} têm internet`, lib && `${lib.display} têm biblioteca ou sala de leitura`, lab && `${lab.display} têm laboratório de ciências`, quad && `${quad.display} têm quadra`].filter(Boolean) as string[];
  const lede = [net, math ? `${math.replace(/ ?\.$/, '')}.` : null, aband ? `${aband}` : null].filter(Boolean).join(' ');
  const cT = i.cTot;
  return {
    lede,
    network: { question: `Quantos estudam ${where}, e esse número está crescendo ou caindo?`, answer: net, context: 'Cada aluno é contado uma vez por vínculo com uma turma; a divisão por etapa e por rede mostra onde estão as matrículas.', invite: 'Veja abaixo a evolução e quais redes concentram os alunos.' },
    learning: { question: 'Como está o aprendizado, em matemática e em português?', answer: math ?? 'Não há resultado do Saeb publicado para este território.', context: [ideb, 'O Saeb é uma prova por amostra, a cada dois anos; o Ideb junta a nota com a aprovação. Use as abas para trocar disciplina, etapa e rede.'].filter(Boolean).join(' '), invite: 'Troque a disciplina e a etapa para ver cada resultado.' },
    trajectory: { question: 'Quantos alunos abandonam, reprovam ou ficam atrasados?', answer: aband ?? 'Não há taxas de abandono publicadas para este território.', context: 'São taxas oficiais do INEP: abandono (saiu no meio do ano), reprovação e aprovação somam cerca de 100% dos alunos; distorção idade-série mede o atraso na série.', invite: 'Escolha o que medir e a etapa para acompanhar a série histórica.' },
    context: { question: 'Qual é o contexto socioeconômico das famílias dos alunos?', answer: i.inseLast ? `O nível socioeconômico médio dos alunos ${where} foi ${fmt(Number(i.inseLast.media ?? 0), 2)} na escala de 1 a 8 (INSE ${i.inseLast.year}).` : 'O INEP não publicou o nível socioeconômico para este território.', context: 'O INSE descreve o contexto das famílias e ajuda a ler os resultados com justiça; ele não mede a qualidade da escola.', invite: 'Compare com a referência estadual e nacional no gráfico.' },
    structure: { question: 'As escolas têm o básico para ensinar?', answer: infra.length ? `${infra.join('; ')}.` : 'Não há infraestrutura publicada para este território.', context: 'Os dados são autodeclarados pelas escolas no Censo; o percentual considera só as que responderam. Escolha um item para ver a evolução.', invite: 'Veja a evolução de cada item.' },
    teachers: { question: 'Quantos professores há e com que condições de trabalho?', answer: i.docs ? `Há ${fmt(Number(i.docs.value))} professores na educação básica ${where}.` : 'Não há número de docentes publicado para este território.', context: 'Os indicadores de formação e de alunos por turma descrevem as condições de ensino; não são notas de qualidade.', invite: 'Compare as condições por etapa.' },
    money: { question: 'Quanto foi contratado e repassado para a educação, e há obras?', answer: cT ? `Os contratos de educação publicados no PNCP ${where} somam ${brlShort(Number(cT.contractedValue))} em ${fmt(Number(cT.contracts))} contratos${i.catTop ? `; a maior fatia é ${lowerFirst(i.catTop.label)}` : ''}.` : 'Ainda não há contratos de educação publicados para este território.', context: 'É valor contratado, não valor pago nem entregue. Os repasses federais, as obras e a despesa aparecem abaixo, cada um com a sua fonte e sem somar fontes diferentes.', invite: 'Veja para quem foi contratado e o que está em obra.' },
  };
}

/** Capítulo do Enem (P11.6): nota é de quem concluiu NESTA escola, nunca de quem mora aqui; nunca atribui causa. */
export function enemNarrative(i: { scope: EduScope; edition: number; featuredLabel: string; featuredMean: number | null; registrants: number | null }): Narrative {
  const where = i.scope.kind === 'uf' ? `no estado de ${nameOf(i.scope)}` : `em ${nameOf(i.scope)}`;
  const answer = i.featuredMean != null ? `A nota média em ${i.featuredLabel.toLowerCase()} dos participantes do Enem ${i.edition} cuja escola de conclusão está ${where} foi ${fmt(i.featuredMean, 1)} pontos.` : `Não há nota do Enem ${i.edition} publicada ${where} com participantes suficientes para divulgar.`;
  return { question: 'Como foi o desempenho dos estudantes no Enem?', answer, context: 'A nota é de quem concluiu o ensino médio NESTA escola, não de quem mora aqui; o Inep não publica o município de residência. Células com menos de 10 participantes não são divulgadas.', invite: 'Troque a área para ver a nota e a comparação por rede.' };
}

/** Capítulos de ensino superior (P11.2/P11.3/P11.5): mesma regra de não atribuir causa e não classificar território. */
export function higherEdNarrative(i: { scope: EduScope; heOwn: Loose | null; heYear: number; courseHighlightCount: number; gradProgramCount: number; capesYear: number }): { higherEd: Narrative; quality: Narrative; graduate: Narrative } {
  const where = i.scope.kind === 'uf' ? `no estado de ${nameOf(i.scope)}` : `em ${nameOf(i.scope)}`;
  const he = i.heOwn;
  const heAnswer = he ? `${fmt(Number(he.ies))} instituições oferecem ${fmt(Number(he.courses))} cursos de ensino superior ${where} (Censo ${i.heYear}), somando ${fmt(Number(he.enrollments ?? 0))} matrículas.` : `Não há Censo da Educação Superior publicado ${where}.`;
  const qAnswer = i.courseHighlightCount > 0 ? `${i.courseHighlightCount} curso${i.courseHighlightCount > 1 ? 's' : ''} ${where} ${i.courseHighlightCount > 1 ? 'estão' : 'está'} entre as faixas mais altas do Conceito Enade no ciclo mais recente.` : `Não há curso nas faixas mais altas do Conceito Enade ${where} no ciclo mais recente.`;
  const gAnswer = i.gradProgramCount > 0 ? `${fmt(i.gradProgramCount)} programa${i.gradProgramCount > 1 ? 's' : ''} de pós-graduação (mestrado/doutorado) da CAPES ${where} (${i.capesYear}).` : `Não há programa de pós-graduação da CAPES publicado ${where}.`;
  return {
    higherEd: { question: 'Quantas universidades e faculdades existem, e o que elas oferecem?', answer: heAnswer, context: 'Conta quem oferece curso no território, inclusive polos de EAD de instituições sediadas em outro município; matrícula é do Censo da Educação Superior, não é pessoa única.', invite: 'Veja os maiores cursos por matrícula e a divisão entre rede pública e privada.' },
    quality: { question: 'Essas instituições são bem avaliadas?', answer: qAnswer, context: 'IGC (por instituição) e CPC/Conceito Enade/IDD (por curso) medem coisas diferentes; nenhum deles vira um índice único nem um "melhor do Brasil".', invite: 'Veja a distribuição de faixas do IGC no estado e os destaques por curso.' },
    graduate: { question: 'Há mestrado e doutorado por aqui?', answer: gAnswer, context: 'Dado da CAPES/Sucupira, ciclo de avaliação quadrienal 2021–2024; alunos e docentes são contagens agregadas, sem identificação individual.', invite: 'Veja os programas por área de avaliação e a distribuição de conceitos.' },
  };
}
