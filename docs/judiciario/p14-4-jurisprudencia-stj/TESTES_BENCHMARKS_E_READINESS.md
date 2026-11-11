# Testes, benchmarks e readiness

- Guard de banco: PASS.
- Typecheck `@senadotracker/db`: PASS.
- Migration e collector com dados reais: PASS.
- Replay idempotente: PASS (NO_CHANGE, 0 bytes).
- RAW em D: PASS.
- Crescimento: 18.61 MB de 100 MB permitidos.

| Contrato | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|
| Overview | 3.2 | 4.95 | 6.13 |
| Precedentes paginados | 3.87 | 7.76 | 7.85 |
| Decisoes paginadas | 2.96 | 6.01 | 6.38 |

P14.4 esta pronta para expansao controlada; P14.5 e P14.7 continuam explicitamente nao iniciadas.
