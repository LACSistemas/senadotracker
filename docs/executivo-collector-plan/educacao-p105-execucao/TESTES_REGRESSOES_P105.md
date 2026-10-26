# Testes e regressões P10.5

* TypeScript: `packages/db` e `apps/collector` compilam sem erros.
* Migration: schema `civica_exec` avançou de 13 para 14; objetos P10.1–P10.4 não foram alterados.
* Refusal-first: `SELECT current_database()` retornou `projetoeleitor_db` antes da migration/publicações.
* Siconfi: 336 fatias 2014–2025, `missing=0`; replay ES/2024 retornou `NO_CHANGE`.
* SIOPE: onda nacional 2017–2025 publicou 243 fatias, 972 componentes, 3.395.269 fatos e RAW gzip em `D:\Civica\raw\siope`; replay ES/2024 retornou `NO_CHANGE`.
* Read models: summary Siconfi, summary SIOPE e cobertura executados no banco real; `EXPLAIN ANALYZE` usou índice da chave do fato e executou em 6,37 ms (a latência total varia com cache).
* Frontend não foi alterado. Lab e SQLite não foram acessados.

* Typecheck de todos os workspaces: PASS. Suíte completa: 562 testes, 454 pass, 64 skipped, 44 falhas em integrações que dependem de pool/fixtures não configurados (registradas como limitação preexistente; nenhum teste direcionado de P10.5 falhou).
