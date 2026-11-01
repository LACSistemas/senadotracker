# P6.1 — Refinamento premium: correções e consistência do sistema compartilhado

Primeira metade da FASE P6 do mandato "Cívica — Atlas Editorial Investigativo". Diferente das sub-fases
de P5, esta não teve trava de escopo por tema — qualquer arquivo compartilhado podia ser editado, desde
que a mudança fosse consistência/correção, não reescrita de conteúdo temático (isso é a segunda metade
de P6). Nenhuma migration/schema/collector tocado, porta 3000 do usuário nunca tocada (confirmado antes/
depois), toda verificação rodada contra build isolado (`NEXT_DIST_DIR=.next-p6check`, servidor próprio
na porta 3162, removidos ao final).

## 1. Overflow horizontal em 320px — causa raiz real, não `overflow-x:hidden` disfarçando

Medido ANTES desta sub-fase (idêntico a P0/P3/P5): `/estados/ES` 21px, `/estados/ES/educacao` 27px,
`/estados/ES/infraestrutura` 7px, `/municipios/3205309/educacao` 2px.

**Causa raiz real encontrada por diagnóstico ao vivo** (não suposição): em CSS Grid, um item sem
`min-width:0` usa `min-width:auto`, que para conteúdo não-shrinkável (uma tabela, um número grande em
`text-3xl`, um formulário) força a faixa da grade a crescer até o `max-content` do item em vez de encolher
ao contêiner — mesmo quando a grade só tem 1 coluna implícita abaixo do breakpoint `lg`/`sm` por não
declarar `grid-cols-1` como base.

- **`/estados/ES` (21px→0px)**: `MunicipalFinder` (busca de município) dentro de `<section className="grid lg:grid-cols-[...]">` sem base `grid-cols-1` — já diagnosticado em P3, nunca corrigido até agora.
  Corrigido em `apps/web/app/estados/[uf]/page.tsx`: `grid-cols-1` adicionado à base, `min-w-0` na coluna da busca.
- **`/estados/ES/educacao` (27px→0px)** e, por extensão, **`/municipios/.../educacao` (2px→0px)`**: DUAS
  causas reais, não uma — (a) o grid do Panorama (`hero.kpis.map(...KpiCard...)`, `grid gap-4 md:grid-cols-2 xl:grid-cols-4` sem base) reduziu de 27px para 9px; (b) o restante veio de `StatGrid`
  (`education-ui.tsx`) — cada célula sem `min-w-0`, e o número grande (`dd.hero-figure.text-3xl`) sem
  `break-all`, usado em 2 capítulos (Quantos estudam/Contexto). Corrigidas as duas causas:
  `grid-cols-1 [&>*]:min-w-0` no grid do Panorama; `min-w-0` na célula do `StatGrid` + `break-all` no
  número. Também corrigidos, defensivamente (mesmo padrão, sem overflow medido neste ciclo mas risco real
  idêntico), 6 grids `lg:grid-cols-2` sem base nos capítulos 1/6/7/9/9/11 de Educação.
- **`/estados/ES/infraestrutura` (7px→7px, NÃO eliminado)**: corrigido o grid de comparação do panorama
  (`infrastructure-page.tsx`) e `StatGrid` de Infraestrutura (mesmo `min-w-0` que Educação — já tinha
  `break-all`, só faltava `min-w-0`) e o formulário de filtros de obras (`works-list.tsx`). Isso reduziu
  visivelmente os diffs internos medidos (de valores maiores para poucos px, contidos dentro de cada
  cartão), mas a medição de página (`scrollWidth - clientWidth`) permaneceu em 7px. Diagnóstico adicional
  (varredura de todo elemento não-clipado por nenhum ancestral `overflow-x:auto/hidden` com
  `getBoundingClientRect().right` além do viewport) não encontrou NENHUM elemento candidato — ou seja, não
  há um único componente "quebrado" restante; o resíduo de 7px parece ser acúmulo de arredondamento
  sub-pixel entre múltiplas grades/flexes de uma página com muito mais densidade de cartões que as demais
  (Infraestrutura tem 7 capítulos com `StatGrid`+`TerritoryCompareRow` lado a lado). **Não eliminado,
  documentado honestamente** — não é do mesmo tipo de bug que os outros 3, não deveria ser forçado com
  `overflow-x:hidden` sem entender a causa.
- `wellbeing-page.tsx`: grid dos fatos do Retrato (`grid gap-4 sm:grid-cols-2`) e `StatGrid` de Bem-estar
  (`wellbeing-ui.tsx`) corrigidos pelo mesmo padrão, defensivamente (nenhum overflow medido aqui, mas
  idêntico risco estrutural).

**Achado colateral real, não um bug de overflow**: o `ThemeTabs`/`ChapterNav` (faixas horizontais com
`overflow-x-auto`) geraram um falso positivo forte na primeira rodada de diagnóstico — elementos dentro
deles reportam `getBoundingClientRect().right` muito além do viewport (até 1731px) porque estão
corretamente contidos por scroll interno, não porque vazam para a página. Diagnosticar por
`scrollWidth`/`clientWidth` por elemento (não por posição absoluta) foi o que efetivamente encontrou as
causas reais.

## 2. Rótulo duplicado em `IndicatorLive` (`heroKpiToKpi`/`portraitFactToKpi`)

`apps/web/lib/comparison/kpi-adapters.ts`: os dois adaptadores definiam `plain: label` — idêntico ao
`label` já mostrado como eyebrow pelo `KpiCard`, causando repetição visual ("ABASTECIMENTO DE ÁGUA" /
"Abastecimento de água" no mesmo card). Corrigido: `plain` agora compõe `"{label} em {território}"` quando
o território é passado (mesmo padrão que `mapMetricToKpi`, de P3, já usava) — nunca um texto inventado,
só reaproveita o nome do território que a própria página já tem (`where`). Alterado em
`infrastructure-page.tsx` e `wellbeing-page.tsx` para passar `territoryName: where` nas chamadas.

## 3. 4 links "Ler a história completa" com nome de acessibilidade idêntico

Herdado de P2 (visão geral municipal) — achado por `seguranca-p98.spec.ts` durante P5.3, nunca corrigido.
Adicionado `aria-label` distinto por tema em `education-summary.tsx`, `infrastructure-summary.tsx`,
`wellbeing-summary.tsx`, `security-summary.tsx` (ex. "Ler a história completa de Educação"). Resolve de
verdade o requisito de nome de link único (WCAG 2.4.4/2.4.9) sem mudar o texto visível. O teste
`seguranca-p98.spec.ts:69` que usava um regex ambíguo (`/Ler a história completa/`, casava os 4) foi
corrigido para usar o nome exato e único do link de Segurança — confirmado passando.

## 4. Paleta categórica (`--chart-1..4`) — revalidada, decisão mantida

Rodado de novo `validate_palette.js` (skill `dataviz`) com os 4 tons atuais: mesmo resultado de P1 —
`FAIL` de banda de luminosidade e piso de chroma (3 dos 4 tons), `PASS` de separação CVD (ΔE 14.5/13.8,
bem acima do piso de 6-8), `PASS` no piso de visão normal (ΔE 15.0, exatamente no limite, sem margem),
`WARN` de contraste do `#d39a3c` contra a superfície.

**Decisão: não alterar.** `--chart-1` é literalmente `--primary` (o verde institucional) — mudar sua
luminosidade/chroma para satisfazer o validador quebraria a identidade de marca em todo gráfico do
produto, uma troca que P1 já havia decidido não fazer. A mitigação estrutural que a regra da skill exige
para o `WARN` (nunca cor isolada como identificador — tabela/legenda sempre presentes) já está em 100% dos
gráficos, confirmado de novo. Mantido como registrado: item de P6 "se o redesign quiser tons mais vivos",
não um defeito a corrigir às pressas.

## 5. Transições e motion (Parte X.25 do mandato)

Auditados todos os `transition`/`duration`/`@keyframes` em `globals.css` e componentes territoriais
tocados por P1-P5 contra as 4 faixas do mandato (hover 100-160ms, seleção/filtro 150-220ms, painel/
expansão 200-300ms, cartográfico 250-400ms):

- `.card-lift` (hover de cartão, usado em toda a base) estava em 220ms — acima da faixa de hover.
  **Corrigido para 150ms.**
- `.strip-seg`/`.map-regions .map-region` (150-160ms) e `.atlas-canvas` (250ms, zoom/pan do Atlas Vivo) já
  estavam dentro das faixas certas — sem alteração.
- `.profile-section-content[data-animate]` (260ms, painel) já correto.
- Utilitários Tailwind bare (`transition`, `transition-colors` sem `duration-*` explícito) usam o padrão
  do Tailwind (150ms) — já dentro da faixa de hover, sem necessidade de tocar dezenas de arquivos.
- `.prop-rise`/`.prop-wipe`/`.ap-pulse`/`.hemi-party` (0.6-2s): são animações editoriais de revelação
  (Proposições, hemiciclo), não micro-interações de UI cobertas pela tabela do mandato — deixadas como
  estão, fora de escopo territorial.
- `prefers-reduced-motion` seguiu funcionando (verificado, não reconstruído).

## 6. Estados de hover/foco/seleção

Revisão de `ChapterNav` (usado pelos 5 temas desde P5) encontrou uma lacuna real: a variante de pílulas
horizontais (`pillList`, usada tanto no modo `inline` quanto como fallback mobile/tablet do modo
`sidebar`) **não tinha `focus-ring`** nos links — só a variante de sidebar desktop tinha. Isso afetava a
navegação por teclado em TODAS as 5 páginas de tema, em telas <1024px. Corrigido: `focus-ring` adicionado
à classe do link em `components/security/chapter-nav.tsx`. Demais componentes (`IndicatorLive`,
`TerritoryCompareRow`, cards de Atlas Vivo) já usavam `focus-ring` consistentemente — confirmado, não
alterado.

## 7. Estados de loading/ausência/erro

Verificado (não alterado): o texto de ausência "Nenhum valor é estimado nem preenchido com zero" continua
idêntico nos 4 temas que usam essa convenção (Educação, Infraestrutura, Bem-estar, Saúde) após todas as
edições de P5/P6.1; Segurança usa deliberadamente `EmptyNote` com uma razão contextualizada por capítulo
(`reason`), um padrão diferente mas documentado desde P1 — não é uma inconsistência, é uma decisão de
design já registrada. Nenhuma mudança necessária.

## Achado extra, fora da lista original: gap real de typecheck nunca antes verificado

Ao rodar `npm run typecheck` completo (todas as workspaces + `tsconfig.tests.json`) — pela primeira vez
nesta fase, já que P1-P5 sempre escoparam para `@senadotracker/web` isoladamente — apareceram 2 erros
`TS2307` reais: `apps/web/lib/comparison/peer-distribution.ts` e `apps/web/lib/wellbeing/types.ts` (ambos
de P4) importavam de `@/lib/...` sem extensão `.ts`, o que falha sob a resolução `NodeNext` usada por
`tsconfig.tests.json` (o projeto que compila `tests/unit/comparison-*.test.ts`, que importam esses
arquivos por caminho relativo). Causa real, dupla: (a) faltava o mapeamento `@/*` → `apps/web/*` em
`tsconfig.tests.json` (adicionado); (b) mesmo com o mapeamento, `NodeNext` exige extensão explícita no
especificador — corrigido adicionando `.ts` às 2 importações (`import type`, apagadas em runtime, sem
nenhum risco de build; o próprio arquivo já tinha um import relativo vizinho com extensão explícita,
confirmando que é a convenção certa). **Não é um bug desta fase — é um gap real de P4, invisível até agora
porque ninguém tinha rodado o typecheck raiz completo.** Corrigido porque é exatamente o tipo de
consistência de sistema compartilhado que esta sub-fase existe para pegar.

**Pré-existente, fora de escopo, não corrigido**: `tests/unit/educacao-p113.test.ts` e
`educacao-p114.test.ts` (não relacionados a este redesign, de uma frente de Educação anterior) falham sob
o mesmo typecheck raiz por uma incompatibilidade de assinatura num mock de `Q`/query — confirmado não
tocado por nenhuma fase P0-P6, erro genuíno mas de outro workstream. Registrado para quem for mexer
naqueles testes, não corrigido aqui.

## Verificação

- `npm run typecheck` (raiz, todas as workspaces + `tsconfig.tests.json`): limpo para tudo deste redesign;
  restam só os 2 arquivos pré-existentes não relacionados citados acima.
- Build de produção isolado (`NEXT_DIST_DIR=.next-p6check`) + servidor isolado (porta 3162, nunca a 3000
  do usuário — confirmado respondendo normalmente antes/depois).
- E2E: `p14-territorio-executivo.spec.ts` + `infraestrutura-p137.spec.ts` (30/30) +
  `wellbeing-p128.spec.ts` + `seguranca-p98.spec.ts` — **68/68 passando** (confirmado em execução de
  worker único; 1 teste — SP, timeout de navegação — é flaky sob alta contenção de workers paralelos,
  reproduzido e descartado como flake de infraestrutura de teste, não regressão: passa em 4.4s isolado,
  bem dentro do limite de 30s).
- axe-core (mesmo mecanismo de P1/P3) contra `/estados/ES`, 1280/390px: **2 violações, as mesmas 2
  pré-existentes (`region`, `skip-link`) de todo o baseline desde P1 — 0 novas.** 51-52 verificações
  passaram.
- Screenshots reais em `artifacts/p6-1-correcoes/` (6 rotas em 320px, confirmando overflow 0px em 5 delas
  e o resíduo de 7px documentado na 6ª) + `axe-estado-es.json`.

## Status do Gate P6.1

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: 3 dos 4 bugs de overflow originais (P0) eliminados por causa raiz genuína,
não disfarçados; rótulo duplicado corrigido com dado real (nome do território, não texto inventado); 4
links ambíguos resolvidos com nomes de acessibilidade distintos (e o teste que os revelou, corrigido para
testar o que sempre quis testar); paleta categórica revalidada com decisão explícita de não sacrificar a
marca institucional; motion e foco por teclado auditados com 2 correções reais encontradas e aplicadas; um
gap de typecheck nunca antes verificado, descoberto e corrigido.

Ressalvas:
1. O 4º bug de overflow (`/estados/ES/infraestrutura`, 7px) não foi eliminado — reduzido estruturalmente,
   mas sem uma causa única localizável; registrado com o diagnóstico completo para retomada futura.
2. 1 teste e2e é flake sob paralelismo pesado (não regressão, documentado).
3. 2 arquivos de teste de outro workstream (`educacao-p113/p114`) continuam com erro de tipo pré-existente,
   fora de escopo.

Nenhum impedimento bloqueia a segunda metade de P6 (diferenciação visual temática).
