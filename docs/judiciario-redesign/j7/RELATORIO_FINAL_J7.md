# J7 — Reconstrução editorial do Judiciário — Relatório final

Mandato: elevar `/judiciario` ao mesmo nível de exigência visual da homepage H7, com identidade própria (movimentação processual, tempo, instituições, temas), não um clone do template da home. Documentos de fase: `J7_0_AUDITORIA_VISUAL.md`, `J7_1_HERO_E_MOVIMENTACAO.md`, `J7_2_TEMPO_E_INSTITUICOES.md`, `J7_3_TEMAS_E_STORYTELLING.md`, `J7_4_MOBILE_E_UX.md`, `J7_5_AUDITORIA_FINAL.md`.

## Arquivos alterados
- `apps/web/app/judiciario/page.tsx` — reconstrução de hero, aside de ramos, seção de congestionamento, seção de temas.
- `packages/db/src/postgres-judiciary-serving.ts` — nova função `getJudiciaryIndicatorDistribution` (só leitura).
- `packages/db/src/index.ts` — export da nova função.
- `apps/web/lib/judiciary.ts` — wrapper `loadJudiciaryIndicatorDistribution` (mesmo padrão de cache dos demais).

## O que foi reconstruído

1. **Hero**: de "banner + ilustração decorativa + 4 KPIs separados" para uma composição única com gráfico real integrado (casos novos×baixados, 6 anos) e os 4 indicadores no mesmo painel.
2. **Ramos da Justiça**: de lista com contagens hardcoded para barras com contagem real de instituições por ramo (dado já carregado, sem consulta nova).
3. **Congestionamento e tempo**: de puramente textual para uma distribuição real entre os 91 tribunais (min/mediana/max + pontos individuais) — resolve a tensão entre "não existe taxa nacional válida" e "precisa ter uma visualização", mostrando variação real em vez de inventar uma média.
4. **Temas**: de 6 cartões uniformes para 1 tema em destaque (Violência doméstica, critério explícito documentado) com comparação real de 2 barras, mais 5 temas em lista compacta.
5. **Mobile**: o gráfico real do hero aparece na primeira viewport, antes dos KPIs — não mais "hero → 4 cards → gráfico pequeno".

## Dados e fontes citados
Congestionamento: TRE-BA (mín., 6,4%), mediana 50,2%, TJES (máx., 71,0%) — CNJ, Justiça em Números, 2025, 91 tribunais. Ramos: Eleitoral 28, Estadual 27, Trabalho 25, Federal 6, Militar Estadual 3, Superiores 2, STF 1. Violência doméstica: 7.068.785 casos novos, 6.984.025 baixados — CNJ, 2025.

## Achado real corrigido
Um rótulo de texto ("mediana X%") usava a cor da marca gráfica diretamente, causando uma violação séria de contraste (2,19:1, abaixo do mínimo WCAG 2.2 AA de 4,5:1) — identificada por axe-core real, corrigida na mesma fase (texto voltou à tinta padrão, só a marca visual carrega a cor).

## Testes
`tests/e2e/p148-judiciario.spec.ts`: 23/23 passaram, incluindo o teste que impede explicitamente uma taxa de congestionamento nacional falsa. Typecheck isolado limpo. axe-core real: 0 violações após a correção de contraste. Responsividade: 0 overflow em 320-1920px (exceto 11px pré-existentes e não relacionados no cabeçalho global em 1024px).

## Limitações
- Performance de campo (LCP/CLS/INP) não medida — sem RUM neste ambiente de desenvolvimento isolado.
- A "Justiça em movimento" (gráfico principal) foi mantida majoritariamente como estava — já atendia ao critério de protagonismo antes desta fase; o esforço foi direcionado às 3 seções que de fato estavam abaixo do padrão (hero, congestionamento, temas).

## Segurança arquitetural
Nenhuma migration, backfill, alteração de schema ou interrupção de coletor. Única adição de backend é uma função de leitura pura, sem efeito colateral.

## Status: J7_READY_FOR_USER_VISUAL_REVIEW

Prosseguindo para E6 (Executivo), preservando integralmente o resultado de J7.
