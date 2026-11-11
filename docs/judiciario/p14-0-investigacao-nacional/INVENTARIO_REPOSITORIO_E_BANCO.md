# Inventário do repositório e banco

## Banco

Consulta executada em transação `BEGIN READ ONLY` usando o mesmo contrato de `scripts/exec/db.ts`:

- `current_database()`: `projetoeleitor_db`
- `current_user`: `projetoeleitor_user`
- `pg_database_size`: 34.621.951.123 bytes
- schemas: `civica`, `civica_budget`, `civica_exec`, `civica_national`, `civica_ops`, `civica_state`, `civica_state_budget`, POCs e outros.
- tabelas cujo schema/nome indicava Judiciário, tribunal, court ou process: **0**.
- índices cujo schema/tabela indicava Judiciário: **0**.
- migrations específicas do Judiciário: **0**.

`civica_exec` contém dados executivos (inclusive FIES), não um domínio judicial. `civica_state` e `civica_state_budget` são domínios legislativos/estaduais; não devem ser reutilizados semanticamente para processos.

## Repositório

Foram encontrados os três relatórios de investigação na raiz e logos/ testes que apenas referenciam fontes (DataJud/STJ). Não foi encontrado collector, migration, contrato de leitura ou página `judiciario` de produção. Scripts `scripts/exec/p14_*` existentes referem-se a projetos territoriais do Executivo e não são reutilizáveis como domínio judicial sem revisão.

## Reuso recomendado

Reusar: `scripts/exec/db.ts`, pools PostgreSQL, padrão de `ingestion_revisions`, `active_publications`, `raw_objects`/armazenamento externo, SHA-256, last-known-good, dimensões territoriais e contratos SSR já existentes. Não criar tabela nesta fase.

## Espaço

`D:` foi medido via `fsutil`: 403.078.451.200 bytes livres de 500.106.784.768 (~375,4 GB livres). A leitura de `C:` foi negada pelo sandbox; não é uma medição confiável e deve ser repetida fora do ambiente restrito antes de downloads. Nenhum arquivo grande foi salvo.

## Proteções observadas

`POSTGRES_WRITES=0`, `MIGRATIONS_CREATED=0`, `COLLECTORS_STARTED=0`, `FRONTEND_CHANGED=NO`. Nenhum PNCP ou collector existente foi interrompido.
