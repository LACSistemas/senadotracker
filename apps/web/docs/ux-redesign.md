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
- [ ] 2.3 "Em resumo, em {ano}" (temas clicáveis)
- [ ] 2.4 Abas client-side com `?secao=`
- [ ] 2.5 Aceite mobile
### Fase 1 — busca
- [ ] 1.1 Command palette + `/api/busca`
- [ ] 1.2 Header com campo de busca
- [ ] 1.3 Home "Quem representa você?"
### Fase 4 — drilldowns
- [ ] 4.1–4.4
### Fase 5 — IA/navegação
- [ ] 5.1 Rótulos do header (feito em parte: ver log)
- [ ] 5.2 `/investigar`
- [ ] 5.3 Breadcrumb
### Fase 6 — polimento
- [ ] 6.1–6.6

## Log
- Fase 0/3/2.1/2.2: ver commits.
