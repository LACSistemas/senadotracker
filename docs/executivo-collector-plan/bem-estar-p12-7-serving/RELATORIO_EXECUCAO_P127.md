# P12.7 — Consolidação nacional de bem-estar e read models

## Resumo executivo

P12.7 foi concluída no banco `projetoeleitor_db`, schema `civica_exec`, como uma camada somente de leitura sobre fatos já publicados nas fases P12.2, P12.4-R, P12.5 e P12.6. Não houve nova coleta, nova publicação de fatos, migration ou alteração de frontend. Os arquivos brutos continuam fora do banco, em `D:\Civica`.

O contrato canônico entrega 27 indicadores em seis capítulos: condições (6), proteção social (10), trabalho (6), cotidiano digital (5), ação pública (contexto financeiro Siconfi) e evolução (27). O read model preserva fonte, edição, período, unidade, universo, numerador/denominador, cobertura, revisão e procedência.

## Resultado

- `P12_7_STATUS=PASS_WITH_CAVEATS`
- `READ_MODELS_IMPLEMENTED=PASS`
- `TERRITORIES_SUPPORTED=Brasil + 27 UFs + municípios publicados`
- `CHAPTERS_SUPPORTED=conditions, social, work, digital, action, evolution`
- `COMPARATORS_VALIDATED=municipality/state/Brazil quando a semântica permite`
- `MUNIC_CATEGORICAL_CONTRACT=PASS`
- `RAIS_2025_RESIDUAL_HANDLING=PASS_DOCUMENTED`
- `COVERAGE_CONTRACT=PASS`
- `SOURCE_PROVENANCE=PASS`
- `ACTIVE_REVISION_GATE=PASS`
- `FINANCIAL_REUSE=PASS — fatos Siconfi existentes, sem duplicação`
- `READ_MODEL_INVALIDATION=PASS — publicação ativa e last-known-good`
- `N_PLUS_ONE=PASS`
- `OVERVIEW_SQL_P95_MS=48.558` (EXPLAIN representativo; read service p95 máximo 318.204 ms)
- `CHAPTER_SQL_P95_MS=48.558` (capítulo reutiliza a mesma leitura set-based; read service p95 máximo 303.167 ms)
- `PAYLOAD_COMPRESSED_BYTES=4278` (máximo de overview)
- `P127_DB_GROWTH_BYTES=0`
- `P123_UNCHANGED=YES`
- `ANATEL_UNPUBLISHED=YES`
- `FRONTEND_CHANGED=NO`
- `P12_8_READY=YES`
- `P12_8_STARTED=NO`

## Implementação

Arquivos principais:

- `packages/db/src/exec/wellbeing-read.ts`
- `apps/web/lib/wellbeing.ts`
- `scripts/exec/p127_smoke.ts`
- `scripts/exec/p127_bench.ts`

Funções públicas: overview, capítulo, série temporal, comparadores, cobertura, metodologia e contexto financeiro. O overview lê apenas a publicação ativa, agrega os 27 indicadores e reutiliza a execução financeira da função 08. O join entre `exec_ind_latest` e `exec_ind_value` usa o mesmo `run_id`, preservando a coerência da revisão.

## Validação real

Foram exercitados Vitória/ES, São Paulo/SP, Alto Rio Novo/ES, Boa Esperança do Norte/MT, Brasília/DF, ES, SP e Brasil. Cada caso retornou 27 observações e os capítulos esperados. O comparador MUNIC de Vitória retornou 1,0 no município, 0,179487 no ES e 0,112892 no Brasil, com denominadores de respostas válidas. O Gini municipal foi corretamente rejeitado, com comparações somente estadual e nacional. O contexto Siconfi de Vitória retornou EMP, LIQ e PAG de 2024 sem confundir fases.

## Limitações preservadas

CadÚnico, Bolsa Família e BPC continuam bloqueados e não são exibidos como zero. Anatel permanece não publicada por ausência de exportação estruturada comprovada. Gini não possui granularidade municipal. SUAS mantém universos diferentes por instrumento; CRAS/CREAS não são ranking de qualidade. RAIS é estoque de vínculos do estabelecimento, Caged é fluxo mensal; não são somados nem convertidos em desemprego.

Os detalhes de cobertura, comparabilidade, publicação e benchmarks estão nos demais artefatos desta pasta.
