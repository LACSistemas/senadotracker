# Relatório Final — Cívica: Atlas Editorial Investigativo

Consolida as 8 fases do mandato (P0–P7, 14 documentos de fase em `docs/atlas-editorial-redesign/`), todas
`PASS_WITH_CAVEATS`, executadas sequencialmente sobre a branch `post-migration`. Nada foi commitado — todo
o trabalho vive na working tree, ao lado de outras frentes abertas do projeto (P14 executivo/fotos, entre
outras) que não fazem parte deste mandato.

## 1. Resumo executivo

O programa transformou `/estados/[uf]` e `/municipios/[ibge]` de um portal de indicadores com cards
repetidos em algo mais próximo de um atlas editorial — sem jamais sacrificar os dados reais, filtros,
exportações e fontes que já existiam. As entregas mais substantivas, em ordem de impacto:

- **Atlas Vivo** (`/estados/[uf]/atlas`, P3): capacidade cartográfica que não existia — zoom/pan,
  6 indicadores reais alternáveis, busca, tabela acessível alternativa, compartilhamento de estado por
  URL (P6.2). O mapa, aqui, é protagonista de verdade, não decoração.
- **Os 5 temas unificados** sob a mesma infraestrutura nova (navegação por capítulo em sidebar, heros com
  narrativa editorial real em vez de texto genérico, `IndicatorLive` onde há dado para sustentar) e, em
  cima disso, uma assinatura visual própria por tema (cor + numeral editorial + 2 destaques pontuais —
  P5 + P6.2).
- **Comparador territorial com contrato de elegibilidade real** (P4): território×UF×Brasil×pares, com
  bloqueio/ressalva explícita quando a comparação não é estatisticamente válida — testado, não só
  declarado.
- **Descobertas dinâmicas** na visão municipal (P2): manchete + complementares escolhidas por regra
  determinística, nunca pelo maior número, nunca inventadas.
- **8 bugs reais de acessibilidade encontrados e corrigidos em P7**, nunca antes detectados porque o
  axe-core nunca tinha rodado individualmente contra as páginas de tema.

Avaliação honesta contra os 6 Gates globais do mandato (Parte XIII) no §12. O maior gap remanescente é
visual: o programa entrega identidade reconhecível e uma base sólida, mas não a reformulação de
composição/hierarquia mais ousada que o mandato descreve como "padrão internacional de excelência" — isso
está documentado como decisão consciente de escopo em P6.2, não como lacuna escondida.

## 2. Arquitetura final

**Camada de tokens e sistema** (`apps/web/app/globals.css`): tokens `--brand-green-deep/editorial`,
`--brand-amber`/`-ink`, `--brand-blue` (P1, validados por contraste WCAG real); rampas de mapa por domínio
`--map-{teal,blue,amber,rose,violet,cyan}-*` (P3); utilitários `.grid-12`/`.col-reading`/`.col-explore`
(P1, com `min-width:0` adicionado em P2).

**Navegação e composição**: `ChapterNav` (`components/security/chapter-nav.tsx`) ganhou `layout="sidebar"`
(P1) e `accent` por domínio (P6.2) — sidebar persistente ≥1024px, faixa horizontal preservada abaixo
disso, numeral de capítulo editorial (`aria-hidden`) como dispositivo visual novo.

**Indicador Vivo** (`components/indicators/indicator-live.tsx`, P1): envelope Descobrir→Explorar→Verificar
sobre `KpiCard`/`TrendChart` já existentes. Adaptadores (`lib/comparison/kpi-adapters.ts`, P4):
`heroKpiToKpi`, `portraitFactToKpi`, `mapMetricToKpi` — traduzem os contratos mais pobres de Bem-estar/
Infraestrutura/Atlas Vivo sem fingir uma riqueza de dado que não existe.

**Comparador** (`components/comparison/territory-comparator.tsx` + `lib/comparison/{eligibility,
peer-distribution,types}.ts`, P4): `TerritoryCompareRow` consolidado (eliminou uma duplicata byte-idêntica
entre Bem-estar e Infraestrutura — ambos os antigos arquivos agora são re-exports de 3 linhas);
`assessComparability()` aplica o contrato de elegibilidade de 7 dimensões da Parte VII.13.1 do mandato;
`buildPeerRuler()` resolve território×distribuição de pares.

**Descobertas dinâmicas** (`lib/territory-discoveries.ts` + `components/territory/discovery-panel.tsx`,
P2): seleção determinística de manchete + complementares na visão municipal.

**Atlas Vivo** (`apps/web/app/estados/[uf]/atlas/page.tsx` + `components/territory/{atlas-vivo,
map-table}.tsx`, P3, refinado em P6.2): zoom/pan via CSS transform (sem lib nova), estado compartilhável
por URL, painel de pré-visualização com `IndicatorLive` embutido (P4).

**Executivo/PIB/IDHM/Legislativo** (`lib/territory-{executive,idhm,legislative}.ts`,
`packages/db/src/exec/{executive,idhm,economic}-read.ts`): camada de leitura herdada do trabalho P14
(fora deste mandato, mas consumida por ele — cards de governo/desenvolvimento humano/composição
partidária na visão geral).

**Estados compartilhados** (`components/territory/chapter-states.tsx`, P1): `ChapterPending`/`StateBadge`
promovidos de 4 cópias locais idênticas para um único local.

## 3. Componentes criados (novos)

`apps/web/components/comparison/territory-comparator.tsx` · `components/indicators/indicator-live.tsx` ·
`components/territory/{discovery-panel,atlas-vivo,map-table,chapter-states,executive-summary,idhm-summary,
legislative-summary}.tsx` · `components/{education,infrastructure,wellbeing}/*-summary.tsx` ·
`lib/comparison/{eligibility,kpi-adapters,peer-distribution,types}.ts` ·
`lib/territory-{discoveries,executive,idhm,legislative,map-metrics}.ts` · `lib/competence-label.ts`.

## 4. Componentes e arquivos significativamente alterados

`app/globals.css` · `components/security/{chapter-nav,security-ui,trend-chart,security-page,
crime-explorer,finance-chapter,police-chapter,security-summary}.tsx` · `components/education/
{education-page,education-ui}.tsx` · `components/infrastructure/{infrastructure-page,infrastructure-ui,
work-detail,works-list,territory-compare}.tsx` (este último, e o equivalente em `wellbeing/`, viraram
re-exports de 3 linhas) · `components/wellbeing/{wellbeing-page,wellbeing-ui,territory-compare}.tsx` ·
`components/territory/{health-section,health-panel,evolution-panel,residents-panel,hospitals-panel,
state-frame,territory-ui}.tsx` · `components/heroes.tsx` · `lib/{scale,exec-territory,health-bench}.ts` ·
`lib/security/hero.ts` · `lib/{infrastructure,wellbeing}/types.ts`.

## 5. Rotas modificadas

`/estados/[uf]` · `/estados/[uf]/{saude,educacao,seguranca,bem-estar,infraestrutura}` ·
`/estados/[uf]/representacao` (sem alteração de código, beneficiada incidentalmente pela composição
partidária nova) · `/municipios/[ibge]` · `/municipios/[ibge]/{saude,educacao,seguranca,bem-estar,
infraestrutura}` · **`/estados/[uf]/atlas`** (rota nova, P3) · `/{estados,municipios}/.../infraestrutura/
obras` (composição, sem mudança de filtro/paginação).

## 6. Inventário funcional antes/depois

A matriz completa, por tema×capítulo×componente×fonte×filtro, está em `P0_AUDITORIA_TERRITORIAL.md`
(linha de base) — não repetida aqui. Resumo do que mudou por tema está em `P5_REDESENHO_TEMATICO.md` §
"O que cada tema ganhou de específico". **Garantia verificada, não só declarada**: 100% dos capítulos,
filtros GET, explorers client-side, exportações CSV, tabelas, séries e fontes de cada um dos 5 temas
continuam acessíveis e corretos — confirmado por comparação de screenshot contra a linha de base de P0 em
cada sub-fase de P5, e pela suíte e2e completa (incluindo os 30 testes de `infraestrutura-p137.spec.ts`,
que cobrem especificamente export CSV e paginação de obras) passando sem alteração de asserção de dado em
nenhuma fase.

## 7. Screenshots

Evidência visual real acumulada ao longo do programa (todas em `artifacts/`, gitignored — evidência local
de sessão, não parte do código publicado): `p0-auditoria/` (65, linha de base), `p2-piloto-municipal/`
(10), `p3-atlas-vivo/` (30), `p5-{saude,educacao,seguranca,bem-estar,infraestrutura}/` (~65 somadas),
`p6-1-correcoes/` (6), `p6-2-identidade/` (40). P7 usou scripts de verificação ad hoc (apagados ao final,
por não serem evidência nova — as medições foram incorporadas ao próprio doc). Cobertura real: ES, RJ,
Roraima, Nova Friburgo, Tucuruí e Vitória, nas 5 larguras do mandato (1440/1280/768/390/320).

## 8. Resultados dos testes (estado final, P7)

- **Funcional**: 23 rotas verificadas (200, sem erro de console) · 68/68 e2e (`p14-territorio-executivo`,
  `infraestrutura-p137` completo, `wellbeing-p128`, `seguranca-p98`) · 9/9 testes unitários do comparador.
- **Typecheck**: raiz limpo, exceto 2 arquivos de teste de outra frente (`educacao-p113/p114`), confirmados
  não tocados por nenhuma fase deste redesign.
- **Responsividade**: 49/50 combinações (10 rotas × 5 larguras) sem overflow horizontal.
- **Acessibilidade**: axe-core rodado nas 7 rotas de tema individualmente (nunca antes feito) — resultado
  final, após as correções da própria P7: mesmo baseline histórico desde P1 (`region`/`skip-link`, header
  global, fora do escopo territorial) + 1 exceção documentada (numeral decorativo `aria-hidden`).
  Lighthouse confirma: 98–99/100 de acessibilidade nas 3 páginas auditadas.
- **Desempenho (laboratório, não campo)**: Performance 81–97, CLS 0 nas 3 páginas, LCP 2,6–3,6s (acima do
  alvo de campo só na visão geral do estado, plausível por volume de retratos carregados).

## 9. Limitações identificadas

- O Atlas Vivo é o único lugar onde o mapa é protagonista absoluto — a visão geral de estado/município
  não recebeu a composição assimétrica mais ousada que o mandato descreve (decisão de escopo de P6.2,
  não tentada por risco/tempo).
- A identidade visual por tema (P6.2) é cor de assinatura + numeral editorial + destaques pontuais, não
  uma reformulação profunda de composição por tema — autoavaliação honesta do próprio P6.2 contra o
  critério G1.
- Saúde e Bem-estar mantiveram a composição interna de painéis/capítulos como estava (decisão de
  risco/benefício, P5.1/P5.4) — ganharam navegação e hero novos, não uma reescrita visual interna.
- Cobertura de `IndicatorLive`/descobertas é desigual entre temas por limite real de dado disponível
  (nunca forçada onde não há Kpi real) — Segurança 3/7 capítulos elegíveis; Bem-estar nunca disputa a
  manchete de descoberta municipal (P4 já deixa o caminho pronto, só não foi aplicado — é o item de menor
  risco para uma iteração futura).
- Território×série-histórica e território×Brasil não existem dentro do Atlas Vivo (exigiriam consulta
  nova aos indicadores do mapa — fora do escopo "só contratos já existentes").

## 10. Débitos técnicos relevantes

- `/estados/ES/infraestrutura` em 320px: 7px de overflow residual, sem causa única localizável (3 dos 4
  bugs de overflow originais de P0 foram eliminados por causa raiz em P6.1; este não).
- 1 teste e2e (PIB per capita de São Paulo) é flaky sob paralelismo pesado de workers — não é regressão,
  passa isolado de forma consistente.
- O numeral decorativo de capítulo (P6.2) falha contraste WCAG para texto grande, mas é `aria-hidden` —
  tensão documentada entre decisão de design e validador automatizado, pendente de decisão humana (aceitar
  como exceção ou redesenhar a paleta do dispositivo).
- Município de polígono côncavo no Atlas Vivo pode ter alvo de clique menor que o esperado (centro do
  bounding box cai fora do preenchimento) — característica da malha SVG desenhada à mão, não corrigida.
- Herdado de P14 (fora deste mandato, mas visível nas páginas que ele redesenhou): 16 municípios sem
  prefeito resolvido pelo TSE, ~89 prefeitos de SP sem foto (erro HTTP 416 num ZIP de 2,26GB).

## 11. Instruções de execução

Toda verificação deste programa usou o padrão já estabelecido no projeto — build/servidor isolados, nunca
o dev server do usuário:

```
NEXT_DIST_DIR=.next-check npm run typecheck   # workspace @senadotracker/web, ou raiz para o programa todo
NEXT_DIST_DIR=.next-check npx next build       # dentro de apps/web
NEXT_DIST_DIR=.next-check npx next start -p <porta-livre>
E2E_BASE_URL=http://127.0.0.1:<porta> npx playwright test tests/e2e/p14-territorio-executivo.spec.ts tests/e2e/infraestrutura-p137.spec.ts tests/e2e/wellbeing-p128.spec.ts tests/e2e/seguranca-p98.spec.ts
```

Acessibilidade: axe-core via `scripts/ux/axe-run.mjs` com `AXE_PATH` apontando para a instalação externa
em `D:\Civica\tools\a11y` (mesmo mecanismo do redesign anterior do Legislativo). Desempenho: Lighthouse
local contra o mesmo build isolado — resultado é laboratório, não campo (sem RUM configurado no projeto).

## 12. Status dos gates

| Fase | Gate |
|---|---|
| P0 — Auditoria territorial | `PASS_WITH_CAVEATS` |
| P1 — Design system | `PASS_WITH_CAVEATS` |
| P2 — Piloto municipal | `PASS_WITH_CAVEATS` |
| P3 — Atlas Vivo | `PASS_WITH_CAVEATS` |
| P4 — Investigação e comparadores | `PASS_WITH_CAVEATS` |
| P5.1 Saúde / P5.2 Educação / P5.3 Segurança / P5.4 Bem-estar / P5.5 Infraestrutura | `PASS_WITH_CAVEATS` (todas) |
| P5 — Redesenho temático (consolidado) | `PASS_WITH_CAVEATS` |
| P6.1 — Correções e consistência | `PASS_WITH_CAVEATS` |
| P6.2 — Identidade visual temática | `PASS_WITH_CAVEATS` |
| P7 — QA, acessibilidade e regressão | `PASS_WITH_CAVEATS` |

**Gates globais (Parte XIII do mandato):**

| Gate | Avaliação |
|---|---|
| G1 — Excelência visual | Parcial — identidade reconhecível e mapa protagonista real no Atlas Vivo; a reformulação de composição mais ousada que o mandato descreve não foi totalmente alcançada (ver §9) |
| G2 — Preservação funcional | Atingido — 100% verificado por e2e e comparação de screenshot em todas as fases |
| G3 — Integridade estatística | Atingido — contrato de elegibilidade testado, nenhum dado inventado, ausência honesta em todos os casos amostrados |
| G4 — Acessibilidade e responsividade | Atingido com ressalva — 8 bugs reais corrigidos em P7, 1 overflow residual de 7px, 1 exceção de contraste documentada |
| G5 — Desempenho e estabilidade | Atingido com ressalva — só laboratório (sem RUM no projeto), CLS=0, LCP acima do alvo de campo na visão geral do estado |
| G6 — Segurança arquitetural | Atingido — confirmado em todas as 15 fases, ver §13 |

## 13. Confirmação do escopo de banco e coletores

**Nenhuma migration, alteração de schema, backfill ou toque em collector/script de coleta foi executado em
nenhuma das 15 fases/sub-fases deste programa.** Toda leitura usou os contratos `*PageData`/`*-read.ts` já
existentes (incluindo os do trabalho P14, fora deste mandato mas consumidos por ele como estavam). A porta
3000 (dev server do usuário) foi confirmada intacta antes/durante/depois de cada uma das fases — toda
verificação rodou contra build e servidor isolados em portas próprias (3151–3163, nunca reaproveitadas
entre fases concorrentes). Nenhum processo do usuário foi interrompido. Nenhum dado foi inventado,
sintetizado ou usado como mock em tela de produção.

**Nada foi commitado.** Todo o trabalho está na working tree da branch `post-migration`, pronto para
revisão.
