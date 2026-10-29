# P12.6 — Relatório de execução

## Resultado executivo

`P12_6_STATUS=PASS_WITH_CAVEATS`.

A P12.6 publicou cinco indicadores administrativos da MUNIC 2024 para 5.570 municípios (27 UFs), reutilizou fatos financeiros Siconfi já persistidos sem duplicação e auditou a documentação RAIS da P12.5. A Anatel foi investigada com fontes oficiais, mas não foi publicada: painel e documentação não comprovaram um recurso estruturado/exportável autorizado para a granularidade municipal solicitada.

O frontend não foi alterado e a P12.7 não foi iniciada.

## Execução

- Banco comprovado: `projetoeleitor_db`; schema `civica_exec`.
- RAW e staging: exclusivamente em `D:\Civica`.
- Dataset MUNIC: `124`, competência `202412`, 27 fatias UF.
- Indicadores: `9601`–`9605`, status definitivo, período `2024-12-31` a `2025-01-01`.
- Publicação: transacional por fatia via `publishSlice`/`upsertIndicators`.
- Primeira execução: 27 `PUBLISHED`.
- Replay do mesmo RAW/hash: 27 `NO_CHANGE`, crescimento de banco `0`.

## Saídas

`P12_6_STATUS=PASS_WITH_CAVEATS`

`RAIS_PARITY_AUDIT_STATUS=PASS_DOCUMENTARY_CORRECTION`

`RAIS_2024_UNIDENTIFIED_CORRECT_VALUE=10899`

`RAIS_2025_UNIDENTIFIED_CORRECT_VALUE=3065` (valor da linha `999999`; `102377` é residual de reconciliação, não o valor da linha NI).

`SICONFI_FINANCIAL_REUSE_STATUS=PASS`

`DUPLICATED_FINANCIAL_FACTS=0`

`ANATEL_STATUS=PARTIAL_NO_DOCUMENTED_STRUCTURED_EXPORT`

`MUNIC_STATUS=PASS`

`NEW_INDICATORS_PUBLISHED=5`

`EXISTING_INDICATORS_REUSED=exec_fin_fact/function_08_EMP_LIQ_PAG_and_RREO_accumulated`

`MUNICIPAL_COVERAGE=5570/5570_rows_mapped`

`UF_COVERAGE=27/27_UFs`

`IDEMPOTENT_REPLAY=PASS`

`P126_DB_GROWTH_BYTES=9494528`

`WELLBEING_CUMULATIVE_GROWTH_BYTES=98902016`

`WELLBEING_REMAINING_BUDGET_BYTES=7901097984`

`DB_BUDGET_GATE=PASS`

`P122_REGRESSION=PASS`

`P124R_REGRESSION=PASS`

`P125_REGRESSION=PASS`

`P123_UNCHANGED=YES`

`FRONTEND_CHANGED=NO`

`P12_7_READY=YES`

## Limites explícitos

Os indicadores MUNIC são respostas administrativas declaradas. Eles não medem acesso efetivo, uso, qualidade, cobertura populacional ou resultado social. Não foi criado índice composto, ranking ou agregação que transforme existência administrativa em desempenho.

Anatel permanece parcial até que exista recurso aberto estruturado e documentado com semântica e cobertura comprovadas. Nenhum endpoint interno de painel foi utilizado.
