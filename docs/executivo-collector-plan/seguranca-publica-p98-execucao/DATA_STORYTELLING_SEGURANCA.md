# Data storytelling da Segurança (P9.8)

## A linha narrativa
Uma só história por território, na ordem em que a dúvida de quem chega costuma aparecer:

0. **Panorama** — "Como está a Segurança Pública em X?" Quatro indicadores-chave, cada um com valor, data-base, variação, régua de comparação e porta de entrada.
1. **Criminalidade** — "Quais crimes são registrados e como isso está mudando?" (seletor de crime, quantidade × taxa, janela de tempo, mudança entre períodos equivalentes, distribuição, comparação com outro município).
2. **Estrutura** — "Que estrutura pública existe?" (o que é da cidade × o que é do estado; previsto × existente; e o que não sabemos do Detran).
3. **Segurança viária** — "O que acontece nas ruas e estradas?" (mortes, frota, usuários, frota × mortes em índice, PRF e RENAEST com ressalvas).
4. **Sistema prisional** — "Qual é a capacidade de custódia?" (vagas × pessoas, ocupação, regimes, contexto do estado).
5. **Finanças** — "Quanto dinheiro público é destinado e executado?" (orçado/empenhado/liquidado/pago separados, por habitante, participação, subfunções, contratos do PNCP).
6. **Atuação policial** — "O que as estatísticas mostram sobre a atuação do Estado?" (tráfico, apreensões, armas, mandados — medidas que não se somam).
7. **Explorar os dados** — modo especialista com todos os indicadores, séries exatas e CSV.

Decisão documentada: a ordem proposta no prompt foi mantida; o único ajuste editorial foi renomear o capítulo 6 para **"Apreensões e atuação policial"** (nunca "crime organizado", porque os dados não demonstram organização criminosa) e acrescentar o capítulo 7.

## Como cada capítulo conta (pergunta → resposta → contexto → convite)
A resposta é uma frase em português corrente com número e data, gerada a partir dos dados (`narrative.ts`); o contexto traz a comparação válida **ou** diz por que ela não existe; o convite aponta a interação do capítulo. Exemplos reais (Vitória):
- Criminalidade: "Em 2025, Vitória teve 36 homicídios dolosos, uma redução de 33% em relação a 2024. Há 25 tipos de registro para explorar abaixo." + "Entre 8 municípios do Espírito Santo de 100 a 500 mil habitantes, a mediana … foi 17,1; Vitória registrou 10,5, abaixo da faixa central."
- Estrutura: "Em Vitória, a prefeitura declarou ter guarda municipal, com 427 guardas (MUNIC 2023); há delegacia de Polícia Civil no município." + "As polícias Militar e Civil são estaduais: … não são o efetivo lotado em Vitória."
- Prisional: "Nenhum estabelecimento identificado nesta base para Vitória… não prova que o município não tenha unidade."
- Finanças: "A prefeitura de Vitória pagou R$ 77,8 milhões na função Segurança Pública em 2025 (R$ 227 por habitante), +7% em valores correntes."

## Regras de microcopy
- Nomes simples ("Mortes registradas no trânsito", "Moradores mortos em acidentes de trânsito"); o código técnico fica no detalhe (explorador).
- Verbos descritivos ("teve", "registrou", "declarou"); **nunca** "por causa de", "devido a", "graças a", "resultado de" (teste automatizado).
- Valor em reais é sempre "corrente, sem correção pela inflação"; variação de gasto nunca é chamada de "crescimento real".
- Seta de variação é sempre neutra (sem verde/vermelho): alta de apreensões não é "boa" nem "ruim".
- O herói **rejeita** explicitamente: ocupação prisional (descreve o sistema, não a segurança do morador), apreensões/mandados (atividade policial, não risco) e, onde não há fonte municipal, roubos.
