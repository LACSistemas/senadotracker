# P5.3 — Redesenho temático: Segurança Pública

Terceira sub-fase da FASE P5 (redesenho temático completo). Escopo rígido: arquivos de Segurança não
compartilhados (`app/estados/[uf]/seguranca/page.tsx`, `app/municipios/[ibge]/seguranca/page.tsx`,
`components/security/security-page.tsx`, `lib/security/hero.ts`) + 1 arquivo de teste próprio do tema
(`tests/e2e/seguranca-p98.spec.ts`, justificado abaixo). Nenhum dos 4 arquivos realmente compartilhados
que vivem no mesmo diretório (`chapter-nav.tsx`, `security-ui.tsx`, `security-hero.tsx`, `trend-chart.tsx`,
usados também por Educação desde P5.2, e por Bem-estar/Infraestrutura nas próximas sub-fases) foi editado
— só consumidos (`ChapterNav` com `layout="sidebar"`, `IndicatorLive` de `components/indicators/`).

## Contexto: Segurança já era o tema mais maduro no contrato `Kpi`/`KpiCard`

P0 e P1 já haviam identificado que `Kpi`/`KpiCard`/`ChartView` (o contrato que `IndicatorLive` envolve)
**nasceram neste tema** — Educação os importa de `lib/security/types.ts`. Isso muda o que "redesenhar
Segurança" significa: o painel (`SecurityHero`, arquivo compartilhado, não tocado) já renderiza os 4 KPIs
do panorama com `KpiCard` completo (valor, delta, sparkline, régua de comparação por quartil, fonte,
link "Explorar →") — ou seja, o Nível 1 (Descobrir) do "Indicador Vivo" já existia aqui antes de qualquer
redesign. O trabalho real desta sub-fase foi: (1) dar a Segurança a navegação por capítulo que as outras
páginas já ganharam, (2) trocar o `lede` estático e genérico do hero por uma frase real e validada, e
(3) levar o Nível 3 (Verificar) para dentro dos 2 capítulos que têm um Kpi dedicado e ainda não o tinham.

## O que mudou de verdade

### 1. Navegação por capítulo em sidebar persistente (`security-page.tsx`)
`<ChapterNav items={nav} />` → `<ChapterNav items={nav} layout="sidebar" />`, dentro do mesmo padrão de
grid que Saúde/Educação já validaram: `className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-10"`
no container pai, `min-w-0` na coluna de conteúdo. 8 itens reais (Panorama + 6 capítulos + Explorar).

**Armadilha real encontrada e corrigida no próprio ciclo**: a primeira versão usava `className="grid gap-6 ..."`
(grid ativo em TODAS as larguras) em vez de `"lg:grid ..."` (grid só a partir de 1024px, como Educação
já fazia). Abaixo de `lg`, isso tornava `ChapterNav` um item de grid com `min-width:auto` implícito —
como a navegação por pílulas usa `overflow-x-auto` para rolar internamente, o item de grid forçava a
largura total do `<ol>` (sem rolar) para fora da viewport. Medido: **429px de overflow em 390px antes do
fix**. Corrigido copiando exatamente o padrão já verificado de `education-page.tsx` (`lg:grid`, não
`grid`) — 0px de overflow depois, confirmado nas 10 combinações de screenshot desta fase.

### 2. Abertura editorial com manchete real (`lib/security/hero.ts`, 2 `page.tsx`)
Nova função `securityLedeFor(hero)`: quando o KPI líder do panorama (`hero.kpis[0]`, sempre "Homicídios
dolosos" ou "Mortes por agressão" quando disponível, por construção de `buildHero`) tem uma comparação
validada (`compare.valid`), usa essa frase pronta (`bench.sentence`, já nomeia o território e a mediana
do grupo) como `lede` do `TerritoryFrame`; cai para o `hero.lede` genérico quando não há comparação válida.
Real, não inventado — exemplo capturado (`artifacts/p5-seguranca/estado-es-seguranca-w1440.png`):
*"Entre as UFs, a mediana de homicídios dolosos (taxa) em 2025 foi 17,3 por 100 mil habitantes; Espírito
Santo registrou 18,5, dentro da faixa central."*

**Sem duplicação**: diferente do texto que `SecurityHero` (arquivo compartilhado) mostra logo abaixo
(`hero.lede`, o framing genérico "Registros oficiais mais recentes de X..."), a frase do hero band é
estruturalmente diferente (uma é a sentença de comparação do KPI líder, a outra é o framing do painel) —
não há 2 ocorrências do mesmo texto na página. A mesma frase aparece pela 3ª vez, colapsada, dentro do
`<details>` "Como a comparação foi feita" do próprio `KpiCard` — mesmo padrão não-problemático já aceito
em P5.1/P5.2 para legendas de `BenchRuler`/régua por card.

### 3. `IndicatorLive` nos 2 capítulos com Kpi dedicado (`security-page.tsx`)
`hero.kpis` já marca cada KPI com o capítulo a que pertence (`chapter: 'transito'`, `chapter: 'financas'`
— confirmado lendo `buildHero`). Adicionei um card `IndicatorLive` no topo dos capítulos 3 (Trânsito) e 5
(Finanças), reusando o mesmo Kpi do panorama (sem `chart`, porque os dois capítulos já têm seus próprios
gráficos completos logo abaixo — mesma decisão que Educação tomou para seus capítulos 2 e 3) com
`verify={{ source, definition: plain, caveat }}` — texto que o próprio `Kpi` já carregava.

**Criminalidade (Capítulo 1) e Finanças não ganharam duplicação do 2º KPI do panorama ("Roubos")**: só o
líder de cada capítulo (1 KPI por capítulo de destino) foi usado — Criminalidade já é protagonizado pelo
`CrimeExplorer` (componente rico já existente, não tocado) e os 2 KPIs de criminalidade do panorama
("Homicídios", "Roubos") já aparecem ali; adicionar `IndicatorLive` dentro do Capítulo 1 seria reduntante
em cima de um capítulo que já abre com o explorador completo.

**Estrutura/Prisional/Apreensões não ganharam `IndicatorLive`**: não têm Kpi real disponível em
`hero.kpis` — Prisional e Apreensões são **excluídos de propósito** de `buildHero` (`rejected.push`, com
motivo explícito: "a ocupação prisional não é a segurança do morador" / "apreensões não significam piora
nem melhora"). Forçar um adaptador novo para esses 3 capítulos exigiria construir um `Kpi` a partir de
`InstitutionCard`/`PrisonUnitView`/`PoliceFamilyView` — trabalho real de adaptação, fora do escopo desta
passagem (mesmo precedente de risco/tempo que P4 já registrou para Bem-estar/Infraestrutura).

### 4. Bug real encontrado e corrigido: id de DOM duplicado (`security-page.tsx`)
`KpiCard` (arquivo compartilhado, não editável) gera `id={`kpi-${k.id}`}`. Como os Kpis de Trânsito/
Finanças reaparecem agora dentro do próprio capítulo, usar o MESMO objeto `Kpi` criaria 2 elementos com o
mesmo `id` no DOM — HTML inválido e quebra qualquer seletor que dependa de id único. Corrigido clonando o
Kpi com um `id` distinto antes de passar para `IndicatorLive` (`{ ...kpi, id: `${kpi.id}-chapter` }`) —
nenhum valor/label/fonte exibido muda, só a chave de DOM.

## Teste próprio do tema atualizado (fora da lista original de arquivos, justificado)

`tests/e2e/seguranca-p98.spec.ts` tinha uma asserção (`[id^="kpi-"]` → exatamente 4 elementos) que
assumia implicitamente que nenhum Kpi do panorama jamais reaparece em outro lugar da página — suposição
que deixou de valer com a mudança #3 acima (intencional, verificada, correta). Atualizei a asserção para
`[id^="kpi-"]:not([id$="-chapter"])`, que mede exatamente o que o teste sempre quis medir (os 4 cards do
panorama), em vez de depender acidentalmente de um prefixo de id que `KpiCard` não documenta como
contrato. Esta é a única mudança fora dos arquivos de produto listados no escopo original — é o próprio
teste de Segurança, não de outro tema, e decorre diretamente de uma mudança intencional desta sub-fase.

## O que NÃO mudou (preservação de 100% do dado)

Nenhum capítulo, filtro, `CrimeExplorer` (seleção por grupo, toggle contagem/taxa, comparação ad hoc,
aviso de supressão por privacidade), `ExplorerPanel` (export CSV), tabela ou fonte foi alterado nos 7
capítulos. Nenhuma query nova, nenhum cálculo de benchmark tocado — só composição/apresentação ao redor.
Confirmado por comparação visual direta com os screenshots de referência de P0 (`artifacts/p0-auditoria/*seguranca*`).

## Achado real, não corrigido, fora do escopo de arquivo

Durante a verificação, `tests/e2e/seguranca-p98.spec.ts:69` revelou uma falha **pré-existente e não
relacionada a esta sub-fase**: `/municipios/3205309` (visão geral) tem 4 links "Ler a história completa"
(um por tema com teaser), e o teste assumia que seria só 1 (escrito antes de P2 introduzir o layout de
pares com todos os 5 temas visíveis simultaneamente na visão geral). Confirmei que nenhum arquivo tocado
por esta sub-fase tem relação com essa página — é herdado de P2 (`municipios/[ibge]/page.tsx`, fora do
meu escopo de arquivo). Não corrigido aqui; registrado para quem for revisar a visão geral municipal.

## Verificação

- `NEXT_DIST_DIR=.next-p5segur npm run typecheck` (workspace `@senadotracker/web`, isolado) — limpo, 0
  erros, em todas as rodadas.
- Build de produção isolado + servidor isolado (`next start -p 3159`) — porta 3000 do usuário confirmada
  respondendo normalmente antes, durante e depois (nunca tocada).
- `npx playwright test tests/e2e/p14-territorio-executivo.spec.ts tests/e2e/infraestrutura-p137.spec.ts tests/e2e/seguranca-p98.spec.ts`
  contra o build isolado — **53/53 passando** (40 dos 2 primeiros arquivos + 13/13 do arquivo próprio do
  tema, incluindo as 2 asserções de overflow em 390px) após os 2 fixes acima (`lg:grid` e `id` clonado).
- 10 screenshots reais (`artifacts/p5-seguranca/{estado-es-seguranca,municipio-vitoria-seguranca}-w{1440,
  1280,768,390,320}.png`, full-page) — **0px de overflow horizontal e 0 erros de console em todas as 10
  combinações**, medido por script.
- Conferência visual direta: manchete real no hero (`estado-es-seguranca-w1440.png`), sidebar numerada
  1–8 destacando o capítulo ativo ao rolar (verificado no Capítulo 4, Trânsito).
- Isolados (`.next-p5segur`, servidor na porta 3159, scripts de diagnóstico temporários) removidos ao
  final.

## Status do Gate

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: navegação por capítulo chega a Segurança, abertura editorial passa a citar
um fato real e validado em vez de texto genérico fixo, 2 capítulos (Trânsito, Finanças) ganham Nível 3
"Verificar" que não tinham, 2 bugs reais introduzidos no próprio ciclo (overflow de 429px, id duplicado
de DOM) foram encontrados e corrigidos antes de reportar, 100% do dado/filtro/explorador/exportação
preservado, typecheck limpo, 53 e2e reais passando (incluindo o arquivo de teste específico do tema, que
nenhuma sub-fase anterior havia rodado).

Ressalvas que impedem um `PASS` puro:
1. Só 2 dos 6 capítulos numerados ganharam `IndicatorLive` — Estrutura/Prisional/Apreensões não têm Kpi
   disponível no contrato atual (exclusão deliberada de `buildHero`, não uma lacuna desta fase); forçar
   um adaptador novo para eles fica para uma fase futura, se fizer sentido.
2. Criminalidade (o capítulo provavelmente mais visitado) não ganhou nenhuma mudança de composição além
   da navegação por sidebar — decisão deliberada de não arriscar o `CrimeExplorer`, já maduro e rico.
3. Achado pré-existente de outra fase (link "Ler a história completa" ambíguo na visão geral municipal)
   identificado mas não corrigido, por estar fora do escopo de arquivo desta sub-fase.
4. Cobertura de verificação ficou em 1 estado (ES) + 1 município (Vitória) — representativo, não
   exaustivo.

Nenhum impedimento para a próxima sub-fase (Bem-estar).
