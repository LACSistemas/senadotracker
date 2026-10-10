# Emendas Pix — identidade histórica do autor (código SIOP → pessoa → Casa → mandato)

Data: 2026-10-06. Continuação de [emendas-pix.md](emendas-pix.md), que deixou `PARLIAMENTARIAN_LINKAGE = PARTIAL`. Esta etapa trata **somente de identidade**. Nada foi implementado no repositório: não há collector financeiro, tabela de Emenda Pix, página `/emendas` nem componente de perfil. Os rosters oficiais foram baixados para uma pasta temporária fora do repositório e a análise foi feita por scripts temporários (lidos do banco do Cívica somente para leitura).

## Resultado em uma tabela

| Classe | Códigos SIOP | % códigos | Emendas | Planos | Valor | % valor |
|---|---:|---:|---:|---:|---:|---:|
| EXACT | 807 | 98,18% | 5.100 (98,86%) | 57.142 (98,82%) | R$ 36,42 bi | 98,79% |
| HIGH | 14 | 1,70% | 52 (1,01%) | 616 (1,07%) | R$ 0,34 bi | 0,93% |
| AMBIGUOUS | 0 | 0% | 0 | 0 | 0 | 0% |
| CONFLICT | 0 | 0% | 0 | 0 | 0 | 0% |
| UNMATCHED | 1 | 0,12% | 7 (0,14%) | 69 (0,12%) | R$ 0,11 bi | 0,29% |
| **Total** | **822** | | **5.159** | **57.827** | **R$ 36,86 bi** | |

Resolvidos (EXACT + HIGH): **821 de 822 códigos (99,9%)**, **99,7% do valor**, 99,9% das emendas e dos planos, 469 de 470 autores com emendas de 2026 (99,8%). A meta de "95%+ dos códigos e 98%+ do valor" foi superada sem fuzzy matching: todo match termina em nome exato do roster oficial + exercício datado.

## 1. Fontes históricas — Câmara

| Fonte | Uso | Resultado |
|---|---|---|
| `GET /api/v2/deputados?idLegislatura={55,56,57}&itens=100&pagina=N` | universo de deputados por legislatura | 1.252 ids distintos (623 + 326 + 303 novos por legislatura) |
| `GET /api/v2/deputados/{id}/historico` | **períodos de exercício**: cada linha traz data/hora, `situacao` (Exercício, Licença, Afastado, Suplência, FIM_MANDATO), `condicaoEleitoral` (Titular, Suplente, Efetivado), UF, partido e descrição ("Posse", "Reassunção", "Afastamento…") | 1.249 de 1.252 com histórico; ver lacuna abaixo |
| `GET /api/v2/deputados/{id}` | `nomeCivil`, `ultimoStatus` | 1.252 |

Legislaturas 56 (2019–2023) e 57 (2023–2027) cobrem 2020–2026 inteiro; a 55 foi baixada só para checar quem estava no mandato anterior. Conferido: o histórico já contém linhas da legislatura 58 (posteriores a 2026), que devem ser ignoradas na carga.

O que o histórico dá, e que a lista por legislatura não dá: entrada/saída datadas (posse, licença, reassunção, fim do mandato), suplente × titular × efetivado, mudança de partido e de UF. Períodos de exercício foram reconstruídos como: abre em `Exercício`, fecha na primeira linha seguinte com situação diferente (ex.: Wilson Santiago tem 7 períodos desde 2003, com licença em 2019, 2024 e 2026).

**Lacunas Câmara (declaradas):**
- `historico` voltou vazio para 3 ids na primeira passada (falha intermitente). Dois se recuperaram na segunda tentativa (204517 Zé Vitor, 220626 Rafael Simões). **Um persiste vazio: 141458 (João Carlos Bacelar, BA)**, apesar de o `/deputados/141458` indicar exercício na 57. Isso é uma lacuna da fonte, não do collector, e explica o único código não resolvido (seção 5).
- Rosters por legislatura incluem deputados que só tiveram vínculo em período não coberto; foram mantidos, o teste de período os descarta.

## 2. Fontes históricas — Senado

| Fonte | Uso | Resultado |
|---|---|---|
| `GET /dadosabertos/senador/lista/legislatura/{55,56,57}` | universo por legislatura (CodigoParlamentar, nome parlamentar, nome completo, UF, partido) | 475 códigos distintos |
| `GET /dadosabertos/senador/{codigo}/mandatos` | mandatos (Titular, 1º/2º Suplente, UF, legislaturas início/fim) e **`Exercicios`** com `DataInicio`, `DataFim`, `SiglaCausaAfastamento` ("TER" término, "DJ" decisão judicial…) | 475 de 475 |

O Senado fornece exatamente o que se pediu: titular × suplente, afastamentos, períodos efetivos de exercício e UF por mandato. Exemplo: Aécio Neves (391) tem três exercícios entre 2011 e 2019, dois deles interrompidos por decisão judicial; nenhum depois de 2019, e por isso não pode ser o autor de emenda de 2020 em diante. O partido por período vem no mesmo endpoint (`Partidos`), não foi necessário para a identidade.

Sem lacunas no Senado.

## 3. Modelo pessoa × mandato

Universo montado: **1.727 registros pessoa-Casa** (1.252 Câmara + 475 Senado) → **1.678 pessoas** quando se unifica a mesma pessoa por **nome civil completo exato** (`nomeCivil` da Câmara = `NomeCompletoParlamentar` do Senado, normalizado). 49 pessoas aparecem nas duas Casas no período dos rosters. Essa unificação é candidata, não definitiva (ver riscos): é nome exato, mas nome continua sendo evidência.

Como isso encaixa no schema atual do Cívica (nada foi migrado):

| Tabela atual | O que já faz | Gap para este caso |
|---|---|---|
| `civica.people` (`id`, `created_at`) | pessoa única, sem nome (o nome vive em `profiles`) | já é o PERSON; precisa de pessoas históricas |
| `civica.external_identifiers` (`source`, `external_id`, `person_id`) | uma identidade oficial por fonte (`camara`, `senado`) | hoje 513 + 81 = 594 linhas, **0 pessoas com as duas fontes**; falta carregar ex-parlamentares |
| `civica.mandates` (`person_id`, `key`, `payload`: uf, início, fim, papel, legislatura) | **já é o MANDATE**: o papel (Titular/Suplente) e as datas vivem no mandato, não na pessoa | 3.940 linhas/594 pessoas (só quem está no roster atual) |
| `civica.exercise_periods` | períodos de exercício por pessoa | cobre 594 pessoas atuais |
| `civica.party_memberships` | partido por período | idem |
| `civica.identity_links` (`person_a`, `person_b`, `status`, `evidence jsonb`) | **projetada para unir a mesma pessoa em fontes diferentes**; hoje tem 0 linhas | é o destino natural dos 49 casos Câmara+Senado |
| `civica_poc.proposal_authors` | autoria de proposições | **não usar como cadastro**; só evidência secundária |

Conclusão: o modelo "PERSON única + MANDATE com a Casa" **já existe** no Cívica. O trabalho é popular pessoas/mandatos históricos (815 pessoas resolvidas, das quais 528 já estão no catálogo atual e **287 precisam ser importadas**) e registrar as 49 uniões em `identity_links`. A Casa pertence ao mandato, como proposto: Efraim Filho é uma pessoa com mandato de deputado (até 2023-01-31) e mandato de senador (2023-02-01 em diante).

## 4. Cobertura histórica obtida

| Ano da emenda | Códigos | Resolvidos (EXACT+HIGH) | % códigos | % valor do ano |
|---|---:|---:|---:|---:|
| 2020 | 137 | 136 | 99,27% | 98,72% |
| 2021 | 402 | 401 | 99,75% | 99,60% |
| 2022 | 507 | 506 | 99,80% | 99,75% |
| 2023 | 515 | 514 | 99,81% | 99,77% |
| 2024 | 530 | 529 | 99,81% | 99,78% |
| 2025 | 502 | 501 | 99,80% | 99,69% |
| 2026 | 470 | 469 | 99,79% | 99,71% |

Em 2026: 408 autores na Câmara, 61 no Senado, 1 não resolvido. No total, 723 códigos resolvidos são de deputados (R$ 29,37 bi) e 98 de senadores (R$ 7,39 bi).

## 5. Resolução dos 822 códigos e metodologia

Evidências, nesta ordem, **todas determinísticas**:

1. **Nome**: nome do autor no Transferegov, normalizado (sem acento, minúsculas, sem pontuação), igual a algum nome oficial do roster (nome parlamentar, nome eleitoral, nome civil/completo). Variações de nome do mesmo código (22 códigos) entram todas como candidatas. Prefixos de tratamento (Dep., Sen., Dr., Delegado…) só são removidos quando o nome bruto não casa, e o resultado é limitado a HIGH.
2. **Período**: o autor precisa ter **exercício datado** (não só mandato) na janela de autoria da emenda (Aug–Dec do ano anterior à LOA) ou, na falta, em qualquer dia do ano da emenda (seção 10).
3. **UF**: a UF da emenda (Portal da Transparência) confirma, mas **não é exigida** (seção 5.2).
4. **Casa**: derivada do mandato com exercício, nunca do estado atual da pessoa.

Fuzzy matching foi usado **só para gerar candidatos de revisão** (item 7) e nunca contou como match.

Regras de classe:

| Classe | Regra | Códigos |
|---|---|---:|
| EXACT | uma só pessoa; nome exato; UF coerente; exercício na janela de autoria em **todos** os anos do código | 807 |
| HIGH | uma só pessoa e nome exato, mas falta um dado secundário (ver 5.1) | 14 |
| AMBIGUOUS | mais de uma pessoa com exercício no mesmo ano do código | 0 |
| CONFLICT | nome acha a pessoa, mas sem exercício em nenhum ano do código, ou pessoas diferentes em anos diferentes sem explicação | 0 |
| UNMATCHED | nenhum registro oficial com o nome | 1 |

### 5.1 Os 14 HIGH e o 1 UNMATCHED (lista completa)

| Código | Autor | Classe | Motivo | Candidato |
|---|---|---|---|---|
| 1418 | Neucimar Fraga (ES) | HIGH | emenda 2021: exercício só no ano, não na janela de autoria | camara:74165 |
| 1984 | Onyx Lorenzoni (RS) | HIGH | idem | camara:74399 |
| 2018 | Aelton Freitas (MG) | HIGH | idem | camara:141372 |
| 3568 | Paulo Magalhães (BA) | HIGH | idem | camara:74574 |
| 3740 | Pedro Vilela (AL) | HIGH | idem | camara:178844 |
| 4190 | Joseildo Ramos (BA) | HIGH | idem (suplente que assume em 2021) | camara:209189 |
| 4212 | Josivaldo JP (MA) | HIGH | idem | camara:215043 |
| 4214 | Pedro Augusto Palareti (RJ) | HIGH | idem | camara:215045 |
| 4215 | Vivi Reis (PA) | HIGH | idem | camara:215044 |
| 9103 | Luis Miranda (emenda destinada à BA) | HIGH | nome exato único; UF da emenda ≠ UF do deputado (DF) | camara:204381 |
| 4385 | Gilvan Maximo (GO) | HIGH | idem | camara:220531 |
| 3919 | Bia Kicis (SP) | HIGH | idem | camara:204374 |
| 4289 | Delegado Bruno Lima | HIGH | UF da emenda não informada (Portal "Múltiplo") | camara:220642 |
| 3630 | Alberto Fraga | HIGH | idem | camara:73579 |
| **1270** | **João Carlos Bacelar (BA)** | **UNMATCHED** | existem dois homônimos plausíveis no mesmo estado: `69871` Bacelar (civil "João Carlos Bacelar Batista") e `141458` João Carlos Bacelar (civil "João Carlos Paolilo Bacelar Filho"); o histórico do segundo vem vazio da API, então o teste de período não pode separá-los | ambos, **não resolvido** (R$ 105 mi, 0,29% do valor) |

Observação: o código 1270 existe de 2020 a 2026. Um deles (69871) tem mandatos desde 2015; o outro (141458) só aparece na 57. Resolver exige o histórico de 141458, o que a API hoje não entrega; fica **unresolved**, como pedido.

### 5.2 A UF não é a UF do parlamentar

O Portal informa a UF da emenda como localidade de aplicação do recurso, e não o estado do autor. Entre os EXACT medidos (805 na rodada de medição, antes de recuperar 2 históricos vazios), a UF coincide com a do parlamentar em 803 (99,8%) e diverge em 2; nas 3 HIGH de "UF divergente" os autores são deputados do DF com emendas destinadas a outros estados. Sem a UF, o nome exato mais o exercício já é único em **817 dos 822** códigos; a UF só foi necessária para desempatar **2**. Por isso a UF é evidência de corroboração e não condição de match. 

### 5.3 Homônimos desfeitos pelo tempo (5 códigos)

| Código | Nome | Pessoas com o mesmo nome | Como o tempo resolveu |
|---|---|---|---|
| 1935 (2021–2023) | Átila Lira (PI) | 74459 Átila **Freitas** Lira (mandato 2019–2023) e 123086 Átila **de Melo** Lira (2023 em diante) | 2021–2023 → 74459 |
| 4309 (2024–2026) | Átila Lira (PI) | os mesmos dois | 2024–2026 → 123086 |
| 3725 | Mariana Carvalho (RO) | 178956 (RO) e 227275 (MA, 2023–2024) | UF e período → 178956 |
| 4312 | Bebeto (RJ) | 220612 Carlos Roberto Rodrigues (RJ) e 178834 / senado:5554 Adalberto Souza Galvão (BA, até 2019) | período e UF → 220612 |
| 4153 | José Medeiros (MT) | camara:204472 (2019–) e senado:5112 José Antonio Medeiros (2015–2019) | período → 204472 |

Este é o caso em que "nome parecido ≠ mesma pessoa": Átila Lira pai e filho têm **dois códigos SIOP diferentes** (1935 e 4309), cada um com seu período; só o roster datado os separa.

## 6. Troca de Casa

41 códigos resolvidos pertencem a pessoas que, nos rosters 55–57, tiveram mandato nas duas Casas. Sem regra temporal, qualquer match por nome seria multi-Casa. Com ela, **0 dos 821 códigos resolvidos muda de Casa ao longo dos anos**: cada código SIOP aparece em uma única Casa.

Os cinco nomes que o usuário pediu:

| Pessoa | Mandatos nos rosters (datas de exercício) | Código(s) SIOP | Anos | Casa atribuída |
|---|---|---|---|---|
| Aécio Neves | Senado 391: 2011–2019-01-31 (com afastamentos judiciais); Câmara 74646: 2019-02-01 em diante | 1349 | 2020–2026 | Câmara em todos os anos |
| Sérgio Souza | Senado 5048: 2011–2014 (1º suplente); Câmara 178933: 2015–2026 | 3809 | 2020–2026 | Câmara em todos os anos |
| Wilson Santiago | Senado 3811: 2011-02-01..2011-11-07; Câmara 74044: 2003–2011, 2019–2026 (com licenças em 2019, 2024, 2026) | 1283 | 2020–2026 | Câmara em todos os anos |
| José Medeiros | Câmara 204472: 2019–2026; Senado 5112 (José Antonio Medeiros): 2015–2019 | 4153 | 2021–2026 | Câmara em todos os anos |
| Lídice da Mata | Senado 4575: 2011–2019; Câmara 139285: 2007–2011, 2019–2026 | 2468 | 2021–2026 | Câmara em todos os anos |

Nenhum deles muda de Casa durante 2020–2026: o risco era o nome aparecer como senador antes de 2019. A regra temporal elimina o Senado nesses cinco casos.

Trocas reais de Casa dentro do período (6 pessoas, cada uma com **dois códigos**, um por Casa):

| Pessoa | Código na Câmara (anos) | Código no Senado (anos) | Observação |
|---|---|---|---|
| Efraim Filho | 2449 (2020–2023) | 4270 (2024–2026) | senador desde 2023-02-01; a emenda 2023 foi atribuída à Câmara (ver abaixo) |
| Professora Dorinha | 2693 (2020–2023) | 4275 (2024–2026) | idem |
| Beto Faro | 2152 (2021–2023) | 4266 (2024–2026) | idem |
| Laércio Oliveira | 2608 (2021–2023) | 4274 (2024–2026) | idem |
| Alan Rick | 3036 (2021–2023) | 4394 (2024–2026) | idem |
| Hiran Gonçalves | 3396 (2021–2023) | 4269 (2024–2026) | idem |

Isso prova duas coisas: (a) a Casa pode ser guardada no crosswalk, porque o SIOP emite um código por parlamentar **por Casa**; (b) a emenda do ano **Y** é atribuída ao mandato vigente na janela de autoria (Y−1), não ao do ano Y. Todas as emendas 2023 desses seis, mesmo com posse no Senado em 2023-02-01, têm código antigo (Câmara), compatível com autoria em 2022.

## 7. Ex-parlamentares

Dos 246 códigos que a investigação anterior marcou "não encontrado" (porque o catálogo do Cívica só tem membros em exercício):

| Resultado do roster histórico | Códigos |
|---|---:|
| ex-deputado titular encontrado (roster histórico) | 166 |
| deputado suplente / efetivado encontrado | 42 (+5 HIGH) |
| ex-senador titular encontrado | 14 |
| ex-senador suplente encontrado | 9 |
| pessoa com mandato nas duas Casas | 6 |
| parlamentar fora de exercício (classe HIGH, titular Câmara) | 1 |
| nome com UF divergente (Luis Miranda, Gilvan Maximo, Bia Kicis; destes, 2 estavam entre os 246) | 2 |
| já no catálogo atual (falha anterior de nome) | 1 |
| **realmente não encontrado nos rosters oficiais** | **0** |

Nenhum caso exigiu "nome alterado" nem fuzzy. A causa dos 246 era **escopo do catálogo atual**, e não grafia: todos foram achados nos rosters 55–57. O único código agora não resolvido (1270) é uma lacuna da API da Câmara (histórico vazio), não um ex-parlamentar ausente.

## 8. Ambiguidades

Com a regra temporal: 0 AMBIGUOUS e 0 CONFLICT. Sem ela (nome + UF apenas), a investigação anterior teve 10 ambíguos e 212 ambíguos com o universo ampliado de `proposal_authors`. Os 5 homônimos reais estão na seção 5.3. A ambiguidade que sobra é a de 1270, que continua sem decisão e não será forçada.

## 9. Proposta de crosswalk

A preferência conceitual do pedido (`author_code → person`; `person + data → mandato → Casa`) foi validada nos dados **com um ajuste**: como cada código SIOP pertence a uma única Casa em todos os anos observados (0 exceções em 821), a Casa pode ficar **no crosswalk como atributo derivado e verificável**, em vez de só no mandato. Ela continua sendo conferida contra o mandato; se divergir, é erro de dado.

```
author_code_crosswalk
  author_code      text    -- código SIOP de 4 dígitos (como texto)
  person_id        uuid    -- civica.people.id (pessoa única)
  house            text    -- 'camara' | 'senado' (derivada do mandato; validada)
  mandate_key      text    -- civica.mandates.key do mandato que sustenta a casa
  valid_from       date    -- primeiro ano/período em que o código aparece
  valid_to         date
  method           text    -- 'name_exact+exercise+uf' | 'name_exact+exercise' | 'manual'
  confidence       text    -- EXACT | HIGH
  evidence_source  jsonb   -- ids oficiais (camara:id, senado:codigo), período usado, anos
  reviewed         boolean -- EXACT pode nascer true (regra determinística); HIGH só true após revisão
  reviewed_at      timestamptz
  PK (author_code, valid_from)
```

Regras de uso:
- O código SIOP nunca é comparado com ids da Câmara/Senado; só entra como `author_code`.
- Nome é evidência (`evidence_source`), não chave.
- Seis pessoas têm dois `author_code`; uma pessoa pode ter mais de um código, mas nenhuma teve dois códigos na mesma Casa e ano (0 casos).
- A unificação Câmara+Senado da mesma pessoa vai para `identity_links` (49 candidatas, por nome civil exato) com `status='candidate'` até revisão.
- Uma exibição só usa linhas com `reviewed=true` e `confidence IN (EXACT, HIGH)`; o resto aparece no perfil como "autoria não vinculada".

## 10. Identidade × exercício: o que a fonte exige

Pergunta: para atribuir a emenda, o autor precisa estar em exercício, ser titular ou apenas habilitado? O Cívica não consultou a norma orçamentária; o que se mediu foi o comportamento dos dados, com exercício datado dos rosters oficiais:

| Teste (3.056 código-ano resolvidos) | Resultado |
|---|---:|
| Exercício na janela de autoria (Aug–Dec do ano Y−1) **e** no ano Y | 3.039 |
| Exercício **só** na janela de autoria (saiu antes de Y) | 8 |
| Exercício **só** no ano Y (entrou depois da janela) | 9 |

Leituras:
- **8 casos** só-janela (ex.: Ronaldo Martins 2023, Guaracy Silveira 2023, Márcio Correa 2024, Newton Bonin 2025, Samuel Santos 2026, Otto Alencar Filho 2026, Eliane Nogueira 2023, Rodrigo Cunha 2025): o parlamentar já tinha deixado o exercício no ano da emenda, mas **autorou como membro em exercício antes**. Atribuir a ele é correto; um critério "exercício no ano Y" os classificaria como CONFLICT (e foi o que a primeira rodada deste teste fez: 5 CONFLICT + 1 AMBIGUOUS, todos desfeitos pela janela).
- **9 casos** só-ano (deputados que assumiram em 2021 como suplentes): sem exercício na janela de 2020 e ainda assim com emenda de 2021. A janela não é a única regra; ficaram como HIGH.
- Papel na janela de autoria (rodada anterior, 3.043 código-anos): 2.898 código-anos de titulares, 50 de suplentes, 37 de 1º suplente, 47 de efetivados, 2 de 2º suplente, 9 sem exercício na janela. **Suplentes em exercício também autoram** (SIOP trata o suplente em exercício como parlamentar).
- 78 código-anos têm menos de 60 dias de exercício na janela (suplência curta); estão no resultado e são exatamente os casos em que "tinha mandato" ≠ "estava em exercício".

Regra recomendada: **atribuir ao autor com exercício datado na janela de autoria; aceitar exercício no ano da emenda como fallback e marcar HIGH**. Titularidade sem exercício não basta: exercício datado é a prova. Esta é uma regra empírica; a janela de Aug–Dec do ano Y−1 é uma hipótese do processo da LOA, sustentada por 3.047 de 3.056 código-anos, e deve ser confirmada contra o calendário da LOA se o resultado vier a ser exibido com precisão de data.

## 11. Cobertura por valor (resumo)

Ver a tabela de resultado no topo. Em outras palavras, o que o perfil poderia atribuir sem risco hoje:

| Medida | Valor |
|---|---:|
| Códigos resolvidos | 821/822 (99,88%) |
| Emendas (5.159) | 5.152 resolvidas (99,86%) |
| Planos (57.827) | 57.758 (99,88%) |
| Valor (R$ 36,86 bi) | R$ 36,76 bi (99,71%) |
| Autores de 2026 | 469/470 (99,79%) |
| Deputados (códigos / valor) | 723 / R$ 29,37 bi |
| Senadores (códigos / valor) | 98 / R$ 7,39 bi |
| Só EXACT (sem revisão manual) | 807 códigos / 98,79% do valor |

## 12. Riscos

1. **Nome continua sendo a base da identidade**; o que o torna seguro é o universo fechado (só parlamentares federais autoram emendas individuais) e o exercício datado. Um homônimo fora dos rosters 55–57 não é possível para 2020–2026, mas a regra deve ser reexecutada a cada nova legislatura.
2. **Unificação Câmara+Senado por nome civil exato** (49 casos): é candidata. Homônimos com nome civil idêntico são improváveis, mas a união deve ser revisada antes de ir a `identity_links` com `confirmed`.
3. **Lacuna da API da Câmara** (141458 sem histórico) e falhas intermitentes (3 ids retornaram vazio na primeira passada; um collector precisa rechecar históricos vazios).
4. **Janela de autoria é empírica**: se o calendário da LOA mudar, a regra deve ser parametrizada por ano.
5. **O Portal mostra a UF da emenda, não a do autor**; se alguém usar a UF como evidência de identidade, errará (3 casos reais).
6. **Linhas da legislatura 58** já aparecem no histórico da Câmara; a carga deve ignorar períodos futuros.
7. **Catálogo do Cívica incompleto**: 287 das 815 pessoas resolvidas não estão no catálogo atual e precisam ser importadas antes de exibir perfil para elas.
8. **Mudança de Casa**: o código SIOP é por Casa; um novo código aparecerá quando um deputado virar senador (seis casos já ocorreram). O crosswalk precisa aceitar um novo `author_code` para a mesma pessoa.

## 13. Recomendação

1. Importar para `civica.people`, `external_identifiers`, `mandates` e `exercise_periods` as 815 pessoas resolvidas (287 novas), a partir dos mesmos endpoints oficiais, sem usar `proposal_authors`.
2. Registrar as 49 uniões Câmara+Senado em `identity_links` como `candidate` e revisar.
3. Construir `author_code_crosswalk` com os 807 EXACT já `reviewed=true` (regra determinística) e os 14 HIGH como `reviewed=false` até revisão manual.
4. Resolver 1270 por consulta direta à Câmara (histórico de 141458) ou revisão humana; enquanto isso, publicar como "não vinculado" (R$ 105 mi, 0,29%).
5. Só então implementar o collector financeiro e as páginas, exibindo no perfil apenas linhas com `reviewed=true`.

## Gates finais

| Gate | Resultado | Justificativa |
|---|---|---|
| HISTORICAL_ROSTER_CAMARA | **COMPLETE_WITH_1_GAP** | 1.252 deputados das legislaturas 55–57 com histórico de exercício; 1 id (141458) retorna histórico vazio na API |
| HISTORICAL_ROSTER_SENADO | **COMPLETE** | 475 senadores das legislaturas 55–57 com mandatos, suplência e exercícios datados |
| SIOP_CODES_RESOLVED | **821/822 (99,88%)** | 807 EXACT + 14 HIGH; 0 AMBIGUOUS, 0 CONFLICT; 1 UNMATCHED (1270) |
| SIOP_VALUE_RESOLVED | **99,71%** (EXACT 98,79%) | R$ 36,76 bi de R$ 36,86 bi; restam R$ 0,11 bi |
| CROSSWALK_READY | **READY_WITH_REVIEW** | estrutura validada nos dados; 14 HIGH e a união Câmara+Senado precisam de revisão; 287 pessoas a importar |
| PROFILE_PIX_LINKAGE | **SAFE** (restrito a vínculos `reviewed=true`) | universo fechado de parlamentares federais, exercício datado, 0 ambíguos; os 807 EXACT são seguros para atribuição imediata (98,79% do valor); HIGH só após revisão; o código não resolvido não é atribuído a ninguém |

## Implementação (2026-10-06): resultado real do crosswalk persistido

Pipeline em `apps/collector/src/postgres-pix-identity.ts` (`npm run pix -- identity`), regras em `packages/domain/src/budget.ts`, contrato em [../contracts/emendas-pix.md](../contracts/emendas-pix.md). Os números abaixo foram **recalculados** sobre a carga real e diferem levemente da investigação:

| Classe | Investigação | Implementado |
|---|---:|---:|
| EXACT (reviewed=true) | 807 | **806** |
| HIGH (reviewed=false) | 14 | **14** (os mesmos nove de "exercício só no ano" + três de UF divergente + dois sem UF) |
| AMBIGUOUS | 0 | **1** — 1270 João Carlos Bacelar (regra de homônimo parcial: `69871` *Bacelar Batista* × `141458`) |
| CONFLICT | 0 | **1** — 4454 Rafael Simões (histórico da Câmara vazio na API durante a coleta) |

Valor atribuível a perfis: **98,66%** (R$ 36,37 bi), não atribuído R$ 0,49 bi. Mudanças de método que explicam a diferença:

1. **1270 passou de UNMATCHED a AMBIGUOUS**: com o roster completo, o nome exato casa com 141458, mas outra pessoa ativa (69871) tem nome oficial que começa por ele. A regra de homônimo parcial (outra pessoa, mesma UF, ativa no período, nome oficial iniciado pelo nome do autor e não autora por si só de outro código) impede a escolha automática. Ela é geral: o mesmo teste preservou Otto Alencar (3795) como EXACT porque "Otto Alencar Filho" é autor do código 4123.
2. **Exercício da Câmara derivado dos eventos** (`deriveChamberExercises`): o parser genérico descarta o estado em eventos simultâneos (posse + efetivação) e criava lacunas falsas.
3. **Histórico indisponível não é evidência**: a API da Câmara devolve `/historico` vazio de forma intermitente (141458, 74043, 220626 em momentos diferentes); a coleta insiste, usa a última coleta boa (`stale`) e nunca rebaixa linhas positivas por causa disso. Rafael Simões (4454) fica CONFLICT até a API responder.

Persistência: `civica.people` 594 → 916 (322 novas; 528 reutilizadas), 850 perfis históricos, 2.164 mandatos, 2.433 exercícios, 3.207 filiações, 35 `identity_links` candidatos, nenhum lote histórico em `active_publications`.

Gates da implementação: HISTORICAL_ROSTER_CAMARA = COMPLETE_WITH_1_GAP (intermitência da API; 1 id sem histórico no corte) · HISTORICAL_ROSTER_SENADO = COMPLETE · SIOP_CODES_RESOLVED = 820/822 (806 EXACT + 14 HIGH) · SIOP_VALUE_RESOLVED = 99,59% (EXACT revisado: 98,66%) · CROSSWALK_READY = READY_WITH_REVIEW · PROFILE_PIX_LINKAGE = SAFE (somente `reviewed=true`).
