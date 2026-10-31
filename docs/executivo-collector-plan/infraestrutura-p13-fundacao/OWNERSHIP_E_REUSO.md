# Ownership e reuso

| Ativo | Proprietário | Reuso P13 |
|---|---|---|
| `exec_entity` e IDs IBGE | plataforma Executivo | reutilizar; não criar municípios |
| `exec_ind_*` | plataforma Executivo | reutilizar com códigos SINISA versionados |
| `exec_edu_infra_*` | Educação | não reinterpretar como saneamento |
| `exec_tra_frota_mun_mes`/`exec_tra_infr_uf_mes` | Transporte | manter separado; não duplicar |
| Siconfi/PNCP/Executivo financeiro | Executivo/Finanças | consultar contratos existentes |
| Bem-estar/Censo 2022 | Bem-estar | contextualizar, nunca igualar a SINISA |

Não há dados SINIS/SINISA persistidos no banco auditado nem arquivos do projeto. Qualquer crosswalk SNIS→SINISA será editorial e versionado; não altera indicadores históricos.
