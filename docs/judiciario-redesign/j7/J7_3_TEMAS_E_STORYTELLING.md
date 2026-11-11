# J7.3 — Temas: de 6 cartões uniformes a um tema em destaque

## Antes
6 cartões idênticos (Execução fiscal, Execução geral, Execução penal, Violência doméstica, Justiça criminal, Conciliação) — mesma estrutura (título, descrição, contagem de indicadores, seta), nenhuma hierarquia, nenhum dado real visível além da contagem de indicadores.

## Critério de seleção do tema em destaque (explícito, conforme exigido pelo mandato §10.1)
**Não** foi escolhido "o de mais indicadores" automaticamente. Critério real, verificado: **Violência doméstica** tem a série de indicadores SUM-elegíveis mais completa entre os 6 temas reais (338-340 observações nos indicadores principais de casos novos/baixados — confirmado via `getJudiciaryThemeOverview('DOMESTIC_VIOLENCE')`), permitindo construir uma comparação real de casos novos × baixados sem lacunas relevantes, **e** é o tema com relevância social mais direta e reconhecível para quem não conhece o vocabulário do CNJ (o próprio mandato, ao descrever o conceito central da página, cita "violência doméstica" como exemplo de assunto que "mobiliza o sistema"). Os outros 5 temas (Execução fiscal, Execução geral, Execução penal, Justiça criminal, Conciliação) permaneceriam candidatos igualmente válidos; a escolha é editorial e está documentada aqui para auditoria, não escondida no código.

## Nova composição
- **Tema em destaque** (card grande, fundo escuro, mesma identidade do hero): título, descrição oficial, e uma comparação real de 2 barras (casos novos 7.068.785 × processos baixados 6.984.025, CNJ 2025) — nota explícita de que o indicador "não representa número de vítimas nem prova de crime" (preservada do dado oficial, não removida).
- **Outros 5 temas**: lista compacta (nome + contagem real de indicadores + link), não mais 5 cartões do mesmo tamanho do destaque — hierarquia visual clara entre "aprofundado aqui" e "aprofunde clicando".

## Integridade preservada
- Nenhum gráfico de proporção/donut combinando os 6 temas como se fossem categorias mutuamente exclusivas de um todo (eles não são — um processo pode pertencer a múltiplos temas, ex. execução fiscal É um tipo de execução geral).
- Nenhuma cobertura por tribunal inventada; o card do tema em destaque usa só os 2 indicadores nacionais já confirmados `AVAILABLE`.
- Link "Explorar o tema completo" preserva a rota real `/judiciario/temas/domestic_violence`, já existente e testada (`tests/e2e/p148-judiciario.spec.ts`, "violência doméstica preserva ausência real em anos anteriores a 2016" continua passando sem alteração).
