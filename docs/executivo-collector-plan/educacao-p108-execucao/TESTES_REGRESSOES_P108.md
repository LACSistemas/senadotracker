# Testes e regressões P10.8

`node --import tsx --test tests/unit/educacao-analytics-p108.test.ts tests/integration/educacao-p108.test.ts`: 8 testes descobertos, 5 pass, 0 fail, 3 skipped por ausência de `EXEC_TEST_ADMIN_URL`. A reconciliação real passou nas 11 verificações. A suíte histórica completa mantém falhas herdadas das fases anteriores; elas não foram mascaradas. Fingerprints pré/pós e backup permitem restauração da camada `civica_exec`.

Typecheck global (`npm.cmd exec tsc -- --noEmit -p tsconfig.base.json`) permanece bloqueado por erros sintáticos preexistentes em `scripts/p5_rebuild_global_rollup.ts`; nenhum erro novo da camada P10.8 foi observado nos testes direcionados.
