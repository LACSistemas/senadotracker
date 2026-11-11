# Relatório de execução — P14.8 (Frontend do Judiciário)

## Síntese executiva

O Cívica ganhou sua primeira experiência pública do Poder Judiciário: um atlas editorial de 8 rotas, consumindo exclusivamente o serving já publicado nas fases P14.1–P14.7-R, sem recoletar nada, sem criar tabela nova e sem escrever no banco. O trabalho começou por uma auditoria direta do código-fonte do backend (não só dos documentos de fase, que são propositalmente curtos) e por smoke tests reais contra `projetoeleitor_db` — a conclusão foi que o backend estava pronto e correto, e o trabalho real era 100% de interface.

Durante a implementação, a verificação contínua (não só no fim) encontrou e corrigiu 4 problemas reais antes de qualquer captura final — ver a seção "Achados reais" abaixo. Isso é o esperado: a disciplina deste projeto é nunca declarar PASS sem renderização e dado reais.

## O que foi construído

- **8 rotas**: panorama, diretório de tribunais, perfil de tribunal (capítulos A–G adaptativos), comparador, hub de temas, página de tema, explorador de precedentes do STJ e detalhe de precedente.
- **2 módulos de leitura web** (`apps/web/lib/judiciary.ts`, `judiciary-themes.ts`): wrappers finos com cache de 5 minutos sobre as 13 funções de `postgres-judiciary-serving.ts` e as 8 de `postgres-judiciary-themes.ts` — nenhuma lógica de negócio nova, só injeção de pool e cache.
- **1 adição real ao serving** (`getJudiciaryNationalSeries`, em `postgres-judiciary-serving.ts`): série nacional multi-ano para indicadores SUM, que nenhuma função de P14.7 oferecia. Mesmas tabelas, com filtro pelas revisões ativas de `JN_STATISTICS` e `JN_THEMATIC`.
- **3 componentes novos** (`apps/web/components/judiciary/`): `JudiciaryAvailabilityNote`/`toChartCoverage` (os 10 estados de `AvailabilityState` e 6 de `ThematicAvailability` nunca colapsam na nuance "indisponível" genérica usada no resto do produto), `MethodologyPanel` (fórmula/numerador/denominador/universo/fonte em `<details>`) e `TribunalMultiSelect` (seleção de tribunais no comparador — a `ComparisonMultiSelect` existente é hardcoded para partido/estado e não serve para um `tribunal_id`).
- **1 linha de navegação**: entrada "Judiciário" em `app-header.tsx`.

Tudo o mais foi reaproveitado sem modificação: `InstitutionHero`, `DataTable`/`SearchBar`/`FilterBar`, `KpiCard`/`KpiGrid`, `BarChart`/`MultiLineChart`/`RankedBars`, `EmptyState`, e principalmente `ChapterNav` (`components/security/chapter-nav.tsx`) — um componente de navegação por capítulo já maduro, acessível e responsivo (seletor compacto no mobile, coluna lateral persistente no desktop) que resolveu a navegação do perfil de tribunal sem precisar de nada novo.

## Achados reais durante a implementação

1. **Revisão não filtrada na função nova**: a primeira versão de `getJudiciaryNationalSeries` não filtrava por `publication_revision_id`. Hoje só existe uma revisão ativa por scope (confirmado por consulta real — nenhum indicador geral tem mais de uma revisão), então o resultado estava certo por acaso, não por design. Corrigido antes da primeira captura.
2. **Tema sem indicador aparecendo como "disponível"**: `LABOR` (Relações de trabalho) tem status `PARTIAL_COVERAGE` no catálogo, mas 0 indicadores próprios nesta revisão — o hub e o panorama mostravam um cartão "0 indicadores", que é exatamente o que o mandato veda ("não apresentar indicador inexistente"). Corrigido para também exigir `indicatorCount > 0`.
3. **Rótulos sobrepostos no gráfico de 17 anos**: `LineChart` (componente compartilhado) rotula cada ponto com o valor — com 17 anos de série, os rótulos colidiam e ficavam ilegíveis (visto na própria captura de tela, não suposição). Trocado por `MultiLineChart` nas páginas de perfil e tema (mesmo padrão já limpo do panorama), sem tocar no componente compartilhado — ele continua servindo outras páginas do produto do jeito que está.
4. **"Evolução histórica" de tema mostrando série por tribunal, não nacional**: sem um tribunal selecionado, a chamada original devolvia uma linha por tribunal por ano (centenas de pontos), não uma soma nacional por ano. Corrigido: sem `?tribunal=`, usa a nova série nacional; com `?tribunal=`, usa a série do próprio tribunal (já no grão certo).

## Decisões de design herdadas do mandato

- Congestionamento nunca vira um KPI nacional somado — o panorama mostra a explicação e um link para o comparador, que já tinha o `comparison_eligible=true` certo nesse indicador (confirmado por consulta).
- O capítulo de jurisprudência só aparece no perfil do STJ (`sigla === 'STJ'`), nunca em outros tribunais.
- Seções sem dado real não renderizam (ex. "Finanças" só aparece se houver despesa JN ou fato financeiro publicado).
- A tese de um precedente, quando ausente, mostra a ausência explicada — nunca um resumo gerado.

## O que não foi feito (fora de escopo, por decisão explícita do mandato)

- Nenhum coletor novo, nenhuma tabela nova, nenhuma chamada DataJud.
- Auditoria automática de acessibilidade (axe-core) não foi executada nesta fase — ver `ACESSIBILIDADE_E_RESPONSIVIDADE.md`.
- A pendência de ACL da folha STJ (achado de uma fase anterior) permanece registrada como gate operacional, fora do alcance de um frontend.

## Estado final

23/23 testes E2E passando, typecheck limpo, build de produção isolado sem erros, 8 capturas reais sem overflow e sem erro de página. Trabalho não commitado — aguardando revisão.
