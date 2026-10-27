# Contratos de serving para P10.10

Os contratos existentes permanecem na camada `packages/db/src/exec` e não exigem acesso direto do browser ao PostgreSQL.

| Contrato | Granularidade | Estado | Observação |
|---|---|---|---|
| `getEducationSchoolProfile` | escola | disponível/condicional | preserva coberturas e supressões |
| `getEducationMunicipalityProfile` | município | parcial | programas municipais agora usam mapa determinístico; 30 códigos continuam fora |
| `getEducationStateProfile` | UF | disponível/parcial por família | rollups SICONFI/SIOPE/programas separados |
| `getEducationNationalProfile` | Brasil | parcial | não somar fontes ou estágios financeiros |
| `getEducationMunicipalityBenchmarks` | município + pares | descritivo | não é ranking; dimensões precisam coincidir |
| `getEducationProgramMunicipal` | município/programa | disponível para vinculados | município canônico vem de `exec_entity` |
| `getEducationProgramCoverage` | fonte/competência | cobertura | `NULL` e ausência não viram zero |

Payloads UTF-8 medidos: escola 495.123 B; município São Paulo 499.975 B; UF SP 3.835.336 B; Brasil 26.182.477 B; benchmarks Vitória 1.705 B. O payload nacional é um ponto de atenção para paginação/streaming futuro.
