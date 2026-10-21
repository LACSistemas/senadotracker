# Cívica — Saúde Fase 1: expansão nacional (P1) — relatório de execução

Execução de 2026-10-20 (17:30) a 2026-10-21 (10:30), horário local. Sem commit nem push. Artefatos desta pasta: `cobertura_nacional.csv`, `manifesto_armazenamento.csv`, `desempenho_backfill.csv`, `reconciliacao_nacional.md`, `pendencias_fontes.md`, `results.json`, `screens/`.

## 1. Gates

| Gate | Resultado | Evidência resumida |
|---|---|---|
| S0 SSD verificado | **PASS** | `D:` = volume "Dados", NTFS, USB, 500.106.784.768 B, saudável, vazio (só pastas do sistema); GUID `54b8f375-0000-0000-0000-100000000000`, disco serial `WXD1A64H70F2`. Escrita/leitura/SHA-256 de arquivo de teste conferidos e o arquivo removido. |
| S1 Configuração de armazenamento | **PASS** | Raiz `D:\Civica` (raw, staging, manifests, quarantine, logs, reports) configurada por `CIVICA_EXEC_ROOT`; identidade do volume por GUID em `CIVICA_EXEC_VOLUME_ID`, conferida (via `mountvol`) e com marcador `.civica-volume.json` antes de cada gravação. Letra trocada ou SSD ausente → `VolumeError`, nada gravado, nenhum RAW substituto no `C:`. Reservas: SSD ≥ 50 GiB, PostgreSQL ≥ 20 GiB. PGDATA/WAL permanecem no disco interno. |
| S2 Migração do RAW | **PASS** | 634 arquivos (654 MiB) copiados com `robocopy`, 0 divergências de SHA-256 contra a origem e contra o manifesto; caminhos relativos (nenhuma referência absoluta no manifesto nem no banco, nada a migrar); retomada de run publicado leu o novo local sem baixar nada (`NO_CHANGE`). A origem `data/exec-raw` foi mantida como cópia de segurança (não apagada). |
| S3 Segurança do PostgreSQL | **PASS** | Logs do dia sem corrupção/`invalid page`/`PANIC`; 41 checkpoints solicitados contra 16.755 por tempo; novo `pg_dump` (2,18 GiB, SHA-256) em `D:\Civica\backups` + restauração do schema `civica_exec` em cluster isolado (5.631 entidades, 635 publicações e 633 arquivos no manifesto, o estado do momento do backup); índice do dump completo lido sem erro; nenhum parâmetro do PostgreSQL alterado. |
| N1–N3 CNES ST/LT/EQ | **PASS** | 27 UFs × 165 competências (201301–202609), 4.455 fatias por tipo; 202609 igual ao P8 (501.726 estab.; 543.524 / 362.715 / 180.809 leitos). |
| N4 CNES PF | **PASS** | 378 fatias (dezembro 2013–2025 + 202609 × 27 UFs). |
| N5 PNI | **PASS** | Um download nacional; 27 UFs, 5.571 municípios, 34 vacinas, 2015–2026. |
| N6 SIH hospital | **PASS** | 4.401 fatias (163 competências × 27 UFs). |
| N7 SIH residência | **PASS** | 163 competências; soma hospital = soma residência em todos os meses. |
| N8 SIM/SINASC | **PASS_WITH_CAVEATS** | 351 + 351 fatias (2013–2025); 2025 preliminar; série completada (o G0–G9 só tinha o ES inteiro; ver erratum). |
| N9 APS | **NEEDS_VALIDATION** | API funciona com os parâmetros certos; piloto ES reconciliado; 84 % das linhas > 100 % (cobertura potencial); metodologia pendente; nada publicado. |
| N10 Siconfi | **PARTIAL** | Piloto de 5 chamadas, Vitória reconciliada (R$ 503,0 mi); Anexo 12 (ASPS) vazio; nada publicado. |
| N11 Integridade de publicação | **PASS** | 19.061 publicações ativas, 0 runs com falha; integridade de intervalos em cada publicação; hospital = residência; RAW sem divergências. |
| N12 Reconciliação de indicadores | **PASS** | Ver `reconciliacao_nacional.md`. |
| N13 Regressão do frontend | **PASS** | `next build` ok; 10 páginas × desktop e mobile com HTTP 200 e sem rolagem horizontal (`screens/`); rotas legislativas e `/quem-me-representa` respondem 200. |
| N14 Testes PostgreSQL | **PASS** | 23/23 (motor de publicação, intervalos, armazenamento) rodados de fato em cluster PostgreSQL isolado (não pulados). `npm test`: 333 testes, 290 passam, 0 falham, 43 pulados (os de banco, executados à parte). Typecheck limpo. |
| N15 Orçamento de armazenamento | **PASS** | Ver §4. |
| N16 Relatório final | **PASS** | Este documento. |
| DEMAS | **PARTIAL** | Hospitais e UBS enriquecidos; demais tipos não, por privacidade. |

## 2. Cobertura nacional efetiva

| Família | Previsto | Publicado | Observação |
|---|---|---|---|
| CNES ST/LT/EQ | 27 UFs × 165 | 27 × 165, 3 tipos | até 202609 (última competência da fonte) |
| CNES PF | 27 × 14 | 27 × 14 | calendário aprovado |
| SIM / SINASC | 27 × 13 | 27 × 13 | 2025 preliminar |
| SIH por hospital | 27 × 163 | 27 × 163 | até 202607; 202608 sem AC/RR na fonte |
| SIH por residência | 163 | 163 | 5.570 municípios com internação |
| PNI | 27 UFs | 27 UFs | 5.571 municípios, anos 2015–2026 |
| População | 27 UFs | com lacunas oficiais | 2007, 2010, 2022, 2023 sem denominador |
| APS | — | piloto ES, não publicado | metodologia |
| Siconfi | — | piloto, não publicado | metodologia/ASPS |

`cobertura_nacional.csv` traz uma linha por dataset × UF × competência (13.9 mil linhas) com status, registros, hash da fonte, run, indicação de RAW e parser.

## 3. Coletores e melhorias (sem arquitetura paralela)

Reaproveitados: `fetchRaw` (curl, `.part`, SHA-256, manifesto), `publishSlice`, locks, `exec_change_log`, intervalos. Alterações:

- `storage.ts`: raiz configurável, GUID de volume (`assertVolume`), reserva do PostgreSQL (`assertPgHeadroom`), cache do uso de disco (a varredura por download era quadrática), `registerLocalRaw`, `dedupeByHash`.
- `cnes.ts`: `resolveMunicipality` (DF → Brasília) — corrigiu a falha do DF (48 % sem território).
- `epi.ts`: PNI nacional com um download; `collectSihResidents` com publicação por hospital na mesma decodificação (`sih-month`), `sih-resid-v3`, tratamento de códigos fora do catálogo, correção de um bug em que a publicação por hospital não rodava (efeito de `o.log?.(await …)`).
- `demas.ts` e `scripts/exec/demas-enrich.ts`; `scripts/exec/aps-pilot.ts`, `siconfi-pilot.ts`, `cnes-pf.ts`, `run-queue.ts` (fila com workers, retentativa e parada em `VolumeError`/`BudgetError`), `reset-pilot-cnes.ts`, `raw-verify.ts`, `coverage-report.ts`, `perf-report.ts`, `screens.mjs`.
- `publication.ts`: `ON CONFLICT` de run reaberto agora grava `parser_version` e `bootstrap`.
- Frontend: apenas textos de cobertura (`/estados` e bloco de Saúde) e chave única nas migalhas; tabela de hospitais limitada a 40 linhas com aviso.

## 4. Armazenamento, tempo e erros

| Item | Valor |
|---|---|
| PostgreSQL antes (G0–G9) / agora | 15,13 GiB / 19,53 GiB (+4,40 GiB); `civica_exec` 4,56 GiB |
| RAW no SSD | 18.861 arquivos, 21,82 GiB (23,43 GB); SSD com 442 GB livres |
| Backup | 2,18 GiB (`pre-nacional-p1-20261020.dump`) no SSD |
| Disco interno livre | 45 GB (reserva configurada 20 GiB) |
| Duração | ≈ 17 h de relógio (CNES nacional ≈ 7 h com 2–3 filas em paralelo; SIH ≈ 9 h incluindo o reprocessamento v3; PNI 16 min; DEMAS 22 min) |
| Falhas | 18 falhas transitórias de fila, 15 retentativas automáticas; 0 runs com falha ao final |
| Memória/CPU | máquina de 16 GB e 4 núcleos; até 5 processos Python simultâneos, sem estouro |

Causas das falhas: (a) DF com códigos 53xxxx e SIH 2013–2017 com os mesmos códigos (corrigido); (b) timeouts de bloqueio e quedas transitórias entre filas concorrentes — resolvidas pela retomada, pois cada publicação é atômica e o piloto continua da última competência publicada.

## 5. Erratos e riscos

1. **SIM/SINASC:** G0–G9 e o prompt P1 indicavam "27 UFs 2013–2025", mas só o ES tinha a série completa. Corrigido.
2. DF: códigos de região administrativa; ver `pendencias_fontes.md`.
3. SP/MG: o histórico não pôde ser anteposto; piloto desfeito e recarregado (documentado em `reconciliacao_nacional.md`).
4. O diretório de trabalho contém alterações em arquivos legislativos (components/lib/db) que **não** foram feitas por esta execução; os arquivos alterados por ela estão listados em §3.
5. A página `/estados/MG` envia ~1,2 MB de HTML (853 polígonos); candidato a simplificação de geometria.
6. Os servidores `next start` antigos na máquina servem um build anterior: reiniciar para ver a versão atual.

## 6. Próximo trabalho necessário

- Decisão metodológica da APS (cobertura potencial > 100 %) e publicação nas 27 UFs (poucas dezenas de chamadas).
- Siconfi: dicionário de contas, decisão sobre ASPS (Anexo 12 vazio nesta API) e orçamento de requisições antes do backfill.
- DEMAS completo apenas após decisão sobre nomes de pessoas físicas.
- Atualização periódica: reexecutar `cnes-pilot.ts` (competência nova), `epi-pilot.ts sih-month`, `epi-pilot.ts pni ALL` e `vital` para o novo ano; `coverage-report.ts` mostra lacunas.
- SIH 202608 quando AC e RR publicarem seus arquivos.
- Quando houver rotina periódica, mover `data/exec-raw` (cópia antiga de 654 MiB) para o lixo somente com a confirmação do responsável.

## 7. Adendo — Painel de Saúde (7 cards + 3 análises) com benchmark

Implementado em `/estados/[uf]/saude`, `/municipios/[ibge]/saude` (painel completo) e nas visões gerais (linha de 7 cards): `components/territory/health-panel.tsx`, `lib/health-bench.ts`, `lib/health-targets.ts` (metas do PNI: BCG 90 %, demais 95 %, versionadas), leitura em `packages/db/src/exec/read.ts` (`getPanelValues`, `getVaccinePanel`, `readHealthBenchmarks`).
- Benchmark = posição em faixa (quintil) + mediana do grupo e do Brasil, nunca ranking "Nº de N"; inelegível (pequeno número, sem denominador, período diferente, menos de 10 comparáveis) mostra "Sem comparação" com o motivo.
- Performance: distribuições (percentis) calculadas uma vez e guardadas em `exec_story` (reconstrução 0,37 s; leitura 24 ms); cada página faz poucas consultas em paralelo e nenhuma por card.
- Conferido contra o banco (Vitória): 6,48 e 3,99 leitos/1.000, 10,6 ‰, 59,9 %, 1.410 estabelecimentos e a tabela de leitos (750/526, 757/454, 458/231, 103/67, 95/65, 67/31) iguais ao desenho proposto.
- Testes: `tests/unit/health-bench.test.ts` (5) no `npm test`.

## 8. Adendo — Evolução, moradores e hospitais (substitui "Como evoluiu", tabela de hospitais e lista de internações)

- **Evolução** (`evolution-panel.tsx`, 4 abas: leitos, mortalidade infantil, ICSAP, cesáreas): território + mediana do estado (ou das UFs) + mediana do Brasil + faixa p25–p75, frase de leitura e chips; município usa média móvel de 3 anos nos indicadores instáveis; lacunas e anos sem população são mostrados, nunca preenchidos.
- **Como os moradores usam o hospital** (`residents-panel.tsx`): 4 números de 12 meses, barra "onde são internados" e calendário de calor ano × mês (índice sobre o mês típico de 2013–2019; fallback anual para município pequeno).
- **Quem atende** (`hospitals-panel.tsx`): ranking visual dos 8 maiores estabelecimentos por internações em 12 meses, leitos, permanência, óbitos/internação e selo de polo regional.
- **Performance:** comparativos por ano pré-calculados em `exec_story` (`bench_series_saude`; reconstrução ≈ 11 s, leitura ≈ 60 ms); 4 leituras fixas por página; `/saude` caiu de ≈ 2,6 s e 570 KB para ≈ 0,9 s e 280 KB.
- **Correção de dados descoberta no caminho:** a população anual (SIDRA 6579) só havia sido carregada para o ES (2001–2025) e para todo o país apenas em 2026; por isso leitos por 1.000 hab. e taxas de internação de 2013–2025 só existiam para o ES. A população foi carregada para as 27 UFs (RAW em `raw/ibge/sidra-6579/`) e IND-SAU-05/05S foram recalculados para todas as UFs e competências (`scripts/exec/rederive-beds.ts`). Erratum ao relatório G0–G9 e ao P1 ("população com lacunas oficiais" valia só para 2007/2010/2022/2023, e a série nacional estava incompleta). Anos 2022–2023 seguem sem estimativa oficial.
- Testes novos: `tests/unit/health-story.test.ts` (6) no `npm test` (344 testes, 0 falhas).
