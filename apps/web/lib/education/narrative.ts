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
