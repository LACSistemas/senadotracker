# J7.5 — Auditoria final

## Matriz de evidências

| Dimensão | Antes | Depois | Evidência |
|---|---|---|---|
| Hero | Banner + ilustração decorativa (`/judiciario-nacional.svg`), nenhum dado visível na abertura | Composição única: texto + gráfico real (casos novos×baixados, 6 anos) + 4 indicadores integrados | `j7-before-1440-first.png` × `j7-after-1440-first.png` |
| Movimentação processual | Já tinha `MultiLineChart` real 2009-2025 (ponto já maduro) | Mantido; aside de ramos reconstruída (lista plana → barras com contagem real) | `j7-after-1440-full.png` |
| Tempo e congestionamento | Puramente textual, 0 elementos gráficos | Distribuição real entre 91 tribunais (min/mediana/max, pontos individuais) | `j7-before-1440-full.png` × `j7-after-1440-full.png` |
| Temas | 6 cartões uniformes | 1 tema em destaque com comparação real de 2 barras + 5 em lista compacta | `j7-after-1440-full.png` |
| Mobile | Hero → 4 KPIs empilhados → gráfico pequeno | Gráfico real já na primeira viewport, indicadores integrados | `j7-before-390-first.png` × `j7-after-390-first.png` |
| Integridade | 32 indicadores, 93 instituições, dados CNJ | Preservados integralmente — nenhum indicador, rota ou funcionalidade removida | Testes e2e |

## Preservação funcional (inventário, mandato §23)
Confirmados intactos: indicadores (32), séries, gráfico principal, links (tribunais/comparador/temas/STJ/STF), metodologia, ramos (6, agora com contagem real em vez de hint hardcoded), tribunais, temas (6, mesmo conjunto), exploração, tabelas (`MultiLineChart`'s "ver dados do gráfico"), fontes, rota de comparação por indicador. Nenhuma funcionalidade escondida ou removida.

## Testes
- `tests/e2e/p148-judiciario.spec.ts`: **23/23 passaram**, incluindo o teste que verifica explicitamente "nunca uma taxa de congestionamento agregada falsa" — continua verde porque a nova distribuição não introduz uma média nacional, só mostra pontos individuais reais.
- Typecheck isolado: limpo, reexecutado 3 vezes ao longo da fase.
- Responsividade: 0 overflow em 320-1920px exceto os 11px pré-existentes do cabeçalho global em 1024px (mesmo problema documentado em `/estados` e na homepage, fora de escopo).

## Acessibilidade (axe-core real)
Primeira rodada: 1 violação séria nova (`color-contrast`, rótulo "mediana" com texto na cor da marca em vez de tinta padrão — 2,19:1 contra o mínimo de 4,5:1). **Corrigida nesta mesma fase** (não deixada como "pré-existente" — é um bug real que introduzimos). Segunda rodada: **0 violações**, 43 verificações aprovadas, 2 para revisão manual (mesmo residual de outras páginas do produto).

## Performance
Nenhuma biblioteca de gráficos nova; os 2 SVGs novos (hero + distribuição de congestionamento) são leves (sem `d3` ou similar, coordenadas calculadas em JS puro). Uma consulta nova (`getJudiciaryIndicatorDistribution`), SELECT único sobre uma tabela já indexada por `indicator_id`/`reference_year`. Não medido LCP/CLS de campo (sem RUM neste ambiente) — mesma ressalva de H7.

## Segurança arquitetural
Nenhuma migration, backfill ou alteração de schema. A única adição de código fora de `page.tsx` é uma função de leitura pura (`getJudiciaryIndicatorDistribution`), exportada e usada exatamente como as demais funções de serving já existentes. Nenhum coletor tocado, nenhuma interrupção de processo.

## Status: J7_READY_FOR_USER_VISUAL_REVIEW
