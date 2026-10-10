# Investigação Judiciário P2 — fontes, granularidade individual e lacunas de cobertura

**Escopo:** investigação somente, continuação de `investigacao_judiciario.md` (P1, não alterada). Nenhum código, banco, collector, migration ou configuração foi alterado; só houve consultas pequenas e não destrutivas, sem contornar autenticação, CAPTCHA ou bloqueios. Todos os artefatos baixados ficaram fora do repositório. **Este arquivo é a única entrega.**
**Data da investigação:** 08/10/2026 (P1: 07–08/10/2026).
**Anonimização:** nomes de magistrados, CPFs, partes e matrículas **não** são reproduzidos; exemplos usam `<NOME>`.
**Evidências:** `P01…P40` (Parte 17). Referências `E..` apontam para a Parte XII da P1.

**Estados de conhecimento (mandato §2), usados nas tabelas:** **EXISTE** · **PUBLICADO** · **ACESSÍVEL** · **ESTRUTURADO** · **COLETÁVEL** · **RELACIONÁVEL** · **GENERALIZÁVEL** · **HISTÓRICO**. Um traço (—) significa que não foi demonstrado; nunca equivale a "não existe".
**Status da matriz P1→P2:** RESOLVIDO · AVANÇO PARCIAL · SEM AVANÇO · BLOQUEIO EXTERNO · INVIABILIDADE COMPROVADA.

---

# 1. Resumo executivo — o que mudou em relação à P1

A P1 concluiu que dava para um Cívica Judiciário **institucional** e um recorte individual **só no STJ**. A P2 confirma isso, mas muda três coisas de forma material:

1. **As estatísticas oficiais do Justiça em Números existem como base estruturada oficial** (CSV em ZIP, publicado pelo CNJ): 1.595 linhas tribunal×ano, **2009–2025**, **1.314 colunas** com dicionário, mais 613 linhas de **seção judiciária** da Justiça Federal (2012–2025). Numeradores e denominadores das taxas oficiais estão no arquivo (a taxa de congestionamento do TJES em 2024 é reproduzida exatamente por `Cp/(Cp+TBaix)`). **Não é preciso reprocessar o DataJud para os KPIs oficiais** (P03–P05).
2. **O cadastro nacional de magistrados existe, mas não é público.** O CNJ mantém o Módulo de Pessoal e Estrutura Judiciária Mensal (MPM) — "cadastro nacional de unidades judiciárias, magistrados(as), servidores(as)" — chaveado por **CPF**, com histórico de situações (início/saída), titular/substituto, forma e data de promoção, afastamentos e unidade de lotação. A publicação é **somente agregada** (painel Qlik de pessoal). Os tribunais, porém, publicam recortes nominais próprios (TRT15, TRT3, TJSC, STJ) em HTML, ODS e CSV (P06–P12, P22–P25).
3. **Há produtividade individual publicada, só que de forma heterogênea e antiga ou irregular:** TJSP publica PDF mensal por desembargador×órgão julgador (2017–2022 comprovado); o CNJ tem painel de produtividade de **magistrados 2015–2019** (MPM antigo); a partir de 2020 a produtividade é calculada pelo DataJud e **não** por magistrado; o STJ publica, **por dia, as decisões monocráticas e acórdãos de cada ministro** (4.106 documentos em 02/07/2025, 33 ministros) (P08, P18, P26, P27).

**Muda o gargalo jurídico:** o Termo de Uso do DataJud v1.2 (texto primário lido nesta rodada) traz restrições que a P1 só conhecia pela Wiki — **120 requisições/min, vedação a coletar informação pessoal e a cruzamentos de dados pessoais, vedação de engenharia reversa** (P01). Já os datasets do STJ declaram **licença CC-BY** no catálogo CKAN (P13).

**Não mudou:** votos nominais do STF (acesso programático bloqueado; existência e publicação documentadas), pagamentos efetivos dos tribunais (nenhuma fonte de pagamento a fornecedor comprovada) e base nacional de grandes litigantes (painel Qlik; sem exportação verificada).

**Saldo das 8 lacunas da P1:** 1 RESOLVIDA · 5 AVANÇO PARCIAL · 1 BLOQUEIO EXTERNO · 1 SEM AVANÇO.

---

# 2. Quadro de descobertas (dez principais)

| # | Descoberta | Evidência | Estados |
|---|---|---|---|
| 1 | **Base oficial do Justiça em Números** em ZIP/CSV: `JN_23-Jun-2026.csv` (1.595 linhas, 99 siglas, 8 ramos, 2009–2025, 1.314 colunas) + dicionário (1.313 variáveis) + `BD_Consolidado_JF_Secao` (613 linhas, 30 seções, 2012–2025) + script R oficial que baixa o ZIP | P03, P04, P05 | EXISTE, PUBLICADO, ACESSÍVEL, ESTRUTURADO, COLETÁVEL, HISTÓRICO |
| 2 | **Taxa de congestionamento reproduzível**: TJES 2024, `TC=0,691452`; `Cp=1.056.523`, `TBaix=471.454` ⇒ `Cp/(Cp+TBaix)=0,691452` | P03 | RELACIONÁVEL (numerador/denominador) |
| 3 | **MPM é o cadastro nacional** (CPF como chave; histórico de situação profissional com datas; unidade de lotação com código); público só como painel agregado | P06, P07, P08 | EXISTE, PUBLICADO (agregado), ACESSÍVEL (painel), não ESTRUTURADO/COLETÁVEL individualmente |
| 4 | **STJ: vínculo determinístico ministro↔folha↔gabinete↔relatoria.** Folha 07/2026: 61 ministros (32 ativos, 29 aposentados), `Lotação="Gabinete do(a) Ministro(a) <NOME>"`, matrícula. Os 35 valores de relator da ata 07/10/2026 casam por tokens com **29 ministros, sem ambiguidade**; os 6 restantes são cargos/convocados | P15, P16 | RELACIONÁVEL (sem depender de igualdade exata de texto) |
| 5 | **STJ publica o que cada ministro decide, por dia**: íntegras 02/07/2025 = 4.106 documentos (3.898 monocráticas + 208 acórdãos), 33 ministros, `teor` preenchido em 100%; texto completo em ZIP (16 MB) | P14 | ESTRUTURADO, COLETÁVEL, HISTÓRICO (desde 04/01/2021) |
| 6 | **O texto padronizado dos acórdãos do STJ permite recuperar votação em escala**: em 1.952 acórdãos amostrados (3 órgãos, 6 arquivos, 2022–2026), 98,5% citam "unanimidade", 97,1% listam quem "votou com/acompanhou", 1,8% citam "vencido", 1,9% citam voto-vista | P17 | PARCIAL: PUBLICADO, ACESSÍVEL; extração não validada |
| 7 | **Produtividade individual publicada em alguns tribunais**: TJSP — PDF mensal por magistrado×órgão julgador (decisões, julgamentos com/sem mérito, homologações), 2017–2022 | P18 | EXISTE, PUBLICADO, ACESSÍVEL; ESTRUTURADO só em PDF-tabela; HISTÓRICO (2017–2022) |
| 8 | **STF**: Portal de Sessões de Julgamento (lançado 21/08/2025) mostra relator, colegiado, vista/destaque, placar e votos; Painel de Decisões Corte Aberta (Qlik, "Exportar", v3.0 de 29/10/2025). O acesso por script retorna 403/corpo vazio | P19, P20 | EXISTE, PUBLICADO; ACESSÍVEL só em navegador; COLETÁVEL não comprovado |
| 9 | **Unidades**: API oficial do TJRJ (83 comarcas, 1.976 órgãos com flag `ativo`, 420 inativos) — mas `codOrg` **não** coincide com `orgaoJulgador.codigo` do DataJud (0 de 300 códigos amostrados casam de forma válida). Só o TJBA tem código compatível comprovado | P21, P22 | ESTRUTURADO; RELACIONÁVEL só no TJBA |
| 10 | **Gastos federais**: o arquivo mensal "Despesas" do Portal da Transparência (09/2026, 65.634 linhas, 35 órgãos superiores) **não inclui o Judiciário**; o STJ publica sanções a fornecedores com CPF/CNPJ (532 linhas) | P28, P29 | Pagamentos de tribunais: não comprovados |

---

# 3. Matriz de evolução P1 → P2

| Lacuna P1 | Evidência anterior | Nova fonte | Evidência P2 | Novo status | Consequência |
|---|---|---|---|---|---|
| Cadastro de magistrados | Não comprovado | CNJ MPM (manual, modelos, tabelas auxiliares); painel de pessoal; TRT15, TRT3, TJSC, STJ folha | Cadastro nacional **existe** (CPF + datas); público só agregado; recortes nominais por tribunal em HTML/ODS/CSV; STJ com matrícula e lotação | **AVANÇO PARCIAL** | Perfil nacional exige solicitação institucional; perfis por tribunal viáveis onde há lista pública. Sem ID público nacional |
| Produtividade individual | Não comprovada | TJSP PDFs; CNJ painel MPM 2015–2019; STJ íntegras por ministro; TRT3 "Produção dos Magistrados" (página localizada) | Individual publicada em TJSP (2017–2022) e no STJ (por documento); desde 2020 o CNJ calcula por DataJud, não por magistrado | **AVANÇO PARCIAL** | Só "volume de atos" por pessoa em tribunais específicos. Nada comparável nacionalmente |
| Votos do STF | Restrito | Portal de Sessões de Julgamento; Painel de Decisões (Corte Aberta); estudo CNJ/FGV; base acadêmica USP | Existência e publicação confirmadas por fonte oficial; acesso por cliente não navegador retorna 403/vazio | **BLOQUEIO EXTERNO** (com avanço de mapeamento) | Depende de download autorizado/cooperação com o STF; não automatizar |
| Justiça em Números | Painel | CNJ "Base de dados" (ZIP/CSV) | Base estruturada 2009–2025, dicionário, script R | **RESOLVIDO** (nível tribunal×ano e seção da JF) | KPIs oficiais sem processar DataJud; unidade/mês seguem fora |
| Hierarquia das unidades | Parcial | API TJRJ; MPM (cadastro de serventias, tabelas auxiliares); TRT15 "fixações" | Estrutura e flag `ativo` no TJRJ; código ≠ DataJud; MPM guarda o código CNJ interno mas não o publica | **AVANÇO PARCIAL** | Cadastro canônico nacional só por (a) pedido ao CNJ ou (b) conciliação por tribunal |
| Remuneração | Parcial | STJ folha ×  ata × íntegras × espelhos | Vínculo determinístico via lotação-gabinete e tokens; categoria de vínculo (ativo/aposentado/pensionista) | **AVANÇO PARCIAL** | Reconciliação é viável no STJ; nacional continua dependente de nome |
| Pagamentos dos tribunais | Não comprovados | Portal da Transparência (CGU); STJ penalidades; portais TJSP/ES/SC/MG | Portal federal não cobre Judiciário; execução orçamentária por portais estaduais (SIAFEM/SP) e Siga/SIOP **não testados em dado** | **SEM AVANÇO** (em dado de pagamento) | Pistas listadas; nenhuma comprovada |
| Litigantes nacionais | Não comprovados | CNJ painel "Grandes Litigantes"; STJ ata; TSE partes | Painel oficial: 20 maiores por tribunal e por unidade (Qlik; sem exportação verificada). TSE partes: nomes e `SQ_CANDIDATO`, **sem CNPJ** | **AVANÇO PARCIAL** | Nacional só como agregado do painel; CNPJ por parte só no STJ |

---

# 4. Cadastro e identidade dos magistrados

## 4.1 Respostas às 12 perguntas

| # | Pergunta | Resposta P2 | Estado |
|---|---|---|---|
| 1 | Base nacional de magistrados ativos? | **Existe** (MPM; cadastro obrigatório "a partir de maio de 2023", todos os que atuam e atuaram) | EXISTE; individual não PUBLICADO |
| 2 | Cadastro público de aposentados? | MPM: inativos desde mai/2023 devem constar; **público**: TRT15 (inativos com datas de atuação e aposentadoria), STJ folha (ministros aposentados, 29) | PARCIAL por tribunal |
| 3 | Identificador individual estável? | **CPF** no MPM (não público); matrícula `cd_matricula` no STJ; 6/86 órgãos no DadosJusBr | EXISTE; não PUBLICADO |
| 4 | Matrícula é pública? | STJ folha: sim (`cd_matricula`). Demais: só onde o órgão publica (DadosJusBr 6/86) | PARCIAL |
| 5 | Matrícula única entre tribunais? | **NÃO COMPROVADO**; o MPM usa CPF justamente para unificar. Matrícula é local ao tribunal | N/A |
| 6 | Identificar o magistrado por ato de nomeação? | Não testado em diários oficiais (fora do escopo prático desta rodada); TRT15 publica **data de posse/entrada** e cargo | PARCIAL |
| 7 | Reconstruir a carreira? | MPM: sim, internamente (situação + início/saída; forma/data de promoção). Público: TRT15 inativos (períodos por cargo) | PARCIAL |
| 8 | Reconstruir histórico de lotação? | Folha mensal do STJ (2020-01→2026-07) permite série mensal de `Lotação`; MPM internamente | PARCIAL |
| 9 | Conectar magistrado ↔ código CNJ da unidade? | MPM guarda "Órgão de lotação" (código); **não publicado**. Público: STJ (gabinete por nome), TRT15 (vara por nome) | RELACIONÁVEL só por texto |
| 10 | Listas de titulares e substitutos? | TRT15 (titulares, substitutos, **fixações vara×juiz**), TJSC (lotação de magistrados), TRT3 (situação funcional, PDF+ODS) | PUBLICADO por tribunal |
| 11 | Histórico de substituições? | MPM modela afastamentos e situações; **público**: não comprovado | N/C |
| 12 | Quais tribunais publicam estruturado? | CSV: STJ (folha). ODS: TRT3. HTML: TRT15, TJSC. Planilha/Google Docs: TJES (não acessível ao cliente usado). PDF: TJSP (produtividade) | GENERALIZÁVEL: **não** |

## 4.2 Matriz pessoa × cargo × unidade × período × identificador (observado)

| Tribunal | Pessoa | Cargo | Unidade | Período | Identificador | Formato | Estados |
|---|---|---|---|---|---|---|---|
| **MPM/CNJ** (interno) | sim | `seq_cargo` (11 opções: titular, substituto, desembargador…) | Órgão de lotação (código CNJ) | início e saída de cada situação | **CPF** | planilha enviada ao MPM; painel agregado | EXISTE; não ACESSÍVEL individualmente |
| **STJ** | nome | `Cargo` ("Ministro do Superior Tribunal de Justiça") | `Lotação` ("Gabinete do(a) Ministro(a) …") | **mensal**, 2020-01→2026-07 | `cd_matricula` | CSV 108,6 MB, UTF-8 | todos os 8 estados (histórico mensal; CC-BY) |
| **TRT15** | nome | Desembargador / Juiz Titular / Substituto (por página) | vara ("VT <município> (n)"), fixação | datas de posse e (inativos) de saída | — | HTML | PUBLICADO, ACESSÍVEL, ESTRUTURADO fraco |
| **TRT3** | nome | cargos de magistrados e situação funcional **a partir de 2022** | — | quadrimestral | — | PDF e ODS | PUBLICADO |
| **TJSC** | nome | — | lotação por comarca/unidade | atual | — | HTML | PUBLICADO |
| **TJRJ** | — | — | (apenas unidades, ver Parte 10) | — | `codOrg` | JSON API | só unidades |
| **TJES** | nome | magistrados por grau | "Comarca/Unidade/Magistrado" | atual | — | Google Docs embutido (sem lista no corpo servido) | PUBLICADO; **não COLETÁVEL** com o cliente usado |
| **TJMG / TJSP / TRF1** | — | — | — | — | — | páginas institucionais (composição das câmaras; manuais; PDFs) | lista nominal estruturada **não encontrada** nesta rodada |

**Classificação:** não encontrar não equivale a inexistência — TJMG, TJSP, TRF1 e TJES não tiveram caminho estruturado localizado em busca limitada.

## 4.3 Conclusão

Um cadastro nacional nominal **existe no CNJ** (MPM) e é a fonte que resolveria identidade, carreira e lotação. Hoje ele só é público como agregado. O caminho de produto é: (a) STJ completo (ID por matrícula + lotação por gabinete), (b) tribunais com lista pública estruturável (TRT15/TRT3/TJSC como pilotos), (c) **pedido formal ao CNJ** de extrato público do MPM sem CPF.

---

# 5. Produtividade individual e institucional

## 5.1 Os três conceitos

| Conceito | O que mede | Fontes observadas |
|---|---|---|
| **Produtividade do órgão** (vara, câmara, tribunal) | atos/volume da unidade | Justiça em Números (tribunal×ano; JF por seção); DataJud (derivável); TJBA metas por unidade |
| **Produtividade associada a gabinete** | atos do gabinete (inclui assessoria) | TJES/TJRJ nomeiam gabinetes por desembargador em `orgaoJulgador`; STJ íntegras (`NM_MINISTRO` é o responsável pelo ato) |
| **Produção atribuída a uma pessoa** | atos por magistrado | TJSP (PDF mensal por magistrado×órgão); CNJ MPM 2015–2019 (painel); STJ íntegras; TRT3 "Produção dos Magistrados" (página localizada; formato não verificado) |

**Aviso metodológico:** o ato "assinado" por um magistrado não é equivalente à produção pessoal (juiz leigo, assessoria, mutirões, substituições, delegação). O STJ chama o campo de "relator **ou proferidor**".

## 5.2 Caminhos examinados (nacional)

- **Módulo de Produtividade Mensal (Provimento CNJ 49/2015).** Foi o sistema que coletou, **de 2015 a 2019**, produtividade e gestão processual das serventias e dos magistrados, antes do DataJud (Res. 331/2020). O painel de "dados de estrutura e produtividade 2015–2019" está listado na página de painéis (P09). Granularidade por magistrado **não verificada** (painel Qlik; não acessado).
- **A partir de 2020/2022:** o CNJ informa que Justiça em Números e produtividade são calculados automaticamente a partir do DataJud, "nível de sistema" e não por magistrado (TRF2/CNJ, Res. 331/2020) (P10).
- **Painel de Dados de Pessoal (MPM):** perfil funcional agregado (sexo, raça/cor, cargo, faixa etária, tempo de atuação) — **sem produtividade** (P07).
- **Variáveis agregadas por magistrado no Justiça em Números:** `SM` (sentenças/decisões terminativas por magistrado), `Cm` (casos novos por magistrado), `TAMJ*` (tempo de afastamento da jurisdição) — **média do tribunal**, não pessoa (P03).

## 5.3 Experimento obrigatório — três tribunais

| Tribunal | Abordagem | Resultado | Campos | Período | Identificador | Reprodução |
|---|---|---|---|---|---|---|
| **TJSP** | PDF mensal "Produtividade da 1ª e 2ª Instância" | **ENCONTRADO**: tabela `Seção · Magistrado · Órgão Julgador · Decisões · Decisões art. 557 CPC · Julgamento com mérito · Julgamento sem mérito · Homologações de Acordo`, com linha "total" por magistrado | 8 colunas; uma linha por magistrado×órgão | **2017–2022** (77 links: 2017–2021 12 meses; 2022 10 meses); 66 páginas em 04/2017 e 75 em 09/2022 | nome (sem ID) | PDF-tabela; extração tabular necessária. **A 1ª página do PDF de 09/2022 mostra zeros** — sinal de que a série perde qualidade ou foi interrompida; **não validado** |
| **TRT3** | portal Transparência: "Produção dos Magistrados" (1º e 2º grau), "Painel de produtividade" (Power BI), "Processos aptos a julgamento" | **LOCALIZADO**; conteúdo/formatos **não verificados** (HTML sem tabela; Power BI não acessado) | — | — | — | NÃO COMPROVADO |
| **STJ** | íntegras de decisões e acórdãos | **ENCONTRADO**: um registro por documento com `NM_MINISTRO`, `tipoDocumento`, `teor` (desfecho), `dataPublicacao`, `dataDistribuição`, `assuntos` | JSON diário | desde 04/01/2021 | nome do ministro + número do processo | JSON diário, ZIP de texto; 02/07/2025: 4.106 registros, 3.898 monocráticas e 208 acórdãos, 33 ministros distintos |

**Dificuldades de comparação:** unidades de medida diferentes (decisão, julgamento, ato); vara vs câmara vs gabinete; alterações de competência; ausência de código de unidade; PDFs.

**Não comprovado (continua):** sentenças por juiz de 1º grau em escala nacional; audiências realizadas; metas por magistrado; tempo de conclusão por pessoa; participação em mutirões.

---

# 6. STF e votos individuais

## 6.1 Mapa de fontes oficiais (todas com acesso testado do script: ver coluna "Acesso")

| Fonte | O que traz (segundo o próprio STF) | Acesso (teste) | Estado |
|---|---|---|---|
| Portal de Sessões de Julgamento (lançado em 21/08/2025) | todos os julgamentos colegiados (presenciais, virtuais, repercussão geral); filtros: período, **relator**, classe/número, colegiado (Plenário/Turma), tipo de sessão, **vista/destaque**; em sessões virtuais: lista de processos, **placar e votos proferidos** | `portal.stf.jus.br/sessoesjulgamento/` → 200 com corpo vazio (render JS) | EXISTE, PUBLICADO; COLETÁVEL não comprovado |
| Corte Aberta — Painel de Decisões v3.0 (29/10/2025) | decisões por ano, classe, tipo (recursais × originárias), "tempo para decisão", "lista de decisões", "partes"; atualização diária; botão "Exportar"; CSV/XLSX segundo notícias do STF | `transparencia.stf.jus.br/extensions/decisoes/decisoes.html` → HTML com "Conectando ao QlikSense"; `transparencia.stf.jus.br/` → 403 | EXISTE, PUBLICADO; ACESSÍVEL em navegador |
| Plenário Virtual (hotsite) | votos e relatórios após assinatura; sessões virtuais regidas pelo art. 21-B do RISTF e pelas Res. 642/2019 e 669/2020 | 200 com corpo vazio | EXISTE |
| Jurisprudência / processos | acórdãos, andamentos | `robots.txt`: `Disallow: /processos`; busca atrás de desafio anti-robô (P1) | RESTRITO à automação |
| Estudos | CNJ/FGV "Plenário Virtual STF" (PDF); base acadêmica USP/FAPESP (≈2 milhões de votos, 423 mil decisões desde 1988) | não obtida | lead |

**Nada foi contornado**: o `robots.txt` do STF só bloqueia `/processos`; as demais páginas respondem 200 sem conteúdo ao cliente sem navegador (renderização JS) ou 403, e isso foi tratado como bloqueio de acesso.

## 6.2 Contrato desejado ministro×julgamento×posição — o que é recuperável

| Campo | Recuperável? | Nível de confiança |
|---|---|---|
| `julgamento_id`, `processo_id`, `sessao_data` | Portal de Sessões (processo, sessão) | Alto, **se** houver acesso |
| `ministro_id` | nome; ID não observado | Médio (nome) |
| `voto_posicao` (acompanha relator / diverge) | Portal exibe "votos proferidos" e placar; formato estruturado **não verificado** | Desconhecido |
| `acompanhou_relator` | derivável do placar, se estruturado | Desconhecido |
| `divergencia` | filtros "vista/destaque" existem; tipo de divergência não verificado | Desconhecido |
| `voto_documento` | íntegra dos votos nas sessões virtuais (divulgada após a sessão, segundo o STF) | Alto (existência) |
| `voto_data` | em Plenário Virtual: data do voto | Alto (existência) |
| `alteracao_voto` | não comprovado | — |

**Diferenciação exigida:** voto explícito, acompanhamento explícito e declaração de voto aparecem no Plenário Virtual; "falta de manifestação = abstenção" é regra regimental (notícia); impedimento/ausência aparecem na ata/placar; resultado do colegiado sem individualização aparece no acórdão.

**Conclusão:** uma base histórica ministro×julgamento×posição **provavelmente existe nos sistemas do STF** (o painel mostra "votos proferidos"), mas **não foi demonstrado acesso nem formato**. Próximo passo realista: ofício ao STF pedindo o extrato do Portal de Sessões ou o CSV do Painel de Decisões (Corte Aberta). **Classificação: BLOQUEIO EXTERNO.**

---

# 7. STJ e exploração profunda dos datasets

## 7.1 Catálogo integral (21 datasets; CKAN `package_show` dos 21)

| Dataset | Recursos | Formato | Último update | Período | Frequência | Licença |
|---|---:|---|---|---|---|---|
| acervo-em-tramitacao | 2 | JSON.gz + dicionário | 08/10/2026 | foto diária (sem histórico no catálogo) | diária | CC-BY |
| api-publica-datajud | 2 | link/documentação | 11/06/2025 | — | — | — |
| atas-de-distribuicao | 1.027 | JSON diário + dicionário | 07/10/2026 | **2023-06-30** → 2026-10-07 (1.026 arquivos; salto entre 30/06 e 01/08/2023) | diária | CC-BY |
| diarias-e-passagens | 2 | CSV | 28/07/2025 | — | irregular | — |
| diarias-e-passagens-enfam | 2 | CSV | 26/08/2026 | — | — | — |
| espelhos-de-acordaos-{corte-especial, 1ª/2ª/3ª seção, 1ª–6ª turma} (10) | 54–55 cada | JSON mensal + ZIP inicial | 08/09/2026 | **2022-05** → 2026-08 | mensal | CC-BY |
| folha-de-pagamento-de-pessoal | 2 | CSV (108,6 MB) | 16/08/2026 | 2020-01 → 2026-07 | mensal | — |
| integras-de-decisoes-terminativas-e-acordaos-do-diario-da-justica | 2.641 | metadados JSON + texto ZIP | 08/10/2026 | **2021-01-04** → 2026-10-07 | diária | CC-BY |
| pautas-futuras | 58 | JSON.gz + dicionário | 08/10/2026 | **apenas desde 15/07/2026** (57 arquivos) | diária | — |
| penalidades-fornecedores | 2 | CSV | 08/10/2026 | 532 sanções | — | CC-BY |
| plano-estrategico-stj | 2 | CSV | 08/10/2026 | — | — | — |
| precedentes-qualificados | 4 | CSV (Processos 1,1 MB; Temas 2,6 MB) + dicionários | 08/10/2026 | — | — | CC-BY |

(Metadado "—" no campo de licença significa que o campo do CKAN veio vazio, não que a licença seja livre ou restritiva.)

## 7.2 D1 — Relatorias

- **Cobertura:** ata diária desde 30/06/2023 — **sem 2020–2022 nem julho/2023**; o acervo em tramitação é foto diária.
- **Forma de distribuição** (07/10/2026): Registro 1.770, Redistribuição 1.322, Distribuição 405. "Registro" aparece com `codigoOrgaoJulgador` nulo (50% do dia) — processos recebidos e ainda sem órgão julgador, muitos na Presidência.
- **Linha do tempo de relatores por processo:** as atas trazem `numeroUnico` + `descFormaDistribuicao` + relator + data/hora. Reconstruir a sequência "distribuição → redistribuição" **é possível a partir de jun/2023** e pela `dataUltimaDistribuicao` do acervo. **Não testado em amostra longitudinal** (apenas um dia).

## 7.3 D2 — Espelhos × íntegras

- Os espelhos cobrem "acórdãos cuja ementa mostre novidade quanto a teses ou à representatividade do relator/órgão" (texto do dataset). **São seleção editorial, não universo.**
- As íntegras cobrem "decisões terminativas indicadas pelos gabinetes" **e** acórdãos publicados no DJe.
- Comparação indicativa (sem valor de proporção): em 02/07/2025 há **208 acórdãos** nas íntegras (todos os órgãos) e **7 espelhos** publicados nesse dia nos três órgãos cujo arquivo de julho/2025 pôde ser aberto (3ª Turma 2, 6ª Turma 2, Corte Especial 3). A 3ª Turma tem 546 espelhos com decisão em 06/2025 no arquivo de 31/07/2025. **Proporção de cobertura não calculável com denominador válido** nesta rodada.

## 7.4 D3 — Votos (amostra, sem NLP)

Amostra: 6 arquivos mensais (3ª Turma 06/2023 e 06/2025; 6ª Turma 06/2024 e 06/2026; Corte Especial 06/2022 e 04/2025) = **1.952 acórdãos**. Contagens por **presença de palavra-chave** em `decisao`:

| Sinal no texto | Acórdãos | % |
|---|---:|---:|
| "unanim…" | 1.923 | 98,5% |
| "votaram com / acompanharam / acompanhou" | 1.896 | 97,1% |
| "maioria" | 33 | 1,7% |
| "vencid…" | 35 | 1,8% |
| "vista" | 37 | 1,9% |
| "divergên…" | 8 | 0,4% |
| "ausen… / impedid… / licen…" (**limite superior**, regex amplo) | 151 | 7,7% |
| `decisao` vazia | 1 | 0,05% |

Estrutura textual observada (nomes mascarados): `acordam os Ministros da <ÓRGÃO> … por unanimidade, <DISPOSITIVO>, nos termos do voto do Sr. Ministro <NOME> … <NOME>, <NOME> e <NOME> votaram com o Sr. Ministro <NOME>`; para maioria: `…após o voto-vista do Sr. Ministro <NOME>, inaugurando a divergência, por maioria… com ressalva… vencido o Sr. Ministro <NOME>`.

**Leitura:** unanimidade/maioria, relator, quem acompanhou, vencidos e vista são **recuperáveis do texto com alta regularidade**; ausências/impedimentos são ambíguos pelo regex. Decisões **monocráticas** não têm votação.

## 7.5 D4 — Vínculo ministro × atas × composição × remuneração

Experimento (07/2026, anonimizado):

| Conjunto | Valores | Casam com a folha por tokens | Exato (texto) | Observação |
|---|---:|---|---:|---|
| Folha — ministros em 07/2026 | 61 (32 ativos + 29 aposentados; 1 afastado) | — | — | `Lotação`: gabinete do ministro; aposentados: "Aposentado" |
| Ata 07/10/2026 `nomeMinistroRelator` | 35 | **29 únicos, 0 ambíguos**, 6 sem match | 9 | os 6 sem match são cargos ou convocados ("Presidente do STJ", "Vice-Presidente", "Presidente da Terceira Seção", "Desembargador(a) convocado(a)…") |
| Íntegras 02/07/2025 `NM_MINISTRO` | 33 | 30 únicos, 0 ambíguos, 3 sem match | 11 | |
| Espelhos amostrados `ministroRelator` | 21 | 18 únicos, 0 ambíguos | 6 | |

**Chave:** combinação `matrícula (folha)` ↔ nome do ministro (token-subset do nome curto em nome completo) ↔ `Lotação` do gabinete. Igualdade textual exata falha (9/35 na ata), o que reforça que **não** se deve depender de igualdade de strings. Vínculo classificado como **ALTAMENTE PROVÁVEL para ministros** (nenhuma ambiguidade em 61 ministros no mês), **DETERMINÍSTICO** apenas para a ligação folha↔gabinete (a lotação repete o nome). Ministros convocados, interinos e cargos de direção exigem regra própria.

## 7.6 D5 — Litigantes (ata de 07/10/2026)

- 3.497 distribuições; **13.038 partes**; **5.304 com `numeroCNPJ`** (40,7% das partes); 2.573 CNPJs distintos; os 10 CNPJs mais frequentes ocupam 1.149 das 5.290 ocorrências processo×CNPJ (21,7%).
- **Papéis processuais** (`descTipoParte`): Agravante 4.833, Agravado 3.898, Interessado 1.652, Paciente 509, Impetrante 496, Impetrado 496, Recorrido 291, Recorrente 268. **CNPJ por papel:** Agravado 1.947, Agravante 1.451, Interessado 944, Impetrado 482, Recorrido 167, Impetrante 114, Recorrente 104.
- **Advogados:** 12.520 registros, 12.272 (98%) com número OAB — dado pessoal de profissional; **não usar** como litigante.
- **Utilidade real:** concentração por ente (MP estadual, União, INSS, bancos) é mensurável; ainda é preciso separar **parte**, **órgão de origem** e **representante** (o MP e a Fazenda aparecem também como "Interessado"). Pessoas físicas **não** devem ser expostas (sem CNPJ).

---

# 8. Justiça em Números e estatísticas oficiais

## 8.1 O que existe (RESOLVIDO no nível tribunal×ano)

| Item | Observado |
|---|---|
| Página de origem | `cnj.jus.br/pesquisas-judiciarias/justica-em-numeros/` (links `.zip` 2024, 2025, 2026) e `cnj.jus.br/base-de-dados/` (P03) |
| Arquivos do ZIP de 17/09/2026 (4,25 MB) | `JN_23-Jun-2026.csv` (11,6 MB), `Variáveis - JN.csv` (90,7 KB), `BD_Consolidado_JF_Secao_23_Jun_2026.csv` (331 KB). Datas internas: base de **23/06/2026** (o ZIP de 17/09 reempacota a mesma data) |
| Granularidade | tribunal×ano: 1.595 linhas; 17 anos (2009–2025); 99 siglas (inclui agregados `TJ`, `TRF`, `TRT`, `TRE`, `JMU`, `AudM`, `TJM`, `nd`); 8 ramos (Estadual 476, Trabalho 425, Eleitoral 420, Federal 108, Superior 64, Militar Estadual 60, Militar da União 42) |
| Colunas | 1.314 (dicionário com 1.313 variáveis), separador `;`, decimal `,`, `nd` = não disponível, codificação Latin-1 |
| Por seção judiciária (Justiça Federal) | 613 linhas, 2012–2025, 30 seções, 121 colunas (casos novos/pendentes/suspensos/baixados) |
| Metodologia | `DEA 2.R` (7 KB) oficial: baixa `23-jun-2026.zip`, lê `JN_*.csv` e `BD_Consolidado_JF_Secao_*.csv` com `na.strings="nd"` — o uso programático da base é previsto |
| Preenchimento (TJES 2024) | 762 de 1.314 variáveis preenchidas (58%); `nd` em STJ/STM-específicas e em variáveis de outros ramos |

## 8.2 Reconciliação com agregações do DataJud (um tribunal, um ano)

TJES 2024 — "casos novos" do CNJ (`Cn*`) × contagem DataJud por `dataAjuizamento` em 2024 (`_count`, P03/P36):

| Grau | CNJ (casos novos) | DataJud (documentos com `dataAjuizamento` em 2024) | DataJud/CNJ |
|---|---:|---:|---:|
| 2º grau | `Cn2` 43.624 | G2 39.624 | 90,8% |
| Turma Recursal | `CnTR` 22.910 | TR 23.013 | 100,4% |
| Juizados Especiais | `CnJE` 146.415 | JE 125.364 | 85,6% |
| 1º grau | `Cn1` 205.189 (definição exata não verificada) | G1 137.982 | 67,2% |

**Leitura:** o DataJud não reproduz as estatísticas oficiais sem a metodologia (as definições de "casos novos" do CNJ não foram conferidas aqui; o DataJud exclui sigilosos e tem datas inválidas). Usar a base oficial para KPIs e o DataJud para **estrutura, ritmo e linha do tempo**. **Esta é uma verificação pontual, não generalizável.**

## 8.3 Entrega — KPI × fonte × ano inicial × periodicidade × granularidade × extração × comparabilidade

| KPI | Fonte | Ano inicial | Periodicidade | Granularidade | Método de extração | Comparabilidade |
|---|---|---|---|---|---|---|
| Casos novos (`Cn`, `Cn1`, `Cn2`, `CnJE`, `CnTR`, por tipo) | JN CSV | 2009 (varia por variável) | anual | tribunal; JF por seção | download ZIP/CSV | alta dentro do ramo; mudanças de metodologia (2020+ via DataJud) |
| Casos pendentes (`Cp*`) | JN CSV | 2009 | anual | idem | idem | idem |
| Processos baixados (`TBaix*`) | JN CSV | 2009 | anual | idem | idem | idem |
| Taxa de congestionamento (`TC`) | JN CSV | 2009 | anual | idem | idem; **reproduzível** `Cp/(Cp+TBaix)` | alta |
| Índice de atendimento à demanda (`IAD`) | JN CSV | 2009 | anual | idem | idem | alta |
| Tempo médio (`TpBaix*`, `TpCp*`, `TpSent*`; média, desvio, mediana, nº de processos) | JN CSV | 2015+ (varia) | anual | tribunal; por fase/grau | idem | média; mediana frequentemente `nd` |
| Suspensos e por tema (`Sus*`, `SuSRG`, `SuSRR`, `PeSuS`) | JN CSV | recente | anual | tribunal/grau | idem | média |
| Magistrados (`Mag`, `Mag1`, `MagJE`, `MagTR`, `MagIn`, `F2`) | JN CSV | 2009 | anual | tribunal/grau | idem | alta |
| Servidores e pessoal (`TPEfet`, `TPSV`, `TPAf`, `TPTIC`…) | JN CSV | 2009 | anual | tribunal/grau/área | idem | alta |
| Despesa (`Dpj`, `DServ`, `DBen`, `G1`, `G2`, `I6`) | JN CSV | 2009 | anual | tribunal | idem | média (rubricas) |
| Orçamento (`ODP`, `OOC`, `OK`) | JN CSV | 2009 | anual | tribunal | idem | média |
| Casos novos/pendentes por Grande Litigante | Painel CNJ "Grandes Litigantes" | recente | atualizado | 20 maiores por tribunal e por unidade | Qlik (sem exportação verificada) | não aplicável |
| Perfil de pessoal por tribunal | Painel MPM | mai/2023 | diária (dados mensais) | tribunal/estado/ramo | Qlik (agregado) | não aplicável |
| Produtividade por magistrado (2015–2019) | Painel MPM antigo | 2015 | mensal | magistrado? (**não verificado**) | Qlik | não aplicável |

**Respostas às 10 perguntas:**
1. Tabelas anuais por tribunal: **sim**. 2. Dados mensais: **não** na base pública (DataJud permite derivar). 3. Por vara: **não** na base; TJBA publica metas por unidade. 4. Força de trabalho: **sim** (tribunal). 5. Histórico nacional padronizado: **sim**, 2009–2025. 6. Numeradores e denominadores: **sim**. 7. Reconciliação com DataJud: **parcial** (8.2). 8. Séries de orçamento/despesa: **sim**, por tribunal×ano. 9. Datasets estaduais mais profundos: **parcial** (Parte 11). 10. Exportação oficial sem automação não autorizada: **sim** (download direto do ZIP, previsto pelo próprio script oficial do CNJ).

---

# 9. Remuneração e reconciliação de identidade

## 9.1 O que a P2 acrescentou

- **STJ (CSV oficial):** 07/2026 — 61 ministros (Ministro Ativo 32, Ministro Aposentado 29); `CategoriaVinculo` distingue servidor ativo/aposentado e ministro ativo/aposentado; `TipoServidor`, `Situacao`, `Acumula folha`; **15 colunas de valores**, inclusive "Remuneração do Órgão de Origem". Permite separar ativos/aposentados/pensionistas.
- **Painel CNJ / DadosJusBr:** nada novo além da P1; **não** foi reexecutada a medição de meses ausentes. Normas: Res. CNJ 681/2026 (contracheque único), Portaria 244/2026.
- **Mudanças funcionais:** observáveis na série mensal do STJ (mudança de `Cargo` e `Lotação`); retificações e alterações de nomenclatura **não** foram testadas.

## 9.2 Experimento de reconciliação (folha ↔ lotação ↔ atos)

| Vínculo | Chaves observadas | Classe |
|---|---|---|
| Folha ↔ lotação (STJ) | mesma linha: `cd_matricula`, `Nome`, `Lotação` | **DETERMINÍSTICO** |
| Folha ↔ relatoria (ata) | token-subset do nome curto em nome completo (únicos 29/29 casados) | **ALTAMENTE PROVÁVEL** |
| Folha ↔ atos (íntegras `NM_MINISTRO`) | idem (30 de 33 únicos) | **ALTAMENTE PROVÁVEL** |
| Folha ↔ espelho (`ministroRelator`) | idem (18 de 21) | **ALTAMENTE PROVÁVEL** |
| Cargo/convocado ↔ pessoa | cargo de direção, convocado de outro tribunal | **AMBÍGUO/NÃO COMPROVADO** |
| DadosJusBr/painel ↔ DataJud gabinete | texto do gabinete em 2º grau (TJES/TJRJ) | **AMBÍGUO** (varia por tribunal) |

---

# 10. Estrutura e hierarquia das unidades

## 10.1 Teste em oito tribunais

| Tribunal | O que foi testado | Resultado |
|---|---|---|
| **TJBA** | API `unidades` (1.782) / `comarcas` (241) / `metas` | `codCnjUnidade` = `orgaoJulgador.codigo` do DataJud (**P1, E09**) |
| **TJRJ** | `…/orgaoservicepub/api/ServicoPub/{Comarca,Orgao}`, 41 páginas × 50 | 83 comarcas (`codComarca`, `nome`, `nomeReduzido`, `codNur`), **1.976 órgãos** lidos (de 2.026; 1 página falhou) com `ativo` S 1.556 / N 420; `pageSize` máximo 50. **`codOrg` ≠ código DataJud**: dos 300 códigos mais ativos do DataJud em 07/10/2026, apenas 1 coincide numericamente com `codOrg`, e o nome é incompatível — **colisão, não correspondência**. Os nomes dos gabinetes citam o desembargador |
| **TJES** | DataJud (409 códigos, 69 IBGE); página "Comarca/Unidade/Magistrado" | cadastro público estruturado não obtido |
| **TJMG** | páginas de composição de câmaras; sem API localizada | NÃO COMPROVADO |
| **TJSP** | DataJud (nome com comarca e IBGE); sem API localizada | NÃO COMPROVADO |
| **TRF1** | páginas institucionais (manuais em PDF) | NÃO COMPROVADO |
| **TRT3** | portal com lista de situação funcional (ODS) e "Produção" | unidades: NÃO COMPROVADO |
| **TRT15** | páginas "Fixações (varas e juízes vinculados)", "Fóruns", "Unidades Especializadas" | HTML por nome ("VT <município> (n)"), **sem código CNJ** |

**Cadastro canônico nacional com histórico:** o MPM mantém "Cadastro de Serventias" com **código e tipo** (`AADJ`, `UJ1`…), classificações (47 tipos de unidade) e competências do juízo (40) — as **tabelas auxiliares são públicas** (`tabelas-auxiliares-mpm.xlsx`) mas **não a lista de serventias**. Sem ela, a conciliação é por tribunal: viável quando existe API (TJBA, TJRJ com mapeamento próprio) e custosa onde não existe.

**Conclusão:** hierarquia tribunal→grau→unidade→município é montável **só pelo DataJud**; hierarquia comarca→vara e histórico exigem fonte do tribunal (TJBA, TJRJ) ou do CNJ.

---

# 11. Gastos, execução financeira e fornecedores

| Camada | Fonte testada | Resultado |
|---|---|---|
| Orçamento autorizado/despesas por tribunal | **Justiça em Números** (`ODP`, `OOC`, `OK`, `Dpj`, `DServ`…) | **ACESSÍVEL** (tribunal×ano) |
| Empenho/liquidação/pagamento — federal | Portal da Transparência (CGU) arquivo mensal de despesas (09/2026, 7,1 MB, 65.634 linhas, 47 colunas; empenhado, liquidado, pago) | **Não inclui o Judiciário**: só 35 órgãos superiores do Executivo/Presidência/AGU/CGU/BC; **sem favorecido** |
| Execução orçamentária do Judiciário federal | CNJ "Execução orçamentária dos órgãos do Poder Judiciário integrantes do OGU" (PDF de 1 página por ano, 2012–2015 observados) | PUBLICADO em PDF; atualidade não verificada |
| Execução detalhada (SIOP, Siga Brasil, Tesouro Transparente) | pesquisa apenas | **não testado** em dado |
| STJ — sanções a fornecedores | CSV, 532 linhas: `fornecedor_nome_razao_social`, `CPF_CNPJ`, `penalizacao`, `desc_motivo_penalizacao`, `ato_sancionador`, `data_fim_penalidade` | **COMPROVADO** (CNPJ/CPF; separar PF) |
| STJ — diárias e passagens | CSV com dicionário (07/2025) | existe; não inspecionado em conteúdo |
| Contratos | PNCP (P1) | cobertura baixa; sem pagamento |
| Estado — TJSP | execução "importada do SIAFEM/SP, atualizada diariamente; analítica, atualização mensal" (portal do TJSP) | **não testado** (página dinâmica) |
| Estado — ES | Portal da Transparência-ES: "todos os dados em CSV pela funcionalidade de Baixa da Base de Dados" (empenhos, contratos) | **não testado** com filtro do TJES |
| TJSC | "dashboards interativos e relatórios em Excel" de execução da despesa | não testado |
| TJMG | relatórios de execução orçamentária e financeira | não testado |

**Pergunta central — "quanto cada tribunal pagou, a quem, quando, por qual objeto?"** **Não demonstrado.** O que está provado: despesa **agregada** por tribunal×ano (JN) e contratos/sanções **com CNPJ** (PNCP, STJ). Pagamento por favorecido exige SIAFI/SIOP/Siga (federal) ou SIAFEM estaduais — **pistas, não evidência**.

---

# 12. Grandes litigantes

| Fonte | Conteúdo | CNPJ | Granularidade | Acesso |
|---|---|---|---|---|
| **Painel CNJ "Grandes Litigantes"** | processos **novos e pendentes** dos 20 maiores litigantes de cada tribunal (estadual, federal, trabalho) e **por unidade judiciária**; comparação com o ano anterior | não verificado | tribunal/unidade/ano | Qlik; exportação não verificada |
| STJ ata/acervo | partes com CNPJ | **sim** (40,7% das partes) | processo | JSON diário, CC-BY |
| TSE partes (2024) | 180.099 linhas lidas nos primeiros 3 MB comprimidos (arquivo de 110 MB): `DS_POLO`, `TP_PARTE` (112 valores), `ST_PARTE_PRINCIPAL`, `NM_PARTE`, `NM_SOCIAL_PARTE`, `ST_CANDIDATO`, `SQ_CANDIDATO` | **não** | processo | CSV ZIP, atualizado 08/10/2026 |
| DataJud | sem partes | — | — | — |

`SQ_CANDIDATO` é chave potencial para o cadastro de candidatos do TSE (já presente em dados eleitorais), mas a parte pessoa física **não deve ser exposta**.

**Estados:** painel — EXISTE, PUBLICADO, ACESSÍVEL (navegador); COLETÁVEL não comprovado. STJ — EXISTE, PUBLICADO, ESTRUTURADO, COLETÁVEL, RELACIONÁVEL (CNPJ), HISTÓRICO (desde 2023-06); GENERALIZÁVEL: não.

---

# 13. Limitações jurídicas e operacionais

**Texto primário lido:** *Termo de Uso da API Pública do DataJud, v1.2, 27/11/2023* (PDF oficial) (P01). **Versão vigente:** a busca indica a v1.2 como a vigente e a Portaria CNJ 374/2026 (14/08/2026) alterando a Portaria 160/2020; **não** foi encontrada v1.3.

| Tema | Cláusula (literal resumida) | Tipo |
|---|---|---|
| Finalidade | 3.3 "exclusivamente para fins legais, **não comerciais** e autorizados" | **Restrição expressa** |
| Distribuição | 3.8 "não modificar, distribuir, vender ou explorar comercialmente a API ou **qualquer informação derivada dela**" | **Restrição expressa**; aplicação a estatísticas agregadas = **interpretação a esclarecer** |
| Comunicação | 3.9 dar ciência ao CNJ de "qualquer informação, notícia, estudo, relatório ou documento… disponibilizado ao público" | **Obrigação expressa** |
| Pessoas | 3.11 "não usar a API para coletar informações pessoais de terceiros"; 4.2 "não coletar, armazenar ou processar dados pessoais originários da API ou realizar **cruzamentos de informação para esse fim**, exceto conforme a LGPD"; 4.6 não compartilhar dados pessoais | **Restrição expressa** — afeta qualquer perfil individual a partir do DataJud |
| Limite | 3.13 "**120 requisições por minuto**", salvo autorização escrita; 3.14 e 3.15 (limitar, não sobrecarregar) | **Restrição expressa** |
| Acesso | 3.17 não contornar segurança/autenticação; 3.18 não fazer **engenharia reversa** da interface | **Restrição expressa** |
| Garantia | 3.6 sem garantia de precisão, integridade ou atualidade | expressa |
| Alteração | 3.4, 3.22: o CNJ pode modificar/revogar sem aviso | expressa |
| Dados do DataJud | 2.1 "metadados processuais relativos aos processos **públicos**" | expressa |
| Foro | 5.1 Brasília/DF | expressa |

**Fontes não-DataJud:** STJ — catálogo CKAN declara **CC-BY** para atas, espelhos, íntegras, acervo, precedentes e penalidades (**atribuição de fonte obrigatória**). TSE, CNJ (JN), DadosJusBr e PNCP: **licença não verificada**. A base JN está publicada para download e o próprio script do CNJ a baixa. STF: robots (`Disallow: /processos`), 403/render JS.

**O que precisa de advogado/CNJ:** (a) publicar agregados derivados do DataJud em produto público (3.3/3.8); (b) comunicar estudos ao CNJ (3.9) e **como**; (c) tratar dados nominais de magistrados a partir de bases públicas (LGPD, finalidade, 4.2); (d) uso de nomes de agentes públicos em folha vs. estatísticas; (e) pedido formal de aumento de cota; (f) acordo de cooperação técnica (modelo: ACT 079/2021 entre Transparência Brasil e CNJ, citado na P1); (g) licença de TSE/CNJ/DadosJusBr.

**Limitações técnicas** (reiteradas): API DataJud lenta e instável (P1); Qlik/Power BI não automatizáveis sem autorização; PDFs tabulares do TJSP; STF por navegador.

---

# 14. Dicionário de novos campos descobertos

| Fonte | Campo | Significado | Observação |
|---|---|---|---|
| JN CSV | `ano`, `justica`, `sigla`, `seq_orgao` | chave tribunal×ano | `nd` = não disponível |
| JN CSV | `cn`, `cn1`, `cn2`, `cnje`, `cntr`, `cnc1`… | casos novos por grau/tipo | |
| JN CSV | `cp`, `cp1`, `cp2`, `cpje`, `cptr`… | casos pendentes | |
| JN CSV | `tbaix`, `tbaix1`, `tbaix2`, `tbaixje`… | processos baixados | |
| JN CSV | `tc`, `iad`, `ch`, `sm`, `cm` | taxa de congestionamento; IAD; casos novos por 100 mil hab.; sentenças por magistrado; casos novos por magistrado | `TC=Cp/(Cp+TBaix)` no exemplo |
| JN CSV | `tpbaixm`, `tpbaixp`, `tpbaixmd`, `tpbaixdp` | tempo médio, nº de processos, mediana, desvio | mediana e desvio frequentemente `nd` |
| JN CSV | `mag`, `mag1`, `magje`, `magtr`, `magin`, `tamj1` | magistrados atuantes/cargos/inativos; afastamento da jurisdição | |
| JN CSV | `tpefet`, `tpsv`, `tpaf`, `tptic` | pessoal efetivo, sem vínculo, afastado, TI | |
| JN CSV | `dserv`, `dpj`, `dben`, `odp`, `ook`, `g1`, `g2` | despesas e orçamento | |
| JN Seção | `chave`, `secao`, `trib` | `TRF1_DF_2012`, UF da seção | |
| MPM | CPF, nome, nascimento, órgão de lotação, `seq_cargo`, `seq_situacao`, data de início/saída da situação, forma/data de promoção, afastamentos, sexo, raça/cor, cota | cadastro de magistrados | **interno**; só tabelas auxiliares públicas |
| MPM aux. | `seq_tipo_unidade`/`sigla` (`AADJ`, `UJ1`…), `seq_classificacao_unid`, `seq_competencia` (40) | tipologia de unidades | público |
| STJ íntegras | `SeqDocumento`, `dataPublicacao`, `tipoDocumento`, `numeroRegistro`, `processo`, `dataRecebimento`, `dataDistribuição`, `NM_MINISTRO`, `recurso`, `teor`, `descricaoMonocratica`, `assuntos` | metadados do ato | `descricaoMonocratica` com placeholder `#{nome_da_parte}` |
| STJ ata | `numeroUnico`, `numeroRegistro`, `dataHoraDistribuicao`, `descFormaDistribuicao`, `codigoClasseCNJ`, `codigoOrgaoJulgador`, `nomeMinistroRelator`, `codigoAssuntoCNJ`, `partes[]` | distribuição | `partes[].{descTipoParte, nomeParte, numeroCNPJ, advogados[].{codigoOAB, nomeAdvogado}}` |
| STJ pautas | `numeroUnico`, `dataSessão`, `dataPublicacaoPauta`, `orgaoJulgador`, `Relator`, `partes`, `segredoJustica` | pauta futura | |
| STJ penalidades | `fornecedor_nome_razao_social`, `CPF_CNPJ`, `penalizacao`, `desc_motivo_penalizacao`, `ato_sancionador`, `data_fim_penalidade` | sanção | |
| STJ folha | `Lotação`, `cd_matricula`, `Cargo`, `Nome`, `TipoServidor`, `Situacao`, `CategoriaVinculo`, `Acumula folha`, 15 valores | folha | UTF-8 |
| TSE partes | `DS_POLO`, `TP_PARTE`, `ST_PARTE_PRINCIPAL`, `NM_PARTE`, `SQ_CANDIDATO` | partes eleitorais | sem CNPJ |
| TJRJ API | comarca: `codComarca`, `nome`, `nomeReduzido`, `nomeWeb`, `codComarcaPrincipal`, `codNur`, `nomeNur`; órgão: `codOrg`, `nome`, `codComarca`, `ativo` | unidades | |
| TJSP PDF | `Seção`, `Magistrado`, `Órgão Julgador`, `Decisões`, `Decisões art. 557`, `Julgamento com mérito`, `Julgamento sem mérito`, `Homologações de Acordo` | produtividade 2º grau | PDF |
| Portal CGU | 47 colunas incl. `Valor Empenhado/Liquidado/Pago (R$)`, `Código/Nome Órgão Superior/Subordinado`, `Nome Autor Emenda` | despesas | sem favorecido |

---

# 15. Matriz de cobertura e granularidade atualizada

| Domínio | Nacional | Tribunal | Unidade | Pessoa | Processo | Financeiro | Histórico |
|---|---|---|---|---|---|---|---|
| KPIs oficiais (JN) | COMPROVADO | COMPROVADO (2009–2025) | COMPROVADO só JF por seção | INDISPONÍVEL | n/a | despesa agregada COMPROVADA | COMPROVADO |
| Processos (DataJud) | COMPROVADO (P1) | COMPROVADO | COMPROVADO | INDISPONÍVEL | COMPROVADO | n/a | estoque 2020+ |
| Estrutura (unidades) | PARCIAL | PARCIAL | COMPROVADO só TJBA/TJRJ (códigos próprios) | n/a | n/a | n/a | NÃO COMPROVADO |
| Cadastro de magistrados | EXISTE (MPM), RESTRITO | PARCIAL (STJ, TRT15, TRT3, TJSC) | PARCIAL (texto) | COMPROVADO no STJ (matrícula) | n/a | n/a | PARCIAL (STJ mensal; TRT15 datas) |
| Produtividade individual | RESTRITO/NÃO COMPROVADO | PARCIAL (TJSP, STJ) | PARCIAL | COMPROVADO no TJSP (PDF) e STJ (documentos) | n/a | n/a | TJSP 2017–2022; STJ 2021+ |
| Votos | INDISPONÍVEL | STJ PARCIAL (texto); STF RESTRITO | colegiado | STJ PARCIAL | COMPROVADO (STJ) | n/a | STJ 2022+ |
| Remuneração | PARCIAL | COMPROVADO (STJ) | PARCIAL | COMPROVADO (STJ) | n/a | COMPROVADO | STJ 2020-01→ |
| Gastos/fornecedores | PARCIAL | agregado COMPROVADO | NÃO COMPROVADO | n/a | n/a | contrato/sanção COMPROVADOS; **pagamento NÃO** | PNCP 2023+ |
| Litigantes | PARCIAL (painel) | PARCIAL | n/a | n/a (PF fora) | STJ COMPROVADO | n/a | STJ 2023-06+ |

---

# 16. Oportunidades de páginas do Cívica

| Página | Muda com a P2? | Nova base |
|---|---|---|
| `/judiciario` e `/judiciario/tribunais` | **Sim, melhora muito**: KPIs oficiais 2009–2025 sem DataJud; seção da JF | JN CSV (+ DataJud para estrutura/ritmo) |
| `/judiciario/tribunais/[id]` | JN por ano; TJBA/TJRJ para unidades | JN, TJBA, TJRJ |
| `/judiciario/magistrados` e `/[id]` | **STJ completo** (folha, gabinete, relatorias, decisões/dia, acórdãos com votação); outros tribunais só com lista pública (TRT15/TRT3/TJSC piloto) | STJ CKAN; listas de tribunais |
| `/judiciario/processos` | sem mudança | DataJud |
| `/judiciario/julgamentos` | STJ (pauta, acórdãos, votação em texto); STF depende de acesso | STJ; STF a obter |
| `/judiciario/gastos`, `/fornecedores` | agregado por tribunal (JN); sanções STJ com CNPJ; contratos PNCP; **pagamentos continuam sem fonte** | JN, STJ, PNCP |
| `/judiciario/litigantes` | STJ por CNPJ; painel CNJ (a obter) | STJ ata |

## 16.1 Novas oportunidades de granularidade (real / acessível / estruturada / relacionável)

| Oportunidade | Real | Acessível | Estruturada | Relacionável | Dados necessários para um indicador |
|---|---|---|---|---|---|
| Decisões por ministro/dia (monocráticas × acórdãos) | sim | sim | sim | nome↔folha | `NM_MINISTRO`, `tipoDocumento`, `teor`, data |
| Relatorias e redistribuições | sim | sim | sim | `numeroUnico` | ata (desde 2023-06) |
| Pautas futuras (carga prevista por relator/órgão) | sim | sim | sim | `numeroUnico` | pautas (janela de ~3 meses) |
| Acervo por ministro | sim | sim | sim | `numeroUnico` | acervo diário (sem histórico) |
| Precedentes qualificados / processos suspensos por tema | sim | sim | sim | `numeroUnico`/tema | `Processos.csv`, `Temas.csv`; JN `SuSRG/SuSRR` |
| Sanções a fornecedores | sim | sim | sim | CNPJ | penalidades (532) |
| Tempo até decisão (STF) | sim (Painel Corte Aberta) | navegador | sim | processo | exportação a obter |
| Sessões do STF e vista/destaque | sim (Portal de Sessões) | navegador | desconhecido | processo | extrato a obter |
| Produtividade histórica de unidades | sim (MPM 2015–2019) | painel | agregado | sem código | extrato a obter |
| Quantitativo de servidores por unidade | sim (MPM) | só agregado tribunal | agregado | — | extrato do MPM |
| Execução orçamentária por natureza | sim (SIAFI) | não testado | — | — | Siga/SIOP |
| Composição de colegiados e substituições | parcial (MPM e atas) | não público | — | — | MPM; atas de sessão |

---

# 17. Fontes, endpoints e evidências reproduzíveis

Chave DataJud: pública na Wiki, **omitida**. Todas as consultas HTTP usaram `User-Agent` de navegador simples; nenhuma exigiu autenticação além da chave pública do DataJud.

| ID | Evidência |
|---|---|
| **P01** | `GET https://formularios.cnj.jus.br/wp-content/uploads/2023/11/Termos-de-uso-api-publica-V1.2.pdf` → 200 (108 KB; texto lido integralmente: cláusulas 1–5). WebFetch recebeu 403; `curl` obteve |
| **P02** | `GET https://atos.cnj.jus.br/atos/detalhar/6972` (Portaria 374/2026; P1/E17) e resultados de busca sobre v1.2 vigente |
| **P03** | `GET https://www.cnj.jus.br/wp-content/uploads/2026/09/17-set-2026.zip` (4.248.663 B; `Last-Modified` 17/09/2026): `JN_23-Jun-2026.csv` 11.605.523 B (1.596 linhas, 1.314 colunas), `Variáveis - JN.csv`, `BD_Consolidado_JF_Secao_23_Jun_2026.csv`. Também `…/2026/06/23-jun-2026.zip` (4.248.648 B; 30/06/2026), `…/2026/01/15-jan-2026.zip` (3.960.388 B), `…/2024/08/basejn-03-jun-2024.zip` (3.612.812 B) |
| **P04** | `…/2026/06/dea-jn2026.zip` (2.099 B): `DEA 2.R` baixa `23-jun-2026.zip` e lê os CSVs |
| **P05** | `GET https://www.cnj.jus.br/pesquisas-judiciarias/justica-em-numeros/` e `…/base-de-dados/` (200): links para ZIP e relatórios PDF 2003–2026 |
| **P06** | `GET https://cnj.jus.br/wp-content/uploads/2024/07/manual-mprodutividade-2024.pdf` (manual MPM; campos chave CPF/órgão de lotação/cargo/situação; histórico de situações; promoção; afastamentos) |
| **P07** | `https://www.cnj.jus.br/wp-content/uploads/2024/04/lancamento-do-painel-dados-de-pessoal-do-poder-judiciario.pdf` (painel de pessoal; "cadastro nacional de unidades judiciárias, magistrados…"; `justica-em-numeros.cnj.jus.br/painel-mpm-pessoal/`) |
| **P08** | `GET https://www.cnj.jus.br/pesquisas-judiciarias/modulo-de-produtividade-mensal/documentacao/` → links: `mpm.cnj.jus.br`, `…/2025/04/tabelas-auxiliares-mpm.xlsx` (51.846 B, 16 abas), modelos em `api-s3.cloud.cnj.jus.br/publico/mpm-pessoal/` (**502**), FAQ PDF |
| **P09** | `GET https://www.cnj.jus.br/pesquisas-judiciarias/paineis-cnj/` (descrições dos painéis: Grandes Litigantes, Pessoal MPM, Módulo de Produtividade 2015–2019) |
| **P10** | `GET https://www.trf2.jus.br/trf2/noticia/2024/datajud-justica-em-numeros-e-produtividade-serao-alimentados-automaticamente` (Res. 331/2020; automação desde jul/2022) |
| **P11** | `GET https://atos.cnj.jus.br/atos/detalhar/2175` (Provimento CNJ 49/2015; resultado de busca) |
| **P12** | TRT15: `…/institucional/estrutura-do-tribunal/{fixacoes-varas-e-juizes-vinculados, magistrados-inativos, juizes-titulares-de-vara-do-trabalho, juizes-do-trabalho-substitutos}` (200) |
| **P13** | `GET https://dadosabertos.web.stj.jus.br/api/3/action/package_list` (21) e `package_show` dos 21; licença `cc-by` |
| **P14** | `…/metadados20250702.json` (2.265.667 B; 4.106 registros) e `textos20250702.zip` (16.267.588 B, **não baixado**); dicionário `dicionariointegrasdecisoes.csv` |
| **P15** | Folha: `…/folhadepagamento.csv`, faixas de bytes (cabeçalho 0–1.500 e últimos 4 MB); 13.899 linhas lidas; 07/2026 |
| **P16** | Ata `ata20261007.json` (3.497 registros) e amostras de íntegras/espelhos para a reconciliação |
| **P17** | Espelhos: `…/espelhos-de-acordaos-{terceira-turma,sexta-turma,corte-especial}/…/{20230630,20250731,20240630,20260731,20250430,20220630}.json` (1.952 acórdãos) |
| **P18** | `GET http://www.tjsp.jus.br/produtividadeweb/` (77 links PDF 2017–2022); `…/Download/Transparencia/PrudSegundaInstancia/2017/ProdSegundaInstAbril2017.pdf` (267.579 B; 66 páginas) e `…/2022/ProdSegundaInstSetembro2022.pdf` (1.420.621 B; 75 páginas) |
| **P19** | `https://noticias.stf.jus.br/postsnoticias/stf-lanca-portal-com-dados-de-todas-as-sessoes-de-julgamentos/` (21/08/2025); `https://portal.stf.jus.br/sessoesjulgamento/` (200, corpo vazio) |
| **P20** | `https://transparencia.stf.jus.br/extensions/decisoes/decisoes.html` (Painel de Decisões v3.0, 29/10/2025); `https://transparencia.stf.jus.br/` (403); `https://portal.stf.jus.br/robots.txt` |
| **P21** | `GET https://www3.tjrj.jus.br/orgaoservicepub/api/ServicoPub/Comarca` (83 comarcas); `…/Orgao?pageSize=50&pageNumber=n` (n=1..41; 1.976 órgãos lidos) |
| **P22** | DataJud `POST …/api_publica_tjrj/_search` com `size:0` e agregação `orgaoJulgador.codigo` (300 códigos; 22 s) |
| **P23** | TRT3: `…/transparencia/producao-dos-magistrados`, `…/pessoal-1/situacao-funcional-dos-magistrados-ativos-do-quadro-de-pessoal-do-orgao-a-partir-de-2022` (tabela: "PDF e ODS", quadrimestral) |
| **P24** | TJSC: `https://www.tjsc.jus.br/lotacao-de-magistrados` (200) e `…/orcamento-e-financas/execucao-orcamentaria-da-despesa` |
| **P25** | TJES `…/comarca-unidade-magistrado/` (200, 408 caracteres úteis); TJMG `…/afericao-de-produtividade-para-o-cnj.htm`; TRF1 `…/institucional/magistrados`; TJMA, TRT4, TJDFT, TJPE (páginas de dados abertos/acesso automatizado) |
| **P26** | DataJud `_count` TJES 2024 por grau (G1 137.982; JE 125.364; G2 39.624; TR 23.013) |
| **P27** | Notícia/legislação do Plenário Virtual e estudos (busca web) |
| **P28** | `GET https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao/202609` → 302 → `dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas-execucao/202609_Despesas.zip` (7.093.274 B; 55,9 MB descompactado; 65.634 linhas) |
| **P29** | STJ `penalidades.csv` (199.537 B; 532 linhas) |
| **P30** | TSE `…/processual/processos_eleitorais_partes_2024.zip` (110.108.837 B; cabeçalho e 180.099 linhas lidas por faixa de bytes (3 MB iniciais)) |
| **P31–P40** | Páginas e buscas de contexto (CNJ "Dados Abertos" listagem; Portal de Transparência-ES `transparencia.es.gov.br/DadosAbertos/BaseDeDados`; Siga Brasil/SIOP; Tesouro; ACT 079/2021) — **apenas leitura de página/busca**, nenhum dado de pagamento obtido |

**Totais:** ≈ 75 URLs/endpoints distintos acessados (mais 41 chamadas paginadas ao TJRJ e 5 contagens DataJud), **sem** ação destrutiva e sem exceder 120 req/min ao DataJud.

---

# 18. Lacunas remanescentes

| Lacuna | Natureza |
|---|---|
| Extrato individual do MPM (sem CPF) | **ausência de publicação** (existe internamente) |
| Votos do STF em formato estruturado | **bloqueio de acesso**; existência e publicação documentadas |
| Produtividade por magistrado após 2019 e fora do TJSP/STJ | não comprovada; TRT3 localizado e não aberto |
| Proporção dos espelhos do STJ em relação aos acórdãos | **limitação metodológica** (denominador não obtido) |
| Série histórica de ata do STJ antes de 06/2023 | **ausência de publicação** (no catálogo) |
| Pautas do STJ anteriores a 15/07/2026 | ausência de publicação (janela móvel) |
| Cadastro nacional de unidades com código CNJ e histórico | **não público**; TJBA e TJRJ são parciais |
| Pagamentos a fornecedores por tribunal | **não testado** (SIAFI/SIOP/Siga e portais estaduais ficaram como pistas) |
| Painéis Qlik (Grandes Litigantes, Pessoal, Produtividade 2015–2019) | acesso programático **não autorizado/comprovado** |
| Licença de TSE, CNJ (JN), DadosJusBr | não verificada |
| Cobertura mensal da remuneração (painel/DadosJusBr) | não reexecutada na P2 |
| Reprodutibilidade de reconciliação DataJud × JN | apenas TJES 2024 |
| TJMG, TJSP, TRF1, TJES: lista nominal/unidades | busca limitada; **não conclusivo** |

---

# 19. Recomendação de investigação P3 (somente o necessário)

Uma P3 enxuta justifica-se **apenas** para:
1. **Pagamentos**: testar de fato o Siga Brasil/SIOP (execução do Judiciário federal por órgão e UG), o arquivo CGU de favorecidos (não incluído aqui) e dois portais estaduais (ES e SP) filtrando TJES e TJSP. Pergunta única: existe `credor + valor pago + data + empenho` por tribunal?
2. **Reproduzir a reconciliação JN × DataJud** em 3–5 tribunais e 3 anos para fixar a regra de uso (quando usar cada um).
3. **TJSP produtividade**: medir a continuidade da série (2022→) e extrair uma página de modo estruturado, só para saber se a série está viva.
4. **Contato institucional** (não é investigação técnica): CNJ (MPM extrato, cota DataJud, Grandes Litigantes em CSV, dúvida de redistribuição) e STF (extrato do Portal de Sessões).

Nada além disso é necessário antes de qualquer desenho de arquitetura.

---

# 20. Conclusão sobre prontidão para uma futura implementação

**Respostas aos critérios (mandato §16):**

1. **Podemos identificar os magistrados?** **No STJ, sim** (matrícula, cargo, lotação mensal desde 2020-01, ativos e aposentados). **Nos tribunais com lista pública** (TRT15, TRT3, TJSC) por nome. **Nacionalmente, não de forma pública**: o MPM tem CPF e histórico, mas é interno.
2. **Podemos identificar o que cada magistrado faz?** **STJ: alto nível** (relatorias desde 06/2023; decisões monocráticas e acórdãos por ministro/dia desde 2021; votação em texto). **TJSP 2º grau**: produção mensal por magistrado×órgão em PDF (2017–2022). Fora disso: não.
3. **Reconstruir julgamentos dos tribunais superiores?** **STJ: sim até a votação textual** (unanimidade/maioria/vencidos/quem acompanhou em ≈ 97–98% dos acórdãos amostrados, ressalvando que não se testou extração). **STF: não comprovado** (bloqueio de acesso).
4. **Estatísticas oficiais nacionais sem processar o DataJud?** **Sim**: base JN em CSV com 1.313 variáveis, 2009–2025, tribunal×ano; JF por seção.
5. **Remuneração e despesas individualizadas?** **Remuneração: STJ completa; nacional parcial.** **Despesas por favorecido: não**.
6. **Hierarquia nacional de unidades?** **Só tribunal→grau→unidade→município via DataJud**; árvore comarca→vara e histórico exigem TJBA/TJRJ (ou o CNJ).
7. **Quais componentes estão prontos para o Cívica?** (a) **KPIs oficiais por tribunal**; (b) **STJ completo**; (c) **qualidade/estrutura DataJud agregada**, sujeita ao parecer jurídico; (d) **sanções e contratos com CNPJ** (STJ, PNCP).
8. **Técnica × jurídica × ausência de publicação:** técnico — Qlik/Power BI, PDFs, STF por JS; jurídico — Termo DataJud (3.3, 3.8, 3.9, 3.11, 3.13, 4.2); ausência — extrato do MPM, cadastro de unidades com código, pagamentos por favorecido, votos do STF estruturados.

**Prontidão:** o Cívica Judiciário pode ser iniciado com dois pilares de **maior evidência**: (1) **panorama oficial por tribunal** e (2) **STJ por dentro**; a terceira frente de melhor relação valor×qualidade é **litigância e fornecedores por CNPJ no STJ**. Perfis individuais "ricos como os parlamentares" são **viáveis para os ministros do STJ**; para o resto do Judiciário dependem de decisão institucional do CNJ (MPM) e do STF.

---

**Resumo da P2:** ≈ 24 fontes novas descobertas · ≈ 17 efetivamente testadas com dados ou resposta · 16 tribunais/órgãos analisados (TJES, TJMG, TJSP, TJRJ, TJSC, TJMA, TJPE, TJDFT, TRF1, TRF2 [notícia], TRT3, TRT4, TRT15, STJ, STF, TSE; TJBA reutilizado da P1) · 8 lacunas da P1: 1 resolvida, 5 em avanço parcial, 1 bloqueio externo, 1 sem avanço.
