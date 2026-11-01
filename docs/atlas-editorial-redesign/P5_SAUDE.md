# P5.1 — Redesenho temático: Saúde

Primeira sub-fase da FASE P5 (redesenho temático completo). Escopo rígido: só arquivos do tema Saúde
(`app/estados/[uf]/saude`, `app/municipios/[ibge]/saude`, `components/territory/{health-section,health-panel,
evolution-panel,residents-panel,hospitals-panel}.tsx`, `lib/health-bench.ts`) — nenhum arquivo compartilhado
foi editado, só consumido (`ChapterNav` de `components/security/chapter-nav.tsx`, importado sem modificação).

## Decisão de arquitetura: manter o fluxo único, adotar `ChapterNav` por cima dele

P0 confirmou que Saúde é estruturalmente diferente dos outros 4 temas: mais antiga, sem capítulos
numerados — um fluxo de 4 painéis (`HealthPanel` → `EvolutionPanel` → `ResidentsPanel` → `HospitalsPanel`)
mais "Fontes". Avaliadas as 2 opções do mandato:

- **(a) Migrar para `ChapterShell`** (como Educação/Segurança/Bem-estar/Infraestrutura): rejeitada. Cada
  painel de Saúde já tem cabeçalho, narrativa e visualização próprios e estruturalmente diferentes entre si
  (donut + tabela de leitos + tabela de vacinas; gráfico de linha com abas; calendário de calor; lista
  ranqueada de hospitais) — forçar isso no molde `ChapterShell` (narrative/limits/sources genéricos)
  exigiria reescrever 4 componentes maduros e arriscar quebrar comportamento client-side real (abas do
  `EvolutionPanel`, hover do gráfico) sem ganho real: Saúde já não sofre do "esqueleto repetitivo
  eyebrow→título→KPIs→CTA" que motivou o `ChapterShell` nos outros temas.
- **(b) Preservar o fluxo, elevar por cima** — escolhida. Mantém 100% dos 4 componentes como estão por
  dentro (zero risco de regressão de dado/interação) e resolve a lacuna real que **é** compartilhada com os
  outros temas: Saúde nunca teve navegação por capítulo (Parte IV.8.3 do mandato). Isso foi corrigido
  importando (não editando) o `ChapterNav` que P1 construiu, com `layout="sidebar"` — primeira página do
  produto a efetivamente usar essa variante fora do Atlas Vivo.

## O que mudou de verdade

1. **Navegação por capítulo, pela primeira vez em Saúde** (`health-section.tsx`): sidebar persistente no
   desktop (≥1024px), faixa horizontal abaixo disso — 5 âncoras reais (`painel-saude`, `evolucao`,
   `moradores`, `quem-atende`, `fontes`), cada uma com `available` calculado a partir da presença real do
   dado (não hardcoded). Exigiu dar uma âncora estável a cada seção: `EvolutionPanel` usava só `useId()`
   internamente (muda a cada render, não serve de âncora) — ganhou uma prop `id` nova e opcional, sem
   call site além do de Saúde. `ResidentsPanel`/`HospitalsPanel`/`HealthPanel`/a seção de Fontes passaram a
   seguir a mesma convenção `id` na `<section>` + `id="-h"` no `<h2>` já usada por Infraestrutura/Educação
   (antes, o `id` ficava só no `<h2>`, sem `scroll-mt-28` — corrigido para não ficar embaixo do nav
   sticky).
2. **Abertura editorial com manchete real** (`lib/health-bench.ts`, `page.tsx` × 2): o hero da página
   (`TerritoryFrame`'s `lede`) antes mostrava um texto genérico fixo ("Rede cadastrada, leitos e
   indicadores..."); agora mostra `healthLedeFor(...)`, a mesma frase comparativa real que o
   `HealthPanel` já calculava internamente (ex.: *"Leitos hospitalares existentes por mil habitantes em
   Vitória está na faixa mais alta entre 78 municípios de Espírito Santo; 5 de 8 vacinas prioritárias estão
   abaixo da meta"*) — nunca inventada, escolhida pelo indicador mais afastado da mediana do grupo, com
   fallback honesto ao texto genérico quando não há posição comparável. Refatoração sem duplicar lógica:
   extraí `healthPanelCards()` e `healthLedeFor()` de dentro do `HealthPanel` para `health-bench.ts`, e o
   próprio `HealthPanel` passou a chamar essas funções (zero mudança de comportamento ali).
3. **Bug real encontrado e corrigido no mesmo ciclo**: a primeira versão mostrava essa mesma frase **duas
   vezes** na página (hero + subtítulo do "Painel de Saúde", que já a calculava de forma idêntica).
   Corrigido com uma prop nova `HealthPanel.hideLede` (default `false`) — `health-section.tsx` passa
   `hideLede` porque o hero já mostra a frase; os 2 outros call sites de `HealthPanel` (teaser compacto da
   visão geral de estado e de município, que não têm hero de Saúde) continuam mostrando normalmente.
   Confirmado por contagem de ocorrências visíveis (`document.body.innerText`) antes/depois do fix: estado
   caiu de 2 para 1; no município, a investigação mostrou que as "ocorrências extras" restantes eram
   legendas de `BenchRuler` por card (`"faixa mais alta entre 78 municípios..."`), conteúdo legítimo e
   diferente, não duplicação.
4. **Consistência visual interna**: `HealthPanel` era o único dos 4 painéis sem chip de ícone no cabeçalho
   (os outros 3 já tinham: `TrendingUp`/`Home`/`Hospital` em um `IconBox` colorido). Ganhou o mesmo
   tratamento (`Activity`, tom azul) — alinha o "capítulo 1" implícito ao padrão visual dos outros 3, sem
   tocar nos cards internos (7 KPIs + vacina + donut + tabela de leitos + tabela de vacinas, todos
   idênticos ao que eram).

## O que NÃO mudou (preservação de 100% do dado)

Nenhum valor, unidade, período, fonte, flag de qualidade (`preliminar`/`pequeno número`/`sem denominador`),
régua de benchmark, aba do `EvolutionPanel`, linha do calendário de internações ou linha da lista de
hospitais foi alterado. Confirmado por:
- Leitura completa dos 4 componentes antes de editar (nenhuma query, nenhum cálculo de `benchFor`/
  `quintileOf`/`trendOf`/`vaccineRows` foi tocado — só os wrappers de apresentação ao redor).
- Comparação visual direta dos screenshots desta fase (`artifacts/p5-saude/`) contra os de referência de
  P0 (`artifacts/p0-auditoria/*saude*`): mesmos 7 KPIs, mesmo donut, mesma tabela de leitos, mesmo gráfico
  de evolução com as mesmas 4 abas, mesmo calendário de calor, mesma lista de hospitais.

## Necessidade de arquivo compartilhado identificada, não executada

Nenhuma. Diferente do que o escopo desta fase antecipava como possível, não foi necessário pedir nenhuma
mudança em `chapter-nav.tsx`, `security-ui.tsx` ou qualquer outro arquivo fora do tema — o `ChapterNav` de
P1 já suportava exatamente o que Saúde precisava, sem modificação.

## Verificação

- `NEXT_DIST_DIR=.next-p5saude npm run typecheck` (workspace `@senadotracker/web`, isolado) — limpo, 0
  erros, nas duas rodadas (antes e depois do fix de duplicação).
- Build de produção isolado + servidor isolado (`next start -p 3156`) — precisou de `DB_HOST/DB_PORT/
  DB_NAME/DB_USER/DB_PASSWORD` exportados do `.env` da raiz antes de subir (mesmo padrão de fases
  anteriores); porta 3000 do usuário nunca tocada, confirmada respondendo normalmente ao final.
- `npx playwright test tests/e2e/p14-territorio-executivo.spec.ts tests/e2e/infraestrutura-p137.spec.ts`
  contra o build isolado — **40/40 passando**, incluindo as 2 regressões que tocam `/saude` diretamente
  ("saúde (município) continua respondendo 200 sem erro de console", presente nos dois arquivos).
- 10 screenshots reais (`artifacts/p5-saude/{estado-es-saude,municipio-vitoria-saude}-w{1440,1280,768,390,
  320}.png`) — **0px de overflow horizontal em todas as 10 combinações**, confirmado por script
  (`document.documentElement.scrollWidth - clientWidth`), e 0 erros de console.
- Conferência visual direta da sidebar: aparece como coluna lateral a partir de 1024px (`estado-es-saude-
  w1440.png`), vira faixa horizontal abaixo disso (`...-w768.png`, `...-w390.png`) — comportamento
  responsivo correto nas 2 variantes do componente.
- Isolados (`.next-p5saude`, servidor na porta 3156) removidos ao final.

## Status do Gate

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: navegação por capítulo chega a Saúde pela primeira vez (lacuna real
documentada em P0), abertura editorial deixa de ser texto genérico fixo e passa a citar um fato real e
comparável, consistência visual entre os 4 painéis melhora, 100% do dado/fonte/filtro/interação
preservado, typecheck limpo, 40 e2e reais passando, zero overflow novo, um bug real (duplicação de texto)
encontrado e corrigido no próprio ciclo antes de reportar.

Ressalvas que impedem um `PASS` puro:
1. A composição interna de cada painel não mudou (decisão deliberada, ver seção de arquitetura) — o ganho
   desta fase é navegação + abertura editorial + consistência de cabeçalhos, não uma reformulação visual
   de cada card. Os 4 painéis já eram visualmente diferenciados entre si antes desta fase (ao contrário do
   padrão repetitivo que motivou o tratamento de outros temas), então o risco/benefício de reescrevê-los
   não se justificava aqui.
2. Não foi adicionado nenhum adaptador para `IndicatorLive`/`TerritoryCompareRow` (P1/P4) — os tipos de
   Saúde (`PanelValue`, `BenchState`) são suficientemente diferentes de `Kpi`/`ChartView` que um adaptador
   real exigiria investigação própria, fora do tempo desta sub-fase; Saúde já tem seu próprio sistema de
   benchmark (`BenchRuler`, quintis) que cobre a mesma necessidade de "comparação com contexto" de forma
   nativa — não é uma lacuna funcional, só uma não-unificação de componente.
3. Cobertura de verificação ficou em 1 estado (ES) + 1 município (Vitória) — representativo, não
   exaustivo.

Nenhum impedimento para a próxima sub-fase (Educação).
