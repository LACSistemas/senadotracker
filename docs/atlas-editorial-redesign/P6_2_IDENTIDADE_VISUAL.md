# P6.2 — Refinamento premium: identidade visual temática + Atlas Vivo

Segunda metade da FASE P6 do mandato "Cívica — Atlas Editorial Investigativo". Executada como um único
agente (sem subagentes), por isso o escopo foi triado deliberadamente: priorizei os dois objetivos que
dava para entregar com qualidade real e verificação completa (identidade visual por tema + refinamento do
Atlas Vivo) e **não tentei** o Objetivo 2 (composição assimétrica das visões gerais) nesta passada — ver
seção "O que ficou de fora" abaixo. Prefiro reportar menos escopo com evidência sólida do que mais escopo
sem verificação real.

## Objetivo 1 — Identidade visual própria por tema (Parte VIII.14 do mandato)

### A ideia

Até P5, os 5 temas compartilhavam toda a infraestrutura visual (sidebar, hero, `IndicatorLive`) mas eram
visualmente indistinguíveis entre si — exatamente a ressalva que fechou o `P5_REDESENHO_TEMATICO.md`.
Em vez de reescrever a composição interna de cada tema (caro, arriscado, repetiria o trabalho de P5), dei
a cada tema uma assinatura visual através de DOIS pontos de alavancagem já compartilhados por todos:

1. **`ChapterNav`** (`components/security/chapter-nav.tsx`): nova prop opcional `accent?: MapRampName`
   (mesmo tipo `teal|blue|amber|rose|violet|cyan` do Atlas Vivo, P3) — tinge o estado ativo da navegação
   (pílula preenchida no modo inline, borda+texto no modo sidebar) com a cor do tema. Sem `accent`, o
   padrão é `teal` = `var(--primary)` = o mesmo verde institucional hardcoded que já existia — **zero
   mudança visual para quem não passa a prop**.
2. **`ChapterShell`** (`components/security/security-ui.tsx`): mesma prop `accent`, usada para (a) um
   **numeral de capítulo grande e discreto** (`01`, `02`...), recurso editorial clássico de revista —
   novo para o produto inteiro, `aria-hidden` (decorativo; o `<Eyebrow>Capítulo N</Eyebrow>` continua
   sendo o texto acessível) e escondido abaixo de `sm` para não arriscar overflow em mobile; e (b) uma
   régua de 3px no topo do cartão do capítulo, na mesma cor. Sem `accent`, nada aparece — comportamento
   idêntico ao de antes.

Isso **não é só trocar cor**: o numeral de capítulo é uma mudança estrutural real (editorial, não
dashboard) que beneficia os 4 temas que usam `ChapterShell` ao mesmo tempo, e a cor dá a cada tema uma
identidade reconhecível na navegação e nos cartões — sem duplicar nenhum componente nem reescrever lógica
de dado.

### A cor de cada tema — não arbitrária

Reaproveitei as famílias de rampa que a P3 já validou (skill `dataviz`) e já usa no Atlas Vivo, por
domínio:

| Tema | `accent` | Por quê |
|---|---|---|
| Educação | `teal` (= verde institucional) | Fica como "bandeira" visual do produto — é o tema mais antigo e mais grande (11 capítulos); manter o verde reforça que é o núcleo, e o numeral editorial já é uma mudança real por si só |
| Segurança | `blue` | Azul analítico — serve exatamente ao requisito do próprio mandato de evitar estética de alarme |
| Bem-estar | `violet` | Já é a cor usada pelo indicador "Renda domiciliar" no Atlas Vivo (domínio Bem-estar) — consistência entre as duas telas |
| Infraestrutura | `cyan` | Já é a cor usada pelo indicador "Esgotamento sanitário" no Atlas Vivo (domínio Infraestrutura) — mesma lógica |
| Saúde | `amber` | Não usa `ChapterShell` (estrutura própria desde sempre — P5.1 preservou isso); só a navegação (`ChapterNav`) recebeu a cor. Âmbar casa com a linguagem "humana e tranquila" que o mandato pede para este tema, e evita repetir o azul já usado por Segurança |

### Bem-estar — reforço visual específico da distinção fluxo×estoque

Além da cor, no capítulo "Trabalho" os dois gráficos (CAGED mensal, RAIS anual) ganharam um selo visual
direto no título — "Fluxo · mês a mês" (contorno) vs. "Estoque · foto do ano" (preenchido) — reforçando na
composição, não só no texto corrido, a distinção que é o coração deste tema (Parte VIII.18 do mandato).

### Infraestrutura — destaque real para a seção financeira de obras

A Parte XII do mandato pede que a seção de obras seja "especialmente investigativa". O bloco de 5 estágios
financeiros (previsto/contratado/empenhado/liquidado/pago), que P5.5 já tinha construído, ganhou um
tratamento de destaque: borda esquerda grossa + fundo lavado na cor do tema (ciano), com um eyebrow
próprio ("Linha do dinheiro") — fica visualmente destacado dentro do capítulo de Obras, não mais um bloco
igual aos outros.

## Objetivo 3 — Refinamento do Atlas Vivo (P3)

P3 tinha documentado 2 pendências reais: **sem estado de zoom/pan na URL** e **sem clamping dos limites do
pan**. Resolvi as duas:

- **Zoom/pan compartilháveis por URL** (`?zoom=&x=&y=`): gravados com debounce de 400ms (arrastar ou girar
  a roda do mouse não deveria escrever no histórico a cada frame). Lidos pela página (`app/estados/[uf]/
  atlas/page.tsx`) e passados como `initialScale`/`initialTx`/`initialTy` — só quando os 3 vêm juntos e são
  números finitos, senão o Atlas Vivo abre no padrão de sempre. Quando um link compartilhado já tem zoom/pan
  explícito, o efeito de auto-foco no município selecionado (que existia desde P3) é pulado — para não
  brigar com o enquadramento que a pessoa que compartilhou o link escolheu.
- **Clamping do pan**: novo `clampPan(nx, ny, s)` usa o tamanho real do palco renderizado para impedir que
  o conteúdo seja arrastado para fora da tela — aplicado em TODOS os pontos que movem o mapa (zoom
  centrado, arraste por ponteiro, setas do teclado, recentralização ao selecionar um município).

### Verificado de verdade, não só por inspeção visual

Rodei um script Playwright ad hoc (apagado ao final — não é ferramenta permanente) que: apertou `+` 4x
pelo teclado e confirmou a URL grava `?zoom=2.44&x=-623&y=-454` com o `transform` CSS batendo exatamente;
arrastou o mapa ao extremo (80 toques de seta) e confirmou que o `transform` fica **contido** (não escapa
para um valor absurdo) e que a página continua com **0px de overflow**; recarregou a própria URL
compartilhada e confirmou que o mapa abre **exatamente no mesmo enquadramento** salvo; e confirmou que
clicar num município (via disparo de evento, não via posição de pixel — ver nota abaixo) ainda abre a
pré-visualização com o comparador de pares da P4 funcionando (`"Angra dos Reis em 2026: 179.152 hab. —
acima da faixa central"`).

**Nota honesta, não uma regressão desta fase**: um teste inicial que tentou clicar num município pela
posição do pixel (centro do bounding box do link) falhou — não porque a seleção quebrou, mas porque
municípios têm polígonos côncavos/irregulares cujo centro geométrico frequentemente cai fora do próprio
preenchimento (o SVG recebe o clique nessa posição, não o `<path>`). Isso é uma característica
pré-existente da malha desenhada à mão (não tocada por mim) — não é uma regressão desta sub-fase, mas é um
achado real de usabilidade (alvo de clique menor que o esperado em municípios de forma irregular), digno
de nota para uma iteração futura de acessibilidade/usabilidade do Atlas Vivo.

## O que ficou de fora (honesto, não escondido)

**Objetivo 2 do directive — composição assimétrica real das visões gerais (estado/município)** não foi
tentado nesta sub-fase. Motivo: é o item de maior risco (tocar a composição inteira de 2 páginas já
verificadas em P2/P3, sem rede de segurança de um segundo agente revisando) e o de maior custo de tempo
dentro do orçamento de uma única execução sem subagentes. A ressalva que `P2_PILOTO_MUNICIPAL.md` e
`P3_ATLAS_VIVO.md` já registraram continua válida: a visão geral do estado ainda é majoritariamente pilha
convencional fora do mapa. Fica como o item mais concreto para uma eventual P6.3 ou revisão futura.

## Verificação

- `NEXT_DIST_DIR=.next-p62check npm run typecheck` (raiz, todas as workspaces + `tsconfig.tests.json`):
  limpo para tudo deste redesign; restam só os 2 arquivos pré-existentes de outro workstream
  (`educacao-p113/p114.test.ts`) já documentados em P6.1 — confirmados não tocados por mim.
- Build de produção isolado (`next build`) — sucesso.
- Servidor isolado (`next start -p 3163`, nunca a porta 3000 do usuário — confirmada respondendo
  normalmente antes/depois) + suíte e2e completa: `p14-territorio-executivo.spec.ts` +
  `infraestrutura-p137.spec.ts` (30/30) + `wellbeing-p128.spec.ts` + `seguranca-p98.spec.ts` —
  **67/68 na primeira passada, 68/68 confirmando o único caso (São Paulo, timeout de navegação) como o
  mesmo flake de paralelismo pesado já documentado em P6.1** (reproduzido isolado: passa em 4.4s).
- axe-core (mesmo mecanismo de P1/P3/P6.1) contra `/estados/ES`, 1280/390px: **as mesmas 2 violações
  pré-existentes (`region`, `skip-link`) — 0 novas.**
- 40 screenshots reais em `artifacts/p6-2-identidade/` (8 rotas × 5 larguras: visão geral + 5 temas do
  estado ES + visão geral do município + Atlas Vivo do RJ) — **39/40 com 0px de overflow**; a única
  exceção (`estado-es-infraestrutura` em 320px, 7px) é o mesmo resíduo que P6.1 já diagnosticou
  exaustivamente sem achar uma causa única — não piorou, não é novo.
- 2 screenshots revisados visualmente por mim (não só pelo meu próprio relato): `estado-es-seguranca` (numerais
  e régua azuis visíveis em cada capítulo, navegação lateral destacada) e `atlas-rj` (zoom/pan e pré-visualização
  intactos).

## Autoavaliação honesta contra o critério G1 do mandato

> "Qualidade editorial superior, identidade reconhecível, forte hierarquia, mapas/visualizações
> protagonistas — não aceitar um dashboard genérico com novos estilos."

**Parcialmente atingido, não integralmente.** Pontos a favor: os 5 temas agora têm identidade cromática
reconhecível e um dispositivo editorial real (numeral de capítulo) que nenhum dashboard administrativo
usaria; o Atlas Vivo (já forte desde P3) ficou mais completo e compartilhável; Bem-estar e Infraestrutura
ganharam destaque de composição nos pontos mais importantes de cada tema (fluxo×estoque; estágios
financeiros). Honestamente, isso ainda não é uma reformulação de hierarquia/ritmo/composição por tema no
sentido mais ambicioso do mandato — a estrutura visual de "capítulo = cartão com cabeçalho e corpo" continua
a mesma nos 4 temas que usam `ChapterShell`; o que mudou foi a cor de assinatura, o numeral editorial e 2
destaques pontuais, não uma composição inteiramente nova por tema. Isso é consistente com o padrão
"seguro mas seletivamente ousado" que caracterizou as fases anteriores — não inflo o status para parecer
mais do que entreguei.

## Status do Gate P6.2

**`PASS_WITH_CAVEATS`.**

Cumprido com evidência real: 5 temas com identidade visual própria e verificável (não "mudei a cor e
chamei de pronto" — inclui um dispositivo editorial novo e 2 reforços de composição específicos de tema);
Atlas Vivo com as 2 pendências reais de P3 resolvidas e testadas por script, não só observadas; typecheck
limpo, 68/68 e2e, 0 violações novas de acessibilidade, 39/40 screenshots sem overflow.

Ressalvas:
1. Objetivo 2 (composição assimétrica das visões gerais) não foi tentado — deferido explicitamente, não
   uma lacuna escondida.
2. A identidade por tema é cor + numeral + 2 destaques pontuais, não uma reformulação de composição mais
   profunda por tema — avaliação honesta no G1 acima.
3. Achado de usabilidade do Atlas Vivo (alvo de clique menor que o esperado em municípios de forma
   irregular) registrado, não corrigido — pré-existente, fora do escopo desta sub-fase.

Nenhum impedimento bloqueia o encerramento da Fase P6 ou o início da Fase P7 (QA, acessibilidade e
regressão) — mas o item 1 acima é a recomendação mais concreta para quem decidir investir mais tempo de
polimento visual antes de seguir.
