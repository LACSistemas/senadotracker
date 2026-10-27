# Reprodução P10.9.1

```powershell
node --import tsx scripts/exec/educacao-p1091-materialize.ts
node --import tsx scripts/exec/educacao-p1091-profile.ts docs/executivo-collector-plan/educacao-p1091-execucao/PROFILING_COMPONENTES_EDUCACAO.json
node --import tsx scripts/exec/educacao-p1091-bench.ts docs/executivo-collector-plan/educacao-p1091-execucao/BENCHMARK_READ_MODELS_P1091.json 100
node --import tsx scripts/exec/educacao-p1091-load.ts docs/executivo-collector-plan/educacao-p1091-execucao/TESTE_CARGA_EDUCACAO.json
node --import tsx scripts/exec/educacao-p1091-cold.ts
node --import tsx --test tests/unit/educacao-p1091.test.ts tests/unit/educacao-p1091-1.test.ts
```

O teste de carga usa exclusivamente o cluster isolado na porta 55439. A publicação oficial só ocorre depois do refresh isolado.
