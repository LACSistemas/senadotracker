# P12.2 — Relatório de execução IBGE

## Resumo executivo

P12.2 foi operacionalizada com dados reais do Censo 2022 via SIDRA. O banco alvo foi comprovadamente `projetoeleitor_db`; os JSON brutos permanecem em `D:\Civica`. Foram publicados seis indicadores canônicos: renda domiciliar per capita média, renda domiciliar per capita mediana, Gini (Brasil/UF), água adequada, esgotamento adequado e lixo coletado.

Resultado: **PASS_WITH_DOCUMENTED_SOURCE_LIMITATION**. A limitação é objetiva e externa ao pipeline: o Gini da tabela oficial 10301 não possui nível municipal.

## Publicação

- Dataset: `120` (`IBGE Censo 2022 — Bem-estar`)
- Competência operacional: `202212`; período estatístico: 2022
- Fatias: 1 Brasil + 27 UFs = 28
- Valores publicados: 28.018
- Indicadores novos: 6 (IDs 9001–9006)
- Status: definitivo (`status = 2`)
- Revisão e change log: engine transacional existente (`publishSlice` + `upsertIndicators`)

## Cobertura

Os cinco indicadores com fonte N6 cobrem todos os 5.570 municípios do Censo 2022. A base atual possui 5.571 entidades municipais porque inclui Boa Esperança do Norte, criada posteriormente; não há linha censitária para ela. O Gini cobre Brasil e 27 UFs (28 territórios), conforme a granularidade publicada na SIDRA 10301.

## Semântica financeira/estatística

Renda média e mediana são valores publicados em reais/mês, sem denominador artificial. Moradia é derivada somente quando numerador e denominador oficiais estão disponíveis: categoria adequada ÷ total × 100. A categoria `-` permanece valor nulo com sinal de indisponibilidade. Ausência não vira zero.

## Proveniência

Os arquivos, URLs efetivas, bytes e SHA-256 estão em `P122_RESULTS.json`, `FONTES_IBGE_VALIDADAS.md` e no manifesto completo em `D:\Civica\staging\bem-estar\ibge\censo-2022\source-manifest.json`. O catálogo corrigido contém 20 indicadores do contrato P12.1; apenas os seis semanticamente validados nesta onda foram ativados.

## Orçamento observado

```text
DB_BASELINE_BYTES=33861332115
DB_BEFORE_P122_BYTES=33861332115
DB_AFTER_P122_BYTES=33870130323
DB_TOTAL_GROWTH_BYTES=8798208
WELLBEING_CUMULATIVE_GROWTH_BYTES=8798208
P122_ATTRIBUTED_GROWTH_BYTES=8798208
P122_INITIAL_STORAGE_ENVELOPE_BYTES=500000000
WELLBEING_SOFT_LIMIT_BYTES=6000000000
WELLBEING_HARD_LIMIT_BYTES=8000000000
WELLBEING_REMAINING_BUDGET_BYTES=7991201792
WAL_TEMP_SPACE_CHECK=PASS_WITH_CAVEATS
DB_BUDGET_GATE=PASS
```

O baseline foi medido antes da primeira escrita. A atribuição é o delta direto do banco (limite superior conservador para estruturas compartilhadas). Espaço livre observado: D: `406530924544` bytes; C: `34030268416` bytes. O papel SQL não expôs `data_directory`, por isso a localização física do WAL não foi presumida.

## Gates

| Gate | Resultado |
|---|---|
| NETWORK/SOURCE_AUTHORITY | PASS — API oficial IBGE/SIDRA |
| DATABASE_GUARD | PASS |
| CATALOG_STRUCTURAL_INTEGRITY | PASS |
| REAL_DATA_INGESTION | PASS |
| TERRITORIAL_RECONCILIATION | PASS |
| GINI_SCOPE_DISCLOSURE | PASS_WITH_DOCUMENTED_LIMITATION |
| PRIVACY | PASS |
| STORAGE_SAFETY | PASS |
| IDEMPOTENCY | PASS |
| NO_DOUBLE_COUNTING | PASS |
| P12.1_REGRESSION | PASS — contrato corrigido sem reabrir a arquitetura |
| READY_FOR_P12.3 | NO — não iniciar automaticamente |

## Próximo passo

O read layer já pode consumir os seis códigos novos, respeitando a indisponibilidade municipal do Gini e a data-base única de 2022. P12.3 não foi iniciada.
