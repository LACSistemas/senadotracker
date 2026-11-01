# P1 — Design system e arquitetura visual

Fundação aditiva para o mandato "Cívica — Atlas Editorial Investigativo". Nenhuma página de tema foi
redesenhada (isso é P5) e nenhuma página piloto foi construída (P2/P3) — esta fase só cria/estende
tokens e componentes reutilizáveis, sem alterar visualmente nenhuma página real hoje em produção.

Base: `docs/atlas-editorial-redesign/P0_AUDITORIA_TERRITORIAL.md` (Gate P0 `PASS_WITH_CAVEATS`).

## 1. Tokens (`apps/web/app/globals.css`)

Nenhum token existente foi removido ou renomeado. 4 acentos novos, aditivos, validados por contraste
real (função `contrast()` do validador WCAG da skill `dataviz`, não estimado):

| Token novo | Valor | Papel do mandato | Validação |
|---|---|---|---|
| `--brand-green-deep` | `#103d34` | Verde profundo | Superfície escura — 10,7:1 com texto branco. Não é cor de texto sobre fundo claro. |
| `--brand-green-editorial` | `#17382d` | Verde editorial | Superfície escura — 12,8:1 com texto branco. |
| `--brand-amber` | `#c49e55` | Âmbar editorial (preenchimento/borda/grafismo) | **Falha AA como texto** sobre `--background`/`--card` (2,22:1 / 2,38:1) — por isso não é usado como cor de texto. |
| `--brand-amber-ink` | `#866327` | Âmbar editorial (texto/ícone) | Mesmo matiz escurecido — 4,86:1 / 5,21:1 sobre `--background`/`--card`, passa AA texto normal. |
| `--brand-blue` | `#3d69a5` | Azul analítico | Já passa AA como texto (4,94:1 / 5,30:1) e como fundo com texto branco (5,58:1) sem ajuste. |

Por que 2 tons de âmbar: o valor pedido no mandato (`#C49E55`) é bonito como preenchimento/borda, mas
reprovou o teste de contraste de texto do próprio produto. Em vez de escolher entre "seguir o mandato à
risca" e "ser acessível", ficaram os dois — a mesma decisão que o produto já toma em outros lugares
(`--warning:#a65d08` é outro exemplo de par claro/escuro do mesmo matiz). `--brand-amber-ink` é
deliberadamente distinto de `--warning`: aquele é semântica de alerta reservada (regra da skill
`dataviz`: cores de status nunca são reusadas como acento de série/marca); este é acento editorial, sem
significado de alerta.

Verde profundo/editorial não precisaram de ajuste — já nascem como superfícies escuras de altíssimo
contraste (usadas em gradiente de hero/banda, não como texto). Azul analítico passou sem ajuste nos dois
papéis.

Verde institucional, verde suave e fundo marfim **não geraram token novo** — já são idênticos ou da
mesma família dos tokens existentes (`--primary`, `--secondary`, `--background`/`--card`), confirmado em
P0 §8. Duplicar teria sido ruído, não fundação.

**Tipografia**: mantida a pilha atual (`Inter` + serifa de sistema `Georgia/Times New Roman`). Não
troquei para Newsreader. Motivo: o comentário já existente no CSS ("pilha local evita download de fontes
durante o build") é uma decisão deliberada de build determinístico offline, e o mandato só pede para
"avaliar" a troca, não exige. Trocar exigiria decidir uma estratégia de self-hosting de fonte (arquivo
`.woff2` versionado no repo, não CDN) para não reabrir esse problema — trabalho real, não cosmético, e
fora do que esta fase precisa para ser útil às fases seguintes. Documentado como decisão, não como
pendência esquecida.

## 2. Grid 12 colunas (`apps/web/app/globals.css`)

`.grid-12` (12 colunas desktop, 6 colunas ≤1024px, 4 colunas ≤640px) + `.col-reading` (coluna 3–10,
`max-width:68ch` — medida de leitura editorial) + `.col-explore` (largura plena — mapas/tabelas/
exploradores). Aditivo: nenhuma página existente usa essas classes ainda; ficam disponíveis para P2/P3/P5
decidirem onde adotar.

## 3. Sidebar inteligente — `ChapterNav` (`apps/web/components/security/chapter-nav.tsx`)

Estendido com prop opcional `layout?: 'inline' | 'sidebar'` (padrão `'inline'` = comportamento atual,
inalterado — os 4 `<ChapterNav items={nav} />` existentes em Educação/Segurança/Bem-estar/Infraestrutura
continuam exatamente como estavam, sem precisar mudar nenhuma chamada). `layout="sidebar"` (novo, opt-in):
abaixo de `lg` (1024px) mantém a mesma faixa horizontal sticky; a partir de `lg` troca para uma coluna
lateral persistente (`sticky top-24`, lista vertical com borda-guia e destaque do capítulo ativo),
reaproveitando o mesmo hook de `IntersectionObserver` que já existia (`useActiveChapter`, extraído sem
mudar sua lógica). Nenhuma página foi migrada para `layout="sidebar"` nesta fase — é a Fase P5 que decide
onde isso vira a composição real de 2 colunas (conteúdo + sidebar) da Parte IV.8.3 do mandato.

**Verificação de não-regressão**: `tests/e2e/infraestrutura-p137.spec.ts` inclui um teste específico de
`ChapterNav` por teclado ("teclado: ChapterNav e summary recebem foco visível") — passou. Ver §9.

## 4. Indicador Vivo (`apps/web/components/indicators/indicator-live.tsx`, novo)

`IndicatorLive({ kpi, who, lead?, chart?, verify? })` — envelope que compõe o que já existe em vez de
reconstruir:
- **Nível 1 (Descobrir)**: `KpiCard` de `components/security/security-hero.tsx`, reaproveitado sem
  nenhuma alteração — já cobria valor, unidade, período, delta, sparkline e comparação com validade
  explícita (`BenchRuler` ou "Sem comparação válida para este indicador").
- **Nível 2 (Explorar)**: `TrendChart` (mesmo componente dos capítulos de Segurança/Educação), dentro de
  um `<details>` — só aparece quando um `ChartView` é passado.
- **Nível 3 (Verificar)**: `<details>` novo com fonte/cobertura/definição/ressalva/notas — a única peça
  que não existia em nível de indicador individual (`ChapterShell` já tinha algo parecido, mas por
  capítulo inteiro, não por indicador).

**Limite real documentado, não escondido**: isso funciona hoje para indicadores no formato `Kpi`/
`ChartView` (Segurança e Educação, confirmado em P0 §6). Bem-estar e Infraestrutura usam tipos próprios
mais pobres (`PortraitFact`/`HeroKpi`, sem delta/sparkline/benchmark) — adaptar esses dois temas para
`IndicatorLive` é trabalho de tradução de dado que pertence à Fase P5 quando (e se) esses temas forem
unificados no mesmo contrato, não a esta fase. Não forcei uma falsa universalidade.

## 5. Padrões gráficos e paleta categórica (`components/charts.tsx`, `lib/scale.ts`) — documentado, não reescrito

Validei a paleta categórica real (`--chart-1..4`, usada por `BarChart`/`HistogramChart`/`LineChart` etc.)
com o validador da skill `dataviz`:

```
node validate_palette.js "#115b45,#2d7f93,#d39a3c,#8b6aa8" --mode light
[FAIL] Lightness band   — fora da banda (muito escura para o critério do validador)
[FAIL] Chroma floor     — 3 dos 4 tons abaixo do piso (lêem como acinzentados)
[PASS] CVD separation   — pior par adjacente ΔE 14,5 (deutan) / 13,8 (tritan) — acima do piso de 6–8
[PASS] Normal-vision floor — pior par ΔE 15,0 — no limite do piso rígido de 15 (passa, sem margem)
[WARN] Contrast vs surface — #d39a3c abaixo de 3:1 contra a superfície
```

Isto é um achado real, não um bloqueio: a paleta é institucional (verde/petróleo/âmbar/roxo escuros,
não tons vivos de categórico puro) e **todo gráfico do produto já embute, estruturalmente, a mitigação
que a própria regra da skill exige para o WARN de contraste** — `Frame` (base de todos os charts) sempre
renderiza legenda + tabela de dados completa via `<details>`, nunca cor isolada como único identificador.
Ou seja: o requisito duro (separação CVD e visão normal) passa; o WARN de contraste já tem a mitigação
obrigatória presente em 100% dos gráficos. Não toquei em `charts.tsx` nem em `lib/scale.ts` além do que
o trabalho P14 anterior (não commitado) já tinha estendido (`mapRamps` teal/blue/amber) — registrado aqui
como backlog de P6 (polimento), não como pendência desta fase: se um redesign futuro quiser tons mais
vivos/saturados no categórico, há margem real para subir chroma sem perder a separação CVD que já passa.

## 6. Estados de ausência/qualidade (`apps/web/components/territory/chapter-states.tsx`, novo)

- **`ChapterPending`**: promove o componente `Pending` — hoje 4 cópias locais idênticas em
  `education-page.tsx`/`infrastructure-page.tsx`/`wellbeing-page.tsx` (texto comum + "Nenhum valor é
  estimado nem preenchido com zero.") e 1 variante em `security-page.tsx` (mesmo papel, mas com
  `EmptyNote` destacado) — para um único local compartilhado, com `tone="plain"|"note"` cobrindo as duas
  variantes reais encontradas. **As 4 cópias locais não foram removidas** (fora de escopo — mudaria 4
  arquivos de tema que são território da Fase P5); a versão nova é a que essas páginas podem adotar
  depois.
- **`StateBadge`**: selo visual para o estado de **um valor individual** (`PointState`:
  `ok|prelim|partial|zero|suppressed|absent`), reaproveitando a mesma legenda de texto que já existe em
  `TrendChart`/`DataStatesLegend` (exportei `STATE_LABEL` de `trend-chart.tsx` em vez de duplicar a
  redação). Preenche uma lacuna real que P0 identificou: existia `CoverageBadge` para o indicador/capítulo
  inteiro (`components/metrics.tsx`) e uma legenda textual única por página (`DataStatesLegend`), mas
  nada para marcar um ponto/célula individual fora do gráfico (ex. uma tabela, um KPI isolado).

## 7. Variantes responsivas

Testado nas 5 larguras do mandato (1440/1280/768/390/320) via os e2e existentes, que já cobrem essas
larguras para Infraestrutura (`ChapterNav` incluso) e 390 para o hero/mapa territorial (P14). Nenhum
overflow horizontal novo — os 2 bugs de overflow pré-existentes documentados em P0 §11 (`/estados/ES` e
`/estados/ES/educacao`/`/infraestrutura` em 320px) **não foram tocados nesta fase**: não são triviais (a
causa raiz não foi diagnosticada em P0, só medida) e corrigi-los sem entender a causa seria arriscar uma
regressão visual sem necessidade — ficam para P6, como P0 já recomendava.

## 8. Baseline de acessibilidade (axe-core)

Repliquei o mecanismo já existente do projeto (`scripts/ux/axe-run.mjs` + `AXE_PATH` apontando para
`axe-core` instalado fora do repo em `D:\Civica\tools\a11y`, mesmo padrão documentado em
`apps/web/docs/ux-redesign.md`) contra `/estados/ES` real (servidor de desenvolvimento do usuário, só
leitura — mesmo precedente de segurança já usado em P0 para os screenshots). Resultado salvo em
`artifacts/p1-a11y-baseline.json` (gitignored, como todo `artifacts/`):

- 1280px e 390px: **2 violações moderadas**, ambas na mesma origem (`.fixed`, fora de qualquer landmark):
  `region` ("conteúdo fora de uma landmark") e `skip-link` ("destino do skip-link não existe/não é
  focável"). 51 verificações passaram, 2 incompletas (revisão manual).
- **Pré-existente, não introduzido por esta fase** — é o baseline "antes" que a Fase P7 vai comparar
  contra o "depois". Não corrigi agora: a causa provável (um elemento `position:fixed` da navegação
  global, fora da árvore de landmarks da página) é específica do header/navegação global herdada do
  redesign do Legislativo, fora do escopo territorial desta fase.

## 9. Verificação de compatibilidade

- `NEXT_DIST_DIR=.next-p1check npm run typecheck` (workspace `@senadotracker/web`, isolado) — **limpo**,
  0 erros.
- Build de produção isolado (`NEXT_DIST_DIR=.next-p1check npx next build`) — sucesso.
- Servidor isolado (`next start -p 3151`, porta própria, nunca a 3000 do usuário) +
  `E2E_BASE_URL=http://127.0.0.1:3151 npx playwright test tests/e2e/p14-territorio-executivo.spec.ts
  tests/e2e/infraestrutura-p137.spec.ts` — **40/40 passaram**, incluindo o teste de teclado do
  `ChapterNav` (confirma que a extensão com `layout` não regrediu o comportamento padrão) e todos os
  testes de overflow/larguras de estresse de Infraestrutura.
- Servidor isolado e diretório `.next-p1check` removidos ao final; nenhum processo do usuário (porta
  3000) foi tocado.

## Status do Gate P1

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: tokens novos validados por contraste computado (não estimado), grid 12
colunas aditivo, `ChapterNav` ganhou variante de sidebar sem regredir o uso atual (confirmado por e2e),
`IndicatorLive` compõe componentes reais já maduros (`KpiCard`, `TrendChart`) em vez de recriar, paleta
categórica existente auditada com o validador da skill `dataviz` (passa os requisitos duros, WARN já
mitigado estruturalmente), 2 primitivas de estado promovidas para local compartilhado, baseline de
acessibilidade real capturado pela primeira vez para uma página territorial, typecheck limpo e 40 e2e
reais passando contra build isolado.

Ressalvas que impedem um `PASS` puro:
1. `IndicatorLive` cobre hoje só o contrato `Kpi`/`ChartView` (Segurança/Educação) — Bem-estar e
   Infraestrutura precisam de um adaptador que esta fase deliberadamente não construiu (ver §4).
2. A paleta categórica (`--chart-1..4`) tem um achado real de contraste (`FAIL` de luminosidade/chroma
   no validador) que não foi corrigido — mitigado estruturalmente (tabela sempre presente), mas registrado
   como item de P6 caso o redesign queira tons mais vivos.
3. Os 2 bugs de overflow horizontal pré-existentes (P0 §11) continuam sem correção — decisão deliberada
   de não tocar sem diagnóstico de causa raiz.
4. `ChapterPending` e `StateBadge` são novos componentes compartilhados, mas nenhuma página real foi
   migrada para usá-los ainda — migração é trabalho de P5, não desta fase.

Nenhum impedimento bloqueia o início da Fase P2 (página municipal piloto). A fundação de tokens e
componentes está no lugar para P2/P3 consumirem.
