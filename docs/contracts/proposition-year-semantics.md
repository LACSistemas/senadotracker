# YEAR_SEMANTICS: recorte temporal das proposições

Investigação (somente leitura) de 2026-10-05. Nada foi alterado em collectors, banco, contratos, queries ou frontend.
Fontes: `projetoeleitor_db` (schemas `civica_poc`, `civica`), arquivo bruto `proposicoes-2026.json` da Câmara (44.356 registros),
JSONs brutos do Senado salvos em `data/raw`, e consultas pontuais (GET, sem gravação) à API oficial da Câmara e do Senado para
conferir exemplos. Scripts de apoio em `scripts/audit-year-semantics.ts`.

## 1. Resumo executivo

1. **`year` é o ano do número da proposição, não "o ano em que foi apresentada".** `presented_at` é a data oficial de apresentação
   registrada pela fonte. As duas dimensões coincidem para a maioria das matérias da Câmara com número anual (PL, REQ, RIC, DOC…) e divergem
   por três mecanismos distintos (abaixo).
2. **Câmara: 22.254 de 44.356 (50,2%) têm `year = 0`.** Não é falha do parser: a fonte informa `ano = 0` para 28 siglas numeradas por órgão (26 integralmente, mais RPD e PAR quase inteiras)
   ou por matéria (PRL, RPD, SBT, SBT-A, PARF, RDF, EMR, EMP, EMC-A, DTQ, SBR, SBE-A…), todas com `uriOrgaoNumerador`. Em 2026 elas são
   10.718 de 10.758 pareceres, 6.800 de 6.821 instrumentos de votação e 3.711 de 5.169 emendas/substitutivos. O filtro `year = 2026` as exclui.
3. **Senado: `year` sempre válido (100%), mas 2.301 matérias (5,7%) foram apresentadas em ano posterior ao do número** (PDL 64%, PL 9,7%).
   Matérias de origem na Câmara mantêm o número e o ano de origem; `presented_at` é a data de apresentação no Senado (ex.: PEC 221/2019,
   `DataApresentacao` 2026-05-28). O contrário (ano do número posterior à apresentação) ocorre em 179 casos (RQS 1/2026 apresentado em 2025-12-30).
4. **Hoje o produto usa quatro dimensões diferentes sem declará-las:** `/proposicoes` usa `year`; as páginas das Casas usam `presented_at`;
   os tópicos do Senado usam `presented_at ∪ deliberadas no ano`; a contagem por parlamentar não usa ano algum. Na Câmara, "eventos" e
   "recentes" descartam eventos de matérias de outros anos: 23% dos eventos de 2026 (4.987 de 21.350) e 30% no Senado (7.958 de 26.367).
5. **Tamanho do efeito:** Câmara 22.102 (`year`) × 43.971 (`presented_at`); Senado 2.238 × 2.557. Por grupo, a diferença é quase total em
   pareceres (40 × 10.758) e instrumentos de votação (21 × 6.821). No ranking de autores da Câmara a troca de dimensão transforma relatores
   e comissões em "campeões de autoria" (Altineu Côrtes 12 → 2.487), então autoria não pode herdar o mesmo recorte.
6. **Uma única regra não serve a todos os grupos.** Recomendação: `identifierYear` para matérias principais e documentos de numeração anual;
   `presentedAt` para documentos acessórios; `activity` (eventos) como conceito próprio e separado, ainda não implementável por cobertura
   (só 42% das proposições da Câmara e 9% das do Senado têm átomos de evento).
7. **Matérias de suporte (`proposal_support`) ficam fora de qualquer denominador.** Doze têm `presented_at` em 2026 mas número anterior; entram,
   se for o caso, só em "atividade em 2026 envolvendo matéria histórica" (5.775 matérias, 20.713 filhos apresentados em 2026), nunca em "apresentadas em 2026".
8. **Correção de uma afirmação anterior:** o relatório `proposition-graph.md` dizia que "Recentes" usa data de apresentação sem filtro de
   ano e inclui itens `ano = 0`. Está errado: a consulta que alimenta todo o pacote operacional filtra `WHERE p.year = $1`, então "Recentes"
   também os exclui. O texto foi corrigido naquele relatório.

**Gate:** `YEAR_SEMANTICS = CLEAR_TO_IMPLEMENT` para o contrato temporal e a rotulagem (seções 12 e 13); `activityYear` fica fora
até haver cobertura de eventos (seção 14).

## 2. Campos temporais existentes

Procurados no schema (`information_schema`) e no código de coleta. Não há `publication_date`, `created_at` nem ano de sessão legislativa em `proposals`.

| Campo | Casa | Semântica | Fonte | Cobertura | Confiabilidade |
|---|---|---|---|---|---|
| `civica_poc.proposals.year` (int, nullable) | Câmara | Ano do número (`ano` da lista anual); **0** em tipos numerados por órgão | direto da fonte (`proposicoes-2026.json`) | 22.102 válidos (49,8%); 22.254 com 0 | alta onde ≠ 0; "sem ano" onde 0 |
| `civica_poc.proposals.year` | Senado | `Materia.Ano` (ano do número; para matéria de origem na Câmara, o ano de origem) | direto (`/senador/{id}/autorias`, `relatorias`) | 40.267 (100%) | alta como identificador; não indica ano de entrada no Senado |
| `civica_poc.proposals.presented_at` (timestamptz) | Câmara | `dataApresentacao` (data e hora, horário de Brasília) | direto | 44.356 (100%); 2005-04-12 a 2026-09-04 | alta; 385 registros (378 EMC) têm data de 2025 e número 2026 |
| `civica_poc.proposals.presented_at` | Senado | `Materia.Data` = `DadosBasicosMateria.DataApresentacao` (só data; 00:00 BRT); apresentação **no Senado** | direto (confirmado na API em 4 casos) | 40.267 (100%); 1949-05-31 a 2026-09-14 | alta |
| `civica_poc.proposals.number` / `label` | ambas | Número e rótulo; **não são únicos** (Câmara 1.712 rótulos repetidos em 6.362 linhas; Senado 1.003 em 6.250) | direto/derivado | 100% | identidade é `external_id` |
| `civica_poc.proposal_support.year` / `presented_at` | Câmara | Mesmas semânticas, vindas do detalhe oficial (`/proposicoes/{id}`) | direto | 6.178 linhas; `year` nulo em 144 (`ano = 0`) | alta |
| `civica_poc.proposal_parent_context.parent_year`, `proposal_identity_bridge.matter_year` | ambas | ano do número do pai / da matéria | derivado de coletas anteriores | parcial | média |
| `civica_poc.proposal_detail_atoms.occurred_at` (text, ISO) | ambas | data de um evento (movimentação, situação, pauta, efeito de votação, documento, norma) | direto (tramitações, pauta, votações) | átomos em 18.824 proposições da Câmara (42%) e 3.549 do Senado (9%) | alta onde existe; cobertura parcial |
| `civica.deliberations.date` / `year` | ambas | data da deliberação nominal | direto | Câmara 14.720 em 2026; Senado 118 | alta |
| raw `ultimoStatus.data` (Câmara) | Câmara | data do último estado de tramitação; **não gravada em `civica_poc`** (`payload` nulo) | direto, só no arquivo bruto | 44.356; 43.977 em 2026 | alta; ausente do banco |
| `civica_poc.proposition_batches.published_at` | ambas | quando **nós** publicamos o lote (Câmara 2026-09-25; Senado 2026-09-15) | derivado por nós | 100% | não é dado legislativo |
| `civica.raw_objects.fetched_at` | ambas | quando coletamos o arquivo/endpoint | derivado por nós | 100% | não é dado legislativo |
| `civica_poc.proposition_operational_components.year` / `refreshed_at` | ambas | chave do recorte anual e atualização do componente | derivado | por ano | — |

Observação sobre o `0`: o carregador em massa grava `year ? Number(year) : null` e um script de correção do banco de laboratório faz
`SET year = NULL WHERE year = 0`, mas o banco de produção contém `0` (nenhuma linha nula). A origem exata do `0` no PG não foi rastreada;
o contrato proposto trata "sem ano" como `NULL`.

## 3. `presented_at`: o que representa (conferido na fonte)

**Câmara.** `dataApresentacao` do endpoint de proposições. Cada tipo é uma entidade própria com a sua data:

| Caso | Fonte oficial | Leitura |
|---|---|---|
| PRL 2/? (id 2617409), `ano = 0` | `dataApresentacao 2026-04-16T14:49`; status "Análise Parecer", órgão CCJC, mesma data/hora | data do documento (parecer), único evento |
| RPD 32 (id 2626809), `ano = 0` | `2026-05-21T10:09`; status "Apresentação de Proposição", PLEN | data da votação nominal/destaque |
| EMC 49/2026 (id 2612107) | `ano 2026`, `dataApresentacao 2025-12-08`, órgão numerador `MPV132625` (comissão mista da MPV 1326/2025) | apresentada em dez/2025, numerada em 2026 |
| PL 6674/2025 (id 2609001) | `ano 2025`, `dataApresentacao 2026-03-13T17:31`, id na faixa de registros criados em março/2026 | registro criado em 2026 com número de 2025 (motivo não esclarecido pela fonte) |

Em 30.137 dos 44.356 registros (68%) a data de apresentação é o mesmo dia do último estado, e em 21.048 dos 22.254 `ano = 0` (94,6%): são
documentos de evento único. Para matérias principais, o último estado é posterior.

**Senado.** Em todos os quatro casos conferidos, `Materia.Data` da lista coincide com `DadosBasicosMateria.DataApresentacao`:

| Matéria | Origem | `AnoMateria` | `DataApresentacao` |
|---|---|---|---|
| PEC 221/2019 (id 174386) | CD | 2019 | 2026-05-28 |
| PDL 627/2025 (id 173244) | CD | 2025 | 2026-03-20 |
| PL 180/2020 (id 140562) | CD | 2020 | 2019-12-19 (leitura em 2020-02-06) |
| RQS 1/2026 (id 172389) | SF | 2026 | 2025-12-30 |

Para matéria de origem na Câmara, `presented_at` é a chegada/apresentação no Senado, não a apresentação original. Não é primeira
apresentação da proposição legislativa, é a apresentação **naquela Casa**.

## 4. `year = 0` e cobertura do `year`

| Casa | Grupo funcional | Linhas | `year` válido | `year = 0` | % `year = 0` |
|---|---|---|---|---|---|
| Câmara | Pareceres e relatórios | 10.758 | 40 | 10.718 | 99,6% |
| Câmara | Instrumentos de votação (RPD, DTQ, VTS…) | 6.821 | 21 | 6.800 | 99,7% |
| Câmara | Emendas e substitutivos | 5.169 | 1.458 | 3.711 | 71,8% |
| Câmara | Atos e documentos especiais | 1.675 | 650 | 1.025 | 61,2% |
| Câmara | Matérias principais, requerimentos, indicações, ofícios, mensagens, recursos | 19.933 | 100% | 0 | 0% |
| Senado | todos os grupos | 40.267 | 40.267 | 0 | 0% |

Siglas da Câmara com pior cobertura (todas 0% válido, exceto onde indicado): PRL 6.872; RPD 6.520 (1 válido); PAR 2.968 (19 válidos);
SBT 1.543; RDF 715; SBT-A 636; PARF 542; EMR 454; EMP 423; EMC-A 313; PRLP 283; DTQ 245; SBR 204; PPP 136; SBE-A 130; PRLE 71; PEP 54;
VTS 36; ERD 23; PES 20; SSP 19; CVO 19; PSS 12; RRL 12; PPR 9; PRV 6; EMA 5; RLP 1. Quase completos: EMC 1.338/1.340; ESB 118/119.

O que `0` significa: **informação ausente por desenho da fonte**. Esses documentos são numerados por órgão (todos trazem `uriOrgaoNumerador`)
e a numeração reinicia por órgão/matéria (ex.: "SBT 1" existe dezenas de vezes), então o par número+ano não identifica nem situa a entidade
no tempo. Não é parser (o parser lê `ano` literalmente), não é sigla ausente e não é falha de coleta. Senado: sem ocorrências de 0/nulo.

Distribuição por ano do número (catálogo ativo): Câmara 2026 = 22.102 e 0 = 22.254 (nenhum outro ano); Senado 2026 = 2.238, 2025 = 4.053,
2024 = 4.125, 2023 = 4.658, 2022 = 2.495, 2021 = 4.235, … até 1981 (40.267 no total, cobertura "matérias de autoria/relatoria dos senadores atuais").

## 5. `year` × `presented_at`

Classes: A iguais; B `year` anterior ao ano de `presented_at`; C `year` posterior; D `year = 0` com data; E `year` válido sem data; F ambos ausentes.
Data e ano em fuso de São Paulo. E e F têm 0 ocorrências nas duas Casas.

| Casa | A | B | C | D | E | F | Total |
|---|---|---|---|---|---|---|---|
| Câmara | 21.717 (49,0%) | 0 | 385 (0,9%) | 22.254 (50,2%) | 0 | 0 | 44.356 |
| Senado | 37.787 (93,8%) | 2.301 (5,7%) | 179 (0,4%) | 0 | 0 | 0 | 40.267 |

Por grupo (A / B / C / D):

| Casa · grupo | A | B | C | D |
|---|---|---|---|---|
| Câmara · principais | 6.175 | 0 | 3 | 0 |
| Câmara · requerimentos | 9.284 | 0 | 2 | 0 |
| Câmara · pareceres | 40 | 0 | 0 | 10.718 |
| Câmara · instrumentos de votação | 21 | 0 | 0 | 6.800 |
| Câmara · emendas e substitutivos | 1.080 | 0 | 378 | 3.711 |
| Câmara · atos especiais | 648 | 0 | 2 | 1.025 |
| Câmara · indicações / ofícios / mensagens / recursos | 100% | 0 | 0 | 0 |
| Senado · principais | 13.487 | 2.290 | 109 | 0 |
| Senado · requerimentos | 20.690 | 0 | 51 | 0 |
| Senado · atos especiais | 2.361 | 11 | 3 | 0 |
| Senado · mensagens | 678 | 0 | 11 | 0 |
| Senado · ofícios / indicações / recursos | 98–100% | 0 | ≤2% | 0 |

Siglas do Senado com B relevante: PDL 64,2% (1.631 de 2.540), PL 9,7% (632 de 6.503), PLP 3,7%, PEC 1,3%, SCD 42%.
Siglas com C: RQS 0,4%, PL 1,1%, MSF 1,7%, OFS 1,9%, PDS 1,0%.

Distância `ano(presented_at) − year`:

| Distância | Câmara | Senado |
|---|---|---|
| `year = 0` | 22.254 | 0 |
| negativa (número posterior) | 385 | 179 |
| 0 | 21.717 | 37.787 |
| +1 | 0 | 1.467 |
| +2 | 0 | 490 |
| +3 | 0 | 153 |
| +4 | 0 | 112 |
| +5 a +9 | 0 | 76 |
| +10 ou mais | 0 | 3 |

Entre as apresentadas em 2026: Câmara 21.717 com número 2026 e 22.254 sem ano (nenhuma com número anterior no catálogo); Senado 2.234 com número
2026, 261 com número 2025 (+1), 36 (+2), 12 (+3) e 14 de +4 a +9. Ou seja, no Senado ~12,6% das apresentações de 2026 são de matérias numeradas antes.
O catálogo da Câmara é o arquivo anual de 2026, que reúne os números de 2026 e os tipos sem ano; matérias numeradas em 2025 e apresentadas
em 2026 (como PL 6674/2025) ficam em outro arquivo anual e só aparecem aqui como matéria de suporte (12 conhecidas). Portanto o cenário
"por `presented_at`" para a Câmara é um piso: a cobertura de matérias com número anterior apresentadas em 2026 é desconhecida (ver seção 14).

## 6. Exemplos reais

Rota do Cívica: `/legislativo/proposicoes/{casa}/{external_id}`. Origem de todos: catálogo ativo (`civica_poc.proposals`) a partir da lista oficial.

| Situação | Casa | id | Tipo/nº | `year` | `presented_at` | Rótulo / ementa (resumo) |
|---|---|---|---|---|---|---|
| `year=0` + 2026 · parecer | Câmara | 2617409 | PRL 2 | 0 | 2026-04-16 14:49 | Parecer do Relator (CCJC) |
| `year=0` + 2026 · parecer | Câmara | 2628908 | PAR 1 | 0 | 2026-05-28 13:53 | Parecer da Comissão (CDU) ao PL 3444/2025 |
| `year=0` + 2026 · destaque/votação | Câmara | 2626809 | RPD 32 | 0 | 2026-05-21 10:09 | Votação nominal de retirada de pauta, PL 2766/2021 |
| `year=0` + 2026 · destaque | Câmara | 2604343 | DTQ 6 | 0 | 2026-02-24 19:48 | Destaque de Emenda, PL 278/2026 |
| `year=0` + 2026 · substitutivo | Câmara | 2624345 | SBT 1 | 0 | 2026-05-12 21:03 | Substitutivo (altera a Lei 5.478) |
| `year=0` + 2026 · emenda | Câmara | 2604267 | EMP 55 | 0 | 2026-02-24 17:33 | Emenda de plenário (altera a Lei 11.196/2005) |
| `year=0` + 2026 · acessório | Câmara | 2604954 | RDF 1 | 0 | 2026-02-25 19:50 | Redação Final ao PDL 388/2025 |
| Número 2026, apresentada em 2025 · emenda | Câmara | 2612107 | EMC 49 | 2026 | 2025-12-08 | Emenda à MPV 1326/2025 |
| Principal, ano = apresentação | Câmara | 2600075 | PL 32 | 2026 | 2026-02-02 10:50 | Proteção a motociclistas |
| Requerimento | Câmara | 2604005 | REQ 1056 | 2026 | 2026-02-24 12:18 | Sessão solene |
| Emenda com `year` válido | Câmara | 2625997 | EMC 2 | 2026 | 2026-02-06 | Emenda à MPV 1334/2026 |
| Documento acessório com ano | Câmara | 2600879 | DOC 45 | 2026 | 2026-02-04 14:17 | Ofício SF nº 5/26 |
| Número 2025, apresentada em 2026 · fora do catálogo (suporte) | Câmara | 2609001 | PL 6674 | 2025 | 2026-03-13 17:31 | "Antes que Aconteça" (matéria de suporte) |
| Número 2025, apresentado em 2026 | Senado | 173244 | PDL 627 | 2025 | 2026-03-20 | Renova permissão de rádio (origem CD) |
| Número muito anterior, apresentada em 2026 · principal | Senado | 174386 | PEC 221 | 2019 | 2026-05-28 | Redução da jornada (origem CD) |
| Número muito anterior | Senado | 173225 | PL 127 | 2019 | 2026-03-19 | Título de Capital Nacional do Basquete |
| Número posterior à apresentação | Senado | 172389 | RQS 1 | 2026 | 2025-12-30 | Voto de pesar |
| Número posterior à apresentação | Senado | 140562 | PL 180 | 2020 | 2019-12-19 | Origem CD |
| Principal, ano = apresentação | Senado | 174664 | PL 3140 | 2026 | 2026-06-16 | Altera a Lei 8.080/1990 |
| Requerimento, ano = apresentação | Senado | 174993 | RQS 511 | 2026 | 2026-07-07 | Destaque para votação em separado |

## 7. O que medimos hoje (auditoria de métricas)

`/legislativo/proposicoes` é alimentado por `buildOperationalRich(year)` (`apps/web/lib/data-postgres.ts`): **toda** a base do pacote vem de
`SELECT … FROM civica_poc.proposals … WHERE p.year = $1`, e eventos só contam se `universe.has(source:id)`, isto é, se a matéria tem `year = $1`.

| # | Bloco / métrica (texto mostrado hoje) | Consulta real | Dimensão | Significado real | Texto corresponde? |
|---|---|---|---|---|---|
| 1 | Hero: "N proposições com ano 2026"; eyebrow "Atividade legislativa · {Casa} · 2026" | `p.year = 2026` | ano do número | contagem de proposições numeradas em 2026 | "com ano" sim; "Atividade legislativa" **não** (não é atividade) |
| 2 | Composição por função ("Todas as proposições publicadas com ano 2026" + nota) | `p.year = 2026` | ano do número | idem; exclui 22.254 da Câmara | sim, com a nota de exclusão |
| 3 | Fato-tese: "Em 2026, X% da atividade registrada na Câmara foi de proposições legislativas principais" | principais ÷ total, universo `year=2026` | ano do número | fração de numeradas em 2026 (28,0% Câmara; 23,7% Senado) | **não**: "atividade registrada" não é o universo; por `presented_at` seria 14,0% e 33,3% |
| 4 | Rio de tramitação ("Matérias principais com ano 2026") | principais com `year = 2026`; estágios por átomos | ano do número | idem | sim |
| 5 | Estagnação (dias sem movimento) | principais `year = 2026` + átomos de 2026 | ano do número | só matérias numeradas em 2026 | sim, mas ignora matérias antigas em movimento |
| 6 | Ritmo "Novas proposições" ("Proposições com ano 2026, por mês de apresentação") | `year = 2026` **e** `presented_at` em 2026 | ano do número ∩ apresentação | Câmara 21.717; ignora 22.254 sem ano | sim, após o ajuste |
| 7 | Ritmo "Eventos" ("Registros de tramitação por mês de ocorrência, 2026") | átomos de 2026 de matérias com `year = 2026` | evento ∩ ano do número | Câmara 16.363 de 21.350 eventos (76,6%); Senado 18.409 de 26.367 (69,8%) | **parcial**: o texto sugere todos os eventos de 2026 |
| 8 | Calendário de eventos | idem | idem | idem | **parcial** |
| 9 | "Recentes" (últimos 7 dias) | eventos + apresentações dos últimos 7 dias, só de matérias `year = 2026` | evento/apresentação ∩ ano do número | exclui sem-ano e matérias antigas | **parcial** |
| 10 | DNA por partido/parlamentar ("autorias com partido, 2026") | `proposal_authors ⋈ proposals WHERE p.year = 2026` | ano do número | autorias de matérias numeradas em 2026 | sim, mas em recorte por ano |
| 11 | `/explorar`, filtro "Ano do número" | `p.year = $N` | ano do número | idem | sim, após o ajuste |
| 12 | `/explorar`, "Apresentada em" no cartão e no detalhe | `presented_at` | apresentação | data oficial | sim |
| 13 | Composição de resultados / facetas de ano | `GROUP BY` sobre o filtro corrente; anos vêm de `p.year` | ano do número | idem | sim |
| 14 | Páginas das Casas: "recebidas", backlog, tempo de tramitação | `p.presented_at ∈ [1/1, 1/1+1)` | apresentação | apresentadas no ano (inclui sem-ano) | não auditado texto a texto; dimensão **diferente** de `/proposicoes` |
| 15 | Contagem de proposições por parlamentar (perfil, ranking, partidos "identificadas em {ano}") | `activityMap(source, year)` com `yearClause = ''` | **nenhuma** | todas as autorias do lote ativo (Senado: 1949–2026) | **risco**: o rótulo cita o ano; a consulta não filtra |
| 16 | Tópicos da Casa, Câmara ("proposições do ano legislativo 2026; documentos acessórios sem ano próprio ficam fora") | `p.year = $2` | ano do número | idem | sim (a nota já declara a exclusão), mas "ano legislativo" é terceiro vocabulário |
| 17 | Tópicos da Casa, Senado ("matérias apresentadas ou deliberadas em 2026") | `presented_at ∈ ano` **∪** deliberações do ano | apresentação ∪ deliberação | quase "atividade" | sim, mas **não comparável** com a Câmara |
| 18 | Seletor de ano em `/proposicoes` | anos extraídos de `proposals` **já filtradas** por `year = $1` | ano do número | lista só o ano pedido (hoje só 2026) | limitação: o seletor não oferece outros anos |
| 19 | Caso "MPV 1343" (`CaseSection`) | filhos por `principal_id`, sem ano | nenhuma | rede da matéria | texto fala em "proposições relacionadas" |

Textos do tipo "apresentadas em 2026" com `year = 2026` já foram trocados na etapa anterior (rio de tramitação, ritmo, topo). Restam como
divergência textual o fato-tese (#3), eventos/calendário/recentes (#7 a #9), o rótulo "Atividade legislativa" (#1), os rótulos de contagem
por parlamentar (#15) e a diferença Câmara × Senado nos tópicos (#16 e #17).

## 8. Diferenças por functional_group e recomendação

"Ano da matéria" = o ano ao qual a entidade pertence por identidade; "atividade no ano" = o que aconteceu no ano.

| Grupo funcional | Dimensão para "ano da matéria" | Dimensão para "atividade no ano" | Justificativa |
|---|---|---|---|
| Matérias principais (PL, PLP, PEC, MPV, PDL…) | `identifierYear` (editorialmente útil: "PL 123/2026"); no Senado exibir também `presentedAt` (apresentação naquela Casa) | eventos de tramitação, votações e apresentações de filhos | `year` e `presented_at` coincidem na Câmara (99,95%); no Senado 15% diferem (PDL 64%) |
| Requerimentos | `identifierYear` | `presentedAt` + resultado/evento | coincidem (99,98%); o interesse é quando foi pedido |
| Indicações, sugestões | `identifierYear` | `presentedAt` | coincidem em 100% |
| Ofícios e documentos | `identifierYear` | `presentedAt` | coincidem em 100% |
| Mensagens e comunicações | `identifierYear` | `presentedAt` | coincidem em 100% |
| Recursos, representações, petições | `identifierYear` | `presentedAt` | coincidem em 100% |
| Pareceres e relatórios (Câmara) | **não definido** (`year` é 0 em 99,6%); opcional: `identifierYear` da matéria raiz via `principal_id` | `presentedAt` | numeração por órgão; a data é do documento |
| Instrumentos de votação (RPD, DTQ, VTS) | **não definido** (99,7% sem ano); opcional: ano da matéria raiz | `presentedAt` (a votação ocorreu naquele dia) | idem |
| Emendas e substitutivos (Câmara) | `identifierYear` só onde existe (EMC/ESB); caso geral: ano da matéria raiz | `presentedAt` (EMC: 378 apresentadas em 2025 com número 2026) | 71,8% sem ano; EMC numeradas por comissão mista |
| Atos e documentos especiais | **não definido** (61% sem ano) | `presentedAt` | tipos mistos |

## 9. Impacto quantitativo: cenário A (`year = 2026`) × cenário B (`presented_at` em 2026)

Fuso de São Paulo; catálogo ativo (sem suporte).

| Medida | Câmara A | Câmara B | Senado A | Senado B |
|---|---|---|---|---|
| Total | 22.102 | 43.971 | 2.238 | 2.557 |
| A e B (interseção) | 21.717 | 21.717 | 2.234 | 2.234 |
| Só A / só B | 385 / 22.254 | | 4 / 323 | |
| Matérias principais | 6.178 | 6.175 | 531 | 852 |
| Requerimentos | 9.286 | 9.284 | 1.600 | 1.598 |
| Pareceres e relatórios | 40 | 10.758 | n/a | n/a |
| Instrumentos de votação | 21 | 6.821 | n/a | n/a |
| Emendas e substitutivos | 1.458 | 4.791 | n/a | n/a |
| Atos e documentos especiais | 650 | 1.673 | 38 | 38 |
| Indicações / ofícios / mensagens / recursos | iguais | iguais | iguais | iguais |

Por sigla (A → B), principais: PL 4.867 → 4.864; PLP 207 → 207; PDL 964 → 964 (Câmara); Senado PL 396 → 453; PDL 41 → 303. Outras (Câmara):
PRL 0 → 6.872; RPD 1 → 6.520; PAR 19 → 2.968; SBT 0 → 1.543; EMC 1.338 → 962; RDF 0 → 715; SBT-A 0 → 636; PARF 0 → 542; EMR 0 → 454; EMP 0 → 423.

Por mês (ritmo "novas proposições": A = `year` e apresentação no ano; B = apresentação no ano):

| Mês 2026 | Câmara A | Câmara B | Senado A | Senado B |
|---|---|---|---|---|
| jan | 19 | 48 | 74 | 87 |
| fev | 3.572 | 5.233 | 261 | 279 |
| mar | 3.814 | 7.748 | 387 | 492 |
| abr | 3.193 | 7.416 | 333 | 338 |
| mai | 3.426 | 8.224 | 343 | 403 |
| jun | 2.880 | 5.801 | 291 | 362 |
| jul | 3.153 | 5.627 | 224 | 275 |
| ago | 1.445 | 2.997 | 221 | 221 |
| set (parcial) | 215 | 877 | 100 | 100 |

Autores: autorias distintas e vínculos (Câmara A: 657 autores / 31.561 vínculos; B: 667 / 54.997; Senado: 80 / 3.802 × 80 / 3.799). Ranking de
autores da Câmara por proposições distintas: com B, 1º Altineu Côrtes 2.487 (A: 12), 4º "Comissão de Constituição e Justiça e de Cidadania"
1.510 (A: 17), 5º "Comissão de Comunicação" 1.413 (A: 697): em B entram relatores de pareceres e comissões como autores. Partidos (Câmara):
PL 4.075 → 10.949; PT 2.362 → 4.895; REPUBLIC 2.289 → 3.906. No Senado o ranking praticamente não muda (Damares 388 → 388).

Temas: proposições com tema, Câmara 10.449 (A) × 10.444 (B), os principais temas mudam menos de 0,1%; Senado 528 × 851 (A × B), com
"Infraestrutura / Comunicações / Rádio e TV" 7 → 265 por causa dos PDL de outorga de rádio.

Status: Câmara sem status 4.963 (22,5% de A) × 23.590 (53,7% de B); Senado 100% sem status nas duas visões (o catálogo do Senado não traz
situação). "Aguardando Providências Internas" 1.577 → 4.098.

Eventos de 2026 (átomos `movement`, `situation`, `agenda_item`, `vote_effect`, `resulting_norm`, `body`): Câmara 21.350, dos quais
16.363 em matérias `year = 2026` e 4.987 em matérias de `year = 0`; Senado 26.367, 18.409 e 7.958 em matérias de outros anos.

## 10. Identidade e duplicação

- Cada linha de `civica_poc.proposals` é uma entidade única por `(source, external_id)`: 44.356 e 40.267 linhas, 0 repetidas.
- `presented_at` é **um** timestamp por entidade (não há histórico de várias apresentações). Para uma EMC, um SBT, um parecer, é a data da
  própria entidade; um SBT adotado e a emenda que o originou são entidades distintas com datas distintas.
- Somar linhas diretamente em B é seguro estatisticamente (sem duplicação), mas mistura **tipos de entidade** (parecer, destaque, emenda,
  proposição): o total 43.971 não é "projetos apresentados". Totais em B precisam sempre sair por grupo ou rotulados como "documentos e
  proposições".
- Rótulos (`tipo número/ano`) não identificam: a Câmara repete 1.712 chaves em 6.362 linhas (EMC numeradas por comissão mista) e o Senado
  1.003 em 6.250; entre os `year = 0` há 22.254 linhas para 4.360 combinações tipo+número+dia. Contagens por rótulo duplicariam ou fundiriam
  entidades; contar sempre por `external_id`.
- `presented_at` não é garantidamente "primeira apresentação": no Senado é a apresentação naquela Casa; na Câmara há registros cuja data
  é posterior ao número (PL 6674/2025).
- Autoria multiplica linhas (um vínculo por autor): contar `DISTINCT proposal_id` ao agregar por autor (já é o que o DNA faz).

## 11. Riscos

1. **Trocar `year` por `presented_at` sem separar grupos** infla autoria com relatores/comissões e muda o significado de "proposições" (parecer ≠ projeto).
2. **Piso da Câmara em B:** o catálogo é o arquivo anual de 2026; matérias de número anterior apresentadas em 2026 não estão nele (12 viram suporte).
3. **Senado em B:** o catálogo é por parlamentares atuais (autoria/relatoria), não o universo do Senado; B representa "do recorte coletado".
4. **Rótulo "atividade"** hoje aplicado a recortes por número (#1, #3).
5. **Contagem por parlamentar sem ano** (#15) com rótulo de ano.
6. **Eventos de matérias antigas descartados** (23% e 30% dos eventos de 2026), subestimando atividade real.
7. **Cobertura de eventos baixa** (42% das proposições da Câmara, 9% do Senado têm átomos): "atividade" por eventos é parcial.
8. **Câmara × Senado não comparáveis hoje** nos tópicos (#16 × #17).
9. **Origem do `0`** no banco de produção não rastreada; a mudança para `NULL` precisa de verificação do carregador.
10. **Fuso:** Câmara grava horário local sem fuso; a derivação do ano deve usar `America/Sao_Paulo` (a meia-noite BRT do Senado é 03:00 UTC).

## 12. Matéria de suporte não contamina

- `civica_poc.proposal_support` (6.178 linhas) não entra em A nem em B: nenhuma das consultas que alimentam os blocos lê a tabela (auditado na etapa anterior).
- Suporte com `presented_at` em 2026: **12**; com `year = 2026`: **0**. Em B ela seria contada **se** alguém juntasse a tabela; a regra é que não entre.
- Três conceitos que precisam permanecer separados:
  1. **proposição catalogada/apresentada no ano**: linha de `proposals` que satisfaz o critério do cenário;
  2. **matéria histórica recuperada como dependência**: `proposal_support`; existe para contexto e navegação;
  3. **atividade no ano envolvendo matéria histórica**: filhos do catálogo apresentados no ano apontando para suporte: **5.775 matérias de suporte, 20.713 filhos** (de 21.092) em 2026.
  Esse terceiro número é conceito de "atividade" e deve aparecer, se aparecer, em bloco próprio, nunca somado à contagem de apresentadas.

## 13. Proposta de contrato temporal e recomendação por bloco

### Contrato conceitual

| Campo | Significado | Origem | Nulo quando |
|---|---|---|---|
| `identifierYear` | ano oficial do **número** da proposição (hoje `year`) | `ano` (Câmara), `Ano` (Senado) | a fonte informa `ano = 0` (documento numerado por órgão): `NULL`, nunca `0` |
| `presentedAt` | data oficial de apresentação **daquela entidade, naquela Casa** | `dataApresentacao` / `DataApresentacao` | nunca (100% preenchido) |
| `presentedYear` | ano civil de `presentedAt` em `America/Sao_Paulo` | derivado | idem |
| `matterYear` | `identifierYear` da matéria raiz via `principal_id` (para acessórios sem ano) | derivado do grafo | cadeia sem raiz (280 emendas hoje) |
| `lastStatusAt` | data do último estado de tramitação (Câmara; só no bruto hoje) | `ultimoStatus.data` | sem estado |
| `activityYears` | anos em que há eventos/votações/apresentações de filhos da entidade | derivado de átomos, deliberações e filhos | sem eventos coletados |
| `temporalBasis` (metadado de cada métrica) | `identifier_year` \| `presented_at` \| `activity` | declarado pela métrica | — |

Regra para evitar o mal-entendido futuro: o nome `year` deixa de existir nos DTOs e nas assinaturas (`identifierYear`), e toda métrica
anual devolve `temporalBasis` e um texto derivado dele (`identifier_year` → "com ano {n}"/"numeradas em {n}"; `presented_at` → "apresentadas em {n}";
`activity` → "com atividade em {n}"). Nenhum texto "apresentadas em" pode ser gerado com `temporalBasis = identifier_year`.

### Recomendação editorial por bloco de `/proposicoes`

| Bloco | Conceito recomendado | Formulação |
|---|---|---|
| Topo (hero) | `presented_at`, por grupo, com cobertura declarada; ou dois números lado a lado | "X documentos e proposições apresentados em 2026 (Y delas numeradas em 2026)" |
| Composição por função | `presented_at` (a função é o que importa, e os acessórios só têm essa data) | "Apresentados em 2026, por função" |
| Fato-tese | restrito a principais: `identifierYear` para "matérias numeradas em 2026"; sem a palavra "atividade" | "Em 2026, N matérias principais foram numeradas; M% do que foi apresentado" |
| Rio de tramitação / estagnação | principais por `identifierYear` (Câmara) e `presented_at` (Senado: chegada à Casa) | "Matérias principais numeradas em 2026" / "apresentadas ao Senado em 2026" |
| Ritmo "novas" | `presented_at` | "Apresentados por mês" |
| Ritmo "eventos" e calendário | atividade: **todos** os eventos do ano, de matérias de qualquer ano, separando matéria nova de antiga | "Eventos de tramitação em 2026 (de matérias novas e anteriores)" |
| Recentes | atividade dos últimos 7 dias, sem filtro de ano da matéria | "Apresentados e movimentados nos últimos 7 dias" |
| DNA / autoria | **não herdar B**: autoria só nos grupos em que autor é de fato proponente (principais, requerimentos, indicações, emendas de autoria parlamentar); relatoria separada | "Autorias de matérias {numeradas|apresentadas} em 2026" |
| Temas | `presented_at` para ambas as Casas (alinhar Câmara ao Senado), por grupo | "Temas das matérias apresentadas em 2026" |
| Caso MPV | independente de ano | "Rede de proposições ligadas à matéria" |
| `/explorar` | filtros separados: "Ano do número" e "Ano de apresentação"; padrão visível | duas entradas, nunca uma "Ano" ambígua |
| Contagem por parlamentar | declarar o recorte real ("no lote coletado") ou aplicar `presented_at` | evitar rótulo de ano sem filtro |

## 14. Decisões pendentes

1. Qual conceito abre o topo e a composição: B (apresentadas em 2026, com cobertura declarada) ou manter A rotulado? Impacto: Câmara 22.102 → 43.971.
2. Aceitar "ano da matéria raiz" (`matterYear`) para acessórios, ou deixar "sem ano" como categoria própria?
3. Autoria no recorte B: excluir relatoria/destaque/parecer por grupo, ou separar "autoria" de "relatoria"?
4. Medir a completude do cenário B na Câmara (matérias numeradas antes e apresentadas em 2026, p. ex. via arquivo anual de 2025) antes de publicar "apresentadas em 2026" como total.
5. Persistir `ultimoStatus.data` (hoje só no bruto) se `lastStatusAt` for adotado.
6. Rastrear a origem do `0` no PG e decidir migrar para `NULL`.
7. Alinhar tópicos Câmara × Senado e a contagem por parlamentar.
8. `activityYear`: depende de ampliar a cobertura de eventos (42% e 9%); até lá, rotular "eventos coletados".
9. Esclarecer com a fonte o caso de PL 6674/2025 (número 2025, registro de 2026) e o das EMC numeradas em 2026 apresentadas em 2025.

## Gate de investigação

**YEAR_SEMANTICS = CLEAR_TO_IMPLEMENT** para: renomear `year` → `identifierYear`, `NULL` para "sem ano", expor `presentedAt`/`presentedYear`, `temporalBasis`
por métrica e a rotulagem das seções 7 e 13. **Fora do escopo liberado:** `activityYear` e o total B da Câmara como "apresentadas em 2026" até as decisões 4 e 8.

## Tabela final

| Bloco / métrica | Regra atual | Semântica atual | Regra recomendada | Texto recomendado | Impacto quantitativo | Confiança |
|---|---|---|---|---|---|---|
| Hero / total por Casa | `year = Y` | numeradas em Y | `presented_at` por grupo (ou duplo) | "apresentados em Y" + "(N numeradas em Y)" | Câmara 22.102 → 43.971; Senado 2.238 → 2.557 | alta |
| Composição por função | `year = Y` | numeradas em Y; sem 22.254 da Câmara | `presented_at` | "apresentados em Y, por função" | pareceres 40 → 10.758; destaques 21 → 6.821; emendas 1.458 → 4.791 | alta |
| Fato-tese "atividade registrada" | principais ÷ numeradas | participação entre numeradas | só principais; sem "atividade" | "matérias principais numeradas em Y" | Câmara 28,0% → 14,0%; Senado 23,7% → 33,3% | alta |
| Rio de tramitação | principais `year = Y` | numeradas em Y | `identifierYear` (Câmara), `presented_at` (Senado) | "numeradas em Y" / "apresentadas ao Senado em Y" | Câmara 6.178 → 6.175; Senado 531 → 852 | alta |
| Ritmo novas | `year = Y ∧ presented` | numeradas e apresentadas em Y | `presented_at` | "apresentados por mês" | Câmara 21.717 → 43.971; Senado 2.234 → 2.557 | alta |
| Ritmo eventos / calendário | eventos de matérias `year = Y` | parcial | todos os eventos do ano | "eventos de tramitação em Y" | Câmara +4.987 (23%); Senado +7.958 (30%) | média (cobertura de átomos 42% / 9%) |
| Recentes | eventos/apresentações de matérias `year = Y` | parcial | sem filtro de ano da matéria | "apresentados e movimentados nos últimos 7 dias" | exclui os sem ano e as antigas | média |
| DNA / autoria | autorias de `year = Y` | autores de numeradas em Y | por grupo; separar relatoria | "autorias de matérias …" | Câmara: Altineu 12 → 2.487 se usar B puro | alta |
| Temas Câmara | `year = Y` | numeradas em Y | `presented_at` | "temas das matérias apresentadas em Y" | com tema 10.449 → 10.444; ranking quase igual | média |
| Temas Senado | `presented_at ∪ deliberadas` | quase atividade | manter; declarar | "apresentadas ou deliberadas em Y" | Senado 528 → 851 (A → B) | média |
| `/explorar` filtro | `year = N` | número | dois filtros | "Ano do número" e "Ano de apresentação" | igual aos blocos acima | alta |
| Contagem por parlamentar | sem filtro de ano | catálogo inteiro (Senado 1949–2026) | `presented_at` no ano, declarado | "no recorte coletado" ou "apresentadas em Y" | não medido por pessoa | média |
| Seletor de ano | anos de linhas já filtradas | só o ano pedido | anos do catálogo | lista de anos disponíveis | hoje 1 opção | alta |
| Matéria de suporte | fora | contexto | fora de A e B; só "atividade com matéria histórica" | "movimentações de matérias anteriores" | 12 apresentadas em 2026; 20.713 filhos de 5.775 matérias | alta |

## Validação de cobertura para presentedYear

> Atualiza o gate da etapa anterior: `CLEAR_TO_IMPLEMENT` continua valendo para o contrato e a rotulagem; o overview por `presentedAt` depende dos gates abaixo.

Medições de 2026-10-06, somente leitura: nenhuma tabela, query de produção, collector ou frontend foi alterado. O universo oficial de
2026 foi baixado **para a pasta temporária** (471 requisições GET, sem erros) e comparado com o catálogo ativo. Scripts:
`scripts/fetch-presented-universe.cjs` (baixa as listas), `scripts/audit-presented-coverage.ts` (compara), reaproveitando
`scripts/audit-year-semantics.ts`.

### 1. Fontes disponíveis (inventário local antes de qualquer download)

| Fonte | Anos / escopo | Registros | `presented_at` | Reconstrói o universo apresentado em 2026? |
|---|---|---|---|---|
| `data/research/camara-proposicoes-2026.json` (arquivo anual oficial da Câmara) | só **2026** (números de 2026 + tipos sem ano) | 44.356 | 100% | **não**: não contém matéria de número anterior apresentada em 2026 |
| `civica.raw_objects` (Câmara, `/arquivos/…`) | só o arquivo `proposicoes-2026.json` (duas cargas idênticas) + autores, temas, votações, eventos 2026 | — | — | não há arquivo anual de 2025 ou anterior |
| `civica_poc.proposals` (lote ativo) | Câmara `2026-L57`; Senado `current-roster-person-activity` | 44.356 / 40.267 | 100% | derivado dos acima; mesmo limite |
| Backup SQLite (`senadotracker-2026-10-01.sqlite`, 5,5 GB) | lotes `2026-L57` (6 republicações do mesmo conteúdo: 44.356), Senado roster (40.267) e amostra (453) | idem | idem | só os mesmos lotes |
| `artifacts/proposicoes-snapshot-reduzido.sqlite` | Câmara 44.356 (ano máx. 2026); Senado 35.757 (2001–2026) | idem | idem | recorte do mesmo lote |
| `civica_poc.proposal_support` | matérias de números anteriores citadas como pai | 6.178 | 100% | **só evidência de lacunas**: 12 apresentadas em 2026 (mínimo; só pais) |
| `proposal_detail_atoms` / `proposal_detail_cache` / enrichment | detalhes de subconjuntos | 18.824 e 3.549 proposições | eventos | não |
| API oficial da Câmara, `GET /proposicoes?dataApresentacaoInicio&dataApresentacaoFim` | **todos os anos de número**, filtrado por data de apresentação (janela máx. 3 meses) | 45.116 em 2026 | por construção | **sim**: enumerador oficial por data, sem depender do ano do número |
| API do Senado, `materia/pesquisa/lista?dataInicioApresentacao&dataFimApresentacao` | todas as matérias da Casa | 3.483 em 2026 | campo `Data` (= `DataApresentacao`) | **sim** (endpoint marcado como descontinuado em favor de `/processo`, ainda responde) |

Conclusão do inventário: **nenhuma fonte local reconstrói B**; os arquivos anuais de outros anos nunca foram coletados. Em vez de baixar um
arquivo por ano (anos "necessários" desconhecidos), usei o filtro por data da própria API, que devolve as entidades apresentadas no período
**qualquer que seja o ano do número**: o maior atraso real aparece sozinho (abaixo). Validação do método: das 43.971 entidades do catálogo
com `presented_at` em 2026, **todas as 43.971** estão na resposta da API (0 divergências de data ou fuso), e das 2.557 do Senado, todas as 2.557.

### 2. Completude da Câmara

| | Entidades |
|---|---|
| API oficial, apresentadas em 2026 (até 2026-10-05) | **45.116** |
| Catálogo ativo (`presented_at` em 2026) | 43.971 |
| Presentes nos dois | 43.971 |
| Na API e **ausentes do catálogo** | **1.145 (2,54%)** |
| No catálogo com data de 2026 e ausentes da API | 0 |
| Cobertura do catálogo sobre o universo B oficial | **97,46%** |

Mensal na API: jan 50, fev 5.243, mar 7.780, abr 7.430, mai 8.256, jun 5.810, jul 5.687, ago 3.015, set 1.803, out 42.

Os 1.145 ausentes têm duas causas distintas (separadas pelo maior `external_id` do catálogo, 2.646.135, que marca o instante do arquivo
coletado; o `presented_at` máximo do catálogo é 2026-09-04):

| Causa | Entidades | Detalhe |
|---|---|---|
| **Criadas depois do arquivo** (defasagem de coleta) | **1.009** | set 917, jul 43, out 42, ago 7; número 2026: 671, sem ano: 330, números anteriores: 8 |
| **Fora do arquivo de 2026 por desenho** (anteriores ao instante da coleta) | **136** (0,30% de B) | 113 de número anterior, 16 de número 2026, 7 sem ano (por sigla, PL 89, PROC 15, EMS 15, MSC 6, PPP 4…); 12 dos 1.145 já aparecem como matéria de suporte |

Por grupo funcional (todos os 1.145): principais 310, pareceres 262, requerimentos 251, ofícios 116, emendas 108, atos 47, indicações 38,
mensagens 12, instrumentos 1. Por sigla (maiores): PL 279, PRL 256, RIC 148, DOC 116, REQ 103, EMC 41, INC 37, SBT 32, RDF 20, EMS 16, PROC 15, PLP 14.
Por ano do número: 2026 → 687; sem ano → 337; 2025 → 47; 2024 → 25; 2023 → 22; 2022 → 6; 2021 → 5; 2020 → 9; 2019 → 7. Origem por arquivo anual: os 1.024 de número 2026 ou sem ano pertenceriam ao
arquivo de 2026 (1.001 por defasagem de coleta e 23 de borda); os **121 de número anterior** pertencem aos arquivos de 2019 a 2025 (113 estruturais e 8 por defasagem) e não estão em nenhuma fonte local.

Exemplos que hoje faltam (não têm página no Cívica; ficha oficial `…/proposicoesWeb/fichadetramitacao?idProposicao={id}`):

| id | Entidade | Número | Apresentada | Observação |
|---|---|---|---|---|
| 2605336 | PL 2645/2019 | 2019 | fev/2026 | lag 7 anos (o maior) |
| 2609004 | PL 3951/2019 | 2019 | mar/2026 | lag 7 |
| 2609007 | EMS 715/2019 | 2019 | mar/2026 | emenda do Senado a projeto de 2019 |
| 2640285 | PL 2374/2019 | 2019 | jul/2026 | lag 7 |
| 2601536 | PL 3371/2020 | 2020 | fev/2026 | lag 6 |
| 2601541 | PL 2026/2025 | 2025 | fev/2026 | lag 1 |
| 2599887 | MSC 1907/2025 | 2025 | jan/2026 | mensagem de restituição |
| 2599889 | PROC 4/2026 | 2026 | jan/2026 | processo interno ausente do arquivo |

### 3. Completude do Senado

| | Matérias |
|---|---|
| API oficial, apresentadas em 2026 | **3.483** (jan 107, fev 343, mar 608, abr 401, mai 519, jun 517, jul 409, ago 299, set 261, out 19) |
| Catálogo ativo com `presented_at` em 2026 | 2.557 |
| Na API e ausentes do catálogo | **926 (26,6%)** |
| Cobertura do catálogo | **73,41%** |
| No catálogo com data de 2026 e ausentes da API; datas divergentes entre as duas fontes | 0; 0 |

O catálogo do Senado não é "o Senado": é o conjunto de matérias de **autoria ou relatoria dos 81 senadores do cadastro** (`current-roster-person-activity`).
Os 926 ausentes são, por autor informado: **Câmara dos Deputados (matérias de origem na Câmara) 275**, **Presidência da República 146** (VET 56, MPV 43, MSF, PLN),
**comissões 267** (REQ 267 de comissão), senadores fora do cadastro, incluindo 35 de Eduardo Girão (nenhuma autoria dele em `proposal_authors` do Senado),
deputados e outros. Por sigla: PL 273, REQ 267, PDL 61, VET 56, PET 55, MPV 43, RQS 36, PRS 30, PLN 23, MSF 23, PCE 19, PLP 16.
Por grupo: principais 448, requerimentos 303, atos 91, recursos 55, mensagens 24, indicações 4, ofícios 1. Além da natureza do recorte, há defasagem
de coleta: set 161 e out 19 de ausentes (o catálogo termina em 2026-09-14).

Como `DataApresentacao` é a apresentação **no Senado**, matéria de origem na Câmara (autor "Câmara dos Deputados", 614 das 3.483) entra
corretamente em B: 542 dessas 614 (88%) têm número anterior a 2026.

### 4. Defasagem `identifierYear` × `presentedYear` (2026 − ano do número) no universo oficial

**Câmara (45.116):** 0 anos 22.404 (49,7%); +1: 47; +2: 25; +3: 22; +4: 6; +5 a +9: 21; +10 ou mais: 0; sem ano (`ano = 0`): 22.591 (50,1%).
Total com defasagem = 121 (0,27%). **Maior defasagem real: 7 anos** (número de 2019). Por grupo: principais 6.387 (0) / 39 (+1) / 24 (+2) / 15 (+3) / 3 (+4) / 17 (+5 a +9);
emendas 1.121 (0) / 1 / 1 / 7 / 3 / 4 e 3.762 sem ano; mensagens 375 (0) / 6 (+1); pareceres 41 (0) / 1 (+1) e 10.978 sem ano; atos 669 (0) e 1.051 sem ano;
instrumentos 22 (0) e 6.800 sem ano; requerimentos, ofícios, indicações, recursos: 100% em 0. Por sigla com defasagem: PL 96 (+1: 37, +2: 24, +3: 15, +4: 3, +5 a +9: 17), EMS 16, MSC 6,
PEC 1, PLP 1, REL 1.

**Senado (3.483):** 0 anos 2.940 (84,4%); +1: 348 (10,0%); +2: 82; +3: 54; +4: 12; +5 a +9: 47; +10 ou mais: 0; número posterior a 2026: 0. Maior defasagem real: **7 anos**.
Por sigla: PDL 364 (85% com defasagem; +1: 272), PL 726 (31%; +1: 72, +2: 50, +3: 51, +5 a +9: 45), PLP 56 (5%), VET 56 (2%); REQ, RQS, MPV, PET, MSF, PRS, SUG, INS: 0%.
A defasagem do Senado vem da origem na Câmara.

Limite de 10 anos nunca atingido: nenhuma entidade apresentada em 2026 tem número anterior a 2019. Isso importa para o desenho: um conjunto de arquivos anuais
2019–2026 cobriria o universo; a consulta por data de apresentação dispensa a escolha.

### 5. Universo B corrigido (simulação deduplicada por `external_id`; nada foi gravado)

| | Câmara | Senado | Total |
|---|---|---|---|
| Hoje, por `year = 2026` (identifierYear) | 22.102 | 2.238 | 24.340 |
| B no catálogo (`presented_at` em 2026) | 43.971 | 2.557 | 46.528 |
| **B oficial (universo completo)** | **45.116** | **3.483** | **48.599** |
| Adicional sobre o catálogo | +1.145 | +926 | +2.071 |

Distribuição do universo B oficial: por grupo (Câmara) principais 6.485, pareceres 11.020, requerimentos 9.535, instrumentos 6.822, emendas 4.899, ofícios 2.593, atos 1.720,
indicações 1.633, mensagens 381, recursos 28; (Senado) requerimentos 1.901, principais 1.300, atos 129, mensagens 58, recursos 57, indicações 32, ofícios 6. Por sigla (Câmara, maiores): PRL 7.128,
REQ 6.819, RPD 6.520, PL 5.143, PAR 2.971, RIC 2.716, DOC 2.567, INC 1.612, SBT 1.575, EMC 1.003; (Senado): REQ 1.203, PL 726, RQS 698, PDL 364, MPV 62.

### 6. Lacunas

1. **Defasagem de coleta** (Câmara 1.009; Senado 180): resolvida por recoleta; não é lacuna estrutural.
2. **Matérias de número anterior (Câmara 121, 0,27%):** só são alcançáveis pelo filtro por data de apresentação (ou pelos arquivos 2019–2025); hoje 12 estão como suporte.
3. **Borda do arquivo de 2026 (Câmara 23):** itens de número 2026 ou sem ano ausentes do arquivo (PROC etc.), de causa não explicada pela fonte.
4. **Senado por desenho de escopo (≈ 746 não explicados por defasagem):** matérias de origem na Câmara, da Presidência, de comissões e de senadores fora do cadastro.
5. **Cadastro do Senado:** autor de 35 matérias de 2026 ausente do catálogo (Eduardo Girão): verificar o cadastro de 81.
6. **Endpoint do Senado descontinuado:** `materia/pesquisa/lista` ainda responde, mas deve migrar para `/processo`.

### 7. Auditoria de autoria

`civica_poc.proposal_authors` **não tem coluna de papel**: só nome, partido, UF e id. O significado vem do tipo da entidade e do campo oficial `tipoAutor`/`proponente`
do arquivo `proposicoesAutores` da Câmara (55.549 vínculos casados com o catálogo; 44.354 das 44.356 proposições têm autoria). "Autor" significa coisas diferentes:

| Classe | Critério | Vínculos |
|---|---|---|
| **A1** proposição legislativa (PL, PLP, PEC, PDL, PRC, MPV, PLV, PFC) | deputado/senador proponente | 7.411 |
| **A2** requerimento, indicação, pedido (REQ, RIC, INC, SUG, REC, REP, PET, RCP, SIT) | deputado/senador proponente | 12.943 |
| **A3** emenda apresentada (EMC, EMP, ESB, EMA, ERD, SSP, EMS) | deputado/senador proponente | 2.752 |
| **B** coautoria/apoio (`proponente = 0`) | assinatura de apoio | 5.608 |
| **C** comissão ou órgão da Câmara como autor (PAR, PARF, SBT-A, EMC-A, SBE-A, projetos e requerimentos de comissão, Mesa) | `tipoAutor` comissão/órgão | 5.883 |
| **D** relatoria/parecer (PRL, PRLP, PRLE, PES, PPP, PEP, PPR, CVO, REL, RLP, RDF e SBT, SBR, EMR do relator) | deputado como relator | 10.396 |
| **E** institucional/documental (Executivo, Judiciário, Plenário Virtual CN, sociedade civil, partidos, lideranças, Poder Legislativo) | `tipoAutor` não parlamentar | 1.532 |
| **F** ato procedimental (RPD, DTQ, VTS, RPDR) | deputado que pede a votação/destaque | 7.179 |
| **F** ambíguo ("ofício" DOC com `tipoAutor` deputado, INA, PSS, RRL, OF, PRV…) | sem papel claro | 1.845 |

Por grupo (vínculos): pareceres 7.244 de relatoria (D) e 3.514 de comissão (C); instrumentos de votação 7.179 procedimentais (F) + 219 apoio (B);
emendas 2.716 (A3) + 2.201 (D: SBT, SBR, EMR do relator) + 1.080 (C) + 1.005 (B); principais 7.382 (A1) + 740 (C) + 630 (B) + 106 (E).

**Por que Altineu Côrtes vai de 12 para 2.487:** os 2.487 são 2.487 proposições distintas, todas apresentadas em 2026; **2.473 são PRL e todas as 2.473 têm a ementa
"Parecer exarado no RIC …"**: ele é o autor do parecer de **todos** os pareceres a requerimentos de informação da Câmara (100% dos 2.473 desse tipo no catálogo).
Os outros 14: 9 REQ, 3 PEC, 2 EMP. Distribuição dos 2.487: tipo PRL 2.473, REQ 9, PEC 3, EMP 2; grupo pareceres 2.473, requerimentos 9, principais 3, emendas 2;
papel: relatoria de parecer 2.473 (D); autoria de requerimentos, PEC e emendas 14; origem do vínculo: `tipoAutor = Deputado(a)` em todos, com `proponente = 1` em 2.475 e
`proponente = 0` em 12. Os 12 que o filtro por `year` enxerga são os 9 REQ e as 3 PEC (número 2026); os 2.475 restantes (2.473 PRL e 2 EMP) têm `ano = 0`.
O mesmo vale para o 5º colocado em B (Comissão de Comunicação, 1.413 pareceres de comissão) e para a CCJC (1.510), que são autoria de órgão (C), não proposição de parlamentar.
Em A2 e F o topo são outros nomes: requerimentos (Sargento Portugal 1.949, Raimundo Santos 1.310) e destaques/votações (Sóstenes Cavalcante 806, Delegado Paulo Bilynskyj 535).

### 8. Rankings semanticamente seguros (proposta)

Regra geral: **nunca um ranking único de "autores"**. Cada ranking tem um conjunto fechado de siglas e de `tipoAutor`/`proponente`, e todos contam `DISTINCT external_id`.

| Ranking | O que entra | O que fica de fora | Dimensão temporal |
|---|---|---|---|
| **Proposições de autoria** | A1: PL, PLP, PEC, PDL, PRC, MPV, PLV, PFC; autor parlamentar com `proponente = 1`; coautoria (B) em coluna separada | emendas, pareceres, destaques, órgãos | `presentedYear` (B) |
| **Requerimentos e indicações** | A2: REQ, RIC, INC, SUG, REC, REP, PET, RCP, SIT | idem | `presentedYear` |
| **Emendas apresentadas** | A3: EMC, EMP, ESB, EMA, ERD, SSP, EMS por parlamentar proponente; EMR/SBR/SBT **não** (são do relator) | emendas de comissão (C) | `presentedYear` |
| **Relatorias e pareceres** | D: PRL, PRLP, PRLE, PES, PPP, PEP, PPR, CVO, REL, RLP, RDF; SBT, SBR e EMR quando do relator | tudo o que não é relatoria | `presentedYear` |
| **Atos procedimentais** (opcional, valor editorial baixo) | F: RPD, DTQ, VTS, RPDR | — | `presentedYear` |
| **Autoria de órgãos** (comissões, Mesa, Executivo) | C e E, em página própria | nunca somar a parlamentares | `presentedYear` |

Efeito: Altineu Côrtes deixa de ser "campeão de proposições" (aparece 1º só em Relatorias, 2.473) e passa a ser Amom Mandel (579) em A1. O "DNA" atual de
`/proposicoes` deve aceitar um parâmetro de classe e nunca agregar A, D e F.

### 9. Simulação do novo `/proposicoes` (sem mudar produção)

"B catálogo" = o catálogo atual por `presented_at`; "B oficial" = após fechar as lacunas da seção 6.

**Topo** ("N proposições e documentos apresentados em 2026, M com número de 2026"):

| | Atual (`year`) | B catálogo | B oficial | Diferença (oficial − atual) |
|---|---|---|---|---|
| Congresso | 24.340 | 46.528 | 48.599 | +24.259 (+99,7%) |
| Câmara | 22.102 | 43.971 | 45.116 | +23.014 (+104,1%) |
| Senado | 2.238 | 2.557 | 3.483 | +1.245 (+55,6%) |
| "com número de 2026" (continua como filtro) | 24.340 | 24.340 | 24.340 | 0 (a dimensão não muda) |

**Composição por grupo (Câmara):**

| Grupo | Atual | B catálogo | B oficial | Dif. absoluta | Dif. % |
|---|---|---|---|---|---|
| Principais | 6.178 | 6.175 | 6.485 | +307 | +5,0% |
| Requerimentos | 9.286 | 9.284 | 9.535 | +249 | +2,7% |
| Pareceres e relatórios | 40 | 10.758 | 11.020 | +10.980 | +27.450% |
| Instrumentos de votação | 21 | 6.821 | 6.822 | +6.801 | +32.386% |
| Emendas e substitutivos | 1.458 | 4.791 | 4.899 | +3.441 | +236,0% |
| Atos especiais | 650 | 1.673 | 1.720 | +1.070 | +164,6% |
| Ofícios e documentos | 2.477 | 2.477 | 2.593 | +116 | +4,7% |
| Indicações | 1.595 | 1.595 | 1.633 | +38 | +2,4% |
| Mensagens | 369 | 369 | 381 | +12 | +3,3% |
| Recursos | 28 | 28 | 28 | 0 | 0% |

**Composição por grupo (Senado):** principais 531 → 852 → 1.300 (+769, +145%); requerimentos 1.600 → 1.598 → 1.901 (+19%); atos 38 → 38 → 129 (+239%);
mensagens 34 → 34 → 58 (+71%); recursos 2 → 2 → 57; indicações 28 → 28 → 32; ofícios 5 → 5 → 6.

**Ritmo por mês (Câmara, `presented_at`):** atual = `year = 2026` e apresentadas em 2026.

| Mês | Atual | B catálogo | B oficial | Dif. | Dif. % |
|---|---|---|---|---|---|
| jan | 19 | 48 | 50 | +31 | +163% |
| fev | 3.572 | 5.233 | 5.243 | +1.671 | +47% |
| mar | 3.814 | 7.748 | 7.780 | +3.966 | +104% |
| abr | 3.193 | 7.416 | 7.430 | +4.237 | +133% |
| mai | 3.426 | 8.224 | 8.256 | +4.830 | +141% |
| jun | 2.880 | 5.801 | 5.810 | +2.930 | +102% |
| jul | 3.153 | 5.627 | 5.687 | +2.534 | +80% |
| ago | 1.445 | 2.997 | 3.015 | +1.570 | +109% |
| set | 215 | 877 | 1.803 | +1.588 | +739% |
| out | 0 | 0 | 42 | +42 | n/d |
| **Total** | 21.717 | 43.971 | 45.116 | +23.399 | +107,7% |

Senado por mês: atual 74, 261, 387, 333, 343, 291, 224, 221, 100 (total 2.234); B catálogo 87, 279, 492, 338, 403, 362, 275, 221, 100 (2.557); B oficial 107, 343, 608, 401, 519, 517, 409, 299, 261 e 19 em out (3.483).

**Recentes (últimos 7 dias do catálogo):** Câmara, janela 2026-08-29 a 2026-09-04: atual 324 (só `year = 2026`) × B 1.086 (+235%); Senado (a partir de 2026-09-08): 27 × 27. No B oficial a janela
seria a dos últimos 7 dias até a data da coleta; **o catálogo atual está 31 dias defasado na Câmara** e "recentes" só é confiável depois da recoleta.

**Ano do número:** permanece como filtro independente ("Ano do número"): 22.102 (Câmara) e 2.238 (Senado), sem mudança.

### 10. Ano zero: `year = 0 → NULL`

Linhas que mudariam semanticamente de `0` para `NULL`: **22.254**, todas em `civica_poc.proposals` da Câmara no lote ativo (0 no Senado). `civica_poc.proposal_support` já tem `NULL`
(144, nenhum 0); `proposal_parent_context.parent_year`, `proposal_identity_bridge.matter_year` e `civica.deliberations.year`: 0 zeros. O arquivo bruto continua guardando `ano = 0`
(preservado; é a verdade da fonte). Contrato: `identifierYear: number | null`; `0` nunca é interpretado como ano; a camada normalizada grava `NULL`; vetores de busca que hoje
concatenam `type || number || '/' || year` (carregador em massa) devem tratar `NULL` explicitamente. Migração **não executada**.

### 11. Gates de cobertura

Critério para marcar **COMPLETE**: (1) existe um enumerador oficial por data de apresentação que cobre toda a Casa, **e** (2) o catálogo contém todos os identificadores
desse enumerador criados até o instante da coleta (diferença zero para ids anteriores ao corte; itens posteriores só como defasagem declarada com data), **e** (3) a reconciliação mensal
contra o enumerador é reexecutável e registrada. **PARTIAL**: o enumerador existe e a diferença é mensurável e maior que zero. **UNKNOWN**: não há enumerador.

| Gate | Valor | Evidência |
|---|---|---|
| `PRESENTED_YEAR_COVERAGE_CAMARA` | **PARTIAL** (97,46%; caminho curto para COMPLETE) | enumerador oficial existe e valida o catálogo (0 divergências); faltam 1.145 (1.009 defasagem de coleta, 136 estruturais, dos quais 121 de número anterior) |
| `PRESENTED_YEAR_COVERAGE_SENADO` | **PARTIAL** (73,41%; escopo por desenho) | enumerador existe; faltam 926 (origem na Câmara, Presidência, comissões, senadores fora do cadastro) |
| `AUTHORSHIP_SEMANTICS` | **MIXED_CLASSIFIABLE**: `proposal_authors` não é "autor" sem tipo/papel; classificação por tipo de entidade e `tipoAutor`/`proponente` é determinística (seção 7) | 9 classes; ranking único é inseguro |
| `YEAR_SEMANTICS_IMPLEMENTATION` | **BLOCKED** para o overview por `presentedAt`; **READY** para `identifierYear`, `NULL` em vez de 0, rótulos e `temporalBasis` | o total B só pode ser chamado "apresentadas em 2026" depois do fechamento das lacunas 1 e 2 (Câmara) e de decidir o escopo do Senado |

O que destrava o bloqueio: (a) recoleta da Câmara por janelas de data de apresentação (ou arquivos 2019–2025), com reconciliação por `external_id`, o que leva a Câmara a COMPLETE; (b) para o Senado,
declarar o corpus como "matérias de autoria/relatoria dos senadores do cadastro" ou ampliar a coleta ao universo da Casa; sem isso o número do Senado precisa vir com cobertura declarada ("N de 3.483 apresentadas ao Senado").

### 12. `ACTIVITY_YEAR_BLOCKED_BY_EVENT_COVERAGE`

Não implementado. Cobertura de eventos hoje: **Câmara** 18.824 de 44.356 proposições com algum átomo (42,4%), sendo movimentações em 3.272 (7,4%), pauta em 6.071 (13,7%) e
efeitos de votação em **24 proposições**; **Senado** 3.549 de 40.267 (8,8%), movimentações em 2.370, situações em 2.583. Deliberações nominais de 2026: Câmara 14.720, Senado 118.
Eventos de 2026 existentes: Câmara 21.350, Senado 26.367. Faltam: tramitações completas da Câmara para ~93% das proposições, votações nominais por matéria, eventos dos pareceres,
emendas e destaques como histórico próprio, movimentações do Senado para ~91% das matérias, e eventos de matérias fora do catálogo (1.145 na Câmara e 926 no Senado, mais as matérias de
suporte). O campo `ultimoStatus.data` existe no arquivo bruto da Câmara (43.977 em 2026) mas não está no banco e é apenas o último estado, não um histórico. Uma métrica anual de atividade
precisa de uma série de eventos completa por matéria; com 42% e 9% de cobertura, qualquer "atividade em 2026" mediria a cobertura da coleta, não a atividade.

## Resultado final desta etapa

```
PRESENTED_YEAR_COVERAGE_CAMARA   = PARTIAL   (97,46% do universo oficial; 1.145 ausentes: 1.009 defasagem de coleta, 136 estruturais)
PRESENTED_YEAR_COVERAGE_SENADO   = PARTIAL   (73,41%; corpus por cadastro de senadores; 926 ausentes)
AUTHORSHIP_SEMANTICS             = MIXED_CLASSIFIABLE (autoria, coautoria, comissão, relatoria, institucional e procedimental são classes distintas)
YEAR_SEMANTICS_IMPLEMENTATION    = BLOCKED   (overview por presentedAt); READY para identifierYear / NULL / rótulos / temporalBasis
```

## Implementação e fechamento de cobertura

Medições de 2026-10-06. O overview de `/proposicoes` **não** foi alterado editorialmente: continua por `identifierYear` (ver "Overview"). Mudaram os dados
(catálogo completo) e o contrato; os números de `/proposicoes` subiram só porque entraram entidades que faltavam.

### 1. Resumo e gates

```
PRESENTED_YEAR_COVERAGE_CAMARA = COMPLETE  (45.117 oficiais = 45.117 no catálogo, corte 2026-10-06T18:07:50Z)
PRESENTED_YEAR_COVERAGE_SENADO = COMPLETE  (3.486 oficiais = 3.486 no catálogo, corte 2026-10-06T18:12:12Z)
AUTHORSHIP_SEMANTICS           = CLASSIFIED (taxonomia única e testada; dados de origem persistidos; rankings da UI NÃO alterados)
TEMPORAL_CONTRACT              = IMPLEMENTED (identifierYear NULL, presentedAt, presentedYear, temporalBasis)
OVERVIEW_READY                 = READY_FOR_REVIEW (dados completos; troca editorial aguarda a sua revisão)
```

Critério de COMPLETE (definido na etapa anterior): enumerador oficial por data de apresentação cobrindo a Casa **e** catálogo ⊇ enumerador no instante de corte **e** reconciliação reexecutável.
As três condições valem nas duas Casas (seção 7).

### 2. Arquitetura

- **Uma entidade, uma linha.** A coleta por apresentação só **descobre** entidades; elas entram no lote ativo (`civica_poc.proposals`, PK `(batch_id, external_id)`), nunca numa tabela paralela.
  Matéria que estava como suporte (`proposal_support`) e passa a ser catalogada é **removida do suporte** na mesma execução (12 casos): não existem duas representações.
- **Enumeração** (`apps/collector/src/postgres-camara-presented.ts`, `postgres-senado-presented.ts`):
  - Câmara `GET /proposicoes?dataApresentacaoInicio&dataApresentacaoFim&itens=100&pagina=N` em janelas **mensais** (a API recusa mais de 3 meses); Senado `GET /processo?dataInicioApresentacao&dataFimApresentacao` (resposta única por janela, sem paginação).
  - Ids oficiais gravados por execução em `civica_poc.presented_enumeration` (só para reconciliar; as 3 últimas execuções por Casa são mantidas).
  - Checkpoint por janela e página (`presented_window_checkpoints`): execução interrompida retoma da página seguinte sem repetir.
- **Ingestão** das entidades ausentes: Câmara detalhe + autores + temas (3 requisições por entidade); Senado linha direto da lista + `/processo/{id}` para autoria e temas.
  `identifierYear` real preservado, anterior ao `presentedYear` aceito, `ano = 0` vira `NULL`. `presented_at` da Câmara (hora local sem fuso) é interpretado em Brasília; data do Senado como 00:00 BRT.
- **Idempotência/retry/dedup:** `ON CONFLICT (batch_id, external_id) DO NOTHING` (ou `DO UPDATE` com `--refresh`); 3 tentativas por requisição com backoff (`OfficialHttp`) mais 2ª passada para as que falharam; ids repetidos entre janelas deduplicados pela PK do enumerador.
- **Pais históricos:** novas entidades da Câmara com `principal_id` ausente alimentam a fila do resolvedor já existente (`resolveCamaraPrincipalsPostgres`, limite 10).
- **Incremental (para amanhã):** `collect-camara-presented` / `collect-senado-presented` sem argumentos enumeram de **(fim da última execução − 21 dias) até hoje**, ingerem só o que falta e reconciliam o intervalo. Também rodam no início de `collect-activity` de cada Casa (melhor esforço: falha não bloqueia a publicação).
  - **Sobreposição escolhida: 21 dias.** Uma entidade registrada ou corrigida com atraso de até 3 semanas é reencontrada por `external_id` sem duplicar. A lista oficial não traz a data de registro, então o atraso real não pôde ser medido; 21 dias é uma escolha conservadora. O que ficar mais antigo que a sobreposição é pego pela reconciliação completa abaixo. No backfill, 1.009 das 1.145 faltantes eram posteriores ao arquivo e 136 fora dele por desenho.
  - **Reconciliação periódica completa:** `reconcile-camara-presented --from 2026-01-01` (≈ 460 requisições, ~2 min; Senado 10) compara o ano inteiro contra o enumerador e acusa qualquer lacuna mais antiga que a sobreposição. Recomendado semanalmente ou antes de publicar números do ano.
  - `--refresh` rebusca e atualiza (ementa, situação, data, principal) entidades já catalogadas na janela; `--backfill-authors` (Senado) acrescenta autores ausentes.

### 3. Parte A: contrato temporal

**Causa do `0`.** O carregador ativo (`scripts/poc-load-propositions-postgres-v2.ts`) fazia `Number.isFinite(Number(x.year)) ? Number(x.year) : null`; como `Number(null) === 0`, o `null` do payload virava `0`
(o carregador "bulk" usava `x.year ? … : null` e estava certo). O mesmo erro valia para `number`. Corrigido com `normalizeIdentifierYear` / `normalizeProposalNumber` (`packages/domain/src/temporal.ts`), e o vetor de busca deixa de gerar o token "/0".
Teste de regressão prova que o padrão antigo devolvia 0 e o novo devolve `null`.

**Migração (`scripts/migrate-identifier-year-null.ts`, idempotente).** `year = 0 → NULL` em **22.254** linhas (zero depois; segunda execução: 0 alterações); `search_vector` das linhas alteradas reconstruído;
coluna gerada `presented_year` (ano de `presented_at` em America/Sao_Paulo) com índice `proposals_presented_year_idx (source, batch_id, presented_year, functional_group)`;
`COMMENT`s documentando `year` = `identifierYear`; **guarda `CHECK (year IS NULL OR year > 0)`** validada: nenhum carregador futuro pode gravar 0 (testado: o `INSERT` com 0 falha).
A coluna física continua `year` (renomear é migração de alto risco); os contratos usam `identifierYear` e mantêm `year` como alias temporário.

**Prova de que nenhum consumidor quebrou** (`scripts/snapshot-year-consumers.ts`, antes × depois da migração): bundle de `/proposicoes` (anos, universo do rio, ritmo, DNA), listagem (todos, `ano 2026`, `ano 2019`, tipo PRL, grupo pareceres, buscas "PRL 2", "SBT 1", "PL 32/2026", página 3),
facetas de ano e de tipo, composição por grupo (geral, 2026, Câmara) e detalhe de entidade com e sem ano: **totais, ids, ordem e facetas idênticos**. Diferenças: apenas o campo `year` das entidades sem ano (0 → null), os novos `identifierYear`/`presentedYear`/`temporalBasis` e, por consequência, o hash do bundle.
Consumidores revisados: `p.year=$N` e `p.year>0` (NULL não casa, igual ao 0 antes), ordenação `year DESC NULLS LAST`, tópicos (`p.year IS NULL AND p.presented_year=…`), `Number(x.year)` em DTOs (agora `null`).

**DTOs/contratos.** `proposal.identifierYear`, `proposal.presentedYear`, `proposal.presentedAt` no detalhe, na listagem, nos itens de emendas e na matéria de suporte (`year` mantido como alias `@deprecated`); consulta aceita `identifierYear` e `presentedYear` (além de `year`);
explorar passou a usar o parâmetro `ano_numero` (`ano` continua aceito) com rótulo "Ano do número".
**`temporalBasis`** (`'identifier_year' | 'presented_at' | 'activity'`) em todas as métricas anuais do bundle (overview, congresso, fluxo, estagnação, ritmo, calendário, DNA, recentes);
os textos de hero, rio de tramitação e ritmo passam por `temporalPhrase(basis, ano)`, que **nunca** produz "apresentadas" para `identifier_year` (teste). `activity` existe só como tipo: não há métrica implementada.

### 4. Parte B: Câmara

**Backfill** (`collect-camara-presented --from 2026-01-01`, corte 2026-10-06T14:32:15Z): enumeração de 10 janelas, 457 páginas; **1.145 entidades inseridas**, 12 matérias de suporte promovidas, 0 falhas, 0 retentativas; 3.892 requisições (457 listas + 3.435 de detalhe/autores/temas).
Validação dos grupos pedidos (todos presentes no catálogo com o `identifierYear` real e `presentedYear = 2026`):

| Grupo | Entidades | No catálogo | `presentedYear = 2026` | `identifierYear` conforme a fonte |
|---|---|---|---|---|
| Número anterior (2019–2025) | 121 | 121 | 121 | 121 (ex.: PL 2645/2019, id 2605336; PL 3371/2020, id 2601536; MSC 1907/2025) |
| Sem ano (`ano = 0`) | 337 | 337 | 337 | 337 (`identifierYear = NULL`) |
| Número 2026 | 687 | 687 | 687 | 687 |
| Os 23 casos de borda (id anterior ao arquivo, número 2026 ou sem ano) | 23 | 23 | 23 | 23 |
| Criadas depois do arquivo (id > 2.646.135) | 1.009 | 1.009 | 1.009 | 1.009 |
| Apresentadas depois de 04/09 (todas as inseridas) | 940 | 940 | 940 | — |
| Outubro | 42 | 42 | 42 | 42 |

Catálogo da Câmara depois: 45.502 linhas = 45.117 apresentadas em 2026 + 385 EMC apresentadas em 2025 e numeradas em 2026; 22.592 com `identifierYear = NULL`; 0 `external_id` repetido; autores 56.814 vínculos; 1.122 das 1.145 novas têm autoria (as demais não têm autor na fonte).

**Incremental provado:** execução seguinte (21 dias de sobreposição, 2026-09-15 a 06-10) fez 8 requisições, 0 novas, COMPLETE; depois de aparecer 1 entidade nova na fonte (id 2647305) a execução incremental fez 11 requisições, inseriu 1 e reconciliou 701 = 701.

### 5. Parte C: Senado

**`/processo` investigado antes de implementar.** O endpoint legado `materia/pesquisa/lista` está marcado como descontinuado em favor de `/processo` (parâmetros `dataInicioApresentacao`/`dataFimApresentacao` AAAA-MM-DD, limite de 1 ano, sem paginação).
Comparação (apresentadas em 2026; 13 requisições de ida e volta):

| | Legado | `/processo` |
|---|---|---|
| Matérias (coleta de 06/10) | 3.483 | **3.486** |
| Em comum | 3.483 | 3.483 |
| Só no legado / só no `/processo` | 0 | 3 (REQ 343/2026, PL 5526/2026, REQ 18/2026: apresentadas em 2026-10-06, depois da 1ª coleta) |
| Datas, siglas, números, anos divergentes | 0 | 0 |
| Autoria (texto) divergente | 0 | 0 |
| Contagem mensal (jan a set) | 107, 343, 608, 401, 519, 517, 409, 299, 261 | idêntica; out: 19 → 22 |
| Ano inteiro numa chamada = soma dos meses | — | sim (3.486) |
| Paginação | — | nenhuma (resposta única; janelas mensais por segurança) |

`/processo` reproduz o universo com segurança, então é a fonte adotada. Ele ainda acrescenta: id do processo, casa identificadora (SF 3.191, CN 295), `tramitando`, tipo de documento, e no detalhe a autoria **estruturada** (`autoriaIniciativa`: código, partido, tipo do autor) e a classificação temática hierárquica.
Nota: o `identificacao` do Senado traz o número do Senado (ex.: PL 199/2026 com origem PL 10674/2018 da Câmara), não o de origem.

**Coletor universal.** `collect-senado-presented`: catálogo de matérias da **Casa** por data de apresentação (origem Câmara, Presidência, comissões, senadores em exercício ou não), deduplicado por código da matéria, **sem depender do cadastro**.
Backfill (corte 2026-10-06T17:30:27Z): **929 matérias inseridas**, 939 requisições, 0 falhas. O lote ativo mantém o nome histórico de escopo (`current-roster-person-activity`, referenciado por consultas existentes), mas passou a conter também matérias de fora do cadastro; o cadastro continua servindo a perfis, autoria e relatoria.
Autoria: o complemento `--backfill-authors` acrescentou **681 vínculos** de autores ausentes (por código do parlamentar) em matérias de 2026 já existentes (3.496 requisições), sem apagar nem alterar linhas, porque os autores antigos usam outra chave (`código:id`) que o detalhe da UI cruza com o legado.

**Caso Eduardo Girão (classe do problema).** O cadastro é `/senador/lista/atual` (**81 senadores em exercício na data da coleta**). Girão (código 5976) é senador **titular**, mandato 2019-02-01 a 2027-01-31, mas não está em exercício (não consta da lista de 81); a API não detalhou o motivo.
Classe: **todo parlamentar com mandato na legislatura que não estava em exercício na data da coleta fica fora do fluxo** (titulares afastados e suplentes que já deixaram o exercício). No universo de 2026 há **10 senadores nessa situação** (Eduardo Girão 109 matérias, Hermes Klann 37, Ana Paula Lobato 30, Augusta Brito 26, Margareth Buzetti 21, Bruno Bonetti 18,
Mecias de Jesus 11, Fernando Farias 7, Rodrigo Pacheco 8, José Lacerda 1), com autoria em **240 das 3.486 matérias (6,9%)**, enquanto a Legislatura 57 tem 245 parlamentares com mandato. Rodrigo Pacheco e Ana Paula Lobato também aparecem com mais de um partido no período.
Resolução da classe: as matérias entram pelo enumerador da Casa, e o vínculo de autoria usa o código oficial do parlamentar (hoje Girão tem 111 matérias vinculadas). **Limitação aberta:** esses senadores continuam sem página de perfil (o cadastro de perfis segue "em exercício"); decidir se o cadastro deve passar a ser por mandato na legislatura (`/senador/lista/legislatura/57`).

### 6. Parte D: contrato de autoria

`packages/domain/src/authorship.ts`: **uma** função, `classifyAuthorship({ house, type, actor, proponent })`, e `actorKindFromCamaraTipoAutor` / `actorKindFromSenadoSiglaTipo`. Papéis:

| Papel (`authorRole`) | Classe | Regra |
|---|---|---|
| `legislative_authorship` | A1 | parlamentar proponente; PL, PLP, PEC, PDL, PRC, MPV, PLV, PFC (e equivalentes do Senado) |
| `request_authorship` | A2 | parlamentar proponente; REQ, RIC, INC, SUG, REC, REP, PET, RCP, SIT (Senado: REQ, RQS, RQN…) |
| `amendment_authorship` | A3 | parlamentar proponente; EMC, EMP, ESB, EMA, ERD, SSP, EMS |
| `coauthor_support` | B | parlamentar com `proponente = 0` (qualquer tipo) |
| `committee_author` | C | `tipoAutor` comissão (permanente, especial, mista, MPV, diretora, externa), grupo de trabalho ou órgão da Câmara (Senado: `COMISSAO_*`) |
| `rapporteurship` | D | parlamentar proponente; PRL, PRLP, PRLE, PES, PPP, PEP, PPR, CVO, REL, RLP, RDF e peças do relator SBT, SBR, EMR, PAR, PARF |
| `institutional_author` | E | Executivo, Judiciário, Poder Legislativo, Plenário Virtual CN, sociedade civil, partido, liderança (Senado: `PRESIDENTE_REPUBLICA`, `CAMARA`, `LIDER`, `CIDADAO`) |
| `procedural_act` | F | parlamentar; RPD, DTQ, VTS, RPDR |
| `ambiguous` | F | sem papel claro (ofício DOC de parlamentar, tipos raros, autor sem tipo) |

`AUTHORSHIP_RANKINGS` mapeia cada papel a **um único** ranking (`legislative`, `requests`, `amendments`, `rapporteurship`, `procedural`); `NON_RANKABLE_ROLES` lista o que nunca ranqueia parlamentares (apoio, comissões, institucional, ambíguo). Ranking de **senadores** deve filtrar `author_kind = 'SENADOR'` (a Casa também tem deputados como autores de matérias de origem na Câmara).
Casos obrigatórios (6 testes, todos passam): Altineu Côrtes PRL → relatoria, REQ → autoria de requerimento, PEC → autoria legislativa, EMP → emenda; comissões nunca viram parlamentares; coautor (`proponente = 0`) ≠ proponente.

**Origem dos dados.** `proposal_authors` ganhou `author_kind` (tipoAutor/siglaTipo) e `proponent`, preenchidas do arquivo oficial de autores (Câmara, chave proposta + autor + ordem, ou nome quando o autor não tem URI) e da API para entidades novas (`scripts/backfill-author-kinds.ts`). Vínculos da Câmara sem tipo: **24**; Senado: 53.431 vínculos de matérias anteriores a 2026 ainda sem tipo (só as de 2026 foram completadas).
Contagem no universo apresentado em 2026 (nenhuma soma entre classes): Câmara A1 7.618, A2 13.302, A3 2.263, B 5.627, C 5.895, D 10.724, E 1.772, F procedimental 7.179, F ambíguo 1.883; Senado A1 1.202, A2 3.002, C 537, E 610, F ambíguo 202.
**Altineu Côrtes**: 2.601 em D, todos pareceres "exarado no RIC" (eram 2.473; +128 do backfill), fora dos rankings de proposições.

### 7. Reconciliação final contra o enumerador oficial

Cada linha compara o **enumerador oficial do corte** (lista por data de apresentação, ano inteiro) com o catálogo (`presented_at` em 2026 até a data de corte), por `external_id`.

| | Câmara (corte 14:32Z, após o backfill) | Câmara (corte 18:07Z) | Senado (corte 18:12Z) |
|---|---|---|---|
| Universo oficial | 45.116 | **45.117** | **3.486** |
| Catálogo | 45.116 | **45.117** | **3.486** |
| Interseção | 45.116 | 45.117 | 3.486 |
| Só oficial | 0 | 0 | 0 |
| Só catálogo | 0 | 0 | 0 |
| Data divergente | 0 | 0 | 0 |
| `external_id` duplicado (catálogo / enumerador) | 0 / 0 | 0 / 0 | 0 / 0 |
| Cobertura | COMPLETE | COMPLETE | COMPLETE |

**Itens posteriores ao corte (separados):** entre o corte das 14:32Z e uma reconciliação feita às 18:01Z apareceu **1** entidade nova da Câmara (id 2647305, posterior ao maior id do corte anterior, 2.647.304). Naquele instante o resultado foi `PARTIAL` (1 só oficial); a execução incremental a trouxe e o corte seguinte fechou em `COMPLETE`.
Isso é o comportamento esperado de uma fonte viva: o gate vale **por corte**, e cada corte fica registrado em `civica_poc.presented_coverage_runs` (11 execuções).

### 8. Números do universo apresentado em 2026 (catálogo completo)

| | Câmara | Senado | Congresso |
|---|---|---|---|
| **`presentedYear` = 2026** | **45.117** | **3.486** | **48.603** |
| `identifierYear` = 2026 | 22.789 | 2.947 | 25.736 |
| Os dois | 22.404 | 2.943 | 25.347 |
| `identifierYear` nulo e apresentadas em 2026 | 22.592 | 0 | 22.592 |
| `identifierYear` anterior ao `presentedYear` | 121 | 543 | 664 |

Por grupo funcional (`presentedYear` | `identifierYear`): **Câmara** pareceres 11.021 | 41; requerimentos 9.535 | 9.537; instrumentos de votação 6.822 | 22; principais 6.485 | 6.390; emendas 4.899 | 1.499; ofícios 2.593 | 2.593; atos 1.720 | 671; indicações 1.633 | 1.633; mensagens 381 | 375; recursos 28 | 28.
**Senado** requerimentos 1.903 | 1.905; principais 1.301 | 761; atos 129 | 128; mensagens 58 | 58; recursos 57 | 57; indicações 32 | 32; ofícios 6 | 6.
Por sigla (`presentedYear`): Câmara PRL 7.129, REQ 6.819, RPD 6.520, PL 5.143, PAR 2.971, RIC 2.716, DOC 2.567, INC 1.612, SBT 1.575, EMC 1.003, PDL 973, RDF 735; Senado REQ 1.205, PL 727, RQS 698, PDL 364.
Por mês (Câmara, `presentedYear`): jan 50, fev 5.243, mar 7.780, abr 7.430, mai 8.256, jun 5.810, jul 5.687, ago 3.015, set 1.803, out 43; (Senado): 107, 343, 608, 401, 519, 517, 409, 299, 261, 22.
Defasagem `presentedYear − identifierYear`: Câmara 0: 22.404; +1: 47; +2: 25; +3: 22; +4: 6; +5 a +9: 21; sem ano: 22.592; Senado 0: 2.943; +1: 348; +2: 82; +3: 54; +4: 12; +5 a +9: 47; **maior defasagem real: 7 anos** (em principais e emendas).
Os totais por `presentedYear` mudaram de 45.116 e 3.483 (simulação anterior) para 45.117 e 3.486 por entidades novas posteriores àquela coleta.

**Overview atual (`identifierYear`, sem alteração editorial) antes → depois da completude:** Câmara 22.102 → 22.789; Senado 2.238 → 2.947; Congresso 24.340 → 25.736 ("25.736 proposições com ano 2026" no topo). Principais Câmara 6.178 → 6.390; Senado 531 → 761.
Esses aumentos são entidades que já eram "de 2026" e faltavam (por defasagem de coleta e, no Senado, por fora do cadastro), não mudança de regra.

**Autoria por classe, top 20 (universo apresentado em 2026; parlamentares da Casa; nomes normalizados):**

- **A1 Câmara:** 1 Amom Mandel (REPUBLIC) 579; 2 Duda Ramos (MDB) 483; 3 Laura Carneiro (PSD) 128; 4 Rubens Pereira Júnior (PT) 123; 5 Jonas Donizette (PSB) 123; 6 José Medeiros (PL) 121; 7 Marcos Tavares (PDT) 94; 8 Ribeiro Neto (SOLIDARI) 94; 9 Heloísa Helena (REDE) 78; 10 Luizianne Lins (REDE) 72; 11 Capitão Augusto (PL) 68; 12 Renata Abreu (PODE) 65; 13 Duarte Jr. (PSB) 65; 14 Kim Kataguiri (UNIÃO) 61; 15 Vanderlan Alves (SOLIDARI) 60; 16 Capitão Alden (PL) 58; 17 Cabo Gilberto Silva (PL) 57; 18 Eduardo da Fonte (PP) 52; 19 Evair Vieira de Melo (PP) 49; 20 Duda Salabert (PDT) 48.
- **A2 Câmara:** Sargento Portugal (PODE) 1.967; Raimundo Santos (PSD) 1.310; Capitão Alberto Neto (PL) 486; Evair Vieira de Melo (PP) 331; Gustavo Gayer (PL) 308; Adriana Ventura (NOVO) 264; José Medeiros (PL) 197; Messias Donato (REPUBLIC) 161; Amom Mandel (CIDADANIA) 160; Laura Carneiro (PSD) 157; Capitão Alden (PL) 137; Rogéria Santos (REPUBLIC) 114; Julia Zanatta (PL) 110; Luciano Vieira (PSDB) 110; Cabo Gilberto Silva (PL) 106; Célia Xakriabá (PSOL) 96; Luiz Lima (NOVO) 94; Erika Kokay (PT) 91; Dr. Frederico (PRD) 87; Roberto Monteiro Pai (PL) 75.
- **A3 Câmara:** Capitão Alden (PL) 55; João Daniel (PT) 44; Erika Kokay (PT) 38; Laura Carneiro (PSD) 38; Eli Borges (REPUBLIC) 37; Roberta Acioly (REPUBLIC) 34; Tarcísio Motta (PSOL) 33; Luis Carlos Heinze (PP) 30; Rogéria Santos (REPUBLIC) 30; Marussa Boldrin (REPUBLIC) 27; Zequinha Marinho (PODE) 26; Tião Medeiros (PP) 26; Pedro Uczai (PT) 25; Mário Heringer (PDT) 23; Rodrigo Valadares (PL) 23; Evair Vieira de Melo (REPUBLIC) 23; Vinicius Carvalho (PL) 23; Igor Timo (UNIÃO) 22; André Figueiredo (PDT) 22; Arnaldo Jardim (CIDADANIA) 21.
- **D Câmara (relatoria/parecer):** **Altineu Côrtes (PL) 2.601**; Laura Carneiro (PSD) 364; Maria Rosas (REPUBLIC) 256; Rogéria Santos (REPUBLIC) 232; Julio Cesar Ribeiro (REPUBLIC) 199; Silvia Cristina (PP) 162; Ricardo Ayres (REPUBLIC) 133; Capitão Alden (PL) 128; Duda Ramos (PODE) 124; Ana Paula Lima (PT) 102; Cleber Verde (MDB) 84; Daniel Almeida (PCdoB) 79; Socorro Neri (PP) 78; Flávia Morais (MDB) 78; Geraldo Resende (PSDB) 77; Franciane Bayer (REPUBLIC) 76; Lídice da Mata (PSB) 76; Nilto Tatto (PT) 73; Bia Kicis (PL) 72; Diego Garcia (REPUBLIC) 69.
- **F procedimental Câmara (destaques e votações):** Sóstenes Cavalcante (PL) 806; Delegado Paulo Bilynskyj (PL) 535; Chris Tonietto (PL) 480; Gilson Marques (NOVO) 435; Pedro Uczai (PT) 278; Julia Zanatta (PL) 236; Bia Kicis (PL) 214; Arlindo Chinaglia (PT) 210; Cabo Gilberto Silva (PL) 185; Alencar Santana (PT) 167; Messias Donato (UNIÃO) 154; Tarcísio Motta (PSOL) 141; Marcel van Hattem (NOVO) 136; Sâmia Bomfim (PSOL) 112; Laura Carneiro (PSD) 110; Rodrigo da Zaeli (PL) 104; Zé Trovão (PL) 99; Capitão Alden (PL) 95; Adriana Ventura (NOVO) 89; Rubens Pereira Júnior (PT) 88.
- **A1 Senado (senadores):** Dra. Eudócia (PSDB) 53; Jader Barbalho (MDB) 34; Eduardo Girão (NOVO) 26; Izalci Lucas (PL) 25; Ciro Nogueira (PP) 23; Dr. Hiran (PP) 23; Damares Alves (REPUBLICANOS) 22; Astronauta Marcos Pontes (PL) 22; Alessandro Vieira (MDB) 22; Eduardo Braga (MDB) 19; Flávio Arns (PSB) 19; Wellington Fagundes (PL) 19; Jorge Kajuru (PSB) 19; Cleitinho (REPUBLICANOS) 18; Plínio Valério (PSDB) 17; Jaime Bagattoli (PL) 17; Laércio Oliveira (PP) 17; Hamilton Mourão (REPUBLICANOS) 16; Jorge Seif (PL) 16; Magno Malta (PL) 16.
- **A2 Senado (senadores):** Damares Alves (REPUBLICANOS) 375; Humberto Costa (PT) 95; Professora Dorinha Seabra (UNIÃO) 89; Flávio Arns (PSB) 81; Esperidião Amin (PP) 81; Eduardo Girão (NOVO) 79; Astronauta Marcos Pontes (PL) 74; Hamilton Mourão (REPUBLICANOS) 73; Nelsinho Trad (PSD) 73; Izalci Lucas (PL) 70; Jaime Bagattoli (PL) 65; Teresa Leitão (PT) 60; Magno Malta (PL) 58; Paulo Paim (PT) 55; Dr. Hiran (PP) 54; Jorge Seif (PL) 52; Mara Gabrilli (PSD) 51; Confúcio Moura (MDB) 43; Leila Barros (PDT) 42; Marcos Rogério (PL) 42.

(Os 20 de D no Senado e de A3/D no Senado não existem: a coleta do Senado não traz relatoria como autoria nem emendas no catálogo.)

### 9. Performance, requisições, retentativas

| Operação | Requisições | Falhas / retentativas |
|---|---|---|
| Backfill Câmara (enumeração + 1.145 × 3) | 3.892 | 0 / 0 |
| Resolução de pais das novas entidades da Câmara | incluída na fila (6.178 resolvidos, 0 pendentes) | 0 |
| Backfill Senado (10 janelas + 929 detalhes) | 939 | 0 / 0 |
| Autores do Senado (`--backfill-authors`, 2 passadas) | 3.496 + 3.496 | 0 / 0 |
| Tipos de autor da Câmara (API, 1.430 entidades) | 1.430 | 0 |
| Investigação `/processo` | 13 | 0 / 0 |
| Reconciliações completas (Câmara 2 × 457; Senado 2 × 10) | 934 + 20 | 0 |
| Incrementais (Câmara 8 e 11; Senado 2) | 21 | 0 |

Consulta por `presentedYear` (grupo × ano, 45.117 linhas): índice só-índice `proposals_presented_year_idx`, **8,7 ms** (a mesma por `year`: 25 ms, bitmap). Coluna gerada: custo único de reescrita da tabela na criação.

### 10. Arquivos e migrações

Novos: `packages/domain/src/temporal.ts`, `authorship.ts`; `packages/db/src/postgres-temporal.ts`; `apps/collector/src/postgres-camara-presented.ts`, `postgres-senado-presented.ts`;
`scripts/migrate-identifier-year-null.ts`, `snapshot-year-consumers.ts`, `report-presented-universe.ts`, `backfill-author-kinds.ts`, `fetch-presented-universe.cjs`, `audit-presented-coverage.ts`;
testes `tests/unit/temporal.test.ts`, `camara-presented.test.ts`, `senado-presented.test.ts`, `authorship.test.ts`.
Alterados: `scripts/poc-load-propositions-postgres-v2.ts` (causa do 0), `packages/db/src/{index,postgres-propositions,postgres-proposition-graph,proposition-operations}.ts`, `packages/domain/src/index.ts`, `apps/collector/src/{index,postgres-collector}.ts`,
`apps/web/lib/{data-postgres,data-postgres-wave4}.ts`, `apps/web/lib/proposicoes/taxonomy.ts`, componentes de `/proposicoes` (hero, rio, ritmo) e `explorar/page.tsx`, `package.json` (lista de testes).
Migrações aplicadas ao banco (idempotentes, via `ensure*Schema`): coluna `presented_year` + índice; guarda CHECK; comentários; `proposal_authors.author_kind` e `proponent`; tabelas `presented_coverage_runs`, `presented_enumeration`, `presented_window_checkpoints`; `year = 0 → NULL`.
Testes: 230 (220 passam; as mesmas 9 falhas preexistentes e não relacionadas); 17 novos, todos passam; os de banco rodam em transação revertida, sem rede, e não deixam dados.

### 11. Caveats

- A defasagem de coleta **volta** a existir a cada dia sem coleta: o gate vale por corte; a rotina incremental e a reconciliação semanal são o que mantém COMPLETE.
- Entidades com `identifierYear` NULL (22.592 na Câmara) continuam fora de recortes por ano do número; o overview editorial ainda não foi trocado.
- Senado: 10 senadores sem exercício na data da coleta não têm perfil; o catálogo de matérias não depende mais do cadastro, mas rankings por pessoa usam perfis.
- `author_kind` do Senado só foi completado para 2026; 53.431 vínculos anteriores seguem sem tipo. Câmara: 24 vínculos sem tipo.
- O Senado continua sem situação (`status`) nas linhas (a fonte traz `situacaoAtual`; mantido nulo para coerência com o histórico).
- Matéria de suporte da Câmara resolvida por `/proposicoes/{id}` não traz `uriPropPrincipal` em tipos antigos (280 emendas sem raiz oficial; ver relatório do grafo).
- `activity` continua bloqueada pela cobertura de eventos (Câmara 42%, Senado 9%).
- `/processo` do Senado não é paginado e documenta limite de 1 ano por chamada; a coleta usa janelas mensais.

### 12. Gate final

```
PRESENTED_YEAR_COVERAGE_CAMARA = COMPLETE
PRESENTED_YEAR_COVERAGE_SENADO = COMPLETE
AUTHORSHIP_SEMANTICS           = CLASSIFIED   (taxonomia única + origem persistida; rankings da UI intocados)
TEMPORAL_CONTRACT              = IMPLEMENTED
OVERVIEW_READY                 = READY_FOR_REVIEW   (nenhuma troca editorial feita; aguarda a revisão destes números)
```

## Aplicação dos números corrigidos no /proposicoes

Medições de 2026-10-06. Mudança minimalista: **mesmos blocos, mesma ordem, mesmos componentes e mesmos gráficos**. O `git diff` dos componentes de `/legislativo/proposicoes` contra o commit anterior
é só texto (13 linhas acrescentadas, 9 removidas em 6 arquivos, todas em strings e em um `import` de `temporalPhrase`). Nenhum card, seção, aba ou filtro foi criado; `page.tsx` não foi tocado.

### 1. Como a página lê os dados agora

`buildOperationalRich` (`apps/web/lib/data-postgres.ts`) carregava **uma** base, `WHERE p.year = $1`. Agora carrega `WHERE (p.year = $1 OR p.presented_year = $1)` e separa em memória dois universos, com a base temporal declarada em cada bloco (`temporalBasis`):

| Universo | Definição | Quem usa |
|---|---|---|
| **apresentadas** (`byPresented`) | `presented_year = 2026`, inclui `identifierYear` NULL | hero, breakdown por Casa, composição, ritmo "novas", recentes (apresentações), DNA, fato de apoio, contagem de `years` |
| **ano do número** (`bySource`, `universe`) | `year = 2026` (como antes) | rio de tramitação, estagnação, ritmo de eventos, calendário, eventos de "recentes" |

`proposal_support` não é lido por nenhuma dessas consultas; `external_id` é único no catálogo (verificado por SQL independente em cada execução do teste).

### 2. Queries alteradas

| Bloco | Antes | Depois |
|---|---|---|
| Universo carregado | `p.year = $1` | `(p.year = $1 OR p.presented_year = $1)`, com `presented_year` no `SELECT` |
| Hero, breakdown, composição | linhas com `year === 2026` | `byPresented` (apresentadas em 2026) |
| Ritmo "novas" | `year === 2026` **e** apresentada em 2026 | apresentadas em 2026 (por mês de `presented_at`) |
| Recentes (apresentações) | `bySource` (só `year = 2026`) | `byPresented`; faixas sem sentido de apresentação (qualquer tipo fora principais, SBT\*, mensagens) deixam de cair em "nova matéria principal" |
| DNA (partido e parlamentar) | autorias de `p.year = $1`, todos os papéis | autorias de `p.presented_year = $1` com `classifyAuthorship ∈ {legislative, request, amendment}` (parlamentar proponente; Senado: `author_kind = 'SENADOR'`); `a.author_kind`/`a.proponent` no `SELECT` |
| Fato de apoio | "% da atividade registrada" sobre o universo por ano do número | "% do que foi apresentado" sobre o universo apresentado |
| `years` (contagens do seletor) | contagens por ano do número | contagens apresentadas |
| Atualização | `updatedThrough` = último dia de evento; `overview.updatedThrough = null` | `updatedThrough` = máx(última apresentação, último evento) = 2026-10-06, também em `overview.updatedThrough` |

### 3. Componentes mantidos e textos mínimos alterados

Todos os componentes foram mantidos (`Hero`, `CompositionSection`, `StageSection`/`StageRiver`, `DnaSection`, `RhythmSection`, `RecentSection`, `CaseSection`, `ExploreCta`). Textos alterados (só onde ficariam errados):

| Local | Antes | Depois |
|---|---|---|
| Hero, eyebrow | "Atividade legislativa · {Casa} · 2026" | "Proposições e documentos · {Casa} · 2026" |
| Hero, total por Casa | "N proposições com ano 2026" | "N proposições apresentadas em 2026" (via `temporalPhrase`) |
| Hero, fato | "…% da atividade registrada na Câmara foi de proposições legislativas principais" | "…% do que foi apresentado na Câmara foi de proposições legislativas principais" |
| Composição, subtítulo | "Todas as proposições publicadas com ano 2026" / "Câmara e Senado somados, ano 2026" | "Proposições apresentadas em 2026, por função" / "Câmara e Senado somados · proposições apresentadas em 2026" |
| Composição, nota de exclusão de itens sem ano | presente | removida (deixou de ser verdadeira) |
| Rio de tramitação (título, frase, rótulo acessível) | "…apresentadas em 2026" / "…apresentadas" com consulta por ano do número | "matérias principais com ano 2026" (`temporalPhrase('identifier_year')`) |
| Ritmo, "novas" | "Proposições com ano 2026, por mês de apresentação" | "Proposições apresentadas em 2026, por mês de apresentação" |
| Ritmo, "eventos" | "Registros de tramitação por mês de ocorrência, 2026" | "Registros de tramitação **coletados**, por mês de ocorrência, 2026" |
| DNA, introdução | "…distribui a atividade entre as funções" | "…distribui a autoria entre as funções" |
| DNA, nota de cobertura | "Distribuição derivada das autorias publicadas." | "Autoria de proposições, requerimentos e emendas por parlamentar proponente, nas proposições apresentadas no ano. Relatoria, pareceres, comissões, apoio e atos procedimentais não entram." |

### 4. Números antes → depois (Câmara, Senado, Congresso)

"Antes" = a mesma página com o catálogo já completo, mas por ano do número; "depois" = por apresentação.

| Bloco | Antes (ano do número) | Depois (apresentadas) |
|---|---|---|
| Hero, Congresso | 25.736 | **48.603** |
| Câmara | 22.789 | **45.117** |
| Senado | 2.947 | **3.486** |
| Fato de apoio, principais na Câmara | 28,0% | **14,4%** |
| Fato de apoio, principais no Senado | 25,8% | **37,3%** |

Composição por função, Câmara (antes → depois): pareceres 41 → **11.021**; requerimentos 9.537 → **9.535**; instrumentos de votação 22 → **6.822**; principais 6.390 → **6.485**; emendas 1.499 → **4.899**; ofícios 2.593 → **2.593**; atos 671 → **1.720**; indicações 1.633 → **1.633**; mensagens 375 → **381**; recursos 28 → **28**.
Senado: requerimentos 1.905 → **1.903**; principais 761 → **1.301**; atos 128 → **129**; mensagens 58 → **58**; recursos 57 → **57**; indicações 32 → **32**; ofícios 6 → **6**.

Ritmo mensal "novas" (jan a out), Câmara antes: 20, 3.573, 3.818, 3.196, 3.428, 2.883, 3.195, 1.445, 808, 38 (22.404); **depois: 50, 5.243, 7.780, 7.430, 8.256, 5.810, 5.687, 3.015, 1.803, 43 (45.117)**.
Senado antes: 93, 318, 460, 376, 429, 400, 293, 294, 258, 22 (2.943); **depois: 107, 343, 608, 401, 519, 517, 409, 299, 261, 22 (3.486)**. Os dois ritmos reconciliam exatamente com os totais das Casas.

DNA: 689 parlamentares no DNA; nenhuma linha tem contagem em "pareceres" nem em "instrumentos de votação" (testado). Altineu Côrtes: 12 vínculos distintos antes (todos de apoio, `proponente = 0`, em REQ e PEC) → **2** (EMP como proponente); o maior da Câmara no DNA tem 1.995. Recentes (depois): Câmara nova matéria principal 78, alteração de texto 6, nova norma 7; Senado 48, mudança de etapa 37, nova norma 11 (o "antes" não foi medido).
Eventos e calendário **não mudaram**: 16.363 (Câmara) e 18.409 (Senado) eventos; 167 e 179 dias no calendário; rio de tramitação 6.390 (Câmara) e 761 (Senado).

### 5. Validação

`scripts/verify-overview-numbers.ts` compara o resultado das funções da própria página com o SQL do catálogo (relacionais, valem todos os dias) e, com `OVERVIEW_FROZEN_CUT=1`, com os valores do corte validado. Passou nos dois modos:
Congresso 48.603, Câmara 45.117, Senado 3.486 (Câmara + Senado = Congresso); composição da Câmara e do Senado exatamente como acima (cada uma soma o total da Casa); ritmo mensal reconcilia com os totais; `proposal_support` com 0 ids no catálogo e 0 `external_id` duplicado;
suporte (6.166 linhas) fora de todas as consultas. Verificação de renderização: `/legislativo/proposicoes` responde 200 em 0,7 s, com as mesmas 7 seções na mesma ordem (composição, tramitação, DNA, ritmo, recente, caso, explorar), o mesmo `h1` em forma de fato e, no topo, "48.603 proposições apresentadas em 2026" e "Atualizado em 06/10/2026".

### 6. Performance (`EXPLAIN ANALYZE`)

| Consulta | Antes | Depois |
|---|---|---|
| Universo da página (`year` → `year OR presented_year`) | 25.736 linhas, 0,25 a 0,34 s | 48.992 linhas, 0,55 a 0,63 s |
| Autoria do DNA (`p.year` → `p.presented_year`) | 37.387 vínculos, 0,29 a 0,38 s | 61.816 vínculos, 0,49 a 0,67 s |
| Agregação por `presented_year` (grupo × ano, SQL) | — | **8,4 ms**, só pelo índice `proposals_presented_year_idx` |

As duas consultas da página fazem varredura sequencial nos dois casos: o recorte passou a ser cerca de metade da tabela e o planejador prefere varrer. O custo dobrou porque o número de linhas dobrou (mais 23 mil entidades e 24 mil vínculos reais); a função do bundle é cacheada por 120 s. O índice de `presented_year` é usado nas agregações em SQL (explorar, auditorias).

### 7. Testes

`tests/unit/overview-year-semantics.test.ts` (4 testes, entram em `npm test`): (1) presentedYear inclui `identifierYear` NULL, suporte fora, sem duplicata, Câmara + Senado = Congresso, composição soma cada Casa, ritmo = totais, pareceres sem ano entram por `presentedYear`, o DNA não contém relatoria/instrumentos e Altineu não lidera, a agregação usa o índice (roda o script contra o PostgreSQL local);
(2) PRL é relatoria e não autoria legislativa, PEC é autoria legislativa; (3) `temporalPhrase('presented_at')` usa "apresentadas" e `identifier_year`/`activity` nunca; (4) os componentes derivam o texto anual de `temporalPhrase`, nenhum fixa "apresentadas em" e o hero não chama de "atividade" o que mede apresentações; eventos são descritos como "coletados".
Suíte completa: 234 testes, 224 passam, as mesmas 9 falhas preexistentes; typecheck sem erros fora dos dois arquivos de teste `core-*` que não são deste trabalho.

### 8. O que permaneceu em `identifier_year`/activity, e por quê

- **Rio de tramitação e estagnação:** `identifier_year` (matérias principais com número de 2026: 6.390 e 761). Semântica já validada; o rótulo "apresentadas" que ainda aparecia foi corrigido.
- **Ritmo de eventos e calendário:** continuam com os eventos coletados de matérias com ano do número 2026; `activityYear` está bloqueado pela cobertura de eventos (42% Câmara, 9% Senado). O texto agora diz "coletados".
- **Recentes:** a parte de apresentações passou a `presented_at`; a parte de eventos mantém a lógica existente.
- **Temas:** não existe bloco de temas em `/proposicoes` (existe nas páginas das Casas, fora do escopo). **Filtros:** `/proposicoes` só tem a busca; o filtro "Ano do número" do `/explorar` já usa `identifierYear`. **CaseSection, perfis do Senado:** não tocados.
- **Seletor de ano:** continua listando só o ano pedido (limitação anterior); só as contagens ficaram por apresentação.

### 9. Desvios e interpretações (para revisão)

1. **DNA:** a seção não é um ranking (ordem alfabética, composição por função). Troquei a fonte pela taxonomia mantendo as faixas por função: entram autoria legislativa, de requerimento/indicação e de emenda por parlamentar proponente; relatoria, parecer, comissão, apoio, institucional e atos procedimentais ficam de fora. Restringir a **só** autoria legislativa (A1) tiraria
   as faixas de requerimentos e emendas e esvaziaria o retrato por função. O líder de A1 na Câmara (Amom Mandel, 579) não aparece na UI porque não há ranking A1 nela.
2. **Recentes:** o `idx` de "nova matéria principal" caía em `0` para qualquer tipo não mapeado (requerimentos, pareceres…). Com o universo apresentado isso inundaria a faixa; passou a `-1` (ignora). É a única mudança de comportamento além de números e textos.

### 10. Gate

```
PROPOSITIONS_OVERVIEW_DATA = PASS_WITH_CAVEATS
```

Passa: números conferidos contra o SQL e contra o corte validado; UI estruturalmente idêntica; textos coerentes com a base temporal; testes e `EXPLAIN ANALYZE` registrados. Ressalvas: rio, estagnação, eventos e calendário seguem por ano do número/eventos coletados (por desenho); o DNA é composição de autoria (interpretação acima); as consultas da página ficaram cerca de 2× mais lentas (mais linhas), mitigadas pelo cache de 120 s.
