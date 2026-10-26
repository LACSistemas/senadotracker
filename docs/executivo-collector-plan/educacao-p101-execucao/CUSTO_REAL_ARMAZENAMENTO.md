# Custo real de armazenamento · P10.1 (G9)

Medido por `scripts/exec/educacao-pilot.ts measure` (antes e depois de **cada edição**; log completo em `evidencias/storage_measures.jsonl`). PostgreSQL de produção no disco C:, RAW e staging no SSD D:.

## 1. Antes × depois

| Recurso | Antes | Depois | Crescimento |
|---|---:|---:|---:|
| Banco `projetoeleitor_db` | 24,764 GB | 25,318 GB | **+554,1 MB** |
| Schema `civica_exec` | 8,556 GB | 9,110 GB | +554,0 MB |
| Tabelas Educação (heap) | 0 | 364,1 MB | +364,1 MB |
| Índices Educação | 0 | 189,2 MB | +189,2 MB |
| Total Educação (tabelas + índices) | 0 | 553,5 MB | +553,5 MB |
| Change log | 16.161.837 linhas · 3,447 GB | idem | **+0 linhas, +0 bytes** |
| WAL gerado (LSN) | – | 1,62 GB em 19 edições | média 85 MB/edição (71–148 MB) |
| WAL em disco, pico (`pg_wal`) | 688 MB | 856 MB | pico +168 MB (limite `max_wal_size` 1 GB) |
| C: livre | 50,68 GiB | 49,55 GiB | −1,13 GiB; **mínimo observado 48,05 GiB** (piso: 20 GiB) |
| D: RAW `inep/` | 0 | 736 MB (703 MiB) | +736 MB |
| D: staging `educacao/` | 0 | 568 MB | +568 MB (TSV por edição; descartável) |

Detalhe das tabelas: `exec_edu_school_year` 4.272.656 linhas = 533,2 MB (heap 353,2 + índices 179,9); `exec_edu_school` 299.547 linhas = 20,2 MB; `exec_edu_cov` 513 linhas = 0,1 MB. A queda de C: (−1,13 GiB) é maior que os 554 MB de banco por causa de WAL retido/arquivos temporários e do uso normal do disco no período; o piso nunca foi ameaçado.

## 2. Custo unitário

| Unidade | Valor |
|---|---:|
| Por snapshot (escola × edição), tabela + índices | **124,8 B** (heap 82,7 + índices 42,1) |
| Por escola distinta (identidade) | 67,4 B |
| Por edição (média, tabelas) | 29,1 MB (22,6 a 39,1 MB; 2025 = 38,3 MB por ter mais colunas de nome longo e `flags`) |
| Por ano de cadastro, para uma escola | ≈ 125 B |
| Por evento de mudança registrado | **0** (as mudanças não são tabela: são a diferença entre snapshots) |
| WAL por edição | 71–148 MB (≈ 2,9× os dados; média 85 MB) |
| RAW por edição | 21–34 MB (ZIP 2007–2024); 265 MB (2025, só 2 de 6 tabelas) |

## 3. Previsto × real

| Item | Previsão P10 (provável) | Real |
|---|---:|---:|
| P10.1 banco + log | 1,2 GB | **0,55 GB** (−54%) |
| RAW Censo 2007–2025 | 1,01 GB | 0,74 GB |
| Change log | ≈ 0,5 × dados | 0 (cargas iniciais sem log) |

A diferença vem de três decisões: sem tabela de histórico de nomes, sem indicadores derivados e sem change log na carga inicial (ver `MODELO_IDENTIDADE_ESCOLAR.md`).

## 4. Projeções para as próximas ondas (premissas explícitas, custos marginais reais)

Premissa: a linha por escola × edição de P10.2/P10.3 é larga em colunas inteiras (smallint/integer) e mais cara que o cadastro: **estimativa de 120–200 B por (escola, edição)** (P10 usou 160 B para oferta e 120 B para infraestrutura), contra 125 B medidos aqui para 8 colunas. Sem change log na carga inicial.

| Cenário | Premissa | P10.2 (oferta) | P10.3 (infra/docentes) | Total P10.1–P10.3 |
|---|---|---:|---:|---:|
| Conservador | 120 B, 2017–2025 (≈ 2,0 mi snapshots) + 0,3 GB de indicadores territoriais | 0,5 GB | 0,5 GB | **≈ 1,6 GB** |
| Provável | 160 B, 2007–2025 (4,27 mi) + 0,6 GB de indicadores territoriais | 1,3 GB | 1,2 GB | **≈ 3,1 GB** |
| Pessimista | 200 B, 2007–2025 + 1,5 GB de indicadores e log em 30% das linhas | 2,3 GB | 2,0 GB | **≈ 6,3 GB** |

Conclusão: o provável (3,1 GB) fica **abaixo da meta de engenharia de 5 GB** para P10.1–P10.3; o pessimista a ultrapassa em 1,3 GB, mas continua longe do piso de disco (C: livre 49,5 GiB; piso 20 GiB). WAL de pico por onda ≈ 1 GB (limitado por `max_wal_size`), RAW de P10.3 (INEP Indicadores 2019+) ≈ 3,4 GB em D:.

## 5. Orçamento progressivo

Continua viável: o cadastro custou 0,55 GB dos 5 GB da meta (11%). Condição para P10.2–P10.3: manter carga inicial sem log e não duplicar atributos do cadastro. Gatilho de reestimativa: se uma onda passar de 1,5× a sua previsão, parar de publicar novas fatias (as publicadas ficam) e revisar índices e colunas antes de continuar.
