# Explorador Analítico de Tribunais V1 — Implementação (X1–X6 consolidadas)

Consolida em 1 documento as fases funcionais X1 (Canvas e navegação), X2 (Distribuição analítica),
X3 (Painel contextual), X4 (Mesa de Investigação), X5 (Estado e compartilhamento) e X6 (Narrativas
e perguntas relacionadas) — decisão combinada com o usuário (documentação consolidada em vez de 10
arquivos separados).

## Rota reconstruída

Só `apps/web/app/judiciario/tribunais/page.tsx` (Server Component, `force-dynamic`). `/judiciario/
comparar` continua existindo e funcional, sem alteração — não é mais o caminho principal de
comparação, mas nada nele foi quebrado (G12). `/judiciario/tribunais/[id]` ganhou só 1 mudança: o
CTA "Comparar com outros tribunais" agora aponta para `/judiciario/tribunais?modo=mesa&mesa=<id>`
em vez de `/judiciario/comparar?tribunal=<id>`.

## Arquitetura — por que quase nada é `'use client'`

Toda interação do Canvas (inspecionar, adicionar/remover da Mesa, trocar de aba, trocar de
indicador, abrir/fechar a Mesa) é um `<Link replace scroll={false} href="?...">` real para a mesma
rota com outra querystring — navegação suave do App Router (sem reload de documento), focável e
ativável por teclado de graça, sem precisar de `useSearchParams`/estado de cliente novo. Único
`'use client'` do trabalho: `TribunalMultiSelect` (já existia, só corrigido — ver auditoria).

Uma função central, `buildHref(current, overrides)`, constrói toda URL a partir do estado atual +
mudanças pontuais (`null` remove a chave) — é o mecanismo único da "camada 1" de estado (mandato
§19): `busca`, `indicador`, `ramo`, `uf`, `ano`, `inspecionar`, `mesa` (até 3 ids, vírgula), `modo`
(`distribuicao`|`mesa`), `aba` (dentro da Mesa), `vis`.

## Componentes novos (`apps/web/components/judiciary/`)

- **`distribution-chart.tsx`** — distribuição "cada tribunal é 1 ponto", sem SVG (HTML/CSS puro):
  cada ponto é um `<Link>` real posicionado por `%`, empilhado em compartimentos (bin) pra evitar
  sobreposição — não é um swarm/KDE de verdade, mas resolve de forma determinística e auditável.
  Forma "emphasis" (skill de dataviz): pontos em cinza de desênfase, só o inspecionado ganha o hue
  de destaque (verde `--primary`); os já adicionados à Mesa ganham um anel colorido vazado. Mín./
  máx. sempre no eixo; mediana só quando não colide com um dos dois (ver achados abaixo).
- **`context-panel.tsx`** — os 4 estados do mandato §8 (A: conjunto; B: tribunal inspecionado; C:
  tribunal sem dado; D: nota de Mesa, delegada à `mesa-bar.tsx` pra não duplicar). Narrativas em "O
  que aparece nos dados?" são uma função pura (`narrativeFor`) — só aritmética sobre os pontos já
  carregados (posição vs. mediana, contagem, rank), nunca causalidade nem juízo de qualidade.
- **`mesa-bar.tsx`** — barra compacta (contagem, siglas com × de remoção, CTA condicional "Abrir
  Mesa"/"Adicione mais 1").
- **`mesa-workspace.tsx`** — Mesa expandida: barra de abas própria (não `ChapterNav` — ver achado
  abaixo), 1 indicador em foco por aba (trocável entre os elegíveis), `RankedBars` pro valor atual,
  `MultiLineChart` pra evolução histórica quando há ≥2 anos, tabela de valores exatos. Nunca
  desenha gráfico quando `comparisonAvailability !== 'AVAILABLE'` — mostra `JudiciaryAvailabilityNote`.
- **`tribunal-explorer-canvas.tsx`** — orquestra abertura (Estado 1, entrada dupla + 5 perguntas) e
  Distribuição (resultados de busca + gráfico + painel + perguntas relacionadas).

## Achados reais durante a construção (não suposição)

1. **`ChapterNav` não serve para as abas da Mesa.** O componente faz scrollspy entre âncoras `#id`
   na MESMA página (pensado pra capítulos empilhados). As 4 abas da Mesa são 4 ESTADOS DE DADO
   diferentes (trocados via `?aba=`, cada um buscando só o indicador ativo daquela aba — mandato
   §23 veda pré-carregar as 4 de uma vez). Usar `ChapterNav` exigiria renderizar as 4 abas
   simultaneamente, contrariando esse requisito de performance. Resolvido com uma barra de abas
   local em `mesa-workspace.tsx`, mesmo visual (sublinhado no item ativo), `<Link>` real.
2. **Rótulo do eixo sobrepondo os próprios pontos.** A 1ª versão ancorava o bloco de
   tick+rótulo em `bottom-0`, exatamente onde a fileira de pontos do nível 0 também fica — o
   rótulo "mediana X%" desenhava por cima dos pontos. Corrigido reservando uma faixa própria
   (`AXIS_BAND`, 30px) abaixo da última fileira de pontos, nunca compartilhada.
3. **Rótulos de mín./mediana/máx. colidindo entre si em distribuições muito assimétricas.** Com
   `JN_REVENUE_TOTAL` (R$0 a R$23,1 bi, mediana R$220,3 mi), a mediana fica tão perto do mínimo em
   % que os 2 rótulos de texto se sobrepunham. Corrigido: mín./máx. sempre aparecem (ancorados na
   própria borda, nunca centralizados); a mediana só aparece quando sua posição não cai a menos de
   12% de distância de qualquer um dos dois — o valor da mediana continua na legenda acima do
   gráfico de qualquer forma, então nada se perde ao omitir o rótulo no eixo.
4. **`getJudiciaryComparison` descartava tribunais sem dado** — ver auditoria (achado 3). Sem o
   `LEFT JOIN`, um tribunal selecionado mas sem publicação para o indicador escolhido simplesmente
   desaparecia da Mesa — violaria o mandato ("não apagar instituições" / "ausência não é zero").
5. **Hero do Explorador mostrando a contagem do RESULTADO FILTRADO, não do catálogo inteiro.**
   `location="${dirResults.total} instituições catalogadas"` usava o total da busca atual (ex. "1
   instituições catalogadas" ao buscar "TJES") em vez do tamanho real do catálogo. Corrigido para a
   constante `93` (já confirmada ao vivo e usada no resto do domínio) — a contagem do resultado
   filtrado continua visível, só em "Resultados para 'X' (N)", onde faz sentido.
6. **axe-core real encontrou 4 violações, todas corrigidas:**
   - `nested-interactive` (grave): o contêiner da distribuição usava `role="img"` com 91 `<Link>`
     reais dentro — além da violação em si, `role="img"` instrui o leitor de tela a tratar tudo
     como uma imagem achatada, o que esconderia os links de verdade. Trocado por `role="group"`.
   - `heading-order` (moderado), 2 ocorrências: o painel contextual (`<h3>`) e a Mesa (`<h3>`)
     apareciam sem um `<h2>` antes. Corrigido promovendo o título do gráfico de distribuição e o
     indicador ativo da Mesa a `<h2>`, e adicionando um `<h1 className="sr-only">` à view da Mesa
     (que não tinha nenhum h1 — só a view de Distribuição herda o h1 do `InstitutionHero`).
   - `scrollable-region-focusable` (grave), mobile: a tabela de valores exatos da Mesa tinha
     `overflow-x-auto` sem foco por teclado. Corrigido com `tabIndex={0} role="region" aria-label`
     — mesmo padrão já usado pelos gráficos compartilhados em `components/charts.tsx`.
7. **2 testes E2E pré-existentes (não desta fase — do P14.40/41, já commitados antes de hoje)
   ficaram desatualizados e só foram percebidos ao rodar a suíte completa:**
   - `main` inteiro não devia conter "Taxa de congestionamento X%" — mas o card de instância
     "Cortes Superiores" (P14.41) legitimamente mostra essa estatística no nível de GRUPO (nunca
     nacional). Escopado o teste pro hero (1ª seção), onde o 5º card de fato nunca pode existir.
   - O texto exato "não existe uma única taxa nacional válida" foi reescrito no P14.41 para "uma
     única taxa nacional esconderia essa diferença" — mesma afirmação, palavras atualizadas.
   Ambos corrigidos no arquivo de teste (nunca a asserção apagada, sempre documentada aqui — mesma
   régua do programa J0-J7: atualizar quando a mudança é deliberada e real, nunca pra esconder uma
   regressão de verdade).

## Perguntas investigativas e relacionadas (X6)

5 perguntas de abertura (mandato §15), cada uma mapeada a 1 indicador real já validado na
auditoria — nunca uma pergunta cuja resposta dependa de dado não integrado. Perguntas relacionadas
(até 3, mandato §16): os outros indicadores da MESMA aba do indicador ativo (até 2) + 1 sugestão de
outra aba — sempre a partir da mesma taxonomia validada, nunca uma lista livre sem checagem.

## O que ficou fora desta passada (limitação documentada, não escondida)

- Adicionar um 3º tribunal à Mesa reaproveita o fluxo "voltar à Distribuição → inspecionar →
  adicionar" — não há (ainda) um `TribunalMultiSelect` embutido dentro da própria Mesa expandida.
  A funcionalidade existe (o limite de 3 e a adição funcionam de ponta a ponta), só não há um 2º
  caminho de busca dedicado dentro da Mesa nesta versão.
- Medição de performance de campo (RUM/LCP/INP/CLS) não foi feita — mesma limitação já documentada
  no programa anterior, sem instrumentação de campo neste ambiente isolado.
- Refinamento visual contra os mocks aprovados pelo usuário não foi feito pixel a pixel — as imagens
  dos 4 estados (desktop/mobile) não estavam acessíveis neste contexto; a implementação seguiu a
  especificação textual do mandato à risca, com verificação visual real (capturas de tela
  inspecionadas, não só geradas) em cada estado, mas sem comparação lado a lado com os mocks.
