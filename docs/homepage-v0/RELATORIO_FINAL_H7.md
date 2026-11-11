# H7 — Data Storytelling & Editorial Excellence — Relatório final

Mandato corretivo: a H6 resolveu a composição do hero (texto+mapa+indicadores integrados, faixa dos três poderes anexada), mas o usuário considerou a evolução visual insuficiente em 3 pontos específicos — data storytelling sem protagonismo, três poderes sem identidade visual própria, e mobile ainda comportando-se como sequência de cards. Este relatório consolida H7.0-H7.6. Documentos de fase: `H7_DATA_STORYTELLING.md`, `H7_DIRECAO_DE_ARTE.md`, `H7_MOBILE_UX.md`, `H7_AUDITORIA_FINAL.md`.

## Arquivos alterados
Só `apps/web/app/page.tsx` — mudança 100% de apresentação, uma única rota.

## O que foi reconstruído (não ajustes cosméticos)

1. **Educação**: mapa de nível único → mapa de **variação** Ideb 2023→2025 (paleta divergente, tokens já existentes do design system), respondendo de fato a uma pergunta de evolução, não de fotografia.
2. **Justiça**: mini-barra de 80px sem eixo → gráfico de linhas real, com eixo, legenda e tabela alternativa para leitor de tela.
3. **Gastos públicos**: número gigante isolado → barras das 3 maiores categorias reais de despesa do Judiciário, validadas contra o total publicado e rotuladas como parciais (não 100%).
4. **Legislativo**: barra de composição compacta → hemiciclo real (mesma geometria de `/legislativo`), identidade parlamentar de volta.
5. **Executivo**: 3º mapa do Brasil na página → composição de 3 medidores de serviço (saúde/educação/infraestrutura), zero mapas neste cartão.
6. **Judiciário**: 2 barras repetindo a linguagem visual da história de Justiça → ranking por ramo da Justiça (estrutura, não movimento no tempo).
7. **Mobile**: histórias empilhadas verticalmente → carrossel horizontal com `scroll-snap`, uma história por vez, sem autoplay, sem esconder conteúdo.
8. **Hero**: avaliado contra os critérios do mandato e mantido — já atendia aos requisitos, nenhuma mudança estrutural com ganho real identificado.

## Contratos de dados utilizados (nenhum novo, exceto 1)
`getIdebTerritory` (já existente, agora lida 2 edições por UF em vez de 1), `judOverview.data.branches` (já carregado, só não estava sendo lido), `JN_EXPENSE_MAGISTRATES`/`SERVERS`/`BENEFITS`/`TOTAL` (já existentes em `judOverview.data.metrics`), `layoutHemicycle`/`partyColor` (já usados em `/legislativo`). Única adição: `getInfrastructureEditorialKpis({level:'BRASIL'})`, já existente e exportado por `@senadotracker/db`, nunca antes chamado nesta página.

## Valores e fontes citados nesta fase
- Ideb: 26 estados melhoraram, 0 pioraram, 1 estável (2023→2025) — INEP, edição 2025.
- Despesa do Judiciário: Servidores R$107,8bi, Magistrados R$34,5bi, Benefícios R$15,5bi — juntas R$157,8bi dos R$164,6bi publicados (~96%) — CNJ, Justiça em Números, 2025.
- Processos baixados por ramo: Estadual 31,4mi, Federal 7,3mi, Trabalho 5,4mi, Eleitoral 0,53mi — CNJ, 2025.
- Via pavimentada no entorno do domicílio: 89,3% — Censo 2022, IBGE.

## Achado real corrigido: bug de overflow mobile
Uma tabela `sr-only` (alternativa textual de acessibilidade para a série de Justiça) causava 439px de overflow horizontal fantasma no carrossel mobile — causa raiz confirmada por bisseção de DOM (não suposição): `table-layout:auto` ignora `width:1px` quando o conteúdo pede mais espaço, e a caixa de layout resultante conta para `document.documentElement.scrollWidth` mesmo com `overflow:hidden`/`position:absolute`. Corrigido trocando a tabela por uma lista `sr-only` com o mesmo conteúdo. Detalhe completo em `H7_MOBILE_UX.md`.

## Achado investigado e descartado: "header branco" na captura
Confirmado como artefato de `fullPage: true` do Playwright com um elemento `position:sticky` (o header), não um bug do produto — um único `<header>` existe no DOM, e a captura da viewport real após rolagem mostra o comportamento correto. Nenhuma mudança feita no comportamento sticky.

## Testes executados
TypeScript typecheck (isolado, limpo), build via servidor de dev isolado, axe-core real (2 categorias pré-existentes, contagem de nós reduzida de 81/3 para 54/2 — de volta ao baseline original), suíte e2e completa (25 testes, 5 falhas já conhecidas e não relacionadas, 0 regressões novas), responsividade real em 9 larguras (320-1920px).

## Testes não executados
Lighthouse/métricas de campo de performance (LCP/CLS/INP) — sem Real User Monitoring neste ambiente de desenvolvimento isolado; avaliação qualitativa de peso adicionado feita em seu lugar (ver `H7_AUDITORIA_FINAL.md` §Performance).

## Problemas residuais conhecidos (não corrigidos, fora de escopo)
- 11px de overflow em 1024px no cabeçalho global — pré-existente, confirmado também em `/estados`.
- 2 categorias de violação de acessibilidade no componente de mapa compartilhado — pré-existentes, mesma causa raiz documentada desde H5.
- 5 falhas de e2e pré-existentes/flakiness de paralelismo — mesmas de H6, já investigadas.
- `/executivo` mantém, desde antes desta sessão, um link para `/obras` (rota inexistente) — já registrado em H4/H6.

## Confirmação de segurança arquitetural
Nenhuma migration, backfill, alteração de schema, materialização, reinício de coletor ou comando destrutivo de Git em toda a fase H7. Zero escrita no banco — todas as funções chamadas são leituras já existentes.

## Status: READY_FOR_USER_VISUAL_APPROVAL

Os três problemas do diagnóstico vinculante (§2 do mandato) foram endereçados com reconstrução real, não ajuste cosmético: histórias agora têm evidência visual própria e proporcional ao seu peso editorial; os três poderes têm identidade visual característica (hemiciclo/medidores/ranking); o mobile tem composição própria (carrossel) em vez de empilhamento. A aprovação do Gate G1 (impacto visual) permanece, por instrução explícita do mandato, uma decisão do usuário.
