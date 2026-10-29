# Reuso financeiro Siconfi

## Contrato reutilizado

Os fatos já existentes em `civica_exec.exec_fin_fact` foram mantidos como fonte única. A função 08 (Assistência Social) foi localizada pelo código contábil `08`; as dimensões de exercício, entidade, conta e estágio permanecem no modelo financeiro original.

Cobertura observada: 6.811.397 fatos, 5.597 entidades, exercícios 2014–2026. Para 2024, a função 08 possui EMP em 5.571 entidades, LIQ em 5.571 e PAG em 5.569. Para 2025, EMP 5.530, LIQ 5.529 e PAG 5.528.

## Semântica

EMP, LIQ e PAG são estágios distintos. RREO acumulado por bimestre (`*_ATE`) não deve ser somado entre bimestres. Ausência de um estágio não é zero. DCA/RREO e revisões continuam pertencendo ao domínio financeiro; Bem-Estar só consome o read model.

Não foram criados fatos `WB-*` para despesas, transferências, Bolsa Família, BPC ou contratos. Fornecedor PNCP não foi interpretado como pagamento nem como prova de função orçamentária.

## Gate

`SICONFI_FINANCIAL_REUSE_STATUS=PASS`

`DUPLICATED_FINANCIAL_FACTS=0`

O contrato de leitura previsto é uma seleção contextual por município/exercício/função/estágio, sem soma de bimestres acumulativos e sem mistura de EMP, LIQ e PAG.
