# Arquitetura proposta

Reusar `exec_entity`, `exec_territory_population`, `exec_raw_manifest`, `exec_ingestion_run`, `exec_publication`, revisões e contratos de cobertura. Um futuro fato P12 deve conter source_run/revision, indicator_id, entity_id, competência, dimensões, unidade, numerator, denominator, value, coverage/comparability/status.

Famílias estimadas: IBGE/SIDRA; MTE; MDS social; Censo SUAS; SINISA/MUNIC; cultura/digital. RAW e microdados ficam em `D:\Civica`; PostgreSQL recebe agregados editoriais e metadados. Fingerprint, last-known-good e idempotência seguem o padrão existente.
