# Diagnóstico de performance herdado do P10.8 e validação P10.9

Benchmark real, 30 repetições aquecidas por cenário:

| Cenário | p50 | p95 | alvo | resultado |
|---|---:|---:|---:|---|
| escola | 4,9 ms | 16,1 ms | 100 ms | PASS |
| município Vitória | 22,0 ms | 26,1 ms | 200 ms | PASS |
| município São Paulo | 374,8 ms | 517,6 ms | 200 ms | CAVEAT |
| UF ES | 31,0 ms | 36,1 ms | 200 ms | PASS |
| UF SP | 159,3 ms | 176,4 ms | 200 ms | PASS |
| Brasil | 1.360,6 ms | 1.411,8 ms | 300 ms | CAVEAT |
| benchmarks Vitória | 319,6 ms | 366,7 ms | 200 ms | CAVEAT |

As melhorias P10.9 eliminam o scan de fatos para programas municipais, usando rollup e índice. Os gargalos remanescentes são fan-out paralelo de famílias, agregações nacionais de SIOPE/SICONFI e comparadores que recalculam oferta/infraestrutura/aprendizagem. Os planos `EXPLAIN (ANALYZE, BUFFERS)` estão em `BENCHMARK_READ_MODELS_P109.json`; eles mostram rollups usando índices, enquanto SIOPE 2025 ainda lê cerca de 411 mil linhas e usa hash aggregate com spill temporário.

Conclusão: G1 é `PASS_WITH_CAVEATS`, não PASS estrito. Próxima otimização deve compactar séries nacionais e benchmarks, sem criar uma promessa de latência que os dados atuais não sustentam.
