# Matriz de comparadores

| Indicador | Município | UF | Brasil | Uso |
|---|---|---|---|---|
| escolas | disponível quando publicado | disponível | disponível | comparação descritiva |
| matrículas | disponível quando publicado | disponível | disponível | contexto de escala |
| internet/infraestrutura | depende do denominador | depende do denominador | depende do denominador | não é ranking |
| Ideb | etapa/rede | etapa/rede | etapa/rede | somente mesma edição/recorte |
| fluxo | série e taxa específicas | série e taxa específicas | série e taxa específicas | não combinar taxas |
| financiamento | parcial por fonte | parcial por fonte | parcial por fonte | Siconfi/SIOPE separados |

Comparadores só são exibidos quando o read model entrega os três níveis semanticamente compatíveis. A interface comunica contexto; não cria leaderboard nacional nem soma grandezas incompatíveis.

Para municípios, o read model calcula adicionalmente a mediana da distribuição de municípios da UF e do Brasil no mesmo ano: matrículas observadas, percentual de internet entre respostas válidas e Ideb por etapa/rede. Cada célula informa `n`; uma célula sem população elegível permanece nula.

