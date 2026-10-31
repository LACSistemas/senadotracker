# Publicação e revisões P13.2

As 13 fatias (`dataset_id=140`, `uf=0`) foram publicadas em transações independentes. Cada run registra `source_hash = SHA256(raw_sha + competência + parser_version)`, `inputs`, `quality`, `rows_in`, `rows_out` e `exec_raw_manifest`.

Idempotência: a segunda execução completa retornou `NO_CHANGE` para as 13 competências (`run_id` 38074–38086), sem nova revisão e sem inserções duplicadas. A regra de last-known-good permanece no motor: um candidato incompleto (como INDGER 2026-09) não substitui a competência estável 2026-08.

DEC/FEC não abriu revisão canônica por não haver grão municipal elegível.
