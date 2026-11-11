# J4 — Portal de temas

Reconstrução de `apps/web/app/judiciario/temas/page.tsx`.

## O que mudou

- **Hero** com `/judiciario-temas.svg` (balança, mesma técnica de J1/J3), título e subtítulo exatos do mock.
- **Layout de 2 colunas**: sidebar de navegação (Visão geral + os 6 temas reais) + coluna principal — como no mock, mas a navegação por tema continua levando à página dedicada (`/judiciario/temas/[tema]`, já madura, com série histórica, comparador por tribunal e metodologia) em vez de duplicar aquele conteúdo dentro do hub.
- **"Visão geral dos temas"**: substitui o donut do mock (inviável — ver `J0_AUDITORIA_E_CONTRATOS.md` §4.1) por uma grade de 6 cartões independentes, cada um com o nome do indicador principal DAQUELE tema explícito junto do valor — nunca uma fatia de um total compartilhado. Acompanhado de um card "Sobre os dados" que explica, em linguagem direta, por que os temas não são somáveis.
- **"Temas em destaque"**: 3 cartões editoriais (Execução fiscal, Violência doméstica, Conciliação — escolhidos para mostrar a variedade real de métricas: um volume grande, um indicador de impacto social, um índice/taxa), cada um com ícone, estatística real e link.
- **Preservado sem alteração de conteúdo**: a grade completa dos 6 temas reais (`Todos os temas`) e a seção "Temas em investigação" para os documentais sem indicador elegível.

## Achado real durante a implementação

Nenhum achado de integridade novo — o achado estrutural relevante (donut inviável) já tinha sido identificado e decidido em J0; esta fase só implementou a decisão. Um achado menor: a página de tema individual (`/judiciario/temas/conciliacao`) já mostrava "—" para o índice geral de conciliação mesmo antes desta fase (o indicador existe no catálogo mas sem valor publicado nesta revisão) — comportamento preservado honestamente na nova grade "Visão geral dos temas".

## Verificação

- Typecheck limpo.
- Capturas reais desktop/mobile (`artifacts/j0-judiciario-redesign/j4-*.png`) — sem overflow, sem erro de console.
- Suíte e2e completa: **52/52 passando** — 1 assertion do `p148-judiciario.spec.ts` ajustada (contava `a[href^="/judiciario/temas/"]` esperando exatamente 6; a nova composição tem várias vias de navegação para os mesmos 6 temas — sidebar, visão geral, destaque, grade completa — então o teste agora conta **temas únicos**, que é o invariante que realmente importa, não o número de elementos `<a>`).
