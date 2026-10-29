# Publicação P12.4-R

Dataset `121`, competência `202412`, período `2024-01-01`–`2025-01-01`, estado definitivo (`status=2`), schema `civica_exec`.

## Indicadores

| ID | Código | Linhas municipais | Observação |
|---:|---|---:|---|
| 9101 | `WB-SUAS-CRAS` | 5.333 (+ Brasil/UF) | contagem de CRAS |
| 9102 | `WB-SUAS-CRAS-CAP-2500` | 5.333 (+ Brasil/UF) | faixa q1 |
| 9103 | `WB-SUAS-CRAS-CAP-3500` | 5.333 (+ Brasil/UF) | faixa q1 |
| 9104 | `WB-SUAS-CRAS-CAP-5000` | 5.333 (+ Brasil/UF) | faixa q1 |
| 9105 | `WB-SUAS-IDCRAS-MEAN` | 5.570 | valor oficial municipal |
| 9106 | `WB-SUAS-IDCRAS-RESPONDENTS` | 5.333 | respondentes |
| 9201 | `WB-SUAS-CREAS` | 2.609 | unidades por sede |
| 9202 | `WB-SUAS-IDCREAS-MEAN` | 2.609 | valor oficial municipal |
| 9203 | `WB-SUAS-IDCREAS-RESPONDENTS` | 2.609 | respondentes |
| 9301 | `WB-SUAS-IDCONSELHO-MEAN` | 4.976 | scores não nulos |

Foram ativadas 28 publicações (Brasil + 27 UFs). O Product A está pronto para consumo de read layer; a ausência de valor em uma fonte permanece `NULL`/sem linha, nunca `0` sintético.

## Produto B

Os identificadores de CRAS/CREAS foram validados e estão no RAW/proveniência, mas não há tabela canônica de equipamentos nesta fase. Situação ativa, tipo, sede histórica e relações regionais não foram inferidos.
