# P12.2 — Fontes IBGE validadas

## Fonte e método

Coleta realizada em 28/10/2026 a partir da API oficial SIDRA do IBGE, com os recursos JSON preservados em `D:\Civica\raw\bem-estar\ibge\censo-2022`. A descoberta semântica foi feita pela API de metadados do IBGE e a carga usou somente valores agregados, sem identificação pessoal.

Metadados oficiais:

- [SIDRA 10295 — rendimento domiciliar per capita](https://servicodados.ibge.gov.br/api/v3/agregados/10295/metadados)
- [SIDRA 10301 — índice de Gini](https://servicodados.ibge.gov.br/api/v3/agregados/10301/metadados)
- [SIDRA 6803 — abastecimento de água](https://servicodados.ibge.gov.br/api/v3/agregados/6803/metadados)
- [SIDRA 6805 — esgotamento sanitário](https://servicodados.ibge.gov.br/api/v3/agregados/6805/metadados)
- [SIDRA 6892 — destino do lixo](https://servicodados.ibge.gov.br/api/v3/agregados/6892/metadados)

## Recursos consumidos

| Tabela | Variável/categorias | Níveis coletados | Uso canônico |
|---|---|---|---|
| 10295 | 13431 média; 13534 mediana; sexo 6794, idade 95253, cor 95251 | N1, N3, N6 | renda média e mediana em BR, UF e município |
| 10301 | 13418 | N1, N3 | Gini em BR e UF; a tabela oficial não oferece N6 |
| 6803 | total 72129; adequado 72144 | N1, N3, N6 | adequado / total × 100 |
| 6805 | total 46292; adequado 46290 | N1, N3, N6 | adequado / total × 100 |
| 6892 | total 10972; coletado 2520 | N1, N3, N6 | coletado / total × 100 |

As respostas foram obtidas nos endpoints `https://apisidra.ibge.gov.br/values/t/{tabela}/n{1|3|6}/all/v/{variavel}/p/2022`, acrescentando as classificações oficiais acima quando aplicável. A sintaxe de níveis é separada por requisição; a tentativa de combinar N1 e N3 em uma URL única foi descartada após resposta 400.

## Limitação material

O metadado da tabela 10301 confirma somente os níveis territoriais N1, N2 e N3. Não existe Gini municipal nessa tabela do Censo 2022. O indicador `WB-INC-GINI` foi, portanto, publicado apenas para Brasil e 27 UFs; nenhum valor municipal foi inventado ou imputado.

## Integridade dos recursos

Os tamanhos e SHA-256 dos 14 JSON efetivamente usados estão em `P122_RESULTS.json`, no campo `sourceFiles` do run e no manifesto completo `D:\Civica\staging\bem-estar\ibge\censo-2022\source-manifest.json`. Os arquivos de origem e o staging permanecem em D:, fora do repositório; o repositório contém somente contrato, relatório e evidência resumida.
