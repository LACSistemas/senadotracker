# Relatório final — P8: Reconstrução Editorial Estrutural

Mandato corretivo aberto depois que o usuário avaliou os screenshots reais de P0–P7 e reprovou o Gate G1
(Excelência Visual). Executado em 6 sub-fases (P8.0 diagnóstico → P8.1 direção de arte → P8.2/P8.3 pilotos
municipal/estadual → P8.4 redesign temático dos 5 domínios → P8.5 Atlas Vivo → P8.6 auditoria final), todas
documentadas individualmente em `docs/atlas-editorial-redesign/p8/`. Este relatório consolida o conjunto.

## 1. Arquivos modificados

25 arquivos (commits `e2e3f11` e `6639f64` sobre `post-migration`, mais o checkpoint `83bfd62`):

- **Fundação compartilhada**: `app/globals.css` (`.shell-territory`), `components/territory/state-frame.tsx`
  (`heroNode`).
- **2 visões gerais**: `app/estados/[uf]/page.tsx`, `app/municipios/[ibge]/page.tsx`,
  `components/territory/discovery-panel.tsx`, `components/territory/idhm-summary.tsx`,
  `components/territory/legislative-summary.tsx`, `components/territory/health-panel.tsx`.
- **4 vitrines de domínio**: `components/{education,security,wellbeing,infrastructure}/*-summary.tsx`.
- **5 páginas de capítulo completas**: `components/education/{education-page,education-ui}.tsx`,
  `components/security/structure-chapter.tsx`, `components/wellbeing/{wellbeing-page,wellbeing-ui}.tsx`,
  `components/infrastructure/infrastructure-ui.tsx`.
- **Atlas Vivo**: `app/estados/[uf]/atlas/page.tsx`, `components/territory/atlas-vivo.tsx`.

## 2. Componentes criados

- `components/territory/territory-hero.tsx` (`TerritoryHero`) — hero com mapa real integrado, substitui
  `InstitutionHero` só nas 2 visões gerais (zero risco para os outros 19 consumidores de `InstitutionHero`).
- `components/territory/editorial-kpi.tsx` (`KpiHeadline`, `KpiRow`/`KpiRowList`, `KpiStat`/`KpiStatStrip`)
  — primitivas sem moldura própria para indicador protagonista e lista de apoio, usadas pelas 4 vitrines.
- `StatRows` em `infrastructure-ui.tsx` — lista compacta rótulo:valor, substitui a grade de cartões dentro
  de `GroupBlock`.

## 3. Componentes reconstruídos (composição, não lógica)

`KpiBenchCard` (Saúde) ganhou a variante `size="lg"`. `IdhmSummary` trocou `MultiLineChart` genérico por uma
visualização própria de marcos de década. `DiscoveryPanel` ganhou o modo `headlineInHero`. Em Educação,
Bem-estar e no capítulo "Estrutura" de Segurança, a ordem interna dos capítulos foi invertida (gráfico
antes da grade de apoio) sem tocar os componentes de gráfico em si.

## 4. Comportamentos preservados (verificado, não presumido)

Todos os capítulos, indicadores, filtros, séries, comparadores, exploradores client-side
(`CrimeExplorer`, `ChartExplorer`, `IesExplorer`/`CourseExplorer`/`ProgramExplorer`/`QualityExplorer`,
`IndicatorExplorer`, `ExplorerPanel`), tabelas, exportação CSV, paginação de obras, Atlas Vivo
(zoom/pan/seleção/URL compartilhável), comparadores de território e o contrato de ausência honesta — zero
removido. Confirmado por mais de 180 execuções de teste e2e reais ao longo do programa (ver
`P8_6_AUDITORIA_E_GATES.md`), não por inspeção visual isolada.

## 5. Mudanças estruturais por página — resumo (detalhe completo em cada doc de sub-fase)

| Página | Mudança estrutural |
|---|---|
| Visão geral município/estado | Largura 1200→1360px; hero com mapa real + descoberta protagonista; 4 vitrines com composição distinta entre si; IDHM sem scrollbar; representação com rótulo/colapso corrigidos |
| Saúde (capítulo) | 1 indicador protagonista grande antes das 3 análises reais; indicadores de apoio depois, não antes |
| Educação (6 de 11 capítulos) | Gráfico real antes da grade de apoio (antes: invertido) |
| Segurança (1 de 7 capítulos) | `PlannedBars` antes das grades de declaração (antes: invertido) |
| Bem-estar (3 de 7 capítulos) | Gráfico/lista real antes da grade de apoio (antes: invertido) |
| Infraestrutura (5 de 7 capítulos) | Grades de cartões → listas compactas dentro de `GroupBlock` |
| Atlas Vivo | Busca integrada à aside do mapa; mapa volta a ser o 1º elemento visual real da seção |

## 6. Screenshots antes/depois

P8.0 capturou a linha de base real (80 screenshots, `artifacts/p8-0-diagnostico/`). Cada sub-fase seguinte
capturou o resultado sobre essa base: `artifacts/p8-1-direcao-arte/`, `p8-4-{saude,educacao,seguranca,
bemestar,infra}/`, `p8-5-atlas-vivo/`, `p8-6-auditoria/` — mais de 60 capturas adicionais, cobrindo 7
municípios/estados distintos (Campos dos Goytacazes, Macaé, Alto Rio Novo, Rio de Janeiro, Espírito Santo,
Roraima, São Paulo via e2e) em larguras de 320 a 1440px. Todas revisadas diretamente por mim antes de cada
gate — não só autorrelato de execução.

## 7. Resultados dos testes

Ver `P8_6_AUDITORIA_E_GATES.md` §1. Resumo: 68 testes na rodada final consolidada (67 na primeira
passada, 68/68 com o 1 flaky confirmado por reexecução isolada), mais 108 execuções específicas de P8.4 e
o smoke de interação dedicado do Atlas Vivo em P8.5. Zero regressão real encontrada em todo o programa.

## 8. Performance (laboratório)

Ver `P8_6_AUDITORIA_E_GATES.md` §4. LCP 2,8s / CLS 0 / TBT 180–320ms em 2 rotas medidas (Lighthouse 12.8.2,
Chrome headless local) — CLS e TBT dentro da referência do mandato, LCP levemente acima de 2,5s. Dado de
laboratório, não de campo — não deve ser lido como p75 real de usuários.

## 9. Acessibilidade

Ver `P8_6_AUDITORIA_E_GATES.md` §3. axe-core inacessível durante toda a sessão (`NOT_EVALUATED` em todas
as 6 sub-fases, nunca inflado para PASS). Lighthouse lab: 98/100 em 2 rotas; o único item reprovado
(skip-link não focável) é pré-existente desde P7, em `app/layout.tsx`, nunca tocado por P8.

## 10. Problemas residuais (lista consolidada, nenhum escondido)

1. Diferenciação visual entre os 5 temas ainda é de composição/hierarquia, não de linguagem gráfica própria
   por tema além disso (G1.6 parcial).
2. Navegação mobile de capítulos continua a faixa horizontal já existente desde P1 — confirmada sem
   overflow, mas não reprojetada.
3. skip-link não focável (pré-existente, fora do escopo territorial).
4. LCP 2,8s, levemente acima da referência.
5. Seleção de polígonos pequenos no Atlas Vivo continua difícil (avaliado, não resolvido por
   risco/benefício).
6. axe-core nunca executado nesta sessão.
7. Itens herdados de P0-P7 e ainda não revisitados: resíduo de overflow de 7px em Infraestrutura/320px;
   numeral decorativo de capítulo com contraste insuficiente (intencionalmente `aria-hidden`); composição
   assimétrica "Objetivo 2" de P6.2 nunca tentada.

## 11. Gates

Ver tabela completa em `P8_6_AUDITORIA_E_GATES.md`. G2 (integridade funcional), G3 (integridade
estatística) e G6 (segurança arquitetural): **cumpridos, com evidência**. G4 (acessibilidade) e G5
(desempenho): **cumpridos com ressalvas honestas** (ver acima). G1 (excelência visual): **critérios
técnicos objetivos cumpridos ou parcialmente cumpridos, evidência entregue — aprovação final é do usuário**
(mandato §11.8, nunca autodeclarada).

## 12. Confirmação: zero alteração de banco e de coletores

`git diff --stat` de todos os commits de P8 contra `packages/db`, `scripts/collect`, `scripts/exec`:
**diff vazio**. Todo arquivo tocado está sob `apps/web/` ou `docs/`. Nenhuma migration, nenhum backfill,
nenhuma interrupção de processo em execução, porta 3000 do usuário intacta — verificado em cada uma das 6
sub-fases, não só ao final.

## 13. Por que o resultado da P8 é estruturalmente diferente do P0–P7?

P0–P7 entregou engenharia real (Atlas Vivo, comparadores, Indicador Vivo, acessibilidade, testes) mas,
segundo a própria avaliação do usuário, "o produto continua visualmente muito parecido com a versão
anterior". A diferença desta fase não é de lista de componentes — é de ONDE a mudança aconteceu:

- **P0–P7, P2 (exemplo concreto)**: resolveu a repetição visual reorganizando 5 blocos full-width em 3
  pares `lg:grid-cols-2`. Mudança de **layout externo**, zero mudança na composição interna de cada bloco.
- **P8.1-P8.4**: a largura mudou, mas a mudança que o usuário citou como decisiva foi o **hero deixar de
  ser uma cor sólida e passar a conter geografia real**, a descoberta deixar de ser um parágrafo pequeno e
  passar a ser um número com a mesma hierarquia visual do título da página, e a ORDEM DE LEITURA dentro de
  cada capítulo de cada tema ter sido invertida onde o gráfico vinha depois do texto. São 3 mudanças de
  **composição interna**, não de arranjo externo — a diferença que a Parte 15 do mandato (P8) nomeou
  explicitamente como a que faltou em P0-P7 ("a grande melhoria foi reorganizar os cards em duas colunas"
  está listada ali como uma justificativa que não é mais aceitável).
- **Medido, não alegado**: P8.0 quantificou exatamente o que estava errado (largura travada em 1200px
  mesmo a 1920px; 0 elementos gráficos reais no hero; 68-70% de aninhamento de card em 3 rotas) e cada
  sub-fase seguinte corrigiu um desses números específicos, com nova medição confirmando a correção — não
  uma reescrita geral seguida de uma alegação de melhoria.
- **A aprovação do usuário entre P8.3 e P8.4** ("evolução substancial... gostou do novo caminho") aconteceu
  depois de ver exatamente essas 3 mudanças (hero, descoberta, largura) em produção, antes de qualquer
  trabalho nos 5 temas — ou seja, a validação do caminho certo veio de evidência visual real, não de uma
  auto-avaliação de que a direção "deveria" funcionar.

Isso não significa que P8 esgotou o mandato: G1.6 (identidade visual própria por tema, além de composição)
e a navegação mobile continuam abertos, registrados explicitamente acima, não escondidos atrás de um PASS
inflado.
