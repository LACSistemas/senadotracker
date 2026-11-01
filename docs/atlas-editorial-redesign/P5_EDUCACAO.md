# P5.2 — Redesenho temático: Educação

Segunda sub-fase da FASE P5 (redesenho temático completo). Escopo rígido: só arquivos do tema Educação
(`app/estados/[uf]/educacao/page.tsx`, `app/municipios/[ibge]/educacao/page.tsx`,
`components/education/education-page.tsx`) — nenhum arquivo compartilhado foi editado, só consumido
(`ChapterNav` de `components/security/chapter-nav.tsx` e `IndicatorLive` de
`components/indicators/indicator-live.tsx`, ambos importados sem modificação).

## O que mudou de verdade

1. **Navegação por capítulo em sidebar persistente** (`education-page.tsx`): `<ChapterNav items={nav} />`
   (faixa horizontal fixa) virou `<ChapterNav items={nav} layout="sidebar" />`, envolvido num grid de 2
   colunas (`lg:grid-cols-[220px_minmax(0,1fr)]`, mesmo padrão de P5.1/Saúde) — sidebar à esquerda a
   partir de 1024px com os 13 itens (Panorama + 11 capítulos + Fontes), faixa horizontal abaixo disso.
   Esta era a página mais longa do produto (21.069px em 1440px, medido em P0) sem nenhuma navegação
   lateral — agora tem.
2. **Abertura editorial sem duplicação** (os 2 `page.tsx`): o `lede` estático do `TerritoryFrame`
   ("Quantos estudam, o que aprendem em matemática e português...", igual nas duas rotas, sem dado real)
   virou `data.hero.lede` — a mesma frase comparativa real que `narrative.ts` já calculava
   (ex.: *"867.017 alunos estudam no estado de Espírito Santo em 2.986 escolas (Censo Escolar 2025). Em
   2020 eram 883.113: praticamente o mesmo número. Em 2025, a média em matemática no 5º ano (todas as
   redes) foi 238,6 pontos, contra 232,2 em 2023. Acima do Brasil (232,3) em 6,3 pontos. Em 2025, 0,2% dos
   alunos no ensino fundamental abandonaram a escola durante o ano..."*) — antes só aparecia, igual, uma
   segunda vez dentro da seção "Panorama" da própria página; removi essa segunda ocorrência (mantive o
   `<h2>` "Como está a educação em X?", só tirei o `<p>` duplicado) em vez de manter as duas, seguindo o
   mesmo padrão que P5.1 (Saúde) já tinha estabelecido para esse problema específico.
   Fallback: se `hero.lede` vier vazio (`''`, só acontece quando não há nenhum dos 4 indicadores do
   panorama), o texto estático genérico original continua servindo de rede de segurança — nunca fica sem
   lede nenhum.
3. **Três capítulos ganharam `IndicatorLive` no topo — zero dado novo** (`education-page.tsx`): o
   `hero.kpis` do panorama já é `Kpi[]` real, com cada item marcado com o `chapter` a que pertence
   (`matriculas`→`rede`, `ideb`→`aprendizagem`, `abandono`→`trajetoria` — confirmado lendo
   `lib/education/load.ts`). Em vez de inventar um adaptador novo, busquei o `Kpi` correspondente
   (`kpiFor(id)`) e o passei para `IndicatorLive` logo abaixo do cabeçalho de cada um desses 3 capítulos:
   - **Capítulo 1 (Quantos estudam)**: `IndicatorLive` com o Kpi `matriculas`, usando `network.enrollment`
     (o `ChartView` que antes era renderizado incondicionalmente logo abaixo) como Nível 2 — a mesma série
     agora vive dentro do disclosure "Explorar a série completa" do card, em vez de duplicada visível duas
     vezes. Isso é uma mudança de composição deliberada (o gráfico não desaparece, só passa a ficar atrás
     de 1 clique, igual ao resto do produto que já usa `IndicatorLive`), não perda de dado — confirmei
     visualmente que a série ainda está lá, completa, dentro do disclosure.
   - **Capítulo 2 (O que aprendem)**: `IndicatorLive` com o Kpi `ideb` (a nota mais reconhecível do tema),
     sem `chart` (o capítulo já tem 2 `ChartExplorer` completos — Saeb e Ideb — logo abaixo, que continuam
     fazendo o papel de Nível 2; adicionar um terceiro gráfico seria redundante).
   - **Capítulo 3 (Quem fica pelo caminho)**: `IndicatorLive` com o Kpi `abandono`, mesmo raciocínio (o
     capítulo já tem seu próprio `ChartExplorer`).
   Cada card usa `verify={{ source: kpi.source, definition: kpi.plain, caveat: kpi.caveat }}` — texto que
   o próprio `Kpi` já carregava, nunca inventado. Resultado visual: esses 3 capítulos abrem com um momento
   de "grande número" real antes de qualquer tabela/explorador, diferenciando-os visualmente dos outros 8
   capítulos (que seguem `StatGrid`/`BarList`/`DataTable` direto) — quebra parcial, honesta, do "esqueleto
   repetitivo" que P0 documentou, não uma reformulação de todos os 11.

## O que NÃO mudou (preservação de 100% do dado)

Nenhum capítulo, filtro, explorador (`ChartExplorer`, `IesExplorer`, `CourseExplorer`, `QualityExplorer`,
`ProgramExplorer`, `EnemSubjectToggle`), tabela, exportação CSV ou fonte foi removido ou alterado nos 11
capítulos. Confirmado por:
- Leitura completa do componente antes de editar — nenhuma mudança em `lib/education/*.ts` (nenhuma
  query, nenhum cálculo de KPI/narrativa tocado).
- Comparação visual direta dos screenshots desta fase (`artifacts/p5-educacao/`) contra os de referência
  de P0 (`artifacts/p0-auditoria/*educacao*`): mesmos 4 KPIs do panorama, mesmos 11 capítulos na mesma
  ordem, mesmas tabelas e exploradores.
- Os 8 capítulos sem `IndicatorLive` (Contexto, As escolas, Professores, Dinheiro e obras, Enem, Ensino
  superior, Qualidade do ensino superior, Pós-graduação) não tiveram nenhuma linha de JSX alterada.

## Investigação do bug de key duplicada do React (P0 §11) — não reproduzido, não corrigido

P0 documentou um aviso real de console ("Encountered two children with the same key" para rótulos como
"Ensino fundamental"/"PDDE" no estado e "Ensino fundamental"/"Medicina" no município) nas mesmas 2 rotas
que esta fase usa (`/estados/ES/educacao`, `/municipios/3205309/educacao`). Antes de decidir corrigir,
tentei reproduzir:
- Build de produção isolado + servidor isolado (porta 3157): **0 avisos de console** nas 2 rotas, todas as
  5 larguras — mas avisos de chave duplicada do React são **suprimidos em build de produção** (só existem
  em modo dev), então este teste sozinho não prova nada.
- Por isso, subi também um **servidor de desenvolvimento isolado** (`next dev`, porta 3158, `NEXT_DIST_DIR`
  próprio, nunca a porta 3000 do usuário) — exatamente o modo onde o aviso apareceria se ainda existisse.
  Resultado: **nenhum aviso de key duplicada em nenhuma das 2 rotas**, só ruído de WebSocket do HMR
  (`ws://.../_next/hmr` falhando, irrelevante — artefato do ambiente isolado, não um bug do produto).
- Não encontrei o código que P0 suspeitava (`BarList`, `explorer-columns.tsx`, `DataExplorer`) com uma
  falha real de chave: `BarList`/`StatGrid`/`DataTable` usam `key={label}` escopado a UMA lista por vez
  (sem colisão entre instâncias irmãs, que é como o React realmente verifica unicidade de key);
  `DataExplorer` (client-side, Ensino superior/Qualidade/Pós-graduação) usa `key={i}` (índice), imune a
  colisão de nome.

**Conclusão honesta**: não consegui reproduzir o bug que P0 capturou, nem em produção nem em dev, nas
mesmas rotas. Não fiz nenhuma mudança que pudesse tê-lo corrigido incidentalmente (não toquei
`BarList`/`DataTable`/`DataExplorer`). A explicação mais provável é que o bug era dependente de um estado
de dado específico no momento da captura de P0 (ex. uma combinação específica de linhas do PNCP/Censo que
coincidiam em rótulo) e os dados mudaram desde então — este produto lê Postgres a cada request
(`force-dynamic`, sem cache de página), e frentes de coleta (PNCP, etc.) continuam publicando dado novo
independentemente deste redesign. Registro isto como "não reproduzido nesta data" em vez de "corrigido" —
não inflar a alegação.

## Verificação

- `NEXT_DIST_DIR=.next-p5educ npm run typecheck` (workspace `@senadotracker/web`, isolado) — limpo, 0
  erros (incluindo o ajuste de `{...(cond ? {chart: ...} : {})}` para respeitar
  `exactOptionalPropertyTypes: true`, mesmo problema que P4 já tinha documentado).
- Build de produção isolado + servidor isolado (`next start -p 3157`) — sucesso; porta 3000 do usuário
  confirmada respondendo normalmente ao final, nunca tocada.
- Servidor de desenvolvimento isolado (`next dev -p 3158`) usado só para a investigação do bug de key
  duplicada (ver seção acima) — removido ao final.
- `npx playwright test tests/e2e/p14-territorio-executivo.spec.ts tests/e2e/infraestrutura-p137.spec.ts`
  contra o build isolado — **40/40 passando**, incluindo "educação (município) continua respondendo 200
  sem erro de console" (presente nos 2 arquivos) — nenhuma regressão.
- 10 screenshots reais (`artifacts/p5-educacao/{estado-es-educacao,municipio-vitoria-educacao}-w{1440,
  1280,768,390,320}.png`, full-page) + 2 capturas adicionais recortadas no topo e no capítulo 1 para
  inspeção visual de perto (`crop-top.png`, `crop-rede-chapter.png`).
- Overflow horizontal: **0px em 8 das 10 combinações**. As 2 exceções são `/estados/ES/educacao` em 320px
  (27px) e `/municipios/3205309/educacao` em 320px (2px) — **mesma magnitude exata que P0 já tinha medido
  antes de qualquer trabalho desta fase** (27px e 2px, idênticos), confirmando que é o mesmo bug
  pré-existente do `MunicipalFinder`/grid sem `grid-cols-1` de base já diagnosticado em P3 — não
  introduzido aqui, não corrigido aqui (mesmo precedente: fica para P6).
- Conferência visual direta (`crop-top.png`, `crop-rede-chapter.png`): sidebar aparece como coluna lateral
  numerada 1–13 a partir de 1024px, com "Quantos estudam" destacado em verde ao rolar até lá; o card
  `IndicatorLive` do Capítulo 1 mostra "MATRÍCULAS · 867.017 alunos em 2.986 escolas", sparkline real,
  delta "−16.096 alunos desde 2020", régua de comparação e os disclosures "Explorar a série completa" /
  "Verificar fonte e metodologia" funcionando.
- **Achado pré-existente, fora do escopo desta fase**: o card "MATRÍCULAS" no grid de 4 colunas do
  panorama tem o selo "Censo 2025" visualmente colado à direita do rótulo, quase tocando a última letra —
  comportamento do `KpiCard` compartilhado (`components/security/security-hero.tsx`, fora do meu escopo de
  arquivo) para rótulos longos em card estreito; não é novo (o rótulo e o grid de 4 colunas já existiam
  antes desta fase), só ficou mais visível na captura de perto. Registrado para avaliação em P6, não
  corrigido aqui.

## Necessidade de arquivo compartilhado identificada, não executada

Nenhuma obrigatória. Um item observacional: se uma fase futura (P6) quiser dar aos 8 capítulos restantes
(Contexto, As escolas, Professores, Dinheiro e obras, Enem, Ensino superior, Qualidade, Pós-graduação) o
mesmo tipo de "momento de abertura" que os 3 primeiros ganharam aqui, vai precisar ou (a) expandir
`hero.kpis` em `lib/education/load.ts` para cobrir mais capítulos (hoje só 4 dos 11 têm um Kpi dedicado) —
mudança em arquivo do meu próprio escopo, não fiz por não ser pedido explícito desta fase — ou (b) aceitar
que nem todo capítulo tem dado rico o bastante para um card de Nível 1 (alguns são majoritariamente
tabela/explorador por natureza, ex. Dinheiro e obras, Ensino superior) e que isso é uma diferenciação
honesta, não uma lacuna.

## Status do Gate

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: a página mais longa do produto ganha navegação por capítulo pela primeira
vez, a abertura editorial deixa de ser texto genérico fixo duplicado e passa a citar fatos reais e
comparáveis uma única vez, 3 dos 11 capítulos ganham um momento de "grande número" real (Nível 1→2→3) que
os diferencia visualmente dos outros 8, 100% do dado/fonte/filtro/exportação preservado, typecheck limpo,
40 e2e reais passando, investigação honesta (não reprodução, não correção forçada) do bug de key duplicada
pré-existente.

Ressalvas que impedem um `PASS` puro:
1. Só 3 dos 11 capítulos ganharam `IndicatorLive` — os outros 8 continuam com a composição
   `StatGrid`/`BarList`/`DataTable` que já tinham (alguns, como Dinheiro e obras, já eram naturalmente mais
   densos em tabela por causa da natureza do próprio dado — isso é diferenciação real, não um problema a
   mais, mas não é o mesmo nível de reformulação visual que os 3 primeiros capítulos receberam).
2. O bug de key duplicada que P0 documentou não foi reproduzido nem em produção nem em dev — fica como
   "não observado nesta data", não como "corrigido".
3. Os 2 bugs de overflow pré-existentes de 320px continuam sem correção — decisão deliberada, mesmo
   precedente de P1/P2/P3.
4. Achado novo (não corrigido, fora do escopo de arquivo): selo "Censo 2025" colado ao rótulo "MATRÍCULAS"
   no card do panorama em telas largas — comportamento do `KpiCard` compartilhado.
5. Cobertura de verificação ficou em 1 estado (ES) + 1 município (Vitória) — representativo, não
   exaustivo.

Nenhum impedimento para a próxima sub-fase (Segurança Pública).
