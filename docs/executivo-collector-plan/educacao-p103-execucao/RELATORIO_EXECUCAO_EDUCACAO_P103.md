# Relatório de execução · P10.3 · Infraestrutura escolar, docentes e condições de ensino

Data: 2026-10-25 · Banco `projetoeleitor_db`, schema `civica_exec` (migrations v11 e v12) · RAW e staging em `D:\Civica` · **Sem commit e sem push.** P10.4–P10.10 não iniciadas; nenhum frontend construído.

## 1. Resultado
O Cívica tem agora, em produção, três camadas sobre a identidade (P10.1) e a oferta (P10.2) das escolas, de 2007 a 2025:

1. **Infraestrutura declarada** de **3.597.617 escolas em atividade × edição** (100 variáveis institucionais, 19 edições, 0 linhas rejeitadas), com os quatro estados do dado: `SIM`, `NAO`, `NAO_INFORMADO` e `FORA_DA_EDICAO`, e a quebra de 2019 contratada em colunas separadas.
2. **Indicadores Educacionais oficiais do INEP** (ATU, HAD, DSU, AFD, IED, IRD, ICG: 96 medidas) por **escola (3.512.097 linhas)** e por **Brasil, região, UF e município × dependência × localização (1.287.807 linhas)**, lidos como o INEP publica, nunca recalculados.
3. **Docentes distintos oficiais** (Sinopse 2.1 e 2.2) para Brasil, UF e município, 2007–2025 (106.333 linhas).

Publicação: **1.577 fatias** (513 de infraestrutura, 532 de indicadores, 532 de docentes), **0 rejeições**, replay **1.577 `NO_CHANGE`**. Reconciliação: infraestrutura bate 30/30 com o levantamento independente da P10; **201/201 comparações de células** RAW → banco; **24 verificações de distribuição** (18,97 milhões de linhas) sem violação. O banco cresceu **1,31 GB** (acumulado P10.1–P10.3 = 2,53 GB, meta 5 GB), o change log **não cresceu**, o piso de disco nunca foi ameaçado (C: livre mínimo 51,78 GiB, exigido 20) e Saúde, Segurança, Finanças, PNCP, Legislativo, P10.1 e P10.2 permanecem idênticos.

## 2. Gates finais
| Gate | Estado | Base |
|---|---|---|
| G0_SAFETY | **PASS** | dump 577 MB (SHA-256 registrado) restaurado em `pgtest_edu3` com fingerprints idênticos aos de produção; migrations testadas no isolado antes da produção |
| G1_INFRASTRUCTURE_TAXONOMY | **PASS** | 100 variáveis em 6 famílias, com campo oficial, vigência, tipo, comparabilidade, nota e regra de ausência (`TAXONOMIA_INFRAESTRUTURA_ESCOLAR.md`) |
| G2_TEMPORAL_COMPARABILITY | **PASS** | matriz variável × edição medida em 19 ZIPs, 0 divergências com a vigência do catálogo; 32 variáveis nas 19 edições, 44 comparáveis, 4 com ressalvas, 43 novas, 9 encerradas em 2018 |
| G3_DENOMINATOR_CONTRACT | **PASS** | sim ÷ (sim + não) no mesmo grupo e edição; sem resposta à parte; recorte por etapa pela P10.2 (`stage`); universo = escola em atividade |
| G4_CENSO_INFRASTRUCTURE | **PASS** | 19/19 edições, 0 rejeições; RAW reaproveitado (nada rebaixado); 100 variáveis (acima de 30, com justificativa: custo marginal 156 B por escola × edição) |
| G5_TEACHER_SEMANTICS | **PASS** | 4 unidades distintas; docentes por escola não gravados; nenhum coeficiente de correção; `CONTRATO_DOCENTES.md` |
| G6_OFFICIAL_EDUCATIONAL_INDICATORS | **PASS_WITH_CAVEATS** | 7 famílias × 3 níveis × todas as edições publicadas pelo INEP; 306 de 494 arquivos; 188 de outras famílias (rendimento, transição, distorção, INSE, remuneração, financeiros) ficaram fora de propósito (P10.4); notas técnicas dos indicadores citadas, não lidas |
| G7_CLASS_SIZE_CONTRACT | **PASS** | ATU oficial coletado (2007–2025), `MEDIA_OFICIAL_INEP` × `RAZAO_DERIVADA_CIVICA`; diferenças explicadas |
| G8_PERSISTENCE | **PASS** | 7 tabelas, FKs, CHECKs, sem JSONB, sem tabela por ano/UF |
| G9_HISTORICAL_PUBLICATION | **PASS** | 1.577 fatias, `publishSlice`, manifesto + SHA-256, bootstrap sem log, replay `NO_CHANGE` |
| G10_INFRASTRUCTURE_RECONCILIATION | **PASS_WITH_CAVEATS** | sem total oficial consolidado; referência independente (30/30) + invariantes; valores atípicos oficiais mantidos |
| G11_TEACHER_RECONCILIATION | **PASS_WITH_CAVEATS** | docentes Brasil = Sinopse nas 19 edições; células RAW = banco 201/201; distribuições somam 100; sem segunda fonte independente para indicadores por escola |
| G12_PRIVACY_AND_PUBLICATION | **PASS_WITH_CAVEATS** | nada de pessoa gravado; NT 12/2023 da ANPD localizada (resumo secundário; PDF integral não lido); exibição por escola e download de tabelas derivadas = `NEEDS_LEGAL_VALIDATION` |
| G13_SERVING | **PASS_WITH_CAVEATS** | Brasil 15 ms, UF 8–10 ms, escola 1 ms; grandes municípios ≈ 0,3 s sem série e ≈ 0,9 s com série de 19 edições |
| G14_BENCHMARK_FOUNDATION | **PASS_WITH_CAVEATS** | contratos e proibições prontos; benchmark por escola depende da decisão jurídica |
| G15_STORAGE_BUDGET | **PASS** | +1,31 GB (1,31× o provável, < 1,5×); acumulado 2,53 GB de 5 GB |
| G16_IDEMPOTENCY_ROLLBACK | **PASS** | replay 1.577 `NO_CHANGE`; retificação, rollback e falha injetada com dados reais do ES 2025 |
| G17_REGRESSION | **PASS** | fingerprints só com as diferenças autorizadas; `npm test` 509 aprovados, 0 falhas |
| G18_TERRITORIAL_TESTS | **PASS** | Brasil, 7 UFs, 12 municípios, casos especiais medidos |
| G19_P104_READINESS | **PASS** | `CONTRATOS_P104.md` |

Nenhum gate FAIL, PARTIAL ou NOT_EVALUATED.

## 3. Problemas reais encontrados e como foram tratados (todos no piloto, antes da produção)
1. **O ZIP histórico do INEP preenche com zero as colunas de edições futuras.** Em 2011, `IN_AGUA_POTAVEL` vem `0` em 242.147 escolas. Tratar como "não" seria inventar 242 mil respostas. Solução: vigência por variável (matriz medida nos 19 ZIPs); fora da vigência = NULL.
2. **Códigos especiais do dicionário oficial.** `9 - Não informado` (2 perguntas de internet) e `88888 - valor extremo` (quantidades de equipamentos de 2019 em diante) faziam o piloto rejeitar 5.364 escolas em 2025 e 7.178 em 2022. Passaram a NULL, contados à parte: **52.420** células com código 9 e **21.420** com 88888 nas 19 edições.
3. **Layouts antigos das planilhas dos indicadores.** Rótulos técnicos com código e nome trocados (2016–2018), planilhas `.xls` por região, UF e Brasil separadas, nome de região com acento e hífen variáveis, planilha duplicada na AFD 2017 (`Plan1`, com branco no lugar de `--`) e arquivo temporário do Excel dentro do ZIP (`~$…xlsx`). O extrator detecta identificação pelo conteúdo, usa a coluna mais específica antes da localização, normaliza nomes e descarta planilha repetida. Cada correção foi testada contra as 19 edições até zerar rejeições.
4. **Escala.** Os arquivos publicam uma casa decimal; a primeira escala (×100) foi trocada por ×10 (0 células perdem precisão) e `ird_media`, que tem seis casas, usa ×1000. Uma escola com 634,9 alunos por turma no ATU 2025 é dado oficial e foi mantida.
5. **Duas observações semânticas corrigidas no próprio catálogo:** os usos da internet (alunos, aprendizagem, administração, comunidade) foram respondidos por todas as escolas (as sem internet respondem "não"), então só a banda larga é "não se aplica" em branco.

## 4. Perguntas obrigatórias

**Q1. Quantas escolas possuem água, energia, internet, esgoto e demais serviços (2025)?** Universo: **180.540 escolas em atividade**, todas com linha de infraestrutura. Água da rede pública **141.839 (78,6%)** (não: 38.701); água potável **174.355 (96,6%)**; energia da rede **174.882 (96,9%)**; esgoto da rede **105.366 (58,4%)**, em fossa 75.371 (41,7%); coleta de lixo **153.150 (84,8%)**; banheiro **175.923 (97,4%)**; internet **170.762 (94,6%)**, banda larga **149.966 (87,8%, das que têm internet; 9.778 sem internet ficam fora do denominador)**; internet para ensino e aprendizagem 132.553 (73,4%), para alunos 78.080 (43,2%). Percentual = sim ÷ (sim + não); todas as respostas são autodeclaradas.

**Q2. Quantas possuem biblioteca, laboratório, quadra, espaços de alimentação e instalações?** Biblioteca **66.522 (36,8%)**; sala de leitura 55.567 (30,8%); **biblioteca e/ou sala de leitura 100.293 (55,6%)**; laboratório de informática **52.102 (28,9%)**; de ciências **25.637 (14,2%)**; quadra **72.800 (40,3%)** (coberta 56.542, 31,3%); cozinha **167.707 (92,9%)**; refeitório 103.219 (57,2%); parque infantil 73.340 (40,6%); sala de recursos multifuncionais 54.074 (30,0%); auditório 23.536 (13,0%); sala de professores 121.767 (67,4%); computador de uso administrativo 153.029 (84,8%); lousa digital 28.750 (15,9%). Acessibilidade: rampas 111.887 (62,0%), corrimão 69.933 (38,7%), piso tátil 24.761 (13,7%), elevador 10.324 (5,7%), banheiro acessível 102.991 (57,0%); **38.790 (21,5%) declaram nenhum recurso**. "Tem" significa "declara ter", não "funciona".

**Q3. Como variam entre redes?** (2025, % das escolas em atividade da rede)
| Rede | Escolas | Internet | Água da rede | Esgoto da rede | Biblioteca e/ou leitura | Lab. informática | Lab. ciências | Quadra | Cozinha | Refeitório | Banheiro acessível |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Federal | 716 | 100,0 | 78,8 | 64,1 | 97,8 | 96,2 | 86,2 | 82,7 | 84,6 | 71,9 | 96,5 |
| Estadual | 29.998 | 95,3 | 84,5 | 63,1 | 80,8 | 64,1 | 37,2 | 68,7 | 94,7 | 59,6 | 67,5 |
| Municipal | 107.372 | 92,5 | 70,4 | 44,8 | 43,5 | 17,7 | 4,0 | 29,9 | 97,5 | 55,0 | 51,0 |
| Privada | 42.454 | 99,3 | 95,0 | 89,4 | 67,6 | 30,9 | 22,6 | 45,9 | 80,1 | 60,8 | 64,4 |
A rede municipal, a maior, tem as menores coberturas de biblioteca, laboratórios e quadra; "dependência" é a registrada na edição. Dados completos em `numeros_producao_p103.json` (`porDependencia2025`).

**Q4. Urbanas × rurais (2025).** Urbanas 129.777 escolas; rurais 50.763. Internet 99,1% × 82,9%; água da rede 94,5% × 37,8%; energia da rede 99,3% × 90,6%; **esgoto da rede 77,5% × 9,3%**; biblioteca e/ou leitura 65,5% × 30,1%; laboratório de informática 35,6% × 11,7%; laboratório de ciências 18,5% × 3,2%; quadra 48,4% × 19,8%; refeitório 67,0% × 32,0%; cozinha 92,3% × 94,4%. Os números por dependência × localização estão em `exec_edu_infra_agg`.

**Q5. Variáveis desde 2007 e as posteriores.** **32** variáveis existem nas 19 edições (por exemplo: acesso à internet, água da rede, poço, cacimba, rio, energia da rede, esgoto da rede, fossa, coleta de lixo, cozinha, laboratórios de ciências e de informática, quadra, parque infantil, sala de diretoria, de professores, de recursos multifuncionais, banheiro acessível, computador administrativo, TV, DVD, impressora, copiadora, antena parabólica, "biblioteca e/ou sala de leitura", salas utilizadas, prédio compartilhado); lista na coluna `vigencia_de = 2007` da matriz. 2009: biblioteca e sala de leitura separadas; 2011: quadras coberta e descoberta; 2012: refeitório, pátios, auditório, despensa; 2019: 43 variáveis novas (usos da internet, acessibilidade detalhada, salas utilizadas, tipos de computador, ambientes de artes e música); 2022: laboratório de educação profissional; 2024: carro-pipa e sinalização.

**Q6. Mudança metodológica em 2019.** Água filtrada → água potável; banheiro dentro/fora → banheiro; salas existentes → salas utilizadas dentro/fora/climatizadas/acessíveis; gerador/outras → gerador a combustível fóssil/renováveis; dependências adaptadas → oito recursos de acessibilidade; computadores dos alunos → desktop/portátil/tablet; e seis usos da internet novos. Detalhe em `COMPARABILIDADE_TEMPORAL_P103.md` §3. Cada pergunta é uma coluna separada.

**Q7. Registros com resposta ausente, não informada ou negativa.** Ausente por vigência ("fora da edição"): não é registro, é estado da variável. Em branco: **4.259 escolas em 2022** (todas as perguntas) e nenhuma nas outras edições. Código oficial "9 - Não informado": **52.420** células (2019–2025). Valor extremo "88888": **21.420** células. Negativas (2025): por exemplo 9.778 escolas sem internet, 114.018 sem biblioteca, 38.701 sem água da rede. Tabela por edição em `RECONCILIACAO_INFRAESTRUTURA.md` §5 e `COBERTURA_EDUCACAO_P103.csv`.

**Q8. Denominadores.** Universo base: escola em atividade da edição (180.540 em 2025), **não** as 214.192 do cadastro. Percentual = sim ÷ (sim + não), por grupo e edição; "sem resposta" aparece à parte; banda larga só entre quem tem internet; recorte por etapa pelo `stage` (escolas com matrícula na etapa, da P10.2). A soma de escolas por etapa não é o total de escolas distintas. Média de percentuais nunca é usada.

**Q9. Escolas elegíveis com cada infraestrutura, por município e UF.** Disponível para os **5.571 municípios** e as 27 UFs, em todas as 19 edições (`getEducationMunicipalityInfra`, `getEducationNationalInfra`). Exemplos 2025: Vitória 180 escolas, 100% com internet, 78,3% com biblioteca e/ou leitura; São Paulo 7.310, 7.274 com internet (99,5%); Chapada de Areia/TO 5, 100%. UFs: ES 3.046 escolas e 97,6% com internet; SP 30.817 e 98,8%; RJ 11.647 e 99,2%; MG 15.910 e 97,4%; PE 7.992 e 96,6%; RR 915 e 68,4%; DF 1.332 e 100%.

**Q10. Comparabilidade histórica comprovada.** As **44** variáveis `COMPARABLE_ACROSS_YEARS` dentro da vigência (por exemplo água e energia da rede, esgoto da rede, coleta de lixo, laboratórios, quadra, cozinha) e os indicadores ATU (2007–2025). Série nacional 2007 → 2025 de exemplo: internet 29,3% → 94,6%; biblioteca e/ou leitura 33,4% → 55,6%; água da rede 62,3% → 78,6%; esgoto da rede 39,3% → 58,4%; laboratório de informática 21,0% → 28,9% (com pico de 44,5% em 2015).

**Q11. Não comparar entre anos.** As 9 `DISCONTINUED` com as 43 `NEW_VARIABLE` correspondentes, nunca fundidas; `internet` de 2022 por causa dos 4.259 em branco; usos da internet (só 2019+); banheiro acessível e salas com redação alterada (`COMPARABLE_WITH_CAVEATS`); somas de quantidades que incluam valores atípicos; e AFD/IED/IRD/HAD entre eras sem ler a nota técnica do INEP.

**Q12. Dados oficiais sobre docentes, formação, adequação, esforço e regularidade.** Docentes distintos (Sinopse 2.1/2.2, 2007–2025); DSU % de funções docentes com curso superior (2011+); AFD adequação da formação (2013+); IED esforço (2013+); IRD regularidade (2013+). 2025 Brasil: **2.407.049 docentes distintos**; DSU fundamental 89,6% e médio 95,8%; AFD grupo 1 fundamental 67,5% e médio 65,5%; escolas em faixa de alta regularidade 10,7%.

**Q13. Indicadores docentes por escola, município, UF e Brasil.** DSU, AFD, IED e IRD: **escola, município, UF, região e Brasil** (13–15 edições cada), todos publicados pelo INEP. Docentes distintos: Brasil, UF e município (não por escola).

**Q14. Como se impediu a soma indevida.** Docentes por escola **não são gravados**; território usa só a contagem distinta oficial. Medida: soma dos municípios ÷ Brasil = 1,048 (2007) a 1,065 (2025; 2.564.091 contra 2.407.049), soma das UFs > Brasil (2.414.827 em 2025) e rede pública + privada > total (2025: 75.639 docentes contados nas duas redes). Nenhum coeficiente de correção. Testes: `docentes oficiais: total distinto não é a soma das redes`. Ver `RECONCILIACAO_DOCENTES.md` §1.

**Q15. O indicador oficial de tamanho médio de turma foi coletado?** **Sim**: ATU, 2007–2025, por escola, município, UF, região e Brasil, por etapa (infantil, creche, pré-escola, fundamental, anos iniciais, anos finais, médio). 2025 Brasil: infantil 15,1; fundamental 22,2; médio 28,4.

**Q16. Como difere da razão derivada da P10.2.** Derivada 2025: infantil 15,1; fundamental 22,0; médio 26,5. O oficial coincide no infantil, é ligeiramente maior no fundamental e 1,9 aluno maior no médio, porque o INEP usa turmas de ensino regular de cada etapa e regras de exclusão próprias, enquanto a razão do Cívica divide todas as matrículas pela soma de turmas. Nenhum dos dois é "o erro". Tabela de 2007 a 2025 em `RECONCILIACAO_DOCENTES.md` §5.

**Q17. Quantos arquivos oficiais de Indicadores Educacionais foram necessários?** **306** dos 494 (7 famílias × escola/município/UF × edições publicadas). Mais 19 planilhas da Sinopse para docentes (extraídas e apagadas).

**Q18. Quanto RAW novo foi baixado?** **4,17 GB** de indicadores (preservados em `D:\Civica\raw\inep\indicadores\arquivos`) + 6,2 MB de TSV de docentes derivados; as planilhas da Sinopse (≈ 1 GB transferido) ficaram só em staging e foram apagadas. O Censo (ZIPs e `Tabela_Escola`) foi reaproveitado, nada rebaixado. `Tabela_Docente` e `Tabela_Gestor` **não foram baixadas**.

**Q19. Escolas × edição com infraestrutura.** **3.597.617** (271.352 escolas distintas), de 4.272.656 linhas do cadastro; as demais 675.039 são escolas paralisadas, extintas ou fora de atividade na edição.

**Q20. Indicadores oficiais publicados.** **96 medidas** em 7 famílias; **3.512.097** linhas por escola, **1.287.807** territoriais e **106.333** de docentes distintos; 153,3 milhões de células numéricas.

**Q21. Referências oficiais da reconciliação.** (a) Levantamento independente da P10 de valores de seis variáveis, 2021–2025; (b) cadastro e recorte da Sinopse da P10.1 (178.766 escolas com matrícula em 2025); (c) Sinopse Estatística tabelas 2.1/2.2 para docentes; (d) as próprias planilhas oficiais dos Indicadores Educacionais para as células; (e) dicionário oficial do Censo 2025 para os códigos especiais.

**Q22. Divergências e causas.** Infraestrutura contra o levantamento da P10: **0 de 30**. Células RAW × banco: **0 de 201**. Distribuições que devem somar 100: **0 violações em 18,97 milhões de linhas**. Contradições internas (água da rede e "sem água" etc.): 0 nas 19 edições. Diferenças explicadas, não erros: ATU oficial × razão derivada; soma de municípios, UFs ou redes > total de docentes distintos; valores atípicos oficiais (por exemplo 8.888 salas em 2019) mantidos.

**Q23. Restrições adicionais de privacidade.** Percentuais de formação e esforço de escolas com poucos docentes (pequenos números); download/API de tabelas derivadas (CC BY-ND); educação especial por escola (herdado). Tudo o que é pessoa (docente, gestor, profissional) ficou de fora. NT 12/2023 da ANPD tratada em `PRIVACIDADE_PUBLICABILIDADE_P103.md` §4.

**Q24. Crescimento do banco.** **+1.315,1 MB**: tabelas e índices das 7 tabelas novas = 1.311,9 MB (índices ≈ 268 MB), change log **0**.

**Q25. Pico de WAL e mínimo de C:.** WAL gerado 3,72 GB; pico de `pg_wal` em disco **1.074 MB**; mínimo de C: livre **51,78 GiB** (piso 20 GiB).

**Q26. Acumulado dentro de 5 GB?** **Sim**: 0,55 + 0,66 + 1,32 = **2,53 GB**.

**Q27. Replay `NO_CHANGE`?** **Sim**: 513 + 532 + 532 = 1.577 fatias, 0 novos runs, 0 linhas de change log.

**Q28. Retificação, rollback e falha injetada?** **Sim**, com dados reais do ES 2025 nas três frentes: retificação com log exato (10, 5 e 3 linhas), rollback com estado idêntico, falha injetada sem rastro, republicação do original `NO_CHANGE`.

**Q29. Demais ondas intactas?** **Sim**: fingerprints idênticos em Saúde, P9.1–P9.6, território, Legislativo e nas tabelas da P10.1/P10.2; só `migrations` (+11, +12) e `publicationsCrime` (+1.577) mudaram. `npm test`: 539 testes, 509 aprovados, 0 falhas, 30 ignorados (preexistentes).

**Q30. Desempenho dos read models.** Produção, 20 repetições: infraestrutura Brasil p50 15,3 ms / p95 20,3; UF p50 9–10 ms; município pequeno ou médio sem série 7–13 ms; indicadores 2–3 ms; escola 1,2 ms (infra) e 0,4 ms (indicadores). Grandes municípios: **São Paulo 344 ms sem série e 938 ms com série de 19 edições** (p95 528 e 1.119 ms). Sem N+1.

**Q31. Benchmarks válidos e enganosos.** Válidos: % de escolas com internet, biblioteca e/ou leitura, laboratórios, água/esgoto, acessibilidade; indicadores oficiais lidos prontos, com mesmo ano, unidade, definição, etapa, dependência e universo, contra mediana da UF ou Brasil. Enganosos: infraestrutura entre etapas diferentes, índice único de qualidade, "conectada para aprender" a partir do acesso, "não informado" como "não", somar docentes ou média de percentuais, ATU oficial × razão derivada. Lista completa em `CONTRATOS_BENCHMARKS_P103.md`.

**Q32. O que a P10.4 recebe.** Identidade, oferta por etapa (`mat_fund_ai/af/med`), infraestrutura, indicadores e docentes oficiais, cobertura, comparabilidade e regras de integração (`CONTRATOS_P104.md`).

**Q33. Limitações e como aparecer na interface.** (1) Tudo é autodeclarado: "declara ter". (2) Estados "não informado" e "fora da edição" visíveis. (3) Quebra de 2019: aviso e série cortada. (4) Percentuais com número de escolas. (5) Docentes distintos: nunca somar. (6) Pequenos números: ocultar formação/esforço de escolas com poucos docentes. (7) ATU oficial e razão derivada rotuladas. (8) Valores atípicos oficiais mantidos: somas de quantidades com ressalva. (9) Exibição por escola e download de tabelas derivadas aguardam validação jurídica.

**Q34. Estado final dos gates.** Seção 2: 12 PASS e 7 PASS_WITH_CAVEATS. Evidência: `evidencias/`, `reproducibilidade/`, `results.json`.

## 5. Limitações e pendências
1. **Não há total oficial consolidado de infraestrutura** (a Sinopse não tem tabela de infraestrutura): a prova é interna e contra a investigação P10.
2. **Famílias não incluídas:** 188 arquivos de Indicadores Educacionais (rendimento, transição, distorção, INSE, remuneração, financeiros) ficam para a P10.4 ou posterior; **notas técnicas** do INEP (retificação do AFD, atualização do indicador de formação) citadas e não lidas.
3. **Jurídico:** NT 12/2023 da ANPD conhecida só por resumo; exibição por escola e download de tabelas derivadas em `NEEDS_LEGAL_VALIDATION`. Nenhuma página pública foi criada.
4. **Município grande com série de 19 edições** ≈ 0,9 s; saída (opcional): tabela de agregados por município.
5. **Quantidades atípicas** do Censo (por exemplo 8.888 salas) permanecem; recomenda-se mediana em vez de soma nas telas.
6. Os agregados de infraestrutura (`exec_edu_infra_agg`) deixam NULL onde o grupo não tem "sim" ou "não"; as funções de leitura tratam NULL como 0 ao somar.
7. A carga inicial não tem change log (decisão de custo): a recuperação é por replay a partir do RAW (indicadores e Censo, preservados com SHA-256) e do TSV de docentes.

## 6. Evidências e reprodução
`evidencias/` (distribuições por ZIP, catálogo, fingerprints antes/depois, reconciliação em cluster e produção, G16, benchmark, números de produção, medições de armazenamento, saída do `npm test`, log da publicação em produção, JSON da Sinopse) e `reproducibilidade/` (ver `README.md`). Reexecução em produção: `reproducibilidade/p103_producao.sh`.
