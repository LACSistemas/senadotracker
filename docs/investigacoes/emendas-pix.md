# Emendas Pix (Transferências Especiais) — investigação de viabilidade

Data da coleta: 2026-10-06. Somente investigação: nenhum collector, tabela ou tela foi criado. Os dados foram baixados para uma pasta temporária fora do repositório e analisados offline; as consultas ao banco do Cívica foram somente leitura.

## 0. Escopo e separação de domínios

O Cívica passa a ter três coisas diferentes chamadas "emenda". Elas **não podem** compartilhar tabela, chave nem tela.

| Domínio | O que é | Onde vive hoje | Chave |
|---|---|---|---|
| A. Emendas legislativas | EMC, EMP, SBT etc. a proposições (texto de lei) | `civica_poc.proposals` + `proposal_authors` | `source` + `external_id` da proposição |
| B. Emendas orçamentárias (geral) | Individuais com finalidade definida, bancada, comissão, relator (LOA) | não existe | código da emenda (12 dígitos) |
| C. Transferências Especiais ("Emenda Pix") | Emenda individual cujo dinheiro vai direto ao ente, sem convênio | não existe | código da emenda (12 dígitos) + `id_plano_acao` |

C é um subconjunto de B ("Emenda Individual - Transferências Especiais" no Portal da Transparência). Este documento trata de C e só toca em B onde o Portal da Transparência ajuda.

## 1. Fontes oficiais

| Fonte | URL | Acesso | Papel |
|---|---|---|---|
| Transferegov — Transferências Especiais (API) | `https://api.transferegov.gestao.gov.br/transferenciasespeciais/` | aberto, sem chave | fonte primária de C |
| Portal da Transparência — Emendas parlamentares (download) | `https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO` | aberto, ZIP de ~32 MB, 3 CSVs (latin1, `;`) | valores orçamentários por emenda, IBGE, favorecidos |
| Portal da Transparência — API REST | `https://api.portaldatransparencia.gov.br/api-de-dados/emendas` | **exige chave** (HTTP 401 sem ela) | não usada; o CSV cobre o mesmo |

Observações operacionais da API do Transferegov: é PostgREST (Swagger 2.0, versão 11.2.0); máximo de 1.000 linhas por requisição, paginação por `offset`; `Prefer: count=exact` num GET devolve o total em `content-range`; `HEAD` recebe 403 da Cloudflare; é preciso enviar um `User-Agent` identificável. Sem retries ou bloqueios: 476 requisições, 0 falhas, ~3 min para baixar as 10 tabelas centrais.

## 2. Endpoints e entidades (Transferegov)

Catorze tabelas. Contagens reais em 2026-10-06:

| Tabela | Linhas | Papel |
|---|---:|---|
| `programa_especial` | 15 | programa/ano, órgão repassador (Ministério da Fazenda), valores disponibilizados |
| `plano_acao_especial` | 57.827 | **unidade central**: um plano de ação = uma destinação de uma emenda a um beneficiário |
| `empenho_especial` | 60.322 | empenho (`valor_empenho`, categoria custeio/investimento, natureza de despesa) |
| `documento_habil_especial` | 57.986 | documento hábil (`valor_dh`, `valor_rateio_dh`) |
| `ordem_pagamento_ordem_bancaria_especial` | 55.148 | OP/OB (datas; **sem valor**) |
| `historico_pagamento_especial` | 281.163 | histórico de pagamento (não usado na análise) |
| `executor_especial` | 57.374 | executor, **objeto**, valores custeio/investimento |
| `plano_trabalho_especial` | 56.416 | datas de execução, situação, classificação orçamentária local |
| `plano_trabalho_analise_especial` | 112.479 | análise do plano de trabalho |
| `meta_especial` | 156.016 | metas |
| `finalidade_especial` | 94.262 | áreas de política pública por executor |
| `relatorio_gestao_novo_especial` | 25.957 | relatório de gestão (valor executado/pendente) |
| `relatorio_gestao_especial` | 5.362 | relatório de gestão (legado) |
| `orgao_analise_pendente_especial` | 1.438 | pendências de análise |

**Enumeração sem consultar por parlamentar: possível.** `plano_acao_especial` paginada em 59 requisições traz todos os planos de todos os parlamentares. A emenda e o parlamentar vêm como colunas do plano (não existe tabela de emenda nem de parlamentar). Para atualização incremental não há campo de data de alteração no plano; a estratégia é recarga completa (≈ 500 requisições, poucos minutos) com upsert idempotente.

## 3. Modelo de dados

```
 programa_especial (15) ──────────────────────────────┐
   órgão repassador: Ministério da Fazenda            │ id_programa
                                                      ▼
 EMENDA (implícita: codigo_emenda 12 díg. + autor) ──< plano_acao_especial (57.827) >── beneficiário (CNPJ, nome, UF)
   ano + código do autor + sequencial                 │ id_plano_acao                       (ente: município/estado)
   parlamentar autor (código SIOP + nome)             │
                                   ┌──────────────────┼───────────────────────┬────────────────────┐
                                   ▼                  ▼                       ▼                    ▼
                           empenho_especial   executor_especial       plano_trabalho_especial   relatorio_gestao_*
                           (valor_empenho,    (objeto, custeio,       (datas, situação)         (executado/pendente)
                            custeio/invest.)   investimento)
                                   │ id_empenho         │ id_executor
                                   ▼                    ├──< finalidade_especial (área de política pública)
                          documento_habil_especial      └──< meta_especial
                          (valor_dh, rateio)
                                   │ id_dh
                                   ▼
                  ordem_pagamento_ordem_bancaria_especial (data OB)
```

Mapeamento dos conceitos pedidos:

| Conceito | Onde está |
|---|---|
| Emenda | colunas `*_emenda_parlamentar_*` do plano (sem entidade própria) |
| Parlamentar autor | `codigo_parlamentar_emenda_plano_acao` + `nome_parlamentar_emenda_plano_acao` |
| Plano de ação | `plano_acao_especial` (`codigo_plano_acao`, ex. `09032024-068441`) |
| Beneficiário / ente | `cnpj/nome/uf_beneficiario_plano_acao` (90% são "MUNICIPIO DE …") |
| Município / UF | só UF e nome; **sem código IBGE** no Transferegov |
| Órgão repassador | `programa_especial` (Ministério da Fazenda; UG 170860 STN) |
| Empenho / pagamento | `empenho_especial` → `documento_habil_especial` → OP/OB |
| Execução | `plano_trabalho_especial` (situação, datas) e `relatorio_gestao_*` |
| Objeto | `executor_especial.objeto_executor` |
| Política pública / função | `codigo_descricao_areas_politicas_publicas_plano_acao` (ex. "15-Urbanismo / 451-Infraestrutura Urbana") e `finalidade_especial` |
| Custeio × investimento | `valor_custeio_plano_acao`, `valor_investimento_plano_acao` e `categoria_despesa_empenho` |

## 4. Campos reais por grupo

Legenda: DISPONÍVEL / PARCIAL / AUSENTE.

**Emenda**

| Campo | Status | Fonte |
|---|---|---|
| Código da emenda (12 dígitos) | DISPONÍVEL | `codigo_emenda_parlamentar_formatado_plano_acao` = `AAAA` + código autor (4) + sequencial (4) + `-Nome` (cortar nos 12 primeiros) |
| Ano da emenda | DISPONÍVEL | `ano_emenda_parlamentar_plano_acao` |
| Código/nome do autor | DISPONÍVEL | plano |
| Casa legislativa do autor | **AUSENTE** | não existe em nenhuma fonte (ver seção 6) |
| Partido / UF do autor | AUSENTE no Transferegov; UF PARCIAL no Portal (campo UF da emenda, mas "MÚLTIPLO"/vazio em parte) | Portal |
| Valor da emenda | DISPONÍVEL | soma custeio+investimento dos planos; Portal dá `Valor Empenhado` por emenda |

**Destino**

| Campo | Status | Fonte |
|---|---|---|
| Beneficiário (CNPJ, nome, UF) | DISPONÍVEL | plano |
| Tipo de ente | PARCIAL | derivável do nome (município 52.139, estado 1.623, outros 4.065 planos); "outros" inclui municípios cujo nome vem como "ALVORADA DO SUL/PR" |
| Código IBGE do município | **AUSENTE** | derivável por nome+UF contra tabela IBGE; Portal (arquivo principal) traz IBGE só para 981 códigos distintos e "Sem informação" em 3.517 de 5.108 emendas |
| Município do favorecido | PARCIAL | Portal `PorFavorecido` (nome, sem IBGE) |
| Dados bancários | DISPONÍVEL (não exibir) | plano / executor |

**Execução**

| Campo | Status | Fonte |
|---|---|---|
| Valor empenhado | DISPONÍVEL | `empenho_especial.valor_empenho` (100% dos planos têm empenho); Portal confirma por emenda |
| Valor do documento hábil | DISPONÍVEL a partir de 2023 | `valor_rateio_dh` (planos 2020–2022 não têm DH na API: soma zero) |
| Data/existência de OB | DISPONÍVEL | OP/OB (sem valor; valor vem do DH) |
| Valor liquidado / pago | DISPONÍVEL via Portal, por emenda e favorecido-mês | Portal `Valor Liquidado`, `Valor Pago`, `Valor Recebido` |
| Situação do plano / plano de trabalho | DISPONÍVEL | `situacao_plano_acao` (CIENTE 52.956, IMPEDIDO 4.412, IMPEDIDO_REJEICAO_PLANO_TRABALHO 459); `situacao_plano_trabalho` |
| Execução física da obra | AUSENTE | só relatório de gestão (valor executado/pendente), cobertura parcial (25.957 relatórios para 57.827 planos) |

**Finalidade**

| Campo | Status |
|---|---|
| Objeto | DISPONÍVEL (texto livre, heterogêneo: de 1 linha a parágrafos com marcadores) |
| Função / subfunção | DISPONÍVEL no plano (pode ter várias, separadas por vírgula). No Portal a classificação é sempre "28 Encargos especiais / 845 Outras transferências", sem valor analítico |
| Área de política pública | DISPONÍVEL (`finalidade_especial`) |
| Custeio × investimento | DISPONÍVEL (custeio R$ 5,06 bi; investimento R$ 31,80 bi no total) |

## 5. Cobertura histórica (Transferegov, `plano_acao_especial`)

A modalidade começou em 2020. Não há dados anteriores; "histórico completo" significa 2020–2026.

| Ano da emenda | Planos | Emendas | Parlamentares (cód.) | Beneficiários (CNPJ) | Valor (R$ mi) | Planos c/ empenho | c/ objeto | c/ plano de trabalho | c/ OB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2020 | 1.629 | 200 | 137 | 1.342 | 621 | 1.629 | 1.625 | 1.626 | 1.629 |
| 2021 | 4.702 | 635 | 402 | 2.958 | 2.049 | 4.702 | 4.660 | 4.663 | 4.671 |
| 2022 | 8.514 | 849 | 507 | 4.114 | 3.424 | 8.514 | 8.208 | 8.210 | 8.221 |
| 2023 | 9.273 | 1.099 | 515 | 4.325 | 7.312 | 9.273 | 9.064 | 9.067 | 9.075 |
| 2024 | 10.934 | 919 | 530 | 4.604 | 7.872 | 10.934 | 10.768 | 10.770 | 10.771 |
| 2025 | 13.177 | 754 | 502 | 4.326 | 8.806 | 13.177 | 12.641 | 12.664 | 9.966 |
| 2026 | 9.598 | 703 | 470 | 4.120 | 6.780 | 9.598 | 9.409 | 9.416 | 6.308 |
| **Total** | **57.827** | **5.159** | **822 códigos** | — | **36.864** | | | | |

(2026 está em andamento; "c/ OB" cai porque o pagamento ainda não ocorreu, não por falha de coleta. A soma dos valores do Portal, "pago" por ano: 621 / 2.000 / 1.619 / 7.079 / 7.682 / 6.896 / 4.530 R$ mi.)

Reconciliação com o Portal da Transparência: as **5.108 emendas** "Emenda Individual - Transferências Especiais" do Portal existem todas no Transferegov (junção pelo código de 12 dígitos: 5.108/5.108, e o código do autor é idêntico nas 5.108). O Transferegov tem 51 emendas a mais (planos sem empenho/pagamento ainda).

## 6. Ligação com os parlamentares do Cívica

**Identificador oficial do autor:** código numérico de 4 dígitos do sistema orçamentário (SIOP/Congresso), presente tanto no Transferegov (`codigo_parlamentar_emenda_plano_acao`) quanto no Portal (`Código do Autor da Emenda`), idêntico nos dois. **Não é** o `external_id` da API da Câmara nem o `CodigoParlamentar` do Senado.

Teste de chave exata (822 códigos do Transferegov contra todos os `external_id` de `civica.profiles` + `proposal_authors`): 8 coincidências numéricas, **todas de pessoas diferentes** (ex.: código 3777 "Vitor Lippi" colide com Senado 3777 "Eduardo Gomes"; 4560 "Samuel Santos" com Senado 4560 "Sérgio Petecão"). Conclusão: **ID exato = 0% utilizável; usar o código numérico como se fosse ID do Cívica causaria ligação errada.**

Resultados de ligação por **nome normalizado + UF** (UF da emenda vem do Portal), universo do Cívica = 513 deputados + 81 senadores em exercício (`civica.profiles`) + autores históricos (`proposal_authors`):

| Resultado | Códigos | % |
|---|---:|---:|
| Nome + UF único | 566 | 69% |
| Não encontrado | 246 | 30% |
| Ambíguo | 10 | 1% |
| **Valor ligado** | R$ 30,8 bi de R$ 36,9 bi | 83% |

Por categoria: 460 deputados em exercício + 71 senadores em exercício ligados (531 de 594 membros atuais = 89%); 35 ligações a ex-membros, **não confiáveis** (ver abaixo).

Os 246 não encontrados são, em geral, ex-parlamentares que não estão no catálogo do Cívica (ex.: Carla Zambelli, Acir Gurgacz, Expedito Netto, Lasier Martins, Dário Berger).

Teste complementar com as listas oficiais do Senado (`/senador/lista/legislatura/55, 56, 57`, 475 senadores): 116 códigos do Transferegov casam com um senador (nome+UF único): 71 em exercício e 45 fora de exercício (ex.: Rodrigo Cunha → 5905; Mecias de Jesus → 6027; Fernando Farias → 6345; Ana Paula Lobato → 6358; Eunício Oliveira → 612; Lídice da Mata → 4575). Ao mesmo tempo mostrou o **risco principal**: o mesmo nome+UF aparece como senador em uma legislatura e deputado em outra (Aécio Neves, Sérgio Souza, José Medeiros, Wilson Santiago, Lídice da Mata). A Casa **não vem em nenhuma fonte**; para decidir é preciso cruzar com o período de mandato (ano da emenda dentro do mandato). Também apareceram falsos positivos em `proposal_authors` do Senado (nomes de deputados, ex.: Paulinho Freire, Jorge Goetten), portanto `proposal_authors` não serve como tabela de identidades históricas.

Amostra do teste (≥10 de cada):

| Categoria | Exemplos (código → id Cívica) |
|---|---|
| Deputados em exercício (10+) | 3897 Acácio Favacho → camara:204379; 2170 Dagoberto Nogueira → 141411; 3997 Gervásio Maia → 204394; 3260 José Priante → 74079; 3727 Mário Negromonte Jr. → 178858; 3913 André Ferreira → 204423; 2356 Arnaldo Jardim → 141391; 3980 Fabio Schiochet → 204368; 2712 Hugo Motta → 160674; 2754 Diego Andrade → 160588; 4101 Gustinho Ribeiro → 204408; 3332 Ricardo Barros → 73788 |
| Deputados fora de exercício (10+) | 1283 Wilson Santiago → 74044; 3906 Alex Santana → 204571; 1968 Giacobo → 74383; 1407 Odair Cunha → 74159; 3270 Leônidas Cristino → 74299; 2925 Carmen Zanotto → 164360; 4411 Luciano Vieira → 220616; 1651 Roseana Sarney → 73806; 1997 Vicentinho → 74283; 4229 Ely Santos → 218086; 2973 Paulão → 171617; 4559 Fatima Pelaes → 74065 |
| Senadores em exercício (10+) | 3787 Davi Alcolumbre → senado:3830; 2919 Randolfe Rodrigues → 5012; 4183 Marcelo Castro → 742; 4139 Eliziane Gama → 5718; 3795 Otto Alencar → 5523; 4181 Nelsinho Trad → 5985; 4221 Giordano → 6008; 4142 Styvenson Valentim → 5959; 4087 Carlos Viana → 5990; 4079 Lucas Barreto → 5926; 4091 Zenaide Maia → 5783; 4201 Carlos Fávaro → 6295 |
| Senadores fora de exercício (10+, via listas oficiais do Senado) | 4093 Mecias de Jesus → 6027; 4285 Fernando Farias → 6345; 4283 Ana Paula Lobato → 6358; 4178 Rodrigo Cunha → 5905; 3520 Eunício Oliveira → 612; 2468 Lídice da Mata → 4575; 1349 Aécio Neves → 391 (**atenção: hoje deputado**); 3809 Sérgio Souza → 5048; 4153 José Medeiros → 5112; 4466 Rodolfo Nogueira → 5986 |

Medição por modo de ligação (822 códigos):

| Modo | Resultado |
|---|---|
| ID exato | 0 utilizáveis (8 colisões falsas) |
| Outro identificador oficial (CPF, id Câmara/Senado, TSE) | nenhum disponível nas fontes de C |
| Somente nome (+UF) | 69% únicos; 83% do valor; ambiguidade resolvível só com período de mandato |
| Não encontrado | 30% (maioria ex-parlamentares fora do catálogo) |

**Chave canônica proposta:** a entidade de ligação deve ser o código SIOP (`author_code`, 4 dígitos), guardado como identificador próprio de uma tabela de correspondência `siop_author_code → person_id` (com `method`, `confidence`, `valid_from/valid_to`). O nome nunca é chave primária; é só evidência.

## 7. Cardinalidades (medidas)

| Relação | Resultado |
|---|---|
| Emenda → planos de ação | 1 plano: 1.802 emendas; 2: 338; 3: 237; 4: 158; 5: 145; 6: 132; 7: 138; 8: 128; 9: 112; **10 ou mais: 1.969** (emenda é dividida entre muitos entes) |
| Emenda → beneficiários distintos | 1: 1.976; 10 ou mais: 1.822 |
| Plano → empenhos | 1: 55.338; 2: 2.483; 3: 6 |
| Empenho → documentos hábeis | 1: 52.806; 2: 2.479; 3: 74 |
| Documento hábil → OB | exatamente 1 |
| Plano → executores | 1: 55.867; 2 a 6+: 508 |
| Plano → planos de trabalho | exatamente 1 |
| Executor → áreas de política pública | 1: 51.745; 2 ou mais: 8.564 |

Consequências: uma emenda **é um agrupador** de planos; a unidade analítica de destino é o plano de ação; objeto e área vêm do executor e podem ser múltiplos por plano. Tipo de empenho: 100% "Empenho Original" (sem reforço/anulação), 4.963 ainda em "Minuta de Empenho".

## 8. Semântica financeira

| Conceito | Existe? | Onde | Seguro exibir? |
|---|---|---|---|
| Indicado / destinado | sim | soma custeio+investimento dos planos | **Sim**, rotulado "destinado em planos de ação" |
| Autorizado | não como campo separado | — | Não |
| Empenhado | sim | `valor_empenho` (Transferegov) e `Valor Empenhado` (Portal). Planos 100% com empenho; empenhado do Portal por emenda = soma dos planos em 3.733 emendas, menor em 1.184 (empenho parcial) e maior em 191 | **Sim**, mas usar o Portal por emenda e o Transferegov por plano, sem misturar no mesmo total |
| Liquidado | sim (Portal) | por emenda | Sim, por emenda; igual ao pago em 2020 e 2023–2024 |
| Pago | sim (Portal) e derivável (DH com OB) | 2023+: 35.582 planos têm OB com valor = valor do plano; 519 com OB diferente; 6.881 sem OB (principalmente 2025–2026). 2020–2022: **sem valor de DH na API**, só Portal | **Sim**, com nota: "ordem bancária emitida" não é "recurso utilizado pelo ente" |
| Restos a pagar | sim (Portal) | 2021: R$ 39 mi; 2022: R$ 1.698 mi; 2025: R$ 29 mi | Sim, em nota |
| Transferido | = pago (transferência fundo a fundo/conta) | — | Usar "pago/transferido" como o mesmo conceito |
| Global / saldo | não | `programa_especial` traz agregados do programa (necessidade, disponibilizado, impedido) | Só nível do programa |
| Valor executado pelo ente | parcial | `relatorio_gestao_novo_especial.valor_executado` (25.957 relatórios) | Não como total; só por plano, quando houver |

Cuidados: o Portal conta o valor por **pagamento no mês** (`PorFavorecido`), com 242 linhas (0,5% das linhas, R$ 13 mi de R$ 32.148 mi) em que o favorecido é o Banco do Brasil; planos com status IMPEDIDO (4.871) estão no valor "destinado" mas não receberam; é obrigatório mostrar o filtro de situação.

## 9. Exemplos reais (20: 18 ligações plausíveis + 2 falsos positivos)

Fonte: Transferegov `plano_acao_especial` + `empenho`/`documento_habil`/OB; `Casa` e `parlamentar_id` são o resultado do teste de ligação (nome+UF+período), não dado oficial. Valor pago = soma do rateio dos DH que têm OB. URL = `https://api.transferegov.gestao.gov.br/transferenciasespeciais/plano_acao_especial?id_plano_acao=eq.<id>`.

| Código emenda | Ano | Parlamentar (cód. SIOP) | parlamentar_id | Casa | Beneficiário / UF | Valor (R$) | Pago (R$) | Objeto (resumo) | Função/subfunção | Status (plano/PT) | Plano (id) |
|---|---|---|---|---|---|---:|---:|---|---|---|---|
| 202340240001 | 2023 | Josimar Maranhãozinho (4024) | camara:204563 | Câmara | Município de Maranhãozinho/MA | 950.000 | 950.000 | eventos culturais | 13-Cultura / 392 | CIENTE / CONCLUIDO_NT_TCU | 09032023-031154 (31154) |
| 202339640011 | 2023 | Dr. Luiz Ovando (3964) | camara:204351 | Câmara | Município de São Gabriel do Oeste/MS | 300.000 | 300.000 | veículo e equipamentos para a Saúde | 10-Saúde / 301 | CIENTE / CONCLUIDO_NT_TCU | 09032023-037360 (37360) |
| 202443530003 | 2024 | Denise Pessôa (4353) | camara:220553 | Câmara | Município de Passo Fundo/RS | 100.000 | 100.000 | playground para escolas infantis | 12-Educação / 365 | CIENTE / CONCLUIDO_NT_TCU | 09032024-068441 (68441) |
| 202440340012 | 2024 | Luisa Canziani (4034) | camara:204410 | Câmara | Alvorada do Sul/PR | 300.000 | 300.000 | capela mortuária | 8-Assist. Social / 244 | CIENTE / CONCLUIDO_NT_TCU | 09032024-073303 (73303) |
| 202543170009 | 2025 | Cabo Gilberto Silva (4317) | camara:220574 | Câmara | Estado da Paraíba/PB | 990.000 | 990.000 | desporto (Sec. Juventude, Esporte e Lazer) | 27-Desporto / 811 | CIENTE / APROVADO | 09032025-080648 (80648) |
| 202541550001 | 2025 | Kim Kataguiri (4155) | camara:204536 | Câmara | Estado de São Paulo/SP | 762.300 | 762.300 | ampliação de auditório (Fatec) | 12-Educação / 364 | CIENTE / APROVADO | 09032025-2-087048 (87048) |
| 202639260004 | 2026 | Capitão Alberto Neto (3926) | camara:204572 | Câmara | Urucará/AM | 199.000 | 112.157 | manutenção de unidade hospitalar | 10-Saúde / 302 | CIENTE / APROVADO | 09032026-092770 (92770) |
| 202339060001 | 2023 | Alex Santana (3906) | camara:204571 | Câmara (fora de exercício) | Município de Presidente Dutra/BA | 205.213 | 205.213 | pavimentação de ruas | 15-Urbanismo / 451 | CIENTE / CONCLUIDO_NT_TCU | 09032023-032781 (32781) |
| 202429250006 | 2024 | Carmen Zanotto (2925) | camara:164360 | Câmara (fora) | Mafra/SC | 100.000 | 100.000 | reforma de UBS | 10-Saúde / 301 | CIENTE / CONCLUIDO_NT_TCU | 09032024-067065 (67065) |
| 202512830005 | 2025 | Wilson Santiago (1283) | camara:74044 | Câmara (fora) | Município de Ouro Velho/PB | 495.000 | 495.000 | mirante | 23-Comércio e Serviços / 695 | CIENTE / APROVADO | 09032025-081607 (81607) |
| 202337870002 | 2023 | Davi Alcolumbre (3787) | senado:3830 | Senado | Município de Calçoene/AP | 2.066.010 | 2.066.010 | notebooks, aditivos e contrapartidas | 15-Urbanismo / 451, 452 | CIENTE / CONCLUIDO_NT_TCU | 09032023-030803 (30803) |
| 202342510010 | 2023 | Ivete da Silveira (4251) | senado:6010 | Senado | Município de Palmeira/SC | 400.000 | 400.000 | pavimentação em estrada rural | 20-Agricultura / 608 | CIENTE / CONCLUIDO_NT_TCU | 09032023-039015 (39015) |
| 202441420005 | 2024 | Styvenson Valentim (4142) | senado:5959 | Senado | Município de Jardim do Seridó/RN | 900.000 | 900.000 | reforma de praças | 15-Urbanismo / 451; 25-Energia / 752 | CIENTE / CONCLUIDO_NT_TCU | 09032024-067837 (67837) |
| 202442010001 | 2024 | Carlos Fávaro (4201) | senado:6295 | Senado | Município de Várzea Grande/MT | 1.000.000 | 1.000.000 | recapeamento e drenagem | 15-Urbanismo / 451, 452 | CIENTE / CONCLUIDO_NT_TCU | 09032024-073841 (73841) |
| 202529140011 | 2025 | Sérgio Petecão (2914) | senado:4560 | Senado | Município de Porto Walter/AC | 396.000 | 396.000 | reforma de praça | 15-Urbanismo / 451 | CIENTE / APROVADO | 09032025-078803 (78803) |
| 202528850017 | 2025 | Humberto Costa (2885) | senado:5008 | Senado | Ribeirão/PE | 198.000 | 198.000 | equipamentos de hospital municipal | 10-Saúde / 302 | CIENTE / APROVADO | 09032025-2-086153 (86153) |
| 202642700011 | 2026 | Efraim Filho (4270) | senado:4642 | Senado | Município de São José de Princesa/PB | 995.000 | 995.000 | poços artesianos | 20-Agricultura / 608 | CIENTE / APROVADO | 09032026-091809 (91809) |
| 202340930002 | 2023 | Mecias de Jesus (4093) | senado:6027 | Senado (leg. 55–57, fora de exercício no catálogo) | Município de Iracema/RR | 5.034.268 | 5.034.268 | unidades habitacionais, material e serviços | 8-Assist. Social / 241 | CIENTE / CONCLUIDO_NT_TCU | 09032023-031067 (31067) |

Falsos positivos de ligação encontrados nos mesmos sorteios (mantidos de propósito; extraídos dos mesmos dados):

| Código emenda | Ano | Parlamentar (cód.) | Casa (ligação) | Beneficiário / UF | Valor (R$) | Observação |
|---|---|---|---|---|---:|---|
| 202444430001 | 2024 | Paulinho Freire (4443) | **ligação incorreta** (nome casa com registro de Senado em `proposal_authors`; é deputado) | Taboleiro Grande/RN | 300.000 | falso positivo |
| 202542090003 | 2025 | Jorge Goetten (4209) | idem (deputado camara:214694) | Joaçaba/SC | 396.000 | falso positivo |

> Os dois falsos positivos acima foram mantidos de propósito: mostram por que a ligação exige período de mandato e a Casa não pode sair de `proposal_authors`.

## 10. Transferegov × Portal da Transparência

Junção determinística: **sim**. O código de emenda de 12 dígitos é idêntico (`AAAA` + autor + sequencial), 5.108/5.108 emendas especiais do Portal existem no Transferegov, com o mesmo código de autor.

| Dimensão | Transferegov | Portal (CSV) |
|---|---|---|
| Autor | código + nome | código + nome (mesmo código) |
| Valores | destinado, empenho, DH | empenhado, liquidado, pago, restos a pagar, por emenda |
| Destino | plano a plano (beneficiário, objeto, política) | favorecido por mês de pagamento (52.144 linhas, valor R$ 32,1 bi) com município (sem IBGE) |
| IBGE / UF | UF do beneficiário | UF da emenda; IBGE só em parte (981 distintos; "Sem informação" em 3.517 emendas) |
| Função | por plano (rica) | "28 Encargos especiais / 845" (sem valor analítico) |
| 2020–2022 pago | sem DH | disponível |
| Objeto | sim | não (só nos convênios, que não cobrem C) |

Classificação: **TRANSFEREGOV + PORTAL RECOMENDADO.** O Transferegov sozinho basta para destino, objeto, política pública e status (domínio completo de "para onde foi"). O Portal acrescenta (a) pago/liquidado/restos a pagar oficiais por emenda, (b) valores de 2020–2022, (c) uma segunda confirmação do código do autor e da UF da emenda. Portal sozinho não basta (sem objeto/função útil).

## 11. O que a página de perfil poderia exibir

| Item | Situação | Observação |
|---|---|---|
| Total destinado | SUPPORTED | soma dos planos por autor |
| Total pago | SUPPORTED | Portal por emenda; para 2023+ também por plano (DH+OB) |
| Nº de transferências (planos) | SUPPORTED | |
| Municípios beneficiados | PARTIAL | por nome+UF; sem IBGE oficial |
| UFs | SUPPORTED | UF do beneficiário |
| Maiores destinos | SUPPORTED | por beneficiário/CNPJ |
| Mapa | PARTIAL | exige tabela IBGE externa (nome+UF → código) |
| Evolução anual | SUPPORTED | 2020–2026 |
| Custeio × investimento | SUPPORTED | campos do plano; 86% investimento |
| Áreas/políticas | SUPPORTED | função/subfunção do plano; múltiplas por plano |
| Lista de emendas/planos | SUPPORTED | |
| Situação (CIENTE/IMPEDIDO/PT) | SUPPORTED | |
| Execução física | NOT SUPPORTED | só relatório de gestão parcial |
| Ligação automática com o parlamentar | PARTIAL | depende do crosswalk (seção 6) |

Perguntas que `/emendas` e `/emendas/{codigo}` poderiam responder: quanto cada parlamentar destinou e quanto já foi pago; para quais municípios/UFs; quais objetos; custeio ou investimento; quais emendas estão impedidas; evolução por ano; quais municípios mais recebem; quanto uma emenda foi dividida (planos por emenda); e quem é o autor na Câmara ou no Senado (apenas com ligação validada).

## 12. Limitações

1. Sem identificador do parlamentar compatível com Câmara/Senado; ligação exige crosswalk com revisão.
2. A Casa legislativa não vem na fonte (parlamentares mudam de Casa: Aécio Neves, Sérgio Souza, Wilson Santiago).
3. Catálogo atual do Cívica só tem membros em exercício; 30% dos códigos (ex-parlamentares) ficam sem pessoa; é preciso carregar legislaturas anteriores (Senado `lista/legislatura/55–57` já responde; Câmara equivalente a verificar).
4. Sem código IBGE oficial no Transferegov.
5. Pago de 2020–2022 só no Portal; OB não traz valor.
6. "Pago" significa ordem bancária emitida; não prova uso do recurso pelo ente.
7. Sem execução física, sem data de alteração (recarga completa).
8. Objeto em texto livre, de qualidade variável.
9. Dois totais não reconciliam entre si por definição (empenhado Portal ≠ soma dos planos em 1.375 de 5.108 emendas); exibir sempre a fonte.

## 13. Proposta de schema futuro (não implementado)

Schema separado `civica_budget` (não reutilizar `civica_poc.proposals`):

- `budget_amendments` (PK `amendment_code` 12 díg.; `year`, `author_code`, `author_name`, `kind='especial'`, valores do Portal: empenhado, liquidado, pago, RAP)
- `special_action_plans` (PK `plan_id`; `plan_code`, `amendment_code`, `beneficiary_cnpj/name/uf`, `ente_type`, `ibge_code` nulo, `custeio`, `investimento`, `situation`, `function_text`, `object_text`)
- `special_commitments`, `special_payment_documents`, `special_payment_orders` (cadeia empenho → DH → OB)
- `special_plan_areas` (áreas de política pública)
- `author_code_crosswalk` (`author_code`, `person_id` nulo, `house`, `method`, `confidence`, `valid_from/to`, `reviewed`)
- `budget_ingestion_runs` (contagens por tabela, corte, hash) — reaproveita o padrão de reconciliação COMPLETE/PARTIAL do restante do projeto

Usar a convenção de lotes `batch_id` + `active_publications` já existente.

## 14. Recomendação de collector

1. Baixar as 10 tabelas centrais por paginação (1.000/linha, ordenado por chave, retry com backoff, User-Agent identificável): ~480 requisições, minutos. Sem consulta por parlamentar.
2. Baixar o ZIP do Portal e filtrar "Emenda Individual - Transferências Especiais" (5.108 linhas) e `PorFavorecido` (52.144).
3. Carga idempotente por upsert; recarga completa diária ou semanal (a API não tem "modificado desde").
4. Reconciliar por contagem de linhas por tabela (`content-range`) e por emenda (Portal × Transferegov, esperado 5.108/5.108).
5. Entregar primeiro as páginas por emenda e por beneficiário, **sem** ligar ao perfil do parlamentar; ligar depois, só os casos com crosswalk revisado.
6. Resolver a ligação em tarefa separada: carregar mandatos históricos (Senado legislaturas 55–57, Câmara equivalente), combinar nome + UF + ano dentro do mandato; casos ambíguos e "não encontrado" ficam para revisão manual.

## Gates finais

| Gate | Resultado | Justificativa |
|---|---|---|
| PIX_AMENDMENTS_SOURCE | **AVAILABLE** | API oficial aberta, enumerável sem consulta por parlamentar; 57.827 planos; reconciliado com o Portal (5.108/5.108) |
| PARLIAMENTARIAN_LINKAGE | **PARTIAL** | sem ID compartilhado (0% por ID exato; 8 colisões falsas); 69% dos códigos (83% do valor) por nome+UF; 89% dos membros atuais; Casa não informada; ex-parlamentares dependem de mandatos históricos |
| FINANCIAL_EXECUTION_COVERAGE | **PARTIAL_HIGH** | empenho em 100% dos planos; pago/OB por plano em 2023+; 2020–2022 só via Portal; pago ≠ execução física |
| HISTORICAL_COVERAGE | **COMPLETE_FOR_PROGRAM (2020–2026)** | modalidade começa em 2020; todos os anos presentes; 2026 em andamento |
| READY_FOR_IMPLEMENTATION | **READY_WITH_CAVEATS** | collector e páginas por emenda/beneficiário viáveis agora; ligação ao perfil do parlamentar só depois do crosswalk revisado |

## Implementação (2026-10-06)

O domínio foi implementado: schema `civica_budget`, coleta Transferegov + Portal, reconciliação e *read models*. Contrato completo, schema, números reais e ressalvas em [../contracts/emendas-pix.md](../contracts/emendas-pix.md). Resultados que confirmam esta investigação: 57.827 planos, 5.159 emendas, 822 autores SIOP, R$ 36,86 bi destinados, Portal ↔ Transferegov 5.108/5.108, pago do Portal R$ 30,43 bi. Dois ajustes de método: o lote de empenhos do Transferegov soma exatamente o destinado (R$ 36,86 bi), e 8 linhas de `executor_especial` vêm idênticas e duplicadas na fonte (carregadas uma vez).

Gates da implementação: PIX_COLLECTOR = READY · PIX_PORTAL_RECONCILIATION = PASS · PIX_IDENTITY_CROSSWALK = READY_WITH_REVIEW · PIX_PROFILE_VALUE_COVERAGE = 98,66% · PIX_READ_MODELS = READY · PIX_DOMAIN_READY = READY_WITH_CAVEATS.
