# P6.2 — Refinamento premium: diferenciação visual e polimento

Segunda metade da FASE P6. P6.1 corrigiu bugs concretos de sistema compartilhado (overflow, rótulo
duplicado, links ambíguos, paleta, motion, foco); esta sub-fase cobre os itens do Gate P6 do mandato que
dependem de julgamento visual direto, não de verificação automatizada.

## 1 arquivo tocado, mudança concreta: visão geral estadual deixa de repetir o mesmo bloco 5x

P0 documentou o "esqueleto visual dominante" (eyebrow→título→KPIs→CTA repetido) como o problema central a
romper. P2 resolveu isso na visão geral MUNICIPAL (pares assimétricos: Educação+Segurança, Bem-estar+
Infraestrutura, Executivo+IDHM) — mas, por decisão explícita de escopo da própria P2 ("`/estados/[uf]`
não foi tocado"), a visão geral ESTADUAL continuou com os 6 blocos de teaser (Educação, Segurança,
Bem-estar, Infraestrutura, Executivo, IDHM) empilhados 100% da largura, um por um — P3 confirmou isso
como pendência explícita ao fechar seu próprio trabalho.

Corrigido em `apps/web/app/estados/[uf]/page.tsx`: os 6 `<Suspense>` isolados viraram os mesmos 3 pares
que a visão geral municipal já usa (`grid grid-cols-1 lg:grid-cols-2 gap-6`, `min-w-0` em cada metade) —
mudança estritamente de composição, nenhum `*Summary` foi reescrito por dentro, 100% do dado/link
preservado. Nenhuma outra página foi tocada.

**Decisão explícita de não fazer nesta sub-fase**: estender o `DiscoveryPanel` (manchete editorial +
complementares, de P2) para o nível estadual. `territory-discoveries.ts` só tem
`loadMunicipalityDiscoveries` — construir o equivalente estadual é engenharia nova de verdade (nova
função de carregamento, não só composição), fora do escopo de "polimento" desta sub-fase. Registrado como
candidato real para uma fase futura, não escondido.

## Itens 1/2/4/5/6 (tipografia, espaçamento, composição de gráficos, navegação contextual, mobile/tablet) — auditados visualmente, nenhuma mudança adicional justificada

Capturados 21 screenshots reais (7 rotas: visão geral de estado e município + as 5 páginas de tema de
Espírito Santo × 3 larguras: 1440/768/390px) em `artifacts/p6-2-polimento/` e revisados diretamente (não
só pelo relatório de quem os gerou). Achados:

- **Tipografia**: hierarquia consistente nas 5 páginas de tema pós-P5 (título de capítulo em serifa,
  KPIs em `tabular-nums`, legendas em texto secundário) — nenhuma inconsistência real encontrada entre os
  temas que justificasse uma mudança agora. A pilha de fontes continua a decisão de P1 (Inter + serifa de
  sistema), não alterada.
- **Espaçamento**: o respiro ao redor da sidebar (`ChapterNav layout="sidebar"`, ativada em todos os 5
  temas por P5) é consistente entre os 5 — mesmo padrão `lg:grid lg:grid-cols-[220px_minmax(0,1fr)]
  lg:gap-10` reutilizado literalmente em todos, não uma reimplementação por tema.
- **Composição dos gráficos**: Segurança (que já tinha a composição mais rica, via `CrimeExplorer`) e
  Infraestrutura (obras, com os 5 estágios financeiros) mostram boa variedade visual (séries, barras,
  comparações lado a lado) — nenhum gráfico isolado pedindo refino urgente o suficiente para justificar
  mexer em `components/charts.tsx` nesta passada.
- **Navegação contextual**: `ThemeTabs` (pílulas de tema no topo) e `ChapterNav` (sidebar/pílulas de
  capítulo) continuam com destaque de item ativo funcionando corretamente nas 5 páginas de tema, inclusive
  depois da sidebar ter sido ativada em P5 e do `focus-ring` ter sido adicionado à pill list em P6.1 —
  confirmado visualmente, nenhuma regressão.
- **Mobile/tablet (768/390px)**: as 5 páginas de tema + as 2 visões gerais renderizam sem quebra visual
  nessas larguras — sidebar colapsa corretamente para faixa horizontal abaixo de 1024px (comportamento de
  P1/P5, confirmado ainda válido), pares da visão geral colapsam para 1 coluna.

**Por que não foi feita uma reescrita mais profunda de tipografia/composição por tema agora**: o mandato
pede identidade visual própria por tema (Parte VIII) como objetivo de LONGO prazo do programa, mas o Gate
P6 especificamente cobra "consistência sem parecer repetitiva" e "interações rápidas e previsíveis" — os
achados reais (não hipotéticos) desta auditoria mostram que isso já está presente hoje, pós-P5; forçar uma
reformulação tipográfica sem um defeito real identificado seria risco sem benefício demonstrado,
inconsistente com a disciplina do programa inteiro de só mudar o que uma evidência real pede.

## Item 7: Atlas Vivo — avaliado, não refinado nesta sub-fase

P3 auto-avaliou que, na visão geral do estado, o mapa "cresceu mas ainda divide a tela com uma sidebar —
não é protagonismo total ali" (decisão deliberada: a página inteira ficaria desproporcional se o mapa
tomasse 100% da largura ali, já que a visão geral tem outras ~10 seções abaixo). Reavaliado agora com a
visão geral já reorganizada em pares (item acima): a proporção mapa/sidebar (`grid-cols-[minmax(0,1fr)_17rem]`)
continua adequada ao papel da visão geral (prévia + link para o Atlas Vivo dedicado, que já é onde o
mandato pede protagonismo total — e que já tem isso, confirmado em P3). Nenhuma mudança real justificada
aqui; o Atlas Vivo dedicado (`/estados/[uf]/atlas`) não foi tocado nesta sub-fase.

## Verificação

- `npm run typecheck` (raiz completo): limpo para tudo deste redesign (restam só os 2 arquivos
  pré-existentes de outro workstream já documentados em P6.1, não deste redesign).
- Build de produção isolado + servidor isolado (porta 3163, nunca a 3000 do usuário — confirmado antes/
  depois).
- E2E: `p14-territorio-executivo.spec.ts` + `infraestrutura-p137.spec.ts` (30/30) + `wellbeing-p128.spec.ts`
  + `seguranca-p98.spec.ts` — **68/68 passando**, sem o flake de SP desta vez (rodado com `--workers=2`).
- 21 screenshots reais (7 rotas × 3 larguras) — **0px de overflow e 0 erros de console em todas as 21
  combinações** (o resíduo de 7px de Infraestrutura, documentado e não eliminado em P6.1, só se manifesta
  em 320px — não medido de novo aqui, não regrediu nas larguras testadas).
- axe-core: **não foi possível rodar nesta sub-fase** — a instalação externa (`D:\Civica\tools\a11y`,
  fora do repositório por design, ver `scripts/ux/axe-run.mjs`) não estava acessível no momento desta
  verificação (o mesmo caminho funcionou em P6.1, poucos minutos antes — provável desconexão temporária
  do drive externo, fora do meu controle). Registrado honestamente como `NOT_EVALUATED` para este ciclo,
  não inventado. Risco real considerado baixo: a única mudança de código desta sub-fase é um reflow de
  grid dentro do `<main>`, sem tocar landmarks, skip-link ou qualquer estrutura semântica — as 2 violações
  conhecidas (`region`/`skip-link`) são do header global, não relacionadas.

## Status do Gate P6 (consolidado P6.1 + P6.2)

**`PASS_WITH_CAVEATS`.**

Avaliado contra o critério literal do mandato ("a interface deve ser consistente sem parecer repetitiva;
as interações devem ser rápidas e previsíveis"): a visão geral estadual deixou de ser 6 blocos idênticos
empilhados (achado real de P0/P3, agora corrigido); as 5 páginas de tema têm navegação e hero consistentes
entre si (P5) sem perder a composição própria que cada uma já tinha; os bugs reais de overflow/
acessibilidade de teclado/rótulo duplicado/links ambíguos foram corrigidos com causa raiz (P6.1).

Ressalvas:
1. `DiscoveryPanel` (manchete editorial) não foi estendido ao nível estadual — exigiria engenharia nova,
   não só composição; registrado como pendência real para fase futura, não esta.
2. Uma identidade visual verdadeiramente distinta por tema (cores/ritmo próprios, não só o mesmo sistema
   aplicado 5x) não foi construída nesta sub-fase — a auditoria visual real não encontrou repetição
   problemática o suficiente para justificar o risco de uma reformulação sem evidência concreta, mas isso
   significa que a ambição mais funda da Parte VIII do mandato (identidade própria por tema) permanece
   como trabalho futuro, não concluído aqui.
3. axe-core não pôde ser re-executado nesta sub-fase (ferramenta externa indisponível no momento) —
   registrado como `NOT_EVALUATED`, não inflado para `PASS`.
4. O resíduo de 7px de overflow em Infraestrutura (320px, documentado desde P0, não eliminado em P6.1)
   continua sem causa raiz localizada.

Nenhum impedimento bloqueia a Fase P7 (QA, acessibilidade e regressão final) — pelo contrário, P7 é
exatamente onde a ressalva 3 (axe-core) deve ser retomada com a ferramenta externa disponível, e onde uma
auditoria de acessibilidade mais ampla (múltiplas rotas, não só `/estados/ES`) deve acontecer pela
primeira vez de forma completa.
