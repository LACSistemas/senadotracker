# Gráficos, comparadores e metodologia — P14.8

## Tipos de gráfico usados

| Gráfico | Onde | Por quê |
|---|---|---|
| `MultiLineChart` | Panorama ("A fila da Justiça"), perfil de tribunal (Capítulo Atividade), tema (Evolução histórica) | Evolução anual; sem rótulo de valor em todo ponto (só hover + tabela "ver dados") — legível mesmo com 17 anos |
| `RankedBars` | Comparador, tema ("Por tribunal") | Distribuição institucional sem ranking qualitativo — mostra o valor de cada tribunal, nunca "melhor/pior" |
| `KpiCard`/`KpiGrid` | Todas as páginas | Número com significado quando há um; nunca número gigante sem contexto (sempre com período e cobertura) |

Nenhum donut, velocímetro, gráfico 3D, pseudo-mapa municipal ou eixo truncado de forma enganosa foi usado — nenhum desses padrões existe nos componentes reaproveitados (`charts.tsx`), então não havia como introduzi-los sem construir algo novo, o que não foi necessário.

## Achado real: `LineChart` com 17 pontos

`LineChart` (single-series) rotula **cada ponto** do eixo X com o valor formatado — funciona bem com poucos pontos, mas com uma série de 17 anos (2009–2025) os rótulos colidem e ficam ilegíveis. Isso foi confirmado numa captura de tela real do perfil do TJES (não suposição): números como "233,7 mil84,9 mil87,2 mil" sobrepostos. A correção foi trocar para `MultiLineChart` (que não rotula todo ponto, só mostra no hover e na tabela "ver dados do gráfico") nas duas páginas afetadas (perfil de tribunal, tema) — sem alterar `LineChart` em si, que continua servindo outras páginas do produto sem mudança.

## Comparador — guardas reais

- Sem seleção (menos de 2 tribunais): `EmptyState` orientando a escolher, nunca gráfico vazio.
- Indicador com `comparison_eligible=false`: mensagem explícita "Esses indicadores não são diretamente comparáveis", nunca gráfico numérico inválido. (Nesta revisão, todos os indicadores gerais e temáticos testados têm `comparison_eligible=true` — a mensagem existe e está testada por código, mas não foi observada em dado real porque não há indicador marcado como não-comparável na revisão atual.)
- Indicador comparável mas sem dado publicado para os tribunais escolhidos: `EmptyState` "Sem dado publicado para este recorte".
- Comparação válida: `RankedBars` com o valor de cada tribunal, tribunais sem dado listados à parte ("X tribunal(is) sem dado publicado... não entram no gráfico, não viram zero"), nunca uma nota de melhor/pior.

Validado com dado real: `JN_DISPOSED`, TJES (443.736) × TJRJ (2.765.806), 2025 — mesmo valor de TJES aparece de forma consistente no perfil institucional e no comparador (checagem cruzada manual).

## Metodologia — padrão de investigação progressiva

`MethodologyPanel` implementa descoberta → exploração → metodologia: o número aparece primeiro (KPI grande), a explicação de disponibilidade logo abaixo (`JudiciaryAvailabilityNote`), e a metodologia completa (fórmula, numerador, denominador, universo, grão, anos, edição, regra de ausência, referência) fica num `<details>` fechado por padrão — nunca escondida, sempre a um clique.

## Interatividade

Tooltip no hover de cada ponto de linha (valor exato via `<title>` SVG, nativo e acessível), tabela de dados alternativa em todo gráfico (`<details>` "Ver dados do gráfico"/"Ver comparação mensal"), navegação por teclado no `ChapterNav` (links reais com `href="#id"`, não divs clicáveis), filtros em formulários nativos (`FilterBar`) que preservam estado via query string e funcionam com back/forward do navegador (sem estado de cliente para isso).

## Performance

Server Components em todas as 8 rotas (`export const dynamic = 'force-dynamic'`, SSR a cada requisição, sem fetch no cliente). Cada página faz um número fixo e pequeno de consultas em paralelo (`Promise.all`), nunca uma consulta por item de uma lista — o perfil de tribunal, por exemplo, faz no máximo 6 chamadas paralelas (perfil, série de um indicador, STJ overview condicional, 6 chamadas de tema em paralelo via `Promise.all`, nunca sequenciais). Paginação real em diretório e explorador STJ (nunca a lista inteira carregada). Cache de 5 minutos evita recomputar a mesma consulta entre requisições próximas. Não foi medido p95 de página nesta fase (os números de P14.7/P14.7-R citados no mandato são benchmarks de serviço, não de página) — ver `TESTES_E2E_BUILD_PERFORMANCE.md` para o que foi de fato medido.
