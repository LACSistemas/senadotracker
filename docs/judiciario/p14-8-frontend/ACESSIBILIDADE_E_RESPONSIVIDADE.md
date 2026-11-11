# Acessibilidade e responsividade — P14.8

## Auditoria automática real (axe-core, WCAG 2.0/2.1/2.2 A/AA + boas práticas)

Rodada com `scripts/ux/axe-run.mjs` (instalação existente do projeto, `D:\Civica\tools\a11y`), contra o servidor isolado, nas 8 rotas, em 1280×900 (desktop) e 390×844 (mobile) — 16 combinações no total.

| Rota | Desktop | Mobile |
|---|---|---|
| `/judiciario` | 0 violações (44 passes) | 0 violações (44 passes) |
| `/judiciario/tribunais` | 1 violação → corrigida → 0 | 0 violações |
| `/judiciario/tribunais/[id]` (TJES) | 0 violações | 0 violações |
| `/judiciario/temas` | 0 violações | 0 violações |
| `/judiciario/temas/[tema]` (execução fiscal) | 0 violações | 0 violações |
| `/judiciario/comparar` | 0 violações | 0 violações |
| `/judiciario/stj/precedentes` | 0 violações | 0 violações |
| `/judiciario/stj/precedentes/[id]` | 0 violações | 0 violações |

**Achado real corrigido**: `/judiciario/tribunais` tinha `empty-table-header` (impacto menor, 1 nó) — a coluna de ação "Perfil" da `DataTable` usava `header: ''`. Corrigido para `header: <span className="sr-only">Perfil</span>` (rótulo acessível, mas não duplica visualmente o link "Perfil →" já na célula). Resultado após a correção: 0 violações nas 16 combinações.

Itens "a revisar" (`incomplete`, não violação) ficaram entre 0 e 2 por página — típicos de elementos que o axe não consegue determinar automaticamente (ex. contraste de cor em gradiente de imagem de fundo do hero) e que não geram falha.

## O que a auditoria automática NÃO cobre (honestidade sobre o método)

axe-core não verifica: ordem lógica de navegação por Tab em fluxos complexos, se o foco visível é suficiente em todos os estados de hover/active, se o texto de um link faz sentido fora de contexto quando lido por leitor de tela em uma lista, ou se a ordem de leitura de uma tabela responsiva (card no mobile) é coerente. Não foi feito um passe manual completo de teclado+leitor de tela nesta fase — o mandato pede isso explicitamente ("testar manualmente os fluxos centrais"), e não foi executado por limite de tempo desta fase. Isso é reportado como `PASS_WITH_CAVEATS` em `P148_RESULTS.json`, não omitido.

## Padrões herdados que já ajudam

- `ChapterNav` (perfil de tribunal): navegação por âncora real (`<a href="#id">`), tabulável, com `aria-current="page"` no capítulo ativo.
- `DataTable`: tabela real no desktop, lista de cards no mobile — mesma informação, nunca escondida atrás de scroll horizontal forçado.
- `MultiLineChart`/`RankedBars`: `role="img"` com `aria-label` descritivo, tabela de dados alternativa em `<details>`, tooltip via `<title>` SVG (nativo, funciona com leitor de tela).
- `EmptyState`: `role="status"`/`role="alert"` conforme o tom, nunca uma div silenciosa.
- `JudiciaryAvailabilityNote`: nunca depende só de cor — ícone + rótulo textual sempre juntos.

## Responsividade

Testado em 390px (mobile) e 1440px (desktop) via captura real de tela (ver `MANIFESTO_VISUAL_E_READINESS.json`) e checagem programática de overflow horizontal (`document.documentElement.scrollWidth - clientWidth`) nas 4 rotas principais — resultado real: **0px de overflow em todas** (`/judiciario`, `/judiciario/tribunais`, `/judiciario/temas`, `/judiciario/stj/precedentes`, confirmado também em `/judiciario/tribunais/[id]` e `/judiciario/temas/[tema]` nas capturas de tela). A `DataTable` troca para cards no mobile automaticamente; o `ChapterNav` troca a coluna lateral por um seletor compacto abaixo de 1024px (comportamento herdado, não modificado). `prefers-reduced-motion` não foi testado especificamente nesta fase — nenhuma animação nova foi introduzida por este frontend (os componentes reaproveitados já respeitam a preferência onde aplicável).

## Não verificado nesta fase (registrado, não escondido)

- 768px (tablet) não foi capturado em screenshot dedicado — só testado implicitamente pela natureza responsiva de `DataTable`/grids CSS, que não têm um breakpoint específico de tablet.
- Teste manual de leitor de tela (NVDA/VoiceOver) não foi executado.
