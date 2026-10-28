# Testes e idempotência

- `DATABASE_GUARD`: PASS (`projetoeleitor_db`).
- `SOURCE_RUN_ID` idempotência: PASS; após reexecuções, existem 20 source-runs bloqueados únicos e zero fatos.
- `PROUNI_REAL_INGESTION`: NOT_RUN_NO_VALID_FILE.
- `FIES_REAL_INGESTION`: NOT_RUN_NO_VALID_FILE.
- Validação de arquivo: PASS; HTML de desafio local foi rejeitado, não tratado como CSV.
- Transação/last-known-good: sem snapshot publicado, nada foi substituído.
- Não houve interrupção de PNCP/collectors, alteração de frontend ou novo migration.
