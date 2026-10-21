# Plano de implementação — Saúde Fase 1 (cenário B reformulado, revisão 2)

Data: 2026-10-19 · **Plano para aprovação; nada foi implementado.** Pré-requisito: leitura de `comparacao_modelos_postgres.md` (modelo D) e `modelo_dados_territorial_saude.md`.

## 1. Resumo (revisão 2)

* **10 collectors, todos já previstos no plano diretor** (`EXEC-C01`, `C14`, `C21`, `C30`, `C31`, `C32`, `C35`, `C20`, `C11`, `C12`): 2 de fundação e 8 de Saúde/finanças. SIM, SINASC e PNI ficam dentro de `EXEC-C35`. Nenhum collector novo, nenhum Siconfi exclusivo da Saúde.
* **21 tabelas novas** em `civica_exec` (9 fundação/proveniência/publicação, 4 indicadores/finanças/serving compartilhados, 8 de Saúde). **0 partições.** Em relação à versão anterior: 15 alteradas, 1 nova (`exec_change_log`), 5 inalteradas.
* Estimativas: PostgreSQL **+3,12 GiB** (antes 2,72; P8: 1,97); crescimento **+0,22 GiB/ano**; HD externo **22,5 GiB** de retenção obrigatória (completa 34,2; mínima de 24 meses 5,7, que **não** reconstrói o histórico CNES). São *estimativas*: nenhum collector foi implementado.
* **Rollback não é O(1)**: é O(linhas alteradas) via `exec_change_log` (publicação mais recente da fatia, 12 meses) ou replay do RAW. O ponteiro `exec_publication` registra, não determina a visibilidade.
* A experiência territorial existente é `/quem-me-representa` (Legislativo federal por `?uf=`/`?casa=`); a Saúde entra como bloco do Executivo, sem tocar a rota (ver `contratos_consulta_estado_municipio.md`).

## 2. Arquitetura recomendada

```
 Fontes ──► HD externo (RAW + manifesto sha256) ──► collector (CollectorProvider) ──► staging UNLOGGED por fatia
                                                         │  reconcileCandidate (EMPTY | DUPLICATE | SHRINK | NO_CHANGE)
                                                         ▼
                 civica_exec  (transação única por dataset × UF × competência)
     dimensões: exec_entity · _version · _external_id · exec_territory_population · exec_ref_code
     fatos Saúde: exec_sau_cnes_estab (identidade) · _estab_v · _leito_v · _equip_v · exec_sau_prof_mun_cbo · exec_sau_hosp_mes_subgrupo · exec_sau_sih_mun_mes
     indicadores: exec_ind_def · exec_ind_value · exec_ind_latest      finanças: exec_fin_fact
     proveniência/publicação: exec_ingestion_run · exec_raw_manifest · exec_publication · exec_change_log      serving: exec_story (UF/BR)
                                                         ▼
 packages/db/src/postgres-exec-*.ts  ──► apps/web (rotas novas; páginas legislativas intactas)
```

## 3. Famílias de collectors

### 1. Identidade territorial IBGE — `EXEC-C01 + EXEC-C14`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`; `https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/last` |
| Campos | id (7 dígitos), nome, UF, população estimada (D1C, V) |
| Granularidade | município × versão; município × ano |
| Tabelas | T01–T05 |
| Ordem de execução | 1 |
| Backfill | 1 chamada + séries anuais de população 2013–2026 (14 chamadas) |
| Frequência | mensal (diff) / anual |
| Reprocessamento | idempotente; versões em `exec_entity_version` |
| Validação | 5.571 municípios; 27 UFs; DF presente 1×; soma 2026 = 214.211.951 hab. |
| Linhas / GiB (PostgreSQL) | 195.767 / 0,020 |
| Dependências | nenhuma |
| Critério de aceite | contagens acima; mapa 6↔7 dígitos sem colisão; Boa Esperança do Norte com versão |
| Riscos | lista do IBGE sem data de instalação do município novo |

### 2. CNES — estabelecimentos — `EXEC-C21`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `ftp://ftp.datasus.gov.br/dissemin/publicos/CNES/200508_/Dados/ST/ST{UF}{AAMM}.dbc` (versões) + `https://apidadosabertos.saude.gov.br/assistencia-a-saude/cnes-estabelecimentos` (nome, endereço, lat/long) |
| Campos | CNES, CODUFMUN, TP_UNID, NAT_JUR, VINC_SUS, TPGESTAO, ESFERA_A, NIV_DEP, ATIVIDAD, DT_ATUAL; DEMAS: no_fantasia, nu_latitude, nu_longitude, ds_status |
| Granularidade | estabelecimento × competência (mudança) |
| Tabelas | H01 (`exec_sau_cnes_estab_v`), H02 (`exec_sau_cnes_estab`, identidade de todo CNES) |
| Ordem de execução | 2 |
| Backfill | ST 2013-01…2026-09 × 27 UF = 4.455 DBC (≈2,8 GiB); DEMAS 501.726 registros (volume de chamadas não provado) |
| Frequência | mensal |
| Reprocessamento | intervalos refeitos a partir da competência corrigida (seção 6 do modelo) |
| Validação | ST 2026-09: 501.726 estabelecimentos, 5.571 municípios; reconstrução de 3 competências aleatórias do ES igual ao arquivo |
| Linhas / GiB (PostgreSQL) | 2.540.823 / 0,479 |
| Dependências | família 1 |
| Critério de aceite | contagem nacional igual ao ST; ES: 10.270 vigentes, 13.093 CNES distintos na identidade, 38.916 versões (±1%); nenhum CNES de leito/equipamento/SIH sem linha em `exec_sau_cnes_estab` |
| Riscos | DEMAS pode não permitir varredura nacional; `DT_ATUAL` com datas futuras e 72.955 registros desatualizados; nome/lat-long só do estado atual |

### 3. CNES — leitos — `EXEC-C30`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `…/CNES/200508_/Dados/LT/LT{UF}{AAMM}.dbc` |
| Campos | CNES, CODUFMUN, TP_LEITO, CODLEITO, QT_EXIST, QT_CONTR, QT_SUS, QT_NSUS, COMPETEN |
| Granularidade | estabelecimento × tipo/código × competência (intervalos) |
| Tabelas | H03 |
| Ordem de execução | 3 |
| Backfill | 165 competências × 27 UF = 4.455 arquivos pequenos (≈0,1 GiB) |
| Frequência | mensal |
| Reprocessamento | igual à família 2 |
| Validação | 2026-09: 51.965 linhas, 543.524 leitos (362.715 SUS); `QT_EXIST = QT_SUS + QT_NSUS`; 4.271 intervalos no ES |
| Linhas / GiB (PostgreSQL) | 1.120.765 / 0,159 |
| Dependências | famílias 1–2 |
| Critério de aceite | leitos de qualquer competência do ES iguais ao arquivo; Brasil 2026-09 = 543.524 |
| Riscos | cadastro autodeclarado; leitos complementares/hospital-dia exigem decisão de especialista |

### 4. CNES — equipamentos — `EXEC-C30`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `…/CNES/200508_/Dados/EQ/EQ{UF}{AAMM}.dbc` |
| Campos | CNES, tipo/código de equipamento, existentes, em uso, disponibilidade SUS |
| Granularidade | estabelecimento × equipamento × competência (intervalos) |
| Tabelas | H04 |
| Ordem de execução | 4 |
| Backfill | 4.455 arquivos (≈1,5 GiB) |
| Frequência | mensal |
| Reprocessamento | igual à família 2 |
| Validação | ES: 26.875 linhas em 2026-09; 70.733 intervalos em 165 competências |
| Linhas / GiB (PostgreSQL) | 3.455.558 / 0,458 |
| Dependências | famílias 1–2 |
| Critério de aceite | contagem de 2026-09 por UF igual ao arquivo |
| Riscos | escala nacional (3,46 mi intervalos) é extrapolação por razão de estabelecimentos |

### 5. CNES — profissionais agregados — `EXEC-C31`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `…/CNES/200508_/Dados/PF/PF{UF}{AAMM}.dbc` (snapshots de dezembro + última) |
| Campos | CNES, CODUFMUN, CBO, vínculos; **nome e CPF/CNS descartados no parsing** |
| Granularidade | município × grupo de CBO × referência |
| Tabelas | H05 |
| Ordem de execução | 5 |
| Backfill | 15 snapshots × 27 UF (≈5,2 GiB de DBC; SP ≈ 85 MB por arquivo) |
| Frequência | trimestral (último) + dezembro |
| Reprocessamento | por snapshot |
| Validação | ES 2026-09: 145.836 vínculos (7,6 MB); soma dos grupos = total de vínculos |
| Linhas / GiB (PostgreSQL) | 1.949.850 / 0,167 |
| Dependências | família 1; dicionário CBO→grupo |
| Critério de aceite | totais por município iguais ao arquivo; nenhuma coluna identificadora persistida |
| Riscos | privacidade (o DBC traz identificação); definição de grupos de CBO a validar |

### 6. SIM — `EXEC-C35`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `…/SIM/CID10/DORES/DO{UF}{AAAA}.dbc` (definitivo 1996–2024) e `…/SIM/PRELIM/DORES/` (2025–2026) |
| Campos | TIPOBITO, IDADE, CODMUNRES, CODMUNOCOR, CAUSABAS, SEXO, TPMORTEOCO, OBITOGRAV, OBITOPUERP, DTOBITO |
| Granularidade | município de residência × ano (agregado de microdado) |
| Tabelas | H10 (4 indicadores compartilhados com SINASC) |
| Ordem de execução | 6 |
| Backfill | 27 UF × 2013–2024 (≈1,6 GiB) + preliminares |
| Frequência | anual + preliminar mensal |
| Reprocessamento | por UF × ano; preliminar marcado `flags |= 2` |
| Validação | 2024: 30.020 óbitos <1 ano; 1.326 maternos (definição de teste) |
| Linhas / GiB (PostgreSQL) | 0 / 0,000 |
| Dependências | famílias 1 e 7 |
| Critério de aceite | TMI Brasil 2024 = 12,56‰ com o SINASC; ES: soma municipal 609 vs 610 por UF |
| Riscos | morte materna: definição oficial não reproduzida (indicador fica fora da publicação) |

### 7. SINASC — `EXEC-C35`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `…/SINASC/1996_/Dados/DNRES/DN{UF}{AAAA}.dbc` (1996–2024) e `…/SINASC/PRELIM/DNRES/` |
| Campos | CODMUNRES, CODMUNNASC, PARTO, CONSPRENAT, CONSULTAS, DTNASC, TPROBSON, PESO |
| Granularidade | município de residência × ano |
| Tabelas | H10 |
| Ordem de execução | 6 |
| Backfill | 27 UF × 2013–2024 (≈1,7 GiB) |
| Frequência | anual + preliminar |
| Reprocessamento | por UF × ano |
| Validação | 2024: 2.389.325 nascidos; cesárea 60,6%; pré-natal ≥6: 87,5% dos válidos |
| Linhas / GiB (PostgreSQL) | 0 / 0,000 |
| Dependências | família 1 |
| Critério de aceite | denominadores iguais aos da família 6 |
| Riscos | DEMAS devolve 0 linhas: usar somente FTP; códigos xx0000 sem município |

### 8. PNI (cobertura vacinal) — `EXEC-C35`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `ftp://…/Dados_Abertos/SIPNIBD/Cobertura_Residencia.parquet` |
| Campos | CO_ANO, CO_MUNICIPIO, NU_IMUNO, QT_DOSE, NU_POPULACAO, NU_TAXA_COBERTURA, DT_CARGA |
| Granularidade | município × ano × imunobiológico |
| Tabelas | H10 + `exec_ref_code` (36 rótulos → código canônico) |
| Ordem de execução | 7 |
| Backfill | 1 arquivo (5,1 MB) |
| Frequência | por carga do arquivo (`DT_CARGA`) |
| Reprocessamento | substituição integral (arquivo único) |
| Validação | 1.088.479 linhas; Vitória BCG 2022 = 55% = TabNet 55,1% |
| Linhas / GiB (PostgreSQL) | 1.088.479 / 0,158 |
| Dependências | famílias 1 e 14 (dicionário) |
| Critério de aceite | nº de linhas igual; cobertura >100% marcada `flags |= 32` |
| Riscos | rótulos mudam; denominador SINASC; 2026 parcial |

### 9. SIH-RD — `EXEC-C32`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `…/SIHSUS/200801_/Dados/RD{UF}{AAMM}.dbc` |
| Campos | MUNIC_RES, MUNIC_MOV, CNES, DIAG_PRINC, PROC_REA, VAL_TOT, DIAS_PERM, MORTE, N_AIH, ANO_CMPT, MES_CMPT |
| Granularidade | hospital × mês × subgrupo; município de residência × mês |
| Tabelas | H06, H07, H10 (ICSAP, fluxo) |
| Ordem de execução | 8 |
| Backfill | 2013-01…2026-09 × 27 UF = 4.455 DBC (≈13,7 GiB; 89,2 MB por mês nacional) |
| Frequência | mensal |
| Reprocessamento | por UF × competência; deduplicar `N_AIH` (550 duplicados em jun/2024) |
| Validação | jun/2024: 1.188.890 AIH, R$ 1,97 bi, ICSAP 15,8%; ES 2024: 307.500 AIH; residentes do ES precisam dos 27 arquivos (−1,0% com só RDES) |
| Linhas / GiB (PostgreSQL) | 6.095.411 / 0,798 |
| Dependências | famílias 1–2 (CNES) e dicionário SIGTAP/ICSAP |
| Critério de aceite | totais por UF e mês iguais à soma dos arquivos; ICSAP 15,8% em jun/2024 |
| Riscos | valor é aprovado, não pago; layout mudou (86→95→113 campos); AIH individual não persistida |

### 10. e-Gestor APS (cobertura) — `EXEC-C20 (adaptação)`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `https://relatorioaps-prd.saude.gov.br/cobertura/{aps|ab}?unidadeGeografica=MUNICIPIO&coUf={UF}&nuCompInicio=&nuCompFim=` |
| Campos | qtPopulacao, qtEsf, qtEap*, qtCapacidadeEquipe, qtCobertura, coMunicipioIbge, nuComp |
| Granularidade | município × competência |
| Tabelas | H10 |
| Ordem de execução | 9 |
| Backfill | 27 UF × 93 competências = 2.511 chamadas |
| Frequência | mensal |
| Reprocessamento | por competência |
| Validação | 2026-08: 5.570 municípios (falta Itati), Brasil 98,77% |
| Linhas / GiB (PostgreSQL) | 518.000 / 0,075 |
| Dependências | família 1 |
| Critério de aceite | 5.570 linhas; Vitória 346.500/343.378 = 100,9 |
| Riscos | API não documentada; quebra AB→APS em 2021; cobertura >100% |

### 11. Siconfi (DCA, RREO, RGF) — `EXEC-C11 + EXEC-C12`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/{dca|rreo|rgf}` (inclui `RREO Simplificado` e `RGF Simplificado`) |
| Campos | cod_ibge, exercicio, periodo, anexo, conta, coluna, valor, populacao |
| Granularidade | ente × exercício × conta × coluna (lista branca) |
| Tabelas | H12 + H10 (INDs 16, 17, 18, 19, 20) |
| Ordem de execução | 10 |
| Backfill | ≈5.600 entes × 10 exercícios × 3–5 chamadas ≈ 170–280 mil chamadas; raw `jsonl.gz` por UF × ano |
| Frequência | bimestral/quadrimestral/semestral/anual |
| Reprocessamento | por ente × exercício; retificações regravam a fatia |
| Validação | Vitória 2024: Saúde empenhada R$ 503,0 mi; DTP 41,53%; 150/150 municípios sorteados extraídos (86 padrão + 64 simplificado) |
| Linhas / GiB (PostgreSQL) | 3.360.000 / 0,320 |
| Dependências | família 1; dicionário de contas |
| Critério de aceite | valores de Vitória e SP iguais ao teste; entes sem entrega listados como "sem registro" |
| Riscos | cobertura nacional de entrega não medida; Anexo 12 ausente (ASPS fica de fora) |

### 12. Outras fontes (após validação) — `a definir`

| Item | Detalhe |
|---|---|
| Fonte / endpoint real | SIOPS (descoberta), BNAFAR/Hórus, SIA, SIAPS, Previne |
| Campos | — |
| Granularidade | — |
| Tabelas | fora da Fase 1 |
| Ordem de execução | 11 |
| Backfill | — |
| Frequência | — |
| Reprocessamento | — |
| Validação | SIOPS não enumerável; SIA subestima APS; SIAPS e Previne com séries curtas |
| Linhas / GiB (PostgreSQL) | 0 / 0,000 |
| Dependências | decisões de especialista |
| Critério de aceite | contrato aprovado por família |
| Riscos | entram só se passarem em novo gate |

## 4. Ondas de implementação

Cada onda termina com verificação automática (contagens e totais acima) e só então a próxima começa. GiB = PostgreSQL adicional da onda.

| Onda | Conteúdo | Collectors | GiB | Dependências | Verificação |
|---|---|---|---:|---|---|
| **Fase 0 — Fundação** | schema `civica_exec` (migração versionada), T01–T09 (inclui `exec_change_log`), `exec_ind_def`, dicionários, funções `ym_next`/`ym_prev`, adaptador de publicação por fatia | C01, C14 | 0,316 | aprovação do schema e do HD externo | 5.571/27/5/1; Boa Esperança do Norte; 0 colisões 6↔7 dígitos; publicação, rollback por change log e replay de teste; 7 testes de mesa do modelo (dez/2024→jan/2025 etc.) como testes automatizados |
| **1A — CNES** | estabelecimentos, leitos, equipamentos, profissionais agregados | C21, C30, C31 | 1,263 | Fase 0 | reconstrução de competências do ES igual ao arquivo; Brasil 2026-09: 501.726 estab., 543.524 leitos |
| **1B — Epidemiologia** | SIM, SINASC, PNI → indicadores 07, 08, 11, 12 (09 só após validação) | C35 | 0,251 | Fase 0 | TMI Brasil 2024 12,56‰; cesárea 60,6%; PNI 1.088.479 linhas |
| **1C — Atividade hospitalar** | SIH-RD → H06, H07, ICSAP | C32 | 0,827 | 1A (CNES) | jun/2024: 1.188.890 AIH; ICSAP 15,8%; ES 2024: 307.500 AIH |
| **1D — APS e finanças** | cobertura de APS; Siconfi (lista branca); indicadores 01, 16, 17, 18, 19, 20 | C20, C11, C12 | 0,395 | Fase 0 | Vitória: R$ 503,0 mi, 41,53%; amostra de 150 reproduzida; APS 5.570 + Itati sinalizado |
| **1E — Consulta** | `exec_ind_latest`, `exec_story`, módulos `postgres-exec-*.ts`, contratos e rotas novas, cache | — | 0,012 | 1A–1D | 15 consultas do `contratos_consulta_estado_municipio.md` dentro das metas de latência no benchmark |

Sequência alternativa considerada e descartada: **SIH antes de CNES**. O SIH precisa do CNES para validar `cnes → município` e nomes; inverter a ordem produz hospitais sem cadastro. **Epidemiologia (1B) pode rodar em paralelo a 1A** assim que a Fase 0 termina, pois só depende de `exec_entity`.

Esforço relativo (sem prazo em calendário, que depende da equipe e dos limites das fontes): Fase 0 pequeno; 1A médio; 1B pequeno (arquivos simples); 1C grande (volume e três regras: residência, ICSAP, duplicatas); 1D médio-grande (Siconfi com milhares de chamadas e dois formulários); 1E médio.

## 5. Histórico, snapshots e atualização

| Opção | Reconstrói "leitos SUS do Hospital X em 01/2018 e 09/2026"? | Linhas (Brasil, 2013–2026, extrapolado do ES) | Veredito |
|---|---|---:|---|
| Snapshot mensal completo | sim | estab. 60 mi + leitos 8 mi + equip. 160 mi | descartado (≈41× maior) |
| **SCD2/intervalos (change-only)** | **sim** (consulta por `valid_from <= c <= valid_to`) | estab. 1,9 mi + leitos 0,20 mi + equip. 3,5 mi | **adotado** para cadastro |
| Deltas sem estado inicial | não (exige replay) | menor | descartado |
| Agregado mensal | sim, para o que é agregado | 5,2 mi (hospital × mês × subgrupo) | **adotado** para atividade hospitalar |
| Agregado anual | parcial | 1,9 mi (profissionais) | adotado só para profissionais |
| Revisões completas | sim | ×2 (padrão de `civica_state`) | não usar em fatos nacionais |
| *Materialized view* | derivada | — | usar apenas se uma consulta medida passar do limite |

Medição de apoio (ES, 165 competências 2013-01…2026-09): snapshots 169.703 / 1.220.612 / 3.273.769 linhas (leitos / estabelecimentos / equipamentos) versus 4.271 / 38.916 / 70.733 versões.

## 6. Publicação atômica e integridade

| Unidade de publicação | Prós | Contras | Uso |
|---|---|---|---|
| **UF × dataset × competência** | falha de uma UF não afeta as outras; reprocessamento mínimo; paralelismo natural | página que mistura datasets vê competências diferentes (cada domínio mostra o seu `dataThrough`) | **unidade de escrita** |
| Fonte inteira / dataset inteiro | consistente | tudo ou nada: uma UF ruim bloqueia 26 | descartado |
| Competência nacional | consistente por mês | UF lenta bloqueia o país | só PNI (arquivo único) |
| Revisão por linha (`revision_id`) | histórico completo | 2× linhas e índices longos | não usar em fatos nacionais |

**Correção desta revisão.** A versão anterior dizia que o ponteiro determinava a publicação e que o rollback era por `previous_run_id`. Isso era incorreto: com mutação no lugar, **a visibilidade é a do commit**; o ponteiro apenas registra a fatia e o run, e os dados antigos não ficam na tabela. O desfazer é: (1) **`exec_change_log`**, exato e O(linhas alteradas), para a publicação mais recente de cada fatia e por 12 meses; (2) **replay do RAW** (`REPLAY_FROM(k)`), determinístico, para qualquer outro caso (inclusive cargas iniciais). Nenhum dos dois é O(1).

As sequências transacionais exatas — `PUBLISH`, `ROLLBACK_RUN` e `REPLAY_FROM(k)` —, os critérios de aceite e a tabela de respostas sobre visibilidade estão em `modelo_dados_territorial_saude.md`, seção 7. Resumo das garantias: coleta completa da UF (manifesto `VERIFIED`); validação e reconciliação (`reconcileCandidate`); publicação por competência em transação única com *advisory lock* por `(dataset, uf)`; derivados na mesma transação e mesmo `run_id`; nenhum estado parcial em falha; idempotência por `source_hash`; correção retroativa por replay transacional; falha numa UF não altera as outras. Páginas leem em `REPEATABLE READ` somente leitura.

O mecanismo de revisões existente resolve metade do problema (portões `reconcileCandidate`, ponteiro, locks, agendador) e é reutilizado; não é reutilizado gravar `revision_id` em cada linha de fato nacional.

## 7. HD externo × PostgreSQL

### 7.1 PostgreSQL (disco do servidor)

| Item | Estimativa |
|---|---|
| Dados + índices adicionais | **3,12 GiB** (serving 0,012 GiB já incluído) |
| Espaço temporário em operação (ordenação, índices, staging UNLOGGED) | ≈ 3 GiB |
| WAL gerado no backfill inicial | ≈ 6 GiB, reciclado; exige `max_wal_size` 8–16 GiB durante a carga (hoje 1 GiB) |
| Backup lógico das tabelas novas (`pg_dump -Fc`) | ≈ 0,5 GiB por cópia |
| Observação | o banco atual teve checkpoints falhando por corrupção de página (resolvido hoje); `data_checksums` está desligado: fazer backup lógico completo antes do backfill |

**Não mover o diretório de dados do PostgreSQL para HD USB**: o risco é de integridade (desconexão durante fsync, sleep da ponte USB-SATA, sem proteção contra queda de energia), exatamente o tipo de falha que acabou de corromper uma página.

### 7.2 HD externo (RAW e artefatos)

Organização:

```
civica-raw/
  _manifest/            export jsonl de exec_raw_manifest + SHA256SUMS por diretório
  datasus/sih-rd/{UF}/{AAAA}/RD{UF}{AAMM}.dbc
  datasus/cnes/{ST,LT,EQ,PF}/{UF}/{AAAA}/…
  datasus/sim/{definitivo,prelim}/…   datasus/sinasc/{definitivo,prelim}/…   datasus/pni/Cobertura_Residencia-{DT_CARGA}.parquet
  egestor-aps/{AAAAMM}/uf={UF}.json.gz
  siconfi/{dca,rreo,rgf}/{AAAA}/uf={UF}.jsonl.gz
  ibge/…                 sigtap/TabelaUnificada_{AAAAMM}.zip
  staging/{run_id}/      temporário; apagado após publicação
  quarantine/            arquivos com hash divergente ou tamanho inesperado
  backups/               pg_dump das tabelas civica_exec + checksums
```

Retenção obrigatória por dataset (a disponibilidade atual de um arquivo **não** garante a futura):

| Dataset | Escopo | GiB | Retenção | Recuperável da fonte oficial? | Perda com política de 24 meses |
|---|---|---:|---|---|---|
| SIM / SINASC definitivo | 29 anos × 27 UF (DBC) | 4,7 | Obrigatória | Sim hoje (FTP). **A pasta já mudou**: o definitivo de 2023–2024 está em `/1996_/Dados/DNRES`, não em `/NOV/DNRES` | Reconstruir o cálculo auditável de séries antigas se a fonte reorganizar ou reprocessar |
| SIM / SINASC preliminar | cada vintage 2025–2026 | 0,1 | Obrigatória (arquivar a cada carga) | **Não**: o preliminar é substituído pelo definitivo; `/PRELIM` guarda só 2025–2026 | Perdido para sempre o preliminar publicado antes da substituição |
| CNES ST / LT / EQ (todas as competências 2013→) | 165 competências × 27 UF | 4,1 | Obrigatória | Hoje sim (200508–202609 listados); o arquivo de uma competência antiga pode ser reprocessado pela fonte sem aviso | Com 24 meses: **não** seria possível refazer intervalos após correção retroativa, nem auditar o histórico de leitos/equipamentos |
| CNES PF (profissionais) | 15 snapshots × 27 UF (dados identificáveis; parser descarta) | 5,2 | Obrigatória enquanto o agregado for publicado | Sim hoje | Reconstruir agregados por CBO de snapshots antigos |
| SIH-RD | 2013→ × 27 UF (89,2 MB/mês nacional) | 13,7 | Janela móvel de 24 meses (2,0 GiB) + arquivamento anual opcional | Hoje sim (2008→); o arquivo de uma competência é regravado em reprocessamentos, então a **versão** usada no momento da publicação não é recuperável | Com 24 meses: competências mais antigas só podem ser refeitas da versão **atual** da fonte, não da usada na publicação original |
| PNI `Cobertura_Residencia.parquet` | um arquivo por carga (5 MB) | 0,1 | Obrigatória (guardar cada versão) | **Não**: arquivo único substituído (carga de 01/07/2026) | Perdida toda versão anterior |
| e-Gestor APS (respostas JSON) | 2.511 chamadas | 0,1 | Obrigatória | **Não**: a API recalcula (AB deixou de responder de 2021 em diante; APS não responde antes de 202112) | Perdida a série tal como era servida |
| Siconfi (respostas `jsonl.gz`) | ≈5.600 entes × 10 exercícios | 6,0 | Obrigatória enquanto os indicadores forem publicados | Parcial: a API devolve o último dado entregue; retificações sobrescrevem | Perdida a capacidade de explicar um valor publicado após retificação |
| IBGE (localidades, SIDRA), SIGTAP, listas (ICSAP), dicionários | versões | 0,3 | Obrigatória (cada vintage) | Parcial: SIGTAP mensal tem histórico; estimativas populacionais são substituídas a cada ano | Perdidos os denominadores originais de cada publicação |
| DEMAS CNES (nome, endereço, coordenadas) | varredura | 0,0 | Obrigatória se usada (tamanho a medir) | **Não**: só o estado atual | Perdido o cadastro descritivo anterior |

Reconciliação dos números:

| Política | RAW (GiB) | O que contém | Reconstrói o histórico CNES? |
|---|---:|---|---|
| **Obrigatória (recomendada)** | **22,5** | tudo acima; SIH só 24 meses | **Sim** |
| Completa | 34,2 | + SIH 2013→ integral (13,7 GiB) | Sim |
| Mínima (24 meses de fontes reproduzíveis) | 5,7 | só os últimos 24 meses de SIH/CNES/SIM-SINASC/Siconfi | **Não** (perde intervalos CNES, vintages preliminares e versões de API) |
| PostgreSQL | 3,12 | intervalos e agregados derivados + change log | Guarda o resultado, **não** permite refazê-lo nem auditar |

Crescimento anual: PostgreSQL 0,22 GiB; RAW 1,6 GiB/ano (obrigatória) ou 2,6 GiB/ano (completa). O valor de 5,0 GiB da P8 e os 5,7 GiB da versão anterior correspondem à política mínima.

Espaço temporário por worker: ≈ 0,3–1,2 GiB (SP no PF decodificado ≈ 1,1 GiB); com 4 workers ≈ 6 GiB.

Fatores: DBC → DBF expande ~13× (`PAES2406`: 33 MB → 440 MB), por isso o decode é feito por arquivo e apagado. Retenção: ver tabela acima. Para o SIH vale a janela móvel de 24 meses; para CNES, SIM/SINASC, Siconfi, PNI e e-Gestor a retenção é obrigatória. 

Integridade e retomada: download para `*.part` e renomeação atômica após conferir tamanho e `sha256`; FTP com `REST` e HTTP com `Range` quando suportado; manifesto com estados `PENDING → DOWNLOADED → VERIFIED → PARSED → PUBLISHED`; reinício varre `PENDING/DOWNLOADED` e repete só o que falta; um arquivo é considerado igual quando `(url, bytes, source_modified_at)` coincidem. Backups: 3 cópias (disco do servidor, HD externo, segundo volume) com `SHA256SUMS` verificado semanalmente.

HD × SSD externo: do ponto de vista técnico, o acesso é majoritariamente **sequencial** (download, descompressão, leitura de arquivos DBC), o que HDs lidam bem; **staging e decodificação** com muitas gravações pequenas e simultâneas rendem mais em armazenamento de acesso aleatório rápido (o SSD interno do servidor). Não afirmo desempenho do dispositivo ainda não adquirido; recomendo medir leitura/escrita sequencial e IOPS de 4 KiB antes de decidir onde fica o `staging/`. Preferir alimentação própria e desabilitar suspensão do disco durante cargas.

## 8. Armazenamento recalculado (cenário B com a arquitetura recomendada)

| Métrica | Valor |
|---|---:|
| `CURRENT_DATABASE_GIB` | **14,95** (medido em 19/10, após remover a tabela corrompida) |
| `HEALTH_PHASE1_ADDITIONAL_GIB` | **3,11** (dimensões, proveniência, fatos, indicadores, finanças) |
| `SERVING_ADDITIONAL_GIB` | **0,012** (`exec_ind_latest` + `exec_story`; já fora do item anterior, sem dupla contagem) |
| `RAW_EXTERNAL_GIB` | **22,5** (retenção obrigatória, recomendada) · 34,2 (completa) · 5,7 (mínima de 24 meses, insuficiente para o histórico CNES) |
| `ANNUAL_GROWTH_GIB` | **0,22** (PostgreSQL) + ≈ 1,6 de RAW (obrigatória; 2,6 se o SIH for retido integralmente) |
| `TOTAL_AFTER_HEALTH_PHASE1_GIB` | **18,07** (14,95 + 3,12) |

As ondas somam ≈ 2,67 GiB; os ≈ 0,05 GiB restantes são folga em `exec_ind_value` para os indicadores 02, 09 e 18 (fora do escopo da Fase 1, mantidos como reserva caso sejam aprovados). Dos 3,12 GiB, 1,19 GiB são **estruturas compartilhadas** (fundação, indicadores, finanças) que os demais domínios reutilizam; 1,93 GiB são específicos de Saúde. Não há materializações duplicadas: `exec_ind_latest` é a única cópia derivada e `exec_story` só existe para Brasil e UFs.

**Projeção com os demais domínios** (somente a regra; volumes de cada domínio dependem das fases futuras): o *custo marginal* de cada novo domínio é seus fatos específicos + linhas em `exec_ind_value` (≈ 155 B/linha, ≈ 0,14 GiB por milhão de valores) + células novas em `exec_fin_fact` (≈ 19 por ente-ano e função, ≈ 1,06 mi linhas ≈ 0,09 GiB para cobrir 10 exercícios). Sem a fundação compartilhada, cada um dos 4 domínios seguintes repetiria dimensões, proveniência e uma ingestão própria do Siconfi (≈ 0,24 GiB cada), isto é, ≈ 1,2 GiB de duplicação evitada.

## 9. Benchmark futuro em banco isolado (não executado)

Pré-requisito: **autorização explícita** e instância separada (outro cluster ou outro servidor) — nada é criado no banco do Cívica. Dados sintéticos com as distribuições medidas (concentração por UF: SP 23%, MG 13%…; AIH por mês; versões CNES).

| Variante | Descrição |
|---|---|
| V1 | tabela única com índices (modelo B) |
| V2 | `PARTITION BY LIST (uf)` |
| V3 | `PARTITION BY RANGE (competence)` por ano |
| V4 | híbrido (V1 + partições só na maior) |

Escalas: Fase 1 (5,2 mi em H06) e C (36 mi + 12 mi). Métricas: latência p50/p95/p99 das 15 consultas; carga concorrente 1/8/32 clientes (pgbench com scripts); frio e quente; consulta por município, por UF e nacional; agregações temporais; inserção (COPY), *upsert* de uma UF, reprocessamento da UF de maior volume (SP) e da menor (RR); tamanho de índices; tempo de `VACUUM`/`ANALYZE`; migração de esquema (adicionar coluna) e *rollback* por partição. **Critério de adoção:** só particionar se houver ≥30% de melhoria em p95 nas consultas-alvo *ou* ≥50% menos tempo de troca/retenção da fatia, **sem** regressão > 20% nas consultas nacionais e sem ultrapassar os orçamentos: município/hospital p95 ≤ 100 ms, UF p95 ≤ 300 ms, comparação nacional p95 ≤ 1,5 s.

## 10. Riscos a resolver antes de implementar

1. **Nome e coordenadas dos estabelecimentos**: o DBC `ST` não traz nome; a varredura nacional do DEMAS (501.726 registros) não foi provada. Sem isso, `exec_sau_cnes_estab` fica sem nome e coordenadas (a identidade e as FKs não dependem disso).
2. **Escala nacional extrapolada do ES** (razão 48,9) para versões de estabelecimento/equipamento e para o SIA/SIH: medir com 2–3 UFs grandes (SP, MG) antes de fechar a estimativa.
3. **SIOPS** sem rota comprovada: o indicador 15 fica fora da Fase 1.
4. **Definições de especialista** (leito, ICSAP, morte materna, pré-natal) congelam os `exec_ind_def`; indicador sem definição aprovada não é publicado (`ranking_allowed=false` por padrão).
5. **Privacidade**: PF (profissionais), SIH (`N_AIH`, nascimento) e PNI individual — nada identificável entra no PostgreSQL; descarte no parsing, com teste automatizado.
6. **API do e-Gestor** não documentada: teste de contrato a cada execução.
7. **Banco**: backup lógico completo e `ANALYZE` antes do backfill; `data_checksums` desligado; `max_wal_size` insuficiente.
8. **Limites de taxa** do Siconfi/DEMAS desconhecidos: o backfill pode levar dias.
9. **Reconciliação de P8** (Itati vs município novo) e instalação do município novo a confirmar.
10. **Duplicidade de AIH** (550 `N_AIH` repetidos em jun/2024): política de deduplicação a definir.

11. **Disponibilidade futura das fontes**: pasta do SINASC definitivo já mudou de lugar; PNI, e-Gestor e SIAPS não guardam histórico (retenção do RAW obrigatória).
12. **Dois contratos de cobertura** (`DataCoverage` em `/quem-me-representa`; `ProductCoverage` nas Assembleias): exige adaptadores na integração.
13. **Nomes das UFs duplicados em `page.tsx`** e UF como texto em `civica.profiles`: semear `exec_entity` e migrar para ela só na fase de integração.

## 11. Matriz de decisão

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Tabela física por UF? | **Não.** 12 tabelas de fato × 27 = 324 tabelas sem ganho que o ponteiro de publicação por fatia não dê |
| 2 | Tabela por município? | **Não** (≈ 66 mil tabelas) |
| 3 | Tabelas nacionais indexadas bastam? | **Sim** na Fase 1: maior tabela 5,2 mi linhas (~0,7 GiB) |
| 4 | Quais datasets justificam particionamento? | Nenhum na Fase 1. Candidatos no cenário C: `hospital × procedimento × mês` (~36 mi) e `SIA estab × grupo × mês` (~29 mi), após benchmark |
| 5 | Quais por UF? | **Nenhum** (distribuição desigual: SP 23%; consulta de hospital não traz UF) |
| 6 | Quais por competência? | Os candidatos do item 4, `RANGE` anual |
| 7 | Onde o híbrido? | Dimensões únicas + fatos nacionais + intervalos + serving; partição como opção futura |
| 8 | Como os collectors alimentam a mesma identidade? | Resolvendo `entity_id` via `exec_entity_external_id`; código não mapeado bloqueia a publicação |
| 9 | Como evitar duplicar valores estaduais e municipais? | UF e Brasil são **calculados dos numeradores/denominadores municipais** na publicação e gravados como entidades `kind=UF/BR` em `exec_ind_value`; nunca converter taxa estadual em municipal |
| 10 | Como conectar ao backend atual? | Novos módulos `packages/db/src/postgres-exec-*.ts` + `apps/web/lib/exec-*.ts`; mesmo pool, mesmo contrato `ProductCoverage`, mesmo padrão `*_story` |
| 11 | Consultas nacionais eficientes? | Índice `(indicator_id, period_start, entity_id)` e `exec_ind_latest` (80 mil linhas) |
| 12 | Atualizar uma UF sem reprocessar as outras? | Publicação por fatia `(dataset, uf, competence)` com lock próprio |
| 13 | Histórico sem duplicar? | Intervalos para cadastro, agregados mensais para atividade; redução ≈ 41× |
| 14 | Quantas tabelas novas? | **21** (+1 opcional: regiões de saúde) |
| 15 | Espaço adicional? | **3,12 GiB** no PostgreSQL, **22,5 GiB** no HD (obrigatória; completa 34,2; mínima 5,7 não basta) |
| 16 | Primeira fase? | **Fase 0** (fundação territorial e publicação por fatia) |
| 17 | Riscos antes de implementar? | Seção 10 |

## 12. O que precisa ser aprovado

1. Schema `civica_exec` com as 21 tabelas (ou outro nome) e a regra "sem `revision_id` nas linhas de fato; ponteiro por fatia".
2. Modelo D e a regra de partição adiada com benchmark.
3. Retenção obrigatória do RAW (22,5 GiB; HD externo com ≥ 40 GiB livres) e uso do HD externo (sem mover o diretório do PostgreSQL).
4. Política de privacidade: nenhum dado individual na Fase 1.
5. Escopo da Fase 1: indicadores 01, 05, 07, 08, 10, 11, 12, 16, 17, 19, 20; **fora**: 09 (até definição oficial), 15 (SIOPS), 02, 06, 13, 14, 03, 04 e 18 (definição aberta).
6. Escolha de 2 UFs grandes para medir a escala antes do backfill.
7. Janela e taxa de requisições ao Siconfi/DEMAS.
8. Execução do benchmark isolado (autorização do banco de testes).

## 13. Registro de correções (revisão 2)

Cada linha traz diagnóstico anterior, evidência nova, correção e impactos.

| ID | Diagnóstico anterior | Evidência nova | Correção | Impacto na arquitetura | Impacto no armazenamento | Impacto no plano |
|---|---|---|---|---|---|---|
| **C01** Escopo da investigação de páginas | Investiguei `/legislativo/estaduais` (Assembleias Legislativas) como se fosse a experiência territorial do produto. | A experiência territorial existente é `/quem-me-representa` (`?uf=` e `?casa=`): Legislativo federal (Senado e Câmara) por UF. É a rota da navegação "Estados" (cabeçalho, mapa, cartão da home) e dela partem os 27 links do mapa (`/quem-me-representa?uf=XX`). Ela nada tem de executivo. | Nova seção 2A em `investigacao_backend_territorial_atual.md` com o fluxo URL → parâmetros → componentes → loader → SQL → tabelas, inventário de rotas territoriais e regras de separação Legislativo × Executivo. | A integração futura de Saúde parte de `?uf=` (validado pelo conjunto `ufs` do domínio), com seção própria "Poder Executivo", sem usar `casa` nem entrar em `summary.byHouse`. A rota não é modificada. | nenhum | Fase 1E ganha um ponto de integração com a navegação existente; `DataCoverage` (rota) e `ProductCoverage` (Assembleias) precisam de adaptador. |
| **C02** Aritmética de competência (`yyyymm − 1`) | O algoritmo de intervalos fechava versões com `valid_to = c − 1`. Para `c = 202501` isso dá `202500`, que não é competência. | Teste de mesa executado: `202501 − 1 = 202500` (inválido). Implementação de referência com `ym_prev`/`ym_next` e `CHECK` de mês 01–12 passou nos 7 cenários, incluindo dezembro → janeiro. | Intervalos **semiabertos** `[valid_from, valid_to)`: encerrar = gravar `valid_to = c` (competência em que o estado deixa de valer). Nenhuma subtração. Funções `ym_next`/`ym_prev` (SQL) só para a guarda de contiguidade; tipo `civica_exec.competence` com `CHECK`. | Todas as tabelas de intervalo (`exec_sau_cnes_estab_v`, `_leito_v`, `_equip_v`) e consultas passam a usar `valid_to > c`. | nenhum | Critério de aceite da Fase 1A inclui os 7 testes de mesa como testes automatizados. |
| **C03** Integridade referencial de estabelecimentos históricos | Leitos, equipamentos e versões apontavam para `exec_sau_cnes_estab_cur`, que só tinha estabelecimentos vigentes (501.726). | No ES, 165 competências têm **13.093 CNES distintos** contra 10.270 vigentes (×1,275); 4.485 desaparecimentos e **1.662 reaparecimentos**. Uma FK para a tabela "atual" violaria a integridade para qualquer estabelecimento encerrado. | `exec_sau_cnes_estab_cur` vira `exec_sau_cnes_estab`: identidade de **todo** CNES já visto (+ stubs de CNES só vistos no SIH) e atributos descritivos atuais. É o alvo de todas as FKs (`_v`, leitos, equipamentos, `exec_sau_hosp_mes_subgrupo`). | Ordem de carga: identidade antes dos fatos; SIH cria stubs para CNES desconhecido (nunca órfãos). | +0,05 GiB (639.639 linhas em vez de 501.726) | Família 2 passa a construir a identidade a partir de todas as competências. |
| **C04** O ponteiro não determina a visibilidade; rollback não é O(1) | A seção 7 atualizava as linhas de fato **no lugar** e apontava `exec_publication` para o novo `run_id`; a seção 6 do plano falava em rollback por `previous_run_id`. | Com mutação no lugar, os valores visíveis são os do último `COMMIT`; o ponteiro apenas registra. Os dados antigos deixam de existir na tabela: voltar exige reaplicar o inverso ou reprocessar o RAW. Não é O(1). | Ponteiro redefinido como **registro e portão** (cobertura, idempotência, base para rollback). Rollback exato por **`exec_change_log`** (O(linhas alteradas), só para a publicação mais recente da fatia); fora disso, **replay do RAW**. Sequências transacionais exatas de publicação, rollback e reprocessamento com critérios de aceite. | Nova tabela `exec_change_log`; `slice_hash` em `exec_ingestion_run`; indicadores derivados são gravados e registrados na mesma transação dos fatos. | +0,26 GiB (`exec_change_log`, retenção rolante de 12 meses) | Fase 0 inclui `exec_change_log`; teste de rollback é critério de aceite da Fase 0. |
| **C05** Unicidade e temporalidade dos indicadores | `exec_ind_value` tinha PK `(indicator_id, entity_id, period_start)` sem lugar para duas metodologias nem para preliminar/definitivo; `run_id` era `integer` numa tabela e `bigint` em outra. | A cobertura de APS tem duas metodologias sem sobreposição (AB até 202012; APS desde 202112) e o SINASC/SIM publica preliminar e definitivo do mesmo ano. | Uma linha de `exec_ind_def` por **versão metodológica** (ids distintos, `supersedes_id`, `valid_from_period`/`valid_to_period`); `status` (1 preliminar, 2 definitivo) em `exec_ind_value`; definitivo **substitui** preliminar na mesma PK (o valor anterior fica no change log e no RAW); `period_end` explícito; `run_id integer` em todas as tabelas. | Séries que cruzam versões são montadas por união explícita; a lacuna 2021 é declarada, não interpolada. | +0,04 GiB (colunas extras) | Fase 1B/1D publicam só versões com definição aprovada. |
| **C06** Reconciliação dos códigos IBGE | Fatos de SIM/SINASC/SIH com município `xx0000` ("ignorado") não tinham entidade; `exec_entity_external_id` e `exec_ref_code` não admitiam reuso de código ao longo do tempo. | 14 códigos `xx0000` em 2024 no SINASC; `ibge6` é único nos 5.571 municípios (5.571/5.571); PNI traz o município novo desde 2023, SIM/SINASC/SIH ainda não. | `exec_entity.kind = 5` ("município ignorado da UF", 27 linhas) para somar corretamente por UF sem entrar em ranking municipal; PK de `exec_entity_external_id` e `exec_ref_code` com `valid_from`; regra explícita 6↔7 dígitos; guarda de contiguidade. | Universo: 5.571 municípios + 27 "ignorados" + 27 UFs + 5 regiões + Brasil = 5.667 entidades. | desprezível | Fase 0: seeds com 5.667 entidades e teste de reconciliação. |
| **C07** Chaves e unidades de `exec_fin_fact` | A PK `(entity_id, exercicio, periodo, conta_id, coluna_id)` não distinguia RREO bimestral de RREO Simplificado semestral nem unidade de coluna. | 64 de 150 municípios sorteados usam formulário simplificado; colunas têm unidades diferentes (R$, % da RCL). | `conta_id` identifica (demonstrativo, variante, anexo, conta) e mapeia para conta canônica; unidade (centavos, pontos-base) vem do dicionário da coluna. | Comparação entre entes usa a conta canônica. | nenhum | Família 11: dicionário de contas antes da carga. |
| **C08** Retificações retroativas de intervalos | A regra de correção retroativa estava em prosa e sem prova. | Teste de mesa T5: republicar 202203 com SUS 6→5 produz o mesmo resultado que reconstruir tudo do zero. | Algoritmo `rebuild_from(k)` transacional com guarda de contiguidade, verificação de no máximo um intervalo aberto por chave e ausência de sobreposição. | Exige RAW das competências k…última. | nenhum | RAW do CNES é retenção obrigatória. |
| **C09** Retenção do RAW | Apresentei 34,2 GiB (completa) e 5,7 GiB (mínima) sem definir retenção por dataset nem o que se perde. | A disponibilidade atual não garante a futura: o definitivo do SINASC mudou de pasta (`/NOV/DNRES` termina em 2022; 2023–2024 em `/1996_/Dados/DNRES`); `/PRELIM` guarda só 2025–2026; o PNI é um arquivo único substituído a cada carga; `/cobertura/ab` deixou de responder de 2021 em diante; SIAPS só devolve 202512; BNAFAR só o mês corrente. | Política por classe: **obrigatória 22,5 GiB** (tudo, exceto SIH além de 24 meses), completa 34,2 GiB, mínima de 24 meses 5,7 GiB (insuficiente para reconstruir CNES). | Manifesto marca `retention_class` por arquivo. | RAW_EXTERNAL_GIB = 22,5 (recomendado); PostgreSQL inalterado | Aprovação do HD externo com capacidade ≥ 40 GiB livres (22,5 + folga). |
| **C10** Consultas SQL | Q1 usava tabela inexistente (`exec_dataset`); Q6/Q9 referenciavam `exec_sau_cnes_estab_cur`; filtros temporais assumiam intervalos fechados; faltavam `kind`, `status` e dependências. | Auditoria linha a linha das 15 consultas contra o DDL revisado. | Consultas reescritas com intervalos semiabertos, identidade de CNES, `kind`, `status`, `flags` e lista de dependências; navegação `/quem-me-representa → UF → território → Saúde` adicionada. | Nenhuma tabela nova além de `exec_change_log`. | nenhum | Latências continuam metas a medir no benchmark. |
| **C11** Armazenamento | 2,72 GiB no PostgreSQL; 20 tabelas. | Itens C03–C06 e C04 alteram linhas e colunas; índices parciais de intervalo aberto adicionados. | **3,12 GiB** (+0,40 GiB): `exec_change_log` 0,26; identidade de CNES +0,05; índices únicos parciais e colunas de status; 21 tabelas. | — | 2,72 → 3,12 GiB; crescimento anual 0,22 GiB | Totais de ondas recalculados. |


## 14. Matriz de prontidão para aprovação

| Item | Estado | Condição para fechar |
|---|---|---|
| Escopo de rotas (`/quem-me-representa` × Assembleias) | **Corrigido** | — |
| Identidade territorial (5.667 entidades, kind 5, município novo) | **Pronto para Fase 0** | data de instalação do município novo a confirmar (não bloqueia) |
| DDL das 21 tabelas, chaves, FKs e intervalos | **Pronto para Fase 0** | revisão de DBA; sem `btree_gist` |
| Aritmética de competência e testes de mesa | **Provado** (7 cenários, asserts passando) | portar para testes automatizados do collector |
| Publicação / rollback / replay | **Especificado**; rollback O(linhas alteradas) | prova em banco isolado (T7 e T5) antes da Fase 1A |
| Retenção do RAW | **Definida por dataset** | HD externo ≥ 40 GiB livres |
| Armazenamento | **Estimado** (3,12 GiB) | medir SP e MG antes de fechar a escala nacional |
| Consultas Q1–Q15 | **Compatíveis com o DDL**; latências são metas | benchmark isolado autorizado |
| Fase 1A–1E | **Não** aprovar agora | depende de nome/coordenadas CNES (DEMAS), definições de especialista e janelas de requisição |
| **Fase 0** | **Pode ser aprovada** | itens 1–5 da seção 12 |
