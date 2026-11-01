# P2 — Página municipal piloto

Materializa a nova direção de arte em `/municipios/[ibge]` (visão geral — as 5 abas temáticas internas
continuam intactas, isso é P5). Base: `P0_AUDITORIA_TERRITORIAL.md` (Gate `PASS_WITH_CAVEATS`) e
`P1_DESIGN_SYSTEM.md` (Gate `PASS_WITH_CAVEATS`), cujos tokens (`--brand-*`) e grid (`.grid-12`/
`.col-reading`/`.col-explore`) são consumidos aqui, não reinventados.

## O que foi construído

### 1. Descobertas dinâmicas (novo) — `apps/web/lib/territory-discoveries.ts` + `components/territory/discovery-panel.tsx`

Resolve diretamente o problema que P0 documentou visualmente: o padrão repetitivo "eyebrow → título → 4
KPIs → CTA" repetido 5x seguidas na visão geral — o "esqueleto visual dominante" que a Parte III.7 do
mandato pede para romper. Antes dos teasers de tema, a página agora abre com uma manchete editorial real
("Descoberta em {município}") seguida de até 3 complementares.

**Regra de elegibilidade (determinística, nunca por magnitude — Parte V.10.1):**
- Só 3 temas têm, hoje, um sinal de comparabilidade já validado contra UF/Brasil no próprio contrato de
  dado: **Educação** e **Segurança** (`Kpi.compare.valid` ou, no caso de Educação que nunca define
  `compare`, o campo `secondary` já calculado ano-a-ano pela função `cmpLine`) e **Infraestrutura**
  (`HeroKpi.compare` com `brazil.eligible` e `restrictions.length === 0`). Qualquer KPI com
  `caveat !== null` (ressalva metodológica própria, ex. "contagem bruta: não compara territórios de porte
  diferente") é descartado.
- Ordem fixa de prioridade editorial — Educação, Segurança, Infraestrutura — decide **qual tema** disputa,
  nunca qual valor é maior. Dentro de cada tema, a primeira KPI elegível na ordem que o próprio tema já
  prioriza (não reordenada por valor) concorre.
- A primeira KPI elegível do primeiro tema com alguma KPI elegível vira manchete. Sem nenhuma elegível em
  nenhum tema, `headline` é `null` e a seção abre com um texto editorial neutro ("Os dados já coletados
  para {município} ainda não sustentam uma comparação direta e validada...") — nunca uma frase inventada.
- Bem-estar nunca disputa a manchete: `PortraitFact` (confirmado em P0/P1) não carrega nenhum sinal de
  comparação territorial — aparece só como complementar, com a própria fonte/período como legenda, sem
  nenhuma alegação de comparação.
- Cada card complementar mostra o **fragmento de comparação real** (`note`), não um rótulo genérico — ver
  "erro encontrado e corrigido" abaixo.

Testado nos dois municípios-piloto: Nova Friburgo abre com "Ideb · anos iniciais: 6,6 de 10 (Ideb 2025).
+0,6 pontos desde 2023. Rio de Janeiro: 5,8 · Brasil: 6,1" — frase montada 100% a partir de campos já
validados pelo próprio contrato de Educação, nenhum texto novo inventado.

### 2. Composição variada dos teasers de tema — `apps/web/app/municipios/[ibge]/page.tsx`

Os 5 `*Summary` (Educação/Segurança/Bem-estar/Infraestrutura + Executivo/IDHM) não foram reescritos por
dentro — preservam 100% do dado, fonte e link que já tinham. O que mudou foi a **composição da página**:
em vez de 5 blocos full-width empilhados, agora formam 3 pares lado a lado no desktop (`grid
lg:grid-cols-2`) — Educação+Segurança, Bem-estar+Infraestrutura, Executivo+IDHM — intercalados com o
Painel de Saúde (full-width, estrutura própria) e o Legislativo com hemiciclo (full-width, precisa de
espaço). Abaixo de `lg` (1024px) cada par colapsa para 1 coluna, sem nenhuma mudança de comportamento.

### 3. Mapa contextual

O mini-mapa localizador (`MunicipalMap` com `highlightFill`) já existia e foi mantido como estava —
decisão deliberada de não reconstruir o SVG nesta fase (fora do escopo autorizado: "pode reusar... não
precisa ser reconstruído"). A integração visual não mudou estruturalmente.

## Municípios-piloto

- **Nova Friburgo/RJ** (`entity_id` 3303401) — indicado explicitamente pelo mandato.
- **Tucuruí/PA** (`entity_id` 1508100, ~96 mil habitantes) — escolhido por ter características
  genuinamente diferentes em 3 eixos ao mesmo tempo: região (Norte, não Sudeste), porte (cidade média, não
  pequena/grande), e **perfil de cobertura de dados**: é um dos 16 municípios sem prefeito resolvido (TSE)
  documentados em P14 — eleição de 2024 anulada, sem suplementar ainda realizada. Isso força e confirma na
  prática o caminho de ausência honesta: `ExecutiveSummary` mostra "Governo de Pará" com o governador
  (Helder Barbalho) e NÃO inventa um prefeito. Confirmado no HTML real servido, não só por leitura de
  código.

## Dois erros reais encontrados e corrigidos nesta fase (não pré-existentes — introduzidos e corrigidos no mesmo ciclo)

1. **Overflow horizontal novo em 390/320px**: os pares `grid lg:grid-cols-2` que envolvem os `*Summary`
   caíram na armadilha clássica de grid — um item de grid tem `min-width:auto` por padrão, que para
   conteúdo não quebrável (o SVG do `MultiLineChart` do IDHM, por exemplo) força a trilha a crescer além
   da viewport em vez de encolher. Media a 328–398px de overflow em 390/320px antes da correção. Corrigido
   em dois níveis: `min-w-0` nos wrappers de cada item de par (`page.tsx`) e `min-width:0` adicionado à
   definição de `.col-reading`/`.col-explore` em `globals.css` (P1 introduziu essas classes sem esse
   detalhe — como ainda não tinham nenhum consumidor real antes deste P2, corrigir a definição de base é
   seguro e beneficia qualquer adoção futura). Confirmado: 0px de overflow nos 2 municípios × 5 larguras
   depois da correção.
2. **Rótulo de comparação impreciso nos cards complementares**: a primeira versão mostrava "Comparado a
   Brasil" fixo para qualquer KPI comparável, mas a comparação real de Segurança frequentemente é contra
   uma **faixa de municípios-pares por porte populacional dentro da UF** (percentil), não contra o Brasil
   — mostrar "Comparado a Brasil" ali seria uma alegação estatisticamente errada (violaria a Parte XIII/G3
   do mandato: nenhuma comparação inválida pode aparecer como válida). Corrigido: o card agora mostra o
   fragmento de comparação real e já validado pelo próprio contrato (`note`), nunca um rótulo genérico —
   confirmado no HTML real: "Entre 22 municípios do Rio de Janeiro de 100 a 500 mil habitantes, a mediana
   de homicídios dolosos (taxa) em 2025 foi 19,0 por 100 mil habitantes; Nova Friburgo registrou 10,3,
   abaixo da faixa central."

## Verificação

- `npm run typecheck` (`NEXT_DIST_DIR` isolado, workspace `@senadotracker/web`) — limpo, 0 erros, em
  ambas as rodadas (antes e depois do fix de overflow).
- Build de produção isolado + servidor isolado (`next start -p 3152`, nunca a porta 3000 do usuário) via
  `.env` da raiz exportado só para o processo isolado.
- `tests/e2e/p14-territorio-executivo.spec.ts` + `tests/e2e/infraestrutura-p137.spec.ts` contra o build
  isolado — **40/40 passaram**, incluindo o teste de teclado do `ChapterNav` e os testes de largura de
  estresse de Infraestrutura (320–1920px) — nenhuma regressão nos domínios não tocados.
- 10 screenshots reais (`artifacts/p2-piloto-municipal/{nova-friburgo,tucurui}-w{1440,1280,768,390,320}.png`)
  — **0px de overflow horizontal e 0 erros de console em todas as 10 combinações**, confirmado depois de
  corrigir um problema real no próprio script de verificação: a página usa `<Suspense fallback={null}>`
  pré-existente (não introduzido aqui) nos 5 `*Summary`, e o streaming SSR do Next pode levar ~1–5s para o
  conteúdo final assentar depois de `load`/`networkidle` — um script que mede a página imediatamente após
  esses eventos pode capturar um estado intermediário incompleto (isso aconteceu nesta própria verificação
  e foi diagnosticado e corrigido: a árvore final é sempre entregue certa, só a medição estava cedo demais).
  Os testes E2E existentes não sofrem disso porque usam `expect(locator).toContainText()`, que já
  re-tenta automaticamente — mas qualquer verificação futura (ad hoc ou nova) que meça
  `scrollWidth`/`scrollHeight`/screenshot direto nesta página precisa esperar a altura estabilizar de
  verdade, não só o evento de rede — registrado aqui como lição de metodologia de QA, não como bug do
  produto.
- Dados reais conferidos: nenhum valor inventado; a descoberta de Nova Friburgo e os 3 complementares
  batem com os números reais já publicados nos capítulos correspondentes; o fallback de Tucuruí (sem
  prefeito) está correto e visível no HTML servido.

## Efeitos colaterais em componentes compartilhados

- `apps/web/app/globals.css`: `.col-reading`/`.col-explore` ganharam `min-width:0`. Aditivo, sem nenhum
  consumidor antes deste P2 — zero risco para outras páginas.
- Nenhum outro componente compartilhado foi alterado por dentro (`*Summary`, `ChapterNav`, `TerritoryFrame`,
  `MunicipalMap` — todos usados exatamente como P0 documentou).
- **`apps/web/app/estados/[uf]/page.tsx` não foi tocado** — confirmado por `git status`: seu status "M" é
  herdado do trabalho P14 anterior a este P2, não desta fase. A composição de teasers da página de estado
  continua com o padrão antigo (5 blocos empilhados) até a Fase P3 decidir, deliberadamente, estender ou
  não o mesmo tratamento.

## Status do Gate P2

**`PASS_WITH_CAVEATS`.**

Avaliado contra os 6 critérios do próprio mandato (não só "funcionou"):
- **Hierarquia editorial superior**: sim — a página agora tem um momento real de "grande revelação"
  (Descoberta) antes dos teasers, com tipografia de abertura (`display-title`, texto a 68ch de medida de
  leitura) distinta da densidade analítica dos cards.
- **Impacto visual perceptível**: sim, confirmado nos 10 screenshots — a composição em pares quebra o
  empilhamento idêntico 5x que P0 havia documentado como o problema central.
- **Identidade própria**: parcial — usa a paleta e tokens já existentes/estendidos em P1; não introduz
  nenhum elemento gráfico novo além do grid e da seção de descobertas.
- **Mapa bem integrado**: mantido como estava (decisão deliberada, não regressão) — não teve protagonismo
  aumentado nesta fase.
- **Leitura imediata dos indicadores**: sim — a manchete e os complementares são, por construção, as
  afirmações mais verificáveis e comparáveis da página.
- **Ausência de regressões**: sim, confirmada por 40/40 e2e + typecheck limpo + 0 overflow novo.

Ressalvas que impedem um `PASS` puro:
1. A seleção de descobertas só cobre 3 dos 5 temas (Educação/Segurança/Infraestrutura) — Bem-estar e
   Saúde nunca produzem manchete, por não termos ainda um sinal de comparabilidade validado nesses
   contratos (mesma lacuna documentada em P1 para `IndicatorLive`). Não é uma falsa universalidade — é um
   limite real, documentado, não escondido.
2. A "composição variada" desta fase é um tratamento de **layout** (pares assimétricos) — não uma
   reformulação interna de cada card por tema. Uma iteração futura (P5/P6) pode diferenciar a composição
   interna de cada `*Summary`, não só o agrupamento.
3. Cobertura de screenshot ficou em 2 municípios × 5 larguras — representativo, não exaustivo (não cobre,
   por exemplo, um município sem nenhum dado de saúde coletado).

Nenhum impedimento bloqueia o início da Fase P3 (página estadual e Atlas Vivo).
