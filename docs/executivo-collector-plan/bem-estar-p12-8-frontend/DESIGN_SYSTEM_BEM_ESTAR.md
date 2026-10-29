# P12.8 — Sistema de design de Bem-estar

Nenhum componente visual novo de base foi inventado. Bem-estar reaproveita, sem alteração, o mesmo sistema de tokens e componentes que Segurança (P9.8) e Educação (P11) já usam nas páginas territoriais — a mesma cor primária `#115B45` (verde Cívica), a mesma tipografia de display, os mesmos cartões elevados (`card-elevated`), a mesma grade responsiva. A única peça genuinamente nova é `TerritoryCompareRow`, porque o formato de comparação de Bem-estar é estruturalmente diferente do de Segurança/Educação (ver seção própria abaixo).

## Reaproveitado sem modificação

| Peça | Origem | Uso em Bem-estar |
|---|---|---|
| `ChapterShell`, `EmptyNote` | `components/security/security-ui.tsx` | moldura de cada um dos 6 capítulos, incluindo o estado `Pending` para capítulo sem dado |
| `ChapterNav` | `components/security/chapter-nav.tsx` | navegação fixa entre Retrato → 6 capítulos → Fontes |
| `TrendChart` | `components/security/trend-chart.tsx` | gráfico do Caged (mensal), RAIS (anual) e Siconfi (anual) — mesmo componente, três granularidades diferentes via `grain: 'A'|'M'` |
| `fmt`, `brl`, `periodLabel` | `lib/security/format.ts` | toda formatação numérica e de período |
| `instrument`, `memo`, `scopeOf`, `scopeFromEntity` | `lib/security/load.ts` | instrumentação de SQL, cache de 60s, resolução de escopo |
| `StatGrid`, `BarList`, `DataTable`, `Block` | padrão espelhado de `components/education/education-ui.tsx` | grade de estatísticas, barras de distribuição, tabela financeira |

## Estrutura da página

1. **Retrato de Bem-estar** — 3 a 4 fatos (nunca os 27 indicadores), cada um com fonte e período impressos no próprio cartão, nunca um índice composto. A seleção dos fatos é feita em `loadWellbeingPage` (`apps/web/lib/wellbeing/load.ts`), condicionada a dado real existir — um território sem RAIS, por exemplo, nunca mostra um cartão de "vínculos formais" com valor vazio.
2. **Legenda de estados de dado** (`WellbeingLegend`, em `components/wellbeing/wellbeing-ui.tsx`) — explica visualmente a diferença entre "publicado", "fonte não publicou" e "cobertura parcial" antes de qualquer capítulo, para que o leitor não precise inferir isso sozinho capítulo a capítulo.
3. **6 capítulos** (`ChapterShell`), cada um com: narrativa factual (pergunta → resposta → contexto, nunca juízo de valor), visualização(ões), lista de limites (`limits`) sempre visível, e — a partir desta fase — um bloco de divulgação por indicador (`IndicatorDetails`, ver `CONTRATOS_COMPONENTES.md`) ao final do capítulo.
4. **Fontes desta página** — lista final agregando todas as fontes realmente usadas nesta carga específica (nunca uma lista estática das 6 fontes possíveis; se um capítulo não tinha dado, sua fonte não aparece aqui).

## Decisão de design nova: `TerritoryCompareRow`

`getWellbeingComparators` devolve exatamente 3 pontos (território, UF, Brasil) — nunca uma distribuição de percentis entre municípios-pares, que é o que `BenchRuler`/`Ruler` (de Segurança/Educação) foram desenhados para mostrar. Forçar esse formato dentro de uma régua de percentil seria inventar uma distribuição que o read model não calcula.

Por isso, `apps/web/components/wellbeing/territory-compare.tsx` desenha os 3 pontos como uma trilha horizontal simples com três marcas rotuladas, reaproveitando as cores já usadas em `bench-ruler.tsx` (verde cheio = território, marca escura = UF, tracejada cinza = Brasil) — mesma linguagem visual, sem herdar a semântica de quartil que não existe aqui.

Uma peculiaridade do read model foi tratada explicitamente na UI: ao comparar uma UF consigo mesma, `comparisons.state` e `comparisons.municipality` (o território de referência) resolvem para a mesma linha. Em vez de mostrar uma comparação trivial ("Espírito Santo" comparado a "Espírito Santo"), `territoryCompare()` (`lib/wellbeing/build.ts`) omite o ponto de estado inteiramente quando a chamada não passa `stateLabel` — o que só acontece nas páginas de UF. `TerritoryCompare.state` é `null` nesse caso, e `TerritoryCompareRow` lida com isso sem renderizar nem um espaço vazio nem um "não aplicável": a marca de UF simplesmente não existe na trilha.

## Divulgação por indicador

Cada capítulo que tem indicadores individualmente identificáveis (condições de vida, trabalho, rede socioassistencial no escopo de município, cotidiano digital no escopo de município) ganhou, ao final do seu conteúdo, uma lista de blocos `<details>` — um por indicador que sustenta aquele capítulo — com fonte, período, unidade, universo, cobertura e link oficial, extraídos diretamente dos campos que a própria observação já carregava (nenhuma consulta nova). Capítulos cujos números vêm de agregados por UF (SUAS/MUNIC na visão de estado) ou de linhas de execução financeira (ação pública) não têm uma "observação" no mesmo formato — por isso não geram um bloco de divulgação por indicador; a fonte desses capítulos já aparece no texto fixo `sources` do próprio capítulo. Isso é documentado explicitamente, não escondido.
