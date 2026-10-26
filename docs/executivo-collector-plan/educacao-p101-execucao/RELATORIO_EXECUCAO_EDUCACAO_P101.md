# Relatório de execução · P10.1 · Cadastro nacional e identidade histórica das escolas

Data: 2026-10-24 · Banco `projetoeleitor_db`, schema `civica_exec` (migration v9) · RAW e staging em `D:\Civica` · **Sem commit e sem push.** P10.2–P10.10 não iniciadas.

## 1. Resultado
O Cívica tem agora o **cadastro nacional e histórico dos estabelecimentos da Educação Básica, 2007–2025**, em produção: **299.547 escolas distintas (código INEP), 4.272.656 registros escola × edição, 19 edições × 27 UFs = 513 fatias publicadas**, sem nenhuma linha rejeitada. O recorte "em atividade e com matrícula" bate **exatamente** com a Sinopse Estatística do mesmo ano nas 19 edições, no Brasil, nas 27 UFs e em **todos** os municípios × localização × dependência (≈ 1,16 milhão de comparações, 0 divergências). O banco cresceu **554 MB** (previsto: 1,2 GB), o change log não cresceu e o piso de disco nunca foi ameaçado (C: livre mínimo 48,05 GiB; piso 20 GiB). Nada de Saúde, Segurança, Finanças, PNCP ou Legislativo mudou.

## 2. Gates finais
| Gate | Estado | Base |
|---|---|---|
| G0_SAFETY | **PASS** | dump `pre-educacao-p101-20261024.dump` (452 MB, SHA-256 `1417a10d…e1c`) restaurado em cluster isolado: 11/12 contagens idênticas, a 12ª explicada (20 linhas de RAW registradas depois do dump); fingerprints antes/depois; sem locks, sem processos de coleta; nenhum serviço reiniciado |
| G1_SCHEMA_EFFICIENCY | **PASS** | 3 tabelas em vez das 5 propostas; sem tabela de nomes, sem jsonb, sem indicadores duplicados (`MODELO_IDENTIDADE_ESCOLAR.md`); 125 B por snapshot |
| G2_MIGRATION_VALIDATION | **PASS** | v9 aplicada, repetida (`[]`), revertida e reaplicada em cópia restaurada de produção; constraints, FK adiada, 6 testes de integração |
| G3_CENSO_2025_RECONCILIATION | **PASS** | 214.192 = 178.766 + 1.774 + 29.780 + 3.872, sem resíduo; igual à Sinopse em Brasil, UFs, municípios (`RECONCILIACAO_CENSO_2025.md`) |
| G4_SCHOOL_IDENTITY_2021_2025 | **PASS** | 1.093.151 snapshots, 239.155 códigos (idêntico à P10), 0 duplicados/rejeitadas; transições e ausências detectadas |
| G5_HISTORICAL_BACKFILL | **PASS_WITH_CAVEATS** | 2007–2020 carregados e reconciliados; ressalvas: 2007–2010 só listam escolas em atividade; 1995–2006 fora do escopo contratado |
| G6_SCHOOL_COVERAGE | **PASS** | `exec_edu_cov` (513 linhas), `exec_raw_manifest` (SHA-256, tamanho, URL, `Last-Modified`), `COBERTURA_ESCOLAS_2007_2025.csv` |
| G7_PRIVACY | **PASS** | 8 colunas lidas, nenhuma coluna pessoal nas tabelas (teste automatizado); `Gestor`/`Docente` de 2025 nunca baixadas; sem contatos |
| G8_COLLECTOR | **PASS_WITH_CAVEATS** | RAW no D: com volume validado, CRC de cada ZIP/tabela, extração em fluxo por edição, publicação transacional por UF × edição; ressalvas: downloads por `fetchRaw` (curl com retomada) e não `HttpGate` (arquivos estáticos, em série, sem API); licença/termos do INEP **não lidos** (ver §6) |
| G9_STORAGE_BUDGET | **PASS** | medido antes e depois de cada edição; projeções P10.2–P10.3 (`CUSTO_REAL_ARMAZENAMENTO.md`) |
| G10_HISTORICAL_RECONCILIATION | **PASS** | 19/19 edições com 0 divergência contra a Sinopse (`RECONCILIACAO_HISTORICA.md`) |
| G11_IDEMPOTENCY_ROLLBACK | **PASS** | replay `NO_CHANGE` (513 fatias, 0 log); retificação com log exato; rollback exato; falha injetada sem rastro (dados reais, cluster isolado) |
| G12_SERVING | **PASS** | 4 funções de leitura, paginação, filtros, 0,5–88 ms (resumo) e ≤ 351 ms (pior lista filtrada) |
| G13_TERRITORIAL_TESTS | **PASS** | 10 municípios + 7 UFs, 17/17 contra a Sinopse |
| G14_REGRESSION | **PASS** | fingerprints: só diferenças autorizadas; `npm test` 482 aprovados, 0 falhas |
| G15_DOWNSTREAM_READINESS | **PASS** | `CONTRATOS_P102_P103.md`: chaves, tabelas, RAW, extrator e reconciliação prontos |

## 3. O que foi implementado
- `packages/db/src/exec/ddl-v9.ts` (migration), `educacao-build.ts` (validação e fatias, puro), `educacao-read.ts` (read models), `specs.ts` (`DATASET.edu_censo = 70`, tableIds 80–82).
- `apps/collector/src/exec/inep-censo.ts` (descoberta de links pela página, download, cópia por Range das tabelas de 2025) e `educacao.ts` (localização no RAW, extração, publicação).
- `scripts/exec/`: `educacao-pilot.ts` (`migrate`, `fetch`, `extract`, `publish`, `measure`), `censo_escola_extract.py`, `inep_member_fetch.py`, `educacao-report.ts`, `educacao-bench.ts`, `educacao-g11.ts`.
- Testes: `tests/unit/educacao-p101.test.ts`, `tests/integration/educacao-p101.test.ts` (registrados no `npm test`).

## 4. Perguntas obrigatórias

**Q1. Escolas distintas em 2007–2025?** **299.547** códigos INEP (`exec_edu_school`); 144.655 constam nas 19 edições; 9.198 em uma só.

**Q2. Escolas na edição 2025?** **214.192** registros no cadastro (`Tabela_Escola_2025_V2`); **178.766** no recorte "em atividade e com matrícula" (o da Sinopse); 180.540 em atividade.

**Q3. Explicação da diferença 214.192 × 178.766 (35.426)?** Comprovada e sem resíduo: **1.774** escolas em atividade sem matrícula na educação básica (sem linha na `Tabela_Matricula`; inclui estabelecimentos só com atividade complementar/AEE), **29.780** paralisadas e **3.872** extintas no ano. O filtro é `TP_SITUACAO_FUNCIONAMENTO = 1` e `QT_MAT_BAS > 0`, e reproduz a Sinopse em todas as UFs e municípios (`RECONCILIACAO_CENSO_2025.md`). Nada foi apagado do cadastro.

**Q4. Escolas ativas e com matrícula por UF e município, no recorte oficial?** Brasil 2025: 178.766 (federal 716, estadual 29.732, municipal 106.572, privada 41.746). Por UF e ano em `COBERTURA_ESCOLAS_2007_2025.csv` (colunas `recorte_ativa_com_matricula` e `sinopse_estabelecimentos`, diferença 0 nas 513 linhas); por município em `getEducationMunicipalitySchools` (5.570 municípios, todos conferidos). Ex.: Vitória 178, Serra 230, São Paulo 7.187.

**Q5. Escolas que mudaram de nome, município ou dependência?** Entre edições consecutivas: **nome 139.403 escolas** (241.153 eventos; muitos são ajustes de grafia, não renomeação institucional), **município 653 escolas** (757 eventos), **dependência 3.243 escolas** (3.472 eventos), localização 4.452 eventos, situação 140.177 eventos. Escolas com mudança de nome, município ou dependência: **140.168** (`transicoes_resumo.json`, `TRANSICOES_ESCOLARES.csv`).

**Q6. Ausentes de alguma edição que reapareceram?** **33.784 escolas** (40.694 eventos de reaparecimento): constam, somem de uma ou mais edições publicadas e voltam. Pela regra do produto, ausência ≠ encerramento. Das 85.355 escolas cuja última edição é anterior a 2025, 72.415 têm a situação "extinta" na última aparição, 3.126 "paralisada" e 9.814 "em atividade" (estas simplesmente deixam de constar: **sem prova de fechamento**).

**Q7. Como funcionam os códigos escolares e suas exceções?** `CO_ENTIDADE`, 8 dígitos (11.000.023–53.088.034), único por edição (0 duplicados em 19 edições); os dois primeiros dígitos coincidem com o código IBGE da UF do município registrado em 100% das escolas de 2025. Exceções observadas: o município e a dependência mudam entre edições (Q5), a escola some e volta (Q6), e 2007–2010 só listam escolas em atividade. Não foi comprovado nem refutado o reaproveitamento de código por outra escola (exigiria o histórico oficial de fusões).

**Q8. Adaptações nos layouts 2007–2020?** Poucas, porque o INEP republicou 2007–2024 já na nomenclatura atual (mesmas oito colunas em todas as edições; 370 colunas até 2021, 385 em 2022, 408 em 2023, 426 em 2024). Adaptações de **leitura**: situação sempre 1 em 2007–2010; matrícula `0` (2011–2020), vazia (2021–2024) ou sem linha (2025) = sem matrícula; 110 escolas ativas de 2007 com matrícula vazia; 2025 em tabelas (Escola + Matrícula por Range). A quebra de 2019 afeta infraestrutura, não o cadastro.

**Q9. Linhas brutas por ano?** 2007 198.507 · 2008 205.699 · 2009 203.455 · 2010 200.876 · 2011 242.147 · 2012 242.136 · 2013 242.680 · 2014 242.929 · 2015 237.879 · 2016 237.506 · 2017 236.481 · 2018 236.460 · 2019 228.521 · 2020 224.229 · 2021 221.140 · 2022 224.649 · 2023 217.625 · 2024 215.545 · 2025 214.192 (total 4.272.656; rejeitadas: 0).

**Q10. Snapshots publicados?** **4.272.656** em 513 fatias (UF × edição), mais 299.547 identidades e 513 linhas de cobertura.

**Q11. Cobertura por ano?** **Completa e reconciliada com a Sinopse** em todas as 19 edições (0 divergência), com a ressalva de que 2007–2010 listam só escolas em atividade (paralisadas/extintas só aparecem de 2011 em diante). Nenhum ano parcial ou não validado dentro de 2007–2025. 1995–2006 fora do escopo.

**Q12. Quanto o banco cresceu?** **+554,1 MB** (24,764 → 25,318 GB); `civica_exec` +554,0 MB.

**Q13. Tabelas, índices e change log?** Tabelas **364,1 MB**, índices **189,2 MB**, change log **0** (carga inicial sem log; 16.161.837 linhas antes e depois).

**Q14. Pico de WAL e mínimo de C: livre?** WAL gerado: 1,62 GB no total (71–148 MB por edição, média 85); **pico da pasta `pg_wal`: 856 MB** (limite 1 GB). **Mínimo de C: livre observado: 48,05 GiB** (piso exigido 20 GiB).

**Q15. O replay resultou em `NO_CHANGE`?** Sim: 513 fatias de produção (0 novos runs, 0 linhas de log) e, no cluster isolado, replay do mesmo arquivo `NO_CHANGE` com estado idêntico.

**Q16. Rollback testado?** Sim, com dados reais (ES 2025) no cluster isolado: retificação de 10 linhas revertida com hash idêntico ao anterior. Em produção, as cargas iniciais são `bootstrap` (sem log): rollback exato só vale para retificações; a recuperação da carga inicial é o replay a partir do RAW.

**Q17. Regressão?** Nenhuma: fingerprints iguais em Saúde, Segurança P9.1–P9.6, Finanças, PNCP, território e schema do Legislativo; só mudaram migrations (+v9) e publicações (+513 do dataset 70). `npm test`: 0 falhas (30 testes ignorados do Legislativo que exigem `DB_*`/SQLite, preexistentes).

**Q18. Os read models respondem rápido?** Sim: escola por código ou histórico 0,5–0,7 ms; município 2–88 ms (São Paulo, 7.905 escolas); UF (resumo) 2–63 ms; pior lista filtrada com busca por nome 351 ms (MG).

**Q19. Custo real por escola, snapshot e ano?** 124,8 B por snapshot (escola × edição; heap 82,7 + índice 42,1); 67,4 B por escola distinta; 29,1 MB por edição (22,6–39,1 MB); ≈ 125 B por escola por ano. WAL ≈ 2,9× os dados.

**Q20. O orçamento progressivo continua viável?** Sim: o cadastro consumiu 0,55 GB (11% da meta de 5 GB). P10.1–P10.3 projetado em 3,1 GB (provável), 1,6 GB (conservador) e 6,3 GB (pessimista, 1,3 GB acima da meta, mas longe do piso de disco).

**Q21. O que a P10.2 pode implementar sem nova investigação?** Migration v10 `exec_edu_school_offer_year` com FK para `exec_edu_school`, extração da matrícula/turma por escola (CSV único 2007–2024; `Tabela_Matricula` e `Tabela_Turma` de 2025 por Range), agregação territorial por SQL e reconciliação com a Sinopse 1.x e com o bit0 já publicado (`CONTRATOS_P102_P103.md` §2).

**Q22. O que a P10.3 já reutiliza?** A chave `inep`, o par `(inep, year)`, `exec_edu_cov` para cobertura, o RAW em D:, o extrator com whitelist, a fatia UF × edição e a regra "vazio ≠ zero"; falta só a migration da infraestrutura/docentes e o mapa da quebra de 2019.

**Q23. Algum atributo pessoal foi armazenado?** **Não.** Colunas gravadas: `inep`, `year`, `entity_id`, `name` (nome oficial da escola), `dep`, `loc`, `sit`, `flags`; consulta ao catálogo: 0 colunas com nome de gestor/CPF/e-mail/telefone/endereço/CEP/coordenadas; o extrator lê só 8 colunas; `Gestor` e `Docente` de 2025 nunca foram baixadas. O RAW de 2007–2024 (ZIP oficial inteiro) contém colunas de endereço, telefone e CNPJ **da escola** que não são lidas nem gravadas no banco.

**Q24. Estado final e limitações?** Ver §2: 14 PASS e 2 PASS_WITH_CAVEATS (G5, G8), nenhum PARTIAL/FAIL. Limitações: §6.

## 5. Evidências e reprodução
`evidencias/` (fingerprints, estatísticas por edição, Sinopse extraída por ano, reconciliação, G11, medições de armazenamento, saída do `npm test`, log da restauração) e `reproducibilidade/` (ver `README.md`). Reexecução: `educacao-pilot.ts fetch|migrate|publish|measure`, `educacao-report.ts`, `educacao-bench.ts`.

## 6. Limitações e pendências
1. **Licença e termos de uso do INEP não foram lidos** (o ZIP de 2025 traz parecer jurídico e RIP; a P10 já registrara essa obrigação). Os dados estão só no banco; **a leitura dos termos deve acontecer antes de expor nomes de escolas em página pública**.
2. 2007–2010 listam apenas escolas em atividade; a ausência nesses anos não informa situação. 1995–2006 fora do escopo.
3. Não há tabela oficial de fusões/refundações de escolas: o código INEP é tratado como identidade estável, sem prova de que nunca foi reaproveitado.
4. A carga inicial não tem change log (decisão de custo): a recuperação é por replay a partir do RAW, preservado com SHA-256.
5. Busca por nome em lista estadual é varredura da fatia (≤ 351 ms no pior caso).
6. Nada foi construído no frontend; P10.2–P10.10 não foram iniciadas.
7. Cluster de teste `D:\Civica\pgtest_edu` removido ao final; backup `pre-educacao-p101-20261024.dump` mantido em `D:\Civica\backups`.
