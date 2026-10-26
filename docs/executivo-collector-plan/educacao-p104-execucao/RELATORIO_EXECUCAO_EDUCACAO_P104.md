# Relatório de execução: Cívica P10.4 (Aprendizagem, Ideb, Saeb e fluxo escolar)

Escrito para: quem decide o que vem depois da P10.4 (P10.5 e a validação jurídica de publicação). Data: 25 e 26/10/2026. **Sem commit e sem push.** Nenhum frontend. P10.5 não iniciada.

## 1. Resultado em uma tela

- **Tudo publicado em produção**: Ideb 2005–2025, Saeb agregado 2017–2025, rendimento 2007–2025, distorção idade-série 2006–2025, transição 2007/2008–2021/2022 e INSE 2019/2021/2023. São **7.961.125 linhas e 207,7 milhões de células**, em 13 tabelas novas e **1.511 fatias** (edição × UF), todas `PUBLISHED` na carga e **todas `NO_CHANGE` no replay**, nenhuma falha.
- **Crescimento do banco: 1,372 GB** (de 27.292.101.779 para 28.664.106.131 B), **27% do limite de 5 GB**, com baseline medido antes da primeira escrita e final medido depois do replay. Change log: **0 linha nova**. WAL medido à parte (2,95 GB de LSN, `pg_wal` fixo em 1,07 GB).
- **Os totais oficiais batem**: o Quadro 1 da Nota Informativa do Ideb 2025 (escolas, municípios por rede, UFs) é reproduzido **exatamente**; 1.389 valores conferidos de forma independente nas planilhas oficiais, **0 divergências**; ~43,6 milhões de somas de 100% (rendimento e transição), **0 fora da tolerância**.
- **Ondas anteriores intactas**: 70 de 73 fingerprints idênticos; os 3 que mudam são a migration nova e a faixa de publicações `dataset ≥ 42`, que passa a incluir os datasets 75–79 (recalculada só até o 74, é idêntica).
- `npm test`: **562 testes, 532 passam, 0 falham, 30 pulados** (Legislativo, que exige o PostgreSQL da aplicação). Typecheck limpo.
- **Nada disto está autorizado para publicação pública**: a pendência jurídica (NT 12/2023 da ANPD e redistribuição de tabelas derivadas) continua aberta.

## 2. Gates

| Gate | Estado | Evidência |
|---|---|---|
| G0_SAFETY | **PASS** | Backup `pre-educacao-p104-20261025.dump` (sha256 OK); baseline e crescimento medidos; só migration aditiva e cargas iniciais; ensaio completo em cluster de teste antes da produção; script de produção para sozinho acima de 4,5 GB ou abaixo de 20 GiB livres no C: (nunca disparou); nada apagado; sem commit nem push |
| G1_IDEB | **PASS_WITH_CAVEATS** | Escola, rede, município, UF, região e Brasil, 11 edições (2005–2025), 3 etapas, componentes e metas; Quadro 1 da nota reproduzido. Ressalvas: 124 escolas do arquivo sem identidade no cadastro 2007–2025 (rejeitadas, contadas); 73 linhas territoriais em que N×P não reproduz o Ideb publicado (divergência da fonte, publicada como veio); Ideb de escola em 2005 só para quem existe de 2007 em diante |
| G2_SAEB | **PASS_WITH_CAVEATS** | Agregados oficiais por Brasil, região, UF e município × rede × localização × capital × série × disciplina, 2017–2025, níveis e alfabetização; sem microdados. Ressalvas: **não existe arquivo de Saeb por escola** em nenhuma edição (a nota por escola só vem pelo Ideb); escalas por série × disciplina e 2º ano (2021 × 2023) não comparáveis entre si; equalização entre matrizes (2019/2023/2025) não verificada |
| G3_RENDIMENTO_DISTORCAO | **PASS** | Rendimento 2007–2025 e distorção 2006–2025 por escola, município, UF, região e Brasil; 38,3 milhões de somas de 100 conferidas; 8 linhas com taxa negativa na fonte rejeitadas e documentadas |
| G4_TRANSICAO_INSE | **PASS_WITH_CAVEATS** | Transição 15 pares (só município, UF, região, Brasil: não existe por escola), `***` preservado como ausente (71.588 células); INSE 2019, 2021 e 2023 por escola, município, UF e Brasil. Ressalva: INSE 2011–2015 baixado e **não carregado** (outra metodologia, sem comparação) |
| G5_STORAGE_MODEL | **PASS** | `CUSTO_REAL_ARMAZENAMENTO_P104.md`: 164 B por linha de rendimento por escola, nenhuma perda de casa decimal, sem texto nem JSONB |
| G6_PUBLICATION | **PASS** | 1.511 `PUBLISHED`, 1.511 `NO_CHANGE` no replay, 0 falhas; rollback e falha injetada exatos (G16) |
| G7_RECONCILIATION | **PASS** (6 divergências da fonte documentadas) | `RECONCILIACAO_APRENDIZAGEM.md` |
| G8_PRIVACY | **PASS** | Só agregados oficiais; nenhuma coluna pessoal (teste); supressão do INEP preservada; publicação pública **não** autorizada (ver §6, Q17) |
| G9_SERVING | **PASS** | 9 funções de leitura sem N+1; 99 casos medidos, **p50 ≤ 33 ms e p95 ≤ 48 ms** (`BENCHMARK_READ_MODELS_P104.json`) |
| G10_COMPARABILITY | **PASS_WITH_CAVEATS** | `COMPARABILIDADE_APRENDIZAGEM.md` com as notas oficiais lidas; itens marcados "não verificado" (equalização do Saeb; diferença entre a versão original e a retificada do Saeb 2021) |
| G11_TESTS_REGRESSION | **PASS** | `TESTES_REGRESSOES_P104.md` |
| G12_DATABASE_5GB_LIMIT | **PASS** | 1,372 GB de crescimento, baseline e final medidos |

## 3. O que foi feito (resumo técnico)

1. **Fontes oficiais** baixadas para `D:\Civica\raw\inep\` (174 arquivos, 2,97 GB, com SHA-256 no manifesto): Ideb 2025 (todas as edições estão na mesma planilha), Saeb de 2017 a 2025 (ZIP, XLSX e RAR com XLSB), 146 arquivos de Indicadores Educacionais (61 de rendimento, 55 de distorção, 30 de transição) e 11 do INSE. Notas técnicas lidas antes de validar comparações.
2. **Extratores** (Python, whitelist de colunas, TSV em staging com cache por SHA-256 e versão do parser): Ideb (planilha larga por edição, séries pelos rótulos, cabeçalho técnico incompleto inferido pelo rótulo do grupo), Saeb (2017–2025, XLSX e XLSB), fluxo (códigos técnicos de 2016+ e rótulos de cabeçalho nas planilhas de 2006–2015; troca de colunas e territórios sem rótulo tratados pelo conteúdo) e INSE.
3. **Modelo** (migration v13, 13 tabelas, reversível por `DROP`): `exec_edu_ideb_{school,terr,cov}`, `exec_edu_saeb_{terr,cov}`, `exec_edu_flow_{school,terr,cov}`, `exec_edu_trn_{terr,cov}`, `exec_edu_inse_{school,terr,cov}`. Datasets 75 a 79; `table_id` 93 a 105. Rede em esquema único (0 a 6).
4. **Publicação** pelo Modelo D (`publishSlice`): carga inicial sem change log, `NO_CHANGE` por impressão digital (inclui SHA-256 dos arquivos e versão do parser), retificação com log, rollback exato, replay.
5. **Leitura**: `getIdebTerritory/School`, `getSaebTerritory`, `getFlowTerritory/School`, `getTransitionTerritory`, `getInseTerritory/School`, `getLearningCoverage`, com as restrições de interpretação junto de cada resposta.
6. **Processo**: ensaio completo num cluster de teste restaurado do backup (`D:\Civica\pgtest_edu4`), que revelou e corrigiu, **antes** da produção, 9 problemas de leitura (ver §5); só então a produção, com medição a cada etapa.

## 4. Respostas às 18 perguntas

**Q1. Histórico de Ideb por granularidade.** Brasil, 5 regiões e 27 UFs: 11 edições (2005–2025) nas 3 etapas. Municípios (rede pública): anos iniciais de 5.022 (2005) a 5.478 (2025), anos finais de 5.171 a 5.491, ensino médio de 5.278 (2017) a 5.428 (2025); por rede federal, estadual e municipal também. Escolas com Ideb: anos iniciais de 27.849 (2005) a 42.454 (2025), anos finais de 18.613 a 33.448, ensino médio de 9.597 (2017) a 17.584 (2025); 85.970 escolas distintas. Brasil, anos iniciais: 3,8 (2005), 5,9 (2019), 5,8 (2021), 6,0 (2023), 6,3 (2025). O ensino médio entra a partir de 2017 em município e escola (no Brasil e nas UFs desde 2005).

**Q2. Saeb 2025 e níveis.** Publicado: 459.620 linhas, 5 séries (5º e 9º ano, EM tradicional, integrado e total) × LP e MT, com média e distribuição por nível (0 a 8 ou 10 conforme a série), em Brasil, regiões, UFs e municípios. Brasil: 5º ano LP 219,34 e MT 232,32; 9º ano LP 262,17 e MT 262,74; EM (total) LP 281,24 e MT 278,41. Em 2025 não há 2º ano nem Ciências.

**Q3. Indicadores de LP e MT.** Proficiência média e distribuição em níveis (Saeb agregado) e, por escola, as proficiências usadas no Ideb (`nota_lp`, `nota_mt`) mais a nota padronizada N. Em 2021 e 2023 também há Ciências Humanas e da Natureza (9º ano em 2021; 5º e 9º anos em 2023) e o 2º ano com a taxa de alfabetização (1.579 linhas em 2021 e 1.358 em 2023).

**Q4. Séries de rendimento e distorção.** Rendimento (aprovação, reprovação, abandono) por série do fundamental, anos iniciais e finais e médio: 2007–2025 por escola (158.130 em 2007, 126.708 em 2025), município (5.564 a 5.570), UF, região e Brasil, por rede e localização. Distorção: 2006–2025 (escola e município a partir de 2007). Brasil, fundamental: aprovação 85,2% (2009) a 97,4% (2025); distorção 28,6% (2006) a 10,0% (2025).

**Q5. Transição e INSE.** Transição: 15 pares de 2007/2008 a 2021/2022 (gravados como 2007 a 2021), município, UF, região e Brasil, com promoção, repetência, evasão e migração para a EJA. INSE: 2019 (68.868 escolas), 2021 (69.820) e 2023 (69.756) por escola, município (5.568, 5.522 e 5.558), UF (27) e Brasil (2021 e 2023).

**Q6. Escolas, redes, municípios e UFs por família.** Escolas distintas: Ideb 85.970, rendimento/distorção 198.932, INSE 75.758 (do cadastro de 299.547). Municípios: Ideb 5.478 a 5.491 (rede pública, 2025), rendimento 5.564 a 5.570, transição idem, INSE 5.522 a 5.568. UFs: 27 em todas as famílias. Redes: total, federal, estadual, municipal, privada, pública e estadual+municipal, conforme cada arquivo. Cobertura por edição em `COBERTURA_EDUCACAO_P104.csv`.

**Q7. Edições não comparáveis.** Ver `COMPARABILIDADE_APRENDIZAGEM.md`. Em resumo: Ideb 2023 e 2025 sem meta mas comparáveis (nota oficial); 2021 com cobertura menor (pandemia); Saeb com escala própria por série × disciplina, 2º ano 2021 × 2023 e alfabetização 2023 amostral (margem de erro de 2,8 p.p. no Brasil a 21,5 p.p. em uma UF); INSE 2019 × 2021/2023; fundamental de 9 anos nas planilhas de 2007–2009; 2012–2014 sem regiões no rendimento.

**Q8. Arquivos baixados e GB no D:.** 174 arquivos registrados no manifesto, **2,97 GB** de RAW (Ideb 0,27, Saeb 0,09, rendimento 1,60, distorção 0,69, transição 0,27, INSE 0,05); mais 2,2 GB de TSVs de staging e, durante a fase, 14,6 GB do cluster de teste (removido). Sem teto em D:.

**Q9. Registros publicados.** 7.961.125 linhas de dados (Ideb escola 1.045.501 e território 359.746; Saeb 1.820.574; rendimento + distorção escola 2.678.764 e território 1.258.400; transição 360.304; INSE escola 208.444 e território 229.392), 207.652.333 células, 3.319 linhas de cobertura e 1.511 publicações.

**Q10. Divergências.** Seis, todas da fonte e sem correção, em `RECONCILIACAO_APRENDIZAGEM.md` §6: N×P territorial de 2023 (73 linhas), 8 taxas negativas em 2007, 124 escolas do Ideb sem identidade, estratos vazios do Saeb 2017 e 2021, linhas repetidas do INSE municipal 2023 e o cabeçalho trocado do rendimento de 2016; mais o sigilo `***` (71.588 células) tratado como ausência.

**Q11. Crescimento do PostgreSQL.** 1.372.004.352 B: tabelas e índices 1.370.693.632 B, metadados (execuções, publicações e manifesto) 1,3 MB, **change log 0**, índices incluídos. WAL: 2,95 GB de LSN, diretório fixo em 1,07 GB. Detalhe em `CUSTO_REAL_ARMAZENAMENTO_P104.md`.

**Q12. Abaixo de 5 GB?** **Sim: 1,372 GB (27,4%).** Folga de 3,63 GB.

**Q13. Fatias `NO_CHANGE` no replay.** 1.511 de 1.511 em produção (Ideb 308, Saeb 140, rendimento e distorção 560, transição 420, INSE 83). Nenhuma linha nova no change log.

**Q14. Rollback e falha injetada.** Com dados reais de ES × 2023 em cada uma das 5 famílias (`evidencias/g16_2023_ES.json`): retificação de 5 linhas gerou o log esperado, `rollbackRun` devolveu o estado **exatamente** à referência (hash por tabela da fatia), a falha injetada depois da aplicação não deixou nenhuma linha nem log, e as tabelas das ondas anteriores permaneceram idênticas. Feito em banco de teste; em produção só houve cargas iniciais e replay.

**Q15. Ondas anteriores intactas.** Sim: 70 de 73 fingerprints idênticos, e os 3 diferentes são esperados e explicados (`TESTES_REGRESSOES_P104.md` §5). Legislativo, Saúde, Segurança, Finanças, PNCP e P10.1 a P10.3 não tiveram código nem dados alterados (as únicas edições em arquivos delas foram nos testes de contagem de migrations e de tabelas).

**Q16. Desempenho dos read models.** 99 casos (Brasil, 7 UFs, 10 municípios, uma escola e a cobertura), 30 repetições com aquecimento: p50 máximo 32,5 ms e p95 máximo 47,9 ms (o mais lento é o Saeb do Brasil, que devolve todas as séries e níveis).

**Q17. Publicável × validação jurídica.** Ver §6.

**Q18. Preparado para a P10.5.** Sim, `CONTRATOS_P105.md`: chaves, rede única, ids livres (dataset ≥ 80, `table_id` ≥ 106, migration v14), regras de interpretação e o alerta do custo do change log.

## 5. Problemas achados no ensaio e corrigidos antes da produção

1. Três linhas "Total - …" de dependência do Saeb colidiam em uma só rede (milhares de falsas duplicidades): agora são redes 0, 5 e 6.
2. Os códigos de rede 5 e 6 do INSE vêm trocados em relação ao Ideb: convertidos.
3. O arquivo municipal do INSE 2023 repete linhas idênticas: contadas e descartadas.
4. `***` (sigilo estatístico) quebrava a leitura da transição: ausente + contagem.
5. Rendimento 2016–2020: a coluna do território não tem rótulo técnico (todas as UFs viravam "Brasil" e eram rejeitadas); o cabeçalho de localização e rede de 2016 está trocado na fonte.
6. Distorção 2013–2014 sem coluna de UF (180 mil escolas rejeitadas): UF pelo prefixo IBGE do código da escola.
7. Distorção 2006–2009: território mal lido nas linhas de região.
8. Saeb 2017: estratos sem alunos gravados como média 0; Saeb 2021: taxa de alfabetização não contada nas células.
9. Medição: contar o change log inteiro (17 milhões de linhas) por consulta era lento demais para o G16; passou a contar só os runs novos.

## 6. Publicável × validação jurídica (Q17)

| Dado | Natureza | Estado |
|---|---|---|
| Ideb, rendimento, distorção, transição e INSE de **Brasil, região, UF e município** | Indicador estatístico oficial agregado, sem pessoa identificável | **Publicável com validação jurídica pendente** apenas pela questão geral de redistribuição de tabelas derivadas; risco baixo |
| Ideb, rendimento, distorção e INSE **por escola** | Agregado oficial por unidade escolar, com corte mínimo de participação do INEP; escolas pequenas podem permitir inferências sobre grupos | **Não publicar sem validação jurídica**: NT 12/2023 da ANPD (risco de reidentificação ao cruzar bases públicas, conforme resumo secundário; o PDF integral não foi lido) e a regra de uso das tabelas derivadas |
| Saeb agregado (município, UF, Brasil) | Já divulgado pelo INEP nos mesmos recortes; nenhum microdado | Publicável com a mesma ressalva geral; alfabetização amostral de 2023 exige o aviso de margem de erro |

A P10.4 **não autoriza publicação pública** de nada disto; só deixa os dados preparados e servidos pelos read models. A validação jurídica continua em aberto e é o único bloqueio conhecido.

## 7. Pendências e limites honestos

- Sem frontend, sem commit, sem push, P10.5 não iniciada, como pedido.
- Saeb por escola não existe como arquivo oficial. INSE 2011–2015 não foi carregado.
- Equalização do Saeb entre matrizes e a diferença entre a versão original e a retificada do Saeb 2021 não foram verificadas.
- O change log guarda a linha antiga inteira: retificar em massa as tabelas de fluxo custa gigabytes (`CUSTO_REAL_ARMAZENAMENTO_P104.md` §5). Em produção só houve cargas iniciais.
- A conferência independente é por amostra de valores (1.389); as somas, as faixas e as contagens cobrem tudo, mas um erro de posição de coluna em um ano que não esteja na amostra seria pego só pelas somas de 100 e pelas contagens.
- Os 30 testes pulados dependem do ambiente do Legislativo.

## 8. Arquivos

**Código novo** (`packages/db/src/exec/`): `educacao-learn-catalog.ts`, `educacao-ideb-build.ts`, `educacao-saeb-build.ts`, `educacao-flow-catalog.ts`, `educacao-flow-build.ts`, `educacao-inse-build.ts`, `educacao-learn-read.ts`, `ddl-v13.ts`; (`apps/collector/src/exec/`) `educacao-learn.ts`, `educacao-flow.ts`; (`scripts/exec/`) `ideb_extract.py`, `saeb_extract.py`, `flow_extract.py`, `inse_extract.py`, `educacao-p104-{g16,reconcilia,spot,bench,numeros,catalog}`; testes `tests/unit/educacao-{learn,flow}-p104.test.ts` e `tests/integration/educacao-p104.test.ts`.
**Código alterado, só aditivo**: `specs.ts` (datasets 75–79, `table_id` 93–105), `migrations.ts` (v13), `index.ts` (exports), `educacao-pilot.ts` (comandos `learn-register`, `ideb-publish`, `saeb-publish`, `flow-register`, `flow-publish`, `trn-publish`, `inse-publish`), `package.json` (3 arquivos no `npm test`) e 5 testes antigos (contagens).
**Documentos** desta pasta: este relatório, `CATALOGO_INDICADORES_APRENDIZAGEM.csv` (171 medidas), `CONTRATOS_IDEB_SAEB.md`, `RECONCILIACAO_APRENDIZAGEM.md`, `COMPARABILIDADE_APRENDIZAGEM.md`, `COBERTURA_EDUCACAO_P104.csv`, `CUSTO_REAL_ARMAZENAMENTO_P104.md`, `BENCHMARK_READ_MODELS_P104.json`, `TESTES_REGRESSOES_P104.md`, `CONTRATOS_P105.md`, `results.json`, `evidencias/` e `reproducibilidade/`.

**Sem commit e sem push.**
