# Performance (P9.8)

Medido no build de produção isolado e no banco real, máquina ociosa, 20 iterações (`scripts/security/perf.ts`; saída em `desempenho_camada_de_dados.json`).

## Camada de dados (por página, carga fria)
| Medida | Resultado |
|---|---|
| SQLs fixos por página | 39–62 (não crescem com nº de crimes/séries: **sem N+1**) |
| JSON inicial embutido | 80–180 KB |
| Tempo de dados, p95 | 71–311 ms (BH ≈ 311, RS ≈ 269, SP ≈ 163) |
| Maior statement, p95 | ≤ 156 ms |
| Benchmark sob demanda (`/api/seguranca/benchmark`) | ≈ 10–150 ms (antes da reescrita SQL: 700–975 ms) |

Técnicas: opções de crime "lazy" (esboço + pico, série completa só ao selecionar), benchmark e índice do explorador só sob demanda, cache em memória de 5 min para leituras estaduais, CTEs materializadas no benchmark, benchmarks do herói/finanças em paralelo.

## Entrega
| Medida | Resultado |
|---|---|
| HTML (Vitória) | 364 KB bruto / 56 KB gzip |
| JS (10 scripts) | 661 KB bruto / 204 KB gzip |
| TTFB | ≈ 460 ms |
| Carga até rede ociosa (17 territórios) | 0,9–1,4 s |

## Metas do prompt
- Resumo (vitrine) < 200 ms p95: **atende** (leituras estaduais cacheadas; municipais 1 consulta por indicador do herói).
- Overview < 500 ms p95: **atende na camada de dados** (≤ 311 ms); TTFB total inclui renderização React e fica ≈ 460 ms ocioso.

## Ressalvas
- Rodada anterior sob carga (outras tarefas na máquina) mostrou outlier de SP (statement 787 ms); re-medido ocioso: p95 163 ms. Não há SLA sob concorrência medido.
- Os campos `networkKB/jsKB` de `validacao_paginas.json` usam `content-length` e **não são confiáveis**; os números acima vêm de `curl`/gzip.
- Mobile: sem throttling de CPU/rede; "rápido no celular" não foi medido em dispositivo real.
