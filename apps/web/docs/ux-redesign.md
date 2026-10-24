# Redesign de UX da Cívica (branch `claude/civica-ux-redesign-ju8tu0`)

Norte: politicometro.org. Princípio: divulgação progressiva — resposta em 10 s na primeira dobra, profundidade a um toque; precisão sempre, jargão nunca na superfície.

## Invariantes (não quebrar)
- Nunca inventar número; `—` = não publicado (nunca 0). Sem interpolar séries.
- Manter notas de cobertura, réguas de benchmark, `OfficialSourcesCard`, links de fonte e SHA-256.
- Um `<h1>` por rota, `.focus-ring`, `aria-current`, alvos ≥ 44 px, `prefers-reduced-motion`.
- Cores/tipografia só dos tokens de `globals.css`; gráfico novo → skill `dataviz`.
- Zero dependências novas; sem libs de animação.
- `npm run typecheck` e `npm test` a cada fase.

## Decisões
- O crachá reaproveita **os mesmos valores já calculados** em `parliamentarian-profile-page.tsx` (nenhum cálculo novo de custo). Os tiles só mudam o texto visível e a embalagem; a régua de benchmark e a cobertura ficam no segundo nível (`<details>`/popover do tile).
- Traduções vivem em `lib/glossario.ts`; o termo oficial continua acessível em `TermoExplicado`.
- O gating por seção do perfil (`data-profile-section` + CSS) é preservado até a Fase 2.4, que o substitui por abas client-side com `?secao=` — só depois de garantir que nenhum número muda.

## Checklist
### Fase 0
- [x] Branch criada a partir de `post-migration`
- [x] Este documento
### Fase 3 — linguagem simples
- [x] 3.1 `lib/glossario.ts`
- [x] 3.2 `components/termo-explicado.tsx`
- [x] 3.3 Rótulos em linguagem simples no crachá e nas seções de custos/participação/produção do perfil; home (texto de apoio) feito; páginas de Casa/ranking e a frase-síntese de `lib/lede.ts` (coberta por testes) pendentes
- [ ] 3.4 Revisão com leigo
### Fase 2 — crachá
- [x] 2.1 `components/cracha-hero.tsx` (pílulas de carreira e de honestidade)
- [x] 2.2 `KpiStripCracha`
- [x] 2.3 "Em resumo, em {ano}": `lib/person-themes.ts` + `components/person-themes.tsx` (temas atribuídos pela Casa, barras tocáveis → `/legislativo/proposicoes/explorar?autor=&tema=`, cobertura "N de M têm tema", temas frequentes sem proposta). Falta: linha de votos/partido (a fonte não publica orientação) e filtro de votos por tema
- [x] 2.4 Abas client-side: `components/profile-tabs-shell.tsx` (troca por `data-profile-section`, `history.pushState` para a URL da aba, Voltar, links internos e tiles interceptados, fallback sem JS pela rota). Dados unificados: `profileFull(..., 'all')` carrega de uma vez o que cada rota carregava. Comparação de texto visível antes × depois (3 parlamentares × 4 abas): visão geral idêntica; as outras abas só ganharam a pílula 'Faltam N dados' e, em Atuação, a série de cota no histórico
- [x] 2.5 Mobile 390: nome, status, pílulas e os 3 números-chave (custo/mês, participação, propostas) na primeira tela (`QuickFacts`, só <md, decorativo; os tiles completos vêm logo abaixo). O cartão de fontes oficiais segue no hero
### Fase 1 — busca
- [x] 1.1 `components/global-search.tsx` (`/` ou ⌘K, `<dialog>`, combobox/listbox) + `app/api/busca/route.ts` (2 SELECTs com LIMIT, sem facetas)
- [x] 1.2 Header com campo de busca (ícone no mobile)
- [x] 1.3 Home "Quem representa você?" com busca e "ver por estado"
- [x] 1.4 E2E `tests/e2e/ux-busca.spec.ts` ("/" → "Beto" → Enter → perfil)
### Fase 4 — drilldowns
- [x] 4.1 Cota mês a mês tocável (`components/quota-explorer.tsx`, agregação testada em `lib/quota-explorer.ts`); seletor de ano; mês sem registro = tracejado e desabilitado
- [x] 4.2 "Com o que gastou em {ano}" (categorias ordenadas por valor)
- [x] 4.3 "Ano a ano" na visão geral com as duas séries que existem para todos os anos (cota gasta, com meses publicados, e propostas apresentadas; `lib/person-years.ts`). Presença/participação por ano seguem bloqueadas pelo gating por rota (ver 2.4)
- [~] 4.4 Temas tocáveis levam às propostas; filtro de votos por tema não feito
### Fase 5 — IA/navegação
- [x] 5.1 Header: Início · Parlamentares · Estados · Partidos · Investigar · Sobre ("Assuntos" → "Partidos"; "Legislativo" segue acessível por "Explorar")
- [x] 5.2 `/investigar` (7 ferramentas, nenhuma rota removida)
- [x] 5.3 `components/breadcrumb.tsx` em `/investigar` e nos perfis de senador/deputado ("‹ Parlamentares ‹ Deputados federais"); estados/municípios já têm navegação própria
### Fase 6 — polimento
- [x] 6.1 Skeleton do perfil (`loading.tsx` de deputados/senadores) e da busca
- [x] 6.3 Dica do atalho `/` no botão de busca e no painel (↑ ↓ Enter Esc)
- [x] 6.5 Metadados de compartilhamento do perfil (og:title/description/image, twitter card)
- [x] 6.6 Lighthouse real (v. do `npx`, instalado em D:\Civica	ools11y) no build de produção, emulação móvel: acessibilidade 100, boas práticas 100, SEO 100 na home e 91–92 nos perfis (falha única: `canonical` relativo — resolve definindo `NEXT_PUBLIC_SITE_URL`, que agora vira `metadataBase`), desempenho 90–93 (LCP 2,9–3,2 s, TBT 40–190 ms, CLS 0). axe-core: 0 violações nas 9 páginas × 2 larguras após as correções
- [x] 6.2 Transição entre abas só com CSS (`tab-in`, reinicia quando a seção passa de `display:none` a visível; só depois da 1ª troca; desligada com `prefers-reduced-motion`)
- [x] 6.4 `EmptyState` com três tons inferidos do título (indisponível = "não conseguimos carregar agora, isso não quer dizer que não existam"; não encontrado; vazio), `role=alert/status`, `h1` + saídas (início, parlamentares) nas 23 páginas inteiras, e `id="conteudo"` no `<main>` dessas páginas (o link "Pular para o conteúdo" não tinha alvo)
- [x] 3.3 (restante) Textos das páginas de Casa (`parliamentary-house-page`), `/legislativo` e rankings: "identificado/universo nominal/lote" → linguagem simples; o termo oficial continua nos detalhes

## Log
- Fase 0/3/2.1/2.2: ver commits.
- Validação: servidor de dev isolado (`NEXT_DIST_DIR=.next-ux`, porta 3105) para não tocar o `.next` do servidor em uso. Typecheck (web + testes) limpo; E2E de busca/crachá 4/4.
- Não feito ainda: 2.3 (temas clicáveis), 2.4 (abas client-side — hoje são 4 rotas com gating CSS, intocado de propósito), Fase 4, 5.3 nas rotas profundas, Fase 6, 3.3 fora do crachá/home.
- Bugs achados na validação visual e corrigidos: `NaN%`/`undefined` nos tiles do senador (campos `undefined`, não `null`); pílula "Faltam N dados" divergia entre rotas por causa do gating (agora só na visão geral). Teste de regressão no E2E.
- Decisão sobre 2.4: abas client-side exigem carregar custos, atividade e histórico numa só chamada (hoje cada rota carrega só o seu). Isso é uma mudança de camada de dados com custo de desempenho; não foi feita. Recomendação: manter 4 rotas com prefetch + skeleton (feito) ou aprovar a mudança de dados.
- A11y própria (`scripts/security/a11y-check.mjs`, `A11Y_PAGES=...`) em home, perfil de deputado, gastos de senador e /investigar, 1440 e 390: 0 pulos de título, 1 `<h1>`, 0 svg sem rótulo, foco visível em 38–40 de 39–40 abas. Ressalvas: 5 falhas de contraste no cartão "Fontes oficiais conectadas" do hero (já existia; o cartão é claro sobre gradiente translúcido, provável falso positivo da heurística — não verificado); 1 elemento sem foco visível na home e no /investigar (não identificado); alvos < 24 px em links do rodapé e das tabelas de notas (já existiam). Os 12 botões de mês da cota foram ajustados para ≥ 24 px.
- Corrigido o achado antigo: o bloco "Como isso mudou ao longo do tempo" saiu da aba Carreira (onde sempre dizia "Indisponível") e passou para a aba Atuação, mostrando só as séries que a rota carrega (presença e participação). A série de cota anual não aparece ali; o "Ano a ano" da visão geral cobre cota e propostas.
- Aprovado e feito 2.4. Medição (dev, 3 perfis × 4 abas): 1–6 s por rota antes, 1,9–3,8 s depois (dev não é produção; sem medição de build). Achado cosmético existente: o gráfico de linha da cota mostra eixo com valores negativos (ex.: -58,4 mil) mesmo sem gasto negativo — vem do `LineChart`, não alterado.
- Pedido do usuário (visão geral): (1) "Quanto custa por mês" = custo identificado no ano ÷ meses publicados (mesmo total do tile anual, sem segundo método); o comparativo com a Casa (régua) continua usando só os meses com as três parcelas e agora diz isso na legenda — por isso o número do perfil pode diferir do dos rankings. (2) Corrigido o bug que deixava a participação do senador `undefined`/NaN: o Senado devolvia um mapa por parlamentar e o perfil tratava como a métrica; agora o senador tem participação real (ex.: 94,7%, 18 de 19). (3) O tile "Votos na última eleição" foi trocado por "Pessoas na equipe" (vínculos de gabinete). (4) Presença no Plenário não existe para o Senado (só há frequência da Câmara); no Senado esse tile vira "Propostas ligadas a leis".
- Presença (pedido do usuário): na aba Atuação, para deputados, o gráfico de evolução foi trocado por `components/presence-calendar.tsx` — calendário por mês (colunas = dias da semana, só dias de sessão viram quadrado), seletor de ano com % oficial, total oficial (ex.: 119 de 121), contagem por status, detalhe do dia (mouse, foco, toque, setas do teclado), tabela equivalente. Dados: `official_presence.days_json` (`lib/person-presence.ts`). Cores: tokens `--group-1/2/3/5`, ordem validada com `validate_palette.js` (ΔE CVD 13,6, contraste ≥ 3:1); ausência = quadrado vazado com ×, presença com (~) = hachurada. Senado mantém a evolução (sem frequência por dia na base).
- Filtro de votos por tema (`?votoTema=`, `lib/person-vote-themes.ts`, `components/vote-theme-filter.tsx`): filtra a lista e a paginação no SQL. Cobertura baixa por natureza (ex.: 12 de 3.422 votações do deputado 121948 têm tema no catálogo) e a interface diz isso.
- axe-core real (instalado fora do repositório em `D:\Civica	ools11y`, `scripts/ux/axe-run.mjs`, `AXE_PATH`): 1ª rodada achou contraste 4,46 do `--muted-foreground`, regiões roláveis sem foco, `nav` de paginação duplicado e nome acessível dos botões de mês. Corrigido: `--muted-foreground` #60706a → #586862 (≥ 4,5:1 sobre as superfícies do site), `tabIndex`/`role=region`/rótulo único nas regiões roláveis (gráficos, tabelas), rótulo da paginação inclui a legenda da tabela, botões de mês começam pelo texto visível.
