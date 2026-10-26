# Custo real de armazenamento · P10.3 (G15)

Medido por `scripts/exec/educacao-pilot.ts measure` antes e depois de cada edição (60 medições em `evidencias/storage_measures_p103.jsonl`). PostgreSQL de produção no disco C:, RAW e staging no SSD D:.

## 1. Antes × depois (produção)
| Recurso | Antes | Depois | Crescimento |
|---|---:|---:|---:|
| Banco `projetoeleitor_db` | 25,977 GB | 27,292 GB | **+1.315,1 MB** |
| Schema `civica_exec` | – | – | +1.314,4 MB |
| `exec_edu_infra_year` (3.597.617 linhas) | 0 | 562,6 MB | heap 457,4 + índice 105,0 |
| `exec_edu_ind_school` (3.512.097 linhas) | 0 | 470,5 MB | heap 367,1 + índice 103,2 |
| `exec_edu_ind_terr` (1.287.807 linhas) | 0 | 262,2 MB | heap 204,7 + índice 57,4 |
| `exec_edu_doc_terr` (106.333 linhas) | 0 | 13,3 MB | – |
| `exec_edu_infra_agg` (3.963 linhas) | 0 | 2,7 MB | – |
| `exec_edu_ind_cov` + `exec_edu_infra_cov` | 0 | 0,6 MB | – |
| Tabelas da P10.1 e P10.2 | – | – | **0** (fingerprints idênticos) |
| Change log | 16.161.837 linhas · 3,447 GB | idem | **+0 linhas, +0 bytes** (cargas iniciais por bootstrap) |
| WAL gerado (LSN) | – | 3,72 GB | infraestrutura ≈ 1,63 GB, indicadores ≈ 2,04 GB, docentes ≈ 0,04 GB |
| WAL em disco, pico (`pg_wal`) | – | 1.074 MB | no limite de `max_wal_size` (1 GB) |
| C: livre | – | **mínimo 51,78 GiB** | piso exigido: 20 GiB |
| D: livre | – | 429,4 GB | – |

## 2. RAW e staging novos (D:)
| Item | Tamanho | Observação |
|---|---:|---|
| 306 ZIPs de Indicadores Educacionais (7 famílias × escola/município/UF × 2007–2025) | **4,17 GB** | dos 494 arquivos do diretório do INEP (≈ 7 GB); **188 não foram baixados** (taxas de rendimento e de transição, distorção idade-série, INSE, remuneração, indicadores financeiros) |
| 19 TSVs de docentes derivados da Sinopse | 6,2 MB | no RAW, com o SHA-256 da planilha de origem |
| Planilhas da Sinopse (xlsx, 19 edições, só para extrair 2 tabelas) | transferidas e **apagadas** | copiadas por Range para staging; SHA-256 em `evidencias/sinopse/fetch_doc_AAAA.json` (a de 2025 tem 199 MB) |
| Staging de TSVs de extração (infraestrutura e indicadores) | ≈ 5,7 GB (staging total medido) | descartável; reconstruível do RAW |
| `Tabela_Escola` 2025 e ZIPs 2007–2024 do Censo | 0 | **reaproveitados** (hash validado), nada rebaixado |

## 3. Custo unitário
| Unidade | Valor |
|---|---:|
| Infraestrutura por escola × edição (tabela + índice) | **156 B** (heap 127 + índice 29) |
| Indicadores oficiais por escola × edição | **134 B** |
| Indicadores oficiais por território × recorte × edição | **204 B** |
| Docentes oficiais por território × edição | 125 B |

## 4. Previsto × real e meta de 5 GB
| Item | Conservador | Provável | Pessimista | Real |
|---|---:|---:|---:|---:|
| P10.3 (banco) | 0,5 GB | 1,0 GB | 1,8 GB | **1,32 GB** (1,31× o provável; abaixo do gatilho de 1,5×) |
| Acumulado P10.1 + P10.2 + P10.3 | 1,7 GB | 2,2 GB | 3,0 GB | **2,53 GB** (0,55 + 0,66 + 1,32) |

A **meta de 5 GB está cumprida com folga** (restam ≈ 2,5 GB). O custo ficou entre o provável e o pessimista porque os indicadores oficiais por escola foram publicados para as 19 edições (3,5 milhões de linhas) e o conjunto de infraestrutura tem 100 variáveis. Nenhuma fatia foi interrompida e nenhum histórico foi reduzido.

## 5. Gatilho de revisão
Mantido: se uma onda passar de 1,5× a previsão, parar de publicar novas fatias (as publicadas ficam), revisar colunas e índices e reestimar. A P10.3 ficou em 1,31×. Nenhuma retenção destrutiva do `exec_change_log` foi aplicada.

## 6. Projeção para o próximo passo
A P10.4 (Ideb, Saeb, rendimento) com o mesmo formato de tabela escola × edição custaria da ordem de 0,4 a 0,7 GB por família ampla de indicadores; o acumulado ficaria em cerca de 3,0 a 3,3 GB. É uma estimativa por analogia, a ser medida em piloto, como nas ondas anteriores.
