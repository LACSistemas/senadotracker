# Contratos estatísticos canônicos

## Chave da observação

Uma observação Bem-Estar é identificada por:

`(indicator_code, method_version, entity_id, geography_version, period_start, dimension_key, source_release)`.

No fato publicado atual, `indicator_id + entity_id + period_start` continua a chave física compatível com `exec_ind_value`; `dimension_key` só pode ser usado quando uma família publicar fatos especializados ou quando a dimensão já estiver codificada no indicador. Nunca colapsar duas dimensões distintas no mesmo indicador.

## Campos obrigatórios

| Campo | Tipo lógico | Regra |
|---|---|---|
| indicator_code/version | texto + smallint | identidade estável e método versionado |
| source/dataset/release | texto | organização, sistema, recurso e edição separados |
| entity_id | integer | FK para `exec_entity`; nunca nome livre como chave |
| geography_version | texto | malha e validade da geografia da fonte |
| period_start/end | date | intervalo semiaberto; sem “ano” implícito |
| frequency | enum | census, annual, monthly, quarterly, event |
| value | numeric | valor publicado, sem float na camada de contrato; o schema atual usa double e exige validação de escala |
| numerator/denominator | numeric nullable | somente quando semanticamente existem |
| measure_type | enum | stock, flow, mean, median, share, rate, index, currency |
| unit | texto | pessoa, família, domicílio, R$/mês, %, por mil etc. |
| universe | texto | população elegível e exclusões |
| weighting | texto nullable | fator/amostragem quando aplicável |
| uncertainty | JSON nullable | intervalo/erro somente se fonte publicar |
| status | enum | zero, missing, not_applicable, suppressed, blocked, under_review, partial, invalidated, published_with_caveat |
| provenance | referência | run, raw hash, parser, publication, coverage, data_through |

## Medidas e denominadores

- **Estoque:** pessoas/vínculos/equipamentos em uma data ou competência. Não é fluxo.
- **Fluxo:** admissões, desligamentos, pagamentos ou movimentações no intervalo. Pode ser somado apenas com período e universo compatíveis.
- **Média/mediana:** não aditivas; a mediana municipal não é soma nem média simples da UF.
- **Percentual/taxa:** numerador e denominador devem ser publicados ou calculados de universo explícito. Taxa Caged exige estoque de referência distinto do saldo.
- **Valor financeiro:** estágio e unidade separados; não somar empenho, liquidação e pagamento.
- **Faixas:** cada classe é uma observação/dimensão; o total deve reconciliar apenas quando as classes forem mutuamente exclusivas e exaustivas.

O campo nulo é válido. Zero só é publicado quando a fonte observou efetivamente zero e a cobertura está válida.

## Tempo

`reference_period` é o período do fenômeno; `published_at` é a divulgação; `ingested_at` é a coleta; `data_through` é o limite observado; `valid_from/to` é validade metodológica/geográfica. Censo 2022, RAIS ano-base, Caged competência e execução financeira mensal não são intercambiáveis.

## Comparabilidade

Uma comparação só é elegível se: mesma unidade, universo, denominador, frequência, método, geografia compatível e cobertura mínima declarada. Razões de rejeição devem ser estruturadas: `DIFFERENT_UNIVERSE`, `DIFFERENT_GEOGRAPHY_VERSION`, `NON_ADDITIVE_MEASURE`, `MISSING_DENOMINATOR`, `PARTIAL_COVERAGE`, `SOURCE_REVISION_MISMATCH`.

## Mapeamento para o schema existente

`exec_ind_def` guarda código, versão, unidade, grain, numerador/denominador, ranking e semântica nula. `exec_ind_value` guarda o fato por território/período, com status, numerador, denominador, valor, flags e run. `exec_ind_latest` é serving. `exec_publication` é o snapshot transacional. Campos que não cabem nessas tabelas ficam no staging e nos metadados de source-run; não devem ser descartados silenciosamente.

