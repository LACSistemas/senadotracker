# Custo real de armazenamento (P10.4) · G5 e G12

Estado: **G12 PASS**. O banco `projetoeleitor_db` cresceu **1.372.004.352 bytes (1,372 GB = 1,28 GiB)** com a P10.4 inteira publicada, medido contra o baseline tirado imediatamente antes (27.292.101.779 B às 17:42:59 de 25/10/2026, `evidencias/baseline_pg_database_size.txt`) e conferido de novo antes da primeira escrita em produção. Limite: 5 GB. Uso: **27,4%** do limite; folga de 3,63 GB. Alvo de planejamento (≤ 4 GB estimados): cumprido. Estimativa do piloto (1,3 a 1,6 GB): acertou.

## 1. Medidas (produção, `educacao-pilot measure`, `<logs>/educacao-measure.jsonl`)

| Etapa | `pg_database_size` | Crescimento acumulado | LSN do WAL acumulado | C: livre |
|---|---|---|---|---|
| Baseline (antes de qualquer escrita) | 27.292.101.779 | 0 | 0 | 51,6 GiB |
| Migration v13 (13 tabelas vazias) | 27.292.724.371 | 0,001 GB | 0 | 51,6 GiB |
| Registro de 174 arquivos no manifesto | 27.292.781.715 | 0,001 GB | 0 | 51,6 GiB |
| Ideb (11 edições) | 27.538.517.139 | 0,246 GB | 0,50 GB | 51,4 GiB |
| Saeb (5 edições) | 27.786.079.379 | 0,494 GB | 1,01 GB | 51,1 GiB |
| INSE (3 edições) | 27.841.514.643 | 0,549 GB | 1,15 GB | 51,1 GiB |
| Transição (15 edições) | 27.928.276.115 | 0,636 GB | 1,30 GB | 51,0 GiB |
| Rendimento + distorção (20 edições) | 28.665.408.659 | 1,373 GB | 2,95 GB | 50,3 GiB |
| **Final, depois do replay (`NO_CHANGE` em tudo)** | **28.664.106.131** | **1,372 GB** | **2,95 GB** | **50,2 GiB** |

O replay completo (1.511 fatias) não somou nenhum byte: o crescimento final é 1,3 MB **menor** que o da última publicação.

## 2. Por tabela (heap + índices; TOAST não existe: nenhuma coluna é texto ou JSON)

| Tabela | Linhas | Células | Heap | Índices | Total | Bytes por linha |
|---|---|---|---|---|---|---|
| `exec_edu_flow_school` | 2.678.764 | 87.568.222 | 338.239.488 | 99.188.736 | 437.428.224 | 163 |
| `exec_edu_flow_terr` | 1.258.400 | 63.633.732 | 204.587.008 | 94.912.512 | 299.499.520 | 238 |
| `exec_edu_saeb_terr` | 1.820.574 | 18.153.674 | 148.119.552 | 100.614.144 | 248.733.696 | 137 |
| `exec_edu_ideb_school` | 1.045.501 | 9.430.870 | 129.392.640 | 41.107.456 | 170.500.096 | 163 |
| `exec_edu_trn_terr` | 360.304 | 21.253.272 | 59.760.640 | 24.985.600 | 84.746.240 | 235 |
| `exec_edu_ideb_terr` | 359.746 | 3.615.739 | 47.513.600 | 25.993.216 | 73.506.816 | 204 |
| `exec_edu_inse_terr` | 229.392 | 1.997.972 | 15.769.600 | 17.481.728 | 33.251.328 | 145 |
| `exec_edu_inse_school` | 208.444 | 1.998.852 | 14.614.528 | 7.880.704 | 22.495.232 | 108 |
| 5 tabelas de cobertura | 3.319 | | | | 532.480 | |
| **Total das 13 tabelas** (linhas das 8 tabelas de dados) | **7.961.125** | **207.652.333** | | | **1.370.693.632** | |

O que sobra do crescimento (1.310.720 B, 0,1%) é metadado: 1.511 execuções (`exec_ingestion_run`), 1.511 publicações (`exec_publication`) e 174 linhas do manifesto de RAW. O **change log não cresceu** (16.161.837 linhas e 3.447.406.592 B antes e depois): as cargas iniciais não gravam log e o replay não altera nada.

Porque ficou barato: percentuais em `smallint` ×100 (2 bytes por célula, NULL não ocupa espaço), nenhuma coluna de texto nem JSONB, uma só linha por escola × edição reunindo rendimento e distorção (71 colunas em 163 bytes), chave primária composta curta e um único índice secundário por tabela. Nenhum dado foi descartado e nenhuma casa decimal foi perdida (`lossy = 0`).

## 3. Planejamento × real

O piloto no cluster de teste, antes do backfill, projetou **1,3 a 1,6 GB** para a P10.4 inteira; o real foi **1,372 GB**. Por família (crescimento medido etapa a etapa em produção): Ideb 0,246 GB, Saeb 0,248 GB, INSE 0,055 GB, transição 0,087 GB e rendimento + distorção 0,737 GB. A reavaliação a cada família não encontrou nenhum ponto de parada (o script para sozinho acima de 4,5 GB).

## 4. WAL, disco e RAW

- **WAL medido à parte.** O LSN avançou 2,95 GB durante as publicações (cada UF × edição é uma transação); o diretório `pg_wal` ficou em 1,07 GB (64 arquivos, teto do `max_wal_size`), ou seja, o WAL é reciclado e **não conta** no limite. O disco C: caiu de 51,6 para 50,2 GiB livres (a diferença é o crescimento do banco); o piso de 20 GiB nunca foi ameaçado e o script de produção para sozinho abaixo dele e acima de 4,5 GB de crescimento.
- **RAW em D: (sem teto).** 174 arquivos novos (2,97 GB): Ideb 0,27 GB, Saeb 0,09 GB, rendimento 1,60 GB, distorção 0,69 GB, transição 0,27 GB, INSE 0,05 GB, todos com SHA-256 no manifesto. Staging derivado (TSVs com cache por hash e versão do parser): 2,2 GB. O cluster de teste (`D:\Civica\pgtest_edu4`, 14,6 GB) foi apagado no fim.

## 5. Risco que o custo real revelou: o change log

O change log guarda a **linha antiga inteira** de cada UPDATE. Nos ensaios de correção no cluster de teste (não em produção), 1.499.208 UPDATEs de `exec_edu_flow_school` custaram **1.955 MB de change log, 1,3 KB por linha**. Projeção: uma retificação que mude **todas** as 2,68 milhões de linhas do rendimento por escola custaria ~3,5 GB e levaria o total da P10.4 para ~4,9 GB, no limite.

Regras daí decorrentes (valem para a P10.5 e para manutenção):

1. Validar extrator e parser em banco de teste antes de publicar em produção (foi o que esta fase fez; a produção só viu cargas iniciais).
2. Retificar por fatia (edição × UF), nunca a tabela inteira de uma vez, e medir o change log antes e depois.
3. Não apagar o change log para "ganhar espaço" (proibido pela fase). Se for necessário, registrar a decisão e trocar a representação (guardar só as colunas alteradas) numa migration própria.

## 6. Projeção das próximas edições

Em média, por edição: rendimento por escola ~23 MB, rendimento territorial ~15 MB, Ideb (bienal) ~22 MB, Saeb (bienal) ~50 MB, transição ~6 MB, INSE (bienal) ~19 MB. Um ano sem Ideb, Saeb e INSE custa ~0,04 GB (rendimento, distorção e transição) e um ano com todas as famílias ~0,14 GB.
