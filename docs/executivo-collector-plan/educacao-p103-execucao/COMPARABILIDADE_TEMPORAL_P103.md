# Comparabilidade temporal · P10.3 (G2)

Estado: **PASS**. A matriz variável × edição foi construída a partir da **distribuição real de valores** de cada coluna em cada um dos 19 ZIPs do Censo (`evidencias/_infra_dist_AAAA.json`, 1.900 células) e conferida contra a vigência declarada no catálogo: **100 variáveis, 0 divergências** (`MATRIZ_VARIAVEIS_INFRAESTRUTURA_2007_2025.csv`, colunas `2007`…`2025` com `M` = coluna ausente, `E` = 100% em branco, `Z` = só zeros, `U` = só positivos, `V` = valores variados).

## 1. Regra de ouro
O ZIP histórico do INEP traz **o mesmo cabeçalho em todas as edições** e preenche com `0` ou branco as colunas que ainda não existiam. Presença de coluna ≠ existência da pergunta. A vigência vem da matriz (e do dicionário), e o valor fora dela vira **NULL = "fora da edição"**, nunca "não". Exemplo medido: `IN_AGUA_POTAVEL` vem `0` em 242.147 escolas em 2011 e é uma pergunta de 2019 em diante; `IN_BIBLIOTECA` vem 100% em branco em 2007.

## 2. Classificação das 100 variáveis de infraestrutura
| Classe | Quantas | Significado |
|---|---:|---|
| `COMPARABLE_ACROSS_YEARS` | 44 | mesma pergunta nas edições em que existe; série contínua dentro da vigência |
| `COMPARABLE_WITH_CAVEATS` | 4 | existe, mas a redação ou o conceito mudou de forma que pede ressalva (internet, banda larga, banheiro acessível, salas utilizadas) |
| `NEW_VARIABLE` | 43 | variável nova: sem série anterior (a maioria nasce em 2019; algumas em 2022–2024) |
| `DISCONTINUED` | 9 | encerrada em 2018, substituída por pergunta redefinida em 2019 (colunas separadas) |

**32 variáveis existem nas 19 edições (2007–2025)**: `agua_rede`, `agua_poco`, `agua_cacimba`, `agua_rio`, `agua_inexistente`, `energia_rede`, `energia_inexistente`, `esgoto_rede`, `esgoto_fossa`, `esgoto_inexistente`, `lixo_coleta`, `lixo_queima`, `lixo_enterra`, `internet`, `computador`, `lab_informatica`, `equip_tv`, `equip_dvd`, `equip_impressora`, `equip_copiadora`, `equip_parabolica`, `biblioteca_ou_leitura`, `lab_ciencias`, `quadra`, `parque_infantil`, `sala_professor`, `sala_diretoria`, `sala_aee`, `cozinha`, `predio_compartilhado`, `banheiro_pne`, `salas_utilizadas`.

## 3. A quebra de 2019 (infraestrutura)
| Até 2018 (`DISCONTINUED`) | De 2019 (`NEW_VARIABLE`) | Mudança |
|---|---|---|
| `agua_filtrada` (água consumida pelos alunos) | `agua_potavel` (fornece água potável) | pergunta diferente |
| `banheiro_dentro`, `banheiro_fora` | `banheiro` | antes localização do banheiro; depois existência |
| `salas_existentes` | `salas_dentro`, `salas_fora`, `salas_climatizadas`, `salas_acessiveis` | de "existentes" para "utilizadas" |
| `energia_gerador`, `energia_alternativa` | `energia_gerador_fossil`, `energia_renovavel` | fontes redefinidas |
| `dependencias_pne` | oito `acess_*` (rampa, corrimão, elevador, piso tátil, vão livre, sinais) | de um item agregado a recursos detalhados |
| `qt_comp_aluno`, `qt_computador` | `qt_desktop_aluno`, `qt_portatil_aluno`, `qt_tablet_aluno` | computadores separados por tipo |
| (sem equivalente) | `internet_alunos`, `internet_admin`, `internet_aprendizagem`, `internet_comunidade`, `internet_comp_aluno`, `internet_disp_pessoal` | usos da internet só existem de 2019 |

Regra aplicada: **séries contínuas só dentro de 2007–2018 ou de 2019–2025**, salvo variável marcada `COMPARABLE_ACROSS_YEARS`. Cada coluna do banco é uma única pergunta; as redefinidas **nunca** são somadas nem fundidas.

## 4. Casos que pedem cuidado explícito
- **Internet** (`COMPARABLE_WITH_CAVEATS`): "tem acesso" existe nas 19 edições, mas **"internet para ensino e aprendizagem", "para os alunos"** e os demais usos só existem de 2019 e **não são equivalentes** a "tem acesso". Banda larga só existe de 2008 e só se aplica a quem tem internet.
- **2022:** 4.259 escolas em atividade deixaram `IN_INTERNET` (e todas as demais perguntas) **em branco**. Preservado como NULL / "não informado" (`exec_edu_infra_cov.unanswered`). Nenhum "não" foi inventado: 2022 tem 157.477 "sim" e 22.596 "não", iguais ao levantamento independente da P10.
- **Biblioteca:** `biblioteca` (2009+) e `sala_leitura` (2009+) são separadas; `biblioteca_ou_leitura` é a **única** leitura presente nas 19 edições. Comparar 2007–2008 com 2009+ só pela variável combinada.
- **Quantidades de equipamentos:** de 2019 o INEP marca valores extremos com `88888` (NULL aqui); antes de 2019 os valores atípicos eram mantidos como declarados.
- **Salas de aula:** `salas_utilizadas` existe nas 19 edições, mas até 2018 convive com "existentes" e, em 2007, todas as escolas ativas declaram pelo menos 1 sala.

## 5. Indicadores Educacionais oficiais: eras do arquivo e do indicador
Três eras de layout de planilha foram lidas: 2007–2016 (`.xls`/`.xlsx` separados por Brasil, regiões e UFs; códigos `ATU_INF`, `TIPOLOCA`, `Dependad`), 2017–2018 (`ATU_F14`…) e 2019–2025 (códigos `*_CAT_*`). O extrator normaliza os códigos para o catálogo e o resultado de cada edição foi conferido célula a célula.

| Família | Primeira edição (escola / território) | Observação de comparabilidade |
|---|---|---|
| ATU média de alunos por turma | 2007 / 2007 | série contínua; difere da razão derivada do Cívica (ver `CONTRATOS_BENCHMARKS_P103.md`) |
| HAD horas-aula diárias | 2010 / 2010 | rótulo "metodologia ajustada" nos arquivos recentes: conferir a nota técnica do INEP antes de comparar 2010–2015 com 2016+ |
| DSU % de funções docentes com curso superior | 2011 / 2011 | unidade = **função docente**; em 2025 a coluna "profissional" some e surgem EJA fundamental e médio |
| AFD adequação da formação | 2013 / 2013 | grupos 1–5; o INEP publicou nota de retificação (2020) e nota de atualização do indicador: **não lidas nesta onda**; tratar a série como `COMPARABLE_WITH_CAVEATS` |
| IED esforço docente | 2013 / 2013 | níveis 1–6 |
| IRD regularidade | 2013 / 2013 | escola: média 1–5; território: % de escolas por faixa |
| ICG complexidade de gestão | 2013 (escola) / 2016 (território) | níveis 1–6 |

O Cívica **não** harmoniza nem reconstrói séries: guarda o publicado. Qualquer série de AFD/IED/IRD/HAD exibida deve levar um aviso "série com quebras metodológicas do INEP" e a referência às notas técnicas (`inep_indicadores_arquivos.csv`).

## 6. Docentes oficiais (Sinopse)
Série 2007–2025 de docentes distintos por Brasil, UF e município. A pergunta de contagem é a mesma, mas a Sinopse muda de layout (tabela 2.1 passa a trazer colunas de itinerário formativo em 2022–2025). O Cívica guarda apenas oito colunas por etapa e sete por rede/localização, escolhidas **pelo rótulo**, e deixa NULL a que a edição não tem.
