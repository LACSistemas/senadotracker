# Testes e benchmarks — P14.1

- Database guard: PASS (`current_database() = projetoeleitor_db`).
- Typecheck do pacote `@senadotracker/db`: PASS.
- Testes unitários direcionados P14.1: 2/2 PASS.
- Migração e carga: PASS; FK, chaves únicas e estados de revisão aplicados.
- Replay idempotente: PASS; 0 novas linhas e 0 bytes de crescimento no replay final.
- Contagens finais: 93 tribunais, 3764 unidades, 2888 relações, 5 snapshots, 3 revisões.
- O typecheck global de testes mantém falhas preexistentes em `tests/unit/educacao-p113.test.ts` e `tests/unit/educacao-p114.test.ts`; não foram introduzidas por P14.1.
- Nenhum DataJud foi chamado; nenhum processo foi coletado.
- Smoke read-only de dom�nios existentes ap�s carga: civica_exec.exec_entity 5.631, civica_national.houses 29 e civica_ops.control_plane_runs 0; nenhuma tabela existente foi escrita.
