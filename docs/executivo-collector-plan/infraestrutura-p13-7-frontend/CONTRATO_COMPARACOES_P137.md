# P13.7 — Contrato de comparações UF/Brasil

## Regra de elegibilidade (vem do backend, não inventada no frontend)

`getInfrastructureIndicatorDetail` só computa `comparison.eligible` quando `aggregation_allowed` (definição do indicador) é verdadeiro **e** o território consultado é `kind=4` (município). Ou seja: **comparação só existe em páginas de município**; páginas de UF/Brasil nunca têm esse bloco — confirmado com teste real (`estado-desktop-es.png`/Playwright: `expect(page.getByText('Comparação com o estado e o Brasil')).toHaveCount(0)` em `/estados/ES/infraestrutura`).

## Por que só até 3 comparadores, não os 8 KPIs inteiros

Cada chamada a `getInfrastructureIndicatorComparison` dispara, internamente, uma nova resolução de `getInfrastructureIndicatorDetail` (que por sua vez busca a série do indicador + a série da UF + a série do Brasil) — não é uma consulta só, são várias por indicador. Buscar comparação para os 8 KPIs do hero multiplicaria o custo da página de overview por ~4x. `load.ts` filtra os KPIs por `comparisonEligible` (campo que já vem de graça, sem consulta extra, no indicador) e pega só os 3 primeiros elegíveis — mantém a página rápida (ver `BENCHMARKS_FRONTEND_P137.json`: overview de município com comparadores ficou em 32–159ms mesmo assim) e ainda cumpre a seção 19 do brief ("somente comparadores elegíveis").

## Layout

`TerritoryCompareRow` (`components/infrastructure/territory-compare.tsx`, cópia estrutural de `components/wellbeing/territory-compare.tsx`): até 3 pontos (território, UF, Brasil) num dot-plot horizontal + lista textual com os mesmos três valores. Pontos inelegíveis aparecem como "não aplicável (motivo)", nunca como zero. O ponto de UF é omitido quando a própria página já é de UF (não se aplica aqui, já que comparação só existe em município — mas o componente preserva essa regra para reuso futuro).

## Proibições do brief (seção 19) — como são respeitadas

- Nenhuma média simples de percentuais municipais para Brasil: o valor de Brasil vem pronto do backend (`cmp.brazil`), nunca calculado no frontend.
- Nenhuma comparação FJP municipal: FJP não tem indicador elegível em nível município (não está na lista `HERO_KPI_PRIORITY` e não teria `comparisonEligible` relevante de qualquer forma, já que FJP só publica UF/Brasil).
- Nenhum "melhor"/"pior": `TerritoryCompareRow` só mostra os três valores lado a lado, nunca uma palavra de julgamento.
