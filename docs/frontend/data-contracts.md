# Contratos de dados da interface legislativa

Este documento é o inventário vinculante da fase 2. Números da interface vêm de lotes ativos do SQLite. Uma ausência fica nula e recebe cobertura; ela nunca vira zero, média ou tendência.

## Contrato comum

Cards, tabelas e pontos de série carregam `value` e `coverage`. A cobertura informa `availability` (`available`, `partial`, `unavailable`, `stale` ou `not_applicable`), `source`, período (`from`, `to`, `grain`), `batchId`, `note` e `sampleSize`. Séries usam um ponto por período solicitado; períodos sem observação têm `value: null` e cobertura `unavailable`. Quartis usam interpolação linear R-7. Distribuições incluem somente pessoas com uma observação válida e informam esse universo em `sampleSize`.

## Matriz tela × métrica × dado

| Tela | Métrica ou conteúdo | Tabela/consulta | Cobertura atual | Fallback obrigatório |
| --- | --- | --- | --- | --- |
| `/` | Casas, caminhos e fontes | conteúdo institucional; `active_publications` para estado | Senado e Câmara | CTA sem contagem; informar banco indisponível |
| `/legislativo` | parlamentares, UFs e partidos por Casa | `publishedHousePanorama` sobre `profiles` do lote ativo | snapshot disponível quando há cadastro | card indisponível, sem zero |
| `/legislativo` | distribuição de cota | `publishedHousePanorama` sobre totais individuais de `expenses` | por Casa/ano com lote ativo | distribuição vazia e nota de cobertura |
| `/legislativo/senadores` | lista, partido, UF | `listPublished`, `publishedFacets` | cadastro atual | estado vazio com origem |
| `/legislativo/deputados` | lista, partido, UF | `listPublished`, `publishedFacets` | cadastro atual | estado vazio com origem |
| listagens por Casa | cota, mediana, quartis e faixa | `publishedHousePanorama`; somente pessoas com despesa vinculada | anos dos lotes CEAPS/CEAP | nulo; nunca incluir ausentes como zero |
| listagem Senado | folha de gabinete | `expanded_costs`, rubrica `cabinet_payroll_gross` | parcial: competência 08/2026, 79 vínculos seguros | mostrar competência, amostra e parcialidade |
| listagem Câmara | folha de gabinete | futuro lote `expanded_costs` | indisponível | card/coluna indisponível e metodologia |
| perfil | identidade, mandato e filiação | `getPublished`; `profiles`, `mandates`, `exercise_periods`, `party_memberships` | lote cadastral ativo; histórico pode ser parcial | rótulo de parcialidade e fonte |
| perfil | despesas de cota e categorias | `publishedExpenses`; `expenses` | conforme anos ativos por Casa | nenhum registro no período, sem custo total |
| perfil | presença e participação | `publishedParticipation`; `presence_*`, `legislative_*` | cobertura distinta por Casa, ano e universo | numerador/denominador nulos e nota; falta de voto não é ausência |
| perfil | votações nominais | `publishedVotes`; `deliberations`, `legislative_votes` | lotes legislativos ativos | lista vazia com período e fonte |
| perfil | propostas, autoria, relatoria e leis | `publishedActivity`; tabelas `activity_*` | parcial conforme escopo publicado | métricas separadas e indisponibilidade explícita |
| perfil | comissões, cargos e complementos | `publishedComplement`; `legislative_complements` | parcial conforme serviço oficial | omitir contagem e explicar cobertura |
| perfil | subsídio, gabinete, equipe | `publishedExpandedCosts`; `expanded_costs`, `cabinet_*` | Senado parcial; Câmara indisponível | rubricas separadas; nunca “custo total” |
| perfil | eleições, campanha e bens | `publishedElections`, `publishedElectoralCoverage`; tabelas eleitorais | indisponível enquanto o TSE bloquear o lote | painel indisponível com tentativa/lote, sem zeros |
| perfil | evolução histórica | `historicalSeries` sobre lotes publicados | esparsa por domínio | ponto nulo visível, sem interpolação |
| `/legislativo/partidos` | representação e métricas por partido | perfil ativo e filiação válida no período; agregações futuras F2-043 | cadastro disponível; demais por lote | separar Casa/período e declarar amostra |
| `/quem-me-representa` | representantes por UF | `listPublished` filtrado por Casa e UF | cadastro federal atual | estado obrigatório; não prometer cidade |
| `/comparar` | cota por pessoa, média e universo | `publishedExpenseComparison`; anos em `active_expense_publications` | Casa/ano compatíveis | bloquear ano sem lote; média nula em universo vazio |

## Auditoria de valores demonstrativos

| Local | Achado | Resolução |
| --- | --- | --- |
| perfil, despesas | texto “2025 e 2026”, período final e comparação mensal fixos | derivados das competências efetivamente retornadas |
| perfil, presença e votos | ano 2026 fixo nos títulos | derivado do contrato retornado ou da deliberação mais recente |
| comparador | padrão e opções 2025/2026 fixos | opções consultadas em `active_expense_publications`; ano padrão é o lote mais recente |
| metodologia | dizia que gastos, presença e votações ainda não apareciam | texto atualizado para os domínios e limitações publicados |
| textos institucionais | data de observação de 8/9/2026 | mantida apenas quando descreve aquele snapshot, acompanhada do caráter temporal |

## Conciliação manual

A amostra automatizada usa Senado `[100, 300]` (n=2, mediana=200) e Câmara `[20, 40, 60]` (n=3, mediana=40). Em ambos os casos, a contagem do cadastro e o universo de despesas coincidem porque todos os perfis da amostra têm observação. O teste também confirma que gabinete sem lote tem mediana nula e que uma lacuna entre 2024 e 2026 permanece `null` em 2025.
