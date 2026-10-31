# Mapa do modelo

DDL v27 criou `civica_exec.exec_work_project` (identidade e cadastro), `exec_work_location`, `exec_work_physical`, `exec_work_status_event`, `exec_work_contract`, `exec_work_commitment` e `exec_work_cov`.

`source_project_id` é a chave nativa do empreendimento. Contratos, empenhos, execução física, histórico e localidades referenciam essa chave; valores monetários são armazenados em centavos (`bigint`). O banco não recebe payload JSON bruto.
