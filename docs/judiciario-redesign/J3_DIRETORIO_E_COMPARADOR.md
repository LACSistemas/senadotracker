# J3 — Diretório e explorador de tribunais

Reconstrução de `apps/web/app/judiciario/tribunais/page.tsx` + extensão de leitura em `getJudiciaryTribunalDirectory` (`packages/db/src/postgres-judiciary-serving.ts`).

## O que mudou

- **Hero** com a ilustração `/judiciario-tribunais.svg` (fachada de tribunal, mesma técnica do J1), título "Encontre e compare tribunais." e subtítulo do mock.
- **Abas "Tribunais (93)" / "Comparar tribunais"**: a segunda leva para `/judiciario/comparar` (já existente e funcional) em vez de duplicar a lógica de seleção/comparação dentro do diretório — o mandato autoriza essa escolha quando reconstruir o seletor inline exigiria mais contrato do que o tempo da fase permite (§7.6).
- **Filtro de UF/Jurisdição** (novo) e **ordenação** (novo: nome, casos novos, taxa de congestionamento) — ambos refletidos na URL (`?uf=`, `?ordenar=`), como os filtros existentes.
- **Contagem real por ramo nos filtros** (ex. "Justiça Estadual (27)") — busca o total de cada ramo via a própria função de diretório (`pageSize:1`), não um número fixo.
- **Duas colunas novas na tabela**: "Casos novos (2025)" e "Taxa de congestionamento", por tribunal — substituem a antiga coluna "Cobertura" (badges), que o mock tampouco mostra. A tabela/cards responsivos já existiam prontos no `DataTable` compartilhado (desktop = `<table>`, mobile = lista de cards) — nenhuma mudança necessária ali.

## Extensão de leitura (não é migration nem tabela nova)

`getJudiciaryTribunalDirectory` ganhou dois campos por linha (`casos_novos`, `taxa_congestionamento`, via subquery correlacionada em `jud_jn_observation` para o ano pedido) e um parâmetro `sort`. É adaptador de leitura sobre tabela existente — exatamente o que o mandato permite em §1.1 (só veda migration/schema/tabela nova).

## Achado real: o filtro de Ramo estava quebrado para 5 dos 8 ramos

A constante `BRANCHES` do frontend usava os códigos `TJ`, `TRF`, `TRT`, `TRE`, `TJM` — nenhum deles existe em `jud_branch.code`. O código real, confirmado no seed de P14.1 (`scripts/exec/p141-collect.ts`), é `ESTADUAL`, `FEDERAL`, `TRABALHO`, `ELEITORAL`, `MILITAR`, `SUPERIOR`, `STF`, `CNJ`. Na prática, filtrar por "Justiça Estadual", "Justiça Federal", "Justiça do Trabalho", "Justiça Eleitoral" ou "Justiça Militar Estadual" sempre devolvia **0 resultados** — só "Tribunais Superiores", "STF" e "CNJ" funcionavam, por coincidência de nome igual a código. Esse bug é anterior a esta sessão (não foi introduzido por nenhuma fase do redesign) e só apareceu porque J3 precisava validar as contagens reais por ramo. Corrigido junto com o resto da reconstrução.

Contagens reais confirmadas ao vivo (não as do mock, que tinha uma distribuição ligeiramente diferente): Estadual 27, Federal 6, Trabalho 25 (24 TRTs + TST), Eleitoral 28 (27 TREs + TSE), Militar 3, Superior 2 (STJ + STM), STF 1, CNJ 1 — soma 93. O mock assumia TST/TSE/STM todos sob um único balde "Superiores" (4); o catálogo real agrupa cada tribunal superior sob seu próprio ramo, o que é mais correto institucionalmente.

## Achado real (não corrigido): `seat_uf` ausente no catálogo

A coluna "Jurisdição" mostra "—" para praticamente todos os tribunais, incluindo o TJES — confirmado que isso já acontecia **antes** de qualquer mudança desta sessão (visível no screenshot de baseline de J0, `tribunais-desktop.png`, coluna "UF sede"). `jud_tribunal.seat_uf` está nulo no catálogo para a maioria dos registros, inclusive estaduais onde o dado deveria existir. Não foi corrigido aqui — exigiria investigar/backfillar o cadastro institucional de P14.1, fora do escopo de um redesign de frontend (G6: zero migration/backfill não autorizado). Mantido honesto como "—", nunca inferido da sigla (ex. não assumir "ES" só porque a sigla é "TJES").

## Verificação

- Typecheck limpo (`@senadotracker/db` e `@senadotracker/web`).
- Capturas reais: desktop, mobile (cards, sem overflow) e filtro aplicado (`artifacts/j0-judiciario-redesign/j3-*.png`) — inspecionadas visualmente.
- Suíte e2e completa do Judiciário: **52/52 passando**, incluindo a busca por sigla e a navegação entre as 4 rotas principais.
