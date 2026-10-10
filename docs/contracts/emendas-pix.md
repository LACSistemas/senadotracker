# Emendas Pix (Transferências Especiais) — contrato do domínio

Domínio permanente do Cívica, **separado** das proposições (`civica_poc.proposals`) e das emendas legislativas (EMC/EMP/SBT). Não há UI nesta etapa: o que existe é infraestrutura, carga, reconciliação e *read models*. Investigações de origem: [emendas-pix.md](../investigacoes/emendas-pix.md) e [emendas-pix-identidade.md](../investigacoes/emendas-pix-identidade.md).

Três coisas diferentes chamadas "emenda": **A** legislativa (texto de lei, `civica_poc`), **B** orçamentária geral (LOA), **C** Transferências Especiais ("Emenda Pix", subconjunto individual de B). Este contrato trata só de C.

## 1. Fontes

| Fonte | Acesso | Uso |
|---|---|---|
| Transferegov — Transferências Especiais (`https://api.transferegov.gestao.gov.br/transferenciasespeciais`, PostgREST) | aberto; máx. 1.000 linhas/requisição; `order=<PK>&offset=`; `Prefer: count=exact` → `content-range`; `User-Agent` identificável | planos de ação, empenhos, documentos hábeis, ordens bancárias, executores/objeto, áreas de política pública, planos de trabalho, relatórios de gestão, programa |
| Portal da Transparência — `download-de-dados/emendas-parlamentares/UNICO` (ZIP, windows-1252, `;`) | aberto; sem a API REST (que exige chave) | valores por emenda (empenhado, liquidado, pago, restos a pagar), IBGE quando informado, pagamentos por favorecido/mês |
| Rosters oficiais Câmara (`/deputados?idLegislatura=`, `/deputados/{id}`, `/deputados/{id}/historico`) e Senado (`/senador/lista/legislatura/{N}`, `/senador/{id}/mandatos`, `/senador/{id}/filiacoes`) | aberto | identidade e exercício datado dos autores (legislaturas 55–57) |

## 2. Schema `civica_budget` (DDL em `packages/db/src/postgres-budget.ts`, `ensureBudgetSchema`, idempotente)

| Tabela | PK | Conteúdo |
|---|---|---|
| `budget_ingestion_runs` | `run_id` | execução: status (`running|published|failed`), corte das fontes, contagens, reconciliação (gates) |
| `budget_programs` | `program_id` | programa/ano, órgão, valores do programa |
| `budget_amendments` | `amendment_code` (12 dígitos, CHECK) | ano, `author_code`, nome, `in_transferegov`, `in_portal`, `portal_committed/liquidated/paid/outstanding_payables(+cancelled/paid)`, UF/localidade/IBGE/função do Portal |
| `special_action_plans` | `plan_id` | plano de ação: `plan_code`, `amendment_code`, beneficiário (CNPJ, nome, UF), `ente_type`, `ibge_code` (NULL se a fonte não traz), `custeio_amount`, `investimento_amount`, situação, situação/datas do plano de trabalho, texto de áreas/função, programa |
| `special_plan_functions` | `(plan_id, function_code, subfunction_code)` | função/subfunção do plano, parseada do texto de áreas |
| `special_plan_executors` | `executor_id` | executor, **objeto**, custeio/investimento do executor |
| `special_plan_areas` | `(executor_id, area_code)` | áreas de política pública (`finalidade_especial`) |
| `special_commitments` | `commitment_id` | empenhos (`valor_empenho`, categoria custeio/investimento) |
| `special_payment_documents` | `dh_id` | documento hábil (`valor_dh`, `valor_rateio_dh`) |
| `special_payment_orders` | `op_ob_id` | ordem de pagamento/bancária (datas; **a fonte não traz valor**) |
| `special_management_reports` | `report_id` | relatório de gestão (executado/pendente pelo ente) |
| `portal_beneficiary_payments` | `(amendment_code, payment_month, favored_code, row_seq)` | pagamentos por favorecido e mês (Portal) |
| `author_code_crosswalk` | `(author_code, valid_from)` | **código SIOP → pessoa** (ver seção 4) |
| view `reviewed_amendment_authors` | — | **única porta de atribuição** emenda → pessoa |

Não há FK de `civica_budget` para `civica_poc` (teste automatizado). A única FK externa é `author_code_crosswalk.person_id → civica.people(id)`. Dados bancários do Transferegov **não** são persistidos. `historico_pagamento_especial`, `meta_especial` e as tabelas de análise (≈ 550 mil linhas) não são carregadas: não alteram nenhum número exibido.

Cadeia preservada: `plano → empenho → documento hábil → ordem bancária` (ids oficiais; nenhum campo único "pago" colapsa a cadeia).

## 3. Coleta

`scripts/pix-collect.ts` (`npm run pix -- <comando>`; `--run <id>`, `--data-dir`):

1. **`collect`** — `runPixCollection`: baixa as 9 tabelas do Transferegov (retry com backoff, `order` por PK, `limit=1000`) para JSONL com `manifest.json` (**checkpoint por tabela**: uma coleta interrompida retoma da próxima tabela), confere linhas baixadas × `content-range` (divergência persistente derruba a tabela), baixa o ZIP do Portal e filtra "Emenda Individual - Transferências Especiais". A carga (`loadBudgetRun`) roda **numa transação única**: upsert por PK natural + remoção do que a fonte deixou de ter (`run_id` antigo). Reconcilia e só então marca o run `published`; qualquer gate bloqueante em FAIL desfaz tudo (o run fica `failed`, os dados anteriores permanecem). Recarga completa, sem "modificado desde" (a API não tem).
2. **`identity`** — `runPixIdentity`: baixa os rosters históricos, deriva a Casa e o exercício por ano, resolve os códigos SIOP, grava pessoas/mandatos/exercícios/filiações no **lote histórico** `pg:roster-historical:{camara|senado}:55-57` (nunca em `active_publications`), grava `identity_links` candidatos e o crosswalk. Reexecutável: reutiliza `civica.people` por `(fonte, id oficial)`, preserva revisão humana e não rebaixa linhas já positivas quando a API devolve histórico vazio.
3. **`report`** — cobertura do crosswalk e coleta ativa (somente leitura). `npm run pix:validate` imprime todos os números reais e os tempos dos read models.

A API da Câmara devolve `dados: []` de forma intermitente para `/historico`. A coleta insiste (3× + 3 varreduras finais com espera) e, em último caso, reaproveita o histórico da última coleta boa marcando `stale`; ids ainda sem histórico são listados (`unavailableHistories`) e **nunca** viram evidência de ausência de mandato.

## 4. Crosswalk SIOP → pessoa

`civica_budget.author_code_crosswalk`: `author_code` **TEXT** (nunca comparado numericamente com ids da Câmara/Senado — 8 colisões numéricas já provadas falsas), `person_id` (NULL = não resolvido), `house`, `mandate_key`, `valid_from/valid_to`, `method`, `confidence` (`EXACT|HIGH|AMBIGUOUS|CONFLICT|UNMATCHED`), `evidence_source` (jsonb: razão, nomes, UFs, anos, registro oficial por ano, candidatos, regra), `reviewed`, `reviewed_at`, `review_source` (`rule|human`), `created_at/updated_at`.

Regras de resolução (`resolveAuthorCode`, `packages/domain/src/budget.ts`): nome oficial exato (nome parlamentar, nome eleitoral ou nome civil; tratamento tipo "Dep."/"Dr." só reduz a HIGH) **+ exercício datado** na janela de autoria da emenda (ago–dez do ano anterior) ou, na falta, no ano da emenda (HIGH). UF da emenda corrobora, não decide (é a localidade de aplicação). Homônimo parcial — outra pessoa ativa, na mesma UF, cujo nome oficial **começa** pelo nome do autor e que não é autora por si só de outro código — resulta em AMBIGUOUS. Fuzzy nunca confirma.

Constraints no banco: `reviewed` exige `person_id` e `confidence IN ('EXACT','HIGH')`; `house` exige pessoa. EXACT nasce `reviewed=true` por regra determinística; HIGH nasce `reviewed=false`; os demais ficam sem pessoa. Uma linha com `review_source='human'` nunca é sobrescrita por uma nova coleta.

**Regra de uso:** só se atribui emenda a uma pessoa quando `reviewed = true`, `confidence IN ('EXACT','HIGH')`, `person_id` não nulo e o ano da emenda está dentro da validade (`reviewed_amendment_authors`). Uma pessoa pode ter **N códigos** (6 pessoas trocaram de Casa e têm um código por Casa); a união de pessoas Câmara↔Senado só vale com `identity_links.status = 'confirmed'` (candidatos não unem).

## 5. Semântica financeira (contrato)

| Campo | Fonte | Significado | Não significa |
|---|---|---|---|
| `destinedAmount` | Transferegov: soma custeio+investimento dos planos | quanto foi destinado em planos de ação | dinheiro recebido |
| `committedAmount` | Portal, por emenda | empenhado oficial | — |
| `plansCommittedAmount` | Transferegov: soma dos empenhos dos planos | empenho por plano (medida distinta, não somar à anterior) | — |
| `liquidatedAmount`, `paidAmount` | Portal, por emenda | liquidado/pago | **obra executada** |
| `outstandingPayables` | Portal | restos a pagar inscritos | — |
| `paidByPlanDocumentsAmount` | Transferegov: documentos hábeis com ordem bancária (por plano) | pagamento por plano, **só 2023+** de forma confiável | — |
| `executedByEnteAmount` | Transferegov: último relatório de gestão do plano | execução informada pelo ente (parcial) | pago |

Para emendas de 2020–2022 o pago só é confiável no nível da emenda (Portal); o Transferegov não tem documento hábil por plano nesses anos. `PIX_FINANCIAL_NOTES` carrega essas ressalvas nos read models.

## 6. Reconciliação (`reconcileBudget`, gravada em `budget_ingestion_runs.reconciliation`)

| Gate | Condição | Bloqueia a publicação |
|---|---|---|
| `TRANSFEREGOV_PLAN_COVERAGE` | por tabela: oficial = baixado, e carregado = baixado − linhas duplicadas idênticas da fonte | sim |
| `PORTAL_AMENDMENT_MATCH` | toda emenda "Transferências Especiais" do Portal existe no Transferegov (código de 12 dígitos) | sim |
| `REFERENTIAL_INTEGRITY` | planos sem emenda, empenhos sem plano, documentos sem empenho, ordens sem documento, executores sem plano = 0 | não (informa) |
| `FINANCIAL_RECONCILIATION` | destinado ≈ soma dos empenhos dos planos (<0,5%) | não (informa; traz também Portal × empenhos por emenda) |
| `CROSSWALK_COVERAGE` | ≥ 95% do valor destinado com autor revisado | não (informa) |

Também registra contagem de linhas por tabela, emendas só no Portal / só no Transferegov, autores SIOP sem crosswalk revisado, totais (destinado, empenhado, liquidado, pago, restos a pagar) e beneficiários.

## 7. Read models (`packages/db/src/postgres-budget-read.ts`, exportados por `@senadotracker/db`)

- `parliamentarianPixSummary(db, personId, {year?})` — **somente** crosswalk revisado (e pessoas ligadas por link confirmado): `authorCodes`, `financials`, contagens (emendas, planos, beneficiários, UFs), `byYear`, `byExpenseKind` (custeio × investimento), `byFunction` (planos por função; um plano pode ter várias), `topBeneficiaries`, `amendments`, `notes`.
- `pixAmendmentDetail(db, amendmentCode)` — autor (atribuído ou o motivo: `no_crosswalk_entry`, `unresolved:*`, `pending_review:*`, `outside_validity_period`), Portal, planos com beneficiário, objeto, funções, áreas, cadeia empenho → DH → OB, executado pelo ente.
- `pixBeneficiaryDetail(db, cnpj)` — total destinado, autores (com `personId` só se revisado), emendas, planos, anos, objetos, funções, recebido (Portal).
- `pixProfileCoverage(db)` — `PROFILE_PIX_VALUE_COVERAGE`.

Valor associado a um `author_code` não revisado nunca é atribuído a uma pessoa; no detalhe da emenda aparece como "autoria não vinculada" com o motivo.

## 8. Testes

`tests/unit/pix-domain.test.ts` (regras puras e resolvedor), `pix-budget-db.test.ts` (carga, idempotência, visibilidade, financeiro, links; fixture em 2031–2032 dentro de transação revertida), `pix-identity-db.test.ts` (roster/crosswalk idempotentes, lote histórico fora de `active_publications`), `pix-real-data.test.ts` (1270 sem pessoa, os seis que trocaram de Casa, HIGH invisível, cobertura real). Todos em `npm test`.

## 9. Números reais da carga (coleta `pix:2026-10-06`, recalculados no banco — não copiados da investigação)

> A cobertura de atribuição desta seção (98,66%) é a de antes do fechamento; o valor final (99,71%) está em "Fechamento de identidade para publicação", no fim do documento.

| Medida | Valor |
|---|---:|
| Período coberto (ano da emenda) | 2020–2026 |
| Emendas (`budget_amendments`) | 5.159 (5.108 também no Portal; 51 só no Transferegov; 0 só no Portal) |
| Planos de ação | 57.827 |
| Autores SIOP distintos | 822 |
| Beneficiários (CNPJ) | 5.539 |
| Valor destinado | R$ 36.864.533.740,10 |
| Empenhado — soma dos planos (Transferegov) | R$ 36.864.533.740,10 |
| Empenhado — Portal, por emenda | R$ 33.818.539.618,97 |
| Liquidado = pago — Portal, por emenda | R$ 30.427.264.457,33 |
| Restos a pagar inscritos — Portal | R$ 1.815.600.927,58 |
| Pago por documento hábil com OB (Transferegov, todos os anos) | R$ 26.171.013.773,52 |

Linhas por tabela: programas 15, emendas 5.159, planos 57.827, funções 227.928, executores 57.366 (8 linhas idênticas duplicadas na fonte), áreas 94.262, empenhos 60.322, documentos hábeis 57.986, ordens 55.148, relatórios de gestão 25.957, pagamentos por favorecido (Portal) 52.144. Gates: `TRANSFEREGOV_PLAN_COVERAGE` PASS, `PORTAL_AMENDMENT_MATCH` PASS (5.108/5.108), `REFERENTIAL_INTEGRITY` PASS (0 órfãos), `FINANCIAL_RECONCILIATION` PASS, `CROSSWALK_COVERAGE` WARN (98,66% < meta de 99%, ver abaixo).

### Atribuição a perfis (`PROFILE_PIX_VALUE_COVERAGE`)

| | Códigos | Valor | % do valor |
|---|---:|---:|---:|
| Atribuível a perfis (`reviewed=true`, EXACT) | 806 | R$ 36.369.944.147,57 | **98,66%** |
| Não atribuído | 16 | R$ 494.589.592,53 | 1,34% |
| — HIGH aguardando revisão humana | 14 | ≈ R$ 0,34 bi | 0,93% |
| — 1270 João Carlos Bacelar (AMBIGUOUS) | 1 | ≈ R$ 0,105 bi | 0,29% |
| — 4454 Rafael Simões (CONFLICT: histórico da Câmara vazio na API) | 1 | ≈ R$ 0,048 bi | 0,13% |

5.097 das 5.159 emendas têm autor atribuível. Por Casa (EXACT revisados): Câmara 708 códigos / R$ 28,98 bi; Senado 98 códigos / R$ 7,39 bi. Por ano (valor atribuível): 2020 98,72% · 2021 97,36% · 2022 98,28% · 2023 98,79% · 2024 98,90% · 2025 98,78% · 2026 98,65%.

A expectativa da investigação (≈ 98,79%) ficou ~0,13 p.p. abaixo porque 4454 (Rafael Simões) caiu em CONFLICT: a API da Câmara devolve o `/historico` desse deputado vazio de forma intermitente e a regra "histórico indisponível não é prova" o deixa sem pessoa. Uma nova execução de `identity` (idempotente) o resolve quando a API responder, sem rebaixar nada que já esteja gravado.

### Identidade

Roster: 1.252 deputados + 475 senadores (legislaturas 55–57). Persistidos no lote histórico: 850 perfis, 2.164 mandatos, 2.433 períodos de exercício, 3.207 filiações; `civica.people` passou de 594 para 916 (322 novas; 528 reutilizadas do catálogo ativo); `identity_links` candidatos: 35 (todos `candidate`; nenhum confirmado automaticamente); lotes históricos em `active_publications`: 0.

Mudança de Casa (seis pessoas, dois códigos cada, todos EXACT/revisados): Efraim Filho 2449 (Câmara 2020–2023) → 4270 (Senado 2024–2026); Professora Dorinha 2693 → 4275; Beto Faro 2152 → 4266; Laércio Oliveira 2608 → 4274; Alan Rick 3036 → 4394; Hiran Gonçalves 3396 → 4269.

### Desempenho dos read models (banco local)

`parliamentarianPixSummary` 60–103 ms (parlamentar com 261 planos); `pixAmendmentDetail` (emenda com 118 planos) 39 ms; `pixBeneficiaryDetail` 24 ms; `pixProfileCoverage` (varre os 57.827 planos) 744 ms. Índices por `author_code`/ano, `amendment_code`, `beneficiary_cnpj`, `plan_id` e pelas chaves da cadeia financeira. A coleta completa baixa ≈ 476 requisições em poucos minutos; a carga em transação única leva poucos minutos; a identidade (≈ 3.000 requisições) leva ~15 min.

## 10. Ressalvas

1. **HIGH ≠ visível**: os 14 HIGH só entram em perfil após revisão humana (`review_source='human'`, `reviewed=true`).
2. **1270** nunca recebe pessoa: dois homônimos oficiais plausíveis (69871 *Bacelar*, civil "João Carlos Bacelar Batista"; 141458 *João Carlos Bacelar*) e nenhuma evidência oficial que decida entre eles.
3. API da Câmara intermitente em `/historico` (ver seção 3). A coleta lista os ids sem histórico; ausência de exercício por causa disso nunca vira CONFLICT que rebaixe uma linha já positiva.
4. O exercício da Câmara usado pela identidade é derivado dos eventos (`deriveChamberExercises`), diferente do parser genérico, que descarta o estado em eventos simultâneos e criaria lacunas falsas (10 casos medidos em 8.764 código-anos).
5. A janela de autoria (ago–dez do ano anterior) é regra empírica (3.047 de 3.056 código-anos na investigação); fica parametrizada em `authoringWindow`.
6. Município: o Transferegov não traz código IBGE; `ibge_code` dos planos fica NULL. O Portal só informa IBGE por emenda quando a localidade é única (981 códigos distintos; "Sem informação" na maioria). Mapa por município exige tabela geográfica validada à parte.
7. "Pago" = pagamento/ordem bancária; nunca execução física. Pago por plano só é confiável de 2023 em diante.
8. A unificação Câmara↔Senado da mesma pessoa continua em `identity_links` como candidata; perfis de quem trocou de Casa só somam os dois códigos depois da confirmação.

## Fechamento de identidade para publicação

Fechamento operacional de 2026-10-06. Sem alteração de schema financeiro, de collectors ou de read models; nenhuma tela. Regra automática intacta: "revisão humana" aqui é a conferência individual das evidências oficiais já persistidas (`scripts/pix-review-high.ts`), com registro em `evidence_source.humanReview`.

### 1270 — João Carlos Bacelar (decisão de produto)

`author_code='1270'` **permanece** `confidence=AMBIGUOUS`, `person_id=NULL`, `reviewed=false`. Os dois candidatos oficiais (`camara:69871` *Bacelar*, civil "João Carlos Bacelar Batista"; `camara:141458` *João Carlos Bacelar*, civil "João Carlos Paolilo Bacelar Filho") não se distinguem por nenhuma evidência oficial e nenhum foi escolhido. Os 69 planos / R$ 105,3 mi desse código existem normalmente nos read models, sem autor atribuído (`pixAmendmentDetail` devolve `author.attributed=false`, `reason='unresolved:AMBIGUOUS'`). A futura UI deve rotular: **"Autor ainda não vinculado ao cadastro do Cívica"**.

### 4454 — Rafael Simões

Resolvido: `scripts/pix-resolve-code.ts 4454 220626` buscou o histórico oficial do deputado 220626 e a regra determinística deu **EXACT** (nome exato "Rafael Simoes", UF MG, exercício oficial 2023-02-01 em diante cobre 2024–2026, candidato único); persistido com `reviewed=true`, `person_id=c7566693-2ba0-4aff-9eec-2986b2bd57d3`. A resolução usou como roster de apoio o lote histórico já persistido (850 pessoas) mais o deputado recém-buscado.

**Causa da "intermitência" (achado):** a API da Câmara devolve `/deputados/{id}/historico` com `dados: []` de forma sistemática para alguns ids (220626, 141458, 74043 observados) quando a requisição envia `Accept: application/json`; com `Accept: */*` responde com dados na grande maioria das vezes. O collector de identidade (`OfficialHttp`) envia `Accept: application/json`. Não foi alterado nesta etapa (instrução); o script de re-resolução usa `Accept: */*`. **Recomendação:** trocar o `Accept` nas requisições de histórico da Câmara na próxima manutenção do collector.

### 14 HIGH — revisão individual

Condições de confirmação, conferidas código a código: (1) nome oficial exato; (2) uma única pessoa plausível no roster completo da coleta; (3) exercício oficial compatível em todos os anos do código (janela de autoria ou ano da emenda); (4) nenhuma pessoa concorrente compatível (o resolvedor teria devolvido AMBIGUOUS). UF divergente ou ausente não invalida a identidade (a UF da emenda é a localidade de aplicação). Grupos: 9 "exercício só no ano da emenda" (suplentes que assumem em 2021: o código SIOP pertence à pessoa e os anos seguintes caem na janela), 3 "UF divergente" (deputados do DF com emendas para outros estados), 2 "UF ausente". Nenhum dos 14 depende de `identity_link` Câmara↔Senado (as 35 candidaturas ficam como frente separada).

Os 14 foram **CONFIRM**; `confidence` continua `HIGH` (HIGH + `reviewed=true` = match seguro após revisão humana).

| author_code | nome | classe | decisão | person_id | evidência oficial | reviewed |
|---|---|---|---|---|---|---|
| 1418 | Neucimar Fraga | HIGH (exercício só no ano da emenda) | **CONFIRM** | `8ca53be1-6d65-4f06-b64d-e783745a27fe` | camara:74165 (NEUCIMAR FERREIRA FRAGA, ES); nome oficial exato; candidato único no roster completo; exercício: 2021-01-01..2023-01-31; anos 2021/2022/2023; sem concorrente; sem dependência de identity_link. | true (human) |
| 1984 | Onyx Lorenzoni | HIGH (exercício só no ano da emenda) | **CONFIRM** | `f11550b2-fb1f-4b85-a2c4-99e9fd6bf764` | camara:74399 (ONYX DORNELLES LORENZONI, RS); nome oficial exato; candidato único no roster completo; exercício: 2021-02-26..2021-03-03; 2021-11-11..2021-11-22; 2022-03-31..2023-01-31; anos 2021/2022/2023; sem concorrente; sem dependência de identity_link. **Nota:** titular licenciado (ministro) na maior parte de 2021–2022; o código SIOP é dele, mas o exercício é pontual. | true (human) |
| 2018 | Aelton Freitas | HIGH (exercício só no ano da emenda) | **CONFIRM** | `87047acf-cf67-4746-930f-83cfa60d2d24` | camara:141372 (AELTON JOSÉ DE FREITAS, MG); nome oficial exato; candidato único no roster completo; exercício: 2021-01-01..2023-01-31; anos 2021/2022/2023; sem concorrente; sem dependência de identity_link. | true (human) |
| 3568 | Paulo Magalhães | HIGH (exercício só no ano da emenda) | **CONFIRM** | `7a9bbe26-07dc-46b8-91a7-3e95a98d6546` | camara:74574 (PAULO SÉRGIO PARANHOS DE MAGALHÃES, BA); nome oficial exato; candidato único no roster completo; exercício: 2022-05-02..2022-11-09; 2023-01-03..2023-01-05; 2023-02-01..aberto; anos 2021/2022/2024/2025/2026; sem concorrente; sem dependência de identity_link. | true (human) |
| 3630 | Alberto Fraga | HIGH (UF da emenda ausente) | **CONFIRM** | `2a62396a-aecd-4244-9a65-c6d7a9012c79` | camara:73579 (JOÃO ALBERTO FRAGA SILVA, DF); nome oficial exato; candidato único no roster completo; exercício: 2023-02-01..aberto; anos 2026; sem concorrente; sem dependência de identity_link. | true (human) |
| 3740 | Pedro Vilela | HIGH (exercício só no ano da emenda) | **CONFIRM** | `161a2940-ada7-46c5-bb20-ae303f398ee7` | camara:178844 (PEDRO TORRES BRANDÃO VILELA, AL); nome oficial exato; candidato único no roster completo; exercício: 2021-01-01..2023-01-31; anos 2021; sem concorrente; sem dependência de identity_link. | true (human) |
| 3919 | Bia Kicis | HIGH (UF da emenda ≠ UF do parlamentar) | **CONFIRM** | `abfba305-6005-4c33-aa75-ff372a89ee19` | camara:204374 (BEATRIZ KICIS TORRENTS DE SORDI, DF); nome oficial exato; candidato único no roster completo; exercício: 2019-02-01..2023-01-31; 2023-02-01..aberto; anos 2024; sem concorrente; sem dependência de identity_link. | true (human) |
| 4190 | Joseildo Ramos | HIGH (exercício só no ano da emenda) | **CONFIRM** | `b533c0dd-8590-486b-ad27-fe8e83915af4` | camara:209189 (JOSEILDO RIBEIRO RAMOS, BA); nome oficial exato; candidato único no roster completo; exercício: 2019-03-13..2019-10-22; 2021-09-17..2023-01-31; 2023-02-01..aberto; anos 2021/2022/2023/2024/2025/2026; sem concorrente; sem dependência de identity_link. | true (human) |
| 4212 | Josivaldo JP | HIGH (exercício só no ano da emenda) | **CONFIRM** | `d6b246cf-899c-467d-b7ca-8f8a1365e711` | camara:215043 (JOSIVALDO DOS SANTOS MELO, MA); nome oficial exato; candidato único no roster completo; exercício: 2021-01-01..2023-01-31; 2023-02-01..aberto; anos 2021/2022/2023/2024/2025/2026; sem concorrente; sem dependência de identity_link. | true (human) |
| 4214 | Pedro Augusto Palareti | HIGH (exercício só no ano da emenda) | **CONFIRM** | `2ee3a61d-db72-46f6-9586-000bbae10b44` | camara:215045 (PEDRO AUGUSTO PALARETI, RJ); nome oficial exato; candidato único no roster completo; exercício: 2021-01-01..2023-01-31; anos 2021/2022/2023; sem concorrente; sem dependência de identity_link. | true (human) |
| 4215 | Vivi Reis | HIGH (exercício só no ano da emenda) | **CONFIRM** | `afa86cef-a472-4cc3-9f5e-a057f5787aa9` | camara:215044 (VIVIANE DA COSTA REIS, PA); nome oficial exato; candidato único no roster completo; exercício: 2021-01-01..2023-01-31; anos 2021/2022/2023; sem concorrente; sem dependência de identity_link. | true (human) |
| 4289 | Delegado Bruno Lima | HIGH (UF da emenda ausente) | **CONFIRM** | `a75e1c07-0d36-42d6-a59b-4fbcdbd412b6` | camara:220642 (BRUNO MARCELLO DE OLIVEIRA LIMA, SP); nome oficial exato; candidato único no roster completo; exercício: 2023-08-03..2023-08-04; 2024-03-22..2024-03-25; 2024-08-01..aberto; anos 2025; sem concorrente; sem dependência de identity_link. | true (human) |
| 4385 | Gilvan Maximo | HIGH (UF da emenda ≠ UF do parlamentar) | **CONFIRM** | `6395a186-53b6-4bb2-a299-f404d58a66c5` | camara:220531 (GILVAM MAXIMO, DF); nome oficial exato; candidato único no roster completo; exercício: 2023-02-01..2025-07-30; anos 2024; sem concorrente; sem dependência de identity_link. | true (human) |
| 9103 | Luis Miranda | HIGH (UF da emenda ≠ UF do parlamentar) | **CONFIRM** | `c9e3badc-7111-4045-a433-c3480637eae2` | camara:204381 (LUIS CLAUDIO FERNANDES MIRANDA, DF); nome oficial exato; candidato único no roster completo; exercício: 2019-02-01..2023-01-31; anos 2023; sem concorrente; sem dependência de identity_link. | true (human) |

### Estado final do crosswalk

| author_code | nome | classe | decisão | person_id | evidence | reviewed |
|---|---|---|---|---|---|---|
| 807 códigos | — | EXACT | regra determinística | preenchido | nome exato + exercício datado + UF | true (rule) |
| 14 códigos | (tabela acima) | HIGH | CONFIRM | preenchido | revisão individual | true (human) |
| 4454 | Rafael Simões | EXACT | resolvido (histórico oficial) | `c7566693-2ba0-4aff-9eec-2986b2bd57d3` | exercício 2023-02-01 em diante | true (rule) |
| 1270 | João Carlos Bacelar | AMBIGUOUS | mantido (decisão de produto) | NULL | candidatos `camara:69871` e `camara:141458`, sem evidência de desempate | false |

(Os 807 EXACT incluem o 4454; a linha própria só destaca o caso. Total: 807 EXACT + 14 HIGH + 1 AMBIGUOUS = 822.)

### Cobertura de atribuição (`PROFILE_PIX_VALUE_COVERAGE`)

| | Valor atribuível | % | Não atribuído |
|---|---:|---:|---:|
| Antes (início desta tarefa) | R$ 36.369.944.147,57 | 98,66% | R$ 494.589.592,53 |
| Após resolver 4454 | R$ 36.418.063.159,65 | 98,79% | R$ 446.470.580,45 |
| **Depois dos 14 HIGH** | **R$ 36.759.189.200,98** | **99,71%** | **R$ 105.344.539,12** (só o 1270) |

Depois: **821 de 822 códigos** com autor atribuível; **5.152 de 5.159 emendas** (99,86%); **57.758 de 57.827 planos** (99,88%). Por Casa: Câmara 723 códigos / R$ 29,37 bi; Senado 98 códigos / R$ 7,39 bi (a Câmara cresceu de 708 → 723 códigos). Por ano (valor atribuível): 2020 98,72% · 2021 99,60% · 2022 99,75% · 2023 99,77% · 2024 99,78% · 2025 99,69% · 2026 99,71%.

### Testes do fechamento

`pix-real-data.test.ts`: 1270 AMBIGUOUS sem pessoa; só linhas revisadas atribuem (nenhum AMBIGUOUS/CONFLICT/não revisado em `reviewed_amendment_authors`); todo HIGH revisado carrega `humanReview.decision='CONFIRM'` e aparece; 4454 só atribui se EXACT. `pix-identity-db.test.ts`: revisão humana positiva sobrevive a nova execução mesmo quando a resolução automática piora para CONFLICT (linha intacta). `pix-budget-db.test.ts`: CONFLICT/AMBIGUOUS nunca atribuem. EXACT inalterado (807).

### Gate

**PIX_IDENTITY_PUBLICATION = PASS_WITH_CAVEATS** — 99,71% do valor atribuível a perfis com crosswalk revisado, nenhuma atribuição por heurística. Caveats: (1) 1270 (R$ 105,3 mi, 0,29%) fica "autor ainda não vinculado" por decisão de produto; (2) os 35 `identity_links` Câmara↔Senado seguem `candidate`, então perfis de quem trocou de Casa só mostram o código da própria Casa até a confirmação; (3) a identidade depende de roster por nome oficial — reexecutar `identity` a cada nova legislatura; (4) o `Accept: application/json` do collector provoca históricos vazios da Câmara (correção pendente).

## Integração no perfil parlamentar

Seção "Emendas Pix" adicionada, **sem redesenhar nada**, à aba de atuação do perfil: `/legislativo/deputados/{id}/atuacao-parlamentar` e `/legislativo/senadores/{id}/atuacao-parlamentar`. O pedido citava `/{id}/atividade-parlamentar`; a rota real é essa, a aba "Atuação parlamentar" do `ParliamentarianProfilePage` (slug `activity` internamente).

### Onde entrou e por quê

Entre "Onde atua?" (comissões e cargos) e "Como votou?". A aba conta o que o parlamentar *faz*: participação → produção legislativa → onde atua → (**como direcionou recursos**) → como votou. Emenda Pix é uma forma de atuação com consequência territorial concreta; vem depois do que propõe e de onde se senta, e antes dos votos, sem deslocar nem interromper nenhuma seção existente. Nas demais rotas (visão geral, gastos, carreira) a seção segue oculta pelo mesmo mecanismo de CSS por rota, e nem é consultada.

### Reuso e componentes novos

Reutilizados, sem alteração: `SectionHeader`, `FinancialLadder` (escada financeira do dossiê de fornecedor: destinado → empenhado → liquidado → pago), `RankedBars`, `StackedBarChart`, `GroupedBarChart`, `DataTable` (cartões no mobile, paginação por URL), `EmptyState`, `CoverageBadge`; classes `card-elevated`, `eyebrow`, `display-title`; as "chips" do `RelationshipFingerprint` e o padrão "pergunta + frase + gráfico" do dossiê de fornecedor.

Novos (inevitáveis): `components/pix-profile-section.tsx` (composição, componente de servidor), `lib/pix-profile-model.ts` (modelo de apresentação puro: moeda, proporções, frases, rótulos de beneficiário, paginação, estados vazios) e `lib/data-postgres-pix.ts` (função de dados com diagnóstico de vazio).

Alterações em arquivos existentes, todas aditivas: `parliamentarian-profile-page.tsx` (prop `pixPage`, consulta só na rota `activity`, inserção da seção), as duas páginas `atuacao-parlamentar` (parâmetro `paginaEmendas`), `globals.css` (a regra de visibilidade por rota inclui `#emendas-pix`), `lib/data.ts` e `lib/data-postgres.ts` (fachada com o cache TTL de 120 s que as demais leituras já usam).

### Estrutura narrativa e dados por bloco

| Bloco | Pergunta | Dados (do `parliamentarianPixSummary`) |
|---|---|---|
| Abertura | "Como este parlamentar direcionou recursos por meio de Emendas Pix?" | título e descrição editorial |
| Resumo | Quanto destinou? Quanto foi pago? | `financials.destinedAmount` (número principal), `paidAmount` e % do destinado ("pagos/transferidos", nunca "executado"), `counts` (emendas, planos, beneficiários, estados) e a escada destinado → empenhado → liquidado → pago |
| Para onde foi o dinheiro? | Quem recebeu? | `topBeneficiaries` (8 maiores, com tipo de ente e UF; nome do município com acento pelo CNPJ via Portal) e `byUf`; frase de concentração dos 5 maiores; sem mapa (IBGE incompleto) |
| Para quê? | Em que políticas concentrou? | `byFunction.exclusiveDestinedAmount` (valor só de planos de **uma** função) + `functionCoverage` (planos multiárea contados à parte, nunca repartidos) |
| Custeio ou investimento? | — | `byExpenseKind` (barra empilhada e percentuais) |
| Como isso evoluiu? | — | `byYear` (destinado × pago por ano da emenda; ano corrente marcado "em andamento"; pago = acumulado até hoje) |
| Quais emendas formam esse total? | O concreto | `amendments`: ano, código, destinado, pago (% do destinado), planos e beneficiários, principal destino, planos impedidos; paginação de 10 em 10 por `paginaEmendas`; frase sobre a maior emenda ("dividida em 96 planos para 71 beneficiários; a emenda é o agrupador, o plano de ação é o destino") |
| Nota | Como ler | `notes` do read model (pago ≠ obra concluída; executado pelo ente é parcial; 2020–2022 pago só por emenda), códigos SIOP com Casa e anos, fontes e data da coleta |

### Extensões aditivas do read model

`parliamentarianPixSummary` ganhou campos novos (nenhum removido ou renomeado): `byFunction[].exclusivePlans/exclusiveDestinedAmount`, `functionCoverage`, `byUf`, `topBeneficiaries[].enteType/municipalityName`, `amendments[].beneficiaries/impededPlans/topBeneficiary`, `run`. Tudo sai da mesma chamada. As consultas adicionais são agregações sobre os planos já carregados, mais uma busca de nomes de município por CNPJ limitada aos ~10 a 20 beneficiários exibidos.

### Dados e identidade

Única chamada de dados do bloco: `parliamentarianPixSummary(db, personId)`, via `parliamentarianPixWith`. O web só traduz (Casa, id oficial) → `person_id` por `civica.external_identifiers`. Não existe casamento por nome, uso de `proposal_authors` nem lógica de crosswalk no web (verificado por teste estático). HIGH não revisado, AMBIGUOUS, CONFLICT e UNMATCHED nunca aparecem como do parlamentar.

### Estados vazios

- `none`: "Sem Emendas Pix atribuídas". Não afirma que o parlamentar não indicou recursos; só que não há autoria revisada.
- `pending_authorship`: existe linha do crosswalk **desta pessoa** ainda não revisada ("Autoria ainda em revisão").
- `no_mandate_in_period`: o mandato não se sobrepõe a 2020–2026.
- `unavailable`: coleta não publicada ou falha de consulta. A seção mostra um aviso e o perfil segue intacto (a consulta nunca lança).

Não há "R$ 0 destinados" fingindo informação: o vazio explica a ausência.

### Performance

Uma chamada ao read model, em paralelo ao carregamento do perfil (a promessa nasce antes do `getProfile`), com o cache TTL de 120 s do projeto, e só na rota `activity`. Leitura do resumo: 16 a 172 ms frio (45 ms num deputado com 396 planos). Páginas medidas no servidor de desenvolvimento (ruidoso): em perfis de resposta rápida, 0,12 a 0,20 s sem a seção (rota de gastos) contra 0,14 a 0,18 s com a seção fria e 0,13 a 0,19 s quente; acréscimo ≲ 40 ms frio e ≈ 0 em cache quente. Nos perfis pesados a rota de atuação já carrega votos e comissões (2 a 3 s em dev) e o Pix corre em paralelo a isso. Não há medição "antes" isolada porque a seção nunca existiu sem a chamada; os números acima comparam rotas e cache.

### Validação com perfis reais (`scripts/pix-profile-check.ts`)

| Perfil | Casa/id | Códigos | Emendas | Planos | Beneficiários | Destinado | Pago |
|---|---|---|---:|---:|---:|---:|---:|
| Muitos (senador) | senado/1186 Heinze | 4184 | 7 | 412 | 233 | R$ 150,76 mi | R$ 123,33 mi |
| Muitos (deputado) | camara/204494 Fred Costa | 3991 | 11 | 396 | 133 | R$ 90,14 mi | R$ 70,19 mi |
| Poucos | camara/178937 Altineu Côrtes | 3042 | 1 | 1 | 1 | R$ 1,00 mi | R$ 1,00 mi |
| HIGH confirmado | camara/204374 Bia Kicis | 3919 | 1 | 1 | 1 | R$ 0,15 mi | R$ 0,15 mi |
| Trocou de Casa (Senado) | senado/4642 Efraim Filho | 4270 | 3 | 116 | 63 | R$ 73,35 mi | R$ 63,37 mi |
| Trocou de Casa (Câmara) | camara/141422 Efraim Filho | 2449 | 4 | 51 | 44 | R$ 24,90 mi | R$ 21,43 mi |
| Sem Pix | senado/1173 Wellington Fagundes | — | estado vazio `none` | | | | |

Em todos: contagens e valores do resumo = SQL direto sobre a view revisada; soma das emendas = soma por ano = soma custeio+investimento = soma por UF = destinado; pago = soma do Portal; nenhuma emenda de outro código nem sem revisão. Capturas desktop (1360 px) e mobile (390 px) das cinco variações: sem overflow horizontal, com cartões no mobile para a tabela. Nenhuma pessoa tem hoje dois códigos revisados na mesma pessoa; o caso "mais de um `author_code`" é coberto por teste com `identity_link` confirmado.

### Testes

`tests/unit/pix-profile.test.ts` (7 testes): perfil sem Pix não quebra; autoria em revisão explica o vazio; só `reviewed=true` entra e nada de outro parlamentar nem de AMBIGUOUS; totais de destinado, pago, emendas, planos, beneficiários e UFs; agrupamento anual; custeio × investimento; beneficiários e nomes; valor por função só em planos de área única; pessoa com dois `author_code` (candidato não une, confirmado une); pago ≠ executado pelo ente; estrutura (consulta só na rota de atuação, web sem lógica de identidade). Suíte Pix inteira: 44 testes.

### Caveats

1. Beneficiário ≠ município: o plano pode ir a município, estado ou outra instituição; o rótulo diz o tipo. Sem mapa: `ibge_code` segue NULL.
2. Nomes de município vêm do Portal por CNPJ (com acento); quando o Portal não os informa, o nome da fonte (sem acentos) é exibido.
3. Valor por área só existe para planos de uma única função (≈ 69% do valor global); os planos multiárea aparecem à parte, sem repartição.
4. "Pago" por ano é o acumulado até hoje das emendas daquele ano.
5. A tabela de emendas ainda não tem destino de clique (não existe `/emendas/{codigo}`); o código é exibido como texto e o CTA fica documentado para a próxima etapa.
6. Perfis de quem trocou de Casa mostram só o código da Casa da rota enquanto o `identity_link` Câmara↔Senado estiver `candidate`.
7. Não foi rodado `next build` de produção; verificação por `tsc`, renderização SSR real e capturas de tela em servidor de desenvolvimento.

**PIX_PROFILE_UI = PASS_WITH_CAVEATS**
