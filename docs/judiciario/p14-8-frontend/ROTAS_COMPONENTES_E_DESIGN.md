# Rotas, componentes e design — P14.8

## Árvore de rotas

```
/judiciario                        Panorama nacional
/judiciario/tribunais               Diretório (busca, filtro de ramo/UF, paginação)
/judiciario/tribunais/[id]          Perfil (capítulos A–G adaptativos)
/judiciario/comparar                Comparador (indicador + 2–10 tribunais + ano)
/judiciario/temas                   Hub (6 cartões reais + seção "em investigação")
/judiciario/temas/[tema]            Página de tema (indicador principal, série, outros indicadores, por tribunal, metodologia)
/judiciario/stj/precedentes         Explorador paginado
/judiciario/stj/precedentes/[id]    Detalhe (questão → tese → histórico → processos → fonte)
```

Todas as 8 rotas usam `export const dynamic = 'force-dynamic'` (mesmo padrão do resto do produto) e `generateMetadata` próprio nas rotas dinâmicas (`[id]`, `[tema]`).

## Componentes reaproveitados sem modificação

| Componente | Arquivo | Uso no Judiciário |
|---|---|---|
| `InstitutionHero` | `components/heroes.tsx` | Hero do panorama, comparador, hub de temas, página de tema, perfil de tribunal |
| `KpiCard`/`KpiGrid` | `components/metrics.tsx` | Todos os blocos de KPI (via adaptador `toChartCoverage`) |
| `DataTable`/`DataColumn` | `components/data-table.tsx` | Diretório de tribunais, explorador de precedentes STJ |
| `SearchBar`/`FilterBar` | `components/data-controls.tsx` | Busca e filtros do diretório e do explorador STJ |
| `BarChart`/`MultiLineChart`/`RankedBars` | `components/charts.tsx` | Séries históricas, comparações nacionais, "por tribunal" |
| `EmptyState` | `components/empty-state.tsx` | Comparação incompatível, indicador sem dado |
| `ChapterNav` | `components/security/chapter-nav.tsx` | Navegação por capítulo do perfil de tribunal (`layout="sidebar"`) — seletor compacto no mobile, coluna lateral no desktop, já com `IntersectionObserver` para o capítulo ativo |

Nenhum desses componentes foi alterado. Um achado notável: `LineChart` (também em `charts.tsx`) rotula cada ponto do eixo X com o valor — adequado para séries curtas, mas ilegível com 17 anos (ver `GRAFICOS_COMPARADORES_E_METODOLOGIA.md`). Em vez de alterar esse componente (usado por outras páginas do produto), as páginas de perfil e tema usam `MultiLineChart` com uma série única — mesmo padrão já limpo do panorama, zero risco de regressão em quem usa `LineChart` hoje.

## Componentes novos

### `components/judiciary/availability.tsx`
Duas peças: `JudiciaryAvailabilityNote` (ícone + rótulo + explicação para os 10 estados de `AvailabilityState` e 6 de `ThematicAvailability` — nunca colapsa `METHOD_INCOMPATIBLE`/`LEGAL_RESTRICTION`/`NOT_REPORTED` numa única nuance genérica) e `toChartCoverage` (adaptador para o `DataCoverage` de 5 estados que os componentes de gráfico/tabela já sabem renderizar — a nuance completa vai sempre no campo `note`, nunca se perde).

### `components/judiciary/methodology-panel.tsx`
`MethodologyPanel`: painel `<details>` com fórmula, numerador, denominador, universo estatístico, grão institucional/temporal, anos disponíveis, agregação permitida, quebras metodológicas e regra de ausência — usado no Capítulo G do perfil e na seção "Indicadores deste tema". Implementa o padrão "investigação progressiva" do mandato (descoberta → exploração → metodologia).

### `components/judiciary/tribunal-multi-select.tsx`
`TribunalMultiSelect`: a `ComparisonMultiSelect` existente é hardcoded para renderizar logo de partido ou sigla de UF — um `tribunal_id` como `JUD:TRIBUNAL:TJES` não é nenhum dos dois. Componente próprio com a mesma interação (busca + chips + toggle, até 10 selecionados), renderizando sigla + nome oficial.

## Navegação

Entrada "Judiciário" adicionada à lista fixa de `app-header.tsx`, entre "Partidos" e "Investigar" — preserva a estrutura existente (desktop: nav horizontal; mobile: `<details>` compacto), nenhum outro domínio foi tocado.

## Linguagem visual

Cor institucional `#115B45` herdada sem reconfiguração — já é `var(--primary)` em todo o Cívica. Hero com gradiente verde escuro (`InstitutionHero`, já usado em Legislativo), tipografia `display-title` para títulos, cartões com borda sutil e `hover:border-primary`, badges de disponibilidade com cor semântica própria (verde=disponível, âmbar=parcial/não agregável, vermelho=restrição/bloqueado — nunca a mesma paleta do mapa de magnitude, que é um sistema à parte no Cívica). Nenhuma biblioteca de UI nova foi instalada.

## Perfis adaptativos (Capítulos A–G)

O perfil de tribunal não renderiza seção vazia: "Finanças" só aparece com despesa JN ou fato financeiro publicado; "Temas" só com pelo menos um tema tendo valor real para aquele tribunal; "Jurisprudência" só no STJ. `ChapterNav` recebe só os capítulos que de fato têm conteúdo — o índice numerado nunca mostra um capítulo morto.
