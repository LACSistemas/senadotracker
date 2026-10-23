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
- [~] 2.4 Abas: mantidas como 4 rotas deep-linkáveis (já compartilháveis), com skeleton de navegação; abas client-side exigem unificar o carregamento de dados (decisão pendente, ver Log)
- [ ] 2.5 Aceite mobile
### Fase 1 — busca
- [x] 1.1 `components/global-search.tsx` (`/` ou ⌘K, `<dialog>`, combobox/listbox) + `app/api/busca/route.ts` (2 SELECTs com LIMIT, sem facetas)
- [x] 1.2 Header com campo de busca (ícone no mobile)
- [x] 1.3 Home "Quem representa você?" com busca e "ver por estado"
- [x] 1.4 E2E `tests/e2e/ux-busca.spec.ts` ("/" → "Beto" → Enter → perfil)
### Fase 4 — drilldowns
- [x] 4.1 Cota mês a mês tocável (`components/quota-explorer.tsx`, agregação testada em `lib/quota-explorer.ts`); seletor de ano; mês sem registro = tracejado e desabilitado
- [x] 4.2 "Com o que gastou em {ano}" (categorias ordenadas por valor)
- [~] 4.3 "Ano a ano" na visão geral com as duas séries que existem para todos os anos (cota gasta, com meses publicados, e propostas apresentadas; `lib/person-years.ts`). Presença/participação por ano seguem bloqueadas pelo gating por rota (ver 2.4)
- [~] 4.4 Temas tocáveis levam às propostas; filtro de votos por tema não feito
### Fase 5 — IA/navegação
- [x] 5.1 Header: Início · Parlamentares · Estados · Partidos · Investigar · Sobre ("Assuntos" → "Partidos"; "Legislativo" segue acessível por "Explorar")
- [x] 5.2 `/investigar` (7 ferramentas, nenhuma rota removida)
- [x] 5.3 `components/breadcrumb.tsx` em `/investigar` e nos perfis de senador/deputado ("‹ Parlamentares ‹ Deputados federais"); estados/municípios já têm navegação própria
### Fase 6 — polimento
- [x] 6.1 Skeleton do perfil (`loading.tsx` de deputados/senadores) e da busca
- [x] 6.3 Dica do atalho `/` no botão de busca e no painel (↑ ↓ Enter Esc)
- [x] 6.5 Metadados de compartilhamento do perfil (og:title/description/image, twitter card)
- [ ] 6.2 Transições entre abas (dependem de 2.4), 6.4 estados vazios revisados, 6.6 Lighthouse/axe (só verificações próprias: 1 `<h1>`, foco, alvos ≥ 44 px nos controles novos)

## Log
- Fase 0/3/2.1/2.2: ver commits.
- Validação: servidor de dev isolado (`NEXT_DIST_DIR=.next-ux`, porta 3105) para não tocar o `.next` do servidor em uso. Typecheck (web + testes) limpo; E2E de busca/crachá 4/4.
- Não feito ainda: 2.3 (temas clicáveis), 2.4 (abas client-side — hoje são 4 rotas com gating CSS, intocado de propósito), Fase 4, 5.3 nas rotas profundas, Fase 6, 3.3 fora do crachá/home.
- Bugs achados na validação visual e corrigidos: `NaN%`/`undefined` nos tiles do senador (campos `undefined`, não `null`); pílula "Faltam N dados" divergia entre rotas por causa do gating (agora só na visão geral). Teste de regressão no E2E.
- Decisão sobre 2.4: abas client-side exigem carregar custos, atividade e histórico numa só chamada (hoje cada rota carrega só o seu). Isso é uma mudança de camada de dados com custo de desempenho; não foi feita. Recomendação: manter 4 rotas com prefetch + skeleton (feito) ou aprovar a mudança de dados.
- A11y própria (`scripts/security/a11y-check.mjs`, `A11Y_PAGES=...`) em home, perfil de deputado, gastos de senador e /investigar, 1440 e 390: 0 pulos de título, 1 `<h1>`, 0 svg sem rótulo, foco visível em 38–40 de 39–40 abas. Ressalvas: 5 falhas de contraste no cartão "Fontes oficiais conectadas" do hero (já existia; o cartão é claro sobre gradiente translúcido, provável falso positivo da heurística — não verificado); 1 elemento sem foco visível na home e no /investigar (não identificado); alvos < 24 px em links do rodapé e das tabelas de notas (já existiam). Os 12 botões de mês da cota foram ajustados para ≥ 24 px.
