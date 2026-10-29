import type { Narrative } from '../security/types.ts';
import { fmt } from '../security/format.ts';
import { nameOf } from './build.ts';
import type { PortraitFact, WbScope } from './types.ts';

/**
 * Frases de abertura de cada capítulo: dizem o que os dados mostram e o que NÃO mostram. Nunca atribuem causa,
 * nunca julgam o território como bom ou ruim, nunca misturam anos de fontes diferentes como se fossem do mesmo
 * instante. Mesma regra do `lib/education/narrative.ts`.
 */
const whereOf = (scope: WbScope): string => scope.kind === 'uf' ? `no estado de ${nameOf(scope)}` : `em ${nameOf(scope)}`;
const brl0 = (v: number): string => `R$ ${fmt(v, 0)}`;

export function portraitLede(scope: WbScope, facts: PortraitFact[]): string {
  if (!facts.length) return `Ainda não há indicadores de Bem-estar publicados para ${nameOf(scope)}.`;
  return `Um retrato de ${nameOf(scope)} a partir de ${facts.length} fontes oficiais diferentes — cada fato com seu próprio ano e cobertura, sem formar um índice único.`;
}

export function conditionsNarrative(i: { scope: WbScope; incomeMedian: number | null; incomeMean: number | null; waterPct: number | null; sewerPct: number | null; garbagePct: number | null; gini: number | null }): Narrative {
  const where = whereOf(i.scope);
  const answer = i.incomeMedian != null
    ? `O Censo 2022 registrou renda domiciliar per capita mediana de ${brl0(i.incomeMedian)} ${where}${i.incomeMean != null ? ` (a média foi ${brl0(i.incomeMean)})` : ''}.`
    : `O Censo 2022 não publicou renda domiciliar per capita para ${nameOf(i.scope)} nesta granularidade.`;
  const housing = [i.waterPct != null && `${fmt(i.waterPct, 0)}% dos domicílios tinham água adequada`, i.sewerPct != null && `${fmt(i.sewerPct, 0)}% esgotamento adequado`, i.garbagePct != null && `${fmt(i.garbagePct, 0)}% coleta de lixo`].filter(Boolean).join('; ');
  const giniTxt = i.gini != null ? ` O índice de Gini da renda ${where} foi ${fmt(i.gini, 3)}.` : '';
  return {
    question: 'Quanto se ganha e como são as condições dos domicílios?', answer,
    context: `${housing ? `No mesmo Censo, ${housing}.` : ''}${giniTxt} A média é puxada para cima por quem ganha mais; a mediana mostra o valor do domicílio "do meio" — por isso as duas aparecem lado a lado. Tudo é do Censo 2022, uma única fotografia, sem série anual.`,
    invite: 'Compare a renda mediana com o estado e o Brasil abaixo.',
  };
}

export function workNarrative(i: { scope: WbScope; raisYear: number | null; raisStock: number | null; cagedMonth: string | null; cagedBal: number | null; cagedStock: number | null }): Narrative {
  const where = whereOf(i.scope);
  const rais = i.raisStock != null ? `Em ${i.raisYear}, a RAIS registrou ${fmt(i.raisStock)} vínculos formais em estabelecimentos ${i.scope.kind === 'uf' ? 'do estado' : 'do município'}.` : `Não há estoque da RAIS publicado ${where}.`;
  const caged = i.cagedBal != null ? ` Em ${i.cagedMonth}, o saldo do Novo Caged foi ${i.cagedBal > 0 ? '+' : ''}${fmt(i.cagedBal)}${i.cagedStock != null ? ` (estoque de referência de ${fmt(i.cagedStock)} vínculos)` : ''}.` : '';
  return {
    question: 'Como está o mercado de trabalho formal?', answer: `${rais}${caged}`,
    context: 'A RAIS é o estoque anual de vínculos ativos em 31 de dezembro; o Novo Caged mede admissões e desligamentos mês a mês, vinculados ao local do estabelecimento — não é taxa de desemprego, e não mede quem mora no território, só quem trabalha nele.',
    invite: 'Veja a série mensal de admissões, desligamentos e saldo abaixo.',
  };
}

export function socialNarrative(i: { scope: WbScope; cras: number | null; creas: number | null }): Narrative {
  const where = whereOf(i.scope);
  const parts = [i.cras != null && `${fmt(i.cras)} CRAS`, i.creas != null && i.creas > 0 && `${fmt(i.creas)} CREAS com sede`].filter(Boolean);
  const answer = parts.length ? `Segundo o Censo SUAS 2024, existem ${parts.join(' e ')} registrados ${where}.` : `O Censo SUAS 2024 não registrou CRAS respondente ${where}.`;
  return {
    question: 'Qual estrutura de assistência social está registrada neste território?', answer,
    context: 'CRAS e CREAS são contados pelo município onde têm sede; um território sem CREAS sediado pode receber atendimento de uma unidade regional, o que este dado não captura. Capacidade de referenciamento, respondentes e os índices oficiais (IDCRAS/IDCREAS/IDConselho) são coisas diferentes e aparecem separadas abaixo.',
    invite: 'Veja as faixas de capacidade e os índices oficiais do Censo SUAS.',
  };
}

export function digitalNarrative(i: { scope: WbScope; municipalityAnswer: boolean | null; ufPositive: number | null; ufValid: number | null }): Narrative {
  if (i.scope.kind === 'municipio') {
    const answer = i.municipalityAnswer == null ? `A prefeitura de ${nameOf(i.scope)} não tem resposta válida registrada no MUNIC 2024 para atendimento digital.` : `Segundo o MUNIC 2024, a prefeitura de ${nameOf(i.scope)} declarou ${i.municipalityAnswer ? 'oferecer' : 'não oferecer'} atendimento digital.`;
    return { question: 'Que recursos digitais a prefeitura declara oferecer?', answer, context: 'São respostas declaradas pela própria prefeitura ao IBGE, categóricas (Sim/Não/Recusa/Não informou); "Não" não significa ausência de qualquer serviço, só que a prefeitura não declarou oferecer este item específico.', invite: 'Veja as demais respostas declaradas abaixo.' };
  }
  const answer = i.ufPositive != null && i.ufValid != null ? `${fmt(i.ufPositive)} de ${fmt(i.ufValid)} prefeituras respondentes em ${nameOf(i.scope)} declararam oferecer atendimento digital ao MUNIC 2024.` : `Não há respostas válidas do MUNIC 2024 agregadas para ${nameOf(i.scope)}.`;
  return { question: 'Quantas prefeituras declaram oferecer cada recurso digital?', answer, context: 'O denominador é o número de prefeituras com resposta válida (Sim ou Não), não a população do estado; recusas e não-respostas ficam fora da proporção, mas aparecem contadas separadamente.', invite: 'Veja a distribuição completa abaixo.' };
}

export function actionNarrative(i: { scope: WbScope; year: number | null; emp: number | null; liq: number | null; pag: number | null }): Narrative {
  const where = whereOf(i.scope);
  const answer = i.year != null ? `Em ${i.year}, a administração ${where} empenhou ${i.emp != null ? brl0(i.emp) : '—'}, liquidou ${i.liq != null ? brl0(i.liq) : '—'} e pagou ${i.pag != null ? brl0(i.pag) : '—'} em Assistência Social (função 08 do Siconfi).` : `Não há despesa de Assistência Social publicada no Siconfi ${where}.`;
  return {
    question: 'Quanto a administração pública registra em despesas com assistência social?', answer,
    context: 'Empenhado, liquidado e pago são estágios diferentes da mesma despesa e nunca devem ser somados entre si; não é o valor transferido diretamente a beneficiários (Bolsa Família, BPC), que são fontes ainda não publicadas neste domínio.',
    invite: 'Veja a série por exercício na seção de evolução.',
  };
}

export function evolutionNarrative(i: { scope: WbScope; hasRais: boolean; hasCaged: boolean; hasFinance: boolean }): Narrative {
  const parts = [i.hasRais && 'o estoque anual da RAIS (2023–2025)', i.hasCaged && 'a série mensal do Novo Caged (2026)', i.hasFinance && 'a despesa de Assistência Social por exercício'].filter(Boolean);
  return {
    question: 'Como essas séries evoluíram no tempo?', answer: parts.length ? `Abaixo estão as séries realmente publicadas para ${nameOf(i.scope)}: ${parts.join(', ')}.` : 'Nenhuma das séries temporais deste território tem pontos suficientes para exibir.',
    context: 'O Censo 2022 (renda, domicílios) e o Censo SUAS 2024 (CRAS/CREAS) têm uma edição só, por isso não entram numa curva anual aqui; misturar dados de anos diferentes como se fossem do mesmo instante distorceria a leitura.',
    invite: 'Cada série mantém sua própria unidade e período: compare só dentro da mesma série.',
  };
}
