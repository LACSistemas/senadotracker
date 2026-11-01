# P5.5 — Redesenho temático: Infraestrutura (sub-fase final de P5)

Última sub-fase da FASE P5 (redesenho temático completo). Escopo rígido: arquivos de Infraestrutura
(`app/estados/[uf]/infraestrutura/page.tsx`, `app/municipios/[ibge]/infraestrutura/page.tsx`,
`components/infrastructure/infrastructure-page.tsx`, `components/infrastructure/work-detail.tsx`) —
nenhum arquivo compartilhado foi editado, só consumido (`ChapterNav` de `components/security/chapter-nav.tsx`,
`IndicatorLive` de `components/indicators/indicator-live.tsx`, `heroKpiToKpi` de
`lib/comparison/kpi-adapters.ts`, todos importados sem modificação). `components/infrastructure/territory-compare.tsx`
(o shim de 3 linhas que P4 deixou apontando para `lib/comparison/*`) não foi tocado.

Base: os 9 docs anteriores em `docs/atlas-editorial-redesign/`, especialmente `P5_SAUDE.md`, `P5_EDUCACAO.md`,
`P5_SEGURANCA.md` e `P5_BEM_ESTAR.md` (padrão já validado 4 vezes: `ChapterNav layout="sidebar"` ativado
sem editar o componente; hero com a narrativa real já calculada em vez de texto genérico, com `hideLede`
para não duplicar; `IndicatorLive`/adaptadores de P4 aplicados onde há `Kpi`/`HeroKpi` real, nunca forçado).

## Contexto: Infraestrutura já tinha `TerritoryCompareRow` no panorama, mas nenhum `IndicatorLive`

Diferente dos outros 4 temas, o panorama de Infraestrutura já renderizava `TerritoryCompareRow` diretamente
(`hero.kpis.some(k => k.compare)`, pré-existente, não tocado) — a comparação território×UF×Brasil de até 3
indicadores elegíveis (só para município, calculada no backend). O que faltava era exatamente o que as 4
sub-fases anteriores já resolveram nos seus temas: navegação por capítulo e um momento "Indicador Vivo"
(Descobrir→Explorar→Verificar) dentro de cada capítulo, não só no panorama.

## O que mudou de verdade

### 1. Navegação por capítulo em sidebar persistente (`infrastructure-page.tsx`)
Mesmo padrão exato das 4 sub-fases anteriores: `<ChapterNav items={nav} />` → `<ChapterNav items={nav}
layout="sidebar" />`, envolvido em `className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start
lg:gap-10"` no container pai e `min-w-0 space-y-10` na coluna de conteúdo — **usei `lg:grid`, não `grid`**,
copiando deliberadamente o fix que a sub-fase de Segurança (P5.3) teve que descobrir por tentativa e erro
(429px de overflow com `grid` ativo em todas as larguras). 9 itens reais (Panorama + 7 capítulos + Fontes).

### 2. Abertura editorial sem duplicação (os 2 `page.tsx` + `hideLede`)
O `lede` estático e idêntico nas 2 rotas ("Condições de ruas e entorno, serviços de água e saneamento,
energia, mobilidade e obras públicas registradas — com fonte e cobertura à vista...") virou `data.hero.lede`,
a frase real que `heroLede()` (`lib/infrastructure/narrative.ts`, não tocado) já calculava — varia com o
território (ex.: *"Esta seção reúne 8 indicadores oficiais sobre ruas, água, energia e serviços urbanos e
2.236 projetos de obra pública registrados no estado de Espírito Santo — cada um com sua própria fonte, ano
e cobertura."*). `InfrastructurePage` ganhou `hideLede?: boolean` (mesmo padrão de `HealthPanel.hideLede` e
`WellbeingPage.hideLede`) para não repetir a mesma frase dentro do próprio painel — os 2 `page.tsx` passam
`hideLede`.

### 3. `IndicatorLive` em todos os 7 capítulos numerados — mapeamento 1:1 já existia no próprio dado
`HERO_KPI_PRIORITY` (`lib/infrastructure/catalog.ts`, não tocado) já definia, por desenho, até 8 KPIs do
panorama — e cada um mapeia para exatamente 1 dos 7 capítulos (confirmado lendo `MODULE_FAMILIES` e os
`byFamily()` de cada capítulo em `load.ts`): `IAG0001`/`IES0001` → Água e saneamento,
`INF-ENTORNO-HOUSEHOLD-PAVEMENT`/`-LIGHTING` → Ruas e entorno, `INF-INTERNET-DOMICILIOS` → Habitação (a
própria `MODULE_FAMILIES.housing` já inclui `INTERNET_DOMICILIAR` — classificação pré-existente, não
decidida por esta sub-fase), `ENERGY-MMGD-INSTALLED-KW` → Energia, `IND-MOB-PEMOB-SERVICOS-MUNICIPAIS` →
Mobilidade, `INF-DAMS-SNISB-TOTAL` → Segurança hídrica, e o KPI sintético `OBRASGOV-PROJECTS` (adicionado em
`load.ts` quando há obra registrada) → Obras públicas. Isso é **mais cobertura que qualquer sub-fase
anterior de P5** (Educação 3/11, Segurança 2/6, Bem-estar 1 seção) — não por ter forçado mais, mas porque o
próprio catálogo de KPIs do tema já foi desenhado com 1 indicador por capítulo.

Implementação: `kpiForChapter(codes, anchor)` busca o primeiro `HeroKpi` de `hero.kpis` cujo `code` esteja na
lista (a ordem de `hero.kpis` já segue `HERO_KPI_PRIORITY`, então a prioridade declarada acima é respeitada
sem lógica extra) e aplica `heroKpiToKpi(h, { chapterAnchor })` — o adaptador que P4 já construiu e nunca
tinha sido aplicado a uma página real de Infraestrutura. Cada capítulo recebe, no topo, `{kpi && <IndicatorLive
kpi={kpi} who={where} lead verify={verifyFor(kpi)} />}` — `verifyFor` monta `{source, definition, notes}` a
partir dos campos que o próprio `Kpi` adaptado já carrega (`source`, `plain`, `secondary`), nunca inventado.
Quando o indicador daquele capítulo não tem valor publicado para o território, o card simplesmente não
aparece (`kpi` fica `null`) — mesmo comportamento honesto de ausência que o resto do produto já usa.

### 4. Comparação visual dos 5 estágios financeiros de obras — `BarList`, não um gráfico novo
A Parte VIII.19 do mandato pede tratamento "especialmente investigativo" para obras, com destaque visual
para os 5 estágios (previsto/contratado/empenhado/liquidado/pago). Em vez de inventar um componente de
funil/cascata (risco real de parecer que os estágios se somam, o que o mandato proíbe explicitamente), reusei
`BarList` — o mesmo componente de barras horizontais com valor escrito ao lado que o produto já usa em todo
lugar (`Obras públicas por situação oficial`, `Alunos por etapa`, etc.) — aplicado em 2 lugares:
- **`work-detail.tsx`** (ficha de uma obra): `BarList` com os 5 estágios da obra, só quando ≥2 têm valor
  publicado, acima da grade `dl` que já existia (preservada integralmente, não substituída).
- **`infrastructure-page.tsx`** (Capítulo 7, agregado do território): mesmo tratamento para `works.financial`
  (o agregado que o backend já calcula — nenhuma query nova), também acima da `dl` existente.
Caption explícita em ambos: *"Barras na mesma escala só para comparar a magnitude de cada estágio — não
representam uma sequência que se soma."* — a mesma ressalva que o texto abaixo já trazia, reforçada
visualmente, não substituída.

## O que NÃO mudou (preservação de 100% do dado)

Nenhum capítulo, grupo de indicadores, `EntornoUnitSwitcher`, `IndicatorExplorer`, `IndicatorDetails`
(disclosures), tabela de cobertura por família, ou os 9 filtros GET + paginação + export CSV + detalhe de
obra com empenhos paginados (`works-list.tsx`, `work-detail.tsx` fora do bloco de estágios, `explorer.tsx`)
foi alterado ou removido. Nenhuma query nova, nenhum cálculo em `lib/infrastructure/{build,load,narrative,
catalog,format,works}.ts` foi tocado — só composição/apresentação ao redor. Confirmado por:
- Leitura completa de `infrastructure-page.tsx` e `work-detail.tsx` antes de editar.
- Comparação visual direta dos 13 screenshots desta fase (`artifacts/p5-infraestrutura/`) contra os de
  referência de P0 (`artifacts/p0-auditoria/*infraestrutura*`) e contra `infraestrutura-p137.spec.ts`
  passando por inteiro (ele cobre especificamente obras ricas em contratos/empenhos, obra multimunicipal,
  obra recém-cadastrada sem zero fictício, obra inexistente→404, filtros preservados na URL, paginação).

## Achado real, não corrigido, fora do escopo de arquivo

`KpiCard` (arquivo compartilhado, não editável) renderiza `k.label` como legenda superior (eyebrow) e
`k.plain` como subtítulo logo abaixo. `heroKpiToKpi` (P4, `lib/comparison/kpi-adapters.ts`, também fora do
meu escopo) define `plain: h.label` — os dois campos sempre idênticos para qualquer KPI adaptado por essa
função. O resultado visual é uma repetição leve ("ABASTECIMENTO DE ÁGUA" seguido de "Abastecimento de água"),
confirmada em `crop-agua-chapter.png` durante a verificação (não salvo no diretório final de evidência, só
usado para inspeção). **Mesmo comportamento já estava presente em Bem-estar (P5.4)**, que usa o adaptador
irmão `portraitFactToKpi` com o mesmo padrão `plain: p.label` — não é uma regressão desta sub-fase, é uma
característica do adaptador de P4, repetida em todo lugar onde ele é usado. Registrado para avaliação em P6
(ajustar os 2 adaptadores para omitir `plain` ou usar um texto diferente de `label`), não corrigido aqui por
estar em `lib/comparison/*`, fora do escopo de arquivo autorizado.

## Verificação

- `NEXT_DIST_DIR=.next-p5infra npm run typecheck` (workspace `@senadotracker/web`, isolado) — limpo, 0 erros.
- `NEXT_DIST_DIR=.next-p5infra npx next build` — sucesso.
- Servidor isolado (`next start -p 3161`) — porta 3000 do usuário confirmada respondendo normalmente antes e
  depois (nunca tocada); servidor isolado derrubado ao final, `.next-p5infra` removido.
- `npx playwright test tests/e2e/p14-territorio-executivo.spec.ts tests/e2e/infraestrutura-p137.spec.ts`
  contra o build isolado — **40/40 passando**, incluindo os **30/30 de `infraestrutura-p137.spec.ts` por
  inteiro** (não amostra): capítulos, navegação por teclado do `ChapterNav`, movimento reduzido, larguras de
  estresse 320–1920px, explorador com export CSV real, lista de obras com filtro/paginação preservados na
  URL, obra rica em contratos/empenhos, obra multimunicipal, obra recém-cadastrada sem zero fictício, obra
  inexistente → 404, territórios pequenos/pós-Censo com ausência honesta, regressão dos outros 4 temas.
- 13 screenshots reais (`artifacts/p5-infraestrutura/`): 5 larguras (1440/1280/768/390/320) × 2 territórios
  (ES + Vitória) para a visão geral do tema, mais lista de obras (ES e Vitória) e 1 ficha de detalhe de obra
  rica (`/obras/89442`, 1327 empenhos, 2 contratos) em 1440px.
- Overflow horizontal: **0px em 12 das 13 combinações**. A única exceção é `/estados/ES/infraestrutura` em
  320px (7px) — **mesma rota e mesma magnitude exata (7px) já medida em P0 §11**, antes de qualquer trabalho
  desta fase (P0 documentou exatamente "`/estados/ES/infraestrutura` (7px)" entre os 4 casos de overflow
  pré-existente) — não introduzido aqui, não corrigido aqui, mesmo precedente de P1–P5.4 (fica para P6).
- Conferência visual direta: sidebar numerada 1–9 destacando o capítulo ativo ao rolar (`Água e
  saneamento`), `IndicatorLive` renderizando valor real + disclosure "Verificar fonte e metodologia" +
  "Explorar →"; `BarList` de estágios financeiros renderizando magnitudes reais e distintas (inclusive um
  caso real onde "Pago" supera "Previsto" — dado real da fonte, não um erro de renderização, preservado tal
  como é, sem normalizar).

## Necessidade de arquivo compartilhado identificada, não executada

Uma: o campo `plain` duplicado em relação a `label` nos adaptadores `heroKpiToKpi`/`portraitFactToKpi`
(`lib/comparison/kpi-adapters.ts`) — ver seção de achado acima. Afeta Infraestrutura e Bem-estar igualmente;
mudar esse arquivo compartilhado deveria ser decidido olhando os dois temas juntos, não só este.

## Status do Gate

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: navegação por capítulo chega a Infraestrutura (último dos 5 temas a ganhá-la),
abertura editorial deixa de ser texto genérico fixo idêntico nas 2 rotas, **todos os 7 capítulos numerados**
ganham `IndicatorLive` com Nível 3 "Verificar" que não tinham (a cobertura mais completa entre as 5
sub-fases de P5, decorrente do próprio desenho do catálogo de KPIs do tema, não de um esforço extra), a
seção de obras públicas — a mais investigativa do produto — ganha uma comparação visual honesta dos 5
estágios financeiros em 2 pontos (ficha de obra e agregado do capítulo) sem implicar soma, 100% dos
capítulos/filtros/explorador/exportação/paginação preservados, typecheck limpo, 40 e2e reais passando
incluindo os 30 testes completos (não amostra) do arquivo mais extenso do produto.

Ressalvas que impedem um `PASS` puro:
1. Achado real não corrigido (duplicação visual `label`/`plain` herdada do adaptador de P4) — fora do
   escopo de arquivo desta sub-fase, registrado para P6.
2. O overflow pré-existente de 320px em `/estados/ES/infraestrutura` continua sem correção — decisão
   deliberada, mesmo precedente de todas as sub-fases anteriores.
3. A lista paginada de obras (`works-list.tsx`) não recebeu nenhuma mudança de composição — decisão
   deliberada de não arriscar a funcionalidade mais rica do tema (9 filtros GET, paginação, export CSV),
   mesmo critério de risco/benefício que Segurança aplicou ao `CrimeExplorer`.
4. Cobertura de verificação visual em 1 estado (ES) + 1 município (Vitória) + 1 obra — representativo, não
   exaustivo.

Nenhum impedimento para consolidar a FASE P5 (`P5_REDESENHO_TEMATICO.md`) e avançar para P6.
