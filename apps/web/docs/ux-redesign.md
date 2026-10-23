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
- [x] 3.3 Rótulos do crachá em linguagem simples (perfil); home e demais KPIs pendentes
- [ ] 3.4 Revisão com leigo
### Fase 2 — crachá
- [x] 2.1 `components/cracha-hero.tsx` (pílulas de carreira e de honestidade)
- [x] 2.2 `KpiStripCracha`
- [x] 2.3 "Em resumo, em {ano}": `lib/person-themes.ts` + `components/person-themes.tsx` (temas atribuídos pela Casa, barras tocáveis → `/legislativo/proposicoes/explorar?autor=&tema=`, cobertura "N de M têm tema", temas frequentes sem proposta). Falta: linha de votos/partido (a fonte não publica orientação) e filtro de votos por tema
- [ ] 2.4 Abas client-side com `?secao=`
- [ ] 2.5 Aceite mobile
### Fase 1 — busca
- [x] 1.1 `components/global-search.tsx` (`/` ou ⌘K, `<dialog>`, combobox/listbox) + `app/api/busca/route.ts` (2 SELECTs com LIMIT, sem facetas)
- [x] 1.2 Header com campo de busca (ícone no mobile)
- [x] 1.3 Home "Quem representa você?" com busca e "ver por estado"
- [x] 1.4 E2E `tests/e2e/ux-busca.spec.ts` ("/" → "Beto" → Enter → perfil)
### Fase 4 — drilldowns
- [ ] 4.1–4.4
### Fase 5 — IA/navegação
- [x] 5.1 Header: Início · Parlamentares · Estados · Partidos · Investigar · Sobre ("Assuntos" → "Partidos"; "Legislativo" segue acessível por "Explorar")
- [x] 5.2 `/investigar` (7 ferramentas, nenhuma rota removida)
- [~] 5.3 `components/breadcrumb.tsx` criado e usado em `/investigar`; falta aplicar nas rotas profundas
### Fase 6 — polimento
- [ ] 6.1–6.6

## Log
- Fase 0/3/2.1/2.2: ver commits.
- Validação: servidor de dev isolado (`NEXT_DIST_DIR=.next-ux`, porta 3105) para não tocar o `.next` do servidor em uso. Typecheck (web + testes) limpo; E2E de busca/crachá 4/4.
- Não feito ainda: 2.3 (temas clicáveis), 2.4 (abas client-side — hoje são 4 rotas com gating CSS, intocado de propósito), Fase 4, 5.3 nas rotas profundas, Fase 6, 3.3 fora do crachá/home.
