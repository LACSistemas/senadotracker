# Contrato de dados para a P10.8 (G11_P108_READINESS): PASS_WITH_CAVEATS

A P10.8 pode consumir, via `@senadotracker/db` (`educacao-contratos-read.ts`):

- `getEduContractsTerritory(Brasil|UF|município, ano?)`: totais por ano e categoria × confiança; `highAndConfirmed` separado de `possible`.
- `getEduContractList`, `getEduContractDetail` (classes com evidência, contratação com estimado ≠ homologado ≠ contratado, termos, obra por CIPI).
- `getEduSuppliers`, `getEduSupplier`, `getEduOrgan`, `getEduWorks`, `getEduWorkDetail`, `getEduContractCoverage`, `getEduSchoolContracts` (responde "sem vínculo oficial").
- Restrições obrigatórias de exibição em `EDU_CONTRACT_RESTRICTIONS` (valor contratado ≠ pago; categoria múltipla; POSSIBLE à parte; Brasil/UF/município por órgão contratante).

Limites que a P10.8 precisa respeitar: sem vínculo contrato→escola; sem valor pago; obras só de 9 UFs (parciais); contratações e termos são amostra por valor (2.030 e 21), não cobertura; contratos acima de R$ 10 bi são outliers fora das somas; valores muito concentrados (alguns contratos de bilhões dominam o total).
Desempenho: p50 mediana 6,8 ms; p95 máximo 601 ms (Brasil/território), `BENCHMARK_READ_MODELS_P107.json`.
