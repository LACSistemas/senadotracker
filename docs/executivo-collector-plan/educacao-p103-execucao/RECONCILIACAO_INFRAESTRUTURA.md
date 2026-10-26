# Reconciliação de infraestrutura · P10.3 (G10)

Estado: **PASS_WITH_CAVEATS**. Infraestrutura **não tem total oficial consolidado na Sinopse** (as quatro seções da Sinopse 2025 são Matrículas, Docentes, Estabelecimentos e Turmas). Por isso a reconciliação separa (1) a referência independente que existe, (2) invariantes de integridade e (3) invariantes semânticos. Ressalva: não há como comparar os totais de infraestrutura com uma tabela oficial publicada pelo INEP; a prova é interna e contra o levantamento independente da investigação P10.

## 1. Contra o levantamento independente da P10 (2021–2025)
A investigação P10 contou, direto do RAW, os valores de seis variáveis (`censo_infra_semantica_nulos_2021_2025.json`: internet, biblioteca, laboratório de informática, quadra, água da rede, esgoto da rede) nas escolas em atividade. O banco publicado foi comparado com `sim` e `não` de cada uma: **30 comparações (6 variáveis × 5 edições), 30 iguais, 0 divergências** (`evidencias/infra_vs_levantamento_p10.json`). Inclui 2022, em que as 4.259 escolas em branco ficam de fora de ambos os lados.

## 2. RAW = lido = publicado, por edição
| Ano | Linhas no arquivo | Em atividade | Publicadas | Rejeitadas | Sem nenhuma resposta | Com matrícula (bit0) | Cadastro P10.1: em atividade / com matrícula | Igual |
|---:|---:|---:|---:|---:|---:|---:|---|:--:|
| 2007 | 198.507 | 198.507 | 198.507 | 0 | 0 | 198.397 | 198.507 / 198.397 | sim |
| 2008 | 205.699 | 205.699 | 205.699 | 0 | 0 | 199.761 | 205.699 / 199.761 | sim |
| 2009 | 203.455 | 203.455 | 203.455 | 0 | 0 | 197.468 | 203.455 / 197.468 | sim |
| 2010 | 200.876 | 200.876 | 200.876 | 0 | 0 | 194.939 | 200.876 / 194.939 | sim |
| 2011 | 242.147 | 194.932 | 194.932 | 0 | 0 | 193.047 | 194.932 / 193.047 | sim |
| 2012 | 242.136 | 194.695 | 194.695 | 0 | 0 | 192.676 | 194.695 / 192.676 | sim |
| 2013 | 242.680 | 192.678 | 192.678 | 0 | 0 | 190.706 | 192.678 / 190.706 | sim |
| 2014 | 242.929 | 190.553 | 190.553 | 0 | 0 | 188.673 | 190.553 / 188.673 | sim |
| 2015 | 237.879 | 188.689 | 188.689 | 0 | 0 | 186.441 | 188.689 / 186.441 | sim |
| 2016 | 237.506 | 187.891 | 187.891 | 0 | 0 | 186.081 | 187.891 / 186.081 | sim |
| 2017 | 236.481 | 185.925 | 185.925 | 0 | 0 | 184.145 | 185.925 / 184.145 | sim |
| 2018 | 236.460 | 183.746 | 183.746 | 0 | 0 | 181.939 | 183.746 / 181.939 | sim |
| 2019 | 228.521 | 182.468 | 182.468 | 0 | 0 | 180.610 | 182.468 / 180.610 | sim |
| 2020 | 224.229 | 181.279 | 181.279 | 0 | 0 | 179.533 | 181.279 / 179.533 | sim |
| 2021 | 221.140 | 180.057 | 180.057 | 0 | 0 | 178.370 | 180.057 / 178.370 | sim |
| 2022 | 224.649 | 184.332 | 184.332 | 0 | 4.259 | 178.346 | 184.332 / 178.346 | sim |
| 2023 | 217.625 | 180.230 | 180.230 | 0 | 0 | 178.476 | 180.230 / 178.476 | sim |
| 2024 | 215.545 | 181.065 | 181.065 | 0 | 0 | 179.286 | 181.065 / 179.286 | sim |
| 2025 | 214.192 | 180.540 | 180.540 | 0 | 0 | 178.766 | 180.540 / 178.766 | sim |

Leitura: toda escola em atividade do arquivo vira uma linha (publicadas = em atividade, 0 rejeitadas nas 19 edições) e o recorte coincide **exatamente** com o cadastro da P10.1 (mesmas escolas em atividade e mesmas escolas com matrícula básica, edição por edição; em 2025, 178.766 com matrícula, o recorte oficial da Sinopse). O bit0 da P10.1 não foi alterado.

## 3. Integridade (G10, invariantes sem referência oficial)
| Verificação | Resultado |
|---|---|
| Linhas do banco = linhas válidas lidas, por edição × UF | verificado **dentro de cada publicação** (a fatia aborta se divergir) |
| Código INEP válido, escola existente na edição, sem duplicata | 0 rejeições nas 19 edições (`INEP_INVALIDO`, `FORA_DO_CADASTRO`, `INEP_DUPLICADO`) |
| Domínio do atributo (0/1; inteiro ≥ 0; ≤ 32.767) | 0 `VALOR_INVALIDO` e 0 `VALOR_FORA_DE_FAIXA` depois de tratar os dois códigos oficiais `9` e `88888` |
| Agregados (`exec_edu_infra_agg`) = soma das escolas | verificado em cada publicação para internet (sim, não, escolas) |
| NULL preservado (≠ zero) | 2022: 4.259 `internet` NULL; `biblioteca` antes de 2009: 0 valores gravados |
| Replay | 513/513 fatias `NO_CHANGE` |

## 4. Invariantes semânticos (contradições dentro da mesma escola)
Para cada edição foi contado quantas escolas declaram simultaneamente itens que se excluem (`F_infraInvariants` em `reconciliacao_p103_producao.json`): água da rede **e** "sem abastecimento"; energia da rede **e** "sem energia"; esgoto da rede **e** "sem esgoto"; banda larga **sem** internet; internet para alunos **sem** internet; biblioteca **sem** "biblioteca e/ou sala de leitura". Resultado: **0 em todas as 19 edições**, o que sustenta a leitura dos campos como estados coerentes.

## 5. Códigos especiais do dicionário oficial (contados, não escondidos)
| Ano | Células "9 - Não informado" | Células "88888 - valor extremo" |
|---:|---:|---:|
| 2019 | 6.922 | 2.226 |
| 2020 | 7.792 | 2.155 |
| 2021 | 3.970 | 2.201 |
| 2022 | 8.522 | 3.218 |
| 2023 | 12.634 | 3.835 |
| 2024 | 8.516 | 4.134 |
| 2025 | 4.064 | 3.651 |

Em 2019–2025 o INEP marca com 88888 as quantidades de equipamentos acima de 4 por 3 salas (ou matrículas). Viram NULL e não entram em nenhuma soma. O código 9 aparece só em duas perguntas de acesso à internet por alunos.

## 6. Valores atípicos mantidos (dado oficial, sem correção)
| Ano | Maior `salas_utilizadas` | Maior `qt_tv` | Maior `qt_desktop_aluno` |
|---:|---:|---:|---:|
| 2007 | 4200 |  |  |
| 2008 | 4140 |  |  |
| 2012 | 3333 |  |  |
| 2013 | 1602 | 5024 |  |
| 2014 | 2514 | 5024 |  |
| 2015 | 1108 | 5024 |  |
| 2016 | 605 | 5024 |  |
| 2017 | 2504 | 153 |  |
| 2019 | 8888 | 250 | 1400 |
| 2020 | 9999 | 129 | 1400 |
| 2022 | 1616 | 131 | 1485 |
| 2023 | 2378 | 131 | 1485 |
| 2024 | 2379 | 133 | 2297 |

Valores como 8.888 e 9.999 salas (2019, 2020) parecem erros de digitação, mas são declarados e **permanecem**; o Cívica não os corrige. Somas territoriais de **quantidades** (salas, computadores) devem ser lidas com essa ressalva; os percentuais de existência (sim/não) não são afetados.

## 7. Questão metodológica da internet
`internet` é "tem acesso". O banco **não** deriva "escola conectada para aprendizagem" desse campo: a pergunta de uso pedagógico (`internet_aprendizagem`) existe só de 2019 e é uma coluna própria. Em 2025: 94,6% das escolas declaram acesso, 87,8% declaram banda larga (entre as com internet), 73,4% declaram internet para ensino e aprendizagem.
