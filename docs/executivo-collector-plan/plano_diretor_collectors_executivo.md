# Plano diretor de implementação dos collectors do Poder Executivo

Medições do PostgreSQL feitas em 2026-10-13, somente leitura. Nada foi implementado, migrado, coletado em massa ou alterado.

## 1. Resultado executivo

| Pergunta | Resultado |
|---|---|
| Quantas fontes únicas? | **85** fontes canônicas (de 172 fontes brutas listadas em P0–P7, deduplicadas); evidências: VERIFIED_API 25, VERIFIED_DATASET 40, DOCUMENTED_ONLY 20; prontidão: READY_FOR_CONTRACT 39, NEEDS_VALIDATION 31, DISCOVERY_ONLY 12, BLOCKED 3 (medido) |
| Quantos datasets? | **113** datasets com contrato individual (100 estimados no cenário B, 10 NOT_ESTIMATED, 3 fora do B por serem só C) (medido) |
| Quantos collectors novos? | **52** novos (planejado), mais 1 collector de fundação; 3 reutilizados/existentes (Emendas Pix; SAPL parcial; TSE parcial) |
| Quantos collectors reutilizados? | **3** collectors no plano apontam para código existente sem reescrita (EXISTENTE-PIX, EXEC-C10 estende elections.ts, EXEC-C61 reaproveita state/providers/sapl) além do framework core/* (medido no repositório) |
| Quantas tabelas novas? | **120** (≈ 112 tabelas de dataset + 9 tabelas de identidade/proveniência) (proposto) |
| Quanto ocupa o PostgreSQL hoje? | **14,97 GiB** (16.077.065.363 B), 216 tabelas, 15.976.931 linhas; heap 8,12 GiB, índices 4,38 GiB, TOAST 2,45 GiB (medido) |
| Quantos GB adicionais para o backfill? | **A 14,18 GB; B 192,7 GB (recomendado); C 578,8 GB** no PostgreSQL (estimado). Faixa indicativa de B: 98,78–380,4 GB |
| Quantos GB adicionais por ano? | A 1,88 GB; **B 25,00 GB**; C 99,48 GB (estimado) |
| Quanto após 5 anos? | Banco total (atual + backfill + 5 anos): A 38,57 GB; **B 332,7 GB**; C 1.091,2 GB (estimado; legislativo atual não cresce no modelo) |
| Quanto ficaria fora do PostgreSQL? | Object storage (RAW, comprimido): A 54,99 GB; **B 515,7 GB**; C 1.056,8 GB, +62,35 GB/ano em B (estimado) |
| Qual domínio mais consome espaço? | **Finanças subnacionais** (TCEs e estados): 110,9 GB de 192,7 GB (58%) |
| Qual fonte mais consome espaço? | **TCE-RS** (empenhos): 49,34 GB; seguida por TCE-SP 25,51 GB e SIH-DATASUS 14,07 GB |
| Qual onda deve começar primeiro? | **Onda 1** (identidade + núcleo federal): custa 11,81 GB, tem evidência alta, destrava todas as demais e inclui atos, vetos, ministros e roster eleitoral já provados |


Distribuição de confiança do cenário B: HIGH: 9,45 GB em 8 datasets; LOW: 94,60 GB em 63 datasets; MEDIUM: 88,67 GB em 29 datasets. Por isso a estimativa deve ser lida como ordem de grandeza com faixa, não como valor contratual.

## 2. Leitura realizada e regra de precedência

| Arquivo | Linhas (md) |
|---|---|
| investigacao_executivo_nacional.md | 471 |
| investigacao_executivo_fontes.json | JSON |
| investigacao_executivo_p1.md | 477 |
| investigacao_executivo_p1_fontes.json | JSON |
| investigacao_executivo_p2_inqueritos.md | 542 |
| investigacao_executivo_p2_inqueritos_fontes.json | JSON |
| investigacao_executivo_p3.md | 692 |
| investigacao_executivo_p3_fontes.json | JSON |
| investigacao_executivo_p4.md | 350 |
| investigacao_executivo_p4_fontes.json | JSON |
| investigacao_executivo_p5.md | 435 |
| investigacao_executivo_p5_fontes.json | JSON |
| investigacao_executivo_p6.md | 434 |
| investigacao_executivo_p6_fontes.json | JSON |
| investigacao_executivo_p7.md | 583 |
| investigacao_executivo_p7_fontes.json | JSON |

Todos os 16 arquivos foram localizados na raiz do repositório. **O inventário de Saúde P1–P7 não existe no repositório** (busca por nome e conteúdo); as fontes de saúde vêm de P0, P1, P3 e P4. Precedência aplicada: P7 sobre P5/P6 (ex.: eleito ≠ titular; DEC-n + DEC-sn = 628 em 2013; DF fora dos 5.570; AM não renunciou); P4 sobre P3 (SIH DEMAS NOT_FEASIBLE para totais; coberturas de TCE por UF). Descobertas não revisadas foram mantidas (ex.: SIAPE ~778 mil vínculos/mês, PDDE 247.863 linhas, Censo 468.099 setores).

## 3. Arquitetura existente

**Monorepo**: `apps/collector` (CLI e framework), `apps/web` (Next.js: rotas `legislativo`, `parlamentares`, `proposicoes`, `comissoes`, `comparar`, `quem-me-representa`; sem rotas do Executivo), `packages/db` (51 módulos de leitura/escrita e migrations), `packages/domain`. **Framework de collectors** (`apps/collector/src/core`): `CollectorProvider/Manifest`, runtime com lock advisory, retry, observabilidade (`run_metrics`), contrato de revisão (stage → validate → publish → NO_OP/PUBLISH), `publication-lifecycle`, checkpoints e `--resume/--dry-run/--force`, registry nacional de finanças das 27 Casas, control-plane com scheduler (`civica_ops`), transporte HTTP institucional com hosts oficiais, limite de bytes e timeout (`institutional-http.ts`).

**Padrão de dados**: fatos imutáveis + publicação ativa por revisão; tabelas `civica_state.*` carregam `revision_id` na chave primária, de modo que cada revisão publicada pode manter linhas próprias. Medido: `civica_state.proposals` tem 2.135.609 linhas para 1.058.480 propostas distintas (2,0×), `expenses` 425.000 para 161.897 (2,6×) e `movements` praticamente sem repetição. O plano evita esse custo nos datasets novos (upsert por chave natural + versão apenas onde há mudança).

### 3.1 Inventário dos collectors existentes

| Collector | Caminho | Fonte | Entidades | Granularidade | Histórico | Frequência | Banco | Dependências | Reutilização | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| collect, collect-activity, collect-complement, collect-votes, collect-presence, collect-expenses | apps/collector/src/{collect,activity,complement,votes,presence,expenses}.ts | Câmara e Senado (cadastro, produção, votações, presença, CEAP/CEAPS) | parlamentar, proposição, voto, presença, despesa | parlamentar × item | 2001–2026 (conforme domínio) | sob demanda/agendada | civica.people/profiles/mandates/legislative_votes/attendance/expenses | ingestion_runs, raw_objects | framework (raw→normalizado→publicação ativa) | Operacional |
| collect-camara-propositions/presented/principals/tramitacoes, collect-senado-presented, collect-senate-processes, proposition-enrichment | apps/collector/src/camara-*.ts, senate-processes.ts, proposition-enrichment.ts, postgres-*-presented.ts | APIs Câmara/Senado | proposição, autoria, tramitação, grafo | proposição × evento | 2001–2026 | diária/sob demanda | civica.proposals, civica_poc.proposals/proposal_authors, civica_state.proposals | grafo de proposições (packages/db/src/postgres-proposition-graph.ts) | reuso direto para iniciativa do Executivo | Operacional |
| collect-camara-agenda, collect-senate-agenda, collect-house-operations(-pg) | apps/collector/src/{camara-agenda,senate-agenda,house-operations,postgres-house-operations}.ts | agendas, comissões | reunião, pauta, comissão | reunião | corrente + histórico | diária | civica_committees_poc.* | - | padrão de agenda (não é agenda do Executivo) | Operacional |
| collect-camara-staff, collect-senate-staff, collect-camara-budget | apps/collector/src/{camara-cabinet,senate-staff}.ts | gabinetes, pessoal, orçamento legislativo | vínculo, folha, orçamento | vínculo × mês | 2026 + histórico parcial | mensal | civica.functional_staff_assignments, civica_budget.* | - | padrão para folha agregada (pseudonimização) | Operacional |
| collect-chamber-procurement/contract-details/financial-*, collect-senate-procurement/contract-details/financial-*, collect-institutional-suppliers, sync-institutional-suppliers, collect-pncp-enrichment | apps/collector/src/{chamber,senate}-*.ts, institutional-*.ts, pncp-enrichment.ts | portais da Câmara e do Senado, PNCP | licitação, contrato, item, empenho, fornecedor | contrato × item | 2001–2026 (Câmara) | sob demanda | civica_finance_poc.* (suppliers 34.606; contratos 4.807) | checkpoints --resume | base para fornecedor canônico e PNCP do Executivo | Operacional (Legislativo) |
| collect-price-index, collect-themes | apps/collector/src/{price-index,themes}.ts | IBGE IPCA | índice de preços | mês | 1994–2026 | mensal | civica_elections_poc.price_index_* | - | deflator de valores | Operacional |
| TSE parlamentar (elections.ts) | apps/collector/src/elections.ts | TSE consulta_cand (relevant() limita a senador/deputado federal) | candidatura, bens, prestação de contas | candidatura | 2018–2022 | por eleição | civica.candidacies (39.730), electoral_assets (144.666) | - | estender relevant() para cargos 1–4 e 11–12 | Parcial (só parlamentares) |
| Emendas Pix (postgres-pix-*) | apps/collector/src/postgres-pix-{identity,portal,run,transferegov}.ts | Transferegov especiais | plano de ação, executor, funções | plano × função | 2020–2026 | semanal | civica_budget.special_action_plans (57.827), special_plan_functions (227.928) | identidade PIX | reuso integral | Operacional |
| 27 Assembleias (state/providers + control-plane) | apps/collector/src/state/** e core/control-plane/* | ALs (SAPL, ales, alep, alap, almg, alesp, cldf...) | roster, proposições, autoria, despesas (CEAP), pessoal, orçamento | proposição × evento; despesa × item | 2013–2026 (variável) | registry/scheduler (civica_ops) | civica_state.* (11,7 GB), civica_state_budget.* | revisions, active_publications, checkpoints, coverage_manifests | proposições: 24 operacionais + RS parcial + AM/PB bloqueadas; pessoal: 6 operacionais; orçamento: 15 operacionais, 6 parciais, 3+3 bloqueadas | Operacional/parcial (Legislativo) |
| core/* (CollectorProvider, runtime, revision, publication-lifecycle, scheduler, lock, retry, observability) | apps/collector/src/core/** | framework | - | - | - | - | civica_ops.*, civica_*.ingestion_runs/revisions | advisory locks, reconciliation | infraestrutura reutilizável para todos os collectors novos | Operacional |
| Collectors do Executivo (IBGE, Siconfi, SIORG, SIAPE, DOU, TCEs, DATASUS, INEP...) | — | — | — | — | — | — | — | — | nenhum encontrado em apps/collector/src nem packages/db/src (busca por siorg, siape, planalto, leiturajornal, siconfi, ibge, datasus, cnes, inep, tce, pncp, transferegov: só matches legislativos, PIX e IPCA) | Não implementado |


**Conclusão**: nenhum collector do Executivo está implementado. O que existe e deve ser reutilizado: framework `core/*`, `institutional-http.ts`, `elections.ts` (precisa estender `relevant()`), `portrait-mirror.ts`, o provedor SAPL de Assembleias, `pncp-enrichment.ts`, os collectors de Emendas Pix e a base de fornecedores institucionais. Generalização sem duplicar infraestrutura: um `ExecProvider` por fonte sobre o mesmo `CollectorProvider`, com registry próprio (`EXEC_REGISTRY`, análogo a `NATIONAL_FINANCE_REGISTRY`) e as mesmas garantias de revisão, lock e checkpoint.

## 4. Auditoria do PostgreSQL (somente leitura)

Medido em 2026-10-13 com `pg_database_size`, `pg_total_relation_size`, `pg_relation_size`, `pg_indexes_size`, `pg_stat_user_tables`, `pg_stats` e `count(*)` exato nas 118 tabelas sem `n_live_tup`. Nenhum DDL, VACUUM, REINDEX ou configuração foi alterado.

| Métrica | Valor |
|---|---|
| BASELINE_POSTGRES_GB | 14,973 (pg_database_size = 16.077.065.363 B) |
| BASELINE_TABLES_GB | 8,124 (heap) |
| BASELINE_INDEXES_GB | 4,382 |
| BASELINE_TOAST_GB | 2,447 |
| BASELINE_ROW_COUNTS | 15.976.931 em 216 tabelas |
| BASELINE_MEASUREMENT_DATE | 2026-10-13 |


Observação: a soma de heap + índices + TOAST das tabelas (14,96 GiB) fecha com o tamanho do banco (14,97 GiB) dentro de 0,1%.

Por schema (GB): civica_state 10.888; civica 1.7; civica_votes_presence_poc 0.829; civica_finance_poc 0.717; civica_poc 0.365; civica_budget 0.171; civica_state_budget 0.134; civica_elections_poc 0.119; civica_committees_poc 0.026; civica_people_poc 0.008; civica_media 0.001; civica_national 0.001; civica_state_story 0.0; civica_ops 0.0. Os cinco schemas `*_poc` (civica_poc, civica_votes_presence_poc, civica_finance_poc, civica_elections_poc, civica_committees_poc, civica_people_poc) somam ~2,2 GB e duplicam tabelas de `civica.*` (ex.: `expenses` 484.664 linhas nos dois); são candidatos a retirada futura e **não** entram em nenhuma conta de economia deste plano.

### 4.1 Maiores tabelas

| Tabela | Linhas | Total (MB) | Heap | Índices | TOAST | B/linha total |
|---|---|---|---|---|---|---|
| civica_state.proposal_authors | 2.369.783 | 2.538 | 1.390 | 1.148 | 0 | 1.123 |
| civica_state.raw_objects | 66.421 | 2.526 | 35 | 17 | 2.474 | 39.873 |
| civica_state.proposals | 2.134.398 | 2.117 | 1.057 | 1.058 | 1 | 1.040 |
| civica_state.movements | 1.277.488 | 1.780 | 1.292 | 485 | 3 | 1.461 |
| civica_state.state_proposal_events | 624.191 | 900 | 561 | 338 | 0 | 1.511 |
| civica_state.expenses | 425.668 | 745 | 604 | 133 | 9 | 1.836 |
| civica.legislative_votes | 951.761 | 661 | 337 | 324 | 0 | 729 |
| civica_votes_presence_poc.votes | 1.197.471 | 483 | 385 | 98 | 0 | 423 |
| civica.expenses | 484.664 | 301 | 213 | 88 | 0 | 651 |
| civica.attendance | 644.679 | 286 | 201 | 84 | 0 | 465 |
| civica_finance_poc.expenses | 484.664 | 278 | 209 | 69 | 0 | 601 |
| civica_state.state_individual_votes | 231.080 | 245 | 166 | 79 | 0 | 1.111 |
| civica_votes_presence_poc.attendance | 644.679 | 236 | 184 | 52 | 0 | 384 |
| civica_poc.proposals | 86.698 | 170 | 87 | 81 | 3 | 2.056 |
| civica_state.state_office_staff_snapshots | 195.500 | 149 | 112 | 37 | 0 | 800 |


### 4.2 Custo real por linha (heap + proporção de índices + TOAST)

| Família | Tabela | Linhas | Heap B/linha | Índice B/linha | TOAST B/linha | Total B/linha | Tamanho |
|---|---|---|---|---|---|---|---|
| Pessoas | civica.people | 916 | 125 | 116 | 9 | 277 | 0 MB |
| Pessoas (perfil com payload) | civica.profiles | 2.553 | 1.277 | 363 | 1.752 | 3.404 | 8 MB |
| Pessoas (estaduais) | civica_state.persons | 5.747 | 741 | 181 | 1 | 929 | 5 MB |
| Mandatos | civica.mandates | 6.106 | 546 | 173 | 1 | 726 | 4 MB |
| Exercício | civica.exercise_periods | 7.501 | 811 | 299 | 1 | 1.116 | 8 MB |
| Proposições | civica.proposals | 89.166 | 396 | 137 | 0 | 534 | 45 MB |
| Proposições (com revisões) | civica_state.proposals | 2.134.398 | 519 | 520 | 1 | 1.040 | 2.117 MB |
| Eventos (tramitação) | civica_state.movements | 1.277.488 | 1.060 | 398 | 3 | 1.461 | 1.780 MB |
| Eventos | civica_state.state_proposal_events | 624.191 | 943 | 568 | 0 | 1.511 | 900 MB |
| Contratos (raw) | civica_finance_poc.institutional_contracts_raw | 4.807 | 1.229 | 0 | 5 | 1.241 | 6 MB |
| Fornecedores | civica_finance_poc.suppliers | 34.606 | 172 | 0 | 0 | 174 | 6 MB |
| Fornecedores (nomes) | civica_finance_poc.supplier_names | 39.201 | 271 | 0 | 0 | 272 | 10 MB |
| Pagamentos/despesas | civica.expenses | 484.664 | 461 | 189 | 0 | 651 | 301 MB |
| Pagamentos (com revisões) | civica_state.expenses | 425.668 | 1.487 | 327 | 22 | 1.836 | 745 MB |
| Relacionamentos | civica_state.proposal_authors | 2.369.783 | 615 | 508 | 0 | 1.123 | 2.538 MB |
| Relacionamentos (links) | civica_finance_poc.expense_supplier_links | 224.865 | 374 | 0 | 0 | 374 | 80 MB |
| Documentos (raw no PG) | civica_state.raw_objects | 66.421 | 552 | 263 | 39.057 | 39.873 | 2.526 MB |
| Snapshots | civica_state.state_office_staff_snapshots | 195.500 | 603 | 196 | 0 | 800 | 149 MB |
| Snapshots (folha) | civica_state.state_office_payroll_snapshots | 54.862 | 499 | 185 | 0 | 685 | 36 MB |


Fórmula de heap validada contra civica_state.movements (avg_width 973 B -> 1.070 B previstos; 1.060 B medidos). Índices usam largura de chave por coluna; a chave composta com texto longo das tabelas atuais (revision_id,house,provider,external_id,...) mede 260-510 B/linha de índice; as tabelas novas propostas usam chaves inteiras/curtas. Parâmetros: header de tupla 24 B, null bitmap, alinhamento 8 B, 4 B de ItemId, 24 B de cabeçalho por página de 8 KiB, fillfactor 100 no heap e 90 nas folhas de B-tree, TOAST com compressão pglz (~0,45 para texto/JSON). `raw_objects` mostra o custo de guardar documentos no PostgreSQL: 39.873 B/linha, dos quais 37,4 KB em TOAST (2,47 GB para 66.421 documentos): é o argumento para mover RAW do Executivo para object storage.

### 4.3 Configuração observada (relevante para a carga)

`shared_buffers` 1 GiB, `effective_cache_size` 4 GiB, `work_mem` 32 MiB, `maintenance_work_mem` 64 MiB, `max_wal_size` 1 GiB, `wal_level=replica`, `wal_compression=off`, `autovacuum=on`; extensões `pg_trgm`, `unaccent`; sem PostGIS. Estes valores atendem 15 GB; não atendem a cargas de dezenas de milhões de linhas (seção 11). **Nada foi alterado.**

## 5. Catálogo unificado de fontes

`catalogo_fontes_collectors.json` lista 85 fontes canônicas, 113 datasets e 55 collectors, com instituição, URL, endpoints, esfera, cobertura territorial, período, atualização, chaves, evidência, prontidão, limitações, volume, estratégia e collector. Regras: uma fonte pode ter vários datasets (ex.: CNES → estabelecimentos, leitos, equipamentos, profissionais, serviços e vínculo espacial; PT viagens → viagem, pagamento, trecho, passagem); DATASUS não é um collector (SIH, SIA, SIM, SINASC e PNI têm contratos separados); disponibilidade de endpoint não é tratada como cobertura comprovada (ex.: TCE-PE verificado em P4 e inalcançável em P7; SIGPub lista clientes mas não histórico).

| Esfera | Fontes |
|---|---|
| NACIONAL | 31 |
| FEDERAL | 21 |
| MUNICIPAL | 13 |
| MULTI | 13 |
| ESTADUAL | 4 |
| ESTADUAL+MUNICIPAL | 1 |
| MUNICIPAL+ESTADUAL | 1 |
| LEGISLATIVO | 1 |


## 6. Arquitetura alvo

**Schema novo `civica_exec`** (não toca `civica.*`): tabelas de identidade (`exec_entity`, `exec_body`, `exec_person`, `exec_supplier`, `exec_office`, `exec_holding_period`, `exec_holding_event`, `exec_provenance`, `exec_ingestion_run`) e uma tabela por dataset. **Chaves**: inteiros e códigos curtos (IBGE 7, CNES 7, CO_ENTIDADE 8, SQ_CANDIDATO 11, hash de título 16 B, CNPJ 14); o `revision_id` textual das tabelas atuais não é replicado nas chaves (custo de 260–510 B de índice por linha medido). **Temporalidade** em toda relação mutável: `valid_from`, `valid_to`, `published_on`, `effective_on`, `source_id`, `confidence`, `end_reason`, `evidence_ref` (contrato P6/P7); mandato e exercício continuam separados e o exercício é derivado de eventos.

**Camadas** (calculadas na seção 4 de `projecao_armazenamento_executivo.md`): RAW em object storage com hash e URL de origem (ZIP/CSV/PDF/JSON) — nada de arquivos de GB em `bytea`; NORMALIZED no PostgreSQL com chaves naturais, upsert idempotente e versão somente quando o atributo muda; SERVING com materializações pequenas para o frontend (≈5–8% do normalizado por domínio) e agregações sob demanda.

**Particionamento**: tabelas de eventos (TCE-RS/SP/PE/ES, estados, SIH, viagens-pagamentos) particionadas por ano (RANGE) e, quando possível, por ente; índice primário curto + BRIN em data; DROP PARTITION como rollback. **PostGIS** apenas se for aprovado (geometria simplificada em A/B; resolução total em C).

**Privacidade e retenção**: sem CPF em claro (descartar no parsing; TCE-RS expõe CPF em 9% das linhas), título eleitoral só em hash, vínculos profissionais e servidores pseudonimizados, AIH em camada interna sem identificação, texto livre de manifestações não armazenado, sigilo de CPGF preservado e rotulado; RAW retido enquanto a fonte não garantir histórico (estoque BNAFAR) e por 24 meses para fontes reproduzíveis.

## 7. Famílias de collectors (55 no plano)

| Família | Collectors |
|---|---|
| Fundação | EXEC-C00, C01, C02, C03 |
| Política e atos federais | C08, C10, C50, C51, C52, C53 |
| Viagens, cartões e despesas federais | C54, C55, C62 |
| Indicadores nacionais | C11–C15, C20, C22, C23, C24, C72 |
| Saúde | C21, C30–C35 |
| Educação | C16, C17, C18, C19, C25 |
| Finanças e contratos | C40–C47 |
| Atos estaduais e municipais | C56–C61 |
| Atendimento e controle | C70, C71, C73, C74, C75 |
| Existente | EXISTENTE-PIX |

Detalhe de cada collector (tabelas, índices, bloqueios, critérios de aceite, estimativa de linhas e GB) em `plano_execucao_collectors.csv`.

## 8. Ondas de implementação (reavaliadas)

**Mudança em relação à hipótese inicial**: os atos federais, vetos, DOU de pessoal, SIAPE de ministros, viagens e CPGF sobem para a Onda 1. Motivos: volume pequeno (poucos GB), evidência alta (840/840 assinaturas, 3 cadeias fechadas), nenhuma dependência de TCE e valor imediato para as perguntas "quem assinou" e "quem foi nomeado". Os adaptadores de atos subnacionais (PDF, uma fonte por UF) descem para a Onda 5; finanças subnacionais ficam na Onda 4 porque dependem do fornecedor canônico (EXEC-C46) e de um mapa UO→camada por município.

### Onda 1: Identidade, infraestrutura e núcleo federal de alta confiança

| Item | Detalhe |
|---|---|
| Resumo (cenário B) | 13 collectors, 39,39 mi linhas, 11,81 GB no PostgreSQL (B), +1,12 GB/ano, 58,60 GB em object storage |
| Collectors | EXEC-C00, C01, C02, C03, C08, C10, C50, C51, C52, C53, C54, C55, C62 |
| Fontes | IBGE localidades, Siconfi /entes, malha IBGE, SIORG, TSE (cand/votação/fotos/planos), Senado legislação+processo, Planalto, Câmara (autoria), DOU leiturajornal, SIAPE (CGU), Portal da Transparência (viagens, CPGF, despesas), atas/diários de posse |
| Dependências | nenhuma externa; C10 depende da tabela IBGE↔SG_UE (C01); C52/C53 dependem de SIORG (C03) |
| Pré-requisitos | decidir schema civica_exec, chaves canônicas, modelo exec_holding_period, object storage e política de PII |
| Entidades | entes, órgãos, pessoas, mandatos, atos, vetos, nomeações, viagens |
| Risco | baixo/médio: volumes pequenos; risco é de modelagem (exercício ≠ mandato) e de identidade (título hash, SG_UE↔IBGE) |
| Cobertura | nacional para eleitos; federal completo; exercício efetivo só onde há evento oficial |
| Critérios de aceite | 5.567/5.518/5.494/5.529 prefeitos reproduzidos; 840/840 assinaturas; 765 vetos; 3 cadeias de ministros; 5.598 entes; nenhuma duplicata de pessoa; sem CPF |
| Rollback | schema versionado; publicação por revisão ativa; rollback = reativar revisão anterior (padrão publication-lifecycle) |
| Validação | reconciliação com totais P5/P6/P7 e com Senado/Planalto |
| Observabilidade | run_metrics por collector, cobertura por fonte em civica_national.metric_coverage |


### Onda 2: Dados estruturados nacionais

| Item | Detalhe |
|---|---|
| Resumo (cenário B) | 13 collectors, 125,06 mi linhas, 20,35 GB no PostgreSQL (B), +1,48 GB/ano, 33,70 GB em object storage |
| Collectors | EXEC-C11, C12, C13, C14, C15, C17, C19, C20, C21, C22, C23, C24, C25 |
| Fontes | Siconfi DCA/RREO/RGF, Censo 2022, SIDRA, MUNIC, INEP Censo Escolar e Ideb, SIOPE/FNDE, SIOPS/SISAB, CNES estabelecimentos, MDS, CAGED/RAIS, Sinesp/SSP/PRF/SISDEPEN |
| Dependências | C01 (entes); C13 antes de C21/C25 (vínculo espacial) |
| Pré-requisitos | Onda 1 concluída; tabela IBGE↔SG_UE; PostGIS ou GeoJSON simplificado decidido |
| Entidades | município, setor, escola, estabelecimento, indicador |
| Risco | médio: muitos adaptadores pequenos; catálogos de indicadores amplos |
| Cobertura | nacional (5.570) com cobertura por fonte registrada |
| Critérios de aceite | DCA reconcilia com Siconfi; 468.099 setores; escolas casam com PDDE (99,99%); CNES ES ≥ 4.000 estabelecimentos |
| Rollback | por revisão e por exercício |
| Validação | totais nacionais publicados pelas fontes |
| Observabilidade | cobertura por ente/ano; alerta de retificação |


### Onda 3: Saúde e educação granulares

| Item | Detalhe |
|---|---|
| Resumo (cenário B) | 8 collectors, 112,28 mi linhas, 19,74 GB no PostgreSQL (B), +3,45 GB/ano, 50,50 GB em object storage |
| Collectors | EXEC-C16, C18, C30, C31, C32, C33, C34, C35 |
| Fontes | CNES (leitos, equipamentos, serviços, profissionais), SIH-RD (DBC), BNAFAR, SIA (piloto), SIM/SINASC/PNI, PDDE |
| Dependências | C21 (CNES), C25 (escolas) |
| Pré-requisitos | contagens nacionais medidas (CNES, SIH, SIA); decisão sobre camada interna de AIH e vínculos |
| Entidades | estabelecimento, leito, equipamento, vínculo pseudonimizado, hospital × residência × procedimento, escola × programa |
| Risco | alto: volume sem amostragem (SIA), DBC, privacidade, falha da fonte PDDE (ORA-01722) |
| Cobertura | saúde e educação nacionais; PDDE com cobertura por UF×ano variável |
| Critérios de aceite | ES T1/2025 reproduz 77.995 AIH e R$ 135,2 mi; ES BNAFAR reproduz 53.999 linhas; PDDE 2023 reproduz 247.863 linhas |
| Rollback | tabelas SCD com versão; descartar revisão |
| Validação | comparação com totais DATASUS/FNDE |
| Observabilidade | taxa de falha por UF×mês; idade do estoque |


### Onda 4: Finanças e contratos subnacionais

| Item | Detalhe |
|---|---|
| Resumo (cenário B) | 8 collectors, 385,12 mi linhas, 116,1 GB no PostgreSQL (B), +15,73 GB/ano, 60,50 GB em object storage |
| Collectors | EXEC-C40, C41, C42, C43, C44, C45, C46, C47 |
| Fontes | TCE-RS, TCE-ES, TCE-SP, TCE-PE, PNCP, Compras.gov, Transferegov/FNS/convênios, RFB CNPJ, CEIS/CNEP, finanças dos Executivos estaduais (ES, MG, RS) |
| Dependências | C46 (fornecedor canônico) antes dos TCEs e do PNCP; C01 |
| Pré-requisitos | regras de eventos por TCE (empenho líquido = empenhado + reforço − anulação); mapa UO→camada; chaves de empenho |
| Entidades | evento de empenho/pagamento, contrato, item, fornecedor, UO |
| Risco | alto: ~60% do volume; históricos não provados; CPF em claro; rate limits; TCE-PE inalcançável |
| Cobertura | municípios de 4 UFs (25,2%) + ES/MG/RS estaduais |
| Critérios de aceite | reconciliação com Siconfi (ES 71/78 dentro de R$ 1; Adamantina; Vitória; Alto Rio Novo ao centavo); PNCP 2,02 mi contratos 2025 |
| Rollback | partições por ano/ente: DROP PARTITION e reprocessar |
| Validação | DCA por ente-ano e totais do PNCP |
| Observabilidade | linhas/dia, duplicatas, falhas por UG, idade da última remessa |


### Onda 5: Atos estaduais e municipais

| Item | Detalhe |
|---|---|
| Resumo (cenário B) | 6 collectors, 17,39 mi linhas, 14,66 GB no PostgreSQL (B), +1,72 GB/ano, 243,0 GB em object storage |
| Collectors | EXEC-C56, C57, C58, C59, C60, C61 |
| Fontes | portais de legislação e DOE de 23 UFs, DIO/ES, DOM/SC, SIGPub (15 portais ativos), FAMEM, SAPL |
| Dependências | C50 (modelo de ato), C01 |
| Pré-requisitos | parser de PDF; política de raw (espelhar vs referenciar); regras de classe de atribuição (SIGNED_BY_PERSON vs PUBLISHED_DURING_TERM) |
| Entidades | ato, signatário, edição, nomeação, norma SAPL, matéria, autoria |
| Risco | alto: PDF, segmentação, sem enumeração histórica no SIGPub, 4 UFs sem documento verificado |
| Cobertura | SC 293; SIGPub 1.942; ES 40+; SAPL ~23%; estaduais 19–23 UFs |
| Critérios de aceite | Blumenau 964 decretos/2024; 2.650 atos na edição de 08/10/2026; cadeia do ES; PI 449/449 normas com matéria |
| Rollback | por edição/ato com hash; descartar lote |
| Validação | contagem de atos por categoria na fonte |
| Observabilidade | atos por edição, taxa de falha de OCR, atos sem signatário |


### Onda 6: Complementares e cobertura parcial

| Item | Detalhe |
|---|---|
| Resumo (cenário B) | 6 collectors, 24,68 mi linhas, 10,07 GB no PostgreSQL (B), +1,45 GB/ano, 69,40 GB em object storage |
| Collectors | EXEC-C70, C71, C72, C73, C74, C75 |
| Fontes | Fala.BR, 156 de capitais, SNIS/ANEEL/Anatel/INPE/S2iD/Senatran, agendas, Querido Diário, TCU |
| Dependências | C01, C03 |
| Pré-requisitos | privacidade (sem texto livre) |
| Entidades | manifestação, indicador, evento geográfico |
| Risco | médio: fontes heterogêneas e sem contagem |
| Cobertura | parcial por desenho |
| Critérios de aceite | 1,56 mi manifestações 2025; séries reconciliam |
| Rollback | por revisão |
| Validação | totais da fonte |
| Observabilidade | cobertura por série |


Detalhe por collector (volume, tabelas, índices, bloqueios) em `plano_execucao_collectors.csv`.

## 9. Estratégia de atualização

| Família | Cadência | Janela de reprocesso | Retificação / tombstone | Idempotência | Fonte de verdade |
|---|---|---|---|---|---|
| TSE (roster) | por eleição + diário em ano eleitoral | ciclo inteiro | candidatura substituída = nova linha com `end_reason` | UNIQUE(sq_candidato, election_id) | consulta_cand |
| Atos federais | diária | 30 dias (republicações) | republicação = versão do mesmo ato | UNIQUE(tipo, número, ano) | Planalto/Senado |
| DOU de pessoal | diária por data de publicação | 7 dias (retificações) | retificação referencia o item original | UNIQUE(url_title) | leiturajornal |
| SIAPE | mensal | mês corrente + anterior | linhas legadas aparecem; cruzar com DOU | UNIQUE(mês, órgão, nível) | host CGU |
| Siconfi | por exercício; DCA anual, RREO bimestral | exercício anterior inteiro (retificações) | nova entrega substitui a anterior com `valid_to` | PK(ente, ano, anexo, conta, coluna) | API Siconfi |
| TCEs | mensal (RS: remessa anual com histórico) | 12 meses | anulação/reforço como eventos; duplicatas por partição descartadas (ES 33%) | PK(ente, empenho, seq, tipo) | arquivo do TCE |
| PNCP | diária por data de publicação | 90 dias | retificação = nova versão | UNIQUE(numeroControlePNCP) | API PNCP |
| CNES | mensal | 3 competências | SCD: nova linha só se atributo mudar | PK(cnes, tipo, valid_from) | DEMAS |
| SIH-RD | mensal | 6 meses | DBC reapresentado substitui o mês | PK(cnes, mun_res, proc, mês) | FTP DATASUS |
| BNAFAR | semanal | n/a (sem histórico) | estado corrente + agregado mensal | PK(cnes, catmat, lote) | DEMAS |
| Diários municipais | diária | 7 dias | ato republicado = versão | UNIQUE(portal, edição, ato) | PDF/HTML da edição |
| SAPL | diária | 30 dias | norma alterada = versão | UNIQUE(host, id) | API SAPL |


### 9.1 Snapshots completos vs deltas (4 datasets comparados)

| Dataset | Modelo | Linhas/ano | GB/ano | Linhas backfill | GB backfill |
|---|---|---|---|---|---|
| SAU-BNAFAR-ESTOQUE | snapshot diário completo | 1.222,75 mi | 222,7 | - | - |
| SAU-BNAFAR-ESTOQUE | snapshot semanal completo | 174,20 mi | 31,72 | - | - |
| SAU-BNAFAR-ESTOQUE | delta (88% mudam em ≤7 dias) | 153,30 mi | 27,92 | - | - |
| SAU-BNAFAR-ESTOQUE | corrente + agregado mensal município×CATMAT (RECOMENDADO) | 8,76 mi | 1,34 | - | - |
| SAU-CNES-LEITOS | snapshot mensal completo (13 anos) | 2,28 mi | 0,31 | 29,64 mi | 4,08 |
| SAU-CNES-LEITOS | snapshot anual (dezembro) | 190,0 mil | 0,03 | 2,47 mi | 0,34 |
| SAU-CNES-LEITOS | delta/SCD (RECOMENDADO) | 22,8 mil | 0,00 | 486,4 mil | 0,07 |
| SAU-CNES-EQUIP | snapshot mensal completo (13 anos) | 13,20 mi | 1,82 | 171,60 mi | 23,64 |
| SAU-CNES-EQUIP | snapshot anual (dezembro) | 1,10 mi | 0,15 | 14,30 mi | 1,97 |
| SAU-CNES-EQUIP | delta/SCD (RECOMENDADO) | 165,0 mil | 0,02 | 3,25 mi | 0,45 |
| SAU-CNES-PROF | snapshot mensal completo (13 anos) | 43,20 mi | 7,87 | 561,60 mi | 102,3 |
| SAU-CNES-PROF | snapshot anual (dezembro) | 3,60 mi | 0,66 | 46,80 mi | 8,52 |
| SAU-CNES-PROF | delta/SCD (RECOMENDADO) | 900,0 mil | 0,16 | 15,30 mi | 2,79 |

Decisão: **delta/SCD** para leitos, equipamentos e profissionais (snapshot mensal completo custaria 12× mais por ano); para BNAFAR, como 88,3% das linhas de ES mudam em até 7 dias (medido), o delta é praticamente igual ao snapshot semanal; por isso a recomendação é manter só o estado corrente mais um agregado mensal município × CATMAT, que preserva histórico útil a ~1% do custo do snapshot diário.

## 10. Deduplicação

| Entidade | Sem dedup (linhas) | Canônico (linhas) | Economia (GB) | Base |
|---|---|---|---|---|
| Pessoas | 113.000 | 85.000 | 0,01 | 113 mil candidaturas executivas ↔ ~85 mil pessoas por hash de título (reeleições e candidatos repetidos) |
| Fornecedores | 3.100.000 | 1.400.000 | 0,75 | soma assumida dos credores PJ por fonte (PNCP 0,8 mi, TCE-RS 0,22, TCE-SP 0,45, TCE-ES 0,08, TCE-PE 0,11, federal 0,6, estados 0,25, outros 0,6) vs união com sobreposição 55%; NÃO medido |
| Municípios | 334.260 | 5.571 | 0,06 | um município por fonte (≈60 fontes municipais) vs entidade única |
| Estabelecimentos (SCD) | 51.480.000 | 1.042.800 | 6,95 | estabelecimento por competência mensal (13 anos) vs SCD só com mudanças |

Economia total estimada: **7,77 GB** (já descontada nas estimativas do cenário B, que usa fornecedor canônico, SCD e hash de título). Também: republicações de atos como versões; proposições do SAPL estadual reutilizam `civica_state.proposals`; PNCP e TCE apontam para o mesmo `exec_supplier`. A sobreposição de fornecedores (55%) **não foi medida**.

## 11. Infraestrutura

| Recurso | A | B (recomendado) | C |
|---|---|---|---|
| Banco após backfill (GB) | 29,15 | 207,7 | 593,8 |
| Banco após 1 ano (GB) | 31,03 | 232,7 | 693,2 |
| Folga para vacuum/bloat/reindex (25%) | 7,76 | 58,17 | 173,3 |
| Staging/downloads temporários (GB) | 15 | 50 | 50 |
| WAL gerado durante o backfill (GB, ≈1,2× dados) | 17,01 | 231,3 | 694,5 |
| Backups locais (2 base backups comprimidos 0,45×) (GB) | 27,93 | 209,4 | 623,9 |
| **Disco mínimo para armazenar** (GB) | 53,79 | 340,9 | 916,5 |
| **Disco recomendado** (inclui backups) (GB) | 81,72 | 550,3 | 1.540,4 |
| Object storage RAW (GB) | 54,99 | 515,7 | 1.056,8 |
| RAM mínima / recomendada (GB) | 16 / 32 | 32 / 64 | 64 / 128 |
| CPU mínima / recomendada (vCPU) | 4 / 8 | 8 / 16 | 16 / 32 |

Critério de RAM: o conjunto quente (serving ≈ 9,06 GB + índices das tabelas consultadas) precisa caber em cache; `shared_buffers` ≈ 25% da RAM. Durante o backfill: `max_wal_size` 8–16 GiB, `maintenance_work_mem` ≥ 1 GiB, `wal_compression=on`, COPY em lotes por partição e criação de índices secundários depois da carga. Throughput de ingestão: B tem 703,92 mi linhas; a 20 mil linhas/s ponta a ponta (parsing incluso, premissa) são ≈ 10 h de carga pura, na prática semanas por limites de taxa das fontes. Downloads de maior volume: TCE-RS 14,9 GB (ZIPs 2015–2025), TCE-SP ≈ 85 mil requisições (644 municípios × 12 meses × 11 anos; JSON de 1–5 MB cada, ≈ 100 GB sem compressão), SIH ≈ 13 GB de DBC, SIGPub ≈ 120 GB de PDFs. Preços de provedores **não** foram usados: o ambiente de produção não é identificável a partir do repositório (apenas o PostgreSQL local de desenvolvimento foi medido).

## 12. Cobertura realista

| Frente | Cobertura comprovada | Limite |
|---|---|---|
| Roster eleitoral | 5,5 mil prefeitos/ciclo; 100% de fotos 2020/2024 | exercício efetivo só por evento oficial |
| Atos federais | 100% da lista; 840/840 assinaturas | DOU de pessoal por data; INLABS opcional |
| Finanças municipais por credor | 4 UFs = 1.403 municípios (25,2%) | MG, PR, SC, GO, RJ, CE, BA só documentados |
| Finanças estaduais | ES, MG, RS verificados; BA agregado | 23 UFs sem contagem |
| Diários municipais | 48,5% por portal (2.699 municípios); 53,5% sem verificação de edição | 2685 municípios sem fonte |
| Legislação municipal por API | 22,7% dos municípios amostrados (SAPL) | cadeia projeto→lei em ~1/3 das instâncias |
| Saúde | CNES/SIH/BNAFAR com prova no ES; nacional por escala | SIA, SISVAN, SISAGUA sem amostragem |
| Educação | PDDE 2023 em 27 UFs; 2024–2025 falham em 22–25 UFs | Censo sem coordenadas |
| Segurança | Sinesp por município; 5 SSPs | inquérito por unidade só agregado |


## 13. Riscos e dependências externas

1) Histórico de TCE-RS/SP/PE não provado além de 2025 (afeta ~60% do volume); 2) TCE-PE inalcançável na P7; 3) SIGPub sem enumeração histórica; 4) INLABS é opcional agora, DOEM bloqueado; 5) base legal para servidores e profissionais de saúde; 6) PDDE falha por UF×ano na fonte; 7) tabelas IBGE↔SG_UE e SIAFI↔SIORG inexistentes; 8) CNES/SIH nacionais sem medição; 9) decisão de ambiente de produção e object storage; 10) modelo de exercício (exercise_periods exige perfil parlamentar).

## 14. Gates

| Gate | Estado | Evidência | Limitação | Risco | Próxima ação |
|---|---|---|---|---|---|
| EXEC_COLLECTOR_SOURCE_CATALOG | PASS_WITH_CAVEATS | 85 fontes canônicas consolidadas de P0–P7 (16 arquivos lidos) com 113 datasets; evidências: VERIFIED_API 25, VERIFIED_DATASET 40, DOCUMENTED_ONLY 20 | inventário de Saúde P1–P7 não existe no repositório; contagens de fontes só documentadas ficam NOT_ESTIMATED | médio | obter o inventário de Saúde, se existir fora do repositório, e reconciliar IDs |
| EXEC_COLLECTOR_EXISTING_INFRASTRUCTURE | PASS | apps/collector/src (core, state, CLI), packages/db/src e control-plane inspecionados; nenhum collector do Executivo operacional; reuso mapeado (core/*, state/providers/sapl, institutional-http, elections.ts, portrait-mirror, pix, pncp-enrichment) | código lido, não executado | baixo | validar contratos de CollectorProvider ao implementar a Onda 1 |
| EXEC_POSTGRES_BASELINE | PASS | medido em 2026-10-13, só leitura: 16,077,065,363 B (14.97 GiB), 216 tabelas, 15,976,931 linhas | n_live_tup inexistente em 118 tabelas: contagem exata por count(*); bloat não medido (sem pgstattuple) | baixo | repetir a medição antes da Onda 1 |
| EXEC_POSTGRES_ROW_SIZE | PASS_WITH_CAVEATS | custo por linha medido em 10 famílias (pessoas, mandatos, proposições, eventos, despesas/pagamentos, fornecedores, snapshots, documentos); fórmula de heap validada em movements (1.070 previstos vs 1.060 medidos) | tabelas novas usam chaves curtas; tabelas atuais têm chaves compostas de texto (índice 260–510 B/linha) | médio | medir 3 tabelas piloto da Onda 1 e recalibrar |
| EXEC_DATASET_GRANULARITY | PASS_WITH_CAVEATS | 113 datasets na menor unidade útil (empenho/evento, norma, escola × etapa, estabelecimento × versão); nenhum estimado como linha por município sem justificativa | SIA, SIM/SINASC detalhado, DataJud e SISVAN/SISAGUA sem amostragem | médio | amostrar SIA em 3 UFs × 3 meses |
| EXEC_DATASET_HISTORICAL_VOLUME | PARTIAL | âncoras medidas: PNCP (contratos/contratações), Siconfi (DCA/RREO/RGF), TCE-RS 26,9 mi, TCE-ES 942 mil, DOM/SC 5,49 mi, SIAPE, viagens, CPGF, despesas federais, SAPL-PI; 10 datasets NOT_ESTIMATED no cenário B | TCE-SP/PE, SIH nacional, CNES nacional, SIGPub e QD são extrapolações de amostras ou referências externas | alto | medir contagens nacionais de CNES e SIH; TCE-SP por amostra de 30 municípios |
| EXEC_DATASET_ANNUAL_GROWTH | PARTIAL | crescimento anual B = 87,30 mi linhas e 25,00 GB/ano | crescimento de contratos PNCP é exponencial (0,24 → 1,09 → 2,02 mi); tratado como constante em 2026 | médio | revisar anualmente com contagens reais |
| EXEC_STORAGE_ESTIMATION | PASS_WITH_CAVEATS | A=14,18 GB, B=192,7 GB, C=578,8 GB; somas por domínio, esfera e fonte reconciliam ao total; faixa indicativa de B 98,78–380,4 GB | faixa por confiança é heurística, não intervalo estatístico | alto | recalibrar após Onda 1 e após amostras |
| EXEC_INDEX_ESTIMATION | PASS_WITH_CAVEATS | índices calculados por tabela a partir das larguras de chave (B: 52,35 GB; 39% do heap+TOAST, variando de 0% a >100% por tabela) | não mede bloat de índice; BRIN/partição não aplicados no cenário base | médio | comparar com BRIN nas 8 tabelas de eventos |
| EXEC_OBJECT_STORAGE_STRATEGY | PASS_WITH_CAVEATS | RAW fora do PostgreSQL: A 54,99 GB, B 515,7 GB, C 1.056,8 GB; nada volumoso em bytea | custo/serviço de object storage não definido; PDFs de SIGPub/DOM-SC dominam | médio | definir bucket, retenção e hash; decidir se PDFs de municípios são espelhados ou só referenciados |
| EXEC_DEDUPLICATION | PARTIAL | economia estimada 7,77 GB (fornecedores 0,75, estabelecimentos por SCD 6,95, pessoas 0,01) | sobreposição de fornecedores assumida (55%), não medida | médio | medir interseção de credores entre PNCP e 4 TCEs em amostra |
| EXEC_TEMPORAL_MODEL | PASS_WITH_CAVEATS | modelo de mandato/exercício/evento com início, fim, publicação, efeito, fonte, confiança e motivo; incompatibilidades do exercise_periods atual listadas em P7 | exercise_periods exige profiles de parlamentar; precisa de tabela própria | médio | decidir exec_holding_period vs adaptar exercise_periods |
| EXEC_COLLECTOR_DEPENDENCIES | PASS | 55 collectors com dependências explícitas; grafo acíclico verificado | dependência da tabela IBGE↔SG_UE | baixo | construir a tabela na Onda 1 |
| EXEC_COLLECTION_FREQUENCY | PASS_WITH_CAVEATS | cadência, janela, watermark, tombstone e revisão definidas por família; snapshots vs delta comparados para 4 datasets | várias fontes sem política de retificação documentada | médio | testar retificações no PNCP e no Siconfi |
| EXEC_BACKFILL_FEASIBILITY | PARTIAL | backfill factível por ondas; TCE-RS/SP/PE/ES somam ~60% do volume; históricos além de 2025 não verificados para RS, SP e PE | TCE-PE inalcançável na P7; PNCP com rate limit; SIGPub sem enumeração histórica | alto | provar histórico por fonte antes de comprometer a janela de backfill |
| EXEC_OPERATIONAL_COST | PARTIAL | recursos estimados por cenário (disco, RAM, CPU, WAL, staging, backups, rede); B: disco recomendado 550,3 GB | sem preços de provedores; ambiente de produção não identificável no repositório (somente PostgreSQL local de desenvolvimento medido) | médio | definir ambiente de produção e cotar |
| EXEC_IMPLEMENTATION_WAVES | PASS | seis ondas com critérios de aceite, rollback, validação e observabilidade; ordem reavaliada (atos federais sobem para a Onda 1) | esforço de engenharia não estimado | médio | aprovar a ordem e o escopo de B |
| EXEC_COVERAGE_REALISM | PASS_WITH_CAVEATS | cobertura declarada por fonte: TCE de 4 UFs = 25,2% dos municípios; diários 48,5% por portal; SAPL ~23%; saúde/educação nacionais; demais UFs só estaduais com cobertura parcial | cobertura municipal de pagamentos por credor limitada a ES, RS, SP e PE até novos TCEs serem provados | alto | prova de TCE-MG/PR/SC/GO antes de prometer cobertura |
| EXEC_PRIVACY_AND_RETENTION | PASS_WITH_CAVEATS | sem CPF em claro; hash de título; AIH e vínculos profissionais pseudonimizados e em camada interna; texto livre de manifestações excluído; CPGF sigilosa preservada | CPF em claro nas fontes TCE-RS (9%), PE; exige descarte no parsing; base legal para dados de servidores a validar | alto | parecer jurídico sobre servidores e profissionais de saúde |
| EXEC_FINAL_READINESS | PARTIAL | plano executável para Ondas 1–2 (alta confiança); Ondas 3–5 dependem de provas pontuais; B total 192,7 GB + 14,97 GB atuais | estimativa de B tem incerteza concentrada em 6 datasets de despesa e saúde | alto | executar Onda 1 como piloto e recalibrar o modelo de armazenamento |


## 15. Decisões recomendadas

1) Aprovar **cenário B** como principal, em duas fases de compromisso: Ondas 1–3 (51,89 GB) com evidência alta/média; Onda 4 (116,1 GB) só depois de provar histórico de TCE-RS/SP/PE e de decidir a janela de backfill (5 anos reduz B para 141,0 GB). 2) Mover RAW para object storage. 3) Criar `civica_exec` e o fornecedor canônico antes de qualquer TCE. 4) Piloto: Onda 1 inteira + TCE-ES (smallest, evidência alta) para recalibrar o modelo. 5) Retirar os schemas `*_poc` (~2,2 GB) após validação, fora deste plano.

## 16. Validação final deste plano

| Verificação | Resultado |
|---|---|
| Nenhum collector implementado, nenhuma migration, banco e produção inalterados | confirmado: só SELECTs read-only; arquivos criados somente em docs/executivo-collector-plan/ |
| JSONs e CSVs válidos | validados por parsing (seção de validação do resumo final) |
| Soma por domínio = soma por esfera = soma por fonte = total, em A, B e C | conferido por asserção (tolerância 1e-6 GB) |
| Nenhuma fonte duplicada; dataset único por ID | 113 IDs únicos; 85 fontes canônicas |
| Estimativas não recontam dados existentes | Emendas Pix (57.827 planos, já no banco) entra com 0 linhas de backfill e só crescimento; legislativo existente fica no baseline |
| Desconhecidos não viram zero | 10 datasets NOT_ESTIMATED no B (POL-AGENDAS, FIN-SICONFI-MSC, FIN-TCMSP-CAPITAL, FIN-TCE-OUTROS, FIN-ESTADO-OUTROS, SAU-SIA-AGREG, SAU-OUTROS, SEG-DATAJUD-AGREG, SOC-OUTROS, ATD-156-CIDADES); excluídos de A/B marcados como EXCLUDED |
| Disco lógico vs físico | volumes lógicos (linhas, GB de dados) separados de disco (WAL, staging, backups) na seção 11 |

