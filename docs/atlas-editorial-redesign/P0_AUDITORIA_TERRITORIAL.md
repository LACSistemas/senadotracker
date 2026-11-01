# P0 — Auditoria territorial (read-only)

Auditoria da implementação real de `/estados/[uf]` e `/municipios/[ibge]` (e seus 5 temas) antes do
redesign "Cívica — Atlas Editorial Investigativo". Feita inteiramente por leitura de código, navegação
real contra o servidor de desenvolvimento já em execução do usuário (porta 3000, só GETs — nenhum
processo foi iniciado, parado ou reiniciado) e captura de 65 screenshots reais. Nenhum arquivo de
produto foi alterado; os únicos artefatos novos são este documento e as imagens em `artifacts/p0-auditoria/`.

Repositório confirmado: `C:\Projetos\senadotracker`, branch `post-migration`. Não existem `CLAUDE.md`
nem `AGENTS.md` na raiz do repo. A skill `antiwebslop` não está instalada neste ambiente — seguiu-se
sem ela.

## 0. Antes de tudo: arquivos de instrução e um achado que muda a leitura dos demais docs

- **`apps/web/AGENTS.md` existe** (frontprop.md já apontava para ele) e diz que este Next.js é um **fork
  interno com breaking changes sobre a versão de treino** — qualquer código novo no frontend precisa
  checar `node_modules/next/dist/docs/` (confirmado presente, 4 seções) antes de usar uma API, não confiar
  na memória de treino. Isso vale para as fases P1+ deste redesign, não muda nada nesta auditoria.
- **`guiafrontend.md` (raiz, datado de 16/09/2026) está desatualizado e não deve ser tratado como
  verdade do estado atual.** Ele descreve um header com "Início, Legislativo, Estados, Assuntos, Sobre"
  e nem menciona `/estados/[uf]` ou `/municipios/[ibge]`. O header real hoje (`apps/web/components/app-header.tsx`,
  confirmado também por `git log`) é fruto de uma leva de commits **"UX: ..."** já mesclados em
  `post-migration` (documentados em `apps/web/docs/ux-redesign.md`, um redesign anterior focado no
  **Legislativo** — busca global `/`/⌘K, abas client-side do perfil, calendário de presença, axe-core,
  Lighthouse real) que trocou o menu para **Início · Estados · Partidos · Investigar · Sobre** e tornou
  "Estados" item de primeiro nível. Achados corretos de `guiafrontend.md`: paleta, tokens de cor, ausência
  de libs de gráfico (ainda verdadeiro). Achados errados: header, navegação, título de página, qualquer
  coisa específica do Legislativo pós-redesign. `frontprop.md` (plano da reforma de `/proposicoes`) e
  `art_direction_append.md` são válidos para a página de Proposições, não para território.
- Docs de contrato (`docs/frontend/data-contracts.md`, `docs/frontend/phase3-data-contracts.md`,
  `docs/decisions/003-frontend.md`) cobrem só o domínio Legislativo (parlamentares/gastos/votos) — não
  existe ainda um documento equivalente para os contratos territoriais (Saúde/Educação/Segurança/
  Bem-estar/Infraestrutura/Executivo). Os contratos reais desses domínios vivem só no código
  (`apps/web/lib/<tema>/types.ts` + `packages/db/src/exec/*-read.ts`) — ver §6.

## 1. Rotas reais (confirmado por leitura direta de cada `page.tsx`)

| Rota | Arquivo |
|---|---|
| `/estados` | `apps/web/app/estados/page.tsx` — mapa nacional + busca + lista por região |
| `/estados/[uf]` | `.../estados/[uf]/page.tsx` — visão geral (hero, mapa estadual, 5 teasers, executivo, IDHM, legislativo) |
| `/estados/[uf]/saude` | `.../saude/page.tsx` |
| `/estados/[uf]/educacao` | `.../educacao/page.tsx` |
| `/estados/[uf]/seguranca` | `.../seguranca/page.tsx` |
| `/estados/[uf]/bem-estar` | `.../bem-estar/page.tsx` |
| `/estados/[uf]/infraestrutura` | `.../infraestrutura/page.tsx` |
| `/estados/[uf]/infraestrutura/obras` | lista paginada/filtrável de obras do Obrasgov |
| `/estados/[uf]/representacao` | 3 cards-portal para Câmara/Senado/Assembleia (não duplica consulta) |
| `/estados/[uf]/[tema]` | fallback para temas `ready:false` (nenhum hoje — ver `THEMES`) |
| `/municipios` | `apps/web/app/municipios/page.tsx` |
| `/municipios/[ibge]` | visão geral municipal (hero, mini-mapa localizador, mesmos 5 teasers + executivo/IDHM/legislativo) |
| `/municipios/[ibge]/{saude,educacao,seguranca,bem-estar,infraestrutura}` | espelham as de estado |
| `/municipios/[ibge]/infraestrutura/obras` | idem, escopo município |
| `/municipios/[ibge]/[tema]` | mesmo fallback |

Todas `force-dynamic`, Server Components, consultando Postgres a cada request (sem revalidate/ISR).
`THEMES` (`territory-ui.tsx`) hoje tem os 5 temas com `ready:true` — **a rota de fallback `[tema]`
existe no código mas está morta**: não há nenhum tema com `ready:false` no momento, então nunca é
alcançada por link algum (só ficaria acessível por URL direta de um slug desconhecido, e aí cai em
`notFound()` porque o filtro exige `t.ready === false`).

## 2. Componentes e layouts compartilhados

- **`TerritoryFrame`** (`components/territory/state-frame.tsx`): casca de toda página territorial —
  breadcrumbs, hero (dois modos: `cover` usa `InstitutionHero` cheio, só na visão geral; sem `cover` usa
  um cabeçalho mais discreto nas 5 abas temáticas — decisão deliberada para não arriscar regressão visual
  nas abas), `ThemeTabs` (pílulas de navegação entre Visão geral/Saúde/Educação/Segurança/Bem-estar/
  Infraestrutura), `children`.
- **`InstitutionHero` / `ProfileHero`** (`components/heroes.tsx`, 6 linhas de JSX denso): já eram usados
  na home/perfis de parlamentar; reaproveitados sem alteração pelo trabalho P14 (hero territorial).
- **`ChapterNav`** (`components/security/chapter-nav.tsx`): navegação lateral/sticky por capítulo,
  `IntersectionObserver` realça o capítulo visível, pílulas roláveis horizontalmente no mobile — **já é
  exatamente o padrão que a Parte IV.8.3 do mandato pede**, e já é client-side, acessível por teclado
  (`<a href="#id">`) e reusado por Educação, Segurança, Bem-estar e Infraestrutura (um único componente,
  não 4 cópias). Não existe ainda em layout de 2 colunas com sidebar persistente no desktop — hoje é
  sempre uma faixa horizontal sticky no topo, em todas as larguras.
- **`PartyHemicycle`** (`components/party-hemicycle.tsx`, animação `.hemi-party`/`.hemi-in` já em
  `globals.css`): localizado e confirmado — é o hemiciclo que a Parte IV já citava "fortemente indica
  existir"; reusado por `TerritoryLegislativeSummary` sem modificação.
- **Mapas**: `MunicipalMap` (`territory-ui.tsx`) — SVG próprio, usado 2x (mapa estadual com métrica
  alternável; mini-mapa localizador no município, `highlightFill` fora da rampa de magnitude). Mapa
  nacional em `/estados` usa um componente separado (`brazil-state-map.tsx` + `brazil-map-markup.ts` +
  `state-map-paint.ts`) com geometria de `/licenses/mapa-brasil-svg.txt` — **dois sistemas de mapa
  distintos (nacional vs. estadual/municipal), não um único componente parametrizado**. Nenhum dos dois
  tem zoom, pan ou camada "Atlas Vivo" expandida — confirma a lacuna da Parte VI.
- **Estilo geral de autoria**: a base é consistentemente escrita em JSX/CSS extremamente denso — uma
  linha por componente inteiro, sem quebras (`heroes.tsx`: 6 linhas/2538 bytes; `app-header.tsx`: 8
  linhas; `territory-ui.tsx` também concentra várias funções em linhas únicas de 400+ caracteres). Isso
  não é um bug, é o estilo editorial do projeto todo — mas é um risco real de legibilidade/manutenção
  durante o redesign (já registrado como problema pelo próprio time em `frontprop.md` para a página de
  Proposições: "Página é uma única linha minificada — impossível de manter/evoluir").

## 3–4. Inventário dos 5 temas × capítulos reais (estado e município, mesmo componente para os dois)

Confirmado por leitura de cada `*-page.tsx`, não copiado do mandato:

| Tema | Componente | Capítulos reais (ordem, numerados como no código) |
|---|---|---|
| **Saúde** | `HealthSection` (`territory/health-section.tsx`) | Não numerado em capítulos como os outros 4 — é 1 fluxo: `HealthPanel` (7 KPIs + 3 análises) → `EvolutionPanel` (séries comparadas) → `ResidentsPanel` → `HospitalsPanel` → fontes/competências. Mais antigo que o padrão `ChapterNav`, não usa `ChapterShell`. |
| **Educação** | `EducationPage` (`education/education-page.tsx`) | Panorama → 1 Quantos estudam (rede) → 2 O que aprendem (Saeb/Ideb) → 3 Quem fica pelo caminho (trajetória) → 4 Contexto (INSE) → 5 As escolas (estrutura) → 6 Professores → 7 Dinheiro e obras → 8 Enem → 9 Ensino superior → 10 Qualidade do ensino superior → 11 Pós-graduação → Fontes. **11 capítulos confirmados, batendo exatamente com a Parte VIII.16 do mandato.** |
| **Segurança** | `SecurityPage` (`security/security-page.tsx`) | Panorama (hero próprio) → 1 Criminalidade → 2 Estrutura e capacidade institucional → 3 Segurança viária → 4 Sistema prisional → 5 Finanças da Segurança → 6 Apreensões e atuação policial → 7 Explore os dados (explorador completo com export) → Fontes. |
| **Bem-estar** | `WellbeingPage` (`wellbeing/wellbeing-page.tsx`) | Retrato (hero de fatos) → 1 Condições de vida → 2 Trabalho → 3 Rede socioassistencial → 4 Cotidiano digital → 5 Ação pública → 6 Evolução → Fontes. |
| **Infraestrutura** | `InfrastructurePage` (`infrastructure/infrastructure-page.tsx`) | Panorama → 1 Água e saneamento → 2 Ruas e entorno → 3 Habitação → 4 Energia → 5 Mobilidade e logística → 6 Segurança hídrica → 7 Obras públicas (+ explorador de indicadores) → Fontes. |

Todos os 4 temas não-Saúde compartilham a mesma infraestrutura: `ChapterNav`, `ChapterShell`/`EmptyNote`
(`components/security/security-ui.tsx` — **reusado por todos os outros 4 temas**, apesar do nome do
diretório), um componente `Pending` idêntico por página (capítulo sem dado publicado = card tracejado
com número do capítulo, nunca omitido silenciosamente), e a mesma régua de capítulo = `chapter(available,
...)`. **Saúde é a exceção estrutural**: mais antiga, não usa `ChapterNav`/capítulos numerados.

## 5. Filtros, seletores, tabelas e interações (amostra real verificada)

- **Mapa estadual**: 3 métricas alternáveis via querystring (`?mapa=populacao|leitos|mortalidade`),
  cada uma com sua própria família de matiz (teal/blue/amber) — link simples, sem JS.
- **Obras públicas** (`WorksList`/`WorksFilterForm`): formulário `GET` completo (situação, categoria,
  órgão por texto livre, abrangência SINGLE/MULTI, período, 3 checkboxes), paginação que preserva todos
  os filtros na URL — zero JavaScript necessário para filtrar/paginar/compartilhar o link.
  Teste real (`TESTES_E2E_P137.md`) já confirma exportação CSV de verdade e "não ratado" em vez de valor
  fictício para obras multimunicipais.
- **Explorador de Segurança** (`CrimeExplorer`): client component rico — seleção de tipo de crime por
  grupo, toggle contagem/taxa por 100 mil, comparação ad hoc com outro município (busca + fetch sob
  demanda), variações entre períodos equivalentes calculadas no cliente a partir da série já carregada,
  aviso de supressão por privacidade (×, nunca zero).
- **Explorador de Educação/Infraestrutura/Bem-estar**: `ChartExplorer`/`IndicatorExplorer`/
  `IndicatorDetails` — disclosure por indicador com fonte, período, universo, cobertura.
- Padrão geral: **nenhuma tabela filtra por clique no cabeçalho**; filtros GET (parâmetro de URL) ou
  client-state local, nunca um filtro que perde o contexto ao trocar de indicador/capítulo.

## 6. Contratos de dados e adaptadores

Camada em 3 níveis, consistente nos 4 temas "capitulados":
1. `packages/db/src/exec/<tema>-read.ts` (ou vários por tema — ex. Educação tem 14 arquivos `educacao-*-read.ts`) — leitura SQL pura.
2. `apps/web/lib/<tema>/{build,bench,narrative,catalog,load}.ts` — compõe o `*PageData` tipado, narrativa
   determinística (nunca gerada por IA em runtime — consistente com a Parte V.10.1 do mandato),
   benchmarks.
3. `apps/web/lib/<tema>/types.ts` — contrato de página (`EducationPageData`, `SecurityPageData`,
   `WellbeingPageData`, `InfrastructurePageData`), cada capítulo com `available: boolean` + `limits`
   (ressalvas) + `sources`.

Além disso, P14 (não commitado) adicionou `apps/web/lib/territory-{executive,idhm,legislative}.ts` +
`packages/db/src/exec/{executive,idhm,economic}-read.ts` para Executivo/PIB/IDHM e
`apps/web/lib/territory-legislative.ts` para a composição partidária (sem collector novo, só uma
consulta nova sobre `civica_national.current_legislators_analytics`).

Contrato de cobertura é real e onipresente: tipos como `DataCoverage`/`PublicationCoverage` com
`availability`, flags de bit (`preliminary`, `smallN`, `partialCoverage`, `suppressed`,
`denominatorDivergent`, `above100`, `noDenominator`) aparecem em Saúde (`territory-ui.tsx`), Segurança
(`flagLabels`), Bem-estar e Infraestrutura (`IndicatorDetails`/`Disclosures`). **A Parte XI do mandato
(contrato de verdade estatística) já está, em grande parte, implementada hoje** — o redesign precisa
preservar essa camada, não construí-la.

## 7. Bibliotecas de gráficos e mapas

Confirmado por `package.json` (sem `recharts`, `d3`, `visx`, `chart.js`, `leaflet`, `mapbox-gl` — só
`lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`) e por leitura de código: **zero
dependência de gráfico/mapa**. Tudo é SVG/HTML desenhado à mão: `components/charts.tsx` (Bar/Histogram/
StackedBar/Line/MultiLine/GroupedBar/bullet), `components/security/trend-chart.tsx`,
`territory-ui.tsx#SeriesChart`, `territory-ui.tsx#MunicipalMap`, `brazil-state-map.tsx`. Isso confirma
`guiafrontend.md` nesse ponto específico (ainda válido) e é uma restrição real para o redesign: qualquer
visualização nova (Part IX do mandato) também precisa ser desenhada à mão ou justificar a primeira
dependência nova do projeto.

## 8. Responsividade e estilos atuais

`apps/web/app/globals.css` tem só **109 linhas** (mas densas — ~11 KB): tokens em `:root` batem
exatamente com o que a Parte III do mandato já supõe conhecido —
`--primary:#115b45` idêntico ao verde institucional pedido. Mapeamento do restante da paleta do mandato
contra o que já existe (nenhum é idêntico, mas todos têm uma família já presente — útil para a Fase P1):

| Papel pedido no mandato | Valor pedido | Mais próximo já existente |
|---|---|---|
| Verde institucional | `#115B45` | `--primary:#115b45` — **idêntico** |
| Verde suave | `#D8E6DD` | `--secondary:#dce9e2` — quase idêntico |
| Fundo marfim | `#F7F6EF` | `--background:#f3f1eb` / `--card:#faf9f5` — mesma família, 2 tons já existentes |
| Âmbar editorial | `#C49E55` | `--warning:#a65d08`, `--map-amber-*` (hsl 24–32°), `--group-3:#a77612` — mesma família de matiz, mais escura/saturada |
| Azul analítico | `#3D69A5` | `--chart-2:#2d7f93` (mais petróleo/teal), `--map-blue-*` (hsl 210°) — família próxima, não idêntica |
| Verde profundo / verde editorial | `#103D34` / `#17382D` | sem token nomeado; usados ad hoc em gradientes (`#092e25`, `#0e4939`, `#0a3528`, `#177a5a` no hero e `.band-gradient`) |

Tipografia: `--font-sans: Inter,Arial,Helvetica,sans-serif` **já é Inter** (não é mais só Arial como
`guiafrontend.md` registrava — outra evidência de que esse doc ficou para trás). `--font-display:
Georgia,'Times New Roman',serif` — serifa de sistema, não Newsreader; comentário no próprio CSS explica a
escolha ("pilha local evita download de fontes durante o build" — uma decisão deliberada de build
determinístico offline, não descuido). Sem suporte a dark mode: `color-scheme: light` fixo, nenhum
`@media (prefers-color-scheme: dark)` no arquivo — o mandato não exige dark mode explicitamente, mas se
a Fase P1 decidir adicionar, é trabalho novo, não um ajuste.

Breakpoints: 2 media queries customizadas (640px para `.page-shell`, 420px para `.brand-label`) + uso
extensivo das classes Tailwind padrão (`sm`/`md`/`lg`/`xl` = 640/768/1024/1280) por toda a árvore de
componentes — confirma o que `guiafrontend.md` já descrevia.

Motion: `prefers-reduced-motion` tratado globalmentena raiz do CSS e de novo em cada bloco de animação
(hemiciclo, hover de cartão, hover de mapa, revelação de proposições) — já é a prática padrão do projeto,
não precisa ser instituída pelo redesign.

## 9. Desempenho de referência

`NOT_EVALUATED` por decisão honesta, não por omissão: não há Lighthouse configurado no projeto (mesmo
limite já documentado em `TESTES_E2E_P137.md`, §"O que esta suíte NÃO cobre"), e medir performance de
produção exigiria `next build` com `NEXT_DIST_DIR` isolado — fora do escopo "read-only" desta fase e sem
necessidade real para o Gate P0 (a Parte XII do mandato cobra isso só no Gate P7/QA final). Uma referência
indireta real: a página de Educação (11 capítulos) renderiza **21.069 px de altura em 1440px de largura**
— o documento mais longo capturado nesta auditoria (ver screenshot `estado-es-educacao-w1440.png`).

## 10. Testes existentes

- **E2E (Playwright)**: `tests/e2e/p14-territorio-executivo.spec.ts` (hero/mapa/executivo/IDHM/legislativo
  — 10 testes), `infraestrutura-p137.spec.ts` (30 testes: capítulos, explorador, obras, larguras de
  estresse 320–1920px), `wellbeing-p128.spec.ts`, `seguranca-p98.spec.ts` — todos seguem o mesmo padrão:
  rodar contra um **build isolado** (`NEXT_DIST_DIR=<nome> npx next build && ... next start -p <porta>`,
  depois `E2E_BASE_URL=http://127.0.0.1:<porta> npx playwright test ...`), nunca contra o dev server do
  usuário. `playwright.config.ts` confirma: só sobe `webServer` próprio quando `E2E_BASE_URL` não está
  definido — exatamente o mecanismo que esta auditoria usou (sem subir servidor nenhum, apenas apontando
  para a porta 3000 já ativa, só para leitura).
- **Unit/integration**: dezenas de arquivos por frente de coleta (`educacao-p101..p107`, `seguranca-p91..p98`,
  `wellbeing-page-build`, `infraestrutura` via os mesmos padrões) listados explicitamente no script `test`
  do `package.json` raiz — cobrem a camada de dados (`packages/db`), não a camada visual.
- Nenhum teste de acessibilidade automatizado (axe-core) foi encontrado para as páginas territoriais — o
  axe-core do projeto (`apps/web/docs/ux-redesign.md`) rodou só em páginas do Legislativo (home, perfil,
  gastos, `/investigar`). **Gap real para a Fase P7.**

## 11. Screenshots reais do estado atual

65 capturas em `artifacts/p0-auditoria/` (13 rotas × 5 larguras: 1440/1280/768/390/320), via Playwright
`chromium`, full-page, contra o servidor de desenvolvimento do usuário já em execução na porta 3000 (só
GET — nenhum processo foi criado, parado ou reiniciado). Rotas: `/estados/ES` + suas 5 abas temáticas +
`/estados/ES/representacao`; `/municipios/3205309` (Vitória) + suas 5 abas temáticas. Nomenclatura:
`<rota>-w<largura>.png` (ex.: `estado-es-educacao-w390.png`).

**Achados reais capturados durante a captura (não hipotéticos):**

- **Overflow horizontal em 320px** (o mandato exige zero) em 4 das 65 combinações: `/estados/ES` (21px),
  `/estados/ES/educacao` (27px), `/estados/ES/infraestrutura` (7px), `/municipios/3205309/educacao` (2px).
  Nas outras 61 combinações (incluindo 390px em todas as rotas) o overflow medido foi 0. Pré-existente,
  não introduzido por esta auditoria — relevante para o Gate P6/P7 do redesign (Parte X.26: "Não permita
  rolagem horizontal acidental").
- **Aviso real de console (React) em `/estados/ES/educacao` e `/municipios/.../educacao`, todas as
  larguras**: `Encountered two children with the same key` para os rótulos "Ensino fundamental"/"PDDE"
  (estado) e "Ensino fundamental"/"Medicina" (município) — duas listas de barras/tabela com `key`
  derivada de um texto que se repete entre dois conjuntos de dados diferentes renderizados juntos
  (prováveis candidatos: `BarList`/`explorer-columns.tsx` em `components/education/`). Não é um defeito
  visual visível nos screenshots, mas é um bug real de identidade de componente React, pré-existente,
  fora do escopo deste redesign mas vale registrar para quem for mexer em Educação.
- **Visual confirma o diagnóstico do mandato**: `estado-es-w1440.png` e `municipio-vitoria-w1440.png`
  mostram claramente o padrão repetitivo "eyebrow → título → 4 KPIs com sparkline → botão 'Ler a história
  completa'" repetido 5 vezes consecutivas (uma por tema) na visão geral — exatamente o "esqueleto visual
  dominante" que a Parte III.7 do mandato pede para romper. O mapa estadual é monocromático (rampa teal
  por padrão) — "tudo verde" confirmado visualmente, não só por leitura de `scale.ts`.
  `estado-es-educacao-w1440.png` mostra a página de Educação inteira (11 capítulos, 21.069px de altura):
  rica em dado, mas visualmente repetitiva capítulo a capítulo.

## 12. Dependências com outras frentes (não tocar)

Confirmado por nomenclatura de schema/scripts, sem necessidade de investigação nova: todo o Executivo/
Território lê dos schemas `civica_exec`, `civica_national`, `civica_media` via pools Postgres read-only
(`webPostgresPool()`); os coletores (`apps/collector`, `scripts/exec/p1xx_*`, `scripts/p18-p19 _*` etc.)
e as frentes já em produção (P9 Segurança, P9.5 Finanças/PNCP, P9.6–9.8, P10 Educação, P12 Bem-estar,
P13 Infraestrutura) não foram tocados nem precisam ser — o redesign consome os mesmos `*PageData` já
montados. Nenhuma migration, backfill ou alteração de coletor foi executada ou é necessária para as Fases
P1–P2 seguintes.

---

## Matriz de preservação funcional

Granularidade por capítulo (não por indicador individual — o detalhe de cada indicador já vive nos tipos
de `apps/web/lib/<tema>/types.ts`, redundante repetir aqui). "Tratamento planejado" e "Critério de
aceite" são o mesmo para quase todas as linhas, por isso aparecem só uma vez por bloco quando idênticos.

**Tratamento planejado (regra geral, vale para toda a tabela):** redesenhar a composição visual na
linguagem editorial nova (Partes III, VII, IX do mandato), preservando 100% do dado, fonte, filtro,
cobertura e comportamento interativo descritos na coluna "Informação apresentada"/"Filtros"/"Comportamento
interativo". Nenhuma mudança de contrato de dados, nenhuma nova consulta ao banco além das já existentes
em P14 (Executivo/IDHM/Legislativo).

**Critério de aceite (regra geral):** o mesmo valor, mesma fonte, mesma cobertura, mesmo filtro e mesma
rota continuam acessíveis; `npm run typecheck`, suíte `npm test` e os E2E territoriais existentes
(`p14-territorio-executivo`, `infraestrutura-p137`, `wellbeing-p128`, `seguranca-p98`) continuam
passando; nenhum console error novo; nenhum overflow horizontal novo.

| Rota | Tema | Capítulo | Componente | Informação apresentada | Fonte de dados | Filtros | Comportamento interativo | Estado atual |
|---|---|---|---|---|---|---|---|---|
| `/estados/[uf]`, `/municipios/[ibge]` | Visão geral | Hero | `TerritoryFrame` + `InstitutionHero` | Nome, kicker (região·UF ou município·UF), lede editorial com 1–2 big numbers, população+ano, CTA "Quem representa" | `loadState`/`loadMunicipality` (IBGE) | — | — | Pronto (P14, não commitado) |
| idem | Visão geral | Mapa | `MunicipalMap` | Coroplético por população/leitos/mortalidade (estado) ou locator (município) | `loadGeometry`, `loadMapValues` | 3 métricas via querystring, cada uma com rampa própria (teal/blue/amber) | link por município, legenda, aria-label por polígono | Pronto, monocromático por padrão (população) |
| `/estados/[uf]` | Visão geral | Busca + maiores municípios | `MunicipalFinder` | busca por nome, top-6 por população | `findMunicipalities` | busca GET | — | Pronto |
| ambas | Visão geral | Teaser Saúde | `HealthPanel` compacto | 7 KPIs + facilities | `loadIndicators`/`loadPanelValues` | — | link "Abrir Saúde" | Pronto |
| ambas | Visão geral | Teaser Educação | `EducationSummary` | 4 KPIs (hero.kpis) com sparkline+delta | reusa `loadEducationPageCached` (página inteira, cacheada 60s) | — | link "Ler a história completa" | Pronto |
| ambas | Visão geral | Teaser Segurança | `SecuritySummary` | idem padrão | reusa `loadSecurityPage` | — | idem | Pronto |
| ambas | Visão geral | Teaser Bem-estar | `WellbeingSummary` | idem padrão | reusa `loadWellbeingPageCached` | — | idem | Pronto |
| ambas | Visão geral | Teaser Infraestrutura | `InfrastructureSummary` | idem padrão | reusa `loadInfrastructurePageCached` | — | idem | Pronto |
| ambas | Visão geral | Executivo | `ExecutiveSummary` | Prefeito (se resolvido) ou Governador, foto TSE, partido, mandato, vice, PIB per capita | `loadCurrentExecutive`/`loadCurrentMayor`/`loadGdpPerCapita` | — | — | Pronto (P14, não commitado); 16 municípios sem prefeito resolvido (documentado, não é bug) |
| ambas | Visão geral | IDHM | `IdhmSummary` | 3 pontos reais (1991/2000/2010) território×Brasil + Renda/Longevidade/Educação | `loadHdiComparison` | — | — | Pronto (P14, não commitado) |
| ambas | Visão geral | Legislativo | `TerritoryLegislativeSummary` + `PartyHemicycle` | Senadores/Dep.Federais/Dep.Estaduais + hemiciclo partidário | `loadTerritoryLegislativeComposition` | — | link "Ver quem representa" | Pronto (P14, não commitado) |
| ambas | Visão geral | Grid de temas | `THEMES` grid | 5 cards de tema com status "Dados publicados"/"Coleta pendente" | — | — | link por tema | Pronto |
| `/estados/[uf]` | Visão geral | Cobertura | — | lista de datasets + competências | `loadCoverage` | — | — | Pronto |
| ambas | Saúde | Painel (único "capítulo") | `HealthSection`/`HealthPanel`/`EvolutionPanel`/`ResidentsPanel`/`HospitalsPanel` | 7 KPIs+3 análises, evolução comparada, moradores, hospitais | DATASUS (CNES/SINASC/SIM/SIH/PNI), IBGE | implícitos por painel | expansões `<details>` | Pronto; estrutura mais antiga, sem `ChapterNav` |
| ambas | Educação | 1 Quantos estudam | `ChapterShell#rede` | matrículas por etapa/rede, série | Censo Escolar | — | TrendChart | Pronto |
| ambas | Educação | 2 O que aprendem | `#aprendizagem` | Saeb/Ideb explorer | INEP | explorer por disciplina/ano | `ChartExplorer` | Pronto |
| ambas | Educação | 3 Quem fica pelo caminho | `#trajetoria` | abandono/repetência, transição ano-a-ano | INEP | explorer | `ChartExplorer` | Pronto |
| ambas | Educação | 4 Contexto | `#contexto` | INSE, 8 níveis socioeconômicos | INEP | — | — | Pronto |
| ambas | Educação | 5 As escolas | `#estrutura` | % escolas com cada infraestrutura | Censo Escolar | — | `ChartExplorer` evolução | Pronto |
| ambas | Educação | 6 Professores | `#professores` | formação docente, série | Censo Escolar | — | TrendChart | Pronto |
| ambas | Educação | 7 Dinheiro e obras | `#recursos` | contratos, categorias, fornecedores, obras | PNCP, Obrasgov, FNDE | — | DataTable | Pronto |
| ambas | Educação | 8 Enem | `#enem` | notas por área, benchmark, tabs | INEP/Enem | toggle disciplina | `EnemSubjectToggle`, `BenchRuler` | Pronto |
| ambas | Educação | 9 Ensino superior | `#ensino-superior` | instituições, modalidades, cursos | Censo da Educação Superior | `IesExplorer`/`CourseExplorer` | explorer client-side | Pronto |
| ambas | Educação | 10 Qualidade do ensino superior | `#qualidade-superior` | IGC, destaques por curso | INEP | `QualityExplorer` | explorer | Pronto |
| ambas | Educação | 11 Pós-graduação | `#pos-graduacao` | programas CAPES, conceito | CAPES | `ProgramExplorer` | explorer | Pronto |
| ambas | Segurança | 1 Criminalidade | `#criminalidade` | `CrimeExplorer` completo | Sinesp VDE, SIM/DATASUS, secretarias estaduais | tipo de crime, contagem/taxa, comparação ad hoc | fetch sob demanda | Pronto |
| ambas | Segurança | 2 Estrutura institucional | `#estrutura` | FBSP/ESTADIC/MUNIC | — | — | — | Pronto |
| ambas | Segurança | 3 Segurança viária | `#transito` | SIM, Senatran, RENAEST, PRF | — | — | — | Pronto |
| ambas | Segurança | 4 Sistema prisional | `#prisional` | SISDEPEN/SENAPPEN | — | — | — | Pronto |
| ambas | Segurança | 5 Finanças | `#financas` | Siconfi, PNCP, Transferegov | — | — | — | Pronto |
| ambas | Segurança | 6 Apreensões/policial | `#apreensoes` | Sinesp VDE | — | — | — | Pronto |
| ambas | Segurança | 7 Explorar | `#explorar` | explorador completo + export CSV | todas acima | busca livre | `ExplorerPanel` | Pronto |
| ambas | Bem-estar | 1 Condições de vida | `#condicoes` | renda média/mediana, Gini, moradia | Censo 2022 | — | `TerritoryCompareRow` | Pronto |
| ambas | Bem-estar | 2 Trabalho | `#trabalho` | CAGED (fluxo mensal), RAIS (estoque anual) | CAGED/RAIS | — | TrendChart | Pronto |
| ambas | Bem-estar | 3 Rede socioassistencial | `#rede-social` | CRAS/CREAS, índices | Censo SUAS | — | — | Pronto |
| ambas | Bem-estar | 4 Cotidiano digital | `#digital` | respostas MUNIC Sim/Não | MUNIC | — | — | Pronto |
| ambas | Bem-estar | 5 Ação pública | `#acao-publica` | despesa assistência social | Siconfi | — | DataTable | Pronto |
| ambas | Bem-estar | 6 Evolução | `#evolucao` | séries múltiplas | várias acima | — | TrendChart | Pronto |
| ambas | Infraestrutura | 1 Água e saneamento | `#agua-saneamento` | SINISA | — | — | `IndicatorDetails` | Pronto |
| ambas | Infraestrutura | 2 Ruas e entorno | `#ruas-entorno` | Censo Entorno/Favelas | — | unidade (`EntornoUnitSwitcher`) | — | Pronto |
| ambas | Infraestrutura | 3 Habitação | `#habitacao` | FJP | — | — | — | Pronto |
| ambas | Infraestrutura | 4 Energia | `#energia` | ANEEL/ANP | — | — | — | Pronto |
| ambas | Infraestrutura | 5 Mobilidade | `#mobilidade` | PEMOB/MUNIC, ANAC/DNIT | — | — | — | Pronto |
| ambas | Infraestrutura | 6 Segurança hídrica | `#seguranca-hidrica` | SNISB/ANM/Atlas Águas | — | — | — | Pronto |
| ambas | Infraestrutura | 7 Obras públicas | `#obras` + `/infraestrutura/obras` | totais, situação, estágios financeiros | Obrasgov | 9 filtros GET + paginação | `WorksList`, link detalhe | Pronto, inclusive export CSV e detalhe de obra com empenhos paginados |
| `/estados/[uf]/representacao` | Representação | — | 3 cards-portal | links para Câmara/Senado/Assembleia já existentes | — | — | — | Pronto, deliberadamente fino (não duplica consulta) |

---

## Status do Gate P0

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: as 12 tarefas da Fase P0 foram executadas por leitura direta de código
(não suposição), os 5 temas foram inventariados nos dois níveis territoriais com capítulos confirmados
linha a linha, os contratos de dados e a ausência de libs de gráfico/mapa foram confirmados em
`package.json`, 65 screenshots reais foram capturados contra o servidor do usuário sem tocá-lo, e 2
achados reais (não hipotéticos) foram documentados: overflow horizontal em 320px em 4 rotas, e um aviso
de chave duplicada do React em Educação.

Ressalvas que impedem um `PASS` puro:
1. **Item 9 (desempenho de referência) é `NOT_EVALUATED`** — sem Lighthouse configurado no projeto, e
   medir de verdade exigiria um build de produção isolado, fora do escopo read-only desta fase.
2. **Nenhuma auditoria de acessibilidade automatizada (axe-core) existe ainda para as páginas
   territoriais** — só para o Legislativo. A Fase P1/P7 precisa rodar essa auditoria do zero aqui.
3. Esta auditoria cobriu em profundidade **1 estado (ES) e 1 município (Vitória/ES)** — representativo,
   mas não cobre casos extremos (território sem prefeito resolvido, município com Censo pós-2022,
   DF/Fernando de Noronha) que os próprios testes E2E existentes (`infraestrutura-p137.spec.ts`) já
   tratam para Infraestrutura mas que o redesign deve continuar respeitando nos demais temas.

Nenhum impedimento bloqueia o início da Fase P1 (Design system). Nada no código real contradiz a direção
aprovada no mandato — pelo contrário, boa parte da fundação que a Parte VII/XI do mandato pede (contrato
de cobertura, narrativa determinística, hemiciclo, `ChapterNav`, filtros preservados em URL) **já existe
e deve ser preservada, não reconstruída**.
