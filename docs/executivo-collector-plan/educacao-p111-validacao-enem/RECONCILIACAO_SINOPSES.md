# Reconciliação com as Sinopses Estatísticas do Enem

## Método

Foram baixados, para `D:\Civica\staging\p11_1\sinopses`, os três ZIPs oficiais vinculados à página de Sinopses do Inep. A reconciliação foi feita contra as planilhas XLSX internas, sem gravar linhas de participantes.

Foram comparados, por edição, o número de inscritos (tabela 1.1), presentes nos dois dias (1.2), a distribuição de presença, o total/média/mediana de Matemática (7.4.1) e o total/média/mediana da redação (7.5.1).

## Resultado

| Edição | Inscritos microdados | Inscritos Sinopse | Presentes nos dois dias (microdados/Sinopse) | Matemática válida (microdados/Sinopse) | Redação válida (microdados/Sinopse) |
|---|---:|---:|---:|---:|---:|
| 2023 | 3.933.955 | 3.933.955 | 2.678.264 / 2.678.264 | 2.692.427 / 2.692.427 | 2.704.814 / 2.704.814 |
| 2024 | 4.332.944 | 4.332.944 | 2.990.093 / 2.990.093 | 3.004.981 / 3.004.981 | 3.002.710 / 3.002.710 |
| 2025 | 4.810.772 | 4.810.772 | 3.244.348 / 3.244.348 | 3.260.336 / 3.260.336 | 3.245.696 / 3.245.696 |

As médias e medianas também coincidem, com diferença apenas de arredondamento de ponto flutuante (por exemplo, Matemática 2023: 533,8357003179888 no streaming contra 533,8357003179598 na Sinopse; mediana 523,6 em ambos).

## Denominadores

`results_rows` é o total de linhas da base de resultados e coincide com inscritos. `all_four_present` é a soma de linhas com `TP_PRESENCA_CN/CH/LC/MT = 1`, equivalente a “presente nos dois dias” na tabela 1.2. Uma nota objetiva é válida quando a presença é `1` e a nota é numérica não negativa. Redação válida usa, adicionalmente, `TP_STATUS_REDACAO = 1` (“Sem problemas”), regra necessária para coincidir com 7.5.1.

## Limites

A Sinopse nacional não prova residência nem permite cruzar questionário com escola. As provas territoriais deste P11.1 usam exclusivamente o município da escola de conclusão (`CO_MUNICIPIO_ESC`), explicitamente rotulado no material de saída. Não há atribuição de nota ao município de residência.
