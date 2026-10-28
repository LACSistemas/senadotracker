# P11.3 — Indicadores de qualidade do ensino superior

`P11_3_STATUS = PASS_WITH_CAVEATS`.

Foram persistidas 16 planilhas agregadas oficiais do INEP: IGC, CPC, IDD e Conceito Enade para 2018, 2021, 2022 e 2023. O ciclo mais recente efetivamente disponível nas fontes coletadas é 2023; não há preenchimento artificial de 2024/2025.

Resultados source-native: IGC 8.207 linhas; CPC 36.521 linhas válidas source-native nas quatro edições; Enade e IDD preservam linhas sem conceito como `band = null` e valores contínuos separados. O crosswalk usa `CO_IES` e `CO_CURSO` exatos, sem fuzzy. Linhas sem correspondência ficam `UNRESOLVED`.

`READY_FOR_P11_4_ACCESS_PROGRAMS = YES` · `READY_FOR_QUALITY_FRONTEND = YES (com cobertura explícita)` · `READY_FOR_PUBLIC_PUBLICATION = NO` enquanto pendências de reconciliação jurídica/metodológica e linhas não vinculadas não forem revisadas · `HISTORICAL_QUALITY_COVERAGE_COMPLETE = NO` (série oficial coletada é 2018/2021–2023).
