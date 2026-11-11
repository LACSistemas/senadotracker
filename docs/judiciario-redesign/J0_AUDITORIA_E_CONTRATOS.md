# J0 — Auditoria e contratos (redesign estrutural do Judiciário)

Auditoria read-only das quatro rotas-alvo antes de qualquer mudança de código. Nenhum arquivo foi editado nesta fase. Capturas de baseline reais em `artifacts/j0-judiciario-redesign/` (8 arquivos: 4 rotas × desktop 1440 × mobile 390, gitignored).

## 1. Inventário de rotas reais

| Rota do mandato | Arquivo real | Status |
|---|---|---|
| `/judiciario` | `apps/web/app/judiciario/page.tsx` | existe, com conteúdo real |
| `/judiciario/temas` | `apps/web/app/judiciario/temas/page.tsx` + `temas/[tema]/page.tsx` | existe, com conteúdo real |
| `/judiciario/tribunais` | `apps/web/app/judiciario/tribunais/page.tsx` | existe, com conteúdo real |
| `/judiciario/tribunais/[id]` | `apps/web/app/judiciario/tribunais/[id]/page.tsx` | existe, com conteúdo real — já reconstruído em fases maiores do que o mock assume (ver §5) |

Identificador canônico confirmado: `JUD:TRIBUNAL:TJES` (e análogos `JUD:TRIBUNAL:STF`, `JUD:TRIBUNAL:TRF2` etc.), usado em `encodeURIComponent(tribunal_id)` nos links do diretório e decodificado com `decodeURIComponent(id)` no perfil. **Não precisa mudar** — nenhuma rota do mock exige um esquema de id diferente.

Rotas adicionais que já existem e não fazem parte do mandato, mas que o perfil de tribunal referencia e **não podem ser quebradas**: `/judiciario/comparar`, `/judiciario/stj/precedentes[/[id]]`, `/judiciario/stf/temas[/[tema]]`, `/judiciario/stf/remuneracao[/[matricula]]`, `/judiciario/stf/jurisprudencia[/[base]/[docId]]`.

## 2. Inventário funcional por página (estado atual)

### `/judiciario`
Hero `InstitutionHero` (sem `imageUrl`), 5 KPIs (casos novos, baixados, pendentes, magistrados, despesa com magistrados), nota de congestionamento (sem número nacional — ver §4), `MultiLineChart` "A fila da Justiça" (casos novos/baixados/pendentes, 2016–2025, já existe e já é real), seção de congestionamento (só texto + link pro comparador), grade dos 6 temas reais, 4 atalhos (tribunais, comparador, STJ, STF temas).

### `/judiciario/temas`
Hero simples (sem foto), grade dos 6 temas reais (cada um: título, descrição, contagem de indicadores, fonte), seção "Temas em investigação" para os documentais sem indicador elegível. Não há donut nem "Sobre os dados" — ver §4 sobre por que o donut do mock não pode ser replicado como está.

### `/judiciario/tribunais`
Busca por sigla/nome, filtro por ramo (`BRANCHES`: STF, Superior, TJ, TRF, TRT, TRE, TJM, CNJ), `DataTable` com paginação (20/página) e 4 colunas (Tribunal, Ramo, UF sede, Cobertura — badges de "Estatísticas JN"/"Finanças"/"Unidades", não valores numéricos). Sem filtro de UF, sem ordenação, sem colunas de indicador (casos novos/congestionamento), sem comparador embutido — tudo isso o mock pede a mais (ver §6).

### `/judiciario/tribunais/[id]`
Já é o mais maduro das quatro: `InstitutionHero`, `ChapterNav` em `layout="sidebar"` (navegação lateral desktop + seletor compacto mobile), 7+ capítulos adaptativos (visão geral, atividade, tempo, estrutura, finanças, temas, jurisprudência/ministros quando STF ou STJ, metodologia), gráficos reais por indicador, `MethodologyPanel`. **Esta fase (P14.12, ver `docs/judiciario/p14-12-stf-ministros-frontend/`) acabou de adicionar fotos oficiais e cards de Ministros do STF com remuneração real — isso precisa ser preservado e integrado à nova composição, não removido.** O mock usa o TJES como referência (sem capítulo de Ministros, que é exclusivo do STF) — a composição adaptativa já existente (`activeChapters.filter(...)`) é exatamente o padrão certo para isso.

## 3. Indicadores auditados (contratos reais)

- `JN_CASES_NEW_G1`/`JN_CASES_NEW_G2` (SUM, somáveis) → casos novos.
- `JN_DISPOSED` (SUM) → processos baixados.
- `JN_CASES_PENDING` (SUM) → processos pendentes (acervo, não fluxo anual).
- `JN_CONGESTION_RATE`, `JN_CLEARANCE_INDEX` (`NONE_RATE_OFFICIAL`) → **não agregáveis nacionalmente**; o serving já devolve `value: null` com `metric_availability: METHOD_INCOMPATIBLE` nesse recorte — confirmado em código (`postgres-judiciary-serving.ts`) e já respeitado no texto atual de `/judiciario` ("não existe uma única taxa nacional válida").
- `JN_ACTIVE_MAGISTRATES`, `JN_EFFECTIVE_STAFF`, `JN_EXPENSE_*` → estrutura/finanças, grão por tribunal, agregáveis em SUM.

Checagem dos números do TJES citados no mandato (§4.4): confirmados reais e correntes na página hoje — 281.213 casos novos, 443.736 baixados, 1.088.195 pendentes, índice de atendimento à demanda 0,96. **Não há, em nenhum contrato, uma fórmula que derive o índice de 0,96 como `baixados/novos`** (443.736/281.213 = 1,58, não 0,96) — o índice vem de `JN_CLEARANCE_INDEX`, calculado pelo próprio CNJ sobre casos novos E pendentes do período anterior, não uma divisão simples entre os dois números exibidos ao lado. **Confirma a ressalva do mandato: não interpretar esse índice como derivação visual dos outros KPIs.**

## 4. Dois achados que bloqueiam réplica literal do mock (achados reais, não suposição)

### 4.1 — Donut "Visão geral dos temas" (`/judiciario/temas`) não é construível com dado real

Consultei ao vivo o indicador principal de cada um dos 6 temas reais:

| Tema | Indicador principal real | Métrica |
|---|---|---|
| Execução fiscal | processos baixados | 6.256.073 |
| Execução geral | casos novos | 8.130.976 |
| Execução penal | processos baixados | 12.016.996 |
| Violência doméstica | processos baixados | 994.852 |
| Justiça criminal | processos baixados | 4.890.277 |
| Conciliação | índice geral (`NONE_RATE_OFFICIAL`) | não é contagem — é uma taxa |

O mock assume que todo tema tem "casos novos" como métrica comum, somável num total de 27,7 mi com um resíduo "Outros assuntos". Isso não é verdade: 5 dos 6 temas têm indicador principal diferente entre si (a maioria é "processos baixados", um é "casos novos"), um não é nem contagem, e as categorias **não são mutuamente exclusivas** (execução fiscal é uma subcategoria de execução geral; não há partição limpa de um universo único). Construir o donut como no mock seria somar números de métricas diferentes como se fossem partes de um mesmo todo — exatamente o que a §8.3 do mandato proíbe explicitamente.

**Decisão para J4:** substituir o donut por um formato honesto — pequenos múltiplos (um indicador principal por tema, cada um rotulado com sua própria métrica) ou barras agrupadas por tema sem implicar participação percentual de um total comum. A seção "Sobre os dados" do mock (explicando fonte/metodologia) é mantida, adaptada para explicar por que os temas não são comparáveis num único total.

### 4.2 — KPI nacional "Taxa de congestionamento: 62,6%" (`/judiciario`) não existe como número válido

Já documentado no código atual: `JN_CONGESTION_RATE` é `NONE_RATE_OFFICIAL`, e o serving devolve `null` para esse recorte nacional de propósito — somar/mediar congestionamento entre tribunais com acervos muito diferentes produz um número sem significado (é literalmente o texto que já está na página hoje). O 5º card do mock ("Taxa de congestionamento 62,6%") não pode ser implementado como um 5º KPI numérico ao lado dos outros quatro.

**Decisão para J1:** manter os 4 KPIs reais (casos novos, baixados, pendentes, magistrados — já existentes e reais) com a hierarquia visual do mock; o espaço do congestionamento vira uma nota editorial + CTA para o comparador (já existe hoje, só precisa do tratamento visual do mock), nunca um 5º número isolado.

## 5. Preservação obrigatória: P14.9–P14.12 (STF)

O perfil do STF (`/judiciario/tribunais/JUD:TRIBUNAL:STF`) tem, além dos 7 capítulos universais do mock, capítulos exclusivos construídos em fases anteriores que **devem sobreviver ao redesign**, adaptados à nova composição visual, nunca removidos:

- Capítulo **Jurisprudência** (Repercussão Geral + acórdãos/decisões monocráticas, P14.9/P14.11).
- Capítulo **Ministros** (P14.12, recém-construído nesta sessão): grade de cards com foto oficial (via `/api/portrait`, fonte `portal.stf.jus.br`), situação (ativo/aposentado) e remuneração bruta mensal real — 8 Ministros em atividade, 12 aposentados colapsados.

A arquitetura de capítulos adaptativos (`activeChapters.filter(x => x !== null)`) já é exatamente o mecanismo certo para isso — J2 deve preservar esse padrão, só trocando `layout="sidebar"` pela composição horizontal do mock (ver §7) e redesenhando o conteúdo de cada capítulo, não removendo nenhum.

## 6. Gap real de dado para o diretório (`/judiciario/tribunais`, J3)

O mock mostra colunas "Casos novos (2025)" e "Taxa de congestionamento" por linha da tabela — dado real por tribunal (não nacional agregado, então válido). `getJudiciaryTribunalDirectory` hoje devolve só metadados + booleans de cobertura (`has_jn`/`has_finance`/`has_units`), sem os valores. **Precisa de uma extensão de leitura** (join com `jud_jn_observation` para os indicadores `JN_CASES_NEW_G1+G2` e `JN_CONGESTION_RATE` do ano corrente, por tribunal) — é adaptador de leitura sobre tabela existente, permitido pelo mandato (§1.1 só veda migration/schema/tabela nova). Mostrar "—" para tribunais sem a estatística (STF, CNJ), nunca zero.

## 7. Componentes reaproveitáveis confirmados (não reconstruir do zero)

- `InstitutionHero` (`components/heroes.tsx`) **já suporta** `imageUrl` com overlay em gradiente verde — é exatamente o tratamento visual do hero do mock. Hoje nenhuma página do Judiciário passa essa prop.
- `ChapterNav` (`components/security/chapter-nav.tsx`) **já suporta** `layout="inline"` (barra horizontal fixa no topo, usada hoje pelas páginas de tema) além do `layout="sidebar"` atual do perfil de tribunal — o mock do perfil usa uma barra horizontal sob o header institucional, o que já é `layout="inline"`; só precisa trocar o prop e ajustar o estilo visual (o mock não usa pílulas, usa texto com sublinhado no item ativo).
- `RankedBars`, `MultiLineChart`, `KpiCard`/`KpiGrid`, `DataTable`, `FilterBar`/`SearchBar`, `MethodologyPanel`, `JudiciaryAvailabilityNote`/`toChartCoverage`, `MinisterCard` (novo, P14.12) — todos reaproveitáveis sem reescrita.

## 8. Imagens do hero: por que não usar fotografia (decisão, não só achado)

O mock usa fotografias (estátua "A Justiça" do STF, balança, fachada de prédio). Toda outra página do produto que usa `InstitutionHero` com `imageUrl` (Legislativo: panorama, rankings, patrimônio, Câmara/Senado estaduais) usa a **mesma ilustração SVG geométrica original** (`/congresso.svg` — silhueta do Congresso Nacional, 1600×900, paleta plana nas cores da marca), nunca uma fotografia de arquivo. Isso evita por completo o risco que o próprio mandato sinaliza em §2.3 (direitos de imagem, atribuição incorreta de prédio específico a instituição errada) e mantém consistência de identidade com o resto do produto.

**Decisão para J1/J3/J4**: construir 2–3 ilustrações SVG originais no mesmo estilo de `/congresso.svg` (ex.: silhueta geométrica do prédio do STF + estátua "A Justiça" para o portal nacional, balança estilizada para temas, fachada genérica de tribunal para o diretório) em vez de baixar fotografia de terceiros. Isso cumpre a letra do mandato (§2.3: "utilize composição gráfica ou cartográfica original") sem introduzir risco de licenciamento.

## 9. Estado dos testes/typecheck antes de qualquer mudança

`npm run typecheck` limpo em `@senadotracker/db` e `@senadotracker/web` ao fim do P14.12 (fase imediatamente anterior). Suíte e2e do Judiciário (`p148`, `p150`, `p151`, `p152`) com 52/52 passando. Esse é o baseline de regressão que J1–J6 não pode quebrar.

## Gate J0

Inventário funcional e de contratos concluído. Dois achados de integridade estatística registrados e decididos (não implementar donut/KPI nacional como no mock, com alternativa honesta definida). Decisão de assets de imagem tomada (SVG original, não fotografia). Baseline capturado. **Pronto para iniciar J1.**
