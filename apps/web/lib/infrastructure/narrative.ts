import type { Narrative } from '../security/types.ts';
import { fmt } from '../security/format.ts';
import type { InfraScope } from './types.ts';

/**
 * Frases de abertura de cada capítulo: dizem o que os dados mostram e o que NÃO mostram. Nunca atribuem causa,
 * nunca classificam o território como bom ou ruim, nunca misturam universos ou anos de fontes diferentes como se
 * fossem do mesmo instante. Mesma regra de `lib/wellbeing/narrative.ts` e `lib/security/narrative.ts`.
 */
const whereOf = (scope: InfraScope): string => scope.kind === 'uf' ? `no estado de ${scope.name}` : `em ${scope.name}`;

export function heroLede(scope: InfraScope, kpiCount: number, worksTotal: number | null): string {
  const where = whereOf(scope);
  const worksTxt = worksTotal != null && worksTotal > 0 ? ` e ${fmt(worksTotal)} projetos de obra pública registrados` : '';
  if (kpiCount === 0 && !worksTotal) return `Ainda não há indicadores de infraestrutura publicados ${where}.`;
  return `Esta seção reúne ${kpiCount} indicadores oficiais sobre ruas, água, energia e serviços urbanos${worksTxt} ${where} — cada um com sua própria fonte, ano e cobertura.`;
}

export function waterNarrative(scope: InfraScope, hasAny: boolean): Narrative {
  const where = whereOf(scope);
  return {
    question: 'Como estão os serviços de água e saneamento?',
    answer: hasAny ? `O SINISA publica indicadores de abastecimento de água, esgotamento, resíduos e gestão dos serviços ${where}.` : `O SINISA não publicou indicadores de água e saneamento ${where} nesta edição.`,
    context: 'Os indicadores do SINISA medem a rede de serviço declarada pelos prestadores, não a qualidade da água entregue nem a continuidade do fornecimento.',
    invite: hasAny ? 'Veja os indicadores por tipo de serviço abaixo.' : '',
  };
}

export function urbanNarrative(scope: InfraScope, hasAny: boolean): Narrative {
  const where = whereOf(scope);
  return {
    question: 'Como são as condições das ruas e do entorno das moradias?',
    answer: hasAny ? `O Censo 2022 registrou, para o entorno dos domicílios ${where}, a presença de calçada, iluminação, pavimentação e outras sete características urbanas.` : `O Censo 2022 não registrou características de entorno ${where}.`,
    context: 'Cada característica foi observada por três unidades estatísticas diferentes — faces de quadra, domicílios e moradores — que nunca devem ser misturadas no mesmo gráfico: são denominadores distintos.',
    invite: hasAny ? 'Alterne entre as três unidades estatísticas abaixo.' : '',
  };
}

export function housingNarrative(scope: InfraScope, hasAny: boolean): Narrative {
  const where = whereOf(scope);
  return {
    question: 'Como são as condições domiciliares e o déficit habitacional?',
    answer: hasAny ? `Favelas e comunidades urbanas, internet domiciliar e déficit habitacional têm fontes e universos próprios ${where}.` : `Não há indicadores de habitação publicados ${where}.`,
    context: 'Favelas e Comunidades Urbanas só tem registro em municípios onde o IBGE identificou essas áreas — ausência de registro não é ausência de precariedade. O déficit habitacional da Fundação João Pinheiro só é publicado para UF e Brasil, nunca por município.',
    invite: hasAny ? 'Veja cada fonte separadamente abaixo.' : '',
  };
}

export function energyNarrative(scope: InfraScope, hasAny: boolean): Narrative {
  const where = whereOf(scope);
  return {
    question: 'Quais condições de acesso à energia foram observadas?',
    answer: hasAny ? `Geração distribuída (MMGD), qualidade do serviço elétrico (ANEEL) e postos de combustível (ANP) são reportados separadamente ${where}.` : `Não há indicadores de energia publicados ${where}.`,
    context: 'A potência instalada de geração distribuída não é geração de energia nem consumo; o cadastro de revendedores de GLP é parcial na fonte coletada.',
    invite: hasAny ? 'Veja cada fonte de energia abaixo.' : '',
  };
}

export function mobilityNarrative(scope: InfraScope, hasAny: boolean): Narrative {
  const where = whereOf(scope);
  return {
    question: 'Como são os serviços de mobilidade e a infraestrutura logística?',
    answer: hasAny ? `Transporte cotidiano (MUNIC/PEMOB) e infraestrutura logística (aeródromos, rodovias) são reportados separadamente ${where}.` : `Não há indicadores de mobilidade ou logística publicados ${where}.`,
    context: 'A PEMOB teve apenas 96 municípios respondentes no Brasil nesta edição — não é uma média universal. Aeródromo cadastrado não é aeroporto com operação comercial regular.',
    invite: hasAny ? 'Veja transporte cotidiano e logística abaixo.' : '',
  };
}

export function waterSecurityNarrative(scope: InfraScope, hasAny: boolean): Narrative {
  const where = whereOf(scope);
  return {
    question: 'Há barragens cadastradas e qual seu risco declarado?',
    answer: hasAny ? `SNISB e SIGBM (ANM) registram barragens com classificação de risco e dano potencial ${where}.` : `Não há barragens cadastradas no SNISB ou SIGBM ${where}.`,
    context: 'SNISB (barragens em geral) e SIGBM/ANM (barragens de mineração) são cadastros de fontes diferentes e não foram deduplicados entre si — a mesma barragem pode, em tese, aparecer nos dois. Classificação de risco (CRI) e dano potencial associado (DPA) não são uma previsão de rompimento.',
    invite: hasAny ? 'Veja os registros abaixo.' : '',
  };
}

export function worksNarrative(scope: InfraScope, totalProjects: number, multi: number): Narrative {
  const where = whereOf(scope);
  const answer = totalProjects > 0
    ? `O Obrasgov registra ${fmt(totalProjects)} projetos de obra pública ${where}${multi > 0 ? `, ${fmt(multi)} deles compartilhados com outros municípios` : ''}.`
    : `Não há projetos de obra pública do Obrasgov registrados ${where}.`;
  return {
    question: 'Quais obras públicas estão registradas e com que situação?',
    answer,
    context: 'Valores financeiros previstos, contratados, empenhados, liquidados e pagos são estágios diferentes e nunca são somados entre si. Projetos com mais de um município vinculado mantêm o valor total do projeto, sem rateio — nunca atribua o valor integral a cada município.',
    invite: totalProjects > 0 ? 'Explore a lista completa de obras.' : '',
  };
}
