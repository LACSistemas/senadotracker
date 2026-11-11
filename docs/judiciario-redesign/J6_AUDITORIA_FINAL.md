# J6 — Auditoria final e regressão

## Verificação combinada

- `npm run typecheck` limpo em `@senadotracker/db` e `@senadotracker/web` (dist isolado via `NEXT_DIST_DIR`, removido após cada rodada — nunca tocou o `.next` do servidor de dev do usuário).
- Suíte e2e completa do Judiciário rodada do início ao fim, na ordem J1→J5: **52/52 passando** em todas as rodadas finais (`p148-judiciario.spec.ts`, `p150-stf-repercussao-geral.spec.ts`, `p151-stf-remuneracao.spec.ts`, `p152-stf-jurisprudencia.spec.ts`).
- axe-core real (não suposição): **0 violações** nas 4 rotas reconstruídas, em 1280px e 390px (`J5_UX_RESPONSIVIDADE_ACESSIBILIDADE.md`).
- Overflow horizontal: **0 em 20/20 combinações** (5 rotas × 320/390/768/1280/1440px).
- `git status` revisado ao final: nenhum arquivo fora do escopo do Judiciário foi tocado; nenhum arquivo temporário de trabalho ficou para trás.

## Matriz de preservação funcional (G2)

| Capacidade anterior | Sobreviveu? | Onde está agora |
|---|---|---|
| KPIs nacionais (casos novos/baixados/pendentes/magistrados) | Sim | `/judiciario`, retrato institucional |
| Despesa nacional com magistrados | Sim | `/judiciario`, nota abaixo dos KPIs (ver nota de integridade em J2) |
| Série histórica nacional (2009–2025) | Sim | `/judiciario#fila` |
| 6 temas reais + temas em investigação | Sim | `/judiciario/temas` |
| Diretório com busca/filtro por ramo | Sim, e corrigido | `/judiciario/tribunais` (bug de 5 ramos quebrados corrigido — ver J3) |
| Perfil de tribunal, 7+ capítulos adaptativos | Sim | `/judiciario/tribunais/[id]` |
| Jurisprudência (STJ precedentes; STF Repercussão Geral + acórdãos/decisões) | Sim, intocado | perfil do STJ/STF, capítulo Jurisprudência |
| Ministros do STF com foto e remuneração (P14.12) | Sim, intocado | perfil do STF, capítulo Ministros |
| Comparador de tribunais | Sim, intocado | `/judiciario/comparar`, agora também referenciado como aba no diretório |
| Metodologia por indicador | Sim, intocado | todas as páginas de perfil/tema |

Nenhuma rota, capítulo, indicador ou teste pré-existente foi removido. Duas pequenas composições de KPI mudaram de lugar (congestionamento nacional virou nota editorial em vez de card; despesa com magistrados virou nota em vez de card) — justificado em cada relatório de fase, nunca um dado apagado.

## Contratos de dados utilizados (G3 — verdade estatística)

Todos os números exibidos vêm de `civica_jud` (CNJ Justiça em Números, edição 2026, ano-base 2025) e das fontes já publicadas em P14.9–P14.12 (STF). Dois desvios deliberados do mock, ambos por integridade estatística, não por preferência visual:

1. **Sem taxa de congestionamento nacional agregada** — indicador oficialmente `NONE_RATE_OFFICIAL`, nunca somável entre tribunais.
2. **Sem donut de "casos novos por tema"** — os 6 temas reais usam métricas diferentes entre si (a maioria "processos baixados", um "casos novos", um é um índice) e não são categorias mutuamente exclusivas de um mesmo total.

Em compensação, um dado válido que o mock *não* explorava foi adicionado com honestidade: **taxa de congestionamento por tribunal** (válida nesse grão) nos KPIs do perfil institucional e como coluna nova no diretório.

## Achados reais descobertos durante o programa (não suposições)

1. Donut de temas inviável com dado real (J0).
2. KPI nacional de congestionamento inviável (J0, já documentado no próprio código anterior).
3. Overflow de 286px em mobile por `min-width:auto` de CSS Grid (J2, corrigido).
4. **Filtro de Ramo do diretório estava quebrado para 5 de 8 ramos** — bug pré-existente, não introduzido por este programa, encontrado e corrigido em J3.
5. `seat_uf` ausente no catálogo institucional para a maioria dos tribunais, incluindo estaduais — pré-existente, documentado, não corrigido (fora do escopo de um redesign de frontend).
6. Card órfão em grid de 3 colunas quando só 1 item tem dado — corrigido em J5.

## Segurança arquitetural (G6)

Confirmado por revisão de `git status` e do próprio trabalho: nenhuma migration executada, nenhum schema alterado, nenhuma tabela criada, nenhum backfill, nenhum coletor reiniciado ou interrompido, nenhuma página territorial ou do Executivo tocada, nenhum dado substituído por valor simulado. A única adição ao `packages/db` foi uma extensão de leitura (2 colunas calculadas por subquery correlacionada em `getJudiciaryTribunalDirectory`) e um mapa estático de fotos (P14.12, fase anterior). Build e testes rodados sempre isolados (`NEXT_DIST_DIR`, porta de dev do usuário nunca derrubada).

## Pendências residuais (registradas, não bloqueantes)

- `seat_uf` ausente no catálogo (achado 5 acima) — candidato a uma fase futura de backfill de P14.1.
- Itens "a revisar" do axe-core (1–2 por página, não violações confirmadas) — auditoria manual futura.
- Métricas de campo de desempenho (LCP/INP/CLS) não foram medidas com ferramentas de campo nesta fase — só a ausência de regressão visual/funcional foi verificada. Documentado aqui para não ser confundido com uma medição real feita.

## Gates

| Gate | Status |
|---|---|
| G1 — Excelência visual | `READY_FOR_USER_VISUAL_APPROVAL` |
| G2 — Integridade funcional | PASS |
| G3 — Verdade estatística | PASS |
| G4 — Acessibilidade e mobile | PASS (0 violações axe-core, 0 overflow em 20/20 larguras) |
| G5 — Desempenho | PARTIAL (sem regressão observada; sem medição de campo) |
| G6 — Segurança arquitetural | PASS |
