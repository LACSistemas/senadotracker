# E7.5 — Auditoria final

## Matriz de evidências (mandato §28)

| Dimensão | Antes | Depois | Evidência |
|---|---|---|---|
| Quem cuida de quê | 3 cards estáticos, 1 esfera cada, sem interação | Seletor por área (5 pílulas) + 3 blocos + faixa de competências compartilhadas, texto validado por área | `before/e7-before-federativo.png` × `after/e7-after-federativo.png`, `after/e7-after-federativo-educacao.png` |
| Cinco áreas | 5 `ThemeCard` idênticos (ícone→número→nota→link) | 5 composições distintas: distribuição por pontos (Saúde), evolução em barras (Educação), evolução em área (Segurança), 3 estatísticas separadas (Bem-estar), comparação de barras (Infraestrutura) | `before/e7-before-cinco-areas.png` × `after/e7-after-cinco-areas-saude-educ.png`, `e7-after-cinco-areas-seg-bem.png`, `e7-after-cinco-areas-infra.png` |
| Continuidade territorial | UF selecionada só refletia no painel do hero | Saúde (único tema com contrato por UF) também reflete a UF selecionada, com valor exato e destaque visual no ponto da distribuição | `after/e7-after-saude-selected-mg.png` |
| Obras | Texto + gráfico, sem número de destaque | Número derivado real (28,9% concluídas) abre a seção, gráfico preservado | `before/e7-before-recursos.png` × `after/e7-after-recursos.png` |
| Hero cartográfico (E6) | — | Preservado sem reconstrução | Confirmado por 3/3 testes do explorador por indicador |
| Mobile | 320/390px — mesma sequência de cards do desktop, comprimida | Mesma composição assimétrica colapsa em coluna única, com cada seção mantendo sua própria linguagem visual | `after/e7-after-390-full.png`, `e7-after-320-full.png` |
| Integridade | Indicadores, mapa, busca, temas, comparadores | Preservados integralmente | 44/44 testes e2e |

## Preservação funcional (inventário, mandato §23)
Confirmados intactos: busca territorial, mapa com seletor de indicador, seleção de UF, tabela de 27 estados, Atlas Vivo, os 5 indicadores nacionais reais das áreas (agora com visualização, não removidos), as responsabilidades federativas (agora interativas, texto de cada esfera preservado em espírito, reescrito para a nova interação), obras/contratos (gráfico e links preservados), perguntas investigativas, fontes/metodologia. Nenhuma funcionalidade removida; `ThemeCard` foi removido do código porque nenhuma das 5 áreas mais usa sua estrutura uniforme — a função foi substituída, não deixada morta.

## Testes
Suíte combinada (`executivo-portal.spec.ts` + `p14-territorio-executivo.spec.ts` + `p148-judiciario.spec.ts`, 44 testes): **44 passaram** (1,7 min). 3 falhas reais encontradas na primeira rodada, todas confirmadas como consequência direta e correta da reconstrução (não regressão escondida), corrigidas no teste:
- `'renda domiciliar per capita média'` (minúsculo, string editorial hardcoded do `ThemeCard` antigo) → `'Renda domiciliar per capita média'` (maiúsculo real, agora o rótulo vem direto de `observation.label` do banco, não de um texto inventado no componente).
- 2 testes esperavam `table tbody tr` com 27 linhas, mas a página passou a ter mais de uma `<table>` real (cada gráfico de evolução — `BarChart`/`AreaTrend` — expõe sua própria tabela de dados acessível em "Ver dados do gráfico", um ganho de acessibilidade, não um bug) — o locator não escopado contava 50 linhas (27 + 11 edições do Ideb + ~12 anos de tráfico). Corrigido escopando ao `<details>` específico da tabela de estados do hero.

## Acessibilidade (axe-core real, `D:\Civica\tools\a11y\...\axe-core`)
2 violações — `label-content-name-mismatch` (27 nós) e `nested-interactive` (1 nó) — **mesmas 2 categorias pré-existentes do componente de mapa compartilhado**, documentadas desde H5 e confirmadas inalteradas em E6. **0 violações novas** introduzidas pelo `FederativeExplorer`, pelos novos gráficos ou pelos novos painéis.

## Typecheck e build
`next typegen && tsc --noEmit` isolado (`NEXT_DIST_DIR` dedicado): limpo. `next build` isolado: limpo, `/executivo` listado como rota dinâmica normalmente.

## Achados operacionais reais (2 bugs introduzidos e corrigidos nesta própria fase, documentados com honestidade)
1. **Ícones como prop server→client** (E7.2): quebrava a página com 500 real — corrigido trocando o componente de ícone por uma chave string resolvida dentro do componente client.
2. **Overflow horizontal <768px** (E7.3): 356px de overflow real em 320px, causado por `min-width: auto` padrão do CSS Grid em filhos que continham gráficos de `min-w-[620px]` — corrigido com `min-w-0` nos 5 itens do grid. Confirmado por medição antes/depois, não só inspeção visual.

Nenhum dos dois chegou a ser reportado como "pronto" antes da correção — ambos foram encontrados pela própria verificação desta fase (visual + medição + teste real), não por reporte externo.

## Performance
Nenhuma biblioteca nova. `BarChart`/`AreaTrend` são os mesmos componentes Server Component já usados em outras páginas do produto — zero bundle novo. `getHealthBedsByUf` é 1 query adicional agregada (não N+1); as demais fontes de dado (`idebBrasil.rows`, `orgCrime.series[].years`, `wellbeing.chapters`) já estavam carregadas pela E6 e só passaram a ser mais bem aproveitadas, sem nenhuma consulta nova por UF disparada no carregamento da página nacional. Não medido LCP/CLS de campo — mesma ressalva de H7/J7/E6.

## Segurança arquitetural
Nenhuma migration, backfill, alteração de schema, reprocessamento ou interrupção de coletor. A única mudança em `packages/db` foi a adição de `getHealthBedsByUf` — uma função de leitura nova sobre tabelas existentes, mesmo padrão de soma censitária de `getNationalHealthSummary`. PNCP e demais coletores não foram tocados.

## Revisão pós-entrega (feedback real do usuário)
Após a entrega inicial, o usuário pediu que os 5 cards da seção "cinco áreas" tivessem o mesmo tamanho (a grade original era assimétrica). A grade foi trocada para `sm:grid-cols-2` (largura igual) e isso expôs 3 bugs reais adicionais — gráfico de Educação desequilibrando a altura da linha, corte silencioso do ponto mais recente do Ideb dentro do próprio scroll interno dos componentes compartilhados de gráfico em meia largura, e 2 problemas de rotulagem de eixo (corte do primeiro rótulo, sobreposição dos 2 últimos) — todos encontrados e corrigidos na própria verificação desta revisão (detalhes em `RELATORIO_FINAL_E7.md`, seção "Revisão pós-entrega"). Um 5º achado (aviso real do React em `<title>` de SVG com filhos múltiplos, que por sua vez acionava o overlay de dev do Next.js e fazia o axe-core apontar 1 violação nova) também foi corrigido; axe-core confirmado de volta a 2 violações (as mesmas pré-existentes). Suíte completa (44/44), typecheck e build isolados reexecutados limpos após todas as correções.

## Status: E7_READY_FOR_USER_VISUAL_APPROVAL
