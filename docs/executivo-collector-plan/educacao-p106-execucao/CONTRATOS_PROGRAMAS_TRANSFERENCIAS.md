# Contratos canônicos

## Fato de programa

Tabela `civica_exec.exec_edu_program_fact`: `source_key` (PK), `source_dataset`, `competence`, `year`, `month`, `program_code`, `program_name`, `financial_stage`, `amount_cents`, `uf`, `municipality_siafi`, `beneficiary_type`, `beneficiary_code`, `beneficiary_name`, `entity_id`, `school_inep`, `uex_cnpj`, `eex_cnpj`, ação/plano, status fonte, `raw_id`, URL, SHA-256 e proveniência.

Estágios permitidos: `DUE`, `TRANSFERRED`, `RECEIVED`, `COMMITTED`, `LIQUIDATED`, `PAID`, `BALANCE`, `ACCOUNTABILITY`. Não há fallback entre estágios.

## Cobertura

`exec_edu_program_cov` é uma linha por fonte × competência × UF × programa e contém contagens de origem/parse/publicação/rejeição/não resolução, hash semântico e notas. `sourceUpdatedAt`, `snapshotStartedAt`, `snapshotFinishedAt` e `dataThrough` são preservados nos metadados da revisão.

## Proveniência

`exec_raw_manifest` aponta para o arquivo em `D:\Civica`; o banco armazena referência, bytes, content-type, HTTP e SHA-256, nunca o payload bruto.
