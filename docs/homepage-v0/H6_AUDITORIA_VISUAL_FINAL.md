# H6 — Auditoria visual final

## Comparação antes/depois (inspeção real de capturas, não suposição)

| | Antes (`artifacts/h6-homepage-v0/before/`) | Depois (`artifacts/h6-homepage-v0/after/`) |
|---|---|---|
| Hero desktop | Banner escuro + `<figure>` de mapa em card claro separado, ao lado de 4 `KpiCard` brancos independentes — 3 blocos visualmente desconectados | Uma única superfície escura; mapa, legenda e os 4 indicadores dentro do mesmo painel translúcido, à direita do texto |
| Três poderes (acesso rápido) | 4ª fileira de cards brancos, separada do hero por `page-shell py-8`/`pb-10` (gap visível) | Tira anexada à base da própria superfície do hero, mesmo container `overflow-hidden`, sem gap |
| Primeira viewport mobile (390px) | Card escuro termina, surge um card claro de borda própria com o mapa — salto de cor/borda nítido | Uma superfície escura contínua: texto → busca → atalhos → painel do mapa, sem salto de cor |
| História "Gastos públicos" | Lista de 2 linhas, nenhum elemento gráfico | Número editorial grande (R$ 34,5 bi) + número secundário, peso visual real |
| Gráfico da história "Justiça" | 80px de altura | 176px de altura |
| Mapa da história "Educação" | 220px | 300px, com legenda de faixas |
| Cartão "Executivo" (três poderes) | 2 caixas de KPI empilhadas, sem elemento gráfico | Mapa coroplético de população por UF + 2 KPIs |
| Cartão "Judiciário" (três poderes) | 2 caixas de KPI empilhadas, sem elemento gráfico | Gráfico de barras "Balanço de 2025" (entradas × baixas) + 2 KPIs |

Capturas comparáveis: `h6-before-1440-first.png` × `h6-after-1440-first.png`; `h6-before-1440-full.png` × `h6-after-1440-full.png`; `h6-before-390-first.png` × `h6-after-390-first.png`; `h6-before-390-full.png` × `h6-after-390-full.png`.

## Evidências adicionais capturadas
Desktop: 1024px, 1280px, 1440px (primeira viewport e página inteira), 1920px (verificação de overflow). Mobile: 320px, 390px, 768px (primeira viewport e página inteira). Interação: busca aberta com resultados federados reais (`h6-search-open.png`, buscando "Acre" → retorna o estado e 4 municípios reais com nomes que contêm "Acre").

## Achado corrigido nesta fase: colisão de texto em 1024-1279px
Documentado em detalhe em `H6_RECONSTRUCAO_EDITORIAL.md` §3. Resumo: a grade de 4 indicadores virava 4 colunas numa largura de painel insuficiente, fazendo "214.211.951" colidir com "5.571". Corrigido (breakpoint da grade movido para `xl`, valores com `clamp()`) e reverificado com captura em 1024px e 1280px — sem colisão.

## Responsividade e console
Script real contra o servidor de dev, larguras 320/375/390/430/768/1280/1920: HTTP 200, **0px de overflow horizontal em todas**, 0 erros de console novos (exclui o aviso pré-existente `<svg height="auto">`, presente em todo o produto), 0 ocorrência de `NaN`/`undefined`/`Infinity`/`[object Object]`.

## Acessibilidade (axe-core real)
Mesmas 2 categorias de violação já documentadas em `H5_QA_E_ACESSIBILIDADE.md` (`label-content-name-mismatch`, `nested-interactive`), mesma causa raiz pré-existente no componente de mapa compartilhado (`brazil-map-markup.ts`/`state-map-paint.ts`, replicada também em `/estados` e `/executivo`). A contagem de nós subiu (54→81 e 2→3) porque H6 passou a usar o mapa **três vezes** na mesma página (hero, Educação, Executivo) em vez de duas — mesmo defeito pré-existente, mais instâncias do mesmo componente, não uma categoria nova de problema. Não corrigido nesta fase pela mesma razão já registrada: é um defeito do componente compartilhado, fora do escopo deste mandato de composição visual.

## Regressão e2e
Suíte completa (`cadastro.spec.ts` + `ux-busca.spec.ts`, 25 testes) re-executada após a reconstrução. Os 3 testes que tocam diretamente a home/busca (headline, conteúdo real, busca federada) continuam verdes. As 4 falhas remanescentes são exatamente as já isoladas, investigadas e documentadas como pré-existentes e não relacionadas (3 falhas de reformas já mescladas antes desta sessão — ver `H5_QA_E_ACESSIBILIDADE.md` — e 1 flakiness confirmada de concorrência de workers, que passa isolada). **Nenhuma regressão nova** introduzida pela reconstrução de H6.

## Typecheck
Isolado (`NEXT_DIST_DIR`), limpo, 0 erros — reexecutado duas vezes durante H6 (hero/histórias e três-poderes; indicadores após a correção de colisão).

## Segurança arquitetural
Mudança exclusiva de apresentação em `apps/web/app/page.tsx`. Nenhuma migração, alteração de schema, backfill ou coleta tocada.

## Status dos gates

| Gate | Status | Nota |
|---|---|---|
| G1 — Fidelidade conceitual | PASS | Hero, histórias, três poderes, território, perguntas, transparência — todos presentes, mesma ordem |
| G2 — Fidelidade composicional | PASS | Hero é uma composição única (texto+mapa+indicadores integrados), não mais 3 blocos |
| G3 — Impacto da primeira tela | PASS_WITH_CAVEATS | Primeira viewport mobile e desktop comunicam a identidade de forma unificada; avaliação final de "impacto" é do usuário |
| G4 — Data storytelling | PASS | As 3 histórias têm visualização própria com peso real; Gastos públicos usa stat tile grande em vez de gráfico fabricado, por integridade de dados |
| G5 — Mobile editorial | PASS | Composição única no hero mobile, sem salto de cor/borda; demais seções adaptadas, sem overflow em 320-430px |
| G6 — Integridade de dados | PASS | Nenhum valor novo inventado nesta fase; os 2 mapas novos (população no Executivo, balanço no Judiciário) usam dado já carregado, real, com fonte citada |
| G7 — Qualidade funcional | PASS | Busca federada testada ao vivo (abre, filtra, seleciona); links e CTAs verificados por HTTP 200 em H4/H5 |
| G8 — Acessibilidade | PASS_WITH_CAVEATS | 2 violações pré-existentes do componente de mapa compartilhado, não introduzidas nem corrigidas nesta fase |
| G9 — Performance | NOT_EVALUATED | Sem medição de LCP/CLS de campo nesta fase; fora do que foi possível verificar com as ferramentas disponíveis neste ambiente de dev isolado |
| G10 — Segurança arquitetural | PASS | Nenhuma alteração em banco, coletores ou pipelines |

## Problemas residuais conhecidos (não corrigidos, fora de escopo deste mandato)
- 2 violações de acessibilidade pré-existentes no componente de mapa compartilhado (G8).
- 4 falhas de e2e pré-existentes/flakiness de paralelismo, já documentadas e não relacionadas a este trabalho.
- `/executivo` mantém, desde antes desta sessão, um link para `/obras` (rota de listagem inexistente).
- G9 (performance) não avaliado com métricas de campo — recomendação para uma fase dedicada se isso for prioridade.

## Status final: READY_FOR_USER_VISUAL_APPROVAL

A reconstrução resolve diretamente os três problemas apontados pelo usuário: o hero deixou de ser "banner + mapa separado + cards de KPI" e passou a ser uma composição única; as histórias de dados ganharam peso visual real, incluindo a que não tinha gráfico nenhum; os três módulos de poder ganharam identidade visual própria e diferenciada. A aprovação visual definitiva, como o mandato pede explicitamente, é do usuário.
