# P7 — QA, acessibilidade e regressão (auditoria final consolidada)

Fase de verificação, não de implementação nova. Confirma com evidência real que o programa inteiro
(P1–P6) não regrediu nada, aplica correções pontuais reais encontradas durante a própria verificação
(não redesenho), e consolida a lista completa de débitos conhecidos do programa — lida nos 13 docs
anteriores (`P0_AUDITORIA_TERRITORIAL.md` a `P6_2_IDENTIDADE_VISUAL.md`), todos Gate `PASS_WITH_CAVEATS`.
`NEXT_DIST_DIR` isolado em toda verificação; porta 3000 do usuário nunca tocada (confirmado antes/durante/
depois de cada ciclo); nenhuma migration/schema/collector tocado.

## 1. Integridade funcional

**Rotas** — 23 combinações testadas por `curl` (200 em todas): `/estados`, `/municipios`, `/estados/{ES,RJ,RR}`,
`/municipios/{3205309,3303401,1508100}`, `/estados/{ES,RJ}/atlas` (+ com querystring de indicador/view),
`/{estados,municipios}/.../infraestrutura/obras`, `/estados/ES/representacao`. Links profundos, navegação
entre temas, sidebar, filtros, tabelas, comparador, Atlas Vivo (zoom/pan/seleção/compartilhamento por URL)
e export CSV — cobertos pelos **68 testes e2e** já existentes (`p14-territorio-executivo`,
`infraestrutura-p137` com os 30 testes completos, `wellbeing-p128`, `seguranca-p98`), rodados do zero
nesta fase contra um build isolado novo: **68/68 passando** (1 flake de São Paulo sob paralelismo pesado,
já documentado desde P6.1 — reproduzido isolado, passa em 2,8s; não é regressão). Mais **9/9 testes
unitários** do comparador (`comparison-eligibility`, `comparison-peer-distribution`).

## 2. Integridade de dados

Amostrada no próprio HTML servido (não só no código), via os testes e2e existentes e a leitura direta dos
resultados do axe-core (que captura o texto real renderizado): governador/PIB/IDHM/legislativo com dado
real (ES: Renato Casagrande/PSB; IDHM 3 pontos reais); comparação de pares real em Segurança ("Entre 22
municípios do Rio de Janeiro de 100 a 500 mil habitantes..."); distinção fluxo×estoque preservada em
Bem-estar; dado estadual nunca aparece como municipal (teste dedicado: Salvador não mostra "Roubos" no
herói, fonte só-estadual identificada); ausência honesta confirmada em território pequeno/pós-Censo
(Boa Esperança do Norte, Alto Rio Novo, Atílio Vivácqua — nenhum erro, nenhum zero fictício); PIB per
capita de município ≠ UF confirmado no navegador (SP e Brasília). Nenhum valor, filtro ou exportação
divergente do que as fases anteriores já haviam verificado.

## 3. Responsividade

**50 combinações** (10 rotas × 5 larguras do mandato — visão geral de estado/município, os 5 temas,
Atlas Vivo mapa e tabela, obras) varridas com script Playwright ad hoc (apagado ao final): **49/50 com
0px de overflow e 0 erro de console**. A única exceção é `/estados/ES/infraestrutura` em 320px (7px) —
**o mesmo resíduo exato, já diagnosticado exaustivamente em P6.1** sem causa única localizável (acúmulo
de arredondamento sub-pixel numa página com alta densidade de grades), não piorado nem introduzido por
esta fase.

## 4. Acessibilidade — a categoria onde esta fase encontrou e corrigiu mais coisa real

axe-core (mesmo mecanismo desde P1) rodado pela primeira vez, individualmente, contra **7 rotas**
nunca testadas sozinhas antes (`/estados/ES/educacao`, `/municipios/3205309`, `/estados/RJ/atlas?view=tabela`,
`/estados/ES/infraestrutura`, `/estados/ES/bem-estar`, `/estados/ES/seguranca`, `/estados/ES/saude`) —
P1/P3/P4/P6 sempre testaram só `/estados/ES` "nua". Isso revelou **6 bugs reais, nunca antes detectados**,
todos encontrados, corrigidos e reverificados no mesmo ciclo (típecheck limpo, build isolado, 68/68 e2e,
axe de novo):

1. **Numeral do `ChapterNav` com contraste duplo** (`opacity-70` sobre um texto já `muted-foreground`,
   em `chapter-nav.tsx`, afetando as 5 páginas de tema) — 2,88:1 medido, precisa 4,5:1. Corrigido removendo
   o `opacity-70` redundante (a cor base já passa, 5,21–5,58:1).
2. **`role="region"` num `<figure>`** (`education-ui.tsx`/`wellbeing-ui.tsx`, `DataTable`) — ARIA não
   permite esse papel nesse elemento. Corrigido: mantido só `tabIndex`+`aria-label` (suficiente para o
   requisito real, que é foco por teclado, não o papel).
3. **7 tabelas com rolagem horizontal sem foco por teclado** (`scrollable-region-focusable`): `DataTable`
   de Educação/Bem-estar, `works-list`/`work-detail` (×2) de Infraestrutura, `police-chapter`/
   `finance-chapter` de Segurança, calendário de internações de Saúde. Corrigido com o padrão já
   estabelecido no resto do produto (`tabIndex={0} role="region" aria-label="..."`, de `charts.tsx`/
   `sticky-table.tsx`).
4. **`<dl>` com filhos inválidos** (`definition-list`): `StatGrid`, duplicado 3× (Educação/Infraestrutura/
   Bem-estar), tinha um `<p>` de nota solto dentro do agrupamento `dt`/`dd`. Corrigido convertendo a nota
   para um segundo `<dd>` — semanticamente válido (um termo pode ter várias descrições) e visualmente
   idêntico.
5. **Link ativo da sidebar com contraste insuficiente para 3 das 6 famílias de cor** (`color-contrast`):
   `blue`/`amber`/`cyan` no degrau -4 da rampa (usado como texto real, não decoração) medem 3,90–4,26:1
   como texto e 4,40–4,43:1 como texto branco sobre preenchimento — abaixo de 4,5:1. Calculado com WCAG
   real (não estimado) que o degrau -5 de cada família passa com folga (6,8–7,8:1) nos dois usos, sem
   mudar `rose`/`violet` (já passavam no -4) nem `teal`/`--primary` (sempre passou). Corrigido só em
   `chapter-nav.tsx` (onde a cor pinta texto) — `security-ui.tsx`/`ChapterShell` manteve o -4 porque ali a
   cor só pinta borda e o numeral decorativo (`aria-hidden`, ver item 7), sem requisito de contraste de
   texto.
6. **Badge de pré-visualização do `CrimeExplorer`** com o mesmo padrão do item 1 (`opacity-70` sobre
   `muted-foreground`), 3,09:1 medido. Corrigido da mesma forma.
7. **Bônus real, fora da lista de achados do axe mas no mesmo ciclo**: o selo "Linha do dinheiro" de
   Infraestrutura usava `muted-foreground` sobre um fundo `--map-cyan-1` que media 4,47:1 — 0,03 abaixo do
   limite, por arredondamento. Corrigido clareando o fundo em ~3 pontos de luminosidade (calculado:
   4,76:1), imperceptível visualmente.
8. **Cabeçalho de tabela vazio** (`empty-table-header`, Saúde): a célula-canto do calendário de internações
   não tinha texto nenhum para leitor de tela. Corrigido com `<span className="sr-only">Ano</span>`.

**Achado real, documentado, deliberadamente NÃO corrigido** — tensão genuína entre WCAG automatizado e
uma decisão de design já tomada: o numeral gigante de capítulo que P6.2 introduziu (`ChapterShell`,
`opacity-25`, `aria-hidden="true"`) mede 1,36–1,49:1 contra os 3:1 exigidos para texto decorativo grande.
Calculei precisamente (WCAG real) o que seria necessário para passar: subir a opacidade para 65–80%,
dependendo da família de cor — o que destruiria por completo o efeito "pálido, recessivo, ao fundo" que é
a própria razão de ser do dispositivo editorial. Como o elemento é `aria-hidden` (nunca chega a leitor de
tela — o título do capítulo acessível de verdade é o `<Eyebrow>Capítulo N</Eyebrow>` ao lado, com contraste
pleno), optei por **não** reescrever uma decisão de design deliberada de uma fase anterior só para satisfazer
um validador automatizado, sem o mesmo processo de revisão visual que todas as decisões de design deste
programa passaram. Fica registrado como item real para uma decisão humana futura (aceitar como exceção
documentada de "decoração pura", ou redesenhar o dispositivo com uma paleta que passe 3:1 mantendo a
leveza pretendida).

**Resultado final, 7 rotas revalidadas depois de todas as correções**: todas caem para exatamente o mesmo
baseline que já existe desde P1 — `region`/`skip-link` (2 violações moderadas, pré-existentes no header
global, fora do escopo territorial) **+ só o numeral decorativo documentado acima**, onde aplicável.
Lighthouse (laboratório, ver §5) confirma de forma independente: **98–99/100 de acessibilidade** nas 3
páginas auditadas.

## 5. Desempenho (laboratório, nunca campo — conforme o próprio mandato exige)

Lighthouse local (`D:\Civica\tools\a11y`, mesma instalação externa do axe) contra o build de produção
isolado, 3 páginas representativas:

| Página | Performance | Acessibilidade | Boas práticas | LCP | TBT | CLS |
|---|---|---|---|---|---|---|
| `/estados/ES` (visão geral) | 81 | 99 | 100 | 3,6s | 240ms | 0 |
| `/estados/ES/educacao` (mais longa do produto) | 95 | 99 | 100 | 2,8s | 60ms | 0 |
| `/estados/RJ/atlas` (92 municípios, SVG+zoom/pan) | 97 | 98 | 100 | 2,6s | 50ms | 0 |

**Isto é medição de laboratório (1 execução, ambiente local), não o p75 de campo que os objetivos do
mandato (LCP≤2,5s/INP≤200ms/CLS≤0,1) literalmente exigem** — não há Real User Monitoring configurado no
projeto, e configurá-lo está fora do escopo desta fase. CLS = 0 nas 3 páginas (excelente, sem layout
shift mensurável). LCP fica acima do alvo de campo só na visão geral do estado (3,6s) — plausível, é a
página com mais imagens de retrato (executivo, fotos de outras seções) carregando. Como medição de
laboratório, serve de diagnóstico honesto, não de aprovação de campo.

## Lista consolidada de débitos conhecidos do programa inteiro (P0–P7)

Compilada dos 14 documentos — nada inventado, nada esquecido:

**Visual/composição (decisões conscientes, não bugs):**
- A visão geral do estado ainda não tem o mapa como protagonista absoluto (isso só existe no Atlas Vivo
  dedicado) — o resto da composição (teasers, painéis) nunca recebeu o tratamento assimétrico que P6.2
  deliberadamente adiou ("Objetivo 2").
- A "identidade visual por tema" de P6.2 é cor de assinatura + numeral editorial + 2 destaques pontuais —
  não uma reformulação de composição/hierarquia mais profunda por tema (autoavaliação honesta do próprio
  P6.2 contra o critério G1 do mandato: "parcialmente atingido").
- Saúde e Bem-estar mantiveram a composição interna dos painéis/capítulos como estava (decisão de
  risco/benefício repetida em P5.1 e P5.4).
- O numeral decorativo de capítulo (P6.2) não passa no contraste WCAG para texto grande — documentado
  em detalhe no §4 acima, decisão pendente de revisão de design, não de correção mecânica.

**Cobertura desigual (limite real de dado, não lacuna de execução):**
- `IndicatorLive`/descobertas dinâmicas cobrem só os temas com `Kpi`/`HeroKpi` real disponível — Segurança
  tem 3/7 capítulos elegíveis; Bem-estar nunca compete por "manchete" nas descobertas municipais de P2
  (`selectDiscoveries` nunca foi atualizado desde que P4 construiu o dado real que permitiria isso — é o
  item mais concreto e de menor risco para uma iteração futura, segundo o próprio P4).
- Território×série-histórica e território×Brasil não existem dentro do Atlas Vivo (exigiriam consulta
  nova aos 6 indicadores do mapa, fora do escopo "só os contratos já existentes").

**Dados de outras frentes, fora do escopo deste redesign (herdados de P14):**
- 16 municípios sem prefeito resolvido pelo TSE (DF, Fernando de Noronha, 14 com eleição anulada sem
  suplementar) — ausência honesta, não bug.
- ~89 prefeitos de municípios de SP sem foto (erro HTTP 416 num ZIP de 2,26GB, não raiz-causado).

**Bugs técnicos residuais (únicos itens realmente "abertos" desta auditoria):**
- `/estados/ES/infraestrutura` em 320px: 7px de overflow horizontal, sem causa única localizável (ver §3)
  — o único dos 4 bugs de overflow originais de P0 que não foi eliminado (3/4 foram, em P6.1).
- 1 teste e2e (`São Paulo PIB per capita`) é flaky sob paralelismo pesado de workers — não é regressão,
  reproduzido como passando isolado em todas as 3 rodadas desta fase.
- 2 arquivos de teste de outro workstream (`tests/unit/educacao-p113.test.ts`, `educacao-p114.test.ts`)
  têm erro de tipo pré-existente no typecheck raiz — confirmado não tocado por nenhuma fase P0-P7, de uma
  frente de Educação anterior a este redesign.
- Município de polígono côncavo no Atlas Vivo pode ter alvo de clique menor que o esperado (centro do
  bounding box cai fora do preenchimento) — característica pré-existente da malha SVG desenhada à mão,
  achado de usabilidade real de P6.2, não corrigido.

## Status do Gate P7

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real em todas as 5 categorias exigidas: integridade funcional (23 rotas + 68 e2e +
9 testes unitários, 100% passando, 1 flake documentado e não-regressão), integridade de dados (amostrada
no HTML real servido, nenhuma divergência), responsividade (49/50 combinações sem overflow, 1 resíduo
pré-existente e já diagnosticado), acessibilidade (8 bugs reais encontrados e corrigidos nesta própria
fase, resultado final = mesmo baseline histórico + 1 item documentado e deliberadamente não corrigido),
desempenho (laboratório honesto, rotulado como tal, nunca apresentado como aprovação de campo).

Ressalvas que impedem um `PASS` puro — nenhuma delas nova, todas herdadas e já documentadas em fases
anteriores, consolidadas na lista acima: o resíduo de overflow de 7px, o teste flaky sob paralelismo, os
2 arquivos de teste alheios, a cobertura desigual de `IndicatorLive`/descobertas entre temas, a composição
assimétrica das visões gerais nunca tentada, e o numeral decorativo que tecnicamente falha contraste WCAG
por decisão de design consciente.

Nenhum impedimento bloqueia o início da Fase P8 (entrega e documentação final). O programa está, pela
primeira vez, numa posição em que cada um dos 14 documentos de fase pode ser citado como evidência —
nenhuma alegação de qualidade feita no relatório final (P8) precisa ser nova, só consolidada a partir do
que já foi real e verificadamente construído e testado em P0–P7.
