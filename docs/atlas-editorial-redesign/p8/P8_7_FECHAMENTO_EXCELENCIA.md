# P8.7 — Fechamento de Excelência Visual, UX e Qualidade

Mandato final de refinamento, aberto depois que o usuário confirmou que a direção visual de P8 (P8.0–P8.6)
é "substancialmente superior à versão anterior". Esta fase não refez nada da fundação — resolveu
pendências reais, concretas e verificáveis, na ordem de prioridade que o próprio mandato definiu (P0 →
P1 → P2).

## P8.7-A — Correções P0 (acessibilidade e qualidade funcional)

### 1. Skip-link corrigido (causa raiz real, não cosmética)

O skip-link global (`app/layout.tsx:15`) sempre esteve implementado corretamente — `<a href="#conteudo">`
focável, visível ao focar, primeiro elemento do `<body>`. O que estava quebrado era o ALVO: `TerritoryFrame`
(a casca de toda rota territorial — as 14 rotas que P8 inteiro reconstruiu) nunca definia `id="conteudo"`
no seu `<main>`, ao contrário de todas as outras ~10 páginas do produto que já tinham esse id desde antes
de P8. Isso significa que o pulo por teclado **nunca funcionou em nenhuma página territorial, desde P1** —
não é uma regressão de P8, é uma lacuna que esperava desde o início da série.

Corrigido: `id="conteudo" tabIndex={-1}` adicionados ao `<main>` de `TerritoryFrame`, com `scroll-mt-28`
(a mesma convenção que todo `id` de âncora de capítulo do produto já usa, para o cabeçalho fixo não cobrir
o destino). Testado por teclado real (Playwright): Tab foca o link → Enter move o foco para `<main
id="conteudo">` → o topo do `<main>` fica a 73px do topo da tela (abaixo do cabeçalho fixo, não coberto).

### 2. axe-core executado pela primeira vez em todo o programa

A instalação externa (`D:\Civica\tools\a11y`) permanece inacessível — investigação confirmou que **o
drive D: inteiro não está montado nesta sessão** (`Test-Path "D:\"` → `False`), não é uma remoção pontual
da ferramenta. Instalação de desenvolvimento isolada: `axe-core` via `npm install --prefix` dentro do
diretório de scratchpad desta sessão (fora do repositório, `package.json`/`node_modules` do projeto
intocados — confirmado por `git status`), usando o script já existente do projeto
(`scripts/ux/axe-run.mjs` + `AXE_PATH`), sem nenhuma mudança na aplicação.

Rodado contra as 9 rotas mínimas do mandato (visão estadual, municipal, Atlas Vivo mapa e tabela, 5
temas), desktop (1280px) e mobile (390px):

| Rota | 1280px | 390px |
|---|---|---|
| `/estados/RJ` | sem violações | sem violações |
| `/municipios/3301009` | sem violações | sem violações |
| `/estados/RJ/atlas` (mapa) | sem violações | sem violações |
| `/estados/RJ/atlas?view=tabela` | sem violações | sem violações |
| Saúde | sem violações | sem violações |
| Educação | 11 nós, `color-contrast` | sem violações |
| Segurança | 6 nós, `color-contrast` | sem violações |
| Bem-estar | 6→5 nós (1 corrigido), `color-contrast` | sem violações |
| Infraestrutura | 34→6 nós (28 corrigidos), `color-contrast` | 27→0 nós (corrigido) |

**2 violações reais corrigidas** (achados genuínos, não ruído):
- `ChapterNav` (sidebar, item de capítulo indisponível): `opacity-70` somado a `text-muted-foreground` já
  mudo reduzia o contraste para 2,88:1 (mínimo exigido: 4,5:1). A versão em pílula (mobile) já usava só
  `text-muted-foreground`, sem opacidade extra, e nunca teve esse problema — removida a opacidade extra na
  versão de sidebar para igualar o tratamento já validado. Afetava Bem-estar e Infraestrutura nesta amostra
  (qualquer tema pode ser afetado, dependendo de quais capítulos faltam dado no território).
- `StatRows` (Infraestrutura, P8.4): a nota secundária de cada linha usava `text-muted-foreground/80` —
  cinza-já-mudo com opacidade extra, 3,65:1 contra o mínimo de 4,5:1. Corrigido para `text-muted-foreground`
  simples, igual ao resto do produto.

**Violações remanescentes (todas a mesma, em 4 temas): o numeral decorativo de capítulo.**
`<span aria-hidden className="... opacity-25 sm:block ...">` em `ChapterShell` (contraste 1,36–1,49:1).
Investigado com cuidado, não corrigido, com justificativa correta (a de P7/P8.6 — "é `aria-hidden`" — não
era suficiente: `aria-hidden` isenta leitores de tela, não isenta contraste visual para quem enxerga).
A isenção real e correta é a do próprio WCAG 2.2 (Understanding SC 1.4.3, texto "incidental"): texto
puramente decorativo, cuja informação (o número do capítulo) já está disponível de forma acessível em
outro lugar (a legenda "Capítulo N" ao lado, com contraste pleno) — qualifica como incidental e fica fora
do requisito de contraste. "Consertar" o numeral (aumentar a opacidade) destruiria o efeito pálido/recessivo
que é a própria intenção de design, sem ganho real de acessibilidade. Decisão registrada, não escondida.

### 3. Overlay "5 Issues" investigado — era um bug real, não falso-positivo

Reproduzido em servidor de desenvolvimento isolado (`next dev`, porta dedicada, nunca a 3000 do usuário):
um aviso real do React, **"Each child in a list should have a unique key prop... Check the render method
of AtlasVivo. It was passed a child from AtlasPage"**, reproduzível de forma determinística (testado em
servidor frio, contexto de navegador limpo, 3 vezes) sempre que o Atlas Vivo renderizava sem município
selecionado — exatamente onde a busca integrada de P8.5 vivia.

Causa raiz: a busca (JSX renderizado no Server Component `AtlasPage`) era passada para o Client Component
`AtlasVivo` por uma prop NOMEADA (`searchSlot`). O Next.js dá tratamento especial de serialização
Server→Client especificamente à prop `children` — uma prop nomeada arbitrária não recebe esse tratamento
da mesma forma, e o resultado foi esse aviso real. Corrigido: `searchSlot` virou `children` (o mesmo padrão
já usado em outras partes maduras do produto, como `ProfileTabsShell`). Confirmado eliminado em servidor
de desenvolvimento frio, 3 verificações independentes.

### 4. Overflow residual de 320px em Infraestrutura — reverificado: não reproduz mais

Medido diretamente (`document.documentElement.scrollWidth - clientWidth`) em `/estados/ES/infraestrutura`
e `/municipios/3205309/infraestrutura`, nas larguras 318/319/320/321/325px: **0px de overflow em todas as
10 combinações.** Provavelmente resolvido como efeito colateral de P8.4 (a densidade de cartões que P8.0
havia apontado como fonte provável de armadilhas de grid foi reduzida nesse mesmo tema). Não investigado
mais a fundo — não haveria o que investigar num bug que não reproduz.

## P8.7-B — UX mobile (mandato §5 e §6)

### Navegação por capítulo (§5)

A faixa horizontal de pílulas (ruim com Educação tendo 13 itens, exigia rolagem lateral para alcançar
capítulos distantes) virou um seletor compacto "Capítulo atual ▾" abaixo de 1024px —
`<details>`/`<summary>` nativo, o mesmo padrão já usado pelo menu mobile do cabeçalho do site (consistência
funcional, não um terceiro padrão de disclosure). Fecha ao escolher um capítulo, ao clicar fora ou com
Escape (os 3 únicos comportamentos que `<details>` nativo não dá de graça). Não prende scroll, não cria um
segundo menu permanente. A sidebar desktop (≥1024px) e o modo `layout="inline"` (não usado em produção
hoje) não mudaram nada.

Testado em 320/390/768px nos 5 temas: 0px overflow, 0 erros de console, axe-core sem violação nova,
68/68 e2e.

### Atlas Vivo (§6)

- **6.1 Seleção mobile**: medido diretamente — a aside de pré-visualização ficava a ~700px abaixo do mapa
  num viewport de 844px de altura; depois de tocar um município, nada visível na tela mudava. Corrigido com
  uma barra fixa (`<1024px`) no rodapé da tela com nome, indicador, valor, link "Ver perfil" e fechar —
  satisfaz os 5 requisitos do mandato (qual município, qual indicador, qual valor, como abrir, como
  fechar) sem exigir rolagem. No desktop, nada mudou (a aside já fica ao lado do mapa, sempre visível).
- **6.2 Municípios pequenos/irregulares**: avaliado — já existem 3 dos mecanismos que o mandato sugere
  (busca por nome, integrada ao mapa desde P8.5; navegação e zoom por teclado, desde P3; foco/zoom
  automático ao selecionar, `focusOn()`, desde P3). Não implementada expansão de área de clique (hit-area)
  além do polígono real: o mandato proíbe explicitamente "modificar geometrias oficiais" ou "associar uma
  seleção a outro município por aproximação" — uma hit-area maior que o path visível correria esse risco
  sem desenho cuidadoso; registrado como item de engenharia futura, não resolvido agora.
- **6.3 Preservação de contexto**: reverificado com teste real — indicador, município selecionado,
  zoom e pan sobrevivem a reload (`?mapa=homicidios&municipio=3303401&zoom=2.50&x=-100&y=-50` idêntico
  antes/depois do reload); alternar para tabela preserva o indicador e descarta corretamente
  seleção/zoom/pan (que não fazem sentido numa tabela). Nenhuma mudança necessária.
- **6.4 Modo tabela**: auditado — cabeçalhos com `scope="col"`, unidade explícita no cabeçalho, legenda
  `sr-only`, navegação por teclado nativa (é uma tabela HTML simples com links). Ordenação é alfabética,
  deliberadamente NUNCA por valor — nenhum indicador do catálogo tem `ranking_allowed`, então ordenar por
  valor insinuaria um ranking que a própria definição do indicador não autoriza (mesma regra que motivou a
  ordem alfabética desde P3). Busca já existe acima da tabela (P8.5). Nenhuma mudança necessária.
- **6.5 Legenda/escalas**: confirmado — legenda com faixas por quintil, unidade, ano e tratamento de "sem
  dado" já explícitos desde P3; mudança de indicador recalcula a escala corretamente (confirmado nos
  testes de contexto). Nenhuma mudança necessária.

## P8.7-C — Refinamento editorial dos 5 temas (mandato §7)

`ChapterShell` (componente compartilhado por Educação/Segurança/Bem-estar/Infraestrutura) ganhou uma prop
`icon` opcional e aditiva — um selo pequeno ao lado de "Capítulo N", visível em **qualquer** largura (ao
contrário do numeral decorativo grande, que some abaixo de `sm:`, 640px). Sem a prop, nada muda — risco
zero para quem não a usa.

**Bem-estar (prioridade explícita do mandato, §7.4)** foi o primeiro e recebeu os 6 ícones dos próprios
eixos de vida: Condições de vida (casa), Trabalho (maleta), Rede socioassistencial (mãos dadas), Cotidiano
digital (celular), Ação pública (instituição), Evolução (tendência) — a primeira identidade visual do tema
além da cor de assinatura violeta. Preserva os 4 eixos do mandato (condições/trabalho/proteção
social/cotidiano) e a distinção fluxo (Caged) × estoque (RAIS) já estabelecida em P5/P8.4, sem inventar
índice sintético — nenhuma mudança de dado, só de identidade visual do cabeçalho.

O mesmo padrão, já construído e verificado com risco zero, foi estendido a **Educação** (11 ícones: urna
de votos/livro/rota/casa/escola/beca/carteira/prova/academia/prêmio/microscópio), **Segurança** (6: escudo/
prédio/carro/cadeado/moeda/lupa) e **Infraestrutura** (7: gota/rota/casa/raio/ônibus/ondas/capacete) —
satisfaz o pedido mais amplo do mandato ("cada tema mais reconhecível") sem reconstrução, só a mesma peça
já provada em Bem-estar. **Saúde não foi tocada** — o mandato pede explicitamente leveza, não mudança
estrutural, para o tema que já era o mais maduro visualmente (§7.1).

Os pedidos mais estruturais de §7.2/§7.3/§7.5 (ritmo editorial em Educação, redução adicional de
empilhamento em Segurança, clareza de cobertura/capacidade em Infraestrutura) **não foram implementados
nesta fase** — já haviam sido parcialmente endereçados em P8.4 (reordenação gráfico-antes-de-grade) e uma
reconstrução mais profunda dos capítulos individuais, feita tema a tema, excederia o escopo seguro desta
fase de fechamento; registrado como recomendação futura não bloqueante, não como lacuna escondida.

## P8.7-D — Desempenho (mandato §9)

Investigação real (não suposição) do elemento de LCP, usando o detalhamento do próprio Lighthouse
(`largest-contentful-paint-element`), não só o número agregado:

- **Visão municipal**: 3 medições em sequência mostraram variância real entre TTFB e Render Delay (TTFB
  1793ms→1042ms→464ms ao longo de 3 execuções, provavelmente por causa do cache de 60s dos loaders de
  domínio reutilizados por `loadMunicipalityDiscoveries` — ver abaixo), com o total de LCP permanecendo
  estável em ~2,8-2,9s. O elemento de LCP é o parágrafo de texto do hero (a frase de descoberta ou a lede),
  nunca o mapa — **a suposição de que o mapa seria o culpado está descartada por medição real**, como o
  próprio mandato pediu para verificar antes de agir.
- **Achado estrutural real** (não dependente de variância de medição, confirmado por leitura de código):
  `loadMunicipalityDiscoveries` (P2) reaproveita os MESMOS carregadores de página inteira que as 4
  vitrines de domínio da visão geral usam (`loadEducationPageCached`, `loadSecurityPageCached`,
  `loadInfrastructurePageCached`, `loadWellbeingPageCached`) — 4 cargas de página completa só para extrair
  até 1-2 KPIs do cabeçalho de descoberta, e essa chamada acontece ANTES do `<main>` poder começar a
  responder (não está atrás de nenhum `Suspense`). Esse é exatamente o "custo escondido" que o próprio
  plano original de P14 já havia identificado e decidido não resolver imediatamente.
- **Decisão**: não implementada uma correção agora. Mover `loadMunicipalityDiscoveries` para trás de um
  `Suspense` próprio exigiria reestruturar como o `TerritoryHero` recebe a descoberta (hoje é uma prop
  síncrona, calculada antes do hero renderizar) — um risco real para um componente que é o centro de todo
  o trabalho visual de P8.1/P8.2, numa fase que o mandato pede para ser de baixo risco. Construir
  carregadores leves dedicados (em vez de reaproveitar as páginas inteiras) resolveria a causa raiz, mas é
  um trabalho de engenharia de backend de leitura, do porte de uma sub-fase própria, não um ajuste de
  "fechamento". Registrado como recomendação futura concreta, com a causa já localizada — não um "LCP alto,
  investigar depois" genérico.
- **Visão estadual**: Render Delay dominou (81% numa medição), não TTFB — inconsistente com o padrão
  municipal, reforçando que uma única medição por rota não é confiável o bastante para apontar uma causa
  única (o próprio Lighthouse usa throttling simulado, que amplifica diferenças de cache entre execuções).
  CLS seguiu em 0 e TBT dentro da referência em ambas as rotas, nas 2 fases em que foram medidos (P8.6 e
  aqui) — não houve piora.
- Em conformidade com o mandato: **nenhuma métrica de campo (RUM) existe neste produto** — desempenho de
  campo continua `NOT_EVALUATED`, nunca apresentado como dado real de usuário.

## Verificação agregada de P8.7

- Cada bloco: `NEXT_DIST_DIR` isolado, typecheck limpo, build de produção isolado, servidor isolado (portas
  3175–3179), porta 3000 do usuário confirmada intacta antes/depois de cada bloco.
- e2e: 68/68 (suíte territorial completa) repetida depois de cada bloco de mudança (A, B, C) — nenhuma
  regressão encontrada em nenhuma rodada.
- axe-core: rodado pela primeira vez no programa inteiro, 2 violações reais corrigidas, 1 investigada e
  corretamente não corrigida com justificativa WCAG precisa.
- Nenhuma migration, mudança de schema, alteração de collector ou interrupção de processo em execução —
  confirmado por `git diff --stat` vazio contra `packages/db`/`scripts/collect`/`scripts/exec` em todos os
  commits desta fase.
