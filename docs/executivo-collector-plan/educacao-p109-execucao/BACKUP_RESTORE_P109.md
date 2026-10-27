# Backup e restauração P10.9

- arquivo: `artifacts/projetoeleitor_p109_full_20261027.dump`
- formato: PostgreSQL custom, **full data**;
- tamanho: 3.461.602.109 bytes;
- SHA-256: `3ef534704f57d0f71c3d1c2e37a336b7b3cf884fdfbd8c75a3f8be97b19a3176`;
- `pg_restore --list`: PASS;
- restauração: cluster isolado `.p109_pg_cluster`, porta 55439;
- validação isolada: `current_database()=projetoeleitor_db`, `exec_edu_program_fact=563.288`, `exec_edu_program_rollup=141.834` antes do vínculo;
- tamanho do banco restaurado: 28.946.025.619 bytes;
- migration máxima no restore: 19.

O banco oficial foi alterado somente após o backup e o restore isolado. O cluster isolado foi parado após a validação; o diretório é mantido como evidência de reprodução nesta fase.
