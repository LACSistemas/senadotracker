# Carga e concorrência

Carga executada exclusivamente no cluster isolado restaurado (`localhost:55439`), com cache aquecido, 20 rodadas em cada nível e cenários mistos (Brasil, UF, municípios, escola/lista, comparação e seção financeira).

| Concorrência | Requests | req/s | p50 | p95 | p99 | Erros |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 20 | 76,84 | 0,83 ms | 88,82 ms | 130,65 ms | 0 |
| 5 | 100 | 517,06 | 1,11 ms | 6,02 ms | 31,01 ms | 0 |
| 10 | 200 | 879,66 | 1,98 ms | 5,64 ms | 38,60 ms | 0 |
| 25 | 500 | 1.656,14 | 4,20 ms | 7,58 ms | 94,54 ms | 0 |
| 50 | 1.000 | 2.059,76 | 7,11 ms | 13,23 ms | 146,69 ms | 0 |

Capacidade sustentável medida: 50 sessões concorrentes no host isolado, sem erro. Isso não é uma promessa de tráfego de internet: CPU, rede e pool de produção devem ser medidos no ambiente de deploy.
