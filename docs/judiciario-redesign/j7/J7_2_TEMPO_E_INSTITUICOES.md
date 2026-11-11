# J7.2 — Tempo, congestionamento e instituições

## O problema real
`JN_CONGESTION_RATE`, `JN_CLEARANCE_INDEX` e `JN_TIME_DISPOSED_MEAN` são `aggregation_allowed: NONE_RATE_OFFICIAL`/`MEAN_ONLY` — **não existe uma taxa nacional válida** (confirmado em runtime: `value: null` com `availability: METHOD_INCOMPATIBLE` ao consultar `judOverview` para esses 3 indicadores). A versão anterior respeitava essa regra corretamente, mas resolvia o problema **removendo a visualização inteira** — texto explicando a limitação, sem nenhum gráfico. Isso é estatisticamente correto, mas visualmente insuficiente (exatamente o diagnóstico do mandato).

## A solução: distribuição real, não média falsa
`comparison_eligible: true` para os 3 indicadores (confirmado via SQL direto em `jud_jn_indicator`) — ou seja, embora não seja válido SOMAR as taxas, É válido comparar tribunal a tribunal, e por extensão, mostrar a **distribuição real** de valores entre os 91 tribunais que reportam. Isso não é uma média nacional inventada: é a estatística oficial de cada tribunal, todas reais, plotadas lado a lado.

### Nova função de leitura (única adição de backend desta fase)
`getJudiciaryIndicatorDistribution(pool, indicatorId, year)` em `packages/db/src/postgres-judiciary-serving.ts` — um único `SELECT` sobre `jud_jn_observation`/`jud_tribunal`, filtrando `institutional_level <> 'CONTROL'` (exclui CNJ/STF do "quanto cada tribunal julgador represa"), ordenado por valor. Só leitura, nenhuma tabela nova, nenhuma migração. Exportada em `packages/db/src/index.ts` e em um wrapper web `loadJudiciaryIndicatorDistribution` (cache de 5min, mesmo padrão de todo `lib/judiciary.ts`).

### Dado real confirmado (JN_CONGESTION_RATE, 2025, 91 tribunais)
Mínimo: TRE-BA, 6,4%. Mediana: ~50,2%. Máximo: TJES, 71,0%.

### A visualização
Uma tira horizontal com um ponto por tribunal real (91 pontos), posicionado pela taxa de congestionamento; hover/`title` nativo mostra sigla e valor exato; uma marca vertical destaca a mediana; texto abaixo identifica o tribunal de menor e maior taxa nominalmente. A legenda explica o que a distância entre os pontos significa: "a Justiça brasileira varia internamente — uma única taxa nacional esconderia essa diferença". Nenhum número é uma média — é uma estatística de posição (mínimo/mediana/máximo) sobre valores individuais reais.

## Achado real corrigido durante a verificação: contraste de cor
O rótulo "mediana X%" inicialmente usava a cor da marca (`#d39a3c`, âmbar) diretamente no texto — axe-core real apontou `color-contrast` sério (2.19:1 contra o fundo claro, abaixo do mínimo de 4.5:1 do WCAG 2.2 AA). Violação do princípio "texto nunca usa a cor da série, só as marcas carregam identidade" (prática padrão de visualização de dados que eu próprio deveria ter seguido desde o início). Corrigido: o texto volta para a tinta padrão (`text-foreground`), e um traço vertical pequeno ao lado do texto (não o texto em si) carrega a cor âmbar. Reverificado com axe-core real: 0 violações.

## Comparador preservado
O link "Abrir o comparador" continua levando ao comparador tribunal-a-tribunal existente (`/judiciario/comparar?indicador=JN_CONGESTION_RATE`) — a distribuição nova é um resumo editorial na página nacional, não substitui a investigação detalhada que já existia.
