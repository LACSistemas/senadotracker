# Planejamento de recursos da Educação · G16

Estado: **PASS** (estimativas por evidência, três cenários, premissas explícitas) · Arquivos: `estimativa_armazenamento_educacao.csv` (linha a linha), `estimativa_armazenamento_resumo.json`, `reproducibilidade/estimativa_armazenamento.py` (o modelo; reexecutável).

## 1. Ambiente medido (2026-10-24)
| Item | Valor |
|---|---|
| PostgreSQL | 17.4, `max_wal_size 1 GB`, `wal_level replica`, `archive_mode off`, `shared_buffers 1 GB`, `work_mem 32 MB`, `maintenance_work_mem 64 MB`, `max_connections 100` |
| Diretório de dados | `C:\Program Files\PostgreSQL\17\data` (**disco C:**) |
| Banco `projetoeleitor_db` | 23 GB; `civica_exec` 15 GB+; `exec_change_log` 3,3 GB (15,1 mi linhas) |
| C: | 237 GB, **51,5 GB livres** |
| D: (volume "Dados", GUID `{54b8f375-…}`) | 466 GB, **422,7 GB livres**; RAW existente: siconfi 260 MB, pncp 948 MB, federal 1,1 GB, crime 1,1 GB…; backups 4,6 GB |
| Memória | 15,8 GB total, ~3,3 GB livres no momento da medição |
| Jobs | tarefa agendada `Civica-P95-PNCP-Finish` **desabilitada**; processos `node` do servidor web do usuário (porta 3000) e extensões do VS Code **não interrompidos**; nenhum coletor ativo |

**Restrição vinculante:** manter **≥ 20 GiB livres no C:** (e margem para WAL/temporários). Orçamento de crescimento do banco no C. = 51,5 − 20 = **31,5 GB**, incluindo WAL em pico e temporários.

## 2. Unidades medidas usadas no modelo
- `exec_ind_value`: 170 B/linha (heap + índices). `exec_fin_fact`: 102 B/linha. `exec_fin_contract`: 235 B/linha. `exec_change_log`: **218 B por linha logada**; razão log/dados observada ≈ 0,46 (assumida 0,25 / 0,5 / 1,0).
- Escolas: 215 mil por edição (Censo 2021–2025: 214–225 mil). Entes: 5.598.
- ZIPs e arquivos: medidos por HEAD (Censo Escolar 2007–2025 = 1.009 MB; 1995–2006 = 521 MB; INEP Indicadores 494 arquivos = 7.032 MB; Censo Superior 30 ZIPs = 750 MB; Portal Transferências 153 meses = 514 MB; Ideb 2025 ≈ 270 MB; Saeb 2025 = 24 MB; Sinopse 2025 = 232 MB).

## 3. Resultado (totais; detalhe por onda no CSV)
| Cenário | Banco (tabelas + índices) + change log | RAW novo (D:) | WAL em pico (C:) | Backups (D:) |
|---|---:|---:|---:|---:|
| **Conservador** (últimas 9 edições do Censo, indicadores mínimos) | **5,7 GB** | 2,4 GB | ~2 GB | ~5 GB |
| **Provável** (Censo 2007–2025, Ideb completo, INEP Indicadores 2019+, SIOPE sem Receita) | **16,8 GB** | 7,9 GB | ~2,5 GB | ~8 GB |
| **Pessimista** (1995–2025, todas as edições de 9 indicadores por escola, SIOPE com Receita) | **65,8 GB** | 17,8 GB | ~10 GB | ~20 GB |
- **Provável cabe no C.:** 51,5 − 16,8 − 2,5 (WAL) = 32,2 GB livres ≥ 20 GB. **Pessimista não cabe** (65,8 > 51,5): exige não publicar indicadores por escola de todas as edições, ou liberar espaço (por exemplo, aplicar a retenção do change log — **não aplicada nesta fase** — ou mover o tablespace).
- Por onda (provável, banco + log): P10.1 1,2 GB · P10.2 2,0 GB · P10.3 2,3 GB · **P10.4 5,8 GB (a maior)** · P10.5 2,0 GB · P10.6 1,7 GB · P10.7 0,2 GB · P10.8 1,5 GB.
- O **change log** é ≈ 40–50% do crescimento: a P10.4 (indicadores por escola) é a decisão de custo; o modelo estreito de indicadores por escola é caro (18 mi de linhas no provável, 80 mi no pessimista).

## 4. Reuso (o que **não** entra nas estimativas)
- **Siconfi:** 0 GB novos (RAW de 260 MB já cobre função 12, 2014–2025).
- **PNCP:** 0 GB de download nacional; só incremental (~0,4 GB/ano de RAW). Banco: +145 MB (613 mil contratos) no provável.
- **Federal (despesa/dotação):** reuso do RAW (1,1 GB) e das tabelas existentes.
- População e território: tabelas existentes.

## 5. Staging, memória e operação
- Leitura **em fluxo** (sem descompactar para disco): provado nesta fase para ZIPs de 26–143 MB com 4 MB de buffer; pico de memória da leitura é o da linha CSV; staging TSV compacto ≈ 14 MB/edição. Staging temporário previsto ≤ 1,2 GB.
- Cargas em lotes por (ano, UF) para manter WAL por transação baixo (`max_wal_size` 1 GB). `maintenance_work_mem` 64 MB atende a criação de índices das tabelas novas (4 milhões de linhas) mas torna `CREATE INDEX` mais lento: **ajuste temporário durante a migration**, não mudança permanente.
- **Restauração isolada:** cada onda faz `pg_dump -Fc` (0,4–1,0 GB) em D: e restaura num cluster de teste em `D:\Civica\pgtest_*` (≈ 2× o tamanho do dump), como na P9.

## 6. Riscos
1. **Espaço do C.** (pessimista inviável): decisão de escopo da P10.4/P10.3 antes de coletar.
2. `exec_change_log` sem retenção (3,3 GB hoje): a retenção é decisão do dono, fora desta fase.
3. Rede: Portal da Transparência bloqueou com HTTP 405 depois de ~170 requisições rápidas; INEP derruba conexões (retry com espera).
4. Memória livre baixa (3,3 GB) com servidor web e IDE abertos: não rodar ETL pesado e testes de integração ao mesmo tempo.

## 7. Orçamento por onda (provável) — passos de verificação de espaço
Antes de cada onda: `freeBytes(C:)` ≥ estimativa + 20 GiB; `freeBytes(D:)` ≥ RAW + 2× dump; `assertPgHeadroom` (já existe em `storage.ts`) e `assertCanStore`. Depois da onda: medir o tamanho real das tabelas novas e comparar com o CSV (calibração).
