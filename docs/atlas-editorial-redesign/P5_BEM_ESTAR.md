# P5 — Redesenho temático: Bem-estar (sub-fase 4/5)

Base: `P0_AUDITORIA_TERRITORIAL.md`, `P1_DESIGN_SYSTEM.md`, `P2_PILOTO_MUNICIPAL.md`, `P3_ATLAS_VIVO.md`,
`P4_INVESTIGACAO_E_COMPARADORES.md`, `P5_SAUDE.md`, `P5_EDUCACAO.md`, `P5_SEGURANCA.md` (todos
`PASS_WITH_CAVEATS`). Mesmo padrão já estabelecido nas 3 sub-fases anteriores de P5: `ChapterNav
layout="sidebar"` ativado sem editar o componente compartilhado; hero com a narrativa real já calculada
em vez de texto genérico fixo, com `hideLede` para não duplicar a frase dentro da própria página.

## Escopo tocado (confirmado por `git status`)

Só 3 arquivos, todos dentro do escopo autorizado desta sub-fase:
- `apps/web/components/wellbeing/wellbeing-page.tsx`
- `apps/web/app/estados/[uf]/bem-estar/page.tsx`
- `apps/web/app/municipios/[ibge]/bem-estar/page.tsx`

`components/wellbeing/territory-compare.tsx` e `lib/wellbeing/types.ts` aparecem como `M` no `git status`,
mas são mudanças herdadas da Fase P4 (consolidação do comparador em `lib/comparison/*` — shim de
3 linhas), não desta sub-fase. Nenhum arquivo compartilhado (`chapter-nav.tsx`, `security-ui.tsx`,
`security-hero.tsx`, `trend-chart.tsx`, `indicator-live.tsx`, `components/comparison/*`,
`territory-compare.tsx`, `chapter-states.tsx`, `state-frame.tsx`, `territory-ui.tsx`, `charts.tsx`,
`metrics.tsx`, `scale.ts`) foi editado. Nenhum arquivo de outro tema foi tocado.

## O que foi redesenhado

### 1. Sidebar de capítulos
`ChapterNav` ganhou `layout="sidebar"` (mesmo padrão exato de Saúde/Educação/Segurança — wrapper
`lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-10`, conteúdo em `min-w-0 space-y-10`).
Bem-estar nunca teve navegação por capítulo em coluna fixa — eram 8 itens (Retrato + 6 capítulos + Fontes)
só como faixa horizontal sticky.

### 2. Hero sem duplicação de frase
Os 2 `page.tsx` trocaram o `lede` estático e genérico ("O que se sabe, com fonte e cobertura à
vista...") por `data.portrait.lede` — a frase real já calculada por `portraitLede()`
(`lib/wellbeing/narrative.ts`), que varia com o número de fatos publicados para aquele território (ex.
"Um retrato de Vitória a partir de 4 fontes oficiais diferentes — cada fato com seu próprio ano e
cobertura, sem formar um índice único."). `WellbeingPage` ganhou a prop `hideLede` (mesmo padrão de
`HealthPanel.hideLede` de P5.1) para não repetir a mesma frase dentro da própria seção "Retrato".

### 3. Indicador Vivo nos fatos do retrato — fecha a lacuna real documentada desde P1
P1/P2/P4 documentaram, de forma honesta e repetida, que Bem-estar nunca tinha usado `IndicatorLive`
porque `PortraitFact` (label/value/unit/period/source) não tem `delta`/`spark`/`ruler`. A Fase P4 já havia
construído o adaptador exato para isso (`portraitFactToKpi`, `lib/comparison/kpi-adapters.ts`) mas nunca o
aplicou a uma página real. Esta sub-fase é a primeira aplicação real: os até 4 fatos do Retrato (renda
mediana, vínculos RAIS, saldo Caged, CRAS) agora renderizam como `IndicatorLive` (Nível 1 via `KpiCard`,
o mesmo componente que Segurança/Educação já usam — zero componente visual novo), o primeiro com `lead`
(cartão maior, fundo `#e8f3ee` — a MESMA cor pastel que os cartões de fato já usavam antes, então a
identidade visual da seção não mudou, só ganhou o chrome padronizado do produto: badge de período, fonte
no rodapé, link "Explorar").

Adicionei `factChapterAnchor()` (função local, não no arquivo de adaptadores compartilhado) que mapeia o
rótulo do fato para o capítulo mais provável (`Renda` → `condicoes`, `RAIS`/`Caged` → `trabalho`, `CRAS` →
`rede-social`) para o link "Explorar →" do `KpiCard` apontar para algum lugar real em vez de `#` — mesma
limitação cosmética que P4 já havia documentado para os outros usos de adaptador (quando não há âncora,
cai em `#`, nunca quebra).

**Limite honesto, não escondido**: `portraitFactToKpi` só cobre Nível 1 (Descobrir) — sem Nível 2
(`chart`) nem comparação nativa (`delta`/`ruler` ficam `null`, como o próprio P4 documentou). Não forcei
nenhum desses dois para não inventar uma dimensão que a fonte não tem.

### 4. O que NÃO mudou — preservação de 100% do dado
Os 6 corpos de capítulo (`ChapterShell` com `BarList`/`StatGrid`/`DataTable`/`TrendChart`/
`TerritoryCompareRow`) não foram tocados por dentro — já tinham composição razoavelmente variada entre si
(barras em Condições de vida, dois `TrendChart` lado a lado com rótulos explícitos em Trabalho, grid de
Sim/Não em Cotidiano digital, tabela em Ação pública, 3 séries em Evolução). A decisão foi não reescrever
o que já funcionava e já diferenciava um capítulo do outro visualmente — risco desnecessário para o ganho
limitado, mesmo raciocínio que P5.1 (Saúde) aplicou aos seus 4 painéis.

A distinção central do tema — **fluxo mensal (Novo Caged) × estoque anual (RAIS)** — continua
explicitamente rotulada: os dois `TrendChart` em "Trabalho" mantêm os títulos "Admissões, desligamentos e
saldo mensal" e "Estoque anual (RAIS)" exatamente como antes, e a narrativa (`workNarrative`, não tocada)
segue explicando a diferença em texto. Autodeclarado × verificado também preservado: a seção "Cotidiano
digital" continua com o aviso de que é resposta declarada pela prefeitura ao MUNIC, não serviço auditado.
`TerritoryCompareRow`/distribuição de pares (de P4) não foram alterados, só continuam sendo chamados
exatamente como antes (`conditions.incomeCompare`).

## Verificação

- `NEXT_DIST_DIR=.next-p5wb npm run typecheck` (workspace `@senadotracker/web`, isolado) — limpo, 0 erros.
- `NEXT_DIST_DIR=.next-p5wb npx next build` — sucesso.
- Servidor isolado (`next start -p 3160`) — porta 3000 do usuário confirmada respondendo normalmente
  antes e depois (nunca tocada); servidor isolado derrubado ao final, `.next-p5wb` removido.
- `npx playwright test tests/e2e/p14-territorio-executivo.spec.ts tests/e2e/wellbeing-p128.spec.ts` contra
  o build isolado — **25/25 passaram**, incluindo o teste de teclado (`ChapterNav` e disclosures com foco
  visível), os 2 testes de `TerritoryCompareRow`/comparação de território, e os 2 testes de "ausência
  honesta" em municípios pequenos (Boa Esperança do Norte/MT, Alto Rio Novo/ES) — confirma que a troca dos
  cartões de fato para `IndicatorLive` não regrediu nenhum desses casos.
- 10 screenshots reais (`artifacts/p5-bem-estar/{estado-es,municipio-vitoria}-bem-estar-w{1440,1280,768,
  390,320}.png`) — **0px de overflow horizontal e 0 erros de console nas 10 combinações**, conferido por
  script Playwright dedicado (`waitUntil: 'networkidle'` + 500ms de estabilização).
- Inspeção visual direta do screenshot de 1440px (estado): sidebar de capítulos visível, cartão de renda
  em destaque (`lead`, fundo pastel) seguido de 3 cartões `IndicatorLive` menores, os 6 capítulos com
  composições distintas entre si preservadas (barras, dois gráficos de linha lado a lado, grid de
  respostas Sim/Não, tabela financeira, 3 séries de evolução).

## Necessidades de mudança em arquivo compartilhado — nenhuma identificada

Diferente de P5.2/P5.3, esta sub-fase não encontrou nenhuma necessidade real de alterar um arquivo fora
do escopo autorizado.

## Status do Gate

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: sidebar de capítulo ativada sem regressão (25/25 e2e, incluindo teclado),
duplicação de frase no hero eliminada, lacuna de `IndicatorLive` para Bem-estar (documentada desde P1)
finalmente fechada usando o adaptador que P4 já havia construído mas nunca aplicado, 100% dos capítulos/
filtros/comparador/séries preservados, 0 overflow novo, 0 erro de console novo.

Ressalvas que impedem um `PASS` puro:
1. `IndicatorLive` aplicado só na seção Retrato (até 4 fatos) — os 6 corpos de capítulo não foram
   recompostos por dentro (decisão deliberada de preservar o que já funcionava, mesmo critério de P5.1).
2. `portraitFactToKpi` cobre só Nível 1 — Bem-estar continua sem Nível 2 (gráfico) no indicador individual
   fora dos capítulos, por limite real da fonte (`PortraitFact` nunca carrega `ChartView`), não por
   escolha de composição.
3. Cobertura de verificação visual em 1 estado (ES) + 1 município (Vitória) — representativo, não
   exaustivo.

Nenhum impedimento bloqueia a sub-fase final de P5 (Infraestrutura).
