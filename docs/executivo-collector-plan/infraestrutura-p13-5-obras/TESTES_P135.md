# Testes

- DATABASE_GUARD: PASS (`current_database()=projetoeleitor_db`).
- API smoke: PASS, seis endpoints com HTTP 200 e envelope válido.
- CSV audit P13.5.0: PASS após correção de quoting.
- DDL v27/migration: PASS.
- Integridade referencial: PASS; filhos sem pai foram rejeitados.
- Idempotência: PASS; replay do hash `17df14a9…` inseriu 0 duplicatas e não alterou o tamanho do banco.
- EXPLAIN ANALYZE: PASS; detalhe usa PK e município usa índice dedicado.
- Privacidade: PASS; raw/staging somente em D:, sem payload bruto no banco.
- Regressões P13.1–P13.4: somente leitura; nenhum collector interrompido.
