# Reprodução P10.9

Executar no repositório, com o `.env`/connection contract habitual:

```powershell
node --import tsx scripts/exec/educacao-p108-safety.ts
node --import tsx scripts/exec/educacao-p109-link-programs-fast.ts
node --import tsx scripts/exec/educacao-p109-evidence.ts
node --import tsx scripts/exec/educacao-p108-bench.ts docs/executivo-collector-plan/educacao-p109-execucao/BENCHMARK_READ_MODELS_P109.json 30
node --import tsx scripts/exec/educacao-p109-payloads.ts
node --import tsx --test tests/unit/educacao-p109.test.ts tests/unit/educacao-analytics-p108.test.ts tests/integration/educacao-p108.test.ts
npm.cmd exec tsc -- --noEmit -p tsconfig.base.json
```

Para restaurar o backup em cluster isolado, usar `pg_restore --list artifacts/projetoeleitor_p109_full_20261027.dump` antes de qualquer restore e nunca apontar o restore para o banco oficial.
