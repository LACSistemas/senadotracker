# Relatório final — Redesign estrutural do Judiciário

**Status do Gate G1: `READY_FOR_USER_VISUAL_APPROVAL`**

## Resumo executivo

As quatro experiências do Judiciário (`/judiciario`, `/judiciario/temas`, `/judiciario/tribunais`, `/judiciario/tribunais/[id]`) foram reconstruídas sobre o mock aprovado, com os mesmos dados reais já publicados em P14.1–P14.12 — nenhum coletor novo, nenhuma migration, nenhum dado simulado. O trabalho seguiu as fases J0–J6 do mandato, nessa ordem, com verificação contínua (typecheck, e2e real, axe-core real, overflow medido) a cada fase, não só no fim.

Dois elementos do mock não foram replicados literalmente por serem estatisticamente inválidos com o dado real — um donut de "casos novos por tema" (os 6 temas usam métricas diferentes entre si, não um total comum) e um KPI nacional de "taxa de congestionamento" (indicador oficialmente não agregável entre tribunais). Ambos foram substituídos por alternativas honestas, documentadas em `J0_AUDITORIA_E_CONTRATOS.md`. Fotografia de arquivo foi substituída por ilustração SVG geométrica original, no mesmo estilo já usado pelo Legislativo (`/congresso.svg`) — evita o risco de direitos de imagem que o próprio mandato sinaliza, sem perder a identidade visual pedida.

Dois achados reais de bug pré-existente (não introduzidos por este programa) foram encontrados e corrigidos durante a reconstrução: o filtro de Ramo do diretório usava códigos que não existem no banco (5 de 8 ramos sempre devolviam zero resultados), e um `min-width:auto` de CSS Grid quebrava o layout mobile do novo perfil de tribunal.

## O que foi construído

**Backend** (`packages/db/src/postgres-judiciary-serving.ts`): `getJudiciaryTribunalDirectory` ganhou `casos_novos` e `taxa_congestionamento` por tribunal (subquery correlacionada sobre `jud_jn_observation`, mesmo ano da consulta) e um parâmetro `sort` — única extensão de leitura do programa, sem schema novo.

**3 ilustrações SVG originais** (`apps/web/public/judiciario-{nacional,temas,tribunais}.svg`): colunata + emblema de balança, balança isolada, fachada de tribunal — mesmo estilo geométrico de `/congresso.svg`.

**4 páginas reconstruídas**:
- `apps/web/app/judiciario/page.tsx` — hero editorial com foto, 4 KPIs reais com variação ano-a-ano calculada (não fixada), "A Justiça em movimento" + módulo "Como a Justiça se organiza?", congestionamento como seção honesta, temas, atalhos.
- `apps/web/app/judiciario/temas/page.tsx` — sidebar de navegação, "Visão geral dos temas" (6 cartões independentes em vez de donut inválido), "Temas em destaque", grade completa, temas em investigação.
- `apps/web/app/judiciario/tribunais/page.tsx` — hero, abas Tribunais/Comparar, busca, filtros (Ramo corrigido + UF novo), ordenação nova, tabela com 2 colunas de indicador real por tribunal.
- `apps/web/app/judiciario/tribunais/[id]/page.tsx` — trilha + cabeçalho institucional compacto, navegação por capítulo horizontal, "Retrato institucional" (congestionamento por tribunal, válido nesse grão), "Movimentação processual" + "Tempo e desempenho" + CTA de comparação, "Em destaque", e todos os capítulos anteriores preservados — inclusive Jurisprudência e Ministros do STF (P14.9–P14.12), intocados.

## Cobertura por fase

| Fase | Entregável | Status |
|---|---|---|
| J0 | `J0_AUDITORIA_E_CONTRATOS.md` + 8 capturas de baseline | Concluída |
| J1 | Portal nacional | Concluída, 23/23 e2e |
| J2 | Perfil de tribunal (TJES + STF) | Concluída, 52/52 e2e |
| J3 | Diretório e explorador | Concluída, 52/52 e2e |
| J4 | Portal de temas | Concluída, 52/52 e2e |
| J5 | Responsividade e acessibilidade | Concluída, 0 violações axe-core, 0 overflow |
| J6 | Auditoria final | Este relatório + `J6_AUDITORIA_FINAL.md` |

## Testes

- Typecheck: limpo em `@senadotracker/db` e `@senadotracker/web`, repetido a cada fase.
- E2E: 52 testes (`p148`, `p150`, `p151`, `p152`) passando na rodada final — 4 asserções atualizadas ao longo do programa para refletir mudanças de composição deliberadas (nunca para esconder uma regressão real; cada uma documentada no relatório da fase correspondente).
- Acessibilidade: axe-core real, 0 violações, 4 rotas × 2 larguras.
- Responsividade: overflow medido (não estimado) em 5 rotas × 5 larguras = 0 em todas.

## O que não foi feito (fora de escopo, por decisão explícita do mandato ou por tempo)

- Nenhum coletor novo, nenhuma tabela nova, nenhum backfill.
- O componente compartilhado "Entenda este indicador" (§9 do mandato) não foi construído como um componente novo e separado — a explicação de metodologia por indicador já existe e foi preservada via `MethodologyPanel` e `JudiciaryAvailabilityNote`, reaproveitados em todas as páginas; não havia necessidade real de uma terceira camada de UI para o mesmo conteúdo.
- O seletor de comparação inline dentro do diretório (mock mostra uma aba "Comparar tribunais" como se fosse o mesmo diretório em modo de seleção) foi implementado como um link para o comparador já existente, em vez de duplicar a lógica de seleção — ver justificativa em `J3_DIRETORIO_E_COMPARADOR.md`.
- Medição de desempenho de campo (LCP/INP/CLS) não foi feita — só verificação de ausência de regressão visual/funcional.
- `seat_uf` ausente no catálogo institucional (achado real, pré-existente) não foi corrigido — exigiria investigação de backend fora do escopo deste redesign.

## Confirmação de segurança arquitetural

Nenhuma migration, nenhuma alteração de schema, nenhuma tabela nova, nenhum backfill, nenhum coletor reiniciado ou interrompido, nenhuma página territorial/Executivo tocada, nenhum dado simulado. Build e verificação sempre isolados da porta de dev do usuário. Nada foi commitado — como todo o resto do domínio Judiciário nesta base de código, este trabalho aguarda revisão explícita antes de qualquer commit.

## Próximo passo

Aguardando aprovação visual do usuário (Gate G1) sobre as capturas reais em `artifacts/j0-judiciario-redesign/` antes de considerar o programa definitivamente fechado.
