# P12.8 — Mapa de rotas e integração territorial

## Mecanismo de integração

A navegação por "áreas temáticas" nas páginas de estado e município (`apps/web/app/estados/[uf]/page.tsx`, `apps/web/app/municipios/[ibge]/page.tsx`) é gerada inteiramente a partir do array `THEMES`, declarado em [apps/web/components/territory/territory-ui.tsx](../../../apps/web/components/territory/territory-ui.tsx). Cada página de visão geral faz `THEMES.map(...)` para desenhar a lista de abas; nenhuma delas tinha lógica específica por tema. A rota `[tema]/page.tsx` (tanto em `estados/[uf]/` quanto em `municipios/[ibge]/`) é um placeholder genérico usado só quando `THEMES` marca um tema como `ready: false`.

Isso significa que ativar Bem-estar não exigiu alterar nenhuma das páginas de visão geral: bastou

1. trocar a entrada `{ slug: 'bem-estar', label: 'Bem-estar', ready: false }` para `ready: true` em `territory-ui.tsx`, e remover a entrada agora morta `THEME_PLAN['bem-estar']` (texto do placeholder que não é mais usado);
2. criar duas pastas de rota literal: `apps/web/app/estados/[uf]/bem-estar/page.tsx` e `apps/web/app/municipios/[ibge]/bem-estar/page.tsx`.

Em Next.js (App Router), uma rota literal (`bem-estar/`) tem precedência automática sobre a rota dinâmica irmã (`[tema]/`) para o mesmo segmento — é o mesmo mecanismo já usado por `educacao/`, `saude/` e `seguranca/`. Nenhuma migration, nenhuma mudança de middleware, nenhum redirecionamento foi necessário.

## Confirmação de que não existe rota duplicada

Antes de criar qualquer arquivo, as rotas reais foram inspecionadas (não assumidas):

- `/estados/[uf]/page.tsx` e `/municipios/[ibge]/page.tsx` são as páginas gerais de território — a URL real de "visão geral do estado/município" na aplicação.
- `/estados/[uf]/representacao` (e não `/quem-me-representa?uf=ES`) é a página de representação legislativa; ela vive fora de `THEMES`, com link próprio, e não tem nenhuma relação com a navegação por áreas temáticas. Bem-estar não interage com essa rota em nenhum ponto.
- `/estados/[uf]/[tema]` e `/municipios/[ibge]/[tema]` continuam servindo de placeholder para os temas que ainda não têm `ready: true` (ex.: `infraestrutura`); Bem-estar deixou de passar por ali assim que ganhou pasta literal.

Não existe, portanto, nenhuma segunda página de território criada por esta fase — Bem-estar entra exatamente no mesmo esqueleto (`TerritoryFrame`, `Crumbs`, `ThemeTabs`) que Saúde, Educação e Segurança já usam, com os mesmos `crumbs`/`kicker`/`title`/`lede`/`population`/`base`/`active` que esses três domínios passam para `TerritoryFrame`.

## Rotas novas

| Rota | Arquivo | Escopo |
|---|---|---|
| `/estados/[uf]/bem-estar` | `apps/web/app/estados/[uf]/bem-estar/page.tsx` | UF |
| `/municipios/[ibge]/bem-estar` | `apps/web/app/municipios/[ibge]/bem-estar/page.tsx` | município |

Ambas resolvem o escopo via `scopeOf('uf'|'municipio', ...)` (reexportado de `apps/web/lib/security/load.ts`, já usado por Segurança/Educação) e carregam os dados via `loadWellbeingPageCached` (memo de 60s), seguindo o padrão exato das rotas equivalentes de Educação.

## Territórios reais verificados (ids confirmados em `civica_exec.exec_entity`, nenhum inventado)

| Território | kind | entity_id | Rota |
|---|---|---|---|
| Vitória, ES | município | 3205309 | `/municipios/3205309/bem-estar` |
| Vila Velha, ES | município | 3205200 | `/municipios/3205200/bem-estar` |
| Alto Rio Novo, ES | município | 3200359 | `/municipios/3200359/bem-estar` |
| Boa Esperança do Norte, MT | município | 5101837 | `/municipios/5101837/bem-estar` |
| São Paulo (município) | município | 3550308 | `/municipios/3550308/bem-estar` |
| Brasília, DF | município | 5300108 | `/municipios/5300108/bem-estar` |
| Espírito Santo | UF | 32 | `/estados/ES/bem-estar` |
| São Paulo (UF) | UF | — | `/estados/SP/bem-estar` |
| Distrito Federal | UF | 53 | `/estados/DF/bem-estar` |

Todas as 9 rotas (8 territórios pedidos pela missão + Distrito Federal, incluído por ser o caso em que município-sede e UF têm nomes administrativamente ligados) responderam HTTP 200 contra o servidor de desenvolvimento real, sem marcador de erro (`application error`, digest de erro React) no HTML retornado. A distinção município×UF foi confirmada tanto para São Paulo quanto para Brasília/Distrito Federal: os `<title>` das quatro páginas são textualmente diferentes (ex.: "Bem-estar em São Paulo" vs. "Bem-estar em São Paulo" só aparecem idênticos no nome da cidade — o `kicker`/crumbs deixam explícito se é município ou estado; ver `VALIDACAO_ESTADOS_MUNICIPIOS.md` para o detalhe campo a campo).
