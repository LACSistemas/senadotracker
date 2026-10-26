# Custo real de armazenamento · P10.2 (G8)

Medido por `scripts/exec/educacao-pilot.ts measure` antes e depois de **cada edição** (log completo em `evidencias/storage_measures.jsonl`). PostgreSQL de produção no disco C:, RAW e staging no SSD D:.

## 1. Antes × depois (produção)
| Recurso | Antes | Depois | Crescimento |
|---|---:|---:|---:|
| Banco `projetoeleitor_db` | 25,318 GB | 25,977 GB | **+658,4 MB** |
| Schema `civica_exec` | – | – | +658,2 MB |
| `exec_edu_offer_year` (3.547.666 linhas) | 0 | 656,1 MB | heap 552,3 MB + índice 103,6 MB |
| `exec_edu_offer_agg` (3.962 linhas) | 0 | 1,3 MB | – |
| `exec_edu_offer_cov` (513 linhas) | 0 | 0,1 MB | – |
| Tabelas da P10.1 (cadastro) | 553,5 MB | idem | **0** (hashes idênticos) |
| Change log | 16.161.837 linhas · 3,447 GB | idem | **+0 linhas, +0 bytes** |
| WAL gerado (LSN), 19 edições | – | 1,60 GB | 77–118 MB por edição (média 84) |
| WAL em disco, pico (`pg_wal`) | – | 1,06 GB | no limite de `max_wal_size` (1 GB) mais o segmento corrente |
| C: livre | 54,16 GiB | 53,35 GiB | **mínimo observado 53,35 GiB** (piso: 20 GiB) |
| D: RAW `inep/` (fim da P10.1 → fim da P10.2) | 736 MB | 838 MB | +102 MB (`Tabela_Turma` 2025 = 99,9 MB; documentos jurídicos = 2,4 MB) |
| D: staging `educacao/` (fim da P10.1 → fim da P10.2) | 568 MB | 959 MB | +391 MB de TSVs por edição de oferta (descartáveis; reconstruíveis do RAW) |

## 2. Custo unitário
| Unidade | Valor |
|---|---:|
| Por linha de oferta (escola × edição do universo), tabela + índice | **184,9 B** (heap 155,7 + índice 29,2) |
| Por linha do cadastro da P10.1 (4.272.656), amortizada | 154 B |
| Por edição (média) | 34,6 MB (30,4 a 45,9 MB) |
| WAL por edição | 77–118 MB (≈ 2,4× os dados) |
| Por evento de mudança registrado | 0 (carga inicial sem log) |
| RAW por edição | ZIP de 21–34 MB (2007–2024) ou 3 tabelas de 99–141 MB (2025) |

## 3. Previsto × real
| Item | Previsão P10 (provável) | Projeção revisada (P10.1) | Real |
|---|---:|---:|---:|
| P10.2 banco + log | 1,3 GB | 1,3 GB | **0,66 GB** (−49%) |
| Banco acumulado P10.1 + P10.2 | – | – | **1,21 GB** (0,55 + 0,66) |

A economia vem de: 30 colunas inteiras em vez de linhas estreitas por medida (a estimativa da P10 supunha 30 indicadores × 5.598 entes × 19 anos em `exec_ind_value` com change log), cadastro não duplicado, carga inicial sem log e `NULL` em vez de zero.

## 4. Projeção para P10.3 e meta acumulada (premissas explícitas)
Premissa: a P10.3 usa o mesmo formato (tabela larga por escola × edição) com 25–30 colunas pequenas (smallint) para infraestrutura e ~15 inteiros para docentes; custo medido da oferta como régua (185 B para 30 inteiros de 4 bytes + chave).

| Cenário | Premissa | P10.3 (infra + docentes + indicadores territoriais) | Acumulado P10.1–P10.3 |
|---|---|---:|---:|
| Conservador | só 2017–2025 (≈ 1,6 mi linhas) e 20 colunas | 0,5 GB | **1,7 GB** |
| Provável | 2007–2025 no universo (3,5 mi linhas), 28 colunas de infra + 15 de docentes | 1,0 GB | **2,2 GB** |
| Pessimista | 2007–2025 em todo o cadastro (4,3 mi linhas), 200 B por linha + 1 GB de indicadores e log em 30% | 1,8 GB | **3,0 GB** |

A **meta de 5 GB para P10.1–P10.3 continua viável com folga** (mesmo o pessimista deixa 2 GB). WAL de pico por onda ≈ 1 GB (limitado por `max_wal_size`); RAW de P10.3 (Indicadores Educacionais 2019+) ≈ 3,4 GB em D:.

## 5. Gatilho de revisão
Nenhuma onda passou de 1,5× a previsão (a P10.2 ficou em 0,5×). Gatilho mantido: se uma onda passar de 1,5× a previsão, parar de publicar novas fatias (as publicadas ficam), revisar colunas e índices e reestimar antes de continuar. Nenhuma retenção destrutiva do `exec_change_log` foi aplicada.
