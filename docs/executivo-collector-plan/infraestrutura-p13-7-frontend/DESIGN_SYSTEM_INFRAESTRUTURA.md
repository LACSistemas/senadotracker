# P13.7 — Design system de Infraestrutura

Não é um tema novo — reaproveita integralmente os tokens e convenções visuais já em produção em Segurança/Bem-estar/Educação.

## Cores

- Institucional: `#115b45` (verde primário — ações, estado ativo, barras preenchidas).
- Texto de destaque: `#14304f` (títulos de capítulo, valores de KPI).
- Superfície clara de destaque: `#e8f3ee`.
- Seguida a **convenção real do código** (não o token CSS `var(--primary)`): hex cru nos componentes de capítulo, igual Segurança/Bem-estar/Educação. Essa inconsistência entre hex cru e `var(--primary)` já existia antes da P13.7 (ver memória do usuário sobre limpeza pendente em `education-ui StatGrid`) — não foi introduzida nem corrigida nesta fase, só seguida por consistência visual.
- Site é **claro, sem dark mode** (`color-scheme: light` em `app/globals.css`, nenhum componente novo criou variante escura).

## Tipografia e grid

- `font-display` para títulos de capítulo e valores de destaque; `hero-figure tnum` para números (tabular, alinhamento numérico).
- Grids responsivos: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` para KPIs; `sm:grid-cols-2 lg:grid-cols-4` para formulários de filtro.

## Componentes reaproveitados sem alteração

`ChapterShell`, `EmptyNote`, `ChapterNav`, `TrendChart`, `Eyebrow`, `Stat`, `Sparkline`, `DeltaChip` (de `components/security/security-ui.tsx`), `TerritoryFrame`, `ThemeTabs`, `Crumbs` (de `components/territory/`).

## Componentes novos (mesma linguagem visual dos já existentes)

- `StatGrid`/`BarList`/`Block` em `infrastructure-ui.tsx` — réplica estrutural de `components/wellbeing/wellbeing-ui.tsx`, mesmas classes Tailwind, só tipado para `IndicatorGroup`/`StatItem` de infraestrutura.
- `GroupBlock` — novo; título de grupo (ex.: "Abastecimento de água") + `StatGrid` + nota opcional do grupo.
- `EntornoUnitSwitcher` — único componente verdadeiramente novo em termos de interação (pílulas de alternância, mesmo estilo visual de `ChapterNav`'s active state: `border-[#115b45] bg-[#115b45] text-white`).
- `IndicatorExplorer` — busca/filtro/export client-side; tabela com `sticky top-0` no cabeçalho, igual ao padrão de tabela já usado em listas de obras e empenhos.
- `WorksFilterForm`/`WorksList`/`WorkDetail` — tabelas e formulários seguem a mesma grade/espaçamento (`rounded-2xl border bg-white/70 p-4 sm:p-5`) do resto do design system; nenhuma classe nova introduzida.

## O que foi evitado (seguindo as proibições explícitas do brief)

- Nenhum gradiente decorativo, nenhum glassmorphism.
- Nenhuma nota única de infraestrutura, nenhum donut de cobertura geral, nenhuma barra de progresso para métrica sem teto legítimo.
- Nenhum ícone decorativo em título de capítulo (só os já existentes em `ChapterShell`, como o ícone de "Fontes e limites").
- Nenhum ranking fictício de municípios, nenhum radar chart.

## Avaliação honesta (gate de qualidade visual, seção 26 do brief)

Os grids de KPI (`StatGrid` dentro de `GroupBlock`) se repetem em vários capítulos (Água, Energia, Mobilidade) com a mesma altura e densidade — exatamente o padrão que a seção 26 do brief pede para evitar ("Cards com a mesma altura e densidade em todas as seções"). Isso não foi corrigido nesta fase: dado o volume de módulos a entregar, a prioridade foi ter cada capítulo correto e honesto antes de variar a composição visual. **Registrado como pendência de um próximo passe editorial** — por exemplo, usar `BarList` em vez de `StatGrid` para grupos com muitos indicadores percentuais comparáveis entre si (caso do Censo Entorno, já feito), e reservar `StatGrid` para grupos realmente heterogêneos.
