# E7.0 — Auditoria visual e inventário

## Ponto de partida: E6 aprovada parcialmente
A E6 (fusão do hero cartográfico) foi aprovada na avaliação visual humana, mas com uma crítica específica: a primeira tela parece um atlas, mas a página retorna progressivamente ao padrão de catálogo nas seções seguintes. Capturas de baseline em `artifacts/e7-executivo/before/` confirmam exatamente os 3 pontos apontados pelo mandato:

1. **"Quem cuida de quê no Brasil?"** — 3 `<div>` com borda própria (União/Estados/Municípios), cada uma um parágrafo estático. Nenhuma interação, nenhuma seleção por área de política pública.
2. **"As cinco áreas da gestão pública"** — 5 `ThemeCard` quase idênticos: ícone → título → pergunta → número → unidade → nota → link. Saúde tinha uma 2ª estatística (ganho da E6.3), mas a estrutura visual das 5 é a mesma.
3. **"Obras públicas: onde estão, em que situação"** — já tinha um gráfico real (ganho da E6), mas sem destaque numérico, com hierarquia plana.

## Componentes e contratos já existentes (reaproveitados, não reconstruídos)
- Hero cartográfico fundido (mapa único, seletor de indicador, painel de contexto) — **preservado integralmente**, única mudança é a correção pontual de `min-w-0` descrita em E7.3.
- `@senadotracker/db`: `loadNationalHealthSummary`, `getIdebTerritory`, `getOrganizedCrimeNational`, `getInfrastructureIndicators`, `getInfrastructureWorksOverview`, `getInfrastructureWorksBySituation`, `loadWellbeingOverview` — todas já usadas pela E6, nenhuma delas tinha sido explorada em profundidade (ex.: `idebBrasil.rows` já trazia todas as edições, não só a mais recente; `orgCrime.series[].years` já trazia a série histórica completa; `wellbeing.chapters` já agrupava por dimensão).
- `components/charts.tsx`: `BarChart`, `AreaTrend` — componentes Server Component já usados em outras páginas (`/legislativo/fornecedores/...`, `/comparar`, `/judiciario/...`), nunca usados em `/executivo`.
- `components/territory/legislative-house-toggle.tsx` — padrão de referência para um componente client pequeno, com estado local, que troca conteúdo pré-computado sem nova consulta (reaproveitado na forma, não no código, para o novo `FederativeExplorer`).

## Lacuna real de dado (único ponto que tocou `packages/db`)
Nenhuma leitura existente devolvia leitos por UF — só o total nacional (`getNationalHealthSummary`) ou por entidade única (`getFacilities`). Para a distribuição territorial de Saúde (E7-A), foi adicionada **uma função de leitura nova, só leitura, mesmas tabelas**: `getHealthBedsByUf` em `packages/db/src/exec/read.ts` — uma única query agrupada por UF sobre `exec_sau_cnes_leito_v`/`exec_entity`, mesmo padrão de soma censitária já usado por `getNationalHealthSummary`. Nenhuma tabela nova, nenhuma migration, nenhum coletor.

## Decisão de escopo
Mantidos sem alteração estrutural: hero cartográfico (E6), seção de fontes/metodologia, busca territorial, navegação. Alterados: as 3 seções apontadas pelo diagnóstico do mandato (E7-A, E7-B, E7-D) e um refinamento pontual de continuidade territorial (E7-C) no painel de Saúde, o único dos 5 temas com dado elegível por UF já carregado nesta fase.
