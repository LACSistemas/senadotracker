# P10 · Investigação técnica e arquitetura nacional da Educação

Data: 2026-10-24 · Banco: `projetoeleitor_db`, schema `civica_exec` (somente SELECT) · SSD: `D:\Civica` · **Produção não modificada. Sem migration, sem backfill, sem publicação, sem commit, sem push.**

Este relatório é o ponto de entrada. As provas estão nos arquivos citados em cada seção (mesma pasta). Tudo que é número vem de leitura ou teste feito nesta fase; o que é estimativa está marcado como tal.

## 1. Resumo executivo
- **Siconfi e PNCP não precisam ser baixados de novo.** O RAW do Siconfi (260 MB) contém a função 12 e as subfunções 12.122 e 12.361–368 para 2014–2025; a soma por (ano, estágio) é idêntica ao banco em 36/36 combinações. O RAW do PNCP tem 5.111.306 contratos sem duplicidade; 286.736 caem no núcleo educacional por regras (estimativa por regra, auditada por amostra).
- **O INEP é totalmente acessível** por ZIPs públicos com `Accept-Ranges`: provei leitura de diretório central, cabeçalhos e leitura em fluxo (≈385 MB de rede para 5 edições). A chave de escola `CO_ENTIDADE` tem 0 duplicados em 2021–2025.
- **A reconciliação fecha:** Σ matrícula básica das escolas 2025 = 46.018.380 = Sinopse (Brasil), por dependência e em Vitória (77.662).
- **Bloqueios externos provados:** dados.gov.br (401), `dadosabertos.fnde.gov.br` (DNS), `dadosabertos.mec.gov.br` (403), SIMEC (login), PDDE Info UF 2025 (HTTP 500).
- **Armazenamento:** provável 16,8 GB (banco + log) + 7,9 GB RAW; cabe no C: (sobram ≈32 GB). O cenário pessimista (65,8 GB) não cabe e exige decisão do dono.
- **Q1:** 57,1% (20/35 componentes) reutilizáveis sem nova migration nem collector; 74,3% (26/35) com adaptação de código.

## 2. Gates finais (seção 24 do pedido)
| Gate | Estado | Base |
|---|---|---|
| G0_INFRASTRUCTURE_AUDITED | **PASS** | T01–T03; `planejamento_recursos_educacao.md` |
| G1_EXISTING_INFRASTRUCTURE_REUSE | **PASS** | 35 componentes; `inventario_reuso_civica_educacao.md` |
| G2_CENSO_ESCOLAR_CONTRACT | **PASS_WITH_CAVEATS** | 1995–2025 por HEAD; leitura profunda só 2021–2025 (+ cabeçalhos 2023/2024); 1995–2006 não aprofundado |
| G3_SCHOOL_IDENTITY | **PASS_WITH_CAVEATS** | 5 edições; pendente validar 2007–2020 e a tabela de códigos antigos |
| G4_ENROLLMENT_CONTRACT | **PASS** | reconciliação exata 2025 |
| G5_INFRASTRUCTURE_STAFF_CONTRACT | **PASS_WITH_CAVEATS** | declaração da escola; quebra de 2019; docentes não aditivos |
| G6_LEARNING_OUTCOMES | **PASS_WITH_CAVEATS** | Ideb e Saeb 2025 lidos; edições antigas e Saeb por escola não testados |
| G7_SICONFI_REUSE | **PASS** | 36/36; invariante 99,98% com 39 divergências explicadas |
| G8_SIOPE_OPERATIONAL | **PASS_WITH_CAVEATS** | 17 chamadas + 27 UFs × 4 exercícios; DF vazio; difere do Siconfi (+8,4% em Vitória 2024) |
| G9_FNDE_PROGRAMS | **PARTIAL** | Portal e PDDE Info lidos; PNAE/Fundeb por município `NEEDS_VALIDATION`; 3 hosts bloqueados |
| G10_PNCP_REUSE | **PASS** | varredura completa do RAW + auditoria por amostra |
| G11_EDUCATION_WORKS | **PARTIAL** | Obrasgov provado só no ES (0/332 datas finais; paginação enganosa) |
| G12_HIGHER_EDUCATION | **PASS_WITH_CAVEATS** | 30 ZIPs; identidade só em 2023; 461 duplicatas de chave |
| G13_COMPARABILITY | **PASS_WITH_CAVEATS** | contrato e proibições; sem implementação |
| G14_EDUCATION_PRIVACY | **PASS** | gestor 95,4% único; 3.395 escolas < 10 matrículas |
| G15_EDUCATION_SCHEMA | **PASS_WITH_CAVEATS** | DDL proposta **não executada** (nem em cluster de teste) |
| G16_STORAGE_PLAN | **PASS** | 3 cenários com premissas explícitas |
| G17_BACKFILL_READINESS | **PASS_WITH_CAVEATS** | 26 contratos: 12 READY_WITH_CAVEATS, 3 READY_FOR_BACKFILL, 2 NEEDS_VALIDATION, 1 DISCOVERY_ONLY, 3 PROVEN_EXTERNAL_BLOCKER, 5 NOT_SUITABLE |
| G18_EXECUTION_ROADMAP | **PASS_WITH_CAVEATS** | `ROADMAP_EXECUCAO_EDUCACAO_P10.md`; escopo de P10.4 depende de decisão do dono |

Nenhum gate FAIL. O estado `CLEAR_TO_IMPLEMENT` **não** é atribuído a nenhuma fase inteira: a P10.1 está pronta para começar (ver Q26), com as ressalvas de G2/G3.

## 3. Matriz executiva (seção 23)
| Família | Fonte | Granularidade | Histórico | Acessível? | Reuso Cívica | Próxima fase | Estado |
|---|---|---|---|---|---|---|---|
| Cadastro de escolas | Censo Escolar (INEP) | escola | 1995–2025 (escopo 2007–2025) | sim (ZIP + Range) | storage/http-gate/manifesto; collector novo | P10.1 | READY_WITH_CAVEATS |
| Matrículas, turmas, oferta | Censo Escolar + Sinopse | escola → município/UF/Brasil | 2007–2025 | sim | motor de indicadores | P10.2 | READY_WITH_CAVEATS |
| Infraestrutura, docentes | Censo Escolar + INEP Indicadores | escola, município, UF | Censo 2007–2025 (quebra 2019); Indicadores 494 arquivos | sim | idem | P10.3 | READY_WITH_CAVEATS |
| Ideb | INEP | escola, município, UF, Brasil | edições bienais (2025 lida) | sim | idem | P10.4 | READY_WITH_CAVEATS |
| Saeb | INEP resultados (xlsx) | Brasil, UF, município | 2025 lida | sim | idem | P10.4 | READY_WITH_CAVEATS |
| Finanças função 12 | Siconfi DCA/RREO | município, UF, Brasil | 2014–2025 | RAW local | **READY_FOR_BACKFILL** | P10.5 | READY_FOR_BACKFILL |
| MDE/vinculações | SIOPE (Olinda) | município, UF | 2017+ | sim (DF vazio) | collector novo pequeno | P10.5 | READY_WITH_CAVEATS |
| Transferências | Portal da Transparência | município/favorecido | 2014-01…2026-09 | sim (limite de taxa) | collector novo pequeno | P10.6 | READY_WITH_CAVEATS |
| Execução federal | Portal (RAW existente) | nacional por ação | 2014→ | RAW local | **reuso** | P10.6 | READY_FOR_BACKFILL |
| PDDE | PDDE Info (FNDE) | UF, município (escola a validar) | 2023–2025 | parcial (UF 2025 = 500) | novo | P10.6 | READY_WITH_CAVEATS |
| PNAE, Fundeb por município | Portal/Tesouro | município | — | a validar | — | P10.6 | NEEDS_VALIDATION |
| Contratos | PNCP (RAW existente) | contrato/órgão | 2021–2026 | RAW local | reuso com classificador novo | P10.7 | READY_WITH_CAVEATS |
| Obras | Obrasgov | projeto | ES provado | sim | novo | P10.7 | READY_WITH_CAVEATS (qualidade ruim) |
| Superior | Censo Superior | IES, curso | 30 ZIPs | sim | novo | P10.8 | READY_WITH_CAVEATS |
| População por idade | SIDRA 9514 | município | Censo 2022 | sim | adaptar `population_sidra` | P10.9 | READY_WITH_CAVEATS |
| Geocodificação de escola | — | — | — | sem fonte comprovada | — | futuro | DISCOVERY_ONLY |

## 4. Mapa de seções do pedido para artefatos
| Seção do pedido | Artefato |
|---|---|
| 3 G0 | `planejamento_recursos_educacao.md`, T01–T03 |
| 4 G1 | `inventario_reuso_civica_educacao.md` |
| 5 G2 | `contrato_censo_escolar.md`, `censo_escolar_*` |
| 6 G3 | `contrato_identidade_escolas.md`, `censo_identidade_escolas_2021_2025.json` |
| 7 G4 | `contrato_matriculas_turmas.md`, `censo_2025_reconciliacao_matriculas.json` |
| 8 G5 | `contrato_infraestrutura_docentes.md`, `censo_infra_semantica_nulos_2021_2025.json` |
| 9 G6 | `contrato_aprendizagem_ideb_saeb.md`, `ideb_2025_*`, `saeb_2025_*` |
| 10 G7 | `plano_reuso_siconfi_educacao.md`, `siconfi_fn12_*` |
| 11 G8 | `contrato_siope.md`, `siope_*` |
| 12 G9 | `contratos_fnde_programas.md`, `portal_transferencias_*`, `pdde_*`, `fnde_obras_probe.json` |
| 13 G10 | `plano_reuso_pncp_educacao.md`, `pncp_educacao_*` |
| 14 G11 | `contrato_obras_educacionais.md`, `obrasgov_prova_es.json` |
| 15 G12 | `contrato_educacao_superior.md`, `censo_superior_*` |
| 16 G13 | `contratos_benchmarks_educacao.md` |
| 17 G14 | `contrato_privacidade_educacao.md`, `censo_privacidade_celulas_pequenas.json` |
| 18 G15 | `arquitetura_educacao_modelo_d.md` |
| 19 G16 | `estimativa_armazenamento_educacao.csv`, `…_resumo.json`, `planejamento_recursos_educacao.md` |
| 20 G17 | `contratos_operacionais_p10.json`, `fontes_educacao_p10.json`, `testes_operacionais_p10.json` |
| 21 G18 | `ROADMAP_EXECUCAO_EDUCACAO_P10.md` |
| scripts | `reproducibilidade/` (todos somente leitura) |

## 5. Respostas obrigatórias (Q1–Q26)

### Q1 · Reuso sem nova migration ou collector
- **Evidência:** auditoria de 35 componentes (denominador explícito): 20 READY, 6 ADAPT, 2 PARTIAL, 2 EXTEND, 5 NOT_PRESENT.
- **Artefato:** `inventario_reuso_civica_educacao.md`. **Teste:** leitura de código + SELECT (T04).
- **Conclusão:** **57,1% (20/35)** sem migration nem collector; **74,3% (26/35)** se contar os que só exigem adaptação de código.
- **Limitação:** é contagem de componentes, não medida de esforço; "R" significa lido/medido, não teste de carga.
- **Próximo passo:** migration v9 (tabelas de escola) e collector `inep-censo`.

### Q2 · O RAW do Siconfi permite publicar toda a função 12 de 2014–2025?
- **Evidência:** 12 anos × 28 UFs com 5.204–5.582 entes/ano; subfunções 12.122, 12.361–368 e FU12 presentes; RAW × banco: 36/36 somas idênticas; Σ subfunções = função 12 em 198.497/198.536 (99,98%), 39 divergências em 13 entes de 2017.
- **Artefatos:** `siconfi_fn12_raw_scan.json`, `siconfi_fn12_raw_x_banco.json`, `siconfi_fn12_invariantes.json`. **Testes:** T18–T20.
- **Conclusão:** **sim.** A função 12 total já está no banco; as subfunções saem do RAW sem coleta.
- **Limitação:** o parser (`financas-build.ts`) só retém subfunções da função 06; entes sem declaração (9–374/ano) ficam `NOT_REPORTED`.
- **Próximo passo:** estender o parser, criar ref codes e publicar com `financas-pilot.ts publish dca 2014-2025 all` (P10.5).

### Q3 · É preciso baixar algo novo do Siconfi?
- **Evidência:** o RAW cobre DCA 2014–2025 completo. **Conclusão:** **não** para 2014–2025. Só competências futuras (incremental) e, se desejado, RREO de funções ainda não coletadas (`siconfi_rreo_fn12` é READY_WITH_CAVEATS e precisa de conferência na P10.5).
- **Limitação:** 2026 ainda não existe em DCA. **Próximo passo:** definir o calendário incremental (Q21).

### Q4 · Contratos PNCP no RAW e quantos seriam educacionais
- **Evidência:** 5.111.306 contratos, 0 duplicados, 8 páginas não-200. Núcleo educacional **286.736** (R$ 179,9 bi *contratado*); Educação Superior **326.461**; 692 também classificados em Segurança.
- **Base amostral:** regras v1 → auditoria manual por amostra (a regra `unidade_escolar` acertava 3/12, `servico_educacional` ≈ 3/12) → v2 com exclusões; `servico_educacional` descartado do núcleo.
- **Artefatos:** `pncp_educacao_raw_scan.json`, `pncp_educacao_refinado.json`, `pncp_educacao_amostras*.json`. **Testes:** T28–T29.
- **Conclusão:** 286.736 é o resultado de regras auditadas por amostras pequenas, não medida de precisão estatística.
- **Limitação:** amostras de ~12 por regra não dão intervalo de confiança. **Próximo passo:** auditoria maior (por exemplo 200 por regra) antes de publicar na P10.7.

### Q5 · O PNCP precisa ser baixado de novo?
- **Conclusão:** **não.** O RAW guarda o contrato inteiro; a reclassificação é local. Só competências após out/2026 (≈31 MB/mês).
- **Evidência:** `plano_reuso_pncp_educacao.md`. **Limitação:** as 8 páginas não-200 já estavam registradas no RAW. **Próximo passo:** `exec_fin_contract_class` multitema (v11).

### Q6 · Identificador estável das escolas e exceções
- **Evidência:** `CO_ENTIDADE` (8 dígitos): 0 duplicados, 0 vazios, 0 fora do padrão em 2021–2025; 239.155 códigos distintos, 198.819 nas 5 edições.
- **Exceções:** município muda 15–40/ano; dependência muda 110–153/ano; ausência intermitente (1.675 escolas em 2023 e 605 em 2024 ausentes numa edição e presentes em outra).
- **Artefatos:** `contrato_identidade_escolas.md`, `censo_identidade_escolas_2021_2025.json`. **Testes:** T09–T10.
- **Conclusão:** chave primária estável; atributos (município, dependência, nome) vão para snapshots; ausência numa edição **não** significa fechamento.
- **Limitação:** 2007–2020 não verificados; fusões/refundações sem tabela oficial. **Próximo passo:** validar 2007–2020 na P10.1.

### Q7 · Escolas e registros do Censo Escolar 2025
- **Evidência:** a tabela de escola de 2025 tem **214.192 linhas**; tabelas 2025: 290/218/263/184/88/49 colunas. A Sinopse 3.2 informa **178.766 estabelecimentos** *em atividade e com pelo menos uma matrícula* (exclui turmas exclusivas de atividade complementar ou AEE).
- **Artefatos:** `censo_identidade_escolas_2021_2025.json`, `censo_escolar_headers.json`. **Testes:** T07, T09.
- **Conclusão:** 214.192 registros de cadastro ≠ 178.766 estabelecimentos com matrícula; o produto deve rotular qual das duas bases usa.
- **Limitação:** não reconciliei linha a linha a diferença (214.192 − 178.766 = 35.426); a causa provável é a regra de matrícula/situação, a confirmar. **Próximo passo:** reconciliar por situação de funcionamento e matrícula na P10.1.

### Q8 · Histórico de escolas e infraestrutura
- **Evidência:** 31 ZIPs de 1995 a 2025, todos HTTP 200 com Range; 2007–2024 CSV único por edição; 2025 em seis tabelas. Dicionário: 1.180 entradas; 121 das 370 variáveis de Escola começam em 2019.
- **Conclusão:** escolas desde 2007 (escopo recomendado); infraestrutura comparável com **quebra em 2019**; vazio em flag ≠ "não existe" (2022: 4.259 escolas ativas com `IN_INTERNET` vazio).
- **Limitação:** 1995–2006 (521 MB) existem mas não foram lidos em profundidade. **Próximo passo:** mapa variável × ano (já em `censo_escolar_variaveis_x_ano.csv`) vira contrato de colunas por edição.

### Q9 · Histórico de matrículas e turmas
- **Evidência:** Σ `QT_MAT_BAS` 2025 = 46.018.380 = Sinopse; dependências iguais; Vitória 77.662.
- **Conclusão:** matrículas e turmas por escola de 2007 a 2025 (mesma estrutura de arquivo); agregados por SQL com reconciliação com a Sinopse.
- **Limitação:** reconciliação provada só para 2025. Matrícula ≠ aluno único. **Próximo passo:** reconciliar 2021–2024 com as sinopses de cada ano.

### Q10 · Histórico de docentes
- **Evidência:** Σ de docentes por escola (2024) = 2.939.002; docentes únicos 2025 (Sinopse 2.1) = 2.407.049.
- **Conclusão:** a contagem por escola existe desde 2007 e **não pode ser somada**: superconta ≈ 22% porque o mesmo docente atua em mais de uma escola. Indicadores oficiais (AFD, ATU, HAD, TDI, ICG) já vêm calculados.
- **Limitação:** comparei anos diferentes (2024 × 2025) para dimensionar a superconta; ordem de grandeza, não exata. Sem microdados de docentes. **Próximo passo:** repetir a comparação no mesmo ano na P10.3.

### Q11 · Ideb e Saeb 2025
- **Evidência:** Ideb 2025: 11 arquivos; li Brasil, UFs e municípios (AI) e as dimensões do arquivo de escolas (A1:EG66164); 5.320 redes municipais com Ideb; mínimo por UF 15 (RR); DF sem rede municipal. Saeb 2025: 24,3 MB, abas Brasil/Estados/Municípios (69.778 linhas), dicionário de 119 variáveis.
- **Artefatos:** `ideb_2025_*.json`, `saeb_2025_*.json`. **Testes:** T15–T17.
- **Conclusão:** acessíveis: Ideb por escola, município, UF e Brasil; Saeb por Brasil/UF/município.
- **Limitação:** Saeb por escola não foi testado; edições anteriores não lidas; "–" significa ausente. **Próximo passo:** contrato de colunas por edição na P10.4.

### Q12 · Indicadores já calculados pelo INEP × os que exigem processamento
- **Evidência:** 494 arquivos de Indicadores Educacionais, todos HTTP 200, 7,03 GB (2025: 512 MB). Já calculados: AFD, IED, IRD, DSU, ICG, ATU, HAD, TDI, rendimento (aprovação/reprovação/abandono), INSE, Ideb.
- **Exigem processamento nosso:** agregados de matrícula/turma/oferta por território, razões sobre população (SIDRA), cobertura financeira, qualquer indicador ponderado.
- **Conclusão:** preferir o indicador oficial quando existir; calcular só o que o INEP não publica, com a fórmula documentada.
- **Limitação:** não validei cada arquivo de indicador por dentro (só tamanho e existência, mais Ideb). **Próximo passo:** escolher a lista mínima na P10.3/P10.4.

### Q13 · SIOPE
- **Evidência:** 17 chamadas reais; 27 UFs × 4 exercícios de Dados Gerais: 2016 = 0, 2017 = 5.592, 2024 = 5.591, 2025 = 5.559 (DF vazio); `Despesas_Siope` 69 MB em 47 s. Vitória 2024: SIOPE 873,11 mi × Siconfi 805,77 mi (+8,4%).
- **Armadilha:** 365 linhas em que 11+12=13 (subtotal) → somar duplica.
- **Conclusão:** operacional de 2017 em diante; é fonte separada do Siconfi, nunca somada; funções de remuneração e responsáveis proibidas (PII).
- **Limitação:** não testei todos os campos de todos os anos, nem receitas. **Próximo passo:** collector pequeno em JSONL gz com a lista de funções permitidas.

### Q14 · Programas FNDE vinculáveis a município, rede e escola
- **Evidência:** Portal de Transferências: 153 meses (514 MB), município e favorecido presentes; execução federal em RAW local não traz município (Fundeb 51.561,5; PNAE 5.536,3; PDDE 1.873,0; PNATE 853,5, em R$ mi, 2025). PDDE Info: UF e município 2023–2025 (UF 2025 = HTTP 500).
- **Conclusão:** município: Portal (e PDDE Info); rede: via município/UF, com cuidado de não confundir rede e localização; escola: só onde o PDDE Info trouxer o código INEP, **a validar** na P10.6 (a planilha traz contas bancárias, a descartar).
- **Limitação:** PNAE e Fundeb por município `NEEDS_VALIDATION`; limite de taxa do Portal (405). **Próximo passo:** testar PDDE por escola com poucas requisições.

### Q15 · Contratos e obras com código INEP?
- **Evidência:** contratos PNCP têm CNPJ do órgão e objeto livre, sem código INEP; Obrasgov (ES): 1.879 projetos, 332 de educação, sem campo de escola.
- **Conclusão:** **não de forma confiável.** Vínculo por similaridade de texto é proibido; vínculo por município/órgão é possível.
- **Limitação:** conferi só o ES nas obras. **Próximo passo:** se o dono quiser, procurar chave oficial (convênio/termo de compromisso FNDE) numa fase própria.

### Q16 · Comparações válidas
- **Conclusão:** entre municípios do mesmo porte e rede: Ideb de rede, rendimento (aprovação/abandono), matrícula por 1.000 habitantes da faixa etária, gasto por aluno com a mesma fonte e o mesmo estágio; entre UFs: os mesmos com população do mesmo ano; entre escolas: Ideb e indicadores oficiais da mesma dependência, etapa e localização, com cobertura e participação à vista.
- **Evidência:** `contratos_benchmarks_educacao.md`. **Limitação:** contrato apenas. **Próximo passo:** P10.9.

### Q17 · Comparações enganosas
- Média de Ideb de escolas como Ideb de rede; matrícula como aluno único; somar docentes entre escolas; comparar infraestrutura antes e depois de 2019; zero × ausente; SIOPE com Siconfi; empenhado com pago; transferência com gasto final; função 12 com MDE e Fundeb; rede municipal com escolas localizadas no município; escola ausente numa edição como fechada; ranking de escolas pequenas (3.395 escolas com menos de 10 matrículas).
- **Evidência:** cada item tem número ou teste nos contratos. **Próximo passo:** transformar em validações e textos de ajuda (P10.9/P10.10).

### Q18 · Riscos de reidentificação
- **Evidência:** 95,4% das escolas têm um único gestor (nome de pessoa identifica); 3.395 escolas com menos de 10 matrículas; entre 41% e 85% das células sensíveis valem 1–4.
- **Conclusão:** não armazenar nome/e-mail/telefone de gestor, contas bancárias, microdados de aluno/docente nem SIOPE de remuneração; suprimir células pequenas por supressão primária e complementar.
- **Artefatos:** `contrato_privacidade_educacao.md`, `censo_privacidade_celulas_pequenas.json`. **Limitação:** não testei a reidentificação por cruzamento externo. **Próximo passo:** whitelist de colunas em código (P10.1) com teste que falha se coluna fora da lista aparecer.

### Q19 · GB por onda
- **Evidência (provável, banco + change log):** P10.1 1,2 · P10.2 2,0 · P10.3 2,3 · **P10.4 5,8** · P10.5 2,0 · P10.6 1,7 · P10.7 0,2 · P10.8 1,5 GB; total 16,8 GB. Conservador 5,7; pessimista 65,8. RAW: 2,4 / 7,9 / 17,8 GB. WAL em pico ≈ 2–10 GB; backups ≈ 5–20 GB em D:.
- **Artefatos:** `estimativa_armazenamento_educacao.csv` (linha a linha, com premissa), `planejamento_recursos_educacao.md`. **Teste:** T33.
- **Limitação:** estimativa por unidades medidas (170/102/235/218 B por linha), não medição da carga. **Próximo passo:** calibrar com a P10.1 (tamanho real × estimado) antes da P10.2.

### Q20 · Independentes × dependentes de P10.1
- **Independentes:** P10.5 (RAW Siconfi), P10.7 (RAW PNCP; sem ligação a escola), P10.8 (superior). **Dependem de P10.1:** P10.2, P10.3, P10.4, P10.6 (PDDE por escola), P10.9, P10.10.
- **Evidência:** `ROADMAP_EXECUCAO_EDUCACAO_P10.md`. **Limitação:** P10.4 e P10.9 também dependem de P10.2/P10.5.

### Q21 · Atualização periódica por fonte
| Fonte | Cadência observada/prevista | Estratégia |
|---|---|---|
| Censo Escolar, Sinopse, Indicadores | anual (nova edição; retificações possíveis) | verificar HEAD da página/URL no ano seguinte; novo snapshot, nunca sobrescrever; guardar hash |
| Ideb, Saeb | bienal | idem, por edição |
| Siconfi DCA | anual (RREO bimestral) | competências novas incrementais; reaproveitar `siconfi.ts` |
| SIOPE | por bimestre/ano | consulta por (UF, ano) |
| Portal transferências | mensal (arquivo mensal) | só o mês novo, com `HttpGate` serial (limite de taxa) |
| PNCP | contínua | incremental mensal (≈31 MB) |
| Obrasgov | contínua | recoleta por UF, lendo até página vazia |
| Censo Superior | anual | por edição |
- **Limitação:** as cadências são as observadas nas fontes, sem scheduler (proibido nesta fase). **Próximo passo:** definir o calendário só depois do backfill.

### Q22 · Conjunto mínimo para uma página municipal de excelente qualidade
- **Conclusão:** (1) rede e escolas do município (contagem, dependência, localização); (2) matrículas por etapa e rede com série histórica; (3) Ideb da rede municipal (e das escolas) com cobertura; (4) rendimento (aprovação, abandono) e distorção idade-série; (5) infraestrutura básica das escolas (água, esgoto, internet, biblioteca, acessibilidade) com aviso de quebra de 2019; (6) docentes (indicadores oficiais de formação e adequação); (7) gasto em educação (Siconfi função 12 por subfunção; SIOPE separado); (8) transferências do FNDE ao município; (9) população da faixa etária para taxas; (10) contratos educacionais do órgão (valor contratado).
- **Evidência:** disponibilidade de cada item provada nas Q anteriores. **Limitação:** a escolha é editorial. **Próximo passo:** validar a lista com o dono antes da P10.10.

### Q23 · Indicadores adicionais que ampliariam a exploração
- Desigualdade por localização/dependência; INSE; taxa de atendimento por faixa etária (SIDRA 9514); matrícula por tipo de oferta (EJA, profissionalizante, especial); gasto por aluno e por subfunção; evolução do Ideb contra a meta (`VL_PROJECAO`); mapa de escolas (**sem fonte de coordenadas comprovada**); Educação Superior (IES e cursos).
- **Limitação:** geocodificação `DISCOVERY_ONLY`. **Próximo passo:** priorizar após a P10.9.

### Q24 · Fontes bloqueadas e prova
| Fonte | Prova | Artefato |
|---|---|---|
| dados.gov.br (FNDE) | HTTP 401 | `fnde_obras_probe.json` |
| `dadosabertos.fnde.gov.br` | falha de DNS | `fnde_obras_probe.json` |
| `dadosabertos.mec.gov.br` | HTTP 403 | `mec_dados_probe.json` |
| SIMEC (obras) | exige login | `contrato_obras_educacionais.md` |
| PDDE Info UF 2025 | HTTP 500 (ORA-01722) | `pdde_reprova_2026.json` |
| Portal da Transparência (temporário) | HTTP 405 após ~170 requisições | `portal_transferencias_tamanhos.json` |
- **Limitação:** testei de uma máquina e uma rede; DNS e 403 podem variar por origem. O 405 é limite de taxa, não bloqueio permanente. **Próximo passo:** repetir o teste no início da P10.6.

### Q25 · Ordem técnica recomendada
- **Conclusão:** P10.5 (reuso total, risco baixo, resultado visível) em paralelo com P10.1 → P10.2 → P10.3 → P10.4 → P10.6 → P10.7 → P10.8 → P10.9 → P10.10. Se for preferível uma entrega por vez: P10.1, P10.2, P10.5, depois o resto.
- **Evidência:** grafo de dependências no roadmap. **Limitação:** a decisão de escopo da P10.4 (5,5 M vs 18 M vs 80 M de linhas) afeta o espaço. **Próximo passo:** o dono escolhe o escopo.

### Q26 · O que implementar primeiro na P10.1, sem nova descoberta
1. Migration v9 em cluster de teste isolado (`arquitetura_educacao_modelo_d.md`): `exec_edu_school`, `…_snapshot`, `…_name`, `…_identity`, `exec_edu_cov`, ref codes.
2. Collector `apps/collector/src/exec/inep-censo.ts` com `storage.ts` + `http-gate.ts`, hosts `download.inep.gov.br`; URL `…/microdados_censo_escolar_AAAA.zip` (2025 usa `…_2025_.zip`; descobrir pela página).
3. Leitura em fluxo (ISO-8859-1, separador `;`) da tabela de escola, **só colunas da whitelist** (sem gestor/contato).
4. Snapshots 2021–2025 → conferir unicidade, município existente em `exec_entity`, totais por UF × Sinopse 3.x.
5. Backfill 2007–2020 respeitando as colunas por edição de `censo_escolar_variaveis_x_ano.csv`.
6. Publicar com `publishSlice`; dump + restauração isolada.
- **Evidência:** `contrato_censo_escolar.md`, `contrato_identidade_escolas.md`, `reproducibilidade/censo_escola_stream.py`, `censo_identidade_analise.py` (referência de leitura). **Limitação:** 2007–2020 e a diferença 214.192 × 178.766 ainda precisam de conferência. **Próximo passo:** executar a P10.1 após aprovação.

## 6. Riscos e decisões que cabem ao dono
1. **Escopo da P10.4** (indicadores por escola): 5,8 GB provável; o pessimista não cabe no C:.
2. **Retenção do `exec_change_log`** (3,3 GB, 40–50% do crescimento): não aplicada nesta fase.
3. **Nome/e-mail de gestor:** recomendação é não guardar.
4. **Publicar escolas individualmente com Ideb:** definir limiar de participação e supressão.
5. **SIOPE × Siconfi:** exibir lado a lado com rótulo, nunca fundir.

## 7. Limites desta investigação
- Provas amostrais: leitura profunda 2021–2025 do Censo Escolar, Ideb/Saeb 2025, SIOPE ES + cobertura por UF, Obrasgov só ES, PNCP por regras com auditoria de amostras pequenas.
- DDL do modelo D **não executada**, nem em cluster de teste (G15 com ressalva).
- Estimativas de armazenamento são modelo com premissas, não medição de carga.
- Nada foi gravado em produção. Foram criados somente arquivos em `docs/executivo-collector-plan/educacao-p10/` e staging em `D:\Civica\staging\p10_probe`.

## 8. Reprodutibilidade
Scripts em `reproducibilidade/` (todos somente leitura). Exemplo: `python -I -X utf8 zip_remote_listing.py <url>`; em Windows, usar caminhos `D:/…` no Python e `/d/…` no `curl` do Git Bash.
