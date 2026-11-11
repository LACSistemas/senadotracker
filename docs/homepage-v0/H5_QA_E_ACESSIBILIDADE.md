# H5 — QA, acessibilidade e regressão

## Responsividade e console
Script Playwright real contra o servidor de dev ativo, 320/390/768/1920px: HTTP 200, **0px de overflow horizontal** em todas as larguras, 0 erros de console (excluindo o aviso pré-existente conhecido `<svg height="auto">`, presente em toda rota do produto, não introduzido aqui), 0 ocorrência de `NaN`/`undefined`/`Infinity`/`[object Object]` no texto renderizado de `<main>`.

Achado corrigido durante a verificação: em 320px, o formulário de busca territorial (`<form action="/executivo/buscar">`) causava 37px de overflow horizontal — o botão de busca com `shrink-0` sem quebra de linha em telas muito estreitas. Corrigido para `flex-col` abaixo do breakpoint `sm` (input empilha sobre o botão). Reverificado: overflow voltou a 0.

## axe-core (real, `AXE_PATH` apontando para `axe-core` real, não suposição)
2 violações, em 1280px e 390px — **as mesmas 2 que já existem, com a mesma causa raiz, em `/estados` e `/executivo`** (que reaproveitam o mesmo componente de mapa `brazil-map-markup.ts`/`state-map-paint.ts`):
- `label-content-name-mismatch` (serious, 54 nós): os links `a[href="/estados/XX"]` do mapa coroplético têm texto visível que não está incluído no nome acessível.
- `nested-interactive` (serious, 2 nós): os dois mapas da home (`.home-idhm-map`, `.home-ideb-map`) têm elementos focáveis aninhados dentro de um elemento interativo.

Ambas são uma característica estrutural do componente de mapa compartilhado, não algo introduzido pela home — não corrigidas aqui pela mesma razão documentada ao longo desta sessão para não tocar componentes compartilhados fora do escopo do mandato corrente; candidatas a um item de acessibilidade transversal, fora do escopo de Homepage V0.

## Regressão e2e (`cadastro.spec.ts`, `ux-busca.spec.ts`)
A suíte completa (25 testes) foi corrida real contra o servidor de dev. 3 testes falhavam por consequência direta e esperada da reescrita da home/busca — **corrigidos**:
- `cadastro.spec.ts` — "home apresenta..." reescrito para afirmar o conteúdo real da nova home (headline exata, ausência de "em breve", seção "Três poderes", número real 214.211.951, CTA para `/legislativo`).
- `ux-busca.spec.ts` (×2) — nomes acessíveis do `GlobalSearch` mudaram de "Buscar parlamentar"/"Digite um nome" para a frase mais ampla "Buscar cidade, estado, parlamentar, partido ou tribunal" (busca agora federa 5 tipos, não só pessoa) — testes atualizados para o texto real novo.

3 falhas confirmadas como **pré-existentes e não relacionadas a este mandato** (isoladas e reproduzidas sem minhas mudanças, com causa raiz lida no código/commits/docs já existentes antes desta sessão):
- `cadastro.spec.ts:2` e `:81` — `/legislativo` teve seu heading renomeado de "Congresso em números" para "Legislativo em Números" no commit `060265d` (já mesclado); e o heading "Como isso mudou ao longo do tempo?" foi deliberadamente movido da aba Carreira para a aba Atuação numa reforma de UX anterior, documentada em `apps/web/docs/ux-redesign.md:63`.
- `cadastro.spec.ts:45` — `/parlamentares/senado/999999` devolve HTTP 200 em vez de 404 (rota de redirecionamento legada, sem relação com nenhum arquivo tocado nesta fase).

2 falhas adicionais só apareceram na corrida com os 25 testes em paralelo (`ux-busca.spec.ts:96` e `:123`) e passaram de forma limpa quando reexecutadas isoladamente — confluência de workers no mesmo servidor de dev, não regressão real.

Nenhuma dessas 5 falhas foi corrigida nesta fase (fora do escopo de Homepage V0); ficam registradas para o usuário decidir se vale abrir um item de limpeza de testes.

## Typecheck
`NEXT_DIST_DIR` isolado, `next typegen && tsc --noEmit` — limpo, 0 erros.

## Capturas reais
`artifacts/h0-homepage-v0/`: `h1-desktop.png`, `h1-full-v2.png`, `h1-mobile.png`, `h1-stories-section.png`, `h1-top2200.png`/`h1-top2200-v2.png` (evolução do cartão do Legislativo), `h1-justice-fixed.png`/`h1-justice-fixed2.png` (gráfico de barras da história de Justiça), `axe-home.json`.

## Segurança arquitetural (§13)
Nenhuma migração, alteração de schema ou backfill. Nenhum coletor reiniciado. Todas as funções novas (`getNationalHealthSummary`, `getHdiForAllStates`) são leituras adicionais sobre tabelas já existentes, no mesmo padrão das funções de leitura já publicadas — não há escrita nova no banco em nenhum ponto desta fase.

## Gate H5 — PASS_WITH_CAVEATS
Caveats: 2 violações de acessibilidade pré-existentes no componente de mapa compartilhado (não corrigidas, fora de escopo) e 3+2 falhas de e2e pré-existentes/flakiness de paralelismo (identificadas, não corrigidas, fora de escopo) — nenhuma delas introduzida por este mandato.
