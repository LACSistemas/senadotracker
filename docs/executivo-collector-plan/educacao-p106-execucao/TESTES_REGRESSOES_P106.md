# Testes e regressões

- Migração 15 aplicada no `projetoeleitor_db`.
- `node --import tsx --test tests/unit/educacao-programas-p106.test.ts`: **1/1 PASS**.
- `node --import tsx scripts/exec/p106-validate.ts`: **PASS** (publicações, fatos, estágios, chaves e SIOPE preservado).
- Compatibilidade SIOPE: **243 fatias ativas**, v1/v2 históricos preservados e v3 incremental sem mudança no replay.
- Benchmark: resumo 304 ms, transferência municipal 329 ms, PDDE escolar 0,17 ms; planos em `BENCHMARK_READ_MODELS_P106.json`.
- Suíte completa: 562 testes, 454 pass, 64 skipped, 44 fail. As falhas são 39–104 em fases anteriores e repetem `undefined.connect/query` por pool/fixture; não apontam para o código P10.6. Log integral em `reproducibilidade/full_test_p106.log`.
- Typecheck global continua bloqueado por sintaxe preexistente em `scripts/p5_rebuild_global_rollup.ts`; não foi introduzida por P10.6.
