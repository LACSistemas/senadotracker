# Comparabilidade e comparadores

## Matriz de decisão

| Família | Município | UF | Brasil | Regra |
|---|---|---|---|---|
| Censo 2022 9001/9002/9004–9006 | sim | sim | sim | mesmo período e unidade |
| Gini 9003 | não | sim | sim | tabela oficial não publica N6 |
| SUAS 9101–9301 | descritiva | descritiva | descritiva | universo do instrumento, sem ranking de qualidade |
| RAIS 9401 | sim | sim | sim | estoque de vínculos do estabelecimento |
| RAIS 9402 | não | sim | sim | remuneração média real, não mediana municipal |
| Caged 9500–9503 | sim | sim | sim | série mensal; não somar como estoque RAIS |
| MUNIC 9601–9605 | sim | derivada | derivada | proporção de respostas Sim/(Sim+Não), não população |
| Siconfi função 08 | depende do fato | depende do fato | depende do fato | EMP/LIQ/PAG permanecem estágios separados |

## Rejeições explícitas

- Gini em município: `eligible=false`, motivo documentado.
- Comparador MUNIC com denominador zero ou somente respostas não aplicáveis: inelegível.
- Caged versus RAIS: sem percentual de desemprego ou estoque sintético.
- SUAS: sem leaderboard nacional de qualidade.
- Financeiro: sem soma de empenhado, liquidado e pago.

Os comparadores retornam fonte, período e denominador para que a UI faça leitura contextual sem inventar precisão.
