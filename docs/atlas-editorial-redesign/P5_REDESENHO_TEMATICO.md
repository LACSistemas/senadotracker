# P5 — Redesenho temático completo (consolidado)

Consolida as 5 sub-fases executadas em sequência (nunca em paralelo, para não haver dois agentes
editando o mesmo arquivo compartilhado ao mesmo tempo): `P5_SAUDE.md`, `P5_EDUCACAO.md`,
`P5_SEGURANCA.md`, `P5_BEM_ESTAR.md`, `P5_INFRAESTRUTURA.md` (todos em `docs/atlas-editorial-redesign/`,
cada um com seu próprio inventário antes/depois, evidência e status de Gate — este documento não repete
o detalhe de cada um, sintetiza o conjunto).

## Padrão aplicado nos 5 temas (consistência deliberada)

Todas as 5 sub-fases seguiram o mesmo tratamento, descoberto e validado em Saúde (primeira) e repetido
com ajustes nos 4 seguintes:

1. **`ChapterNav layout="sidebar"`** ativado (prop já existente desde P1, nunca usada em produção até
   agora) — sidebar persistente ≥1024px, faixa horizontal preservada abaixo disso. Zero edição no
   componente compartilhado em nenhuma das 5 sub-fases.
2. **Hero com narrativa real**: o texto de abertura de cada página de tema passou a usar a frase
   comparativa que o próprio contrato de dado já calculava (`*Narrative`/`*LedeFor`) em vez de um texto
   genérico fixo — com uma prop `hideLede`/equivalente para não duplicar a frase entre o hero e o corpo
   da página (bug real, encontrado e corrigido de forma idêntica em Saúde, Educação, Segurança e
   Bem-estar — mesmo padrão, mesma causa, mesma correção, confirmando que não era acaso).
3. **`IndicatorLive` (Descobrir→Explorar→Verificar, de P1) aplicado onde há `Kpi`/`HeroKpi` real** — nunca
   forçado onde a fonte não sustenta: Segurança deixou 3 capítulos de fora por falta de Kpi real
   (documentado em `buildHero`, não lacuna de execução); Bem-estar e Infraestrutura usaram os adaptadores
   `heroKpiToKpi`/`portraitFactToKpi` que a P4 tinha construído mas nunca aplicado a uma página real até
   agora — essa aplicação real fecha uma lacuna que vinha documentada desde P1.
4. **Corpos de capítulo preservados quando já eram visualmente diferenciados entre si** (Saúde, Bem-estar) —
   decisão de risco/benefício repetida 2x, não reescrever o que já funcionava; Educação e Infraestrutura,
   por outro lado, ganharam composição nova de verdade dentro dos capítulos (cards de indicador no topo de
   cada capítulo, comparação visual dos 5 estágios financeiros em Infraestrutura).
5. **100% do dado, filtro, exportação e comportamento interativo preservado** em todas as 5 — confirmado
   por comparação direta com os screenshots de referência de P0 em cada sub-fase.

## O que cada tema ganhou de específico

| Tema | Ganho específico desta fase |
|---|---|
| Saúde | Primeira navegação por capítulo que o tema já teve (nunca teve `ChapterNav` antes — estruturalmente mais antigo que os outros 4) |
| Educação | 3 dos 11 capítulos (Quantos estudam / O que aprendem / Quem fica pelo caminho) ganharam `IndicatorLive`; investigação do bug de key duplicada de React documentado em P0 — não reproduzido nesta data, não corrigido por falta de reprodução |
| Segurança | Capítulos Trânsito e Finanças ganharam Nível 3 "Verificar"; `CrimeExplorer` (já maduro) preservado sem alteração; cuidado explícito contra estética de "painel de alarme" |
| Bem-estar | Os 4 fatos do Retrato passaram a usar `IndicatorLive` via `portraitFactToKpi` — primeira aplicação real do adaptador que P4 tinha construído; distinção fluxo mensal (Caged) × estoque anual (RAIS) preservada e visível |
| Infraestrutura | Maior cobertura de `IndicatorLive` das 5 sub-fases (7/7 capítulos, por já existir `HERO_KPI_PRIORITY` mapeando 1 KPI por capítulo); comparação visual dos 5 estágios financeiros (previsto/contratado/empenhado/liquidado/pago) na ficha de obra e no agregado do capítulo, com ressalva explícita de que as barras não se somam |

## Achados reais registrados durante P5 (não hipotéticos)

- **3 bugs reais introduzidos e corrigidos no próprio ciclo** (nenhum chegou a ficar no código):
  overflow por `grid` em vez de `lg:grid` no wrapper da sidebar (Segurança, replicado corretamente por
  Infraestrutura a partir do mesmo fix); `id` de DOM duplicado ao reusar um `Kpi` dentro de um capítulo
  (Segurança); frase de hero duplicada entre hero e corpo (Saúde, replicado corretamente pelas 3
  seguintes).
- **Achado fora de escopo de arquivo, não corrigido, registrado para depois**: `seguranca-p98.spec.ts`
  revelou que a visão geral municipal (herança de P2) tem 4 links "Ler a história completa" com texto
  idêntico — não é uma falha de teste ativa (o teste em questão passou 13/13), é uma fragilidade latente
  para quem for revisar aquela página especificamente.
- **Achado real, não corrigido, de baixo impacto**: os adaptadores `heroKpiToKpi`/`portraitFactToKpi` (P4)
  definem `plain: label`, causando uma repetição visual leve no card de indicador (ex. "ABASTECIMENTO DE
  ÁGUA" seguido de "Abastecimento de água") — presente em Bem-estar e Infraestrutura, mesmo comportamento
  nas duas, não uma regressão de uma sub-fase específica. Candidato a ajuste em P6.
- **Overflow horizontal pré-existente de P0** (2 rotas, mesma magnitude exata medida desde a auditoria)
  continua sem correção, como documentado desde P0 — decisão deliberada, fica para P6.

## Verificação agregada

Cada sub-fase rodou typecheck isolado + build/servidor isolado + e2e reais contra esse build, sem nunca
tocar a porta 3000 do usuário (confirmado em todas as 5). Maior cobertura de teste: Infraestrutura, com
os 30/30 completos de `infraestrutura-p137.spec.ts` (não amostra). Segurança foi a única sub-fase a rodar
e atualizar `seguranca-p98.spec.ts` (13/13, 2 asserções corrigidas por mudança estrutural legítima, não
por enfraquecimento do teste). 65 screenshots reais somados entre as 5 sub-fases (`artifacts/p5-*/`),
revisados por amostragem direta (não só pelo autorrelato de cada agente) para os temas Saúde, Educação e
Infraestrutura.

## Gate P5

**`PASS_WITH_CAVEATS`** — avaliado contra o critério do próprio mandato ("cada área precisa passar por
comparação funcional antes/depois"; "não declarar a área concluída após reformular apenas seu Panorama").

Cumprido: as 5 áreas tiveram TODOS os capítulos tocados (não só o panorama/primeira tela), com inventário
antes/depois documentado por sub-fase, preservação de 100% do dado confirmada, e nenhuma regressão
encontrada que não tenha sido corrigida no mesmo ciclo.

Ressalvas que impedem um `PASS` puro (consistentes com o padrão de honestidade das fases anteriores):
1. 2 dos 5 temas (Saúde, Bem-estar) mantiveram a composição interna dos painéis/capítulos como estava —
   ganharam navegação e hero novos, mas não uma reformulação visual interna profunda. Decisão deliberada
   de risco/benefício em ambos os casos, documentada, não uma lacuna escondida.
2. A cobertura de `IndicatorLive` variou de tema para tema por limite real de dado disponível (Segurança
   3/7 capítulos elegíveis; os demais mais altos) — nunca forçado onde não havia Kpi real, mas significa
   que a experiência "Descobrir→Explorar→Verificar" ainda não é 100% uniforme entre os 5 temas.
3. Um achado de UX latente (4 links ambíguos na visão geral municipal, herdado de P2) e um achado visual
   menor (repetição de rótulo nos adaptadores de P4) ficam registrados para P6, não corrigidos aqui.
4. Nenhum dos 5 temas recebeu, nesta fase, a composição assimétrica "de verdade" (Parte III.7 do mandato)
   que P3 já demonstrou ser possível no Atlas Vivo — o ganho desta fase foi navegação + narrativa real +
   indicador vivo, consistente entre os 5 temas; o salto para uma linguagem editorial verdadeiramente
   distinta por tema (cores/composição/ritmo próprios de cada área, não só o mesmo sistema aplicado 5x)
   é o trabalho que falta para P6.

Nenhum impedimento bloqueia o início da Fase P6 (refinamento premium). É, deliberadamente, a fase que
mais se beneficia de julgamento visual direto (não só verificação automatizada) — critério já confirmado
nas fases anteriores deste programa.
