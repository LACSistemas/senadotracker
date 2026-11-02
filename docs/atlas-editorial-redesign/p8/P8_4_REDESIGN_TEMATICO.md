# P8.4 — Redesign temático profundo (Saúde, Educação, Segurança, Bem-estar, Infraestrutura)

Executado depois da aprovação do usuário sobre a direção de P8.1-P8.3 ("evolução substancial... gostou do
novo caminho"), com os 7 requisitos adicionais do próprio usuário: (1) não replicar o mesmo template nas 5
áreas; (2) resolver densidade de minicards, excesso de texto antes das visualizações e falta de
protagonismo dos gráficos; (3) preservar 100% de dados/indicadores/capítulos/filtros/séries/comparadores/
tabelas/fontes/exportações; (4) mobile real; (5) screenshots antes/depois + inspeção visual direta; (6)
nenhuma mudança de banco/coletor/pipeline; (7) G1 continua pendente de aprovação do usuário.

## Método

Diferente de P5 (P0-P7), que delegou cada tema a um fork com instrução geral, esta fase foi feita
diretamente por mim: primeiro lendo o código real de cada tema (orquestrador de página + componentes de
capítulo) para localizar exatamente ONDE a densidade de minicards e a falta de protagonismo de gráfico
aconteciam, depois aplicando a correção cirúrgica (reordenar JSX e/ou trocar o tratamento visual de um
componente), nunca uma reescrita ampla. Cada tema foi verificado individualmente (typecheck + build
isolado + e2e real contra esse build + screenshots) antes de passar ao seguinte — sequencial, como a
instrução pediu.

**Achado que mudou a abordagem**: nem todos os 5 temas tinham o mesmo problema. Educação e Bem-estar
tinham o padrão clássico "StatGrid antes do gráfico" repetido em vários capítulos. Segurança já tinha quase
todos os capítulos chart-first (CrimeExplorer, TrendChart, BenchRuler) — só 1 capítulo (Estrutura) invertia
a ordem. Infraestrutura já tinha `IndicatorLive` liderando os 7 capítulos (decisão de P5) — o problema real
ali não era "texto antes do gráfico", era "grade de cartões" como o único formato dos indicadores de apoio
depois do indicador líder. Saúde não tinha nenhum problema de ordem — tinha 1 chapter (Painel de Saúde) que
abria com 7 minicards de peso igual antes de 3 análises reais já existentes. Tratar os 5 temas como o mesmo
problema teria sido o erro que o mandato nomeou explicitamente (§15): a correção precisa ser lida em cada
tema, não copiada.

## O que mudou, tema por tema

### Saúde — `health-panel.tsx`

**Antes**: 7 minicards de peso igual (`rounded-xl border bg-white p-3`) logo após a frase de abertura,
depois (só na página completa) 3 análises reais (donut de estabelecimentos, tabela de leitos, tabela de
vacinas).
**Depois**: 1 indicador protagonista (capacidade instalada — sempre o 1º de `PANEL_CARDS`, nunca escolhido
por magnitude) em tamanho grande (`size="lg"`, nova variante do mesmo `KpiBenchCard`, mesmo `BenchRuler`)
logo após a abertura; as 3 análises reais vêm em seguida; os demais indicadores viram uma faixa de apoio
menor DEPOIS dos gráficos, não antes. No teaser compacto da visão geral, a faixa de apoio mostra só 3
indicadores (não 6) — mantém a página mais leve.
**Preservado**: todos os 7 indicadores, o mesmo `BenchRuler`, a mesma régua de legenda, `EvolutionPanel`/
`ResidentsPanel`/`HospitalsPanel` (já eram protagonizados por gráfico real — não tocados).
**Evidência**: `artifacts/p8-4-saude/` — 0px overflow em 1440/390, 0 erros de console; 10/10 e2e de
regressão (`p14-territorio-executivo`).

### Educação — `education-page.tsx` + `education-ui.tsx`

**Antes**: 6 dos 11 capítulos (Contexto, Professores, Recursos, Enem, Ensino Superior, Pós-graduação)
abriam com `StatGrid` (grade de minicards) antes de qualquer `TrendChart`/`BenchRuler`/`BarList`.
**Depois**: em cada um dos 6, o gráfico real vem primeiro; `StatGrid` passa a vir depois, com tratamento
mais leve (`p-3`/`text-2xl` em vez de `p-4`/`text-3xl` — mudança em `education-ui.tsx`, afeta os 2 outros
usos de `StatGrid` que já eram apoio, sem prejuízo). Os 3 capítulos que já tinham `IndicatorLive` (Rede,
Aprendizagem, Trajetória — de P5) não foram tocados: já eram chart-first.
**Preservado**: os 11 capítulos, os `ChartExplorer`/`EnemSubjectToggle`/3 exploradores client-side
(`IesExplorer`/`CourseExplorer`/`ProgramExplorer`), todas as tabelas e filtros.
**Evidência**: `artifacts/p8-4-educacao/` — capturas por capítulo confirmando a nova ordem (Contexto: INSE
→ BarList → StatGrid; Enem: BenchRuler com frase real → StatGrid → BarList → abas); 0px overflow; 10/10 e2e.

### Segurança — `structure-chapter.tsx`

**Antes**: só o capítulo "Estrutura e capacidade institucional" tinha o problema — 3 grades de cartões
(municipal/estadual/nacional) antes do único gráfico real (`PlannedBars`, previsto × existente).
**Depois**: `PlannedBars` lidera quando existe; as grades de declaração (que são categóricas — existe
guarda municipal sim/não, não são série nem magnitude comparável) ficam como referência depois. Os outros 6
capítulos (Criminalidade, Trânsito, Prisional, Finanças, Apreensões, Explorar) já eram chart-first
(`CrimeExplorer`, `IndicatorLive`, `TrendChart`) — não precisaram de mudança, confirmado por leitura.
**Preservado**: `CrimeExplorer` (não tocado), todos os 7 capítulos, `ExplorerPanel`, exportação CSV.
**Evidência**: `artifacts/p8-4-seguranca/chapter-estrutura.png` confirma a nova ordem; 23/23 e2e
(`seguranca-p98` completo + regressão), incluindo o teste de teclado e o de "sem facção/sem causa".

### Bem-estar — `wellbeing-page.tsx` + `wellbeing-ui.tsx`

**Antes**: Trabalho, Rede socioassistencial e Ação pública abriam com `StatGrid` antes do gráfico/lista
real (Caged/RAIS, capacidade de CRAS, tabela de ação pública). Digital mostrava a lista de declarações
antes do `BarList` de distribuição.
**Depois**: mesma correção de Educação — gráfico/lista real primeiro, `StatGrid` depois, tratamento mais
leve (mesma mudança de `p-4/text-3xl` para `p-3/text-2xl`). Retrato (já usa `IndicatorLive`), Condições de
vida e Evolução (já chart-first) não foram tocados.
**Preservado**: os 2 rótulos de fluxo (Caged, mensal) × estoque (RAIS, anual) continuam visualmente
distintos (selo colorido em cada gráfico, de P5 — não mexido); `TerritoryCompareRow`, `Disclosures` por
indicador, todos os 7 capítulos.
**Evidência**: `artifacts/p8-4-bemestar/chapter-trabalho.png` mostra os 2 gráficos (fluxo e estoque)
liderando, StatGrid como rodapé de 4 fatos; 25/25 e2e (`wellbeing-p128` completo, incluindo larguras de
320/768/1920px e os 2 casos de "distinção real" SP/Brasília município×UF).

### Infraestrutura — `infrastructure-ui.tsx`

**Antes**: os 7 capítulos já abriam com `IndicatorLive` (decisão de P5) — mas o conteúdo de apoio depois
dele era `GroupBlock`, que renderizava uma grade de cartões (`StatGrid`) por grupo (ex. "Abastecimento de
água", "Esgotamento sanitário", "Resíduos sólidos", "Gestão dos serviços" — até 4 grades empilhadas num só
capítulo). Esse é o achado nomeado pelo próprio mandato para este tema especificamente: "a apresentação é
excessivamente orientada a cartões de métricas e textos."
**Depois**: `GroupBlock` usa uma nova lista compacta (`StatRows` — rótulo à esquerda, valor à direita,
separados por hairline, sem moldura própria) em vez de `StatGrid`. O resultado lê como uma tabela de
referência editorial, não uma parede de caixas — mesma informação, muito menos peso visual. `StatGrid`
continua existindo (não removido) onde ainda funciona como painel de entrada real: o panorama do topo e os
4 totais de obras no capítulo 7.
**Preservado**: os 7 capítulos, `IndicatorLive` em todos eles (não tocado), `EntornoUnitSwitcher`,
`IndicatorExplorer`, a lista de obras com paginação e filtros, os 5 estágios financeiros (nunca somados).
**Evidência**: `artifacts/p8-4-infra/chapter-agua-saneamento.png` — 4 grupos (16 indicadores) como lista
compacta em vez de 4 grades de cartões; 0px overflow; 40/40 e2e (`infraestrutura-p137` completo, a suíte
mais extensa do produto — larguras de estresse 320 a 1920px, obras, honestidade de ausência).

## Verificação agregada

- Cada tema: `NEXT_DIST_DIR` isolado, typecheck limpo, build de produção isolado, servidor isolado (porta
  3172, nunca a 3000 do usuário — confirmado antes/depois de cada tema).
- e2e: 10 (Saúde, via regressão de `p14-territorio-executivo`) + 10 (Educação, idem) + 23 (Segurança,
  suíte própria completa) + 25 (Bem-estar, suíte própria completa) + 40 (Infraestrutura, suíte própria
  completa) = **108 execuções de teste**, rodadas ao final de cada tema contra o build daquele tema.
- Rodada final combinada (as 4 suítes próprias + regressão, 68 testes num único build com as mudanças dos
  5 temas juntas): 66/68 na primeira passada sob paralelismo; os 2 que falharam (São Paulo PIB per capita,
  visão geral de Segurança) passaram isolados em <10s cada — mesma contenção de paralelismo já documentada
  em P7/P8.1, não regressão real.
- Screenshots reais em 1440px (desktop) e 390px (mobile) para pelo menos 1 capítulo por tema, mais capturas
  específicas de cada capítulo reordenado — revisadas diretamente por mim (não só autorrelato), confirmando
  visualmente a nova hierarquia gráfico-primeiro em todos os 5 temas.
- 0px de overflow horizontal e 0 erros de console em toda a verificação.

## O que NÃO foi feito nesta fase (decisão deliberada, registrada para P8.5/P8.6)

- **Diferenciação bespoke de visualização além da composição**: os 5 temas agora têm hierarquia
  gráfico-primeiro e, em alguns casos (teasers da visão geral, de P8.1), formas de apresentação realmente
  diferentes. Mas dentro das páginas de capítulo completas, a correção desta fase foi de ORDEM e PESO
  VISUAL (mover o gráfico para antes, reduzir o cartão), não de inventar um tipo de gráfico novo por tema.
  Os gráficos protagonistas de cada capítulo (donut/BenchRuler/TrendChart/CrimeExplorer/StatRows) já eram
  diferentes entre si por natureza do dado — não foi preciso inventar mais, mas também não foi perseguido
  ativamente "uma linguagem gráfica própria por tema" além do que já existia.
- **Mobile**: verificado sem overflow e com ChapterNav em faixa horizontal (já existia), mas não houve
  reprojeto da navegação mobile em si (ex. um seletor mais rico que a faixa horizontal) — a instrução nº 4
  do usuário pede isso explicitamente; tratado como item de P8.5/P8.6, não resolvido aqui além de confirmar
  ausência de overflow em todos os 5 temas.
- **axe-core**: segue inacessível nesta sessão (mesma limitação de P8.1-P8.3) — `NOT_EVALUATED`.
- Itens que o usuário pediu para registrar para a etapa de polimento (hero mobile possivelmente alto
  demais; distinção visual entre mapa contextual e mapa analítico no estado; validações restantes de
  P8.2/P8.3 — Macaé, ES, RR, larguras intermediárias) continuam em aberto, não endereçados nesta fase
  (fora do escopo de "redesign temático").

## Status do Gate P8.4

**`READY_FOR_VISUAL_REVIEW`.** Os 3 requisitos centrais do usuário para esta fase foram cumpridos com
evidência real: (1) os 5 temas não compartilham mais o mesmo problema nem a mesma solução — cada correção
foi lida a partir do código real daquele tema; (2) densidade de minicards e falta de protagonismo de
gráfico foram corrigidas nos pontos reais onde existiam (não em todo lugar — só onde o achado se
confirmava); (3) zero dado, capítulo, filtro, série, comparador, tabela, fonte ou exportação removido,
confirmado por 108+66 execuções de teste e2e reais. G1 permanece pendente da revisão visual do usuário, como
o próprio usuário reafirmou no requisito 7.
