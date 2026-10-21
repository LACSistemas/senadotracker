# Investigação do backend territorial atual

Data: 2026-10-19 · Escopo: leitura do repositório e do PostgreSQL local (`projetoeleitor_db`), sem escrita (exceto a correção operacional da seção 9.1, autorizada). Nada foi implementado.

## 1. Resumo (revisão 2)

1. **Escopo corrigido.** Existem **duas** experiências "por estado" no Cívica, ambas do Poder **Legislativo**: (a) **`/quem-me-representa`** — a navegação territorial do produto (cabeçalho e mapa "Estados"): senadores e deputados **federais** por UF, com `?uf=` e `?casa=` (seção 2A); (b) **`/legislativo/estaduais/[house]/…`** — as Assembleias Legislativas (seção 2). A versão anterior só descrevia (b). Nenhuma das duas é executiva e **não existe página municipal**.
2. **Não existe identidade territorial reutilizável no banco**: a UF é texto (`civica.profiles.uf`), validada por um conjunto fixo (`ufs`, `packages/domain`); os nomes das UFs estão embutidos em `page.tsx`; município só aparece como coluna de texto em emendas. O que se reaproveita é a *navegação* (mapa, seletor, `?uf=`), não uma dimensão de dados.
3. **`civica_state` não é uma estrutura genérica de estados.** São 50 tabelas, 10,89 GiB, com os dados das 27 Assembleias. Todas as tabelas de fato carregam `revision_id` e `house` na chave primária; a publicação é um ponteiro (`active_publications`).
4. **O padrão de publicação é reaproveitável** (ponteiro ativo por `house × domain`, portões de `publication-lifecycle.ts`, read model `civica_state_story.house_story`). O **desenho físico não é** para dados nacionais de Saúde: repetir `revision_id` textual na chave multiplica as linhas por ~2 (proposições: 2.135.609 linhas, 1.058.455 ativas) e gera índices de 260–510 B por linha. Há **três** padrões de publicação hoje (`civica`, `civica_state`, `civica_state_budget`).
5. **O PostgreSQL não tem nenhuma tabela particionada** (216 tabelas após a remoção da tabela corrompida; 0 partições). Nem a maior tabela (2,37 mi de linhas) justificou particionar.

## 2. Assembleias Legislativas: rotas, componentes, loaders e queries

Todas as rotas abaixo são `force-dynamic` e leem o pool compartilhado `webPostgresPool()` (`apps/web/lib/postgres-pool.ts`, `max=10`).

| URL | Componente | Função de carregamento | Query / tabela ou view | Origem dos dados |
|---|---|---|---|---|
| `/legislativo/estaduais` | `app/legislativo/estaduais/page.tsx` → `StateLegislatureLanding` | `getStateLegislatureOverview(pool)` (`packages/db/src/postgres-national-analytics.ts:154`) + `readStateHouseGlances(pool)` | 5 consultas em paralelo: `civica_national.current_legislators_analytics` (view; total, por Casa, por partido, partidos sem resolução) e `civica_national.domain_capabilities`; glances de `civica_state_story.house_story` | Rosters e capacidades publicados por Casa |
| `/legislativo/estaduais/[house]/deputados` | `StateHousePage` (`components/state-house-page.tsx`) | `listStateLegislators(house)` + `getStateHouseStory(house)` (`lib/state-product.ts`, `lib/state-house-story.ts`) | `civica_state.current_state_parliamentarians` com `LATERAL` em `state_profile_metadata` e `party_memberships`; `house_story` (2 consultas pequenas) | Roster corrente + agregados pré-calculados; filtro, ordenação e paginação são feitos em JS |
| `/legislativo/estaduais/[house]/deputados/[id]` | `page.tsx` + `StateProfileStory`/`DomainCoverageGrid` | `getCachedStateProfile` (React `cache`) + `getStateLegislatorActivity` + `getStateHouseStory` | `profileRow`; `active_publications`; `state_office_active_publications`; `civica_state_budget.active_publications`; `proposals`/`proposal_authors` (`loadStateActivity`); `state_proposal_events` | Cobertura por domínio via revisão ativa |
| `…/[id]/atuacao-parlamentar` | `page.tsx` | `getStateLegislatorProfile` + `getStateLegislatorActivity` | idem | idem |
| `…/[id]/gastos-equipe` | `page.tsx` | `getStateLegislatorFinance` + `getStateLegislatorPersonnel` | `civica_state.expenses` (filtro `house, revision_id, person_external_id`), `state_office_staff_snapshots`, `state_office_payroll_snapshots` | Despesas parlamentares e gabinete |
| `…/[id]/carreira-politica` | `page.tsx` | `getStateLegislatorProfile` | só cobertura (`domains`) | — |
| `/legislativo/estaduais/[house]/proposicoes/[proposalId]` | `page.tsx` | `getStateProposalTimeline` (`lib/state-proposal-timeline.ts`) | `proposals`, `state_proposal_events`, `state_deliberations` | Tramitação por Casa |
| `GET /api/estaduais/[house]/parlamentares/[id]/{perfil,finance,pessoal,atividade}` | `route.ts` × 4 | `getStateLegislator{Profile,Finance,Personnel,Activity}` | as mesmas funções das páginas | Contratos JSON com `ProductCoverage` |

**Camadas.** (a) *Pages/Server Components* → (b) `lib/state-*.ts` (view models e validação: `STATE_HOUSES` com as 27 siglas, `guard()` que compara `current_database()`) → (c) `packages/db/src/*` (repositórios SQL tipados) → (d) PostgreSQL. Não há ORM; SQL parametrizado à mão.

**Cache e SSR.** Não há `unstable_cache`, ISR nem materialized views. O desempenho vem de: (i) `civica_state_story.house_story` — agregados por Casa em JSONB (`house, section, source_key, built_at, payload`; 76 linhas, ~0 MB); (ii) React `cache()` para deduplicar consultas dentro do request; (iii) `after()` do Next para reconciliar o story *depois* de responder quando `source_key` está defasado (trava consultiva evita recálculo duplicado). O custo é `guard()` (`SELECT current_database()`) em quase toda função e várias consultas sequenciais por perfil.

**Índices usados.** Chaves primárias começando por `(revision_id, house, …)` ou `(house, domain)`; `state_proposals_revision_year_external_idx`, `state_proposal_authors_person_revision_idx`. O planejador usa `expenses_pkey` com condição `(revision_id = a.revision_id) AND (house = 'ES')`.

## 2A. `/quem-me-representa` — a experiência territorial existente (Legislativo federal por UF)

**Não é uma página do Executivo.** Mostra os senadores e deputados federais de uma UF, com métricas do Legislativo (cota, presença, votações, gabinete, proposições). Fica sob o `LegislativeSubnav` (item "Estados") e no cabeçalho global ("Estados"); o cartão da home diz "Por estado e cidade", mas a rota **não tem município**.

### Parâmetros (`apps/web/app/quem-me-representa/page.tsx`)

| Parâmetro | Significado | Validação | Efeito |
|---|---|---|---|
| `uf` | UF **de representação** dos parlamentares federais | `ufs.has(UF)`, conjunto fixo de 27 siglas em `packages/domain/src/index.ts` (inclui DF); inválido ⇒ modo mapa | com `uf`: painel da UF; sem `uf`: mapa coroplético |
| `casa` | Casa do Congresso: `senado` ou `camara` (padrão `camara`) | `=== 'senado'` senão `camara` | escolhe qual Casa colore o mapa e alimenta o painel; **as Casas nunca são somadas** |
| `metrica` | métrica do mapa: `expenseCents`, `presence`, `participation`, `staff`, `proposals` | `houseMetricKeys` ∩ `mapMetrics` | só no modo mapa |
| `comparar` | segunda UF para comparação | `ufs.has` | tabela de comparação |
| `assunto` | filtro textual de temas | `searchText` | filtra `topics` |
| `paginaDeputados` | página da lista (15 por página) | inteiro positivo | paginação em JS |

### Fluxo reconstruído

| Etapa | Modo mapa (`/quem-me-representa?casa=camara`) | Modo UF (`?uf=MS&casa=camara`) |
|---|---|---|
| Componente | `page.tsx` → `StateChoroplethMap` (ou `BrazilStateMap`) | `page.tsx` → tabelas `DataTable`, `StateComparison`, `HouseCabinet` |
| Loader | `houseMetricSummary(house)` (`lib/data.ts` → `data-postgres-wave2.ts`) | `stateRepresentation(uf, compareUf)` (`lib/data.ts` → `data-postgres-wave4.ts:758`) |
| Cache | `call()` em `lib/data.ts`: Map em memória por processo, TTL **120 s** (`DATA_CACHE_TTL_MS`), 500 entradas, deduplica promessas em voo; a página é `force-dynamic` | idem |
| SQL | `civica_people_poc.profiles` (por `source`); `civica_finance_poc.expenses` ⋈ `civica_finance_poc.active_expense_publications`; `civica_votes_presence_poc.votes` ⋈ `deliberations` | `profiles()`: `civica.profiles` ⋈ `civica.active_publications` ⋈ `civica.publication_batches` (carrega **todos** os 594 perfis ativos, 513 Câmara + 81 Senado, e filtra `uf` em JS); `years()` em `civica.active_expense_publications`; `enrichProfiles` (`civica.expenses`, `civica_poc.proposal_authors`, votos/presença); gabinete do Senado em `civica.expanded_costs` ⋈ `active_expanded_cost_publications`; da Câmara em `civica.cabinet_monthly_budgets` ⋈ `active_cabinet_budget_publications`; lote do roster; `stateTopicSummary` (`civica_poc.proposal_authors`, `civica.legislative_complements`) |
| Agregação | em JS: `distribution()` (mín., p10…p90, máx.) por UF; quintis em `stateChoropleth` (`packages/db/src/benchmarks.ts`) | em JS: `summaryFor` por Casa |
| Índices | PKs; sem uso do filtro por UF | `profiles_filters (batch_id, uf, party, search_name)` **não é usado**: a consulta lê tudo (5,9 ms medidos, 2.553 linhas lidas, 594 ativas) |

Estrutura do resultado de `stateRepresentation`: `{ representation: { uf, year, summary: { uf, senators, deputies, representatives, byHouse: { senado, camara } }, senators[], deputies[], coverage: DataCoverage }, comparison[], topics[] }`, com `byHouse.<casa>` = `{ representatives, expenseCents, presence, participation, cabinet: { staff, financialCents, period, kind } }` (cada métrica é uma distribuição).

### Ligação entre representantes e UF e identidade territorial

* A UF vem de `civica.profiles.uf` (texto, copiado do payload do perfil); não há FK nem dimensão de UF. `states` (nomes) está **embutido em `page.tsx`**; `ufs` está em `packages/domain`; o desenho do mapa está em `components/brazil-map-markup.ts` com 27 links fixos `href="/quem-me-representa?uf=XX"` (fixados por `tests/unit/state-map.test.ts`).
* **Não existe identidade municipal reutilizável** (nem `municipio`, nem código IBGE) em `civica`, `civica_people_poc` ou nesta rota. Os únicos códigos IBGE são colunas de texto de emendas (`civica_budget`, `civica_state_budget.destinations`).
* O mapa usa schemas `*_poc`, o painel usa `civica`: duas fontes de verdade para o "mesmo" número; a divergência não foi auditada aqui.
* `DataCoverage` (`availability`, `source`, `period`, `batchId`, `note`, `sampleSize`) é o contrato de cobertura desta rota; `ProductCoverage` (`state`, `reason`, `dataThrough`…) é o das Assembleias. **Serão necessários dois adaptadores** para a Saúde.

### Outras rotas territoriais (inventário)

| Rota | Parâmetro territorial | Observação |
|---|---|---|
| `/quem-me-representa` | `uf`, `comparar` | acima |
| `/legislativo` | `uf` | filtro da lista de parlamentares |
| `/legislativo/partidos/[party]` | `uf` | filtro dentro do partido |
| `/legislativo/rankings`, `/legislativo/rankings/dimensoes` | `uf` (via `queryHref`) | ranking por UF e por partido |
| `/legislativo/patrimonio` | `uf` | filtro |
| `/comparar` | `uf` / `ufs` | comparação entre UFs |
| `/legislativo/estaduais`, `/legislativo/estaduais/[house]/**` | `[house]` = UF da Assembleia | Legislativo estadual (seção 2) |
| Cabeçalho, home, `/legislativo` (cartão "Estados") | link para `/quem-me-representa` | entrada da navegação territorial |

Nenhuma rota usa município.

### O que pode ser reutilizado e o que deve continuar separado

| Reutilizar na camada territorial e na navegação | Manter separado |
|---|---|
| Conjunto `ufs` e nomes → semear `exec_entity` (kind 3) e corrigir a duplicação dos nomes em `page.tsx` na fase de integração | `casa` (Senado/Câmara) e todo o `summary.byHouse`: são Legislativo |
| Mapa coroplético com callback `href(uf)` (`StateChoroplethMap`) | `LegislativeSubnav`: a seção do Executivo não entra nele |
| `StateSelector` (formulário `GET ?uf=`), `Pills`, `InstitutionHero`, `KpiGrid`, `DataTable`, `CoverageBadge` | Métricas de parlamentares: nunca somadas a indicadores de Saúde |
| Chave de junção `profiles.uf` ≡ `exec_entity.uf` | Schemas `civica*`: sem FKs para `civica_exec` |

Navegação futura proposta (sem alterar a rota agora): `/quem-me-representa` → `?uf=XX` → painel da UF existente (Legislativo) → **bloco novo "Poder Executivo · Saúde"** alimentado por `exec_story`/`exec_ind_latest` da UF (consultas Q1 e Q4) com link para `/executivo/estados/XX/saude` e, a partir daí, para municípios. O bloco não lê `casa`, vive fora de `summary.byHouse` e é rotulado como Executivo.

### Três padrões de publicação coexistem

`civica` (`publication_batches` + `active_publications` por `source`), `civica_state` (`revision_id` + `active_publications(house, domain)`) e `civica_state_budget` (`revisions`). `civica_exec` seria o quarto: justificado porque os fatos nacionais de Saúde não podem pagar `revision_id` por linha (seção 4), mas a regra "um ponteiro ativo + portões de reconciliação" é a mesma.

## 3. Páginas municipais: inexistentes

Nada em `apps/web/app` ou `components` trata município (única menção: `pix-profile-section.tsx`, emendas Pix). O que pode ser reaproveitado das páginas estaduais:

| Reuso | Fonte |
|---|---|
| Validação de UF por lista fixa e `ProductCoverage` (`AVAILABLE`, `PARTIAL`, `UPSTREAM_BLOCKER`…) com `dataThrough`, `lastSuccessfulCollection`, `revisionId` | `lib/state-product.ts` |
| Padrão "read model + checagem de frescor + reconciliação em `after()`" | `lib/state-house-story.ts` |
| Mapa do Brasil e coroplético por UF | `components/brazil-state-map.tsx`, `state-choropleth-map.tsx` |
| Componentes de dados (`DataTable`, `KpiGrid`, `CoverageBadge`) | `components/*` |

O que falta: identificar o município (código IBGE de 7 dígitos na URL, com 6 dígitos aceito), a relação UF → municípios (`exec_entity.parent_id`), e consultar vários domínios em **uma** consulta por entidade (ver `contratos_consulta_estado_municipio.md`). Os contratos de frontend existentes (`StateProductProfile` etc.) **não precisam mudar**; a Saúde entra por rotas e módulos novos.

## 4. O schema `civica_state` (10,89 GiB, 50 tabelas)

Finalidade: **dados das Assembleias Legislativas e da Câmara Legislativa do DF**. Chave comum: `house` = sigla da UF. `civica_national.houses` lista 29 casas (27 ALs/CLDF + CAMARA + SENADO) com `uf`.

| Tabela | Linhas (est.) | Tabela MiB | Índices MiB | PK | Conteúdo |
|---|---:|---:|---:|---|---|
| `proposal_authors` | 2.369.783 | 1.390 | 1.148 | `(revision_id, house, provider, proposal_external_id, author_key)` | autoria por proposição |
| `raw_objects` | 66.421 | 2.509 | 17 | `raw_id` (+ `sha256` único) | **corpo bruto (HTTP/JSON/HTML) dentro do PostgreSQL**; 2,47 GiB em TOAST |
| `proposals` | 2.134.398 | 1.058 | 1.058 | `(revision_id, house, provider, external_id)` | proposições; SP concentra 1.985.796 (93%) |
| `movements` | 1.277.488 | 1.295 | 485 | uma chave composta | movimentações |
| `state_proposal_events` | 624.191 | 561 | 338 | 3 índices | tramitação |
| `expenses` | 425.000 | 613 | 133 | `(revision_id, house, provider, external_id)` | despesas parlamentares; SC concentra 286.756 (67%) |
| `state_individual_votes`, `state_office_*_snapshots`, `state_deliberations`, `state_attendance`, … | ≤ 231 mil | ≤ 166 | ≤ 79 | com `revision_id` | votos, gabinete, presença |
| `persons`, `mandates`, `party_memberships`, `identity_mappings`, `current_state_parliamentarians` | 0,9–5,7 mil | ≤ 4 | ≤ 1 | `(revision_id, house, …)` | identidade das pessoas (não de territórios) |
| `active_publications` | 102 | 0 | 0 | `(house, domain)` | ponteiro da revisão ativa (27 casas × 9 domínios) |
| `ingestion_revisions`, `public_domain_revisions`, `public_revision_contributions`, `ingestion_runs`, `coverage_manifests`, `operational_coverage`, `schema_migrations`… | 81–329 | 0 | 0 | — | proveniência, qualidade e migração |

**Função de `revision_id`.** Versão imutável de um conjunto de linhas de uma Casa × domínio. `PostgresRevisionRepository` grava (`stage`), valida e promove (`promoteRevisionAtomically`: `UPDATE … status='rejected'` na ativa anterior e `UPSERT` em `active_publications`). Efeito medido: `proposals` tem **76 revisões** e **2.135.609 linhas, das quais 1.058.455 pertencem à revisão ativa (49,6%)**; as demais são histórico preservado. `civica_state.expenses` indexa por `revision_id` textual, o que o plano diretor mediu como 260–510 B de índice por linha.

**Particionamento territorial.** Nenhum. A separação por Casa é lógica (coluna `house` na PK). Há forte assimetria (SP 93% das proposições; SC 67% das despesas), o que tornaria uma partição por UF desigual.

**Identidade municipal compartilhada.** Não existe. **Duplicação de identificadores:** `external_id` é textual e único só dentro de `(revision_id, house, provider)`; pessoas de ALs são ligadas a pessoas federais por `identity_mappings`/`civica.identity_links`, e `civica.external_identifiers` mapeia apenas Câmara (791) e Senado (125).

**Reutilizável pelo Executivo:** o *padrão* (ponteiro ativo, portões de reconciliação, advisory lock, `ingestion_runs`, scheduler em `civica_ops`, read model `*_story`), o contrato de cobertura e o catálogo de capacidades. **Não reutilizável:** o desenho físico com `revision_id` na PK de fatos volumosos e `raw_objects` no PostgreSQL.

## 5. Outros schemas relevantes

| Schema | Tabelas | GiB | Papel |
|---|---:|---:|---|
| `civica` | 59 | 1,68 | cópia migrada do SQLite (Câmara/Senado): despesas (484.664), proposições, votos, presença |
| `civica_votes_presence_poc`, `civica_finance_poc`, `civica_poc`, `civica_elections_poc`, `civica_committees_poc`, `civica_people_poc` | 70 | 2,06 | migração em prova (poc) |
| `civica_budget` / `civica_state_budget` | 13 / 9 | 0,17 / 0,13 | emendas federais e estaduais; este último com `revisions`, `active_publications`, `destinations(municipality_ibge_code)` |
| `civica_national` | 6 + 2 views | ~0 | `houses`, `metric_catalog` (11 métricas de legisladores), `metric_coverage`, `domain_capabilities`, `party_aliases`; views `current_legislators(_analytics)` |
| `civica_state_story` | 1 | ~0 | `house_story` (agregados JSONB por Casa) |
| `civica_ops` | 7 | ~0 | `scheduler_provider_state`, `scheduler_decisions`, `control_plane_runs`, `alert_events`, `cutover_migrations` |
| `civica_media` | 1 | ~0 | espelho de retratos |

`civica_national.metric_catalog` é lido sem filtro por `getNationalMetricCatalog` (`SELECT … FROM civica_national.metric_catalog ORDER BY metric_id`). **Por isso os indicadores de Saúde não devem ser inseridos nele**: apareceriam nas páginas legislativas. O vocabulário das colunas (`grain`, `unit`, `numerator`, `denominator`, `null_semantics`, `ranking_allowed`, `coverage_rule`) deve ser copiado para um catálogo próprio.

## 6. Fluxo atual de publicação

```
Provider (apps/collector/src/state/providers/<ales|alep|sapl|...>)
   │  CollectorProvider: fetch → validateSource → parse → canonicalize → validateCanonical
   ▼
raw_objects (sha256) ──► staging por lote (ingestion_revisions: house,provider,domain,run_id,batch_id)
   │  reconcileCandidate(): FAILED_SAFE se EMPTY | DUPLICATE_NATURAL_KEYS | CANDIDATE_SHRINK; NO_CHANGE se hash igual
   ▼
revisão imutável (revision_id = <escopo>:<sha256 semântico>) em tabelas de fato com revision_id na PK
   │  PostgresRevisionRepository.promoteRevisionAtomically(): transação única
   ▼
civica_state.active_publications(house, domain) → revision_id   [+ public_domain_revisions: status, quality]
   ▼
civica_state_story.reconcile (source_key = domínios=revisões) ─► house_story (JSONB)
   ▼
Next.js (force-dynamic): state-product.ts / state-house-story.ts → Server Components e /api/estaduais/**
```

Peças de controle: `CollectorRuntime` com lock por `(house, domain, provider)` (`InMemoryCollectorLock` e `postgres-advisory-lock.ts`), `core/control-plane/*` + `civica_ops.scheduler_*` (cadência, cooldown, falhas consecutivas), `schema-contract.ts` (`FAIL_CLOSED` em deriva de esquema).

### Matriz de arquivos, tabelas e dependências

| Camada | Arquivos reais | Tabelas/Schemas |
|---|---|---|
| Contrato de provider | `apps/collector/src/core/collector-provider.ts`, `collector-runtime.ts` | — |
| Publicação | `core/publication-lifecycle.ts`, `core/revision/revision-contract.ts`, `revision-repository.ts`, `state/persistence.ts` | `civica_state.active_publications`, `ingestion_revisions`, `public_domain_revisions` |
| Registro de capacidades | `core/registry/house-capability-registry.ts`, `national-finance-registry.ts` | `civica_national.domain_capabilities` |
| Agendamento | `core/control-plane/*`, `core/scheduler/*` | `civica_ops.scheduler_*` |
| Leitura | `packages/db/src/postgres-state-story.ts`, `postgres-national-analytics.ts`, `postgres-state-budget.ts`, `states.ts` | `civica_state_story.house_story`, `civica_national.*`, `civica_state_budget.*` |
| Web | `apps/web/lib/state-product.ts`, `state-house-story.ts`, `state-activity.ts`, `state-proposal-timeline.ts`, `postgres-pool.ts` | — |

## 7. Auditoria do PostgreSQL (somente leitura)

| Medida | Baseline documentado (13/10) | Medido hoje (19/10) |
|---|---:|---:|
| Tamanho do banco | 14,97 GiB | **14,95 GiB** |
| Tabelas | 216 | **216** |
| Linhas (reltuples) | 15,98 mi | **16,00 mi** |
| `civica_state` | ~11,7 GB (10,89 GiB) | **10,888 GiB** |
| Tabelas particionadas | — | **0** |

Configuração: PostgreSQL 17.4; `shared_buffers=1GB`, `effective_cache_size=4GB`, `work_mem=32MB`, `maintenance_work_mem=64MB`, `max_wal_size=1GB`, `wal_level=replica`, `random_page_cost=4`, `data_checksums=off`; extensões `pg_trgm`, `unaccent` (disponíveis e não instaladas: `btree_gist`, `pg_stat_statements`; PostGIS e `pg_partman` indisponíveis no servidor).

`EXPLAIN (ANALYZE)` de consultas leves de leitura em transação somente leitura (cache frio após reinício):

| Consulta | Plano | Tempo |
|---|---|---:|
| despesas do ES por pessoa (`expenses` ⋈ `active_publications`) | Index Scan `expenses_pkey`, 513 linhas, 46 buffers em cache + 486 lidos | **107,6 ms** |
| proposições SP 2026 na revisão ativa | Index Only Scan `state_proposals_revision_year_external_idx`, 18.906 linhas, 595 buffers | **48,9 ms** |

O planejador estimou 16 linhas (real 513) e 3.321 (real 18.906): **faltam estatísticas** (66 tabelas com `reltuples = -1`; as estatísticas foram zeradas pelo reinício depois do desligamento não limpo de 13/10). Recomendação (não executada): `ANALYZE` global e, depois, ativar `pg_stat_statements` para medir as consultas reais.

### Melhorias possíveis (nenhuma executada)

1. `ANALYZE` após o reinício; 2. `pg_stat_statements`; 3. mover `raw_objects` (2,5 GiB, 24% do banco) para object storage mantendo o `sha256` como ponteiro; 4. revisar índices de `proposal_authors` e `proposals` (≈2,4 GiB de índices; as contagens de uso estão zeradas e não permitem concluir nada); 5. `random_page_cost` mais baixo se o armazenamento for SSD; 6. habilitar checksums de dados na próxima recriação do cluster; 7. aumentar `max_wal_size` durante backfills.

### 7.1 Incidente operacional encontrado e corrigido nesta execução

Ao rodar a auditoria, 15.123 erros `xlog flush request … is not satisfied` apareceram no log do dia: o buffer da página corrompida (bloco 21955) da tabela `civica.expenses_corrupt` — a cópia danificada deixada por mim ao reconstruir `civica.expenses` — não podia ser gravado, e os checkpoints falhavam em loop. Com autorização, executei **somente** `DROP TABLE civica.expenses_corrupt` (a cópia boa `civica.expenses`, 484.664 linhas, havia sido validada). Às 18:32 o log registrou `checkpoint complete` e os erros cessaram.

## 8. Divergências em relação às fases anteriores

* A P8 afirma que a API de cobertura de APS devolve 5.570 de 5.571 municípios e "1 município novo sem linha". **Correção:** o município ausente é **Itati (RS, 4310652)**; Boa Esperança do Norte (510183) *está* na resposta. O erro está em `investigacao_executivo_p8_saude.md` (tabela da seção 18). Este plano não altera o arquivo anterior; a correção foi registrada em `results.json`.
* O plano diretor trata `civica_state` como padrão de armazenamento (`revision_id` textual na PK): vale para Casas legislativas; para o Executivo o plano já previa chaves inteiras (`civica_exec`), o que esta arquitetura confirma.


---

## Revisão 2 — correções que afetam este arquivo

| ID | Diagnóstico anterior | Evidência nova | Correção | Impacto na arquitetura | Impacto no armazenamento | Impacto no plano |
|---|---|---|---|---|---|---|
| **C01** Escopo da investigação de páginas | Investiguei `/legislativo/estaduais` (Assembleias Legislativas) como se fosse a experiência territorial do produto. | A experiência territorial existente é `/quem-me-representa` (`?uf=` e `?casa=`): Legislativo federal (Senado e Câmara) por UF. É a rota da navegação "Estados" (cabeçalho, mapa, cartão da home) e dela partem os 27 links do mapa (`/quem-me-representa?uf=XX`). Ela nada tem de executivo. | Nova seção 2A em `investigacao_backend_territorial_atual.md` com o fluxo URL → parâmetros → componentes → loader → SQL → tabelas, inventário de rotas territoriais e regras de separação Legislativo × Executivo. | A integração futura de Saúde parte de `?uf=` (validado pelo conjunto `ufs` do domínio), com seção própria "Poder Executivo", sem usar `casa` nem entrar em `summary.byHouse`. A rota não é modificada. | nenhum | Fase 1E ganha um ponto de integração com a navegação existente; `DataCoverage` (rota) e `ProductCoverage` (Assembleias) precisam de adaptador. |
| **C06** Reconciliação dos códigos IBGE | Fatos de SIM/SINASC/SIH com município `xx0000` ("ignorado") não tinham entidade; `exec_entity_external_id` e `exec_ref_code` não admitiam reuso de código ao longo do tempo. | 14 códigos `xx0000` em 2024 no SINASC; `ibge6` é único nos 5.571 municípios (5.571/5.571); PNI traz o município novo desde 2023, SIM/SINASC/SIH ainda não. | `exec_entity.kind = 5` ("município ignorado da UF", 27 linhas) para somar corretamente por UF sem entrar em ranking municipal; PK de `exec_entity_external_id` e `exec_ref_code` com `valid_from`; regra explícita 6↔7 dígitos; guarda de contiguidade. | Universo: 5.571 municípios + 27 "ignorados" + 27 UFs + 5 regiões + Brasil = 5.667 entidades. | desprezível | Fase 0: seeds com 5.667 entidades e teste de reconciliação. |
