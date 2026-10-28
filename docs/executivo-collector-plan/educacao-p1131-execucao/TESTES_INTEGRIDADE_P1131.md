# Testes de integridade P11.3.1

- DATABASE_GUARD: PASS (`projetoeleitor_db`).
- Conservacao source/valid: PASS com deltas explicitamente listados em `CONSERVACAO_LINHAS_QUALIDADE.csv`.
- Linkage: PASS_WITH_DOCUMENTED_UNRESOLVED; zero ambiguos observado.
- TP_DIMENSAO/EAD: PASS_WITH_CAVEATS; sem imputacao municipal/UF.
- Enade/IDD independence: PASS.
- Reconciliacao externa Sinopses: BLOCKED_EXTERNAL.
- Publicacao ampla: NO, enquanto a reconciliacao externa e a revisao metodologica nao forem fechadas.
