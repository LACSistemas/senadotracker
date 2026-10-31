# P13.7 — Arquitetura do frontend de Infraestrutura

## Estrutura de arquivos

```
apps/web/lib/infrastructure/
  types.ts       tipos de visualização (StatItem, BarRow, ChapterBase, HeroKpi, WorksListItem, WorkDetailView, ...)
  catalog.ts     prioridade de KPIs do hero, agrupamento por módulo, catálogo situação/categoria de obras, parser do Censo Entorno
  format.ts      formatação de indicador por unidade real, compacto de kW→MW→GW, centsToReais (ver armadilha abaixo)
  build.ts       stat()/bars()/group()/temporalNote()/comparePoint()/territoryCompareFromComparison() — puros, sem I/O
  narrative.ts   frases de abertura por capítulo (pergunta → resposta → contexto → convite)
  load.ts        loadInfrastructurePage(scope) — página de overview
  works.ts       loadWorksListPage(território, filtros) e loadWorkDetail(projectId, páginaEmpenhos)

apps/web/components/infrastructure/
  infrastructure-page.tsx    composição da página de overview (hero + 7 capítulos + explorador + fontes)
  infrastructure-ui.tsx      StatGrid, BarList, GroupBlock, Block, InfrastructureLegend
  urban-environment.tsx      EntornoUnitSwitcher (client, alterna FACES/DOMICÍLIOS/MORADORES)
  indicator-disclosure.tsx   IndicatorDetails (fonte/período/universo/cobertura de 1 indicador)
  territory-compare.tsx      TerritoryCompareRow (dot-plot território/UF/Brasil)
  explorer.tsx               IndicatorExplorer (client, busca/filtra/exporta CSV os 108 indicadores)
  works-list.tsx             WorksFilterForm + WorksList (formulário GET + tabela + paginação)
  work-detail.tsx            WorkDetail (cabeçalho, 5 estágios, físico, contratos, empenhos, PNCP)

apps/web/app/estados/[uf]/infraestrutura/page.tsx          overview estadual
apps/web/app/estados/[uf]/infraestrutura/obras/page.tsx    lista de obras do estado
apps/web/app/municipios/[ibge]/infraestrutura/page.tsx         overview municipal
apps/web/app/municipios/[ibge]/infraestrutura/obras/page.tsx   lista de obras do município
apps/web/app/obras/[projectId]/page.tsx                     detalhe de obra (rota GLOBAL, não aninhada)
```

## Por que a rota de detalhe de obra é global

Uma obra pode estar vinculada a até 790 municípios (caso real testado: obra #1963, DNIT/MG). Aninhar o detalhe em `/estados/[uf]/.../obras/[id]` ou `/municipios/[ibge]/.../obras/[id]` obrigaria escolher um território "dono" artificial para uma obra que não tem um só dono. A rota `/obras/[projectId]` é única por projeto; a listagem de cada território linka para ela com `?from=uf:ES` ou `?from=municipio:3205309`, e a página de detalhe usa esse parâmetro só para montar o link de "voltar" — nunca para filtrar os dados da obra em si.

## Fluxo de dados (sem N+1)

`loadInfrastructurePage(scope)`:
1. Converte `ScopeInfo` → `InfrastructureTerritory` (`{level:'UF', ufCode}` ou `{level:'MUNICIPIO', ibge7: String(scope.entityId)}` — `entityId` de município é o próprio ibge7 nesta base, confirmado por consulta direta).
2. Um `Promise.all` com 4 chamadas: `getInfrastructureIndicators` (sem filtro de família — traz os até 108 indicadores do território numa única consulta), `getInfrastructureWorksOverview`, `getInfrastructureWorksBySituation`, `getInfrastructureFamilies`.
3. Monta o hero filtrando o array já carregado por código (nunca uma consulta por KPI).
4. Só para município, busca comparação UF/Brasil para até 3 KPIs elegíveis (`comparisonEligible`) — bounded, não para os 8.
5. Cada capítulo temático filtra o mesmo array em memória por `sourceFamily` (`MODULE_FAMILIES`) — nenhuma consulta nova por capítulo.
6. Explorador e cobertura por família reaproveitam os mesmos dados já carregados.

Total medido: 9 consultas SQL para overview de UF/Brasil, 26–35 para município (a diferença são os até 3 comparadores, cada um gerando ~3-4 consultas internas no backend). Ver `BENCHMARKS_FRONTEND_P137.json`.

`loadWorksListPage`/`loadWorkDetail` são independentes do load principal — cada rota de obras faz sua própria chamada, paginada no banco (nunca busca as 155 mil linhas no frontend).

## Reuso cross-domain

De `components/security/`: `ChapterShell`, `EmptyNote`, `ChapterNav`, `TrendChart` (não usado ainda — nenhum capítulo de infraestrutura tem série temporal anual/mensal no momento; disponível se um módulo futuro precisar). De `lib/security/`: `types.ts` (`Narrative`, `ScopeInfo`), `load.ts` (`instrument`, `memo`, `scopeOf`, `scopeFromEntity`), `format.ts` (`fmt`, `brl`, `brlShort`, `compact`, `periodLabel`). De `components/territory/`: `TerritoryFrame`, `ThemeTabs`, `MunicipalMap` (não usado — nenhum módulo de infraestrutura tem mapa de distribuição municipal nesta fase; candidato natural para "obras por município" numa iteração futura).

`build.ts`/`types.ts`/`narrative.ts` são **deliberadamente duplicados**, não importados de Bem-estar/Segurança — mesma convenção já documentada no código desses domínios ("não acoplar o domínio de Infraestrutura a Bem-estar").
