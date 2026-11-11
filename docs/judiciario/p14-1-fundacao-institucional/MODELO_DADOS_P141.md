# Modelo de dados — P14.1

Schema PostgreSQL: `civica_jud`. Tabelas: `jud_branch`, `jud_degree`, `jud_tribunal`, `jud_tribunal_version`, `jud_unit`, `jud_unit_version`, `jud_external_id`, `jud_territorial_relation`, `jud_source_snapshot`, `jud_publication_revision` e `schema_migrations`.

A identidade institucional, a unidade, a relação territorial, o snapshot RAW e a revisão publicada são entidades separadas. Não há tabelas de processo, movimento, parte, magistrado ou documento. A chave física municipal é FK opcional para `civica_exec.exec_entity`; códigos TJBA permanecem source-native até crosswalk IBGE.

Contratos de leitura exportados em `packages/db/src/postgres-judiciary.ts`: branches, tribunais, detalhes de tribunal/unidade, unidades por município físico, jurisdição e cobertura institucional.
